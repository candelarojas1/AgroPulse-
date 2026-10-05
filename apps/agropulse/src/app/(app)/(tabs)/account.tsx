import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { ROLE_LABELS, useOrg } from '@/context/OrgContext';

export default function AccountScreen() {
  const { session, signOut } = useAuth();
  const { memberships, activeOrg, role, selectOrg } = useOrg();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.label}>Usuario</Text>
        <Text style={styles.value}>{session?.user.email}</Text>
        <Text style={styles.label}>Rol en el establecimiento activo</Text>
        <Text style={styles.value}>{role ? ROLE_LABELS[role] : '—'}</Text>
      </View>

      {/* Selector de establecimiento (RF-03): solo si el usuario tiene más de uno. */}
      <View style={styles.card}>
        <Text style={styles.label}>
          {memberships.length > 1 ? 'Establecimiento activo' : 'Establecimiento'}
        </Text>
        {memberships.map(({ organization, role: orgRole }) => {
          const isActive = organization.id === activeOrg?.id;
          return (
            <Pressable
              key={organization.id}
              style={styles.orgRow}
              onPress={() => selectOrg(organization.id)}
              disabled={memberships.length === 1}
            >
              <Ionicons
                name={isActive ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={isActive ? Colors.primary : Colors.textMuted}
              />
              <View style={styles.orgInfo}>
                <Text style={styles.value}>{organization.name}</Text>
                <Text style={styles.orgMeta}>
                  {organization.region} · {ROLE_LABELS[orgRole]}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Pressable style={styles.logoutButton} onPress={signOut}>
        <Ionicons name="log-out-outline" size={20} color={Colors.error} />
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </Pressable>

      <Text style={styles.disclaimer}>
        Demo académica: los datos de humedad, clima y ubicación de los lotes son ficticios.
      </Text>
    </ScrollView>
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
    gap: 6,
  },
  label: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },
  value: {
    fontSize: 16,
    color: Colors.text,
  },
  orgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  orgInfo: {
    flex: 1,
  },
  orgMeta: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
  },
  logoutText: {
    color: Colors.error,
    fontSize: 16,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
