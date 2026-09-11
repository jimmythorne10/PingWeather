import { View, Text, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useStyles } from '../../src/theme';
import { useAuthStore } from '../../src/stores/authStore';

export default function CompleteScreen() {
  const router = useRouter();
  const updateProfile = useAuthStore((s) => s.updateProfile);
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
      marginBottom: 12,
      color: c.textOnPrimary,
    },
    subtitle: {
      fontSize: look.typography.heading.size,
      textAlign: 'center',
      lineHeight: look.typography.heading.lineHeight,
      marginBottom: 32,
      color: c.textOnPrimary,
      opacity: 0.9,
    },
    summaryCard: {
      width: '100%',
      borderRadius: look.radius.surface,
      padding: look.spacing.xl,
      backgroundColor: 'rgba(255,255,255,0.15)',
    },
    summaryTitle: {
      fontSize: look.typography.heading.size,
      fontWeight: look.typography.heading.weight,
      marginBottom: 12,
      color: c.textOnPrimary,
    },
    summaryItem: {
      fontSize: look.typography.body.size,
      lineHeight: look.typography.body.lineHeight,
      color: c.textOnPrimary,
      opacity: 0.9,
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

  const handleComplete = async () => {
    const ok = await updateProfile({ onboarding_completed: true });
    if (!ok) {
      Alert.alert('Save Failed', useAuthStore.getState().error ?? 'Could not save. Please try again.');
      return;
    }
    // Refetch profile to ensure auth guard sees the update, then navigate
    await useAuthStore.getState().fetchProfile();
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>{'✅'}</Text>
        <Text style={styles.title}>You're All Set!</Text>
        <Text style={styles.subtitle}>
          WeatherBeacon is ready to keep you informed. Set up your first alert
          rule and never miss critical weather again.
        </Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Next Steps</Text>
          {[
            'Add a location to monitor',
            'Choose an alert preset or build a custom rule',
            'Set your polling interval',
            'Sit back — we\'ll notify you',
          ].map((step, i) => (
            <Text key={i} style={styles.summaryItem}>
              {i + 1}. {step}
            </Text>
          ))}
        </View>
      </View>

      <Pressable
        style={styles.button}
        onPress={handleComplete}
      >
        <Text style={styles.buttonText}>Start Using WeatherBeacon</Text>
      </Pressable>
    </View>
  );
}
