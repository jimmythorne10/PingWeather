/**
 * Tests for src/services/purchases.ts — product-to-tier mapping and
 * customer info → tier determination.
 *
 * These test pure logic that doesn't require the native RevenueCat SDK.
 * The SDK itself is mocked in jest.setup.ts.
 */

import { mapProductToTier, PRODUCT_TIER_MAP, TIER_PACKAGE_MAP, determineTierFromCustomerInfo } from '../../src/services/purchases';

describe('mapProductToTier', () => {
  it('maps pro_monthly to pro', () => {
    expect(mapProductToTier('pro_monthly')).toBe('pro');
  });

  it('maps pro_annual to pro', () => {
    expect(mapProductToTier('pro_annual')).toBe('pro');
  });

  it('maps premium_monthly to premium', () => {
    expect(mapProductToTier('premium_monthly')).toBe('premium');
  });

  it('maps premium_annual to premium', () => {
    expect(mapProductToTier('premium_annual')).toBe('premium');
  });

  it('returns null for unknown product', () => {
    expect(mapProductToTier('nonexistent_product')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(mapProductToTier('')).toBeNull();
  });

  // FIX 14: RevenueCat restore returns colon-format product IDs on some SDK
  // versions. Without these entries the user appears free after restore.
  it('maps pro_monthly:monthly to pro', () => {
    expect(mapProductToTier('pro_monthly:monthly')).toBe('pro');
  });

  it('maps premium_monthly:monthly to premium', () => {
    expect(mapProductToTier('premium_monthly:monthly')).toBe('premium');
  });

  it('PRODUCT_TIER_MAP has exactly 10 entries (Android short-form + iOS fully-qualified)', () => {
    // 6 Android entries + 4 iOS entries (com.truthcenteredtech.pingweather.{pro,premium}_monthly with colon-format variants)
    expect(Object.keys(PRODUCT_TIER_MAP)).toHaveLength(10);
  });

  it('every PRODUCT_TIER_MAP value is either pro or premium', () => {
    for (const tier of Object.values(PRODUCT_TIER_MAP)) {
      expect(['pro', 'premium']).toContain(tier);
    }
  });
});

// ── Regression guard: syncTierToSupabase removal ─────────────
// Migration 00013 WITH CHECK prevents any user-JWT UPDATE that changes
// subscription_tier. The old syncTierToSupabase call silently failed every
// time. Removing it prevents false "belt-and-suspenders" confidence.
// If this test fails, someone re-introduced the broken client-side sync.
describe('syncTierToSupabase — removed', () => {
  it('purchases.ts does not contain syncTierToSupabase', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../src/services/purchases.ts'),
      'utf8'
    );
    expect(source).not.toContain('syncTierToSupabase');
  });

  it('purchases.ts does not write subscription_tier to Supabase', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../src/services/purchases.ts'),
      'utf8'
    );
    // The only permissible mention of subscription_tier in this file would be
    // a read (never a write). The column name in an update payload is the tell.
    expect(source).not.toContain('subscription_tier:');
  });
});

// ── BUG-012: determineTierFromCustomerInfo null-tier hole ─────
// determineTierFromCustomerInfo previously returned null when activeSubscriptions
// was non-empty but no product ID mapped to a known tier. This caused:
//   - purchasePackage to return { success: true, tier: null }
//   - restorePurchases to report 'No active subscription found' despite finding one
// Fix: default to 'free' (server webhook is the tier authority).
describe('determineTierFromCustomerInfo — BUG-012', () => {
  it('returns "free" when activeSubscriptions is empty', () => {
    expect(determineTierFromCustomerInfo({ activeSubscriptions: [] })).toBe('free');
  });

  it('returns "pro" for a known pro product ID', () => {
    expect(determineTierFromCustomerInfo({ activeSubscriptions: ['pro_monthly'] })).toBe('pro');
  });

  it('returns "premium" for a known premium product ID', () => {
    expect(determineTierFromCustomerInfo({ activeSubscriptions: ['premium_monthly'] })).toBe('premium');
  });

  it('returns "premium" when both premium and pro are active (most-premium wins)', () => {
    expect(
      determineTierFromCustomerInfo({ activeSubscriptions: ['pro_monthly', 'premium_monthly'] })
    ).toBe('premium');
  });

  // BUG-012 regression: was returning null — must now return 'free'
  it('returns "free" (not null) when activeSubscriptions has an unknown product ID', () => {
    expect(
      determineTierFromCustomerInfo({ activeSubscriptions: ['some_unknown_product_id'] })
    ).toBe('free');
  });

  it('returns "free" (not null) when multiple unknown product IDs are present', () => {
    expect(
      determineTierFromCustomerInfo({
        activeSubscriptions: ['unknown_a', 'unknown_b'],
      })
    ).toBe('free');
  });
});

describe('TIER_PACKAGE_MAP', () => {
  it('pro and premium map to different package identifiers', () => {
    expect(TIER_PACKAGE_MAP['pro']).not.toBe(TIER_PACKAGE_MAP['premium']);
  });

  it('pro package identifier is non-empty', () => {
    expect(TIER_PACKAGE_MAP['pro']).toBeTruthy();
  });

  it('premium package identifier is non-empty', () => {
    expect(TIER_PACKAGE_MAP['premium']).toBeTruthy();
  });
});
