import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTokens } from '../../src/theme';

export default function NotificationSetupScreen() {
  const router = useRouter();
  const t = useTokens();

  const handleEnableNotifications = async () => {
    // TODO: Request push notification permissions via expo-notifications
    // Register push token with Supabase
    router.push('/onboarding/complete');
  };

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <View style={styles.content}>
        <Text style={styles.icon}>🔔</Text>
        <Text style={[styles.title, { color: t.textPrimary }]}>Enable Notifications</Text>
        <Text style={[styles.subtitle, { color: t.textSecondary }]}>
          WeatherWatch needs push notifications to alert you when weather
          conditions match your rules. This is the core of what the app does —
          without notifications, alerts can't reach you.
        </Text>

        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.borderLight }]}>
          <Text style={[styles.cardText, { color: t.textSecondary }]}>
            We'll only send notifications you've explicitly configured. No
            marketing, no spam, no surprises.
          </Text>
        </View>
      </View>

      <View style={styles.buttons}>
        <Pressable
          style={[styles.enableButton, { backgroundColor: t.primary }]}
          onPress={handleEnableNotifications}
        >
          <Text style={[styles.enableButtonText, { color: t.textOnPrimary }]}>
            Enable Notifications
          </Text>
        </Pressable>

        <Pressable
          style={styles.skipButton}
          onPress={() => router.push('/onboarding/complete')}
        >
          <Text style={[styles.skipText, { color: t.textTertiary }]}>
            I'll do this later in Settings
          </Text>
        </Pressable>
      </View>
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
  content: {
    alignItems: 'center',
  },
  icon: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    width: '100%',
  },
  cardText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  buttons: {
    gap: 12,
  },
  enableButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  enableButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 15,
  },
});
