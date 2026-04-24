/**
 * RevenueCat purchase service for PingWeather.
 *
 * Wraps `react-native-purchases` with app-specific logic:
 *   - Maps RevenueCat package identifiers to PingWeather subscription tiers
 *   - Handles initialization with the API key from env
 *   - Provides typed purchase/restore/status functions
 *   - Syncs tier changes back to Supabase profile
 *
 * The RevenueCat API key is stored as EXPO_PUBLIC_REVENUECAT_API_KEY in
 * .env.local. It's a public key (safe to ship in the app binary) — the
 * secret webhook key is stored server-side only.
 *
 * Until the API key is configured, all functions no-op and return safe
 * defaults so the app doesn't crash during dev or if RevenueCat is
 * unavailable.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../utils/supabase';
import type { SubscriptionTier } from '../types';

// Lazy-load to avoid crashing in Jest / environments without native modules.
let Purchases: typeof import('react-native-purchases').default | null = null;
let initialized = false;

function getPurchases() {
  if (!Purchases) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      Purchases = require('react-native-purchases').default;
    } catch {
      Purchases = null;
    }
  }
  return Purchases;
}

// ── Product → Tier mapping ──────────────────────────────────

// Maps Play Console product IDs → subscription tier (used server-side and for receipt validation).
// FIX 14: RevenueCat's restorePurchases() returns product IDs with a
// "<product>:<offering>" format (e.g., "pro_monthly:monthly") on some SDK
// versions and platforms. The subscription-webhook server already handles
// both formats. Without the colon variants here, mapProductToTier() returns
// null on restore and the user appears as free despite an active subscription.
export const PRODUCT_TIER_MAP: Record<string, SubscriptionTier> = {
  pro_monthly: 'pro',
  'pro_monthly:monthly': 'pro',
  pro_annual: 'pro',
  premium_monthly: 'premium',
  'premium_monthly:monthly': 'premium',
  premium_annual: 'premium',
};

export function mapProductToTier(productId: string): SubscriptionTier | null {
  return PRODUCT_TIER_MAP[productId] ?? null;
}

// Maps subscription tier → RevenueCat package identifier for the default monthly offering.
// These must match the package identifiers created in the RevenueCat dashboard.
export const TIER_PACKAGE_MAP: Record<Exclude<SubscriptionTier, 'free'>, string> = {
  pro: '$rc_pro_monthly',
  premium: '$rc_premium_monthly',
};

// ── Initialization ──────────────────────────────────────────

const API_KEY = Platform.select({
  ios:
    Constants.expoConfig?.extra?.revenueCatIosApiKey ??
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ??
    '',
  default:
    Constants.expoConfig?.extra?.revenueCatAndroidApiKey ??
    process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ??
    '',
});

export async function initializePurchases(appUserId?: string): Promise<boolean> {
  const P = getPurchases();
  if (!P || initialized || !API_KEY) {
    if (!API_KEY) {
      console.warn('[purchases] No RevenueCat API key configured — purchases disabled');
    }
    return false;
  }

  try {
    P.configure({
      apiKey: API_KEY,
      appUserID: appUserId ?? null,
    });
    initialized = true;
    return true;
  } catch (err) {
    console.error('[purchases] Failed to initialize:', err);
    return false;
  }
}

// ── Login / Logout ──────────────────────────────────────────
// RevenueCat tracks users by an app_user_id. We use the Supabase UUID
// so the webhook can look up the profile directly.

export async function loginPurchaseUser(supabaseUserId: string): Promise<void> {
  const P = getPurchases();
  if (!P || !initialized) return;
  try {
    await P.logIn(supabaseUserId);
  } catch (err) {
    console.error('[purchases] logIn error:', err);
  }
}

export async function logoutPurchaseUser(): Promise<void> {
  const P = getPurchases();
  if (!P || !initialized) return;
  try {
    const info = await P.getCustomerInfo();
    if (!info.originalAppUserId?.startsWith('$RCAnonymousID')) {
      await P.logOut();
    }
  } catch (err) {
    console.error('[purchases] logOut error:', err);
  }
}

// ── Offerings ───────────────────────────────────────────────

export interface PurchaseOffering {
  identifier: string;
  packages: PurchasePackage[];
}

export interface PurchasePackage {
  identifier: string;
  productId: string;
  priceString: string;
  tier: SubscriptionTier | null;
}

export async function getOfferings(): Promise<PurchaseOffering | null> {
  const P = getPurchases();
  if (!P || !initialized) return null;

  try {
    const offerings = await P.getOfferings();
    const current = offerings.current;
    if (!current) return null;

    return {
      identifier: current.identifier,
      packages: current.availablePackages.map((pkg) => ({
        identifier: pkg.identifier,
        productId: pkg.product.identifier,
        priceString: pkg.product.priceString,
        tier: mapProductToTier(pkg.product.identifier),
      })),
    };
  } catch (err) {
    console.error('[purchases] getOfferings error:', err);
    return null;
  }
}

// ── Purchase ────────────────────────────────────────────────

export interface PurchaseResult {
  success: boolean;
  tier: SubscriptionTier | null;
  error: string | null;
}

export async function purchasePackage(packageIdentifier: string): Promise<PurchaseResult> {
  const P = getPurchases();
  if (!P || !initialized) {
    return { success: false, tier: null, error: 'Purchases not initialized' };
  }

  try {
    const offerings = await P.getOfferings();
    const current = offerings.current;
    if (!current) {
      return { success: false, tier: null, error: 'No offerings available' };
    }

    const pkg = current.availablePackages.find((p) => p.identifier === packageIdentifier);
    if (!pkg) {
      return { success: false, tier: null, error: `Package "${packageIdentifier}" not found` };
    }

    const { customerInfo } = await P.purchasePackage(pkg);

    // Determine the new tier from active entitlements
    const newTier = determineTierFromCustomerInfo(customerInfo);

    // Sync to Supabase immediately (don't wait for webhook — belt + suspenders)
    if (newTier) {
      await syncTierToSupabase(newTier);
    }

    return { success: true, tier: newTier, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Purchase failed';
    // RevenueCat throws a specific error when user cancels — don't treat as error
    if (typeof err === 'object' && err !== null && 'userCancelled' in err && (err as { userCancelled: boolean }).userCancelled) {
      return { success: false, tier: null, error: null }; // user cancelled, not an error
    }
    return { success: false, tier: null, error: message };
  }
}

// ── Restore ─────────────────────────────────────────────────

export async function restorePurchases(): Promise<PurchaseResult> {
  const P = getPurchases();
  if (!P || !initialized) {
    return { success: false, tier: null, error: 'Purchases not initialized' };
  }

  try {
    const customerInfo = await P.restorePurchases();
    const newTier = determineTierFromCustomerInfo(customerInfo);

    if (newTier) {
      await syncTierToSupabase(newTier);
    }

    return {
      success: true,
      tier: newTier,
      error: newTier ? null : 'No active subscription found',
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Restore failed';
    return { success: false, tier: null, error: message };
  }
}

// ── Customer Info → Tier ────────────────────────────────────

function determineTierFromCustomerInfo(customerInfo: { activeSubscriptions: string[] }): SubscriptionTier | null {
  // Check active subscriptions from most-premium to least
  for (const productId of customerInfo.activeSubscriptions) {
    const tier = mapProductToTier(productId);
    if (tier === 'premium') return 'premium';
  }
  for (const productId of customerInfo.activeSubscriptions) {
    const tier = mapProductToTier(productId);
    if (tier === 'pro') return 'pro';
  }
  // No active subscription
  if (customerInfo.activeSubscriptions.length === 0) {
    return 'free';
  }
  return null;
}

// ── Sync to Supabase ────────────────────────────────────────
// Belt-and-suspenders: update the profile immediately on purchase/restore
// rather than waiting for the webhook. The webhook is the canonical path,
// but client-side sync makes the UI update instantly.

async function syncTierToSupabase(tier: SubscriptionTier): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('profiles')
      .update({ subscription_tier: tier })
      .eq('id', user.id);
  } catch (err) {
    console.error('[purchases] syncTierToSupabase error:', err);
  }
}

// ── Get Current Subscription Status ─────────────────────────

export async function getCurrentTier(): Promise<SubscriptionTier | null> {
  const P = getPurchases();
  if (!P || !initialized) return null;

  try {
    const info = await P.getCustomerInfo();
    return determineTierFromCustomerInfo(info);
  } catch {
    return null;
  }
}
