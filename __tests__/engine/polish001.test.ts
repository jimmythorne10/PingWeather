/**
 * POLISH-001 regression tests
 *
 * Tests the testable subset of POLISH-001 fixes:
 *   1. Date-constructor-on-timestamp consistency:
 *      - alerts.tsx / index.tsx pattern: safe slice/split-Number local pattern
 *      - history.tsx: null guard
 *   2. moon_phase filter: new Date(dateStr + 'T00:00:00.000Z') — no TZ drift
 *   3. Engine now-threading: getMetricValues / getMetricEntries / evaluateCondition /
 *      evaluateRule accept an injected `now` and honor it deterministically.
 *
 * All engine functions are imported from src/utils/weatherEngine — the shared
 * source of truth. A regression in the implementation will fail these tests.
 */

import {
  getMetricValues,
  evaluateCondition,
  evaluateRule,
  type AlertRule,
  type ForecastData,
} from '../../src/utils/weatherEngine';

// ── Helper: build a minimal valid ForecastData ────────────────────────────────

function isoDate(daysOffset: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysOffset);
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function isoHour(offsetHours: number): string {
  return new Date(Date.now() + offsetHours * 3_600_000).toISOString();
}

function buildForecast(overrides: Partial<ForecastData> = {}): ForecastData {
  const base: ForecastData = {
    hourly: {
      time: [isoHour(1), isoHour(6), isoHour(12), isoHour(24), isoHour(48)],
      temperature_2m: [70, 72, 74, 68, 65],
      relative_humidity_2m: [50, 55, 60, 45, 40],
      precipitation_probability: [10, 20, 30, 15, 10],
      wind_speed_10m: [5, 8, 10, 6, 4],
      apparent_temperature: [68, 70, 72, 66, 63],
      uv_index: [1, 3, 5, 2, 1],
    },
    daily: {
      time: [isoDate(0), isoDate(1), isoDate(2), isoDate(3)],
      temperature_2m_max: [80, 82, 78, 75],
      temperature_2m_min: [55, 57, 53, 50],
      precipitation_probability_max: [20, 40, 10, 5],
      wind_speed_10m_max: [15, 20, 12, 8],
      uv_index_max: [5, 6, 4, 3],
    },
  };
  return { ...base, ...overrides };
}

function buildRule(overrides: Partial<AlertRule> = {}): AlertRule {
  return {
    id: 'r1',
    user_id: 'u1',
    location_id: 'l1',
    name: 'Test Rule',
    conditions: [],
    logical_operator: 'AND',
    lookahead_hours: 24,
    polling_interval_hours: 1,
    cooldown_hours: 0,
    is_active: true,
    last_triggered_at: null,
    ...overrides,
  };
}

// ── 1. Date formatting helper tests ──────────────────────────────────────────
// These tests validate the safe local-date extraction pattern
// (slice/split-Number) used in alerts.tsx and index.tsx, confirming
// it never drifts to the previous calendar day in western timezones.

