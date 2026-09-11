import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useStyles } from '../../src/theme';

export default function PrivacyScreen() {
  const router = useRouter();
  const styles = useStyles((c, look) => ({
    container: {
      flex: 1,
      justifyContent: 'space-between',
      padding: look.spacing.xl,
      paddingTop: look.spacing.xxxl + look.spacing.md,
      paddingBottom: look.spacing.xxxl,
      backgroundColor: c.background,
    },
    content: {
      maxWidth: 480,
      alignSelf: 'center',
      width: '100%',
    },
    title: {
      fontSize: look.typography.title.size,
      fontWeight: look.typography.title.weight,
      marginBottom: 24,
      textAlign: 'center',
      color: c.textPrimary,
    },
    card: {
      borderRadius: look.radius.surface,
      padding: look.spacing.xl,
      borderWidth: 1,
      gap: look.spacing.xl,
      backgroundColor: c.card,
      borderColor: c.borderLight,
    },
    item: {
      flexDirection: 'row',
      // Tie between md(12)/lg(16) for literal 14 — no exact guide entry;
      // md chosen for consistency with the same tie elsewhere in this migration.
      gap: look.spacing.md,
    },
    itemIcon: {
      fontSize: look.typography.title.size,
      marginTop: 2,
    },
    itemText: {
      flex: 1,
    },
    itemHeading: {
      fontSize: look.typography.heading.size,
      fontWeight: look.typography.heading.weight,
      marginBottom: 4,
      color: c.textPrimary,
    },
    itemBody: {
      fontSize: look.typography.body.size,
      lineHeight: look.typography.body.lineHeight,
      color: c.textSecondary,
    },
    button: {
      paddingVertical: look.spacing.lg,
      borderRadius: look.radius.surface,
      alignItems: 'center',
      maxWidth: 480,
      alignSelf: 'center',
      width: '100%',
      backgroundColor: c.primary,
    },
    buttonText: {
      fontSize: look.typography.heading.size,
      fontWeight: look.typography.heading.weight,
      color: c.textOnPrimary,
    },
  }));

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Your Privacy Matters</Text>

        <View style={styles.card}>
          {[
            ['📍', 'Location Privacy', 'We only store the coordinates you choose to monitor. No continuous tracking.'],
            ['🔒', 'Minimal Data', 'We collect only what is needed to deliver your alerts. No ads, no data selling.'],
            ['🗑️', 'You Control Deletion', 'Remove locations, rules, or your entire account at any time.'],
            ['📊', 'Transparent Policies', 'Read our full privacy policy anytime from Settings.'],
          ].map(([icon, heading, body]) => (
            <View key={heading} style={styles.item}>
              <Text style={styles.itemIcon}>{icon}</Text>
              <View style={styles.itemText}>
                <Text style={styles.itemHeading}>{heading}</Text>
                <Text style={styles.itemBody}>{body}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <Pressable
        style={styles.button}
        onPress={() => router.push('/onboarding/eula')}
      >
        <Text style={styles.buttonText}>Continue</Text>
      </Pressable>
    </View>
  );
}
