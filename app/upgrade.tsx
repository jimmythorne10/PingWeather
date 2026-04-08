import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTokens } from '../src/theme';
import { useAuthStore } from '../src/stores/authStore';
import { TIER_LIMITS } from '../src/types';
import type { SubscriptionTier } from '../src/types';

interface TierCard {
  tier: SubscriptionTier;
  label: string;
  price: string;
  tagline: string;
  highlights: string[];
}

const TIERS: TierCard[] = [
  {
    tier: 'free',
    label: 'Free',
    price: '$0',
    tagline: 'Try it out',
    highlights: [
      '1 location',
      '2 alert rules',
      '12-hour polling',
      '7-day alert history',
    ],
  },
  {
    tier: 'pro',
    label: 'Pro',
    price: '$3.99 / month',
    tagline: 'For active users',
    highlights: [
      '3 locations',
      '5 alert rules',
      '4-hour polling',
      '30-day alert history',
      'Compound conditions (AND/OR)',
    ],
  },
  {
    tier: 'premium',
    label: 'Premium',
    price: '$7.99 / month',
    tagline: 'Power users & pros',
    highlights: [
      '10 locations',
      'Unlimited alert rules',
      '1-hour polling',
      '90-day alert history',
      'Compound conditions (AND/OR)',
      'SMS alerts (coming soon)',
    ],
  },
];

export default function UpgradeScreen() {
  const t = useTokens();
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const currentTier = profile?.subscription_tier ?? 'free';

  const handleSubscribe = (tier: SubscriptionTier) => {
    if (tier === currentTier) return;
    // TODO: Wire to RevenueCat / Google Play Billing / Apple StoreKit.
    // For now, show a placeholder so users know the flow exists.
    Alert.alert(
      'Coming Soon',
      `Subscriptions will open in the next release. You tapped ${TIERS.find((x) => x.tier === tier)?.label}.`,
      [{ text: 'OK' }]
    );
  };

  const handleRestore = () => {
    Alert.alert(
      'Restore Purchases',
      'Checking for previous purchases… (will be wired to RevenueCat).',
      [{ text: 'OK' }]
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: t.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: t.textPrimary }]}>Choose Your Plan</Text>
      <Text style={[styles.subtitle, { color: t.textSecondary }]}>
        Unlock more locations, more rules, faster polling, and compound conditions.
      </Text>

      {TIERS.map((card) => {
        const isCurrent = card.tier === currentTier;
        const limits = TIER_LIMITS[card.tier];
        return (
          <View
            key={card.tier}
            style={[
              styles.tierCard,
              { backgroundColor: t.card, borderColor: isCurrent ? t.primary : t.borderLight },
              isCurrent && { borderWidth: 2 },
            ]}
          >
            <View style={styles.tierHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.tierLabel, { color: t.textPrimary }]}>{card.label}</Text>
                <Text style={[styles.tierTagline, { color: t.textTertiary }]}>{card.tagline}</Text>
              </View>
              <Text style={[styles.tierPrice, { color: t.primary }]}>{card.price}</Text>
            </View>

            {card.highlights.map((line) => (
              <View key={line} style={styles.highlightRow}>
                <Text style={[styles.checkmark, { color: t.success }]}>✓</Text>
                <Text style={[styles.highlightText, { color: t.textSecondary }]}>{line}</Text>
              </View>
            ))}

            {isCurrent ? (
              <View style={[styles.currentBadge, { backgroundColor: t.primaryLight }]}>
                <Text style={[styles.currentBadgeText, { color: t.primary }]}>Current Plan</Text>
              </View>
            ) : (
              <Pressable
                style={[styles.subscribeButton, { backgroundColor: t.primary }]}
                onPress={() => handleSubscribe(card.tier)}
              >
                <Text style={[styles.subscribeButtonText, { color: t.textOnPrimary }]}>
                  {card.tier === 'free' ? 'Downgrade' : `Subscribe — ${card.price}`}
                </Text>
              </Pressable>
            )}

            <Text style={[styles.limitsFootnote, { color: t.textTertiary }]}>
              {limits.maxLocations} locations · {limits.maxAlertRules === 999 ? 'unlimited' : limits.maxAlertRules} rules · {limits.minPollingIntervalHours}h min polling
            </Text>
          </View>
        );
      })}

      <Pressable style={styles.restoreLink} onPress={handleRestore}>
        <Text style={[styles.restoreLinkText, { color: t.primary }]}>Restore Purchases</Text>
      </Pressable>

      <Pressable style={styles.cancelLink} onPress={() => router.back()}>
        <Text style={[styles.cancelLinkText, { color: t.textTertiary }]}>Not now</Text>
      </Pressable>

      <Text style={[styles.legalText, { color: t.textTertiary }]}>
        Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period.
        Manage or cancel in your Apple ID or Google Play account settings.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 24 },
  tierCard: {
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tierLabel: { fontSize: 22, fontWeight: '700' },
  tierTagline: { fontSize: 13, marginTop: 2 },
  tierPrice: { fontSize: 16, fontWeight: '700' },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  checkmark: { fontSize: 14, fontWeight: '700', marginRight: 8, marginTop: 1 },
  highlightText: { fontSize: 14, flex: 1, lineHeight: 20 },
  subscribeButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  subscribeButtonText: { fontSize: 16, fontWeight: '700' },
  currentBadge: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  currentBadgeText: { fontSize: 14, fontWeight: '700' },
  limitsFootnote: { fontSize: 11, marginTop: 10, textAlign: 'center' },
  restoreLink: { alignItems: 'center', paddingVertical: 12, marginTop: 8 },
  restoreLinkText: { fontSize: 15, fontWeight: '600' },
  cancelLink: { alignItems: 'center', paddingVertical: 10 },
  cancelLinkText: { fontSize: 14 },
  legalText: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 16,
  },
});
