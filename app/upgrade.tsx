import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, Platform, Linking } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useStyles, useTokens } from '../src/theme';
import { useAuthStore } from '../src/stores/authStore';
import { TIER_LIMITS } from '../src/types';
import { purchasePackage as doPurchase, restorePurchases as doRestore, TIER_PACKAGE_MAP, getOfferings } from '../src/services/purchases';
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
    ],
  },
];


export default function UpgradeScreen() {
  const t = useTokens();
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const currentTier = profile?.subscription_tier ?? 'free';
  const [purchasing, setPurchasing] = useState<SubscriptionTier | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [tierPrices, setTierPrices] = useState<Partial<Record<string, string>>>({});

  const styles = useStyles((c, look) => ({
    container: { flex: 1, backgroundColor: c.background },
    content: {
      padding: look.spacing.xl,
      paddingBottom: look.spacing.xxxl,
      maxWidth: 560,
      alignSelf: 'center',
      width: '100%',
    },
    title: {
      fontSize: look.typography.title.size,
      fontWeight: look.typography.title.weight,
      marginBottom: 4,
      color: c.textPrimary,
    },
    subtitle: {
      fontSize: look.typography.body.size,
      // No token exists for lineHeight — LookTokens' TypeStep carries only
      // { size, weight, tracking }. Left as a literal and reported as a
      // contract gap (see migration report).
      lineHeight: look.typography.body.lineHeight,
      marginBottom: 24,
      color: c.textSecondary,
    },
    tierCard: {
      borderRadius: look.radius.surface,
      padding: look.spacing.xl,
      marginBottom: 16,
      borderWidth: 1,
      backgroundColor: c.card,
      borderColor: c.borderLight,
    },
    tierCardCurrent: {
      borderColor: c.primary,
      borderWidth: 2,
    },
    tierHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    tierLabel: {
      fontSize: look.typography.heading.size,
      fontWeight: look.typography.heading.weight,
      color: c.textPrimary,
    },
    tierTagline: {
      fontSize: look.typography.caption.size,
      marginTop: 2,
      color: c.textTertiary,
    },
    tierPrice: {
      fontSize: look.typography.heading.size,
      fontWeight: look.typography.heading.weight,
      color: c.primary,
    },
    highlightRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: look.spacing.xs,
    },
    checkmark: {
      fontSize: look.typography.bodyStrong.size,
      fontWeight: look.typography.bodyStrong.weight,
      marginRight: 8,
      marginTop: 1,
      color: c.success,
    },
    highlightText: {
      fontSize: look.typography.body.size,
      flex: 1,
      // Same lineHeight gap as `subtitle` above — no token exists for it.
      lineHeight: look.typography.body.lineHeight,
      color: c.textSecondary,
    },
    subscribeButton: {
      paddingVertical: look.spacing.lg,
      borderRadius: look.radius.surface,
      alignItems: 'center',
      marginTop: 16,
      backgroundColor: c.primary,
    },
    subscribeButtonPurchasing: {
      backgroundColor: c.primaryDisabled,
    },
    subscribeButtonText: {
      fontSize: look.typography.heading.size,
      fontWeight: look.typography.heading.weight,
      color: c.textOnPrimary,
    },
    currentBadge: {
      paddingVertical: look.spacing.md,
      borderRadius: look.radius.surface,
      alignItems: 'center',
      marginTop: 16,
      backgroundColor: c.primaryLight,
    },
    currentBadgeText: {
      fontSize: look.typography.bodyStrong.size,
      fontWeight: look.typography.bodyStrong.weight,
      color: c.primary,
    },
    limitsFootnote: {
      fontSize: look.typography.label.size,
      marginTop: 10,
      textAlign: 'center',
      color: c.textTertiary,
    },
    restoreLink: { alignItems: 'center', paddingVertical: look.spacing.md, marginTop: 8 },
    restoreLinkText: {
      fontSize: look.typography.bodyStrong.size,
      fontWeight: look.typography.bodyStrong.weight,
      color: c.primary,
    },
    cancelLink: { alignItems: 'center', paddingVertical: look.spacing.md },
    cancelLinkText: { fontSize: look.typography.body.size, color: c.textTertiary },
    legalText: {
      fontSize: look.typography.label.size,
      textAlign: 'center',
      marginTop: 20,
      // Same lineHeight gap as `subtitle` above — no token exists for it.
      lineHeight: look.typography.label.lineHeight,
      color: c.textTertiary,
    },
    legalLinks: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 12,
      marginBottom: 8,
    },
    legalLinkText: {
      fontSize: look.typography.label.size,
      fontWeight: look.typography.label.weight,
      color: c.primary,
    },
    legalLinkSeparator: { fontSize: look.typography.label.size, color: c.textTertiary },
  }));

  useEffect(() => {
    getOfferings().then((offering) => {
      if (!offering) return;
      const prices: Partial<Record<string, string>> = {};
      for (const pkg of offering.packages) {
        if (pkg.tier && pkg.tier !== 'free') prices[pkg.tier] = pkg.priceString;
      }
      setTierPrices(prices);
    });
  }, []);

  const getDisplayPrice = (tier: string) => {
    if (tier === 'free') return '$0';
    const staticCard = TIERS.find((c) => c.tier === tier);
    return tierPrices[tier] ?? staticCard?.price ?? '';
  };

  const handleSubscribe = async (tier: SubscriptionTier) => {
    if (tier === currentTier || purchasing) return;

    // For "free" downgrade — direct user to platform subscription management
    if (tier === 'free') {
      const message = Platform.select({
        ios: 'To downgrade, go to iPhone Settings → [Your Name] → Subscriptions, then cancel WeatherBeacon. Your current plan stays active until the end of the billing period.',
        default: 'To downgrade, cancel your subscription in Google Play Store → Subscriptions. Your current plan stays active until the end of the billing period.',
      });
      Alert.alert('Downgrade', message, [{ text: 'OK' }]);
      return;
    }

    setPurchasing(tier);
    const packageId = TIER_PACKAGE_MAP[tier as Exclude<SubscriptionTier, 'free'>];
    const result = await doPurchase(packageId);
    setPurchasing(null);

    if (result.error) {
      Alert.alert('Purchase Error', result.error, [{ text: 'OK' }]);
    } else if (result.success) {
      // Refresh profile to pick up the new tier
      await fetchProfile();
      Alert.alert(
        'Welcome to WeatherBeacon ' + (tier === 'pro' ? 'Pro' : 'Premium') + '!',
        'Your plan has been upgraded. Enjoy the additional features.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
    // If result.success is false and error is null → user cancelled, do nothing
  };

  const handleRestore = async () => {
    setRestoring(true);
    const result = await doRestore();
    setRestoring(false);

    if (result.error && !result.success) {
      Alert.alert('Restore Error', result.error, [{ text: 'OK' }]);
    } else if (result.tier && result.tier !== 'free') {
      await fetchProfile();
      Alert.alert(
        'Subscription Restored',
        `Your ${result.tier.charAt(0).toUpperCase() + result.tier.slice(1)} plan has been restored.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } else {
      Alert.alert(
        'No Subscription Found',
        'No active subscription was found for this account.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>Choose Your Plan</Text>
      <Text style={styles.subtitle}>
        Unlock more locations, more rules, faster polling, and compound conditions.
      </Text>

      {TIERS.map((card) => {
        const isCurrent = card.tier === currentTier;
        const limits = TIER_LIMITS[card.tier];
        return (
          <View
            key={card.tier}
            style={[styles.tierCard, isCurrent && styles.tierCardCurrent]}
          >
            <View style={styles.tierHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.tierLabel}>{card.label}</Text>
                <Text style={styles.tierTagline}>{card.tagline}</Text>
              </View>
              <Text style={styles.tierPrice}>{getDisplayPrice(card.tier)}</Text>
            </View>

            {card.highlights.map((line) => (
              <View key={line} style={styles.highlightRow}>
                <Text style={styles.checkmark}>✓</Text>
                <Text style={styles.highlightText}>{line}</Text>
              </View>
            ))}

            {isCurrent ? (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>Current Plan</Text>
              </View>
            ) : (
              <Pressable
                style={[
                  styles.subscribeButton,
                  purchasing === card.tier && styles.subscribeButtonPurchasing,
                ]}
                onPress={() => handleSubscribe(card.tier)}
                disabled={purchasing !== null}
              >
                {purchasing === card.tier ? (
                  <ActivityIndicator color={t.textOnPrimary} />
                ) : (
                  <Text style={styles.subscribeButtonText}>
                    {card.tier === 'free' ? 'Downgrade' : `Subscribe — ${getDisplayPrice(card.tier)}`}
                  </Text>
                )}
              </Pressable>
            )}

            <Text style={styles.limitsFootnote}>
              {limits.maxLocations} locations · {limits.maxAlertRules === 999 ? 'unlimited' : limits.maxAlertRules} rules · {limits.minPollingIntervalHours}h min polling
            </Text>
          </View>
        );
      })}

      <Pressable style={styles.restoreLink} onPress={handleRestore} disabled={restoring}>
        <Text style={styles.restoreLinkText}>
          {restoring ? 'Restoring...' : 'Restore Purchases'}
        </Text>
      </Pressable>

      <Pressable style={styles.cancelLink} onPress={() => router.back()}>
        <Text style={styles.cancelLinkText}>Not now</Text>
      </Pressable>

      <Text style={styles.legalText}>
        {Platform.select({
          ios: 'Payment will be charged to your Apple Account at confirmation of purchase. Subscriptions automatically renew unless auto-renewal is turned off at least 24 hours before the end of the current period. Manage subscriptions in your App Store account settings.',
          default: 'Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period. Manage or cancel in your Google Play account settings.',
        })}
      </Text>

      <View style={styles.legalLinks}>
        <Pressable onPress={() => Linking.openURL('https://www.truthcenteredtech.com/terms-weatherbeacon')}>
          <Text style={styles.legalLinkText}>Terms of Use</Text>
        </Pressable>
        <Text style={styles.legalLinkSeparator}> · </Text>
        <Pressable onPress={() => Linking.openURL('https://www.truthcenteredtech.com/weatherbeacon-privacy')}>
          <Text style={styles.legalLinkText}>Privacy Policy</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
