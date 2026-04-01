import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTokens } from '../../src/theme';
import { PRIVACY_POLICY_CONTENT } from '../../src/data/legal-content';

export default function PrivacyPolicyScreen() {
  const t = useTokens();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: t.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.version, { color: t.textTertiary }]}>
        Version {PRIVACY_POLICY_CONTENT.version} — Effective{' '}
        {PRIVACY_POLICY_CONTENT.effectiveDate}
      </Text>

      {PRIVACY_POLICY_CONTENT.sections.map((section) => (
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  version: { fontSize: 12, marginBottom: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  sectionBody: { fontSize: 14, lineHeight: 22 },
});
