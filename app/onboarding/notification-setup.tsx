import { View, Text, Pressable, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTokens } from '../../src/theme';
import { usePushNotifications } from '../../src/hooks/usePushNotifications';

export default function NotificationSetupScreen() {
  const router = useRouter();
  const t = useTokens();
  const { registerForPushNotifications, error } = usePushNotifications();
  const [registering, setRegistering] = useState(false);
  const [done, setDone] = useState(false);

  const handleEnable = async () => {
    setRegistering(true);
    const token = await registerForPushNotifications();
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
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <View style={styles.content}>
        <Text style={styles.icon}>{done ? '✅' : '🔔'}</Text>
        <Text style={[styles.title, { color: t.textPrimary }]}>
          {done ? 'Notifications Enabled!' : 'Stay Informed'}
        </Text>
        <Text style={[styles.subtitle, { color: t.textSecondary }]}>
          {done
            ? "You're all set to receive weather alerts."
            : 'PingWeather needs push notifications to alert you when weather conditions match your rules. This is the core of what the app does.'}
        </Text>

        {!done && (
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.borderLight }]}>
            <Text style={[styles.cardText, { color: t.textSecondary }]}>
              We'll only send notifications you've explicitly configured. No
              marketing, no spam, no surprises.
            </Text>
          </View>
        )}

        {error && <Text style={[styles.errorText, { color: t.error }]}>{error}</Text>}
      </View>

      {!done && (
        <View style={styles.buttons}>
          <Pressable
            style={[styles.enableButton, { backgroundColor: t.primary }]}
            onPress={handleEnable}
            disabled={registering}
          >
            {registering ? (
              <ActivityIndicator color={t.textOnPrimary} />
            ) : (
              <Text style={[styles.enableButtonText, { color: t.textOnPrimary }]}>
                Enable Notifications
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
            <Text style={[styles.skipText, { color: t.textTertiary }]}>
              I'll do this later in Settings
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
    paddingTop: 60,
    paddingBottom: 48,
  },
  content: { alignItems: 'center' },
  icon: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  card: { borderRadius: 12, padding: 16, borderWidth: 1, width: '100%' },
  cardText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  errorText: { fontSize: 13, marginTop: 12 },
  buttons: { gap: 12 },
  enableButton: { paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  enableButtonText: { fontSize: 18, fontWeight: '700' },
  skipButton: { alignItems: 'center', paddingVertical: 12 },
  skipText: { fontSize: 15 },
});
