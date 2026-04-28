/**
 * Tests for rainfallApi — fetchRainfallHistory
 *
 * Logic-level Jest tests (node env). Verifies summation logic, unit mapping,
 * and error handling without real network calls.
 *
 * Each test is structured so it FAILS if the logic under test is absent or
 * wrong — the mock data is constructed so a no-op implementation cannot pass.
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

describe('fetchRainfallHistory — 24h window', () => {
  it('sums only past hourly precipitation values, ignoring future hours', async () => {
    // Pin "now" to noon on a known date so we control which hours are past/future.
    const fakeNow = new Date('2026-04-27T12:00:00.000Z');
    jest.useFakeTimers({ now: fakeNow.getTime() });

    // Build 10 hourly slots: 6 hours ago through 3 hours in the future.
    // Each slot has 1.0mm. Slots at -6h through -1h (6 slots) are past; the
    // slot at exactly "now" and beyond are future and must be excluded.
    const baseMs = fakeNow.getTime() - 6 * 60 * 60 * 1000;
    const times: string[] = [];
    const precipitation: number[] = [];
    for (let i = 0; i < 10; i++) {
      times.push(new Date(baseMs + i * 60 * 60 * 1000).toISOString());
      precipitation.push(1.0);
    }

    mockSuccess({ hourly: { time: times, precipitation } });

    const result = await fetchRainfallHistory(40, -74, '24h', 'inch');

    // 6 past slots × 1.0 = 6.0
    expect(result.totalMm).toBe(6.0);
    expect(result.window).toBe('24h');
  });

  it('returns correct unit "in" for precipitationUnit inch', async () => {
    // Single past hour with 0.5mm
    const past = new Date('2026-04-27T10:00:00.000Z');
    jest.useFakeTimers({ now: new Date('2026-04-27T23:59:00.000Z').getTime() });

    mockSuccess({ hourly: { time: [past.toISOString()], precipitation: [0.5] } });

    const result = await fetchRainfallHistory(40, -74, '24h', 'inch');

    expect(result.unit).toBe('in');
  });

  it('returns correct unit "mm" for precipitationUnit mm', async () => {
    const past = new Date('2026-04-27T10:00:00.000Z');
    jest.useFakeTimers({ now: new Date('2026-04-27T23:59:00.000Z').getTime() });

    mockSuccess({ hourly: { time: [past.toISOString()], precipitation: [2.0] } });

    const result = await fetchRainfallHistory(40, -74, '24h', 'mm');

    expect(result.unit).toBe('mm');
  });

  it('returns totalFormatted "No rainfall recorded" when total is 0', async () => {
    const past = new Date('2026-04-27T10:00:00.000Z');
    jest.useFakeTimers({ now: new Date('2026-04-27T23:59:00.000Z').getTime() });

    mockSuccess({ hourly: { time: [past.toISOString()], precipitation: [0] } });

    const result = await fetchRainfallHistory(40, -74, '24h', 'inch');

    expect(result.totalFormatted).toBe('No rainfall recorded');
  });

  it('throws when invoke returns an error', async () => {
    mockError('edge function crashed');

    await expect(
      fetchRainfallHistory(40, -74, '24h', 'inch'),
    ).rejects.toThrow(/Rainfall API error/);
  });
});

// ── 7d window ─────────────────────────────────────────────────────────────────

describe('fetchRainfallHistory — 7d window', () => {
  it('sums all daily precipitation_sum values', async () => {
    const dailySums = [1.2, 0, 3.4, 0.1, 0, 2.5, 0.8];
    const times = dailySums.map((_, i) => `2026-04-${String(20 + i).padStart(2, '0')}`);

    mockSuccess({ daily: { time: times, precipitation_sum: dailySums } });

    const result = await fetchRainfallHistory(40, -74, '7d', 'inch');

    // 1.2 + 0 + 3.4 + 0.1 + 0 + 2.5 + 0.8 = 8.0
    expect(result.totalMm).toBe(8.0);
    expect(result.window).toBe('7d');
  });

  it('builds a days array with correct date, amount, and a non-empty label', async () => {
    const dailySums = [1.5, 2.5];
    const times = ['2026-04-25', '2026-04-26'];

    mockSuccess({ daily: { time: times, precipitation_sum: dailySums } });

    const result = await fetchRainfallHistory(40, -74, '7d', 'inch');

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

    const result = await fetchRainfallHistory(40, -74, '7d', 'inch');

    expect(result.totalFormatted).toBe('No rainfall recorded');
  });

  it('includes the unit in totalFormatted when total is non-zero (mm)', async () => {
    mockSuccess({ daily: { time: ['2026-04-25'], precipitation_sum: [1.2] } });

    const result = await fetchRainfallHistory(40, -74, '7d', 'mm');

    expect(result.totalFormatted).toBe('1.2 mm');
  });

  it('includes the unit in totalFormatted when total is non-zero (inch)', async () => {
    mockSuccess({ daily: { time: ['2026-04-25'], precipitation_sum: [0.8] } });

    const result = await fetchRainfallHistory(40, -74, '7d', 'inch');

    expect(result.totalFormatted).toBe('0.8 in');
  });

  it('throws when invoke returns an error', async () => {
    mockError('timeout');

    await expect(
      fetchRainfallHistory(40, -74, '7d', 'inch'),
    ).rejects.toThrow(/Rainfall API error/);
  });
});

// ── 30d window ────────────────────────────────────────────────────────────────

describe('fetchRainfallHistory — 30d window', () => {
  it('sums all 30 daily precipitation_sum values', async () => {
    // 30 days of 0.1 each — total must equal exactly 3.0 after rounding
    const dailySums = Array(30).fill(0.1) as number[];
    const times = Array.from({ length: 30 }, (_, i) => {
      const base = new Date('2026-03-28T00:00:00Z');
      const d = new Date(base.getTime() + i * 86400000);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    });

    mockSuccess({ daily: { time: times, precipitation_sum: dailySums } });

    const result = await fetchRainfallHistory(40, -74, '30d', 'inch');

    expect(result.totalMm).toBe(3.0);
    expect(result.window).toBe('30d');
    expect(result.days).toHaveLength(30);
  });
});
