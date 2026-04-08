import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTokens } from '../src/theme';
import { useAuthStore } from '../src/stores/authStore';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const t = useTokens();
  const { forgotPassword, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

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
      style={[styles.container, { backgroundColor: t.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={styles.icon}>{'🔑'}</Text>
        <Text style={[styles.title, { color: t.textPrimary }]}>Reset Password</Text>
        <Text style={[styles.subtitle, { color: t.textSecondary }]}>
          Enter the email on your account and we'll send you a password reset link.
        </Text>
      </View>

      <View style={styles.form}>
        {error && (
          <View style={[styles.errorBox, { backgroundColor: t.errorLight }]}>
            <Text style={[styles.errorText, { color: t.error }]}>{error}</Text>
          </View>
        )}

        {sent ? (
          <View style={[styles.successBox, { backgroundColor: t.primaryLight }]}>
            <Text style={[styles.successText, { color: t.primary }]}>
              If an account exists for that email, a reset link has been sent. Check your inbox (and spam folder).
            </Text>
          </View>
        ) : (
          <>
            <TextInput
              style={[styles.input, { backgroundColor: t.inputBackground, borderColor: t.border, color: t.textPrimary }]}
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
              style={[styles.button, { backgroundColor: submitting ? t.primaryDisabled : t.primary }]}
              onPress={handleSubmit}
              disabled={submitting || !email.trim()}
            >
              <Text style={[styles.buttonText, { color: t.textOnPrimary }]}>
                {submitting ? 'Sending...' : 'Send Reset Link'}
              </Text>
            </Pressable>
          </>
        )}

        <Pressable style={styles.link} onPress={() => router.back()}>
          <Text style={[styles.linkText, { color: t.primary }]}>
            Back to Sign In
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
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 8,
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
  successBox: {
    padding: 16,
    borderRadius: 10,
  },
  successText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
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
