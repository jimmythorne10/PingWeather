// ─────────────────────────────────────────────────────────────────────────────
// weatherEngine.ts — Pure evaluation helpers shared between Edge Functions and
// Jest tests.
//
// IMPORTANT: Zero Deno imports, zero Supabase imports. This file must be
// importable from both the Deno Edge Function runtime (via a relative path) and
// from Jest (node env) without any shims. Keep it that way.
//
// Deno Edge Functions import this via:
//   import { ... } from "../../src/utils/weatherEngine.ts";
//
// Jest tests import this via the normal TypeScript resolver:
//   import { ... } from '../../src/utils/weatherEngine';
// ─────────────────────────────────────────────────────────────────────────────

// ── Shared interfaces ─────────────────────────────────────────────────────────
// These must stay in sync with the Edge Function runtime types. The shared
// source-of-truth lives here; Edge Functions reference this file directly.

export interface AlertCondition {
  metric: string;
  operator: string;
  value: number;
  unit?: string;
}

export interface AlertRule {
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

// These match the Open-Meteo response shape used by poll-weather's fetch.
// The evaluate-alerts function receives forecast data in this shape.
// NOTE: weather_code and wind_direction_10m_dominant are included here because
// the get-forecast proxy passes them to the client — poll-weather does NOT need
// them for alert evaluation, but they must not be stripped server-side.
export interface HourlyForecast {
  time: string[];
  temperature_2m: number[];
  relative_humidity_2m: number[];
  precipitation_probability: number[];
  wind_speed_10m: number[];
  apparent_temperature: number[];
  uv_index: number[];
  weather_code?: number[];
}

export interface DailyForecast {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_probability_max: number[];
  wind_speed_10m_max: number[];
  uv_index_max: number[];
  wind_direction_10m_dominant?: number[];
  weather_code?: number[];
}

export interface ForecastData {
  hourly: HourlyForecast;
  daily: DailyForecast;
}

export interface EvaluationResult {
  rule: AlertRule;
  triggered: boolean;
  summary: string;
  matchDetails: Array<{
    metric: string;
    operator: string;
    threshold: number;
    matchedValue: number | null;
    matchedTime?: string | null;
    met: boolean;
  }>;
}

// ── Grid-square key ──────────────────────────────────────────────────────────
// Rounds lat/lon to 0.1° (~11 km) to cluster nearby users into a single API
// call. poll-weather uses this as the forecast_cache.grid_key, and send-digest
// uses it for the cache lookup. Both must produce identical strings or the
// cache miss causes a redundant Open-Meteo call.

export function gridKey(lat: number, lon: number): string {
  return `${Math.round(lat * 10) / 10},${Math.round(lon * 10) / 10}`;
}

// ── Timezone extraction ──────────────────────────────────────────────────────
// Open-Meteo returns "timezone" (IANA string, e.g. "America/Chicago") in the
// forecast response when timezone=auto is sent. Used to backfill locations
// that have timezone: null (manual coordinate entry, geocoding without tz).

export function extractTimezone(
  forecast: Record<string, unknown> | null
): string | null {
  if (!forecast) return null;
  const tz = forecast['timezone'];
  if (typeof tz !== 'string' || !tz) return null;
  return tz;
}

// ── Metric value extraction ──────────────────────────────────────────────────
// Returns all relevant numeric values within the rule's lookahead window.
//
// THE DAILY DATE BUG FIX:
// Open-Meteo daily `time` arrays contain "YYYY-MM-DD" strings. Parsing them
// with `new Date("2026-04-24")` yields UTC midnight (2026-04-24T00:00:00Z).
// If `now` is 14:00 UTC, then UTC midnight < 14:00 UTC, so today's record is
// EXCLUDED when comparing `date >= now`. This silently drops today's high/low
// temperature and makes those daily metrics impossible to trigger until the
// next UTC day.
//
// Fix: for daily metrics, snap `now` to UTC midnight so today is always
// included. Hourly metrics are unaffected — their timestamps include hours.

export function getMetricValues(
  metric: string,
  forecast: ForecastData,
  lookaheadHours: number
): number[] {
  const now = new Date();
  const cutoff = new Date(now.getTime() + lookaheadHours * 60 * 60 * 1000);

  // For daily records: snap to UTC midnight so today's record is included.
  // "2026-04-24" → new Date("2026-04-24T00:00:00.000Z") = UTC midnight = today.
  const todayUtc = new Date(now.toISOString().slice(0, 10) + 'T00:00:00.000Z');

  switch (metric) {
    case 'temperature_high': {
      return forecast.daily.temperature_2m_max.filter((_, i) => {
        const date = new Date(forecast.daily.time[i]);
        return date >= todayUtc && date <= cutoff;
      });
    }
    case 'temperature_low': {
      return forecast.daily.temperature_2m_min.filter((_, i) => {
        const date = new Date(forecast.daily.time[i]);
        return date >= todayUtc && date <= cutoff;
      });
    }
    case 'temperature_current': {
      return forecast.hourly.temperature_2m.filter((_, i) => {
        const time = new Date(forecast.hourly.time[i]);
        return time >= now && time <= cutoff;
      });
    }
    case 'precipitation_probability': {
      // Hourly for short windows (≤24h), daily max for longer windows.
      if (lookaheadHours <= 24) {
        return forecast.hourly.precipitation_probability.filter((_, i) => {
          const time = new Date(forecast.hourly.time[i]);
          return time >= now && time <= cutoff;
        });
      }
      return forecast.daily.precipitation_probability_max.filter((_, i) => {
        const date = new Date(forecast.daily.time[i]);
        return date >= todayUtc && date <= cutoff;
      });
    }
    case 'wind_speed': {
      if (lookaheadHours <= 24) {
        return forecast.hourly.wind_speed_10m.filter((_, i) => {
          const time = new Date(forecast.hourly.time[i]);
          return time >= now && time <= cutoff;
        });
      }
      return forecast.daily.wind_speed_10m_max.filter((_, i) => {
        const date = new Date(forecast.daily.time[i]);
        return date >= todayUtc && date <= cutoff;
      });
    }
    case 'humidity': {
      return forecast.hourly.relative_humidity_2m.filter((_, i) => {
        const time = new Date(forecast.hourly.time[i]);
        return time >= now && time <= cutoff;
      });
    }
    case 'feels_like': {
      return forecast.hourly.apparent_temperature.filter((_, i) => {
        const time = new Date(forecast.hourly.time[i]);
        return time >= now && time <= cutoff;
      });
    }
    case 'uv_index': {
      return forecast.daily.uv_index_max.filter((_, i) => {
        const date = new Date(forecast.daily.time[i]);
        return date >= todayUtc && date <= cutoff;
      });
    }
    default:
      return [];
  }
}

// ── Metric entry extraction (value + time) ───────────────────────────────────
// Internal helper used by evaluateCondition. Returns {value, time} pairs so
// that the first matching value can report WHICH day or hour triggered the
// alert. Not exported — callers that only need values should use getMetricValues.
//
// The `time` field mirrors what the forecast arrays contain:
//   daily metrics  → "YYYY-MM-DD" string (e.g. "2026-05-02")
//   hourly metrics → ISO timestamp string (e.g. "2026-05-02T14:00:00Z")

function getMetricEntries(
  metric: string,
  forecast: ForecastData,
  lookaheadHours: number
): Array<{ value: number; time: string }> {
  const now = new Date();
  const cutoff = new Date(now.getTime() + lookaheadHours * 60 * 60 * 1000);
  const todayUtc = new Date(now.toISOString().slice(0, 10) + 'T00:00:00.000Z');

  switch (metric) {
    case 'temperature_high': {
      return forecast.daily.temperature_2m_max
        .map((value, i) => ({ value, time: forecast.daily.time[i] }))
        .filter(({ time }) => {
          const date = new Date(time);
          return date >= todayUtc && date <= cutoff;
        });
    }
    case 'temperature_low': {
      return forecast.daily.temperature_2m_min
        .map((value, i) => ({ value, time: forecast.daily.time[i] }))
        .filter(({ time }) => {
          const date = new Date(time);
          return date >= todayUtc && date <= cutoff;
        });
    }
    case 'temperature_current': {
      return forecast.hourly.temperature_2m
        .map((value, i) => ({ value, time: forecast.hourly.time[i] }))
        .filter(({ time }) => {
          const t = new Date(time);
          return t >= now && t <= cutoff;
        });
    }
    case 'precipitation_probability': {
      if (lookaheadHours <= 24) {
        return forecast.hourly.precipitation_probability
          .map((value, i) => ({ value, time: forecast.hourly.time[i] }))
          .filter(({ time }) => {
            const t = new Date(time);
            return t >= now && t <= cutoff;
          });
      }
      return forecast.daily.precipitation_probability_max
        .map((value, i) => ({ value, time: forecast.daily.time[i] }))
        .filter(({ time }) => {
          const date = new Date(time);
          return date >= todayUtc && date <= cutoff;
        });
    }
    case 'wind_speed': {
      if (lookaheadHours <= 24) {
        return forecast.hourly.wind_speed_10m
          .map((value, i) => ({ value, time: forecast.hourly.time[i] }))
          .filter(({ time }) => {
            const t = new Date(time);
            return t >= now && t <= cutoff;
          });
      }
      return forecast.daily.wind_speed_10m_max
        .map((value, i) => ({ value, time: forecast.daily.time[i] }))
        .filter(({ time }) => {
          const date = new Date(time);
          return date >= todayUtc && date <= cutoff;
        });
    }
    case 'humidity': {
      return forecast.hourly.relative_humidity_2m
        .map((value, i) => ({ value, time: forecast.hourly.time[i] }))
        .filter(({ time }) => {
          const t = new Date(time);
          return t >= now && t <= cutoff;
        });
    }
    case 'feels_like': {
      return forecast.hourly.apparent_temperature
        .map((value, i) => ({ value, time: forecast.hourly.time[i] }))
        .filter(({ time }) => {
          const t = new Date(time);
          return t >= now && t <= cutoff;
        });
    }
    case 'uv_index': {
      return forecast.daily.uv_index_max
        .map((value, i) => ({ value, time: forecast.daily.time[i] }))
        .filter(({ time }) => {
          const date = new Date(time);
          return date >= todayUtc && date <= cutoff;
        });
    }
    default:
      return [];
  }
}

// ── Comparison ───────────────────────────────────────────────────────────────

export function compare(
  actual: number,
  operator: string,
  threshold: number
): boolean {
  switch (operator) {
    case 'gt':  return actual > threshold;
    case 'gte': return actual >= threshold;
    case 'lt':  return actual < threshold;
    case 'lte': return actual <= threshold;
    case 'eq':  return actual === threshold;
    default:    return false;
  }
}

// ── Condition evaluation ─────────────────────────────────────────────────────
// A condition is met if ANY value within the lookahead window matches.

export function evaluateCondition(
  condition: AlertCondition,
  forecast: ForecastData,
  lookaheadHours: number
): { met: boolean; matchedValue: number | null; matchedTime: string | null } {
  const entries = getMetricEntries(condition.metric, forecast, lookaheadHours);

  for (const { value, time } of entries) {
    if (compare(value, condition.operator, condition.value)) {
      return { met: true, matchedValue: value, matchedTime: time };
    }
  }

  return { met: false, matchedValue: null, matchedTime: null };
}

// ── Rule evaluation ──────────────────────────────────────────────────────────

export function evaluateRule(
  rule: AlertRule,
  forecast: ForecastData
): EvaluationResult {
  // Guard: a rule with no conditions can never trigger.
  if (rule.conditions.length === 0) {
    return {
      rule,
      triggered: false,
      summary: 'No conditions defined',
      matchDetails: [],
    };
  }

  const details = rule.conditions.map((condition) => {
    const result = evaluateCondition(condition, forecast, rule.lookahead_hours);
    return {
      metric: condition.metric,
      operator: condition.operator,
      threshold: condition.value,
      matchedValue: result.matchedValue,
      matchedTime: result.matchedTime,
      met: result.met,
    };
  });

  const triggered =
    rule.logical_operator === 'AND'
      ? details.every((d) => d.met)
      : details.some((d) => d.met);

  const metConditions = details.filter((d) => d.met);
  const summary = triggered
    ? metConditions
        .map((d) =>
          formatConditionSummary(d.metric, d.operator, d.threshold, d.matchedValue)
        )
        .join(rule.logical_operator === 'AND' ? ' and ' : ' or ')
    : 'No conditions met';

  return { rule, triggered, summary, matchDetails: details };
}

// ── Cooldown check ───────────────────────────────────────────────────────────
// A rule is in cooldown if last_triggered_at was set less than cooldown_hours
// ago. Prevents re-firing on the next poll if conditions are still met.

export function isInCooldown(rule: AlertRule, now: Date): boolean {
  if (!rule.last_triggered_at) return false;
  const lastTriggered = new Date(rule.last_triggered_at).getTime();
  const cooldownEnd = lastTriggered + rule.cooldown_hours * 60 * 60 * 1000;
  return now.getTime() < cooldownEnd;
}

// ── Condition summary formatter ───────────────────────────────────────────────

export function formatConditionSummary(
  metric: string,
  operator: string,
  threshold: number,
  matchedValue: number | null
): string {
  const metricLabels: Record<string, string> = {
    temperature_high: 'High temp',
    temperature_low: 'Low temp',
    temperature_current: 'Temperature',
    precipitation_probability: 'Rain chance',
    wind_speed: 'Wind speed',
    humidity: 'Humidity',
    feels_like: 'Feels like',
    uv_index: 'UV index',
  };

  const operatorLabels: Record<string, string> = {
    gt: 'above',
    gte: 'at or above',
    lt: 'below',
    lte: 'at or below',
    eq: 'exactly',
  };

  const label = metricLabels[metric] ?? metric;
  const op = operatorLabels[operator] ?? operator;
  const actual = matchedValue !== null ? ` (forecast: ${matchedValue})` : '';

  return `${label} ${op} ${threshold}${actual}`;
}

// ── Day label formatter ───────────────────────────────────────────────────────
// Converts a raw forecast time value to a human-readable day label for use in
// push notification bodies.
//
//   Daily metric time  → "YYYY-MM-DD"  → "Today" / "Tomorrow" / "Fri 5/2"
//   Hourly metric time → ISO timestamp → same labels based on the calendar date
//
// Returns null for null/undefined input or an unrecognised string — callers
// should fall back to the plain summary in that case.

export function formatMatchedDate(time: string | null | undefined): string | null {
  if (!time) return null;

  // Daily metric: "YYYY-MM-DD" (no time component)
  if (/^\d{4}-\d{2}-\d{2}$/.test(time)) {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    if (time === today) return 'Today';
    if (time === tomorrow) return 'Tomorrow';
    const [y, m, d] = time.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'numeric',
      day: 'numeric',
    });
  }

  // Hourly metric: ISO timestamp — extract the calendar date portion to compare
  const parsed = new Date(time);
  if (isNaN(parsed.getTime())) return null;
  const todayStr = new Date().toISOString().slice(0, 10);
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const dateStr = parsed.toISOString().slice(0, 10);
  if (dateStr === todayStr) return 'Today';
  if (dateStr === tomorrowStr) return 'Tomorrow';
  return parsed.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'numeric',
    day: 'numeric',
  });
}

// ── Batch concurrency helper ──────────────────────────────────────────────────
// Processes items in fixed-size batches. All items within a batch run
// concurrently via Promise.allSettled — a failure in one item never prevents
// the others from running, and never throws. The next batch starts only after
// the current batch settles.

export async function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}
