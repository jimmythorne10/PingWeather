import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTokens } from '../src/theme';
import { useAuthStore } from '../src/stores/authStore';

export default function LoginScreen() {
  const router = useRouter();
  const t = useTokens();
  const { signIn, loading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    clearError();
    await signIn(email.trim(), password);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: t.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={styles.icon}>{'⛅'}</Text>
        <Text style={[styles.title, { color: t.textPrimary }]}>PingWeather</Text>
        <Text style={[styles.subtitle, { color: t.textSecondary }]}>Sign in to continue</Text>
      </View>

      <View style={styles.form}>
        {error && (
          <View style={[styles.errorBox, { backgroundColor: t.errorLight }]}>
            <Text style={[styles.errorText, { color: t.error }]}>{error}</Text>
          </View>
        )}

        <TextInput
          style={[styles.input, { backgroundColor: t.inputBackground, borderColor: t.border, color: t.textPrimary }]}
          placeholder="Email"
          placeholderTextColor={t.textTertiary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          style={[styles.input, { backgroundColor: t.inputBackground, borderColor: t.border, color: t.textPrimary }]}
          placeholder="Password"
          placeholderTextColor={t.textTertiary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Pressable
          style={[styles.button, { backgroundColor: loading ? t.primaryDisabled : t.primary }]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={[styles.buttonText, { color: t.textOnPrimary }]}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Text>
        </Pressable>

        <Pressable style={styles.link} onPress={() => router.push('/forgot-password')}>
          <Text style={[styles.linkText, { color: t.primary }]}>
            Forgot Password?
          </Text>
        </Pressable>

        <Pressable style={styles.link} onPress={() => router.push('/signup')}>
          <Text style={[styles.linkText, { color: t.primary }]}>
            Don't have an account? Sign Up
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  icon: {
    fontSize: 56,
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
  },
  form: {
    gap: 12,
  },
  errorBox: {
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  link: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  linkText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
