import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';

type Props = {
  loading?: boolean;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

// Estados de pantalla completos: carga inicial, vacío y error de red (§12).
export function StateView({ loading, message, actionLabel, onAction }: Props) {
  return (
    <View style={styles.container}>
      {loading && <ActivityIndicator size="large" color={Colors.primary} />}
      {message && <Text style={styles.message}>{message}</Text>}
      {actionLabel && onAction && (
        <Pressable style={styles.button} onPress={onAction}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
    backgroundColor: Colors.background,
  },
  message: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  button: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
