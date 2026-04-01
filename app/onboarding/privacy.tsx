import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTokens } from '../../src/theme';

export default function PrivacyScreen() {
  const router = useRouter();
  const t = useTokens();

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: t.textPrimary }]}>Your Privacy Matters</Text>

        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.borderLight }]}>
          {[
            ['📍', 'Location Privacy', 'We only store the coordinates you choose to monitor. No continuous tracking.'],
            ['🔒', 'Minimal Data', 'We collect only what is needed to deliver your alerts. No ads, no data selling.'],
            ['🗑️', 'You Control Deletion', 'Remove locations, rules, or your entire account at any time.'],
            ['📊', 'Transparent Policies', 'Read our full privacy policy anytime from Settings.'],
          ].map(([icon, heading, body]) => (
            <View key={heading} style={styles.item}>
              <Text style={styles.itemIcon}>{icon}</Text>
              <View style={styles.itemText}>
                <Text style={[styles.itemHeading, { color: t.textPrimary }]}>{heading}</Text>
                <Text style={[styles.itemBody, { color: t.textSecondary }]}>{body}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <Pressable
        style={[styles.button, { backgroundColor: t.primary }]}
        onPress={() => router.push('/onboarding/eula')}
      >
        <Text style={[styles.buttonText, { color: t.textOnPrimary }]}>Continue</Text>
      </Pressable>
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
  content: {},
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
  },
  card: {
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    gap: 20,
  },
  item: {
    flexDirection: 'row',
    gap: 14,
  },
  itemIcon: {
    fontSize: 28,
    marginTop: 2,
  },
  itemText: {
    flex: 1,
  },
  itemHeading: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
  },
});
