import { Stack, useLocalSearchParams } from 'expo-router';

import { StateView } from '@/components/StateView';
import { usePlots } from '@/context/PlotsContext';

// Placeholder: el detalle completo (lectura, gráfico, umbral, válvulas) llega en la etapa 5.
export default function PlotDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { plots } = usePlots();
  const plot = plots.find((p) => p.id === id);

  return (
    <>
      <Stack.Screen options={{ title: plot?.name ?? 'Lote' }} />
      <StateView message={plot ? `Detalle de ${plot.name} (próximamente)` : 'Lote no encontrado.'} />
    </>
  );
}
