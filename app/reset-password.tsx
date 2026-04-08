import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../src/utils/supabase';
import { useTokens } from '../src/theme';
import { parseRecoveryUrl } from '../src/services/parseRecoveryUrl';

type Status = 'parsing' | 'ready' | 'invalid' | 'submitting' | 'done';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const t = useTokens();
  const incomingUrl = Linking.useURL();

  const [status, setStatus] = useState<Status>('parsing');
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  // Activate the recovery session from whichever URL delivered us here.
  // Two sources: useURL (warm/live events) and getInitialURL (cold boot).
  useEffect(() => {
    let cancelled = false;

    const activate = async (rawUrl: string | null) => {
      if (cancelled) return;
      const tokens = parseRecoveryUrl(rawUrl);
      if (!tokens) {
        setStatus('invalid');
        setError('This reset link is invalid or has expired. Request a new one.');
        return;
      }
      const { error: setErr } = await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });
      if (cancelled) return;
      if (setErr) {
        setStatus('invalid');
        setError(setErr.message || 'Could not validate reset link.');
        return;
      }
      setStatus('ready');
    };

    if (incomingUrl) {
      activate(incomingUrl);
    } else {
      // Cold boot path — app was launched by tapping the link.
      Linking.getInitialURL().then((initial) => {
        if (initial) {
          activate(initial);
        } else {
          // No URL at all — user navigated here manually (dev scenario).
          setStatus('invalid');
          setError(
            'No reset link detected. Open the password reset email on this device and tap the link.'
          );
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [incomingUrl]);

  const handleSubmit = async () => {
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setStatus('submitting');
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    if (updateErr) {
      setError(updateErr.message || 'Could not update password.');
      setStatus('ready');
      return;
    }
    // Force the user to sign in with the new password so session state is
    // unambiguous. Also clears the recovery session from local storage.
    await supabase.auth.signOut();
    setStatus('done');
    router.replace('/login');
  };

  if (status === 'parsing') {
    return (
      <View style={[styles.center, { backgroundColor: t.background }]}>
        <ActivityIndicator size="large" color={t.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: t.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={styles.icon}>{'🔒'}</Text>
        <Text style={[styles.title, { color: t.textPrimary }]}>Set New Password</Text>
        <Text style={[styles.subtitle, { color: t.textSecondary }]}>
          Choose a new password for your PingWeather account.
        </Text>
      </View>

      <View style={styles.form}>
        {error && (
          <View style={[styles.errorBox, { backgroundColor: t.errorLight }]}>
            <Text style={[styles.errorText, { color: t.error }]}>{error}</Text>
          </View>
        )}

        {status === 'invalid' ? (
          <Pressable
            style={[styles.button, { backgroundColor: t.primary }]}
            onPress={() => router.replace('/forgot-password')}
          >
            <Text style={[styles.buttonText, { color: t.textOnPrimary }]}>
              Request a new link
            </Text>
          </Pressable>
        ) : (
          <>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: t.inputBackground, borderColor: t.border, color: t.textPrimary },
              ]}
              placeholder="New password (min 8 characters)"
              placeholderTextColor={t.textTertiary}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={status === 'ready'}
            />
            <TextInput
              style={[
                styles.input,
                { backgroundColor: t.inputBackground, borderColor: t.border, color: t.textPrimary },
              ]}
              placeholder="Confirm password"
              placeholderTextColor={t.textTertiary}
              secureTextEntry
              value={confirm}
              onChangeText={setConfirm}
              autoCapitalize="none"
              autoCorrect={false}
              editable={status === 'ready'}
            />
            <Pressable
              style={[
                styles.button,
                {
                  backgroundColor:
                    status === 'submitting' || !password || !confirm
                      ? t.primaryDisabled
                      : t.primary,
                },
              ]}
              onPress={handleSubmit}
              disabled={status !== 'ready' || !password || !confirm}
            >
              <Text style={[styles.buttonText, { color: t.textOnPrimary }]}>
                {status === 'submitting' ? 'Updating...' : 'Update Password'}
              </Text>
            </Pressable>
          </>
        )}

        <Pressable style={styles.link} onPress={() => router.replace('/login')}>
          <Text style={[styles.linkText, { color: t.primary }]}>Back to Sign In</Text>
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
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
