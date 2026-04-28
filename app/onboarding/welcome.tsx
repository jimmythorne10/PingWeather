import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTokens } from '../../src/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const t = useTokens();

  return (
    <View style={[styles.container, { backgroundColor: t.primary }]}>
      <View style={styles.content}>
        <Text style={[styles.icon]}>{'⛅'}</Text>
        <Text style={[styles.title, { color: t.textOnPrimary }]}>PingWeather</Text>
        <Text style={[styles.subtitle, { color: t.textOnPrimary, opacity: 0.9 }]}>
          Weather alerts on your terms.
        </Text>

        <View style={styles.features}>
          {[
            ['🧊', 'Freeze and temperature alerts'],
            ['🌧️', 'Rain and storm notifications'],
            ['🌬️', 'Wind, cold fronts, and UV tracking'],
            ['🔔', 'Custom conditions, your schedule'],
          ].map(([icon, text]) => (
            <View key={text} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{icon}</Text>
              <Text style={[styles.featureText, { color: t.textOnPrimary }]}>{text}</Text>
            </View>
          ))}
        </View>
      </View>

      <Pressable
        style={[styles.button, { backgroundColor: t.textOnPrimary }]}
        onPress={() => router.push('/onboarding/privacy')}
      >
        <Text style={[styles.buttonText, { color: t.primary }]}>Get Started</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 32,
    paddingTop: 80,
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
    fontSize: 36,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 40,
  },
  features: {
    alignSelf: 'stretch',
    gap: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  featureIcon: {
    fontSize: 28,
  },
  featureText: {
    fontSize: 16,
    flex: 1,
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