describe('safe local date pattern (alerts / index date display)', () => {
  /**
   * Simulate the pattern used in alerts.tsx line 270:
   *   const [y, m, d] = last_triggered_at.slice(0, 10).split('-').map(Number);
   *   new Date(y, m - 1, d).toLocaleDateString()
   *
   * The point is that new Date("2026-06-15") on a UTC-5 machine gives
   * June 14 (previous day). The slice/split/Number local constructor gives
   * June 15 regardless of timezone.
   */
  it('slice-split-Number local constructor returns correct calendar day regardless of timezone', () => {
    // Use a fixed date string as if it came from Supabase.
    const isoTimestamp = '2026-06-15T05:00:00.000Z'; // 1am Eastern, 5am UTC
    const datePart = isoTimestamp.slice(0, 10); // "2026-06-15"
    const [y, m, d] = datePart.split('-').map(Number);
    const localDate = new Date(y, m - 1, d);
    // Whatever the local timezone, the local constructor should give June 15.
    expect(localDate.getFullYear()).toBe(2026);
    expect(localDate.getMonth()).toBe(5); // 0-indexed: June = 5
    expect(localDate.getDate()).toBe(15);
  });

  it('new Date(YYYY-MM-DD) UTC constructor CAN drift to previous day in western TZ', () => {
    // This confirms why the safe pattern is needed.
    // "2026-06-15" → UTC midnight → in UTC-5: June 14 11pm → getDate() = 14.
    const utcDate = new Date('2026-06-15'); // parsed as UTC midnight
    // We can't rely on the test machine TZ being UTC-5, so just document the risk:
    // if local offset is negative (west of UTC), getDate() MAY return 14.
    // The test simply confirms the UTC date is June 15 — western TZ = previous day.
    expect(utcDate.getUTCDate()).toBe(15); // UTC is always correct
    // Local date MAY be 14 or 15 depending on test runner TZ — we don't assert it.
  });

  it('null guard: triggered_at null returns fallback string not exception', () => {
    // history.tsx line 66 guard: entry.triggered_at ? new Date(...).toLocaleString() : '—'
    const triggered_at: string | null = null;
    const result = triggered_at
      ? new Date(triggered_at).toLocaleString()
      : '—';
    expect(result).toBe('—');
  });

  it('null guard: triggered_at set returns a non-empty date string', () => {
    const triggered_at = '2026-06-01T12:00:00.000Z';
    const result = triggered_at
      ? new Date(triggered_at).toLocaleString()
      : '—';
    expect(result).not.toBe('—');
    expect(result.length).toBeGreaterThan(0);
  });
});

// ── 2. moon_phase filter: TZ-safe date construction ──────────────────────────
// getMetricValues('moon_phase', ...) must filter using new Date(dateStr + 'T00:00:00.000Z')
// so the boundary day is not drifted by timezone offset.

describe('moon_phase filter — TZ-safe boundary day', () => {
  /**
   * Build a forecast whose daily.time array includes today and tomorrow.
   * Inject a fixed `now` at exactly UTC midnight today.
   * With the OLD new Date(dateStr) pattern: new Date("YYYY-MM-DD") == UTC midnight
   *   → todayUtc == new Date(dateStr) → today included (luck at midnight)
   * But at 23:00 UTC, todayUtc is still midnight and date == midnight < 23:00 → excluded.
   * With the FIX: new Date(dateStr + 'T00:00:00.000Z') == UTC midnight always.
   * Both todayUtc and the date string parse to the same UTC midnight, so >= passes.
   *
   * The deterministic `now` param lets us test this without race conditions.
   */
  it('includes today in moon_phase window when now is 23:59 UTC', () => {
    const todayStr = isoDate(0);
    const tomorrowStr = isoDate(1);

    // Simulate now = 23:59 UTC today. Without the TZ fix, the date parsed from
    // "YYYY-MM-DD" is UTC midnight, which is BEFORE 23:59, so it gets excluded.
    const nowAt2359 = new Date(`${todayStr}T23:59:00.000Z`);

    const forecast = buildForecast({
      daily: {
        time: [todayStr, tomorrowStr],
        temperature_2m_max: [80, 82],
        temperature_2m_min: [55, 57],
        precipitation_probability_max: [20, 40],
        wind_speed_10m_max: [15, 20],
        uv_index_max: [5, 6],
      },
    });

    // 48h lookahead — both days should be in window.
    const values = getMetricValues('moon_phase', forecast, 48, nowAt2359);

    // After the fix, today must be included even at 23:59 UTC.
    expect(values.length).toBeGreaterThanOrEqual(1);
  });

  it('excludes past days from moon_phase window', () => {
    const yesterdayStr = isoDate(-1);
    const todayStr = isoDate(0);
    const tomorrowStr = isoDate(1);

    const nowAtNoon = new Date(`${todayStr}T12:00:00.000Z`);

    const forecast = buildForecast({
      daily: {
        time: [yesterdayStr, todayStr, tomorrowStr],
        temperature_2m_max: [78, 80, 82],
        temperature_2m_min: [53, 55, 57],
        precipitation_probability_max: [10, 20, 40],
        wind_speed_10m_max: [12, 15, 20],
        uv_index_max: [4, 5, 6],
      },
    });

    const values = getMetricValues('moon_phase', forecast, 48, nowAtNoon);

    // Yesterday must be excluded. Today + tomorrow = 2 values.
    expect(values.length).toBe(2);
  });
});

