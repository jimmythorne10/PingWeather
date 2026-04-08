/**
 * Tests for evaluate-alerts engine — FR-POLL-002
 *
 * Validates condition matching, compound AND/OR logic, cooldown handling,
 * metric extraction for all 8 metrics, and lookahead window filtering.
 *
 * The Deno Edge Function in supabase/functions/evaluate-alerts/index.ts
 * cannot be imported directly in a Node/Jest environment (it imports from
 * https://esm.sh and uses Deno APIs). These are pure logic tests — we
 * re-implement the pure functions here and assert their behavior.
 * The re-implementations MUST stay in lockstep with the edge function.
 */

// ── Ported pure logic (must match supabase/functions/evaluate-alerts/index.ts) ──

interface AlertCondition {
  metric: string;
  operator: string;
  value: number;
  unit?: string;
}

interface AlertRule {
  id: string;
  user_id: string;
  location_id: string;
  name: string;
  conditions: AlertCondition[];
  logical_operator: 'AND' | 'OR';
  lookahead_hours: number;
  polling_interval_hours: number;
  cooldown_hours: number;
  is_active: boolean;
  last_triggered_at: string | null;
}

interface HourlyForecast {
  time: string[];
  temperature_2m: number[];
  relative_humidity_2m: number[];
  precipitation_probability: number[];
  wind_speed_10m: number[];
  apparent_temperature: number[];
  uv_index: number[];
}

interface DailyForecast {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_probability_max: number[];
  wind_speed_10m_max: number[];
  uv_index_max: number[];
}

interface ForecastData {
  hourly: HourlyForecast;
  daily: DailyForecast;
}

function getMetricValues(
  metric: string,
  forecast: ForecastData,
  lookaheadHours: number,
): number[] {
  const now = new Date();
  const cutoff = new Date(now.getTime() + lookaheadHours * 60 * 60 * 1000);

  switch (metric) {
    case 'temperature_high':
      return forecast.daily.temperature_2m_max.filter((_, i) => {
        const d = new Date(forecast.daily.time[i]);
        return d >= now && d <= cutoff;
      });
    case 'temperature_low':
      return forecast.daily.temperature_2m_min.filter((_, i) => {
        const d = new Date(forecast.daily.time[i]);
        return d >= now && d <= cutoff;
      });
    case 'temperature_current':
      return forecast.hourly.temperature_2m.filter((_, i) => {
        const t = new Date(forecast.hourly.time[i]);
        return t >= now && t <= cutoff;
      });
    case 'precipitation_probability':
      if (lookaheadHours <= 24) {
        return forecast.hourly.precipitation_probability.filter((_, i) => {
          const t = new Date(forecast.hourly.time[i]);
          return t >= now && t <= cutoff;
        });
      }
      return forecast.daily.precipitation_probability_max.filter((_, i) => {
        const d = new Date(forecast.daily.time[i]);
        return d >= now && d <= cutoff;
      });
    case 'wind_speed':
      if (lookaheadHours <= 24) {
        return forecast.hourly.wind_speed_10m.filter((_, i) => {
          const t = new Date(forecast.hourly.time[i]);
          return t >= now && t <= cutoff;
        });
      }
      return forecast.daily.wind_speed_10m_max.filter((_, i) => {
        const d = new Date(forecast.daily.time[i]);
        return d >= now && d <= cutoff;
      });
    case 'humidity':
      return forecast.hourly.relative_humidity_2m.filter((_, i) => {
        const t = new Date(forecast.hourly.time[i]);
        return t >= now && t <= cutoff;
      });
    case 'feels_like':
      return forecast.hourly.apparent_temperature.filter((_, i) => {
        const t = new Date(forecast.hourly.time[i]);
        return t >= now && t <= cutoff;
      });
    case 'uv_index':
      return forecast.daily.uv_index_max.filter((_, i) => {
        const d = new Date(forecast.daily.time[i]);
        return d >= now && d <= cutoff;
      });
    default:
      return [];
  }
}

function compare(actual: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case 'gt':
      return actual > threshold;
    case 'gte':
      return actual >= threshold;
    case 'lt':
      return actual < threshold;
    case 'lte':
      return actual <= threshold;
    case 'eq':
      return actual === threshold;
    default:
      return false;
  }
}

function evaluateCondition(
  condition: AlertCondition,
  forecast: ForecastData,
  lookaheadHours: number,
): { met: boolean; matchedValue: number | null } {
  const values = getMetricValues(condition.metric, forecast, lookaheadHours);
  for (const v of values) {
    if (compare(v, condition.operator, condition.value)) {
      return { met: true, matchedValue: v };
    }
  }
  return { met: false, matchedValue: null };
}

function evaluateRule(
  rule: AlertRule,
  forecast: ForecastData,
): { triggered: boolean; details: Array<{ met: boolean; matchedValue: number | null }> } {
  const details = rule.conditions.map((c) => evaluateCondition(c, forecast, rule.lookahead_hours));
  const triggered =
    rule.logical_operator === 'AND' ? details.every((d) => d.met) : details.some((d) => d.met);
  return { triggered, details };
}

function isInCooldown(rule: AlertRule): boolean {
  if (!rule.last_triggered_at) return false;
  const lastTriggered = new Date(rule.last_triggered_at);
  const cooldownEnd = new Date(lastTriggered.getTime() + rule.cooldown_hours * 60 * 60 * 1000);
  return new Date() < cooldownEnd;
}

// ── Test helpers ───────────────────────────────────────────────

function hoursFromNow(h: number): string {
  return new Date(Date.now() + h * 60 * 60 * 1000).toISOString();
}

function buildForecast(overrides: Partial<ForecastData> = {}): ForecastData {
  const hourlyTimes = [
    hoursFromNow(1),
    hoursFromNow(6),
    hoursFromNow(12),
    hoursFromNow(24),
    hoursFromNow(48),
  ];
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
      ...overrides.hourly,
    },
    daily: {
      time: dailyTimes,
      temperature_2m_max: [75, 65, 50, 45],
      temperature_2m_min: [40, 30, 25, 20],
      precipitation_probability_max: [20, 80, 60, 40],
      wind_speed_10m_max: [15, 25, 35, 45],
      uv_index_max: [5, 7, 9, 3],
      ...overrides.daily,
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
      expect(isInCooldown(rule)).toBe(false);
    });

    it('returns true when current time is within cooldown window', () => {
      // FR-POLL-002: skip rules triggered within cooldown_hours
      const rule = buildRule({
        last_triggered_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
        cooldown_hours: 12,
      });
      expect(isInCooldown(rule)).toBe(true);
    });

    it('returns false when current time is past cooldown window', () => {
      const rule = buildRule({
        last_triggered_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24h ago
        cooldown_hours: 12,
      });
      expect(isInCooldown(rule)).toBe(false);
    });

    it('returns true right at cooldown boundary', () => {
      const rule = buildRule({
        last_triggered_at: new Date(Date.now() - 11.9 * 60 * 60 * 1000).toISOString(),
        cooldown_hours: 12,
      });
      expect(isInCooldown(rule)).toBe(true);
    });
  });
});
