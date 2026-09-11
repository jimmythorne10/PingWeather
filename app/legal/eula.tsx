import { View, Text, ScrollView } from 'react-native';
import { useStyles } from '../../src/theme';
import { EULA_CONTENT } from '../../src/data/legal-content';

export default function EulaScreen() {
  const styles = useStyles((c, look) => ({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: look.spacing.lg, paddingBottom: look.spacing.xxxl },
    version: { fontSize: look.typography.label.size, marginBottom: 20, color: c.textTertiary },
    section: { marginBottom: 24 },
    sectionTitle: {
      fontSize: look.typography.heading.size,
      fontWeight: look.typography.heading.weight,
      marginBottom: 6,
      color: c.textPrimary,
    },
    // GAP: no lineHeight token exists anywhere in the contract — left as literal.
    sectionBody: { fontSize: look.typography.body.size, lineHeight: look.typography.body.lineHeight, color: c.textSecondary },
  }));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.version}>
        Version {EULA_CONTENT.version} — Effective {EULA_CONTENT.effectiveDate}
      </Text>

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
  );
}
