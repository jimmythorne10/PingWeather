import { View, Text, ScrollView, ActivityIndicator, RefreshControl, Pressable } from 'react-native';
import { useEffect, useState } from 'react';
import { useStyles, useTokens } from '../../src/theme';
import type { LookTokens } from '../../src/theme/looks';
import { useAlertHistoryStore } from '../../src/stores/alertHistoryStore';
import { useAuthStore } from '../../src/stores/authStore';
import { TIER_LIMITS } from '../../src/types';
import type { ThemeTokens } from '../../src/theme';

export default function HistoryScreen() {
  const styles = useStyles(createStyles);
  const tokens = useTokens();
  const { entries, loading, loadHistory, deleteEntry } = useAlertHistoryStore();
  const profile = useAuthStore((s) => s.profile);
  const tier = profile?.subscription_tier ?? 'free';
  const limits = TIER_LIMITS[tier];
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadHistory();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <Text style={styles.title}>Alert History</Text>
      <Text style={styles.subtitle}>
        {tier} tier: {limits.alertHistoryDays}-day history
      </Text>

      {loading && entries.length === 0 ? (
        <ActivityIndicator size="large" color={tokens.primary} style={{ marginTop: 40 }} />
      ) : entries.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>📜</Text>
          <Text style={styles.emptyTitle}>No alerts yet</Text>
          <Text style={styles.emptyBody}>
            When your alert rules trigger, a record of each notification will be
            logged here.
          </Text>
        </View>
      ) : (
        entries.map((entry) => (
          <View key={entry.id} style={styles.entryCard}>
            <View style={styles.entryHeader}>
              <Text style={styles.entryRule}>{entry.rule_name}</Text>
              <Text style={[styles.entryStatus, { color: entry.notification_sent ? tokens.success : tokens.warning }]}>
                {entry.notification_sent ? 'Sent' : 'Not sent'}
              </Text>
            </View>
            <Text style={styles.entryLocation}>{entry.location_name}</Text>
            <Text style={styles.entrySummary}>{entry.conditions_met}</Text>
            <View style={styles.entryFooter}>
              <Text style={styles.entryTime}>
                {entry.triggered_at ? new Date(entry.triggered_at).toLocaleString() : '—'}
              </Text>
              <Pressable
                onPress={() => deleteEntry(entry.id)}
                style={styles.deleteButton}
                hitSlop={8}
              >
                <Text style={styles.deleteButtonText}>✕</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const createStyles = (t: ThemeTokens, look: LookTokens) => ({
  container: { flex: 1 as const, backgroundColor: t.background },
  content: {
    padding: look.spacing.xl,
    paddingBottom: look.spacing.xxxl,
    maxWidth: 640,
    alignSelf: 'center' as const,
    width: '100%' as const,
  },
  title: {
    fontSize: look.typography.title.size,
    fontWeight: look.typography.title.weight,
    letterSpacing: look.typography.title.tracking,
    color: t.textPrimary,
    marginBottom: 4,
  },
  subtitle: { fontSize: look.typography.caption.size, color: t.textTertiary, marginBottom: 20 },

  emptyCard: {
    backgroundColor: t.card, borderRadius: look.radius.surface, padding: look.spacing.xxl,
    alignItems: 'center' as const, borderWidth: 1, borderColor: t.borderLight,
  },
  emptyIcon: { fontSize: look.typography.display.size, marginBottom: 12 },
  emptyTitle: {
    fontSize: look.typography.heading.size,
    fontWeight: look.typography.heading.weight,
    letterSpacing: look.typography.heading.tracking,
    color: t.textPrimary,
    marginBottom: 8,
  },
  emptyBody: { fontSize: look.typography.body.size, color: t.textSecondary, textAlign: 'center' as const, lineHeight: look.typography.body.lineHeight },

  entryCard: {
    backgroundColor: t.card, borderRadius: look.radius.surface, padding: look.spacing.lg, marginBottom: 10,
    borderWidth: 1, borderColor: t.borderLight,
  },
  entryHeader: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const,
    alignItems: 'center' as const, marginBottom: 4,
  },
  entryRule: {
    fontSize: look.typography.heading.size,
    fontWeight: look.typography.heading.weight,
    letterSpacing: look.typography.heading.tracking,
    color: t.textPrimary,
  },
  entryStatus: { fontSize: look.typography.label.size, fontWeight: look.typography.label.weight, letterSpacing: look.typography.label.tracking },
  entryLocation: { fontSize: look.typography.caption.size, color: t.textTertiary, marginBottom: 4 },
  entrySummary: { fontSize: look.typography.body.size, color: t.textSecondary, lineHeight: look.typography.body.lineHeight, marginBottom: 6 },
  entryFooter: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginTop: 4,
  },
  entryTime: { fontSize: look.typography.label.size, color: t.textTertiary },
  deleteButton: { paddingHorizontal: look.spacing.sm, paddingVertical: look.spacing.xs },
  deleteButtonText: {
    fontSize: look.typography.bodyStrong.size,
    color: t.error,
    fontWeight: look.typography.bodyStrong.weight,
    letterSpacing: look.typography.bodyStrong.tracking,
  },
});
