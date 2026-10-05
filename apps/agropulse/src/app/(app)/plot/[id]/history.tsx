import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { StateView } from '@/components/StateView';
import { Colors } from '@/constants/colors';
import {
  actionLabel,
  failureReasonLabel,
  STATUS_LABELS,
  type CommandAction,
  type CommandStatus,
} from '@/lib/commands';
import { getErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';

type CommandRow = {
  id: string;
  action: CommandAction;
  duration_min: number | null;
  status: CommandStatus;
  failure_reason: string | null;
  requested_by_email: string;
  created_at: string;
  valve: { name: string };
};

const STATUS_COLORS: Record<CommandStatus, string> = {
  pending: '#8A6D00',
  applied: Colors.primary,
  failed: Colors.error,
};

// Historial de los últimos 20 comandos del lote: fecha, actor y resultado (RF-18).
export default function CommandHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [commands, setCommands] = useState<CommandRow[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('irrigation_commands')
      .select('id, action, duration_min, status, failure_reason, requested_by_email, created_at, valve:valves!inner(name)')
      .eq('valve.plot_id', id)
      .order('created_at', { ascending: false })
      .limit(20)
      .overrideTypes<CommandRow[], { merge: false }>()
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          setError(queryError);
        } else {
          setCommands(data);
          setError(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  const reload = () => setReloadKey((key) => key + 1);

  if (error) return <StateView message={getErrorMessage(error)} actionLabel="Reintentar" onAction={reload} />;
  if (commands === null) return <StateView loading />;
  if (commands.length === 0) return <StateView message="Todavía no hay comandos para este lote." />;

  return (
    <FlatList
      style={styles.list}
      data={commands}
      keyExtractor={(command) => command.id}
      refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.rowTop}>
            <Text style={styles.action}>
              {actionLabel(item.action, item.duration_min)} · {item.valve.name}
            </Text>
            <Text style={[styles.status, { color: STATUS_COLORS[item.status] }]}>{STATUS_LABELS[item.status]}</Text>
          </View>
          <Text style={styles.meta}>
            {formatDateTime(item.created_at)} · {item.requested_by_email}
          </Text>
          {item.status === 'failed' && <Text style={styles.failure}>{failureReasonLabel(item.failure_reason)}</Text>}
        </View>
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
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: 2,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  action: {
    fontSize: 15,
    color: Colors.text,
    flex: 1,
  },
  status: {
    fontSize: 14,
    fontWeight: '600',
  },
  meta: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  failure: {
    fontSize: 13,
    color: Colors.error,
  },
});
