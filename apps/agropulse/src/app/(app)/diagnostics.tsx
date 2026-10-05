import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { ROLE_LABELS, useOrg } from '@/context/OrgContext';
import { usePlots } from '@/context/PlotsContext';
import { useNow } from '@/hooks/useNow';
import { formatAge } from '@/lib/format';

// Observabilidad mínima (RF-23): quién soy, qué establecimiento veo y cuándo llegó el
// último tick por Realtime. Lag aparente = hora de llegada a la app − hora de medición:
// cuánto tardó el dato en recorrer simulador → Kafka → worker → Postgres → Realtime → app.
export default function DiagnosticsScreen() {
  const { session } = useAuth();
  const { activeOrg, role } = useOrg();
  const { plots, lastTick } = usePlots();
  const now = useNow(1000);

  const tickPlot = lastTick ? plots.find((p) => p.station_id === lastTick.stationId) : undefined;
  const lagSeconds = lastTick
    ? ((lastTick.receivedAt - new Date(lastTick.measuredAt).getTime()) / 1000).toFixed(1)
    : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sesión</Text>
        <Item label="Usuario (id)" value={session?.user.id ?? '—'} mono />
        <Item label="Email" value={session?.user.email ?? '—'} />
        <Item label="Rol" value={role ? `${ROLE_LABELS[role]} (${role})` : '—'} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Establecimiento activo</Text>
        <Item label="Nombre" value={activeOrg?.name ?? '—'} />
        <Item label="Id" value={activeOrg?.id ?? '—'} mono />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Último tick recibido (Realtime)</Text>
        {lastTick ? (
          <>
            <Item label="Lote" value={tickPlot?.name ?? '—'} />
            <Item label="Estación (id)" value={lastTick.stationId} mono />
            <Item label="Medido" value={new Date(lastTick.measuredAt).toLocaleTimeString('es-AR')} />
            <Item
              label="Recibido en la app"
              value={`${new Date(lastTick.receivedAt).toLocaleTimeString('es-AR')} (${formatAge(
                new Date(lastTick.receivedAt).toISOString(),
                now,
              )})`}
            />
            <Item label="Lag aparente" value={`${lagSeconds} s`} />
          </>
        ) : (
          <Text style={styles.muted}>
            Todavía no llegó ningún tick desde que se abrió la app. Revisá que el simulador y el worker estén
            corriendo.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

function Item({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.item}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, mono && styles.mono]}>{value}</Text>
    </View>
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
  item: {
    gap: 2,
  },
  label: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  value: {
    fontSize: 15,
    color: Colors.text,
  },
  mono: {
    fontFamily: 'Menlo',
    fontSize: 12,
  },
  muted: {
    fontSize: 13,
    color: Colors.textMuted,
  },
});
