import { View, Text, ScrollView } from 'react-native';
import { useStyles } from '../../src/theme';
import type { ThemeTokens } from '../../src/theme';

export default function HistoryScreen() {
  const styles = useStyles(createStyles);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Alert History</Text>
      <Text style={styles.subtitle}>
        Past notifications will appear here. Free tier: 7-day history.
      </Text>

      <View style={styles.emptyCard}>
        <Text style={styles.emptyIcon}>📜</Text>
        <Text style={styles.emptyTitle}>No alerts yet</Text>
        <Text style={styles.emptyBody}>
          When your alert rules trigger, a record of each notification will be
          logged here.
        </Text>
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
    lineHeight: 20,
  },
});
