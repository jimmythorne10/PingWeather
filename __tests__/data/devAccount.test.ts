/**
 * Tests for the developer account gate (FR-SET-008).
 * Only the developer email may override their subscription tier
 * without going through a real store purchase.
 */

import { isDevAccount } from '../../src/utils/devAccount';

describe('isDevAccount', () => {
  it('returns true for the exact developer email', () => {
    expect(isDevAccount('jimmy@truthcenteredtech.com')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isDevAccount('Jimmy@TruthCenteredTech.com')).toBe(true);
    expect(isDevAccount('JIMMY@TRUTHCENTEREDTECH.COM')).toBe(true);
  });

  it('trims whitespace', () => {
    expect(isDevAccount('  jimmy@truthcenteredtech.com  ')).toBe(true);
  });

  it('returns false for any other email', () => {
    expect(isDevAccount('alice@example.com')).toBe(false);
    expect(isDevAccount('jimmy@example.com')).toBe(false);
    expect(isDevAccount('jimmy+other@truthcenteredtech.com')).toBe(false);
    expect(isDevAccount('not-jimmy@truthcenteredtech.com')).toBe(false);
  });

  it('returns false for null, undefined, or empty string', () => {
    expect(isDevAccount(null)).toBe(false);
    expect(isDevAccount(undefined)).toBe(false);
    expect(isDevAccount('')).toBe(false);
    expect(isDevAccount('   ')).toBe(false);
  });
});
