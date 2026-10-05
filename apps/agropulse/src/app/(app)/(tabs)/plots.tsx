import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { StateView } from '@/components/StateView';
import { StatusBadge } from '@/components/StatusBadge';
import { Colors } from '@/constants/colors';
import { usePlots } from '@/context/PlotsContext';
import { getErrorMessage } from '@/lib/errors';

// Lista de lotes del establecimiento activo con su semáforo (RF-04).
export default function PlotsScreen() {
  const router = useRouter();
  const { plots, isLoading, error, reload } = usePlots();

  if (isLoading) return <StateView loading message="Cargando lotes…" />;
  if (error) return <StateView message={getErrorMessage(error)} actionLabel="Reintentar" onAction={reload} />;
  if (plots.length === 0) return <StateView message="Este establecimiento todavía no tiene lotes." />;

  return (
    <FlatList
      style={styles.list}
      data={plots}
      keyExtractor={(plot) => plot.id}
      refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}
      renderItem={({ item }) => (
        <Pressable
          style={styles.row}
          onPress={() => router.push({ pathname: '/plot/[id]', params: { id: item.id } })}
        >
          <View style={styles.info}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>
              {item.crop ?? 'Sin cultivo'}
              {item.moisture_pct !== null && ` · humedad ${item.moisture_pct}%`}
            </Text>
          </View>
          <StatusBadge status={item.status} />
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    color: Colors.text,
  },
  meta: {
    fontSize: 13,
    color: Colors.textMuted,
  },
});
