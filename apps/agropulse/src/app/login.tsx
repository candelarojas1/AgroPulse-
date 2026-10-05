import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/colors';
import { getErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isLoading;

  const onSubmit = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // Si sale bien, AuthContext recibe la sesión y la navegación pasa a la app.
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setErrorMessage(getErrorMessage(error));
      }
    } catch (err) {
      setErrorMessage(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Ionicons name="leaf" size={48} color={Colors.primary} />
          <Text style={styles.title}>AgroPulse</Text>
          <Text style={styles.subtitle}>Riego de precisión</Text>
        </View>

        {errorMessage && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={18} color={Colors.error} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={Colors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isLoading}
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor={Colors.textMuted}
          secureTextEntry
          autoCapitalize="none"
          editable={!isLoading}
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={canSubmit ? onSubmit : undefined}
        />

        <Pressable
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={onSubmit}
          disabled={!canSubmit}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Ingresar</Text>
          )}
        </Pressable>

        <Text style={styles.disclaimer}>
          Demo académica: los datos de humedad y las ubicaciones son ficticios.
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textMuted,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: Colors.errorBackground,
  },
  errorText: {
    flex: 1,
    color: Colors.error,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disclaimer: {
    marginTop: 24,
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
