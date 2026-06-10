/**
 * Tests for rainfallApi -- fetchRainfallHistory
 *
 * Logic-level Jest tests (node env). Verifies summation logic, unit mapping,
 * and error handling without real network calls.
 *
 * Each test is structured so it FAILS if the logic under test is absent or
 * wrong -- the mock data is constructed so a no-op implementation cannot pass.
 */

import { fetchRainfallHistory } from '../../src/services/rainfallApi';
import { supabase } from '../../src/utils/supabase';

jest.mock('../../src/utils/supabase', () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));

const mockInvoke = supabase.functions.invoke as jest.Mock;

afterEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockSuccess(body: unknown) {
  mockInvoke.mockResolvedValueOnce({ data: body, error: null });
}

function mockError(message: string) {
  mockInvoke.mockResolvedValueOnce({ data: null, error: { message } });
}

// ── 24h window ────────────────────────────────────────────────────────────────

describe('fetchRainfallHistory -- 24h window', () => {
  it('sums only past local hourly precipitation values, ignoring future-local hours (DATA-002)', async () => {
    // UTC "now": 2026-04-27T17:00Z
    // America/Chicago CDT = UTC-5, so local "now" = 2026-04-27T12:00 (noon local)
    //
    // Open-Meteo returns LOCAL timestamps (no suffix).
    // Hours at or before local 12:00 are past; hours after are future.
    //
    // The OLD bug: compared these local strings against new Date().toISOString()
    // (UTC "2026-04-27T17:00:00.000Z"), counting hours 13-17 as "past" when
    // they are actually future-local -- inflating rainfall total.
    //
    // The fix: compare against local-time anchor "2026-04-27T12:00" so hours
    // 13, 14, 15, 16 are correctly treated as future and excluded.

    const fakeNowUtc = new Date('2026-04-27T17:00:00.000Z');
    jest.useFakeTimers({ now: fakeNowUtc.getTime() });

    // Local timestamps (no suffix) as Open-Meteo returns them.
    // Hours 08 through 16 (9 slots), each with 1.0 of precipitation.
    // Local "now" is 12:00, so hours 08-12 (5 slots) are past/current;
    // hours 13-16 (4 slots) are future and MUST be excluded.
    const times: string[] = [];
    const precipitation: number[] = [];
    for (let h = 8; h <= 16; h++) {
      const hStr = String(h).padStart(2, '0');
      times.push(`2026-04-27T${hStr}:00`);
      precipitation.push(1.0);
    }

    mockSuccess({ hourly: { time: times, precipitation } });

    // America/Chicago is UTC-5 (CDT on 2026-04-27)
    const result = await fetchRainfallHistory(40, -90, '24h', 'inch', 'America/Chicago');

    // Past-local hours: 08, 09, 10, 11, 12 = 5 slots * 1.0 = 5.0
    // Future-local hours excluded: 13, 14, 15, 16
    // Old UTC-based bug would count 08-17 as past (up to 10 slots if the
    // loop covered them), inflating the total beyond 5.0
    expect(result.totalMm).toBe(5.0);
    expect(result.window).toBe('24h');
  });

  it('returns correct unit "in" for precipitationUnit inch', async () => {
    jest.useFakeTimers({ now: new Date('2026-04-27T23:59:00.000Z').getTime() });

    mockSuccess({ hourly: { time: ['2026-04-27T10:00'], precipitation: [0.5] } });

    const result = await fetchRainfallHistory(40, -74, '24h', 'inch', 'UTC');

    expect(result.unit).toBe('in');
  });

  it('returns correct unit "mm" for precipitationUnit mm', async () => {
    jest.useFakeTimers({ now: new Date('2026-04-27T23:59:00.000Z').getTime() });

    mockSuccess({ hourly: { time: ['2026-04-27T10:00'], precipitation: [2.0] } });

    const result = await fetchRainfallHistory(40, -74, '24h', 'mm', 'UTC');

    expect(result.unit).toBe('mm');
  });

  it('returns totalFormatted "No rainfall recorded" when total is 0', async () => {
    jest.useFakeTimers({ now: new Date('2026-04-27T23:59:00.000Z').getTime() });

    mockSuccess({ hourly: { time: ['2026-04-27T10:00'], precipitation: [0] } });

    const result = await fetchRainfallHistory(40, -74, '24h', 'inch', 'UTC');

    expect(result.totalFormatted).toBe('No rainfall recorded');
  });

  it('throws when invoke returns an error', async () => {
    mockError('edge function crashed');

    await expect(
      fetchRainfallHistory(40, -74, '24h', 'inch', 'UTC'),
    ).rejects.toThrow(/Rainfall API error/);
  });
});

