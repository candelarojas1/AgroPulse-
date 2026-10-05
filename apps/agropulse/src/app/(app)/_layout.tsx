import { Stack } from 'expo-router';

import { StateView } from '@/components/StateView';
import { useAuth } from '@/context/AuthContext';
import { OrgProvider, useOrg } from '@/context/OrgContext';
import { PlotsProvider } from '@/context/PlotsContext';
import { Colors } from '@/constants/colors';
import { getErrorMessage } from '@/lib/errors';

function AppNavigator() {
  const { isLoading, error, memberships, reload } = useOrg();
  const { signOut } = useAuth();

  if (isLoading) {
    return <StateView loading message="Cargando establecimientos…" />;
  }
  if (error) {
    return <StateView message={getErrorMessage(error)} actionLabel="Reintentar" onAction={reload} />;
  }
  if (memberships.length === 0) {
    return (
      <StateView
        message="Tu usuario no pertenece a ningún establecimiento."
        actionLabel="Cerrar sesión"
        onAction={signOut}
      />
    );
  }

  return (
    <PlotsProvider>
      <Stack screenOptions={{ headerTintColor: Colors.primary, headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="plot/[id]" options={{ title: 'Lote' }} />
      </Stack>
    </PlotsProvider>
  );
}

export default function AppLayout() {
  return (
    <OrgProvider>
      <AppNavigator />
    </OrgProvider>
  );
}
