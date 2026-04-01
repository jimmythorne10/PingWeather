import { View, Text, ScrollView, Pressable } from 'react-native';
import { useStyles } from '../../src/theme';
import { ALERT_PRESETS } from '../../src/data/alert-presets';
import type { ThemeTokens } from '../../src/theme';

export default function AlertsScreen() {
  const styles = useStyles(createStyles);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Quick Start Presets</Text>
      <Text style={styles.sectionSubtitle}>
        Tap a preset to create an alert rule instantly.
      </Text>

      {['livestock', 'hunting', 'outdoor_work', 'general'].map((category) => (
        <View key={category}>
          <Text style={styles.categoryTitle}>
            {category === 'livestock' ? 'Livestock & Agriculture' :
             category === 'hunting' ? 'Hunting' :
             category === 'outdoor_work' ? 'Outdoor Work' : 'General'}
          </Text>
          {ALERT_PRESETS.filter((p) => p.category === category).map((preset) => (
            <Pressable key={preset.id} style={styles.presetCard}>
              <Text style={styles.presetIcon}>{preset.icon}</Text>
              <View style={styles.presetInfo}>
                <Text style={styles.presetName}>{preset.name}</Text>
                <Text style={styles.presetDesc}>{preset.description}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ))}

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Custom Alert</Text>
      <Pressable style={styles.customButton}>
        <Text style={styles.customButtonText}>+ Build Custom Alert Rule</Text>
      </Pressable>
    </ScrollView>
  );
}

const createStyles = (t: ThemeTokens) => ({
  container: {
    flex: 1 as const,
    backgroundColor: t.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: t.textPrimary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: t.textSecondary,
    marginBottom: 16,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: t.textSecondary,
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  presetCard: {
    backgroundColor: t.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: t.borderLight,
  },
  presetIcon: {
    fontSize: 28,
    marginRight: 14,
  },
  presetInfo: {
    flex: 1 as const,
  },
  presetName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: t.textPrimary,
    marginBottom: 2,
  },
  presetDesc: {
    fontSize: 13,
    color: t.textSecondary,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: t.divider,
    marginVertical: 24,
  },
  customButton: {
    backgroundColor: t.primaryLight,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: t.primary,
    borderStyle: 'dashed' as const,
  },
  customButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: t.primary,
  },
});
