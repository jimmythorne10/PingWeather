/**
 * Tests for src/services/purchases.ts — product-to-tier mapping and
 * customer info → tier determination.
 *
 * These test pure logic that doesn't require the native RevenueCat SDK.
 * The SDK itself is mocked in jest.setup.ts.
 */

import { mapProductToTier, PRODUCT_TIER_MAP, TIER_PACKAGE_MAP } from '../../src/services/purchases';

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

  it('PRODUCT_TIER_MAP has exactly 4 entries', () => {
    expect(Object.keys(PRODUCT_TIER_MAP)).toHaveLength(4);
  });

  it('every PRODUCT_TIER_MAP value is either pro or premium', () => {
    for (const tier of Object.values(PRODUCT_TIER_MAP)) {
      expect(['pro', 'premium']).toContain(tier);
    }
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
