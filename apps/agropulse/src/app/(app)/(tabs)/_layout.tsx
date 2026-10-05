import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';

import { Colors } from '@/constants/colors';
import { useOrg } from '@/context/OrgContext';

export default function TabsLayout() {
  const { activeOrg } = useOrg();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        headerTitleStyle: { color: Colors.text },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Mapa',
          headerTitle: activeOrg?.name ?? 'Mapa',
          tabBarIcon: ({ color, size }) => <Ionicons name="map-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="plots"
        options={{
          title: 'Lotes',
          headerTitle: activeOrg?.name ?? 'Lotes',
          tabBarIcon: ({ color, size }) => <Ionicons name="list-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Cuenta',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
