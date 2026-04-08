import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useEffect, useState } from 'react';
import { useStyles, useTokens } from '../../src/theme';
import { useAlertHistoryStore } from '../../src/stores/alertHistoryStore';
import { useAuthStore } from '../../src/stores/authStore';
import { TIER_LIMITS } from '../../src/types';
import type { ThemeTokens } from '../../src/theme';

export default function HistoryScreen() {
  const styles = useStyles(createStyles);
  const tokens = useTokens();
  const { entries, loading, loadHistory } = useAlertHistoryStore();
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
            <Text style={styles.entryTime}>
              {new Date(entry.triggered_at).toLocaleString()}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const createStyles = (t: ThemeTokens) => ({
  container: { flex: 1 as const, backgroundColor: t.background },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700' as const, color: t.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: 13, color: t.textTertiary, marginBottom: 20 },

  emptyCard: {
    backgroundColor: t.card, borderRadius: 12, padding: 32,
    alignItems: 'center' as const, borderWidth: 1, borderColor: t.borderLight,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: t.textPrimary, marginBottom: 8 },
  emptyBody: { fontSize: 14, color: t.textSecondary, textAlign: 'center' as const, lineHeight: 20 },

  entryCard: {
    backgroundColor: t.card, borderRadius: 12, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: t.borderLight,
  },
  entryHeader: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const,
    alignItems: 'center' as const, marginBottom: 4,
  },
  entryRule: { fontSize: 16, fontWeight: '600' as const, color: t.textPrimary },
  entryStatus: { fontSize: 12, fontWeight: '600' as const },
  entryLocation: { fontSize: 13, color: t.textTertiary, marginBottom: 4 },
  entrySummary: { fontSize: 14, color: t.textSecondary, lineHeight: 20, marginBottom: 6 },
  entryTime: { fontSize: 12, color: t.textTertiary },
});
