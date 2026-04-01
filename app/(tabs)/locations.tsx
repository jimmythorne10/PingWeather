import { View, Text, ScrollView, Pressable } from 'react-native';
import { useStyles } from '../../src/theme';
import type { ThemeTokens } from '../../src/theme';

export default function LocationsScreen() {
  const styles = useStyles(createStyles);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Monitored Locations</Text>
      <Text style={styles.subtitle}>
        Add locations to monitor weather conditions. Free tier: 1 location.
      </Text>

      {/* Empty state */}
      <View style={styles.emptyCard}>
        <Text style={styles.emptyIcon}>📍</Text>
        <Text style={styles.emptyTitle}>No locations yet</Text>
        <Text style={styles.emptyBody}>
          Add your first location to start receiving weather alerts.
        </Text>
        <Pressable style={styles.addButton}>
          <Text style={styles.addButtonText}>+ Add Location</Text>
        </Pressable>
      </View>
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
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: t.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: t.textSecondary,
    marginBottom: 20,
  },
  emptyCard: {
    backgroundColor: t.card,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: t.borderLight,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: t.textPrimary,
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    color: t.textSecondary,
    textAlign: 'center' as const,
    marginBottom: 20,
    lineHeight: 20,
  },
  addButton: {
    backgroundColor: t.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  addButtonText: {
    color: t.textOnPrimary,
    fontSize: 16,
    fontWeight: '600' as const,
  },
});
