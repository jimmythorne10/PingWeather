/**
 * Tests for ruleWouldTrigger — DATA-003
 *
 * Verifies that the lookahead-window filter in ruleWouldTrigger uses local-time
 * date construction (new Date(y, m-1, d)) instead of the UTC-midnight drift bug
 * (new Date("YYYY-MM-DD")).
 *
 * The bug: in western timezones (e.g., UTC-7), new Date("2026-06-05") resolves
 * to 2026-06-04T17:00:00 local time, which is less than `now` (midnight local),
 * so the day is misclassified as "in the past" and excluded from the window.
 *
 * The fix: split the YYYY-MM-DD string and call new Date(y, m-1, d) which
 * gives local midnight — same pattern used by formatDayLabel.
 */

import { ruleWouldTrigger } from '../../src/utils/forecastRulePreview';
import type { AlertRule } from '../../src/types';
import type { HourlyForecast, DailyForecast } from '../../src/types';

// ── Local helpers ──────────────────────────────────────────────────────────

/**
 * Returns a YYYY-MM-DD string for today in local time — matching what the
 * forecast screen receives from Open-Meteo (which returns local calendar dates).
 */
function localDateString(daysOffset: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface LocationForecast {
  hourly: HourlyForecast;
  daily: DailyForecast;
}

function buildLocationForecast(
  dailyDates: string[],
  temps_min: number[],
  temps_max: number[],
  precip: number[],
  wind: number[],
): LocationForecast {
  return {
    daily: {
      time: dailyDates,
      temperature_2m_min: temps_min,
      temperature_2m_max: temps_max,
      precipitation_probability_max: precip,
      wind_speed_10m_max: wind,
      wind_direction_10m_dominant: dailyDates.map(() => 180),
      uv_index_max: dailyDates.map(() => 3),
      weather_code: dailyDates.map(() => 0),
    },
    hourly: {
      time: [],
      temperature_2m: [],
      relative_humidity_2m: [],
      precipitation_probability: [],
      wind_speed_10m: [],
      apparent_temperature: [],
      uv_index: [],
      weather_code: [],
    },
  };
}

function buildRule(overrides: Partial<AlertRule> = {}): AlertRule {
  return {
    id: 'rule-test',
    user_id: 'user-test',
    location_id: 'loc-test',
    name: 'Test Rule',
    conditions: [{ metric: 'temperature_low', operator: 'lt', value: 32 }],
    logical_operator: 'AND',
    lookahead_hours: 48,
    polling_interval_hours: 4,
    cooldown_hours: 12,
    is_active: true,
    last_triggered_at: null,
    last_polled_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ruleWouldTrigger — DATA-003 timezone-safe daily filter', () => {
  /**
   * THE CRITICAL TEST: demonstrates the UTC-midnight drift bug and verifies the fix.
   *
   * Setup: a 48-hour lookahead rule; the trigger day is tomorrow (local time).
   * With the buggy new Date("YYYY-MM-DD") parse in a UTC- timezone, tomorrow's
   * date string resolves to "yesterday evening" local time → excluded from window.
   * With the fix (new Date(y, m-1, d)) it resolves to local midnight → included.
   */
  it('classifies a rule correctly when the trigger day falls within the lookahead window', () => {
    const today = localDateString(0);
    const tomorrow = localDateString(1);
    const dayAfter = localDateString(2);

    // today: safe (no freeze); tomorrow: freeze trigger; dayAfter: safe
    const forecast = buildLocationForecast(
      [today, tomorrow, dayAfter],
      [35, 28, 40],           // temperature_2m_min — tomorrow is 28°F (<32)
      [55, 45, 60],           // temperature_2m_max
      [0, 10, 0],             // precipitation_probability_max
      [10, 15, 5],            // wind_speed_10m_max
    );

    const rule = buildRule({
      conditions: [{ metric: 'temperature_low', operator: 'lt', value: 32 }],
      lookahead_hours: 48,
    });

    const result = ruleWouldTrigger(rule, forecast);

    // Tomorrow (day index 1) has temp_min=28 which is < 32. With a 48-hour
    // lookahead it is clearly within the window. The rule MUST trigger.
    // If the UTC-drift bug is present, tomorrow's date parses to "last night
    // UTC" which is less than `now`, so the day is excluded and triggered=false.
    expect(result.triggered).toBe(true);
    expect(result.detail).toContain('temperature low');
  });

  it('does not trigger when no daily value matches the condition within lookahead', () => {
    const today = localDateString(0);
    const tomorrow = localDateString(1);

    const forecast = buildLocationForecast(
      [today, tomorrow],
      [50, 55],   // both well above 32 — should NOT trigger a freeze rule
      [75, 78],
      [0, 0],
      [5, 8],
    );

    const rule = buildRule({
      conditions: [{ metric: 'temperature_low', operator: 'lt', value: 32 }],
      lookahead_hours: 48,
    });

    const result = ruleWouldTrigger(rule, forecast);
    expect(result.triggered).toBe(false);
    expect(result.detail).toBe('Clear');
  });

  it('excludes days beyond the lookahead window', () => {
    const today = localDateString(0);
    const tomorrow = localDateString(1);
    const farFuture = localDateString(4); // 4 days out — beyond 48-hour lookahead

    const forecast = buildLocationForecast(
      [today, tomorrow, farFuture],
      [50, 55, 20],   // only farFuture is freezing — should NOT trigger within 48h
      [75, 78, 40],
      [0, 0, 0],
      [5, 8, 5],
    );

    const rule = buildRule({
      conditions: [{ metric: 'temperature_low', operator: 'lt', value: 32 }],
      lookahead_hours: 48,
    });

    const result = ruleWouldTrigger(rule, forecast);
    expect(result.triggered).toBe(false);
  });

  it('handles temperature_high metric correctly', () => {
    const today = localDateString(0);
    const tomorrow = localDateString(1);

    const forecast = buildLocationForecast(
      [today, tomorrow],
      [60, 62],
      [105, 108],  // extreme heat
      [0, 0],
      [5, 5],
    );

    const rule = buildRule({
      conditions: [{ metric: 'temperature_high', operator: 'gt', value: 100 }],
      lookahead_hours: 48,
    });

    const result = ruleWouldTrigger(rule, forecast);
    expect(result.triggered).toBe(true);
  });

  it('handles precipitation_probability metric correctly', () => {
    const today = localDateString(0);
    const tomorrow = localDateString(1);

    const forecast = buildLocationForecast(
      [today, tomorrow],
      [50, 52],
      [70, 72],
      [10, 85],  // tomorrow has 85% rain chance
      [5, 8],
    );

    const rule = buildRule({
      conditions: [{ metric: 'precipitation_probability', operator: 'gte', value: 80 }],
      lookahead_hours: 48,
    });

    const result = ruleWouldTrigger(rule, forecast);
    expect(result.triggered).toBe(true);
  });

  it('handles wind_speed metric correctly', () => {
    const today = localDateString(0);
    const tomorrow = localDateString(1);

    const forecast = buildLocationForecast(
      [today, tomorrow],
      [50, 52],
      [70, 72],
      [10, 15],
      [8, 45],  // tomorrow has 45 mph gusts
    );

    const rule = buildRule({
      conditions: [{ metric: 'wind_speed', operator: 'gt', value: 40 }],
      lookahead_hours: 48,
    });

    const result = ruleWouldTrigger(rule, forecast);
    expect(result.triggered).toBe(true);
  });
});
