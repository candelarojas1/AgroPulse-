import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { MoistureChart, type ChartPoint } from '@/components/MoistureChart';
import { StateView } from '@/components/StateView';
import { StatusBadge } from '@/components/StatusBadge';
import { Colors } from '@/constants/colors';
import { useOrg } from '@/context/OrgContext';
import { usePlots } from '@/context/PlotsContext';
import { useNow } from '@/hooks/useNow';
import { getErrorMessage } from '@/lib/errors';
import { formatAge } from '@/lib/format';
import { supabase } from '@/lib/supabase';

type Valve = { id: string; name: string; status: 'open' | 'closed' };

export default function PlotDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { plots, reload: reloadPlots, updatePlot } = usePlots();
  const { role } = useOrg();
  const now = useNow(1000);
  const plot = plots.find((p) => p.id === id);
  const stationId = plot?.station_id ?? null;

  const [chartPoints, setChartPoints] = useState<ChartPoint[] | null>(null);
  const [valves, setValves] = useState<Valve[] | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [thresholdDraft, setThresholdDraft] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [thresholdMessage, setThresholdMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Serie de 6 h (promedios cada 5 min, vista moisture_last_6h) y válvulas del lote.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      stationId
        ? supabase.from('moisture_last_6h').select('measured_at, moisture_pct').eq('station_id', stationId).order('measured_at')
        : Promise.resolve({ data: [], error: null }),
      supabase.from('valves').select('id, name, status').eq('plot_id', id).order('name'),
    ]).then(([chartResult, valvesResult]) => {
      if (cancelled) return;
      const queryError = chartResult.error ?? valvesResult.error;
      if (queryError) {
        setLoadError(queryError);
        return;
      }
      setChartPoints((chartResult.data ?? []).map((p) => ({ ...p, moisture_pct: Number(p.moisture_pct) })));
      setValves(valvesResult.data as Valve[]);
      setLoadError(null);
    });
    return () => {
      cancelled = true;
    };
  }, [id, stationId, reloadKey]);

  // Realtime: un tick nuevo de la estación vuelve a pedir la serie (RF-10) y los
  // cambios de estado de las válvulas se reflejan al instante.
  useEffect(() => {
    const channel = supabase.channel(`plot-${id}`);
    if (stationId) {
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'readings', filter: `station_id=eq.${stationId}` },
        () => setReloadKey((key) => key + 1),
      );
    }
    channel
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'valves', filter: `plot_id=eq.${id}` },
        (payload) => {
          const updated = payload.new as Valve;
          setValves((current) => current?.map((v) => (v.id === updated.id ? { ...v, status: updated.status } : v)) ?? null);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, stationId]);

  if (!plot) {
    return <StateView message="Lote no encontrado." />;
  }

  const refresh = () => {
    reloadPlots();
    setReloadKey((key) => key + 1);
  };

  // Umbral mínimo (RF-11): solo el productor lo edita; RLS lo exige igual en la base.
  const canEditThreshold = role === 'producer';
  // Comandos: productor y operador. Al asesor se le deshabilita el botón (H2); si igual
  // intentara, la política RLS de la base lo rechaza.
  const canCommand = role === 'producer' || role === 'operator';
  const thresholdText = thresholdDraft ?? String(plot.threshold_min);

  const saveThreshold = async () => {
    const value = Number(thresholdText.replace(',', '.'));
    if (!Number.isFinite(value) || value < 0 || value >= plot.threshold_max) {
      setThresholdMessage({ text: `Ingresá un número entre 0 y ${plot.threshold_max - 1}.`, isError: true });
      return;
    }
    setIsSaving(true);
    setThresholdMessage(null);
    try {
      const { data, error } = await supabase
        .from('plots')
        .update({ threshold_min: value })
        .eq('id', plot.id)
        .select('threshold_min');
      if (error) throw error;
      if (!data?.length) throw { code: '42501' }; // RLS no dejó actualizar la fila
      updatePlot(plot.id, { threshold_min: value }); // el semáforo se recalcula al instante
      setThresholdDraft(null);
      setThresholdMessage({ text: 'Umbral guardado.', isError: false });
    } catch (err) {
      setThresholdMessage({ text: getErrorMessage(err), isError: true });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: plot.name }} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}
        keyboardShouldPersistTaps="handled"
      >
        {/* Última lectura y antigüedad (RF-09) */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Última lectura</Text>
            <StatusBadge status={plot.status} />
          </View>
          {plot.measured_at && plot.moisture_pct !== null ? (
            <>
              <Text style={styles.bigValue}>{plot.moisture_pct}%</Text>
              <Text style={styles.muted}>humedad del suelo · {formatAge(plot.measured_at, now)}</Text>
              <View style={styles.metrics}>
                <Text style={styles.metric}>
                  <Ionicons name="thermometer-outline" size={14} /> {plot.temp_c ?? '—'} °C
                </Text>
                <Text style={styles.metric}>
                  <Ionicons name="rainy-outline" size={14} /> {plot.rain_mm ?? 0} mm
                </Text>
              </View>
              {plot.status === 'stale' && (
                <Text style={styles.warning}>
                  La estación no reporta hace más de 15 minutos: los datos no son confiables.
                </Text>
              )}
            </>
          ) : (
            <Text style={styles.muted}>Este lote todavía no tiene lecturas.</Text>
          )}
        </View>

        {/* Gráfico de las últimas 6 h (RF-10) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Humedad · últimas 6 h</Text>
          {loadError ? (
            <Text style={styles.errorText}>{getErrorMessage(loadError)} Deslizá hacia abajo para reintentar.</Text>
          ) : chartPoints === null ? (
            <ActivityIndicator color={Colors.primary} style={styles.loader} />
          ) : (
            <MoistureChart points={chartPoints} />
          )}
        </View>

        {/* Umbrales (RF-11) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Umbrales de humedad</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Mínimo (riego)</Text>
            {canEditThreshold ? (
              <View style={styles.thresholdEdit}>
                <TextInput
                  style={styles.input}
                  value={thresholdText}
                  onChangeText={setThresholdDraft}
                  keyboardType="decimal-pad"
                  editable={!isSaving}
                />
                <Text style={styles.label}>%</Text>
                <Pressable
                  style={[styles.saveButton, (isSaving || thresholdDraft === null) && styles.disabled]}
                  onPress={saveThreshold}
                  disabled={isSaving || thresholdDraft === null}
                >
                  {isSaving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.saveText}>Guardar</Text>}
                </Pressable>
              </View>
            ) : (
              <Text style={styles.value}>{plot.threshold_min}%</Text>
            )}
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Máximo</Text>
            <Text style={styles.value}>{plot.threshold_max}%</Text>
          </View>
          {thresholdMessage && (
            <Text style={thresholdMessage.isError ? styles.errorText : styles.success}>{thresholdMessage.text}</Text>
          )}
          {!canEditThreshold && <Text style={styles.muted}>Solo el productor puede editar los umbrales.</Text>}
        </View>

        {/* Válvulas del lote (RF-13) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Válvulas</Text>
          {valves === null && !loadError && <ActivityIndicator color={Colors.primary} style={styles.loader} />}
          {valves?.length === 0 && <Text style={styles.muted}>Este lote no tiene válvulas.</Text>}
          {valves?.map((valve) => (
            <View key={valve.id} style={styles.valveRow}>
              <Ionicons
                name={valve.status === 'open' ? 'water' : 'water-outline'}
                size={20}
                color={valve.status === 'open' ? '#1565C0' : Colors.textMuted}
              />
              <Text style={styles.valveName}>{valve.name}</Text>
              <Text style={[styles.valveStatus, valve.status === 'open' && styles.valveOpen]}>
                {valve.status === 'open' ? 'Abierta' : 'Cerrada'}
              </Text>
              <Pressable
                style={[styles.irrigateButton, !canCommand && styles.disabled]}
                disabled={!canCommand}
                onPress={() =>
                  router.push({
                    pathname: '/plot/[id]/command',
                    params: { id: plot.id, valveId: valve.id, valveName: valve.name },
                  })
                }
              >
                <Text style={styles.irrigateText}>Regar</Text>
              </Pressable>
            </View>
          ))}
          {!canCommand && <Text style={styles.muted}>Tu rol (asesor) no permite comandar válvulas.</Text>}
          <Pressable
            style={styles.historyLink}
            onPress={() => router.push({ pathname: '/plot/[id]/history', params: { id: plot.id } })}
          >
            <Ionicons name="time-outline" size={18} color={Colors.primary} />
            <Text style={styles.historyText}>Historial de comandos</Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
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
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bigValue: {
    fontSize: 40,
    fontWeight: '700',
    color: Colors.text,
  },
  muted: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  metrics: {
    flexDirection: 'row',
    gap: 16,
  },
  metric: {
    fontSize: 14,
    color: Colors.text,
  },
  warning: {
    fontSize: 13,
    color: '#8A6D00',
    backgroundColor: '#FFF8E1',
    padding: 8,
    borderRadius: 6,
  },
  loader: {
    paddingVertical: 24,
  },
  label: {
    fontSize: 15,
    color: Colors.textMuted,
  },
  value: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '600',
  },
  thresholdEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    width: 56,
    textAlign: 'center',
    fontSize: 15,
    color: Colors.text,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 76,
    alignItems: 'center',
  },
  saveText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
  },
  success: {
    fontSize: 13,
    color: Colors.primary,
  },
  valveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  valveName: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  valveStatus: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  valveOpen: {
    color: '#1565C0',
    fontWeight: '600',
  },
  irrigateButton: {
    backgroundColor: Colors.primary,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginLeft: 8,
  },
  irrigateText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
  },
  historyText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
});
