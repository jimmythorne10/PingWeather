import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useStyles, useTokens } from '../src/theme';
import { useAuthStore } from '../src/stores/authStore';

export default function SignupScreen() {
  const router = useRouter();
  const t = useTokens();
  const { signUp, loading, error, clearError } = useAuthStore();
  const [displayName, setDisplayName] = useState('');
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
      color: c.textPrimary,
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

  const handleSignup = async () => {
    clearError();
    await signUp(email.trim(), password, displayName.trim());
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
      <View style={styles.header}>
        <Text style={styles.icon}>{'⛅'}</Text>
        <Text style={styles.title}>Create Account</Text>
      </View>

      <View style={styles.form}>
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TextInput
          style={styles.input}
          placeholder="Display Name"
          placeholderTextColor={t.textTertiary}
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
        />

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
          onPress={handleSignup}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Creating Account...' : 'Sign Up'}
          </Text>
        </Pressable>

        <Pressable style={styles.link} onPress={() => router.back()}>
          <Text style={styles.linkText}>
            Already have an account? Sign In
          </Text>
        </Pressable>
      </View>
      </View>
    </KeyboardAvoidingView>
  );
}
