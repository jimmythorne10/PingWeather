import { shouldSendDigest } from '../../src/services/digestScheduler';
import type { DigestProfile } from '../../src/services/digestScheduler';

const base: DigestProfile = {
  digest_enabled: true,
  digest_frequency: 'daily',
  digest_hour: 7,
  digest_day_of_week: 1,
  digest_last_sent_at: null,
};

// 2026-04-22 07:05 UTC = 07:05 UTC (America/New_York is UTC-4 in April, so 03:05 local)
// 2026-04-22 11:05 UTC = 07:05 America/New_York
const utcWhenEastern7am = new Date('2026-04-22T11:05:00Z'); // Wednesday
const utcWhenEastern6am = new Date('2026-04-22T10:05:00Z');
const utcWhenEastern8am = new Date('2026-04-22T12:05:00Z');

// Monday in Eastern time: 2026-04-20T11:05:00Z
const utcMondayEastern7am = new Date('2026-04-20T11:05:00Z');

describe('shouldSendDigest', () => {
  it('returns false when digest_enabled is false', () => {
    expect(shouldSendDigest({ ...base, digest_enabled: false }, 'America/New_York', utcWhenEastern7am)).toBe(false);
  });

  it('returns true for daily digest at the correct local hour', () => {
    expect(shouldSendDigest(base, 'America/New_York', utcWhenEastern7am)).toBe(true);
  });

  it('returns false for daily digest one hour early', () => {
    expect(shouldSendDigest(base, 'America/New_York', utcWhenEastern6am)).toBe(false);
  });

  it('returns false for daily digest one hour late', () => {
    expect(shouldSendDigest(base, 'America/New_York', utcWhenEastern8am)).toBe(false);
  });

  it('returns false when digest was already sent within the last 23 hours', () => {
    const recentlySent = { ...base, digest_last_sent_at: new Date('2026-04-22T11:00:00Z').toISOString() };
    expect(shouldSendDigest(recentlySent, 'America/New_York', utcWhenEastern7am)).toBe(false);
  });

  it('returns true when digest was sent more than 23 hours ago', () => {
    const yesterday = { ...base, digest_last_sent_at: new Date('2026-04-21T10:00:00Z').toISOString() };
    expect(shouldSendDigest(yesterday, 'America/New_York', utcWhenEastern7am)).toBe(true);
  });

  it('returns false for weekly digest on the wrong day of week', () => {
    // Wednesday, but weekly digest is set to Monday (1)
    const weekly = { ...base, digest_frequency: 'weekly' as const, digest_day_of_week: 1 };
    expect(shouldSendDigest(weekly, 'America/New_York', utcWhenEastern7am)).toBe(false);
  });

  it('returns true for weekly digest on the correct day and hour', () => {
    const weekly = { ...base, digest_frequency: 'weekly' as const, digest_day_of_week: 1 };
    expect(shouldSendDigest(weekly, 'America/New_York', utcMondayEastern7am)).toBe(true);
  });

  it('returns false when timezone is missing or invalid', () => {
    expect(shouldSendDigest(base, '', utcWhenEastern7am)).toBe(false);
  });
});
