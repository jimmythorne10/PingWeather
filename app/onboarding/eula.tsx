import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useStyles } from '../../src/theme';
import { useAuthStore } from '../../src/stores/authStore';
import { EULA_CONTENT } from '../../src/data/legal-content';

export default function EulaScreen() {
  const router = useRouter();
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const styles = useStyles((c, look) => ({
    container: {
      flex: 1,
      padding: look.spacing.xl,
      paddingTop: look.spacing.xxxl + look.spacing.md,
      paddingBottom: look.spacing.xxxl,
      backgroundColor: c.background,
    },
    title: {
      fontSize: look.typography.title.size,
      fontWeight: look.typography.title.weight,
      marginBottom: 4,
      color: c.textPrimary,
    },
    version: {
      fontSize: look.typography.label.size,
      marginBottom: 16,
      color: c.textTertiary,
    },
    scroll: {
      flex: 1,
      borderRadius: look.radius.surface,
      borderWidth: 1,
      marginBottom: 20,
      backgroundColor: c.card,
      borderColor: c.borderLight,
    },
    scrollContent: {
      padding: look.spacing.lg,
    },
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: look.typography.heading.size,
      fontWeight: look.typography.heading.weight,
      marginBottom: 6,
      color: c.textPrimary,
    },
    sectionBody: {
      fontSize: look.typography.body.size,
      lineHeight: look.typography.body.lineHeight,
      color: c.textSecondary,
    },
    button: {
      paddingVertical: look.spacing.lg,
      borderRadius: look.radius.surface,
      alignItems: 'center',
      backgroundColor: c.primary,
    },
    buttonText: {
      fontSize: look.typography.heading.size,
      fontWeight: look.typography.heading.weight,
      color: c.textOnPrimary,
    },
    inner: {
      flex: 1,
      maxWidth: 600,
      alignSelf: 'center',
      width: '100%',
    },
  }));

  const handleAccept = async () => {
    const ok = await updateProfile({
      eula_accepted_version: EULA_CONTENT.version,
      eula_accepted_at: new Date().toISOString(),
    });
    if (!ok) {
      Alert.alert('Save Failed', useAuthStore.getState().error ?? 'Could not save. Please try again.');
      return;
    }
    router.push('/onboarding/location-setup');
  };

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
      <Text style={styles.title}>Terms of Use</Text>
      <Text style={styles.version}>
        Version {EULA_CONTENT.version} — {EULA_CONTENT.effectiveDate}
      </Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {EULA_CONTENT.sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>
              {section.title}
            </Text>
            <Text style={styles.sectionBody}>
              {section.body}
            </Text>
          </View>
        ))}
      </ScrollView>

      <Pressable
        style={styles.button}
        onPress={handleAccept}
      >
        <Text style={styles.buttonText}>I Accept</Text>
      </Pressable>
      </View>
    </View>
  );
}
