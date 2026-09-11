import { View, Text, Pressable, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useStyles } from '../../src/theme';
import { Linking } from 'react-native';

const isIOS = Platform.OS === 'ios';

/** Step-number badge: a fixed circular hit target, independent of the look. */
const BADGE = 32;

export default function BatterySetupScreen() {
  const router = useRouter();
  const styles = useStyles((c, look) => ({
    container: {
      flex: 1,
      justifyContent: 'space-between',
      // GAP: 40 approximated to the nearest available token (xxxl=48, ~17% off)
      // rather than left as a literal — see report for the snap-vs-gap threshold used.
      paddingTop: look.spacing.xxxl,
      backgroundColor: c.background,
    },
    scrollContent: {
      paddingHorizontal: look.spacing.xl,
      paddingVertical: look.spacing.xl,
      maxWidth: 560,
      alignSelf: 'center',
      width: '100%',
    },
    content: {
      alignItems: 'center',
    },
    icon: {
      fontSize: look.typography.display.size,
      marginBottom: 16,
    },
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
      // GAP: no lineHeight token exists anywhere in the contract — left as literal.
      lineHeight: look.typography.body.lineHeight,
      marginBottom: 24,
      color: c.textSecondary,
    },
    card: {
      width: '100%',
      borderRadius: look.radius.surface,
      borderWidth: 1,
      padding: look.spacing.lg,
      marginBottom: 16,
      backgroundColor: c.card,
      borderColor: c.borderLight,
    },
    cardTitle: {
      fontSize: look.typography.heading.size,
      fontWeight: look.typography.heading.weight,
      marginBottom: 8,
      color: c.textPrimary,
    },
    cardText: {
      fontSize: look.typography.body.size,
      // GAP: no lineHeight token exists anywhere in the contract — left as literal.
      lineHeight: look.typography.body.lineHeight,
      color: c.textSecondary,
    },
    stepsCard: {
      width: '100%',
      borderRadius: look.radius.surface,
      borderWidth: 1,
      padding: look.spacing.lg,
      marginBottom: 16,
      backgroundColor: c.card,
      borderColor: c.borderLight,
    },
    step: {
      flexDirection: 'row',
      marginVertical: 12,
      gap: look.spacing.md,
    },
    // The step badge is a fixed 32pt hit target, not a scale step. Its radius
    // is half its own size and its leading equals its own height (that is what
    // centres the digit vertically) — both are relationships to BADGE, not to
    // the type or spacing scales.
    //
    // Deliberately NOT look.spacing.xxl: that is 32 under aurora but 24 under
    // classic, which would leave a 32pt box with a 12pt radius — an oval.
    stepNumber: {
      fontSize: look.typography.heading.size,
      fontWeight: look.typography.heading.weight,
      width: BADGE,
      height: BADGE,
      borderRadius: BADGE / 2,
      textAlign: 'center',
      lineHeight: BADGE,
      color: c.primary,
    },
    stepContent: {
      flex: 1,
    },
    stepTitle: {
      fontSize: look.typography.bodyStrong.size,
      fontWeight: look.typography.bodyStrong.weight,
      marginBottom: 4,
      color: c.textPrimary,
    },
    stepText: {
      fontSize: look.typography.body.size,
      // GAP: no lineHeight token exists anywhere in the contract — left as literal.
      lineHeight: look.typography.body.lineHeight,
      color: c.textSecondary,
    },
    warningCard: {
      width: '100%',
      borderRadius: look.radius.surface,
      padding: look.spacing.lg,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: look.spacing.md,
      backgroundColor: c.primaryLight,
    },
    warningIcon: {
      fontSize: look.typography.heading.size,
      marginTop: 2,
      color: c.primary,
    },
    warningText: {
      flex: 1,
      fontSize: look.typography.body.size,
      // GAP: no lineHeight token exists anywhere in the contract — left as literal.
      lineHeight: look.typography.body.lineHeight,
      color: c.textPrimary,
    },
    buttons: {
      gap: look.spacing.md,
      paddingHorizontal: look.spacing.xl,
      paddingBottom: look.spacing.xxxl,
      maxWidth: 560,
      alignSelf: 'center',
      width: '100%',
    },
    openButton: {
      paddingVertical: look.spacing.lg,
      borderRadius: look.radius.surface,
      alignItems: 'center',
      backgroundColor: c.primary,
    },
    openButtonText: {
      fontSize: look.typography.heading.size,
      fontWeight: look.typography.heading.weight,
      color: c.textOnPrimary,
    },
    skipButton: {
      alignItems: 'center',
      paddingVertical: look.spacing.md,
    },
    skipText: {
      fontSize: look.typography.body.size,
      color: c.textTertiary,
    },
  }));

  const handleOpenSettings = () => {
    if (isIOS) {
      // Deep-links directly to WeatherBeacon's page in iOS Settings
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  const title = isIOS ? 'Enable Background App Refresh' : 'Battery Optimization Notice';

  const subtitle = isIOS
    ? 'iOS may pause WeatherBeacon when not in use. Enable Background App Refresh so alert notifications reach you reliably — even on quiet weather days.'
    : 'Android may silence weather alerts if WeatherBeacon isn\'t allowed to run in the background. Whitelist the app now to ensure you never miss critical alerts.';

  const whyBody = isIOS
    ? 'Your weather rules are evaluated on our servers, but iOS can delay push notifications to apps that don\'t have Background App Refresh enabled. This setting is the most common cause of missed alerts on iPhone.'
    : 'Your weather rules are evaluated on our servers every hour, but Android may prevent push notifications from reaching you if the app doesn\'t have unrestricted battery permission. This is the most common cause of missed alerts.';

  const stepsTitle = isIOS
    ? 'How to Enable (3 steps)'
    : 'How to Unrestrict Battery (3 steps)';

  const steps = isIOS
    ? [
        {
          title: 'Open WeatherBeacon Settings',
          text: 'Tap the "Open Settings" button below — it opens WeatherBeacon\'s page directly.',
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
          title: 'Find WeatherBeacon',
          text: 'Navigate to Apps → WeatherBeacon (or search for "WeatherBeacon" in Settings).',
        },
        {
          title: 'Set to Unrestricted',
          text: 'Tap Battery → Unrestricted (not Restricted or Optimized). Save changes.',
        },
      ];

  const buttonLabel = isIOS ? 'Open Settings' : 'Open Battery Settings';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.icon}>🔋</Text>
          <Text style={styles.title}>
            {title}
          </Text>
          <Text style={styles.subtitle}>
            {subtitle}
          </Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Why This Matters
            </Text>
            <Text style={styles.cardText}>
              {whyBody}
            </Text>
          </View>

          <View style={styles.stepsCard}>
            <Text style={styles.cardTitle}>
              {stepsTitle}
            </Text>

            {steps.map((step, i) => (
              <View key={i} style={styles.step}>
                <Text style={styles.stepNumber}>{i + 1}</Text>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>
                    {step.title}
                  </Text>
                  <Text style={styles.stepText}>
                    {step.text}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.warningCard}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <Text style={styles.warningText}>
              If you skip this step, you may not receive push notifications when weather
              conditions match your rules.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.buttons}>
        <Pressable
          style={styles.openButton}
          onPress={handleOpenSettings}
        >
          <Text style={styles.openButtonText}>
            {buttonLabel}
          </Text>
        </Pressable>

        <Pressable
          style={styles.skipButton}
          onPress={() => router.push('/onboarding/complete')}
        >
          <Text style={styles.skipText}>
            Skip for now (not recommended)
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
