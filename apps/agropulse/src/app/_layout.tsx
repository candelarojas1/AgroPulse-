import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { StateView } from '@/components/StateView';
import { AuthProvider, useAuth } from '@/context/AuthContext';

// Rutas protegidas: sin sesión solo existe el login; con sesión, solo la app.
// Si la sesión se cierra o vence, Expo Router vuelve solo al login.
function RootNavigator() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return <StateView loading />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </AuthProvider>
  );
}
