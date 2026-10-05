import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { STATUS_INFO, type PlotStatus } from '@/lib/plotStatus';

// Estado del semáforo con color + ícono + texto (accesibilidad, §12).
export function StatusBadge({ status }: { status: PlotStatus }) {
  const info = STATUS_INFO[status];
  return (
    <View style={[styles.badge, { backgroundColor: info.color }]}>
      <Ionicons name={info.icon} size={14} color="#FFFFFF" />
      <Text style={styles.text}>{info.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
