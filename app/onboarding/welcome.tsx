import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useStyles } from '../../src/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const styles = useStyles((c, look) => ({
    container: {
      flex: 1,
      justifyContent: 'space-between',
      padding: look.spacing.xxl,
      paddingTop: look.spacing.xxxl + look.spacing.xxl,
      paddingBottom: look.spacing.xxxl,
      backgroundColor: c.primary,
    },
    content: {
      alignItems: 'center',
      maxWidth: 480,
      alignSelf: 'center',
      width: '100%',
    },
    icon: {
      fontSize: look.typography.display.size,
      marginBottom: 16,
    },
    title: {
      fontSize: look.typography.title.size,
      fontWeight: look.typography.title.weight,
      marginBottom: 8,
      color: c.textOnPrimary,
    },
    subtitle: {
      fontSize: look.typography.heading.size,
      marginBottom: 40,
      color: c.textOnPrimary,
      opacity: 0.9,
    },
    features: {
      alignSelf: 'stretch',
      gap: look.spacing.lg,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: look.spacing.md,
    },
    featureIcon: {
      fontSize: look.typography.title.size,
    },
    featureText: {
      fontSize: look.typography.heading.size,
      flex: 1,
      color: c.textOnPrimary,
    },
    button: {
      paddingVertical: look.spacing.lg,
      borderRadius: look.radius.surface,
      alignItems: 'center',
      maxWidth: 480,
      alignSelf: 'center',
      width: '100%',
      backgroundColor: c.textOnPrimary,
    },
    buttonText: {
      fontSize: look.typography.heading.size,
      fontWeight: look.typography.heading.weight,
      color: c.primary,
    },
  }));

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>{'⛅'}</Text>
        <Text style={styles.title}>WeatherBeacon</Text>
        <Text style={styles.subtitle}>
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
              <Text style={styles.featureText}>{text}</Text>
            </View>
          ))}
        </View>
      </View>

      <Pressable
        style={styles.button}
        onPress={() => router.push('/onboarding/privacy')}
      >
        <Text style={styles.buttonText}>Get Started</Text>
      </Pressable>
    </View>
  );
}
