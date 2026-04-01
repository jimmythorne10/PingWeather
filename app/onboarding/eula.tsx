import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTokens } from '../../src/theme';
import { useAuthStore } from '../../src/stores/authStore';
import { EULA_CONTENT } from '../../src/data/legal-content';

export default function EulaScreen() {
  const router = useRouter();
  const t = useTokens();
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const handleAccept = async () => {
    await updateProfile({
      eula_accepted_version: EULA_CONTENT.version,
      eula_accepted_at: new Date().toISOString(),
    });
    router.push('/onboarding/location-setup');
  };

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <Text style={[styles.title, { color: t.textPrimary }]}>Terms of Use</Text>
      <Text style={[styles.version, { color: t.textTertiary }]}>
        Version {EULA_CONTENT.version} — {EULA_CONTENT.effectiveDate}
      </Text>

      <ScrollView
        style={[styles.scroll, { backgroundColor: t.card, borderColor: t.borderLight }]}
        contentContainerStyle={styles.scrollContent}
      >
        {EULA_CONTENT.sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>
              {section.title}
            </Text>
            <Text style={[styles.sectionBody, { color: t.textSecondary }]}>
              {section.body}
            </Text>
          </View>
        ))}
      </ScrollView>

      <Pressable
        style={[styles.button, { backgroundColor: t.primary }]}
        onPress={handleAccept}
      >
        <Text style={[styles.buttonText, { color: t.textOnPrimary }]}>I Accept</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 60,
    paddingBottom: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  version: {
    fontSize: 12,
    marginBottom: 16,
  },
  scroll: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  sectionBody: {
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
