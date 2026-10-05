import { StateView } from '@/components/StateView';
import { useOrg } from '@/context/OrgContext';

// Placeholder: el mapa con polígonos y semáforo llega en la etapa siguiente.
export default function MapScreen() {
  const { activeOrg } = useOrg();
  return <StateView message={`Mapa de ${activeOrg?.name ?? ''} (próximamente)`} />;
}
