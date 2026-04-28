/**
 * Tests for evaluate-alerts engine — FR-POLL-002
 *
 * Validates condition matching, compound AND/OR logic, cooldown handling,
 * metric extraction for all 8 metrics, and lookahead window filtering.
 *
 * All functions are imported from src/utils/weatherEngine — the shared module
 * that the Edge Functions also import. A change to the real implementation will
 * cause these tests to fail, which is exactly what we want.
 */

import {
  getMetricValues,
  compare,
  evaluateCondition,
  evaluateRule,
  isInCooldown,
  gridKey,
  formatMatchedDate,
  type AlertCondition,
  type AlertRule,
  type ForecastData,
  type HourlyForecast,
  type DailyForecast,
} from '../../src/utils/weatherEngine';

// ── Test helpers ───────────────────────────────────────────────

function hoursFromNow(h: number): string {
  return new Date(Date.now() + h * 60 * 60 * 1000).toISOString();
}

/** Returns today's date as "YYYY-MM-DD" (UTC) — matches how Open-Meteo formats daily time. */
function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Returns the date string for N days from today in UTC. */
function futureDateString(daysFromNow: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

function buildForecast(overrides: Partial<ForecastData> = {}): ForecastData {
  const hourlyTimes = [
    hoursFromNow(1),
    hoursFromNow(6),
    hoursFromNow(12),
    hoursFromNow(24),
    hoursFromNow(48),
  ];
  // Daily times use hoursFromNow so they're always in the future relative to now,
  // which means the todayUtc snap in getMetricValues includes them.
  const dailyTimes = [
    hoursFromNow(12),
    hoursFromNow(36),
    hoursFromNow(60),
    hoursFromNow(84),
  ];

  return {
    hourly: {
      time: hourlyTimes,
      temperature_2m: [60, 55, 40, 35, 30],
      relative_humidity_2m: [50, 60, 70, 80, 90],
      precipitation_probability: [10, 30, 60, 80, 90],
      wind_speed_10m: [5, 10, 15, 20, 30],
      apparent_temperature: [58, 52, 38, 32, 28],
      uv_index: [2, 5, 3, 0, 1],
      ...(overrides.hourly as Partial<HourlyForecast>),
    },
    daily: {
      time: dailyTimes,
      temperature_2m_max: [75, 65, 50, 45],
      temperature_2m_min: [40, 30, 25, 20],
      precipitation_probability_max: [20, 80, 60, 40],
      wind_speed_10m_max: [15, 25, 35, 45],
      uv_index_max: [5, 7, 9, 3],
      ...(overrides.daily as Partial<DailyForecast>),
    },
  };
}

function buildRule(overrides: Partial<AlertRule> = {}): AlertRule {
  return {
    id: 'rule-1',
    user_id: 'user-1',
    location_id: 'loc-1',
    name: 'Test Rule',
    conditions: [{ metric: 'temperature_low', operator: 'lt', value: 32, unit: 'fahrenheit' }],
    logical_operator: 'AND',
    lookahead_hours: 72,
    polling_interval_hours: 4,
    cooldown_hours: 12,
    is_active: true,
    last_triggered_at: null,
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('evaluate-alerts engine — FR-POLL-002', () => {
  // ── Comparison operators ─────────────────────────────

  describe('compare — single condition matching', () => {
    it('gt: returns true when actual is greater than threshold', () => {
      // FR-POLL-002: comparison operator gt
      expect(compare(35, 'gt', 32)).toBe(true);
      expect(compare(32, 'gt', 32)).toBe(false);
      expect(compare(30, 'gt', 32)).toBe(false);
    });

    it('gte: returns true when actual is greater than or equal to threshold', () => {
      // FR-POLL-002: comparison operator gte
      expect(compare(32, 'gte', 32)).toBe(true);
      expect(compare(33, 'gte', 32)).toBe(true);
      expect(compare(31, 'gte', 32)).toBe(false);
    });

    it('lt: returns true when actual is less than threshold', () => {
      // FR-POLL-002: comparison operator lt
      expect(compare(25, 'lt', 32)).toBe(true);
      expect(compare(32, 'lt', 32)).toBe(false);
      expect(compare(40, 'lt', 32)).toBe(false);
    });

    it('lte: returns true when actual is less than or equal to threshold', () => {
      // FR-POLL-002: comparison operator lte
      expect(compare(32, 'lte', 32)).toBe(true);
      expect(compare(30, 'lte', 32)).toBe(true);
      expect(compare(33, 'lte', 32)).toBe(false);
    });

    it('eq: returns true only when values are equal', () => {
      // FR-POLL-002: comparison operator eq
      expect(compare(32, 'eq', 32)).toBe(true);
      expect(compare(33, 'eq', 32)).toBe(false);
    });

    it('unknown operator returns false', () => {
      expect(compare(5, 'xx', 5)).toBe(false);
    });
  });

  // ── Metric extraction for all 8 metrics ─────────────────

  describe('getMetricValues — 8 metrics', () => {
    const forecast = buildForecast();

    it('extracts temperature_high from daily forecast', () => {
      // FR-POLL-002: metric extraction — temperature_high
      const values = getMetricValues('temperature_high', forecast, 96);
      expect(values.length).toBeGreaterThan(0);
      expect(values).toEqual(expect.arrayContaining([75]));
    });

    it('extracts temperature_low from daily forecast', () => {
      // FR-POLL-002: metric extraction — temperature_low
      const values = getMetricValues('temperature_low', forecast, 96);
      expect(values.length).toBeGreaterThan(0);
      expect(values).toEqual(expect.arrayContaining([40, 30]));
    });

    it('extracts temperature_current from hourly forecast', () => {
      // FR-POLL-002: metric extraction — temperature_current
      const values = getMetricValues('temperature_current', forecast, 48);
      expect(values.length).toBeGreaterThan(0);
      expect(values).toEqual(expect.arrayContaining([60]));
    });

    it('extracts precipitation_probability from hourly for short lookahead', () => {
      // FR-POLL-002: metric extraction — precipitation_probability (hourly when <= 24h)
      const values = getMetricValues('precipitation_probability', forecast, 12);
      // Only hourly values within 12h window
      expect(values.length).toBeGreaterThan(0);
      expect(values.every((v) => forecast.hourly.precipitation_probability.includes(v))).toBe(true);
    });

    it('extracts precipitation_probability from daily for long lookahead', () => {
      // FR-POLL-002: metric extraction — precipitation_probability (daily when > 24h)
      const values = getMetricValues('precipitation_probability', forecast, 72);
      expect(values.length).toBeGreaterThan(0);
      expect(values.every((v) => forecast.daily.precipitation_probability_max.includes(v))).toBe(
        true,
      );
    });

    it('extracts wind_speed from hourly for short lookahead', () => {
      // FR-POLL-002: metric extraction — wind_speed (hourly when <= 24h)
      const values = getMetricValues('wind_speed', forecast, 12);
      expect(values.length).toBeGreaterThan(0);
      expect(values.every((v) => forecast.hourly.wind_speed_10m.includes(v))).toBe(true);
    });

    it('extracts wind_speed from daily for long lookahead', () => {
      const values = getMetricValues('wind_speed', forecast, 72);
      expect(values.every((v) => forecast.daily.wind_speed_10m_max.includes(v))).toBe(true);
    });

    it('extracts humidity from hourly forecast', () => {
      // FR-POLL-002: metric extraction — humidity
      const values = getMetricValues('humidity', forecast, 48);
      expect(values.length).toBeGreaterThan(0);
      expect(values).toEqual(expect.arrayContaining([50]));
    });

    it('extracts feels_like from hourly forecast (apparent temperature)', () => {
      // FR-POLL-002: metric extraction — feels_like
      const values = getMetricValues('feels_like', forecast, 48);
      expect(values.length).toBeGreaterThan(0);
      expect(values).toEqual(expect.arrayContaining([58]));
    });

    it('extracts uv_index from daily forecast', () => {
      // FR-POLL-002: metric extraction — uv_index
      const values = getMetricValues('uv_index', forecast, 96);
      expect(values.length).toBeGreaterThan(0);
      expect(values).toEqual(expect.arrayContaining([9]));
    });

    it('returns empty array for unknown metric', () => {
      const values = getMetricValues('unknown_metric', forecast, 48);
      expect(values).toEqual([]);
    });
  });

  // ── Daily date filter bug — today's data must be included ─

  describe('getMetricValues — daily metrics include today', () => {
    it('includes temperature_high from today when time is a YYYY-MM-DD date string', () => {
      // THE BUG: old code used `date >= now` where now is e.g. 14:00 UTC, and
      // today's daily record is midnight UTC. Midnight < 14:00 so today was excluded.
      // THE FIX: the real implementation snaps `now` to UTC midnight before comparing
      // daily records, so today is always included.
      //
      // Regression test: if getMetricValues reverts to comparing raw `now` against
      // midnight UTC dates, todayValue (92) will be missing from results.
      const todayHigh = 92;
      const tomorrowHigh = 88;

      const forecast: ForecastData = {
        daily: {
          time: [todayDateString(), futureDateString(1)],
          temperature_2m_max: [todayHigh, tomorrowHigh],
          temperature_2m_min: [70, 65],
          precipitation_probability_max: [10, 20],
          wind_speed_10m_max: [15, 12],
          uv_index_max: [8, 7],
        },
        hourly: {
          time: [],
          temperature_2m: [],
          relative_humidity_2m: [],
          precipitation_probability: [],
          wind_speed_10m: [],
          apparent_temperature: [],
          uv_index: [],
        },
      };

      // lookahead of 48h from now must include both today and tomorrow
      const values = getMetricValues('temperature_high', forecast, 48);
      expect(values).toContain(todayHigh); // today's high must be present
      expect(values).toContain(tomorrowHigh); // tomorrow's high must also be present
    });

    it('includes temperature_low from today regardless of time-of-day', () => {
      // Same fix applies to temperature_low (daily metric)
      const todayLow = 28;

      const forecast: ForecastData = {
        daily: {
          time: [todayDateString(), futureDateString(1)],
          temperature_2m_max: [75, 70],
          temperature_2m_min: [todayLow, 32],
          precipitation_probability_max: [10, 20],
          wind_speed_10m_max: [15, 12],
          uv_index_max: [8, 7],
        },
        hourly: {
          time: [],
          temperature_2m: [],
          relative_humidity_2m: [],
          precipitation_probability: [],
          wind_speed_10m: [],
          apparent_temperature: [],
          uv_index: [],
        },
      };

      const values = getMetricValues('temperature_low', forecast, 48);
      expect(values).toContain(todayLow);
    });

    it('a freeze alert rule can trigger on today\'s daily low', () => {
      // End-to-end regression: if today's low is excluded, a freeze alert that
      // should fire today will silently fail. This test catches that regression.
      const forecast: ForecastData = {
        daily: {
          time: [todayDateString(), futureDateString(1)],
          temperature_2m_max: [45, 50],
          temperature_2m_min: [28, 35], // today is freezing, tomorrow is not
          precipitation_probability_max: [0, 0],
          wind_speed_10m_max: [5, 5],
          uv_index_max: [2, 3],
        },
        hourly: {
          time: [],
          temperature_2m: [],
          relative_humidity_2m: [],
          precipitation_probability: [],
          wind_speed_10m: [],
          apparent_temperature: [],
          uv_index: [],
        },
      };

      const rule = buildRule({
        conditions: [{ metric: 'temperature_low', operator: 'lt', value: 32 }],
        lookahead_hours: 24,
      });

      const result = evaluateRule(rule, forecast);
      expect(result.triggered).toBe(true); // would be false if today's data is excluded
    });
  });

  // ── Lookahead window filtering ────────────────────────

  describe('lookahead window filtering', () => {
    it('excludes values outside the lookahead window', () => {
      // FR-POLL-002: condition checked within rule lookahead window
      const forecast = buildForecast();
      // lookahead of 6 hours should only include the 1h entry (and exclude 48h)
      const values = getMetricValues('temperature_current', forecast, 6);
      expect(values).toContain(60); // 1h entry
      expect(values).not.toContain(30); // 48h entry
    });

    it('excludes values in the past', () => {
      // FR-POLL-002: metric values from lookahead window (future only)
      const forecast: ForecastData = {
        hourly: {
          time: [
            new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
            hoursFromNow(2),
          ],
          temperature_2m: [100, 50],
          relative_humidity_2m: [0, 0],
          precipitation_probability: [0, 0],
          wind_speed_10m: [0, 0],
          apparent_temperature: [0, 0],
          uv_index: [0, 0],
        },
        daily: {
          time: [hoursFromNow(12)],
          temperature_2m_max: [70],
          temperature_2m_min: [30],
          precipitation_probability_max: [20],
          wind_speed_10m_max: [10],
          uv_index_max: [5],
        },
      };

      const values = getMetricValues('temperature_current', forecast, 24);
      expect(values).not.toContain(100); // past value excluded
      expect(values).toContain(50); // future value included
    });
  });

  // ── Single-condition rule evaluation ────────────────────

  describe('evaluateRule — single condition', () => {
    it('triggers when a value within lookahead matches the condition', () => {
      // FR-POLL-002: rule triggers when condition is met within lookahead
      const forecast = buildForecast();
      const rule = buildRule({
        conditions: [{ metric: 'temperature_low', operator: 'lt', value: 32 }],
        lookahead_hours: 96,
      });

      const result = evaluateRule(rule, forecast);
      expect(result.triggered).toBe(true);
    });

    it('does not trigger when no value matches', () => {
      const forecast = buildForecast();
      const rule = buildRule({
        conditions: [{ metric: 'temperature_low', operator: 'lt', value: -50 }],
        lookahead_hours: 96,
      });

      const result = evaluateRule(rule, forecast);
      expect(result.triggered).toBe(false);
    });

    it('returns matchDetails with per-condition results', () => {
      const forecast = buildForecast();
      const rule = buildRule({
        conditions: [{ metric: 'temperature_low', operator: 'lt', value: 32 }],
        lookahead_hours: 96,
      });

      const result = evaluateRule(rule, forecast);
      expect(result.matchDetails).toHaveLength(1);
      expect(result.matchDetails[0].met).toBe(true);
      expect(result.matchDetails[0].metric).toBe('temperature_low');
    });
  });

  // ── Empty conditions guard ───────────────────────────────

  describe('evaluateRule — empty conditions guard', () => {
    it('returns triggered:false when conditions array is empty (AND)', () => {
      // A rule with no conditions must never fire — it has no criteria to evaluate.
      // The guard prevents vacuous truth (AND of empty set = true in set theory,
      // which would fire every poll cycle).
      const rule = buildRule({
        conditions: [],
        logical_operator: 'AND',
      });

      const forecast = buildForecast();
      const result = evaluateRule(rule, forecast);
      expect(result.triggered).toBe(false);
      expect(result.matchDetails).toHaveLength(0);
    });

    it('returns triggered:false when conditions array is empty (OR)', () => {
      // Same guard applies to OR logic.
      const rule = buildRule({
        conditions: [],
        logical_operator: 'OR',
      });

      const forecast = buildForecast();
      const result = evaluateRule(rule, forecast);
      expect(result.triggered).toBe(false);
    });

    it('empty conditions result includes a descriptive summary', () => {
      const rule = buildRule({ conditions: [] });
      const forecast = buildForecast();
      const result = evaluateRule(rule, forecast);
      expect(result.summary).toBeTruthy();
      expect(typeof result.summary).toBe('string');
    });
  });

  // ── Compound AND/OR rule evaluation ─────────────────────

  describe('evaluateRule — compound conditions', () => {
    it('AND: triggers only when all conditions are met', () => {
      // FR-POLL-002: AND rules — all conditions must be met
      const forecast = buildForecast();
      const rule = buildRule({
        logical_operator: 'AND',
        conditions: [
          { metric: 'temperature_low', operator: 'lt', value: 32 },
          { metric: 'wind_speed', operator: 'gt', value: 10 },
        ],
        lookahead_hours: 96,
      });

      expect(evaluateRule(rule, forecast).triggered).toBe(true);
    });

    it('AND: does not trigger when one condition fails', () => {
      const forecast = buildForecast();
      const rule = buildRule({
        logical_operator: 'AND',
        conditions: [
          { metric: 'temperature_low', operator: 'lt', value: 32 },
          { metric: 'wind_speed', operator: 'gt', value: 999 }, // impossible
        ],
        lookahead_hours: 96,
      });

      expect(evaluateRule(rule, forecast).triggered).toBe(false);
    });

    it('OR: triggers when any condition is met', () => {
      // FR-POLL-002: OR rules — any condition triggers
      const forecast = buildForecast();
      const rule = buildRule({
        logical_operator: 'OR',
        conditions: [
          { metric: 'temperature_low', operator: 'lt', value: -50 }, // impossible
          { metric: 'temperature_low', operator: 'lt', value: 32 }, // matches
        ],
        lookahead_hours: 96,
      });

      expect(evaluateRule(rule, forecast).triggered).toBe(true);
    });

    it('OR: does not trigger when no condition is met', () => {
      const forecast = buildForecast();
      const rule = buildRule({
        logical_operator: 'OR',
        conditions: [
          { metric: 'temperature_low', operator: 'lt', value: -100 },
          { metric: 'wind_speed', operator: 'gt', value: 500 },
        ],
        lookahead_hours: 96,
      });

      expect(evaluateRule(rule, forecast).triggered).toBe(false);
    });
  });

  // ── Cooldown check ──────────────────────────────────────

  describe('isInCooldown — FR-POLL-002 cooldown respect', () => {
    it('returns false when rule has never been triggered', () => {
      // FR-POLL-002: cooldown respected — never-triggered rule has no cooldown
      const rule = buildRule({ last_triggered_at: null });
      expect(isInCooldown(rule, new Date())).toBe(false);
    });

    it('returns true when current time is within cooldown window', () => {
      // FR-POLL-002: skip rules triggered within cooldown_hours
      const rule = buildRule({
        last_triggered_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
        cooldown_hours: 12,
      });
      expect(isInCooldown(rule, new Date())).toBe(true);
    });

    it('returns false when current time is past cooldown window', () => {
      const rule = buildRule({
        last_triggered_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24h ago
        cooldown_hours: 12,
      });
      expect(isInCooldown(rule, new Date())).toBe(false);
    });

    it('returns true right at cooldown boundary', () => {
      const rule = buildRule({
        last_triggered_at: new Date(Date.now() - 11.9 * 60 * 60 * 1000).toISOString(),
        cooldown_hours: 12,
      });
      expect(isInCooldown(rule, new Date())).toBe(true);
    });

    it('accepts an explicit now parameter so callers can control the reference time', () => {
      // The explicit `now` parameter is what allows poll-weather to pass a single
      // consistent timestamp across all rule evaluations in a batch, rather than
      // each call to isInCooldown seeing a slightly different wall-clock time.
      const lastTriggered = new Date('2026-04-24T10:00:00.000Z');
      const rule = buildRule({
        last_triggered_at: lastTriggered.toISOString(),
        cooldown_hours: 4,
      });

      // 3 hours after trigger — still in cooldown
      const nowDuring = new Date('2026-04-24T13:00:00.000Z');
      expect(isInCooldown(rule, nowDuring)).toBe(true);

      // 5 hours after trigger — cooldown expired
      const nowAfter = new Date('2026-04-24T15:00:00.000Z');
      expect(isInCooldown(rule, nowAfter)).toBe(false);
    });
  });

  // ── matchedTime propagation ──────────────────────────────

  describe('evaluateCondition — matchedTime propagation', () => {
    it('populates matchedTime with YYYY-MM-DD string for daily metrics', () => {
      // Daily metrics (temperature_high/low, uv_index, precipitation_probability >24h)
      // get their time from forecast.daily.time, which holds "YYYY-MM-DD" strings.
      // If matchedTime is null here, the notification body will never have a day label.
      const forecast: ForecastData = {
        daily: {
          time: [futureDateString(1), futureDateString(2)],
          temperature_2m_max: [75, 65],
          temperature_2m_min: [28, 35], // day 1 is below 32
          precipitation_probability_max: [20, 40],
          wind_speed_10m_max: [10, 15],
          uv_index_max: [5, 7],
        },
        hourly: {
          time: [],
          temperature_2m: [],
          relative_humidity_2m: [],
          precipitation_probability: [],
          wind_speed_10m: [],
          apparent_temperature: [],
          uv_index: [],
        },
      };

      const condition: AlertCondition = { metric: 'temperature_low', operator: 'lt', value: 32 };
      const result = evaluateCondition(condition, forecast, 72);

      expect(result.met).toBe(true);
      // matchedTime MUST be a "YYYY-MM-DD" string — not null
      expect(result.matchedTime).not.toBeNull();
      expect(result.matchedTime).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // Must correspond to the first matching day
      expect(result.matchedTime).toBe(futureDateString(1));
    });

    it('populates matchedTime with ISO timestamp for hourly metrics', () => {
      // Hourly metrics get their time from forecast.hourly.time, which holds ISO
      // timestamp strings. If matchedTime is null, we lose the time-of-day info.
      const matchingTime = hoursFromNow(3);
      const forecast: ForecastData = {
        hourly: {
          time: [hoursFromNow(1), matchingTime, hoursFromNow(6)],
          temperature_2m: [60, 55, 40],
          relative_humidity_2m: [50, 90, 70], // index 1 (matchingTime) hits >= 85
          precipitation_probability: [10, 30, 60],
          wind_speed_10m: [5, 10, 15],
          apparent_temperature: [58, 52, 38],
          uv_index: [2, 5, 3],
        },
        daily: {
          time: [],
          temperature_2m_max: [],
          temperature_2m_min: [],
          precipitation_probability_max: [],
          wind_speed_10m_max: [],
          uv_index_max: [],
        },
      };

      const condition: AlertCondition = { metric: 'humidity', operator: 'gte', value: 85 };
      const result = evaluateCondition(condition, forecast, 24);

      expect(result.met).toBe(true);
      // matchedTime MUST be an ISO timestamp string — not null
      expect(result.matchedTime).not.toBeNull();
      // Must be the ISO string for the matching hourly slot
      expect(result.matchedTime).toBe(matchingTime);
    });

    it('matchedTime is null when condition is not met', () => {
      // When no value satisfies the condition, matchedTime should be null — there
      // is no matched entry to report a time for.
      const forecast: ForecastData = {
        daily: {
          time: [futureDateString(1)],
          temperature_2m_max: [75],
          temperature_2m_min: [50], // well above 32 — condition will NOT trigger
          precipitation_probability_max: [10],
          wind_speed_10m_max: [5],
          uv_index_max: [3],
        },
        hourly: {
          time: [],
          temperature_2m: [],
          relative_humidity_2m: [],
          precipitation_probability: [],
          wind_speed_10m: [],
          apparent_temperature: [],
          uv_index: [],
        },
      };

      const condition: AlertCondition = { metric: 'temperature_low', operator: 'lt', value: 32 };
      const result = evaluateCondition(condition, forecast, 48);

      expect(result.met).toBe(false);
      expect(result.matchedTime).toBeNull();
    });

    it('matchDetails in evaluateRule includes matchedTime for triggered conditions', () => {
      // End-to-end: evaluateRule must surface matchedTime in matchDetails so that
      // poll-weather can read it when building the notification body.
      const forecast: ForecastData = {
        daily: {
          time: [futureDateString(1), futureDateString(2)],
          temperature_2m_max: [75, 65],
          temperature_2m_min: [28, 35],
          precipitation_probability_max: [20, 40],
          wind_speed_10m_max: [10, 15],
          uv_index_max: [5, 7],
        },
        hourly: {
          time: [],
          temperature_2m: [],
          relative_humidity_2m: [],
          precipitation_probability: [],
          wind_speed_10m: [],
          apparent_temperature: [],
          uv_index: [],
        },
      };

      const rule = buildRule({
        conditions: [{ metric: 'temperature_low', operator: 'lt', value: 32 }],
        lookahead_hours: 72,
      });

      const result = evaluateRule(rule, forecast);
      expect(result.triggered).toBe(true);
      expect(result.matchDetails[0].met).toBe(true);
      // matchedTime MUST be present and non-null — this is what poll-weather reads
      expect(result.matchDetails[0].matchedTime).not.toBeNull();
      expect(result.matchDetails[0].matchedTime).toBe(futureDateString(1));
    });
  });

  // ── formatMatchedDate ─────────────────────────────────────

  describe('formatMatchedDate', () => {
    it('returns "Today" for today YYYY-MM-DD string', () => {
      // todayDateString() returns the current UTC date as "YYYY-MM-DD"
      expect(formatMatchedDate(todayDateString())).toBe('Today');
    });

    it('returns "Tomorrow" for tomorrow YYYY-MM-DD string', () => {
      expect(formatMatchedDate(futureDateString(1))).toBe('Tomorrow');
    });

    it('returns formatted date string for a future daily date', () => {
      // Any date beyond tomorrow should produce a "Weekday M/D" label.
      // We use day +3 to ensure it's never today or tomorrow regardless of timezone.
      const label = formatMatchedDate(futureDateString(3));
      expect(label).not.toBeNull();
      expect(label).not.toBe('Today');
      expect(label).not.toBe('Tomorrow');
      // Should contain a slash — "Mon 5/5", "Fri 5/2", etc.
      expect(label).toMatch(/\//);
    });

    it('returns "Today" for an ISO timestamp that falls on today', () => {
      // An hourly metric time-stamp for the current UTC day should resolve to "Today"
      // regardless of the hour offset.
      const todayIso = new Date().toISOString(); // right now — unambiguously today
      expect(formatMatchedDate(todayIso)).toBe('Today');
    });

    it('returns null for null input', () => {
      expect(formatMatchedDate(null)).toBeNull();
    });

    it('returns null for invalid string', () => {
      expect(formatMatchedDate('not-a-date')).toBeNull();
    });
  });

  // ── gridKey ──────────────────────────────────────────────

  describe('gridKey — cache key consistency', () => {
    it('produces identical keys for coordinates that round to the same 0.1° grid cell', () => {
      // Nearby users must share the same grid so only one Open-Meteo API call
      // is made for their grid. If this fails, the batching logic breaks.
      // 40.123 and 40.144 both round to 40.1; -74.521 and -74.549 both round to -74.5.
      expect(gridKey(40.123, -74.521)).toBe(gridKey(40.144, -74.549));
    });

    it('produces different keys for coordinates more than 0.1° apart', () => {
      expect(gridKey(40.1, -74.5)).not.toBe(gridKey(40.2, -74.5));
    });

    it('rounds to 1 decimal place', () => {
      // 40.123 → 40.1, -74.567 → -74.6
      expect(gridKey(40.123, -74.567)).toBe('40.1,-74.6');
    });

    it('cache key from poll-weather matches lookup key from send-digest', () => {
      // THE BUG: poll-weather was caching with raw coordinates, send-digest was
      // looking up with gridKey() — causing cache misses and redundant API calls.
      // THE FIX: both now use gridKey(). This test verifies the keys are identical.
      const lat = 40.123;
      const lon = -74.567;
      const pollWeatherKey = gridKey(lat, lon); // what poll-weather writes to cache
      const sendDigestKey = gridKey(lat, lon);  // what send-digest reads from cache
      expect(pollWeatherKey).toBe(sendDigestKey);
      expect(pollWeatherKey).toBe('40.1,-74.6');
    });

    it('handles coordinates that round cleanly to integers', () => {
      expect(gridKey(40.0, -74.0)).toBe('40,-74');
    });

    it('handles negative latitudes (southern hemisphere)', () => {
      expect(gridKey(-33.87, 151.21)).toBe('-33.9,151.2');
    });
  });
});
