import { View, Text, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTokens } from '../../src/theme';
import { Linking } from 'react-native';

const isIOS = Platform.OS === 'ios';

export default function BatterySetupScreen() {
  const router = useRouter();
  const t = useTokens();

  const handleOpenSettings = () => {
    if (isIOS) {
      // Deep-links directly to PingWeather's page in iOS Settings
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  const title = isIOS ? 'Enable Background App Refresh' : 'Battery Optimization Notice';

  const subtitle = isIOS
    ? 'iOS may pause PingWeather when not in use. Enable Background App Refresh so alert notifications reach you reliably — even on quiet weather days.'
    : 'Android may silence weather alerts if PingWeather isn\'t allowed to run in the background. Whitelist the app now to ensure you never miss critical alerts.';

  const whyBody = isIOS
    ? 'Your weather rules are evaluated on our servers, but iOS can delay push notifications to apps that don\'t have Background App Refresh enabled. This setting is the most common cause of missed alerts on iPhone.'
    : 'Your weather rules are evaluated on our servers every hour, but Android may prevent push notifications from reaching you if the app doesn\'t have unrestricted battery permission. This is the most common cause of missed alerts.';

  const stepsTitle = isIOS
    ? 'How to Enable (3 steps)'
    : 'How to Unrestrict Battery (3 steps)';

  const steps = isIOS
    ? [
        {
          title: 'Open PingWeather Settings',
          text: 'Tap the "Open Settings" button below — it opens PingWeather\'s page directly.',
        },
        {
          title: 'Tap Background App Refresh',
          text: 'You\'ll see the option listed under the app\'s permissions.',
        },
        {
          title: 'Turn it ON',
          text: 'Set Background App Refresh to On (green). That\'s it — you\'re done.',
        },
      ]
    : [
        {
          title: 'Open Settings',
          text: 'Tap the "Open Battery Settings" button below.',
        },
        {
          title: 'Find PingWeather',
          text: 'Navigate to Apps → PingWeather (or search for "PingWeather" in Settings).',
        },
        {
          title: 'Set to Unrestricted',
          text: 'Tap Battery → Unrestricted (not Restricted or Optimized). Save changes.',
        },
      ];

  const buttonLabel = isIOS ? 'Open Settings' : 'Open Battery Settings';

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.icon}>🔋</Text>
          <Text style={[styles.title, { color: t.textPrimary }]}>
            {title}
          </Text>
          <Text style={[styles.subtitle, { color: t.textSecondary }]}>
            {subtitle}
          </Text>

          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.borderLight }]}>
            <Text style={[styles.cardTitle, { color: t.textPrimary }]}>
              Why This Matters
            </Text>
            <Text style={[styles.cardText, { color: t.textSecondary }]}>
              {whyBody}
            </Text>
          </View>

          <View style={[styles.stepsCard, { backgroundColor: t.card, borderColor: t.borderLight }]}>
            <Text style={[styles.cardTitle, { color: t.textPrimary }]}>
              {stepsTitle}
            </Text>

            {steps.map((step, i) => (
              <View key={i} style={styles.step}>
                <Text style={[styles.stepNumber, { color: t.primary }]}>{i + 1}</Text>
                <View style={styles.stepContent}>
                  <Text style={[styles.stepTitle, { color: t.textPrimary }]}>
                    {step.title}
                  </Text>
                  <Text style={[styles.stepText, { color: t.textSecondary }]}>
                    {step.text}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <View style={[styles.warningCard, { backgroundColor: t.primary, opacity: 0.1 }]}>
            <Text style={[styles.warningIcon, { color: t.primary }]}>⚠️</Text>
            <Text style={[styles.warningText, { color: t.textPrimary }]}>
              If you skip this step, you may not receive push notifications when weather
              conditions match your rules.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.buttons}>
        <Pressable
          style={[styles.openButton, { backgroundColor: t.primary }]}
          onPress={handleOpenSettings}
        >
          <Text style={[styles.openButtonText, { color: t.textOnPrimary }]}>
            {buttonLabel}
          </Text>
        </Pressable>

        <Pressable
          style={styles.skipButton}
          onPress={() => router.push('/onboarding/complete')}
        >
          <Text style={[styles.skipText, { color: t.textTertiary }]}>
            Skip for now (not recommended)
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
    paddingTop: 40,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  content: {
    alignItems: 'center',
  },
  icon: {
    fontSize: 56,
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
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    lineHeight: 20,
  },
  stepsCard: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  step: {
    flexDirection: 'row',
    marginVertical: 12,
    gap: 12,
  },
  stepNumber: {
    fontSize: 18,
    fontWeight: '700',
    width: 32,
    height: 32,
    borderRadius: 16,
    textAlign: 'center',
    lineHeight: 32,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  stepText: {
    fontSize: 14,
    lineHeight: 18,
  },
  warningCard: {
    width: '100%',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  warningIcon: {
    fontSize: 20,
    marginTop: 2,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  buttons: {
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  openButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  openButtonText: {
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
