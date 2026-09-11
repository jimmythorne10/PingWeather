import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useStyles, useTokens } from '../src/theme';
import { useAuthStore } from '../src/stores/authStore';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const t = useTokens();
  const { forgotPassword, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

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
      marginBottom: 8,
      color: c.textPrimary,
    },
    subtitle: {
      fontSize: look.typography.body.size,
      textAlign: 'center',
      // NOTE: lineHeight has no token in look.typography — LookTokens'
      // TypeStep carries only { size, weight, tracking }. Left as a literal
      // and reported as a contract gap (see migration report).
      lineHeight: look.typography.body.lineHeight,
      paddingHorizontal: look.spacing.sm,
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
    successBox: {
      padding: look.spacing.lg,
      borderRadius: look.radius.surface,
      backgroundColor: c.primaryLight,
    },
    successText: {
      fontSize: look.typography.body.size,
      textAlign: 'center',
      // Same lineHeight gap as `subtitle` above — no token exists for it.
      lineHeight: look.typography.body.lineHeight,
      color: c.primary,
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
      backgroundColor: submitting ? c.primaryDisabled : c.primary,
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

  const handleSubmit = async () => {
    clearError();
    const trimmed = email.trim();
    if (!trimmed) return;
    setSubmitting(true);
    await forgotPassword(trimmed);
    setSubmitting(false);
    // Always show the same success message regardless of whether the email exists.
    // Revealing "no such account" would leak which emails are registered.
    if (!useAuthStore.getState().error) {
      setSent(true);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
      <View style={styles.header}>
        <Text style={styles.icon}>{'🔑'}</Text>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>
          Enter the email on your account and we'll send you a password reset link.
        </Text>
      </View>

      <View style={styles.form}>
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {sent ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>
              If an account exists for that email, a reset link has been sent. Check your inbox (and spam folder).
            </Text>
          </View>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={t.textTertiary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!submitting}
            />

            <Pressable
              style={styles.button}
              onPress={handleSubmit}
              disabled={submitting || !email.trim()}
            >
              <Text style={styles.buttonText}>
                {submitting ? 'Sending...' : 'Send Reset Link'}
              </Text>
            </Pressable>
          </>
        )}

        <Pressable style={styles.link} onPress={() => router.back()}>
          <Text style={styles.linkText}>
            Back to Sign In
          </Text>
        </Pressable>
      </View>
      </View>
    </KeyboardAvoidingView>
  );
}
