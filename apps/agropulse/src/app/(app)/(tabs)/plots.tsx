import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { StateView } from '@/components/StateView';
import { Colors } from '@/constants/colors';
import { useOrg } from '@/context/OrgContext';
import { getErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

type PlotRow = { id: string; name: string; crop: string | null };

// Lista mínima de lotes del establecimiento activo. El semáforo se agrega en la etapa 4.
export default function PlotsScreen() {
  const { activeOrg } = useOrg();
  const [plots, setPlots] = useState<PlotRow[]>([]);
  // Para qué establecimiento son los datos cargados: si cambia el activo, vuelve a "cargando".
  const [loadedOrgId, setLoadedOrgId] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!activeOrg) return;
    let cancelled = false;
    supabase
      .from('plots')
      .select('id, name, crop')
      .eq('organization_id', activeOrg.id)
      .order('name')
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          setError(queryError);
        } else {
          setPlots(data);
          setError(null);
        }
        setLoadedOrgId(activeOrg.id);
      });
    return () => {
      cancelled = true;
    };
  }, [activeOrg, reloadKey]);

  const reload = () => setReloadKey((key) => key + 1);
  const isLoading = loadedOrgId !== activeOrg?.id;

  if (isLoading) return <StateView loading />;
  if (error) return <StateView message={getErrorMessage(error)} actionLabel="Reintentar" onAction={reload} />;
  if (plots.length === 0) return <StateView message="Este establecimiento todavía no tiene lotes." />;

  return (
    <FlatList
      style={styles.list}
      data={plots}
      keyExtractor={(plot) => plot.id}
      refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.name}>{item.name}</Text>
          {item.crop && <Text style={styles.crop}>{item.crop}</Text>}
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
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  name: {
    fontSize: 16,
    color: Colors.text,
  },
  crop: {
    fontSize: 13,
    color: Colors.textMuted,
  },
});
