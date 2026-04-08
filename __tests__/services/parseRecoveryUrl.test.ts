/**
 * Tests for parseRecoveryUrl — pure function that extracts Supabase recovery
 * tokens from a URL delivered via deep link.
 *
 * Supabase recovery URLs deliver the access_token, refresh_token, and type
 * in the URL HASH FRAGMENT (not query string):
 *   pingweather://reset-password#access_token=xxx&refresh_token=yyy&type=recovery&expires_in=3600
 *
 * Some Supabase PKCE flows use a query string instead:
 *   pingweather://reset-password?access_token=xxx&refresh_token=yyy&type=recovery
 *
 * The parser must handle both, prefer the hash form, and tolerate weird
 * inputs without throwing.
 *
 * These tests deliberately exercise the code path the app uses in production
 * — no mocks of React Native, no jsdom. Pure string parsing.
 */

import { parseRecoveryUrl } from '../../src/services/parseRecoveryUrl';

describe('parseRecoveryUrl', () => {
  it('extracts tokens from a hash-fragment URL', () => {
    const url =
      'pingweather://reset-password#access_token=abc.def.ghi&refresh_token=rrr&type=recovery&expires_in=3600';
    const out = parseRecoveryUrl(url);
    expect(out).toEqual({
      accessToken: 'abc.def.ghi',
      refreshToken: 'rrr',
      type: 'recovery',
    });
  });

  it('extracts tokens from a query-string URL (PKCE-style)', () => {
    const url =
      'pingweather://reset-password?access_token=abc&refresh_token=rrr&type=recovery';
    const out = parseRecoveryUrl(url);
    expect(out).toEqual({
      accessToken: 'abc',
      refreshToken: 'rrr',
      type: 'recovery',
    });
  });

  it('prefers hash over query when both are present', () => {
    // Hash is canonical per Supabase implicit flow; if both happen to be
    // present we must not pick the query accidentally.
    const url =
      'pingweather://reset-password?access_token=QUERY&refresh_token=QR&type=recovery#access_token=HASH&refresh_token=HR&type=recovery';
    const out = parseRecoveryUrl(url);
    expect(out?.accessToken).toBe('HASH');
    expect(out?.refreshToken).toBe('HR');
  });

  it('handles the exp:// dev-client URL format with /-- prefix', () => {
    // In Expo Go / dev client, deep links look like:
    //   exp://192.168.1.2:8081/--/reset-password#access_token=...
    const url =
      'exp://192.168.1.2:8081/--/reset-password#access_token=abc&refresh_token=rrr&type=recovery';
    const out = parseRecoveryUrl(url);
    expect(out).toEqual({
      accessToken: 'abc',
      refreshToken: 'rrr',
      type: 'recovery',
    });
  });

  it('returns null when the URL has no tokens at all', () => {
    expect(parseRecoveryUrl('pingweather://reset-password')).toBeNull();
  });

  it('returns null when type is not "recovery"', () => {
    // Guards against treating magic-link or signup-confirm URLs as recoveries.
    const url =
      'pingweather://reset-password#access_token=abc&refresh_token=rrr&type=magiclink';
    expect(parseRecoveryUrl(url)).toBeNull();
  });

  it('returns null when access_token is missing', () => {
    const url = 'pingweather://reset-password#refresh_token=rrr&type=recovery';
    expect(parseRecoveryUrl(url)).toBeNull();
  });

  it('returns null when refresh_token is missing', () => {
    const url = 'pingweather://reset-password#access_token=abc&type=recovery';
    expect(parseRecoveryUrl(url)).toBeNull();
  });

  it('returns null on null/empty/undefined input', () => {
    expect(parseRecoveryUrl(null)).toBeNull();
    expect(parseRecoveryUrl(undefined)).toBeNull();
    expect(parseRecoveryUrl('')).toBeNull();
  });

  it('URL-decodes token values that contain percent-encoded characters', () => {
    // JWTs include . which is safe, but Supabase sometimes base64url-encodes
    // refresh tokens with = padding that gets %3D encoded in transit.
    const url =
      'pingweather://reset-password#access_token=abc.def.ghi&refresh_token=rr%3D%3D&type=recovery';
    const out = parseRecoveryUrl(url);
    expect(out?.refreshToken).toBe('rr==');
  });

  it('does not throw on malformed hash (no key=value pairs)', () => {
    const url = 'pingweather://reset-password#totallybroken';
    expect(() => parseRecoveryUrl(url)).not.toThrow();
    expect(parseRecoveryUrl(url)).toBeNull();
  });
});
