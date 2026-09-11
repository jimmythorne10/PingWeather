import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../src/utils/supabase';
import { useStyles, useTokens } from '../src/theme';

type Status = 'parsing' | 'ready' | 'invalid' | 'submitting' | 'done';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const t = useTokens();

  // Supabase PKCE flow delivers the recovery token as ?code=... in the query
  // string, not as a #access_token=... hash fragment. Expo Router parses query
  // params automatically and hands them to us via useLocalSearchParams, which
  // works across cold boot, warm navigation, and hot reload.
  const params = useLocalSearchParams<{ code?: string; error?: string; error_description?: string }>();

  const [status, setStatus] = useState<Status>('parsing');
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const styles = useStyles((c, look) => ({
    container: {
      flex: 1,
      justifyContent: 'center',
      padding: look.spacing.xl,
      backgroundColor: c.background,
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: c.background,
    },
    header: {
      alignItems: 'center',
      marginBottom: 32,
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
      // No token exists for lineHeight — LookTokens' TypeStep carries only
      // { size, weight, tracking }. Left as a literal and reported as a
      // contract gap (see migration report).
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
      backgroundColor:
        status === 'submitting' || !password || !confirm ? c.primaryDisabled : c.primary,
    },
    buttonInvalid: {
      paddingVertical: look.spacing.lg,
      borderRadius: look.radius.surface,
      alignItems: 'center',
      marginTop: 8,
      backgroundColor: c.primary,
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

  useEffect(() => {
    let cancelled = false;

    const activate = async () => {
      // Supabase returns ?error=...&error_description=... when the token is
      // invalid, expired, or already used. Surface the real message.
      if (params.error) {
        setStatus('invalid');
        setError(params.error_description || params.error || 'Reset link is invalid or expired.');
        return;
      }
      if (!params.code) {
        setStatus('invalid');
        setError(
          'No reset code detected. Open the password reset email on this device and tap the link.'
        );
        return;
      }
      const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(
        String(params.code)
      );
      if (cancelled) return;
      if (exchangeErr) {
        setStatus('invalid');
        setError(exchangeErr.message || 'Could not validate reset link.');
        return;
      }
      setStatus('ready');
    };

    activate();

    return () => {
      cancelled = true;
    };
  }, [params.code, params.error, params.error_description]);

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
      <View style={styles.center}>
        <ActivityIndicator size="large" color={t.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
      <View style={styles.header}>
        <Text style={styles.icon}>{'🔒'}</Text>
        <Text style={styles.title}>Set New Password</Text>
        <Text style={styles.subtitle}>
          Choose a new password for your WeatherBeacon account.
        </Text>
      </View>

      <View style={styles.form}>
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {status === 'invalid' ? (
          <Pressable
            style={styles.buttonInvalid}
            onPress={() => router.replace('/forgot-password')}
          >
            <Text style={styles.buttonText}>
              Request a new link
            </Text>
          </Pressable>
        ) : (
          <>
            <TextInput
              style={styles.input}
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
              style={styles.input}
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
              style={styles.button}
              onPress={handleSubmit}
              disabled={status !== 'ready' || !password || !confirm}
            >
              <Text style={styles.buttonText}>
                {status === 'submitting' ? 'Updating...' : 'Update Password'}
              </Text>
            </Pressable>
          </>
        )}

        <Pressable style={styles.link} onPress={() => router.replace('/login')}>
          <Text style={styles.linkText}>Back to Sign In</Text>
        </Pressable>
      </View>
      </View>
    </KeyboardAvoidingView>
  );
}