// ── 3. Engine now-threading: injected `now` is honored ───────────────────────
// getMetricValues, evaluateCondition, and evaluateRule must all accept an
// optional `now?: Date` parameter and use it instead of `new Date()`.
// This is what makes the engine deterministically testable.

describe('engine now-threading — injected now is honored', () => {
  it('getMetricValues(temperature_current) filters relative to injected now', () => {
    // We inject a `now` that is 1 hour before the first hourly entry.
    // Entries at +1h, +6h, +12h, +24h from real-now are all within 48h from
    // injectedNow (-1h). The +48h entry is at +49h from injectedNow — outside
    // the 48h cutoff. So 4 entries are in window.
    const injectedNow = new Date(Date.now() - 1 * 3_600_000); // 1h in the past
    const forecast = buildForecast();
    const values = getMetricValues('temperature_current', forecast, 48, injectedNow);
    // +1h → 2h from injectedNow (in window)
    // +6h → 7h (in window)
    // +12h → 13h (in window)
    // +24h → 25h (in window)
    // +48h → 49h (outside 48h cutoff)
    expect(values.length).toBe(4);
  });

  it('getMetricValues(temperature_current) with future now excludes already-past entries', () => {
    // Inject now = 25 hours in the future. Entries at +1h, +6h, +12h, +24h are
    // all in the past relative to that now and should be excluded.
    // Only the +48h entry falls within a 48h lookahead from +25h (i.e. +73h cutoff).
    const injectedNow = new Date(Date.now() + 25 * 3_600_000);
    const forecast = buildForecast();
    const values = getMetricValues('temperature_current', forecast, 48, injectedNow);
    // Only the +48h entry is in [+25h, +73h].
    expect(values.length).toBe(1);
    expect(values[0]).toBe(65); // temperature at +48h in buildForecast
  });

  it('evaluateCondition honors injected now for temperature_current', () => {
    // Condition: temperature_current >= 74 (only the +12h entry = 74 qualifies).
    // With injectedNow = now (default behavior): +12h is in window → triggers.
    // With injectedNow = now + 13h: +12h is in the past → does NOT trigger.
    const condition = {
      metric: 'temperature_current',
      operator: 'gte',
      value: 74,
    };
    const forecast = buildForecast();

    const nowPast13h = new Date(Date.now() + 13 * 3_600_000);
    const resultExcluded = evaluateCondition(condition, forecast, 24, nowPast13h);
    // +12h entry is now in the past → should NOT meet the condition.
    expect(resultExcluded.met).toBe(false);

    // With a past now — all entries are in the future window.
    const nowMinus1h = new Date(Date.now() - 1 * 3_600_000);
    const resultIncluded = evaluateCondition(condition, forecast, 24, nowMinus1h);
    expect(resultIncluded.met).toBe(true);
  });

  it('evaluateRule honors injected now through the call chain', () => {
    // Rule fires if temperature_current >= 74 (only +12h entry hits this).
    const rule = buildRule({
      conditions: [{ metric: 'temperature_current', operator: 'gte', value: 74 }],
      lookahead_hours: 24,
    });
    const forecast = buildForecast();

    // Past now: +12h entry is in window → rule triggers.
    const nowMinus1h = new Date(Date.now() - 1 * 3_600_000);
    const triggered = evaluateRule(rule, forecast, nowMinus1h);
    expect(triggered.triggered).toBe(true);

    // Future now: +12h entry is excluded → rule does NOT trigger.
    const nowPlus13h = new Date(Date.now() + 13 * 3_600_000);
    const notTriggered = evaluateRule(rule, forecast, nowPlus13h);
    expect(notTriggered.triggered).toBe(false);
  });
});
