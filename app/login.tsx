import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useStyles, useTokens } from '../src/theme';
import { useAuthStore } from '../src/stores/authStore';

export default function LoginScreen() {
  const router = useRouter();
  const t = useTokens();
  const { signIn, loading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const styles = useStyles((c, look) => ({
    container: {
      flex: 1,
      justifyContent: 'center',
      padding: look.spacing.xl,
      backgroundColor: c.background,
    },
    header: {
      alignItems: 'center',
      marginBottom: 40,
    },
    icon: {
      fontSize: look.typography.display.size,
      marginBottom: 12,
    },
    title: {
      fontSize: look.typography.title.size,
      fontWeight: look.typography.title.weight,
      marginBottom: 4,
      color: c.textPrimary,
    },
    subtitle: {
      fontSize: look.typography.heading.size,
      color: c.textSecondary,
    },
    form: {
      gap: look.spacing.md,
    },
    errorBox: {
      padding: look.spacing.md,
      borderRadius: look.radius.surface,
      backgroundColor: c.errorLight,
    },
    errorText: {
      fontSize: look.typography.body.size,
      textAlign: 'center',
      color: c.error,
    },
    input: {
      borderWidth: 1,
      borderRadius: look.radius.surface,
      paddingVertical: look.spacing.lg,
      paddingHorizontal: look.spacing.lg,
      fontSize: look.typography.heading.size,
      backgroundColor: c.inputBackground,
      borderColor: c.border,
      color: c.textPrimary,
    },
    button: {
      paddingVertical: look.spacing.lg,
      borderRadius: look.radius.surface,
      alignItems: 'center',
      marginTop: 8,
      backgroundColor: loading ? c.primaryDisabled : c.primary,
    },
    buttonText: {
      fontSize: look.typography.heading.size,
      fontWeight: look.typography.heading.weight,
      color: c.textOnPrimary,
    },
    link: {
      alignItems: 'center',
      paddingVertical: look.spacing.md,
    },
    linkText: {
      fontSize: look.typography.body.size,
      fontWeight: look.typography.body.weight,
      color: c.primary,
    },
    inner: {
      maxWidth: 420,
      alignSelf: 'center',
      width: '100%',
    },
  }));

  const handleLogin = async () => {
    clearError();
    await signIn(email.trim(), password);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
      <View style={styles.header}>
        <Text style={styles.icon}>{'⛅'}</Text>
        <Text style={styles.title}>WeatherBeacon</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>
      </View>

      <View style={styles.form}>
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={t.textTertiary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={t.textTertiary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Pressable
          style={styles.button}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Text>
        </Pressable>

        <Pressable style={styles.link} onPress={() => router.push('/forgot-password')}>
          <Text style={styles.linkText}>
            Forgot Password?
          </Text>
        </Pressable>

        <Pressable style={styles.link} onPress={() => router.push('/signup')}>
          <Text style={styles.linkText}>
            Don't have an account? Sign Up
          </Text>
        </Pressable>
      </View>
      </View>
    </KeyboardAvoidingView>
  );
}
