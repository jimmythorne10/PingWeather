/**
 * Unit tests for subscription webhook logic (pure functions).
 */

import {
  mapProductToTier,
  determineAction,
} from '../../src/services/subscriptionLogic';

// ── mapProductToTier ──────────────────────────────────────

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
    expect(mapProductToTier('enterprise_yearly')).toBeNull();
  });
});

// ── determineAction ───────────────────────────────────────

describe('determineAction', () => {
  it('INITIAL_PURCHASE with pro_monthly → upgrade to pro', () => {
    expect(determineAction('INITIAL_PURCHASE', 'pro_monthly')).toEqual({
      action: 'upgrade',
      newTier: 'pro',
    });
  });

  it('INITIAL_PURCHASE with premium_annual → upgrade to premium', () => {
    expect(determineAction('INITIAL_PURCHASE', 'premium_annual')).toEqual({
      action: 'upgrade',
      newTier: 'premium',
    });
  });

  it('INITIAL_PURCHASE with unknown product → upgrade with null tier', () => {
    expect(determineAction('INITIAL_PURCHASE', 'unknown_product')).toEqual({
      action: 'upgrade',
      newTier: null,
    });
  });

  it('RENEWAL with pro_annual → renew to pro', () => {
    expect(determineAction('RENEWAL', 'pro_annual')).toEqual({
      action: 'renew',
      newTier: 'pro',
    });
  });

  it('RENEWAL with premium_monthly → renew to premium', () => {
    expect(determineAction('RENEWAL', 'premium_monthly')).toEqual({
      action: 'renew',
      newTier: 'premium',
    });
  });

  it('CANCELLATION → cancel_pending, no tier change', () => {
    expect(determineAction('CANCELLATION', 'pro_monthly')).toEqual({
      action: 'cancel_pending',
      newTier: null,
    });
  });

  it('EXPIRATION → downgrade to free', () => {
    expect(determineAction('EXPIRATION', 'pro_monthly')).toEqual({
      action: 'downgrade',
      newTier: 'free',
    });
  });

  it('BILLING_ISSUE_DETECTED → billing_issue, no tier change', () => {
    expect(determineAction('BILLING_ISSUE_DETECTED', 'premium_annual')).toEqual({
      action: 'billing_issue',
      newTier: null,
    });
  });

  it('unknown event type → ignore, no tier change', () => {
    expect(determineAction('SUBSCRIBER_ALIAS', 'pro_monthly')).toEqual({
      action: 'ignore',
      newTier: null,
    });
  });
});