// ── 7d window ─────────────────────────────────────────────────────────────────

describe('fetchRainfallHistory -- 7d window', () => {
  it('sums all daily precipitation_sum values', async () => {
    const dailySums = [1.2, 0, 3.4, 0.1, 0, 2.5, 0.8];
    const times = dailySums.map((_, i) => `2026-04-${String(20 + i).padStart(2, '0')}`);

    mockSuccess({ daily: { time: times, precipitation_sum: dailySums } });

    const result = await fetchRainfallHistory(40, -74, '7d', 'inch', 'UTC');

    // 1.2 + 0 + 3.4 + 0.1 + 0 + 2.5 + 0.8 = 8.0
    expect(result.totalMm).toBe(8.0);
    expect(result.window).toBe('7d');
  });

  it('builds a days array with correct date, amount, and a non-empty label', async () => {
    const dailySums = [1.5, 2.5];
    const times = ['2026-04-25', '2026-04-26'];

    mockSuccess({ daily: { time: times, precipitation_sum: dailySums } });

    const result = await fetchRainfallHistory(40, -74, '7d', 'inch', 'UTC');

    expect(result.days).toHaveLength(2);
    expect(result.days[0].date).toBe('2026-04-25');
    expect(result.days[0].amount).toBe(1.5);
    expect(result.days[1].date).toBe('2026-04-26');
    expect(result.days[1].amount).toBe(2.5);
    // label must be a non-empty string (exact locale format varies by env)
    expect(typeof result.days[0].label).toBe('string');
    expect(result.days[0].label.length).toBeGreaterThan(0);
  });

  it('returns "No rainfall recorded" when all daily sums are 0', async () => {
    mockSuccess({ daily: { time: ['2026-04-25'], precipitation_sum: [0] } });

    const result = await fetchRainfallHistory(40, -74, '7d', 'inch', 'UTC');

    expect(result.totalFormatted).toBe('No rainfall recorded');
  });

  it('includes the unit in totalFormatted when total is non-zero (mm)', async () => {
    mockSuccess({ daily: { time: ['2026-04-25'], precipitation_sum: [1.2] } });

    const result = await fetchRainfallHistory(40, -74, '7d', 'mm', 'UTC');

    expect(result.totalFormatted).toBe('1.2 mm');
  });

  it('includes the unit in totalFormatted when total is non-zero (inch)', async () => {
    mockSuccess({ daily: { time: ['2026-04-25'], precipitation_sum: [0.8] } });

    const result = await fetchRainfallHistory(40, -74, '7d', 'inch', 'UTC');

    expect(result.totalFormatted).toBe('0.8 in');
  });

  it('throws when invoke returns an error', async () => {
    mockError('timeout');

    await expect(
      fetchRainfallHistory(40, -74, '7d', 'inch', 'UTC'),
    ).rejects.toThrow(/Rainfall API error/);
  });
});

// ── 30d window ────────────────────────────────────────────────────────────────

describe('fetchRainfallHistory -- 30d window', () => {
  it('sums all 30 daily precipitation_sum values', async () => {
    // 30 days of 0.1 each -- total must equal exactly 3.0 after rounding
    const dailySums = Array(30).fill(0.1) as number[];
    const times = Array.from({ length: 30 }, (_, i) => {
      const base = new Date('2026-03-28T00:00:00Z');
      const d = new Date(base.getTime() + i * 86400000);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    });

    mockSuccess({ daily: { time: times, precipitation_sum: dailySums } });

    const result = await fetchRainfallHistory(40, -74, '30d', 'inch', 'UTC');

    expect(result.totalMm).toBe(3.0);
    expect(result.window).toBe('30d');
    expect(result.days).toHaveLength(30);
  });
});
