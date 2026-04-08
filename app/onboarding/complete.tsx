import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTokens } from '../../src/theme';
import { useAuthStore } from '../../src/stores/authStore';

export default function CompleteScreen() {
  const router = useRouter();
  const t = useTokens();
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const handleComplete = async () => {
    await updateProfile({ onboarding_completed: true });
    // Refetch profile to ensure auth guard sees the update, then navigate
    await useAuthStore.getState().fetchProfile();
    router.replace('/');
  };

  return (
    <View style={[styles.container, { backgroundColor: t.primary }]}>
      <View style={styles.content}>
        <Text style={styles.icon}>{'✅'}</Text>
        <Text style={[styles.title, { color: t.textOnPrimary }]}>You're All Set!</Text>
        <Text style={[styles.subtitle, { color: t.textOnPrimary, opacity: 0.9 }]}>
          WeatherWatch is ready to keep you informed. Set up your first alert
          rule and never miss critical weather again.
        </Text>

        <View style={[styles.summaryCard, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
          <Text style={[styles.summaryTitle, { color: t.textOnPrimary }]}>Next Steps</Text>
          {[
            'Add a location to monitor',
            'Choose an alert preset or build a custom rule',
            'Set your polling interval',
            'Sit back — we\'ll notify you',
          ].map((step, i) => (
            <Text key={i} style={[styles.summaryItem, { color: t.textOnPrimary, opacity: 0.9 }]}>
              {i + 1}. {step}
            </Text>
          ))}
        </View>
      </View>

      <Pressable
        style={[styles.button, { backgroundColor: t.textOnPrimary }]}
        onPress={handleComplete}
      >
        <Text style={[styles.buttonText, { color: t.primary }]}>Start Using WeatherWatch</Text>
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
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  summaryCard: {
    width: '100%',
    borderRadius: 12,
    padding: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  summaryItem: {
    fontSize: 15,
    lineHeight: 28,
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
