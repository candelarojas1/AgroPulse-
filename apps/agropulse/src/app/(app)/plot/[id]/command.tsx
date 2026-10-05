import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { StateView } from '@/components/StateView';
import { Colors } from '@/constants/colors';
import { usePlots } from '@/context/PlotsContext';
import { actionLabel, failureReasonLabel, getCommandErrorMessage, type CommandAction } from '@/lib/commands';
import { supabase } from '@/lib/supabase';

type Choice = 'open' | 'open_for' | 'close';
// idle → sending → pending → applied | failed | timeout
type Phase = 'idle' | 'sending' | 'pending' | 'applied' | 'failed' | 'timeout';

const CONFIRMATION_TIMEOUT_MS = 10_000;

export default function CommandScreen() {
  const router = useRouter();
  const { id, valveId, valveName } = useLocalSearchParams<{ id: string; valveId: string; valveName: string }>();
  const { plots } = usePlots();
  const plot = plots.find((p) => p.id === id);

  // Se genera una sola vez al abrir la pantalla: si el usuario reintenta, viaja el mismo
  // id y la base rechaza el duplicado (idempotencia, §8).
  const [clientRequestId] = useState(() => Crypto.randomUUID());
  const [choice, setChoice] = useState<Choice>('open_for');
  const [durationText, setDurationText] = useState('30');
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failureReason, setFailureReason] = useState<string | null>(null);

  // Realtime: se escucha el comando por su client_request_id desde antes de enviarlo,
  // así no se pierde la confirmación aunque el worker sea muy rápido (RF-15).
  useEffect(() => {
    const channel = supabase
      .channel(`command-${clientRequestId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'irrigation_commands',
          filter: `client_request_id=eq.${clientRequestId}`,
        },
        (payload) => {
          const updated = payload.new as { status: string; failure_reason: string | null };
          if (updated.status === 'applied') setPhase('applied');
          if (updated.status === 'failed') {
            setFailureReason(updated.failure_reason);
            setPhase('failed');
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientRequestId]);

  // Si no hay confirmación en 10 s, se corta el spinner (RNF-05). Si la confirmación
  // llega después, Realtime igual actualiza la pantalla.
  useEffect(() => {
    if (phase !== 'pending') return;
    const timer = setTimeout(() => {
      setPhase((current) => (current === 'pending' ? 'timeout' : current));
    }, CONFIRMATION_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  if (!plot || !valveId) {
    return <StateView message="Válvula no encontrada." />;
  }

  const duration = Number(durationText);
  const durationIsValid = Number.isInteger(duration) && duration >= 1 && duration <= 120;
  const action: CommandAction = choice === 'close' ? 'close' : 'open';
  const durationMin = choice === 'open_for' ? duration : null;
  const canSend = (phase === 'idle' || phase === 'sending') && (choice !== 'open_for' || durationIsValid);

  const send = async () => {
    setPhase('sending');
    setErrorMessage(null);
    try {
      // Insert directo: RLS valida rol y organización; las restricciones de la base
      // evitan un segundo pending en la válvula (RF-16) y los duplicados.
      const { error } = await supabase.from('irrigation_commands').insert({
        valve_id: valveId,
        action,
        duration_min: durationMin,
        client_request_id: clientRequestId,
      });
      if (error) throw error;
      setPhase('pending');
    } catch (err) {
      setErrorMessage(getCommandErrorMessage(err));
      setPhase('idle');
    }
  };

  const isFinished = phase === 'applied' || phase === 'failed' || phase === 'timeout';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Resumen del comando (§12: lote, válvula, duración + client_request_id) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Resumen</Text>
        <Row label="Lote" value={plot.name} />
        <Row label="Válvula" value={valveName ?? '—'} />
        <Row label="Acción" value={actionLabel(action, durationMin)} />
        <Text style={styles.label}>client_request_id</Text>
        <Text style={styles.mono}>{clientRequestId}</Text>
      </View>

      {phase === 'idle' || phase === 'sending' ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>¿Qué querés hacer?</Text>
          <Option label="Abrir por N minutos" selected={choice === 'open_for'} onPress={() => setChoice('open_for')} />
          {choice === 'open_for' && (
            <View style={styles.durationRow}>
              <TextInput
                style={styles.input}
                value={durationText}
                onChangeText={setDurationText}
                keyboardType="number-pad"
                maxLength={3}
              />
              <Text style={styles.label}>minutos (1 a 120)</Text>
            </View>
          )}
          {choice === 'open_for' && !durationIsValid && (
            <Text style={styles.errorText}>La duración tiene que ser un número entero entre 1 y 120.</Text>
          )}
          <Option label="Abrir" selected={choice === 'open'} onPress={() => setChoice('open')} />
          <Option label="Cerrar" selected={choice === 'close'} onPress={() => setChoice('close')} />

          {errorMessage && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color={Colors.error} />
              <Text style={styles.errorBoxText}>{errorMessage}</Text>
            </View>
          )}

          <Pressable style={[styles.button, !canSend && styles.disabled]} onPress={send} disabled={!canSend || phase === 'sending'}>
            {phase === 'sending' ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Enviar comando</Text>}
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Estado del comando</Text>
          {phase === 'pending' && (
            <View style={styles.statusRow}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.statusText}>Pendiente: esperando confirmación de la válvula…</Text>
            </View>
          )}
          {phase === 'applied' && (
            <View style={styles.statusRow}>
              <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
              <Text style={styles.statusText}>
                Aplicado: la válvula quedó {action === 'open' ? 'abierta' : 'cerrada'}.
              </Text>
            </View>
          )}
          {phase === 'failed' && (
            <View style={styles.statusRow}>
              <Ionicons name="close-circle" size={24} color={Colors.error} />
              <Text style={styles.statusText}>Falló: {failureReasonLabel(failureReason)}</Text>
            </View>
          )}
          {phase === 'timeout' && (
            <View style={styles.statusRow}>
              <Ionicons name="time-outline" size={24} color="#8A6D00" />
              <Text style={styles.statusText}>
                Sin confirmación del sistema. El comando quedó pendiente; revisá el historial más tarde.
              </Text>
            </View>
          )}
          {isFinished && (
            <Pressable style={styles.button} onPress={() => router.back()}>
              <Text style={styles.buttonText}>Volver al lote</Text>
            </Pressable>
          )}
        </View>
      )}
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function Option({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.option} onPress={onPress}>
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={20}
        color={selected ? Colors.primary : Colors.textMuted}
      />
      <Text style={styles.value}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  value: {
    fontSize: 15,
    color: Colors.text,
  },
  mono: {
    fontFamily: 'Menlo',
    fontSize: 12,
    color: Colors.text,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 30,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    width: 60,
    textAlign: 'center',
    fontSize: 15,
    color: Colors.text,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: Colors.errorBackground,
  },
  errorBoxText: {
    flex: 1,
    color: Colors.error,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusText: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
});
