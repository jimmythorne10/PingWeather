import { View, Text, Pressable, ActivityIndicator, Platform } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useStyles, useTokens } from '../../src/theme';
import { usePushNotifications } from '../../src/hooks/usePushNotifications';

export default function NotificationSetupScreen() {
  const router = useRouter();
  const t = useTokens();
  const { registerForPushNotifications, error } = usePushNotifications();
  const [registering, setRegistering] = useState(false);
  const [done, setDone] = useState(false);
  const styles = useStyles((c, look) => ({
    container: {
      flex: 1,
      justifyContent: 'space-between',
      padding: look.spacing.xl,
      paddingTop: look.spacing.xxxl + look.spacing.md,
      paddingBottom: look.spacing.xxxl,
      backgroundColor: c.background,
    },
    content: { alignItems: 'center', maxWidth: 480, alignSelf: 'center', width: '100%' },
    icon: { fontSize: look.typography.display.size, marginBottom: 16 },
    title: {
      fontSize: look.typography.title.size,
      fontWeight: look.typography.title.weight,
      marginBottom: 8,
      textAlign: 'center',
      color: c.textPrimary,
    },
    subtitle: {
      fontSize: look.typography.body.size,
      textAlign: 'center',
      lineHeight: look.typography.body.lineHeight,
      marginBottom: 24,
      color: c.textSecondary,
    },
    card: {
      borderRadius: look.radius.surface,
      padding: look.spacing.lg,
      borderWidth: 1,
      width: '100%',
      backgroundColor: c.card,
      borderColor: c.borderLight,
    },
    cardText: {
      fontSize: look.typography.body.size,
      lineHeight: look.typography.body.lineHeight,
      textAlign: 'center',
      color: c.textSecondary,
    },
    errorText: { fontSize: look.typography.caption.size, marginTop: 12, color: c.error },
    buttons: { gap: look.spacing.md, maxWidth: 480, alignSelf: 'center', width: '100%' },
    enableButton: {
      paddingVertical: look.spacing.lg,
      borderRadius: look.radius.surface,
      alignItems: 'center',
      backgroundColor: c.primary,
    },
    enableButtonText: {
      fontSize: look.typography.heading.size,
      fontWeight: look.typography.heading.weight,
      color: c.textOnPrimary,
    },
    skipButton: { alignItems: 'center', paddingVertical: look.spacing.md },
    skipText: { fontSize: look.typography.body.size, color: c.textTertiary },
  }));

  const handleEnable = async () => {
    setRegistering(true);
    const { token } = await registerForPushNotifications();
    setRegistering(false);
    if (token) {
      setDone(true);
      // Brief delay to show success state, then navigate to battery setup (Android) or complete (iOS)
      setTimeout(() => {
        const nextScreen = Platform.OS === 'android'
          ? '/onboarding/battery-setup'
          : '/onboarding/complete';
        router.push(nextScreen);
      }, 800);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>{done ? '✅' : '🔔'}</Text>
        <Text style={styles.title}>
          {done ? 'Notifications Enabled!' : 'Stay Informed'}
        </Text>
        <Text style={styles.subtitle}>
          {done
            ? "You're all set to receive weather alerts."
            : 'WeatherBeacon needs push notifications to alert you when weather conditions match your rules. This is the core of what the app does.'}
        </Text>

        {!done && (
          <View style={styles.card}>
            <Text style={styles.cardText}>
              We'll only send notifications you've explicitly configured. No
              marketing, no spam, no surprises.
            </Text>
          </View>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      {!done && (
        <View style={styles.buttons}>
          <Pressable
            style={styles.enableButton}
            onPress={handleEnable}
            disabled={registering}
          >
            {registering ? (
              <ActivityIndicator color={t.textOnPrimary} />
            ) : (
              <Text style={styles.enableButtonText}>
                Continue
              </Text>
            )}
          </Pressable>

          <Pressable
            style={styles.skipButton}
            onPress={() => {
              const nextScreen = Platform.OS === 'android'
                ? '/onboarding/battery-setup'
                : '/onboarding/complete';
              router.push(nextScreen);
            }}
          >
            <Text style={styles.skipText}>
              I'll do this later in Settings
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
