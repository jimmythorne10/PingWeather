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

// Moon phase illumination — pure math, no API. Inline here so _shared/ stays
// a single-file verbatim copy without needing a second _shared/ module.
// Algorithm: Julian Date → days since known new moon (Jan 6 2000 UTC = JD 2451550.1)
// → modulo synodic period (29.53058867 days) → phase angle → illumination %.
const _KNOWN_NEW_MOON_JD = 2451550.1;
const _SYNODIC_PERIOD = 29.53058867;

function _toJulianDate(date: Date): number {
  const Y = date.getUTCFullYear();
  const M = date.getUTCMonth() + 1;
  const D =
    date.getUTCDate() +
    date.getUTCHours() / 24 +
    date.getUTCMinutes() / 1440 +
    date.getUTCSeconds() / 86400;
  const Y2 = M <= 2 ? Y - 1 : Y;
  const M2 = M <= 2 ? M + 12 : M;
  const A = Math.floor(Y2 / 100);
  const B = 2 - A + Math.floor(A / 4);
  return (
    Math.floor(365.25 * (Y2 + 4716)) +
    Math.floor(30.6001 * (M2 + 1)) +
    D + B - 1524.5
  );
}

function _getMoonIllumination(date: Date): number {
  const jd = _toJulianDate(date);
  const daysSinceNew = jd - _KNOWN_NEW_MOON_JD;
  const cyclePos = ((daysSinceNew % _SYNODIC_PERIOD) + _SYNODIC_PERIOD) % _SYNODIC_PERIOD;
  const phaseRad = (cyclePos / _SYNODIC_PERIOD) * 2 * Math.PI;
  const illumination = ((1 - Math.cos(phaseRad)) / 2) * 100;
  return Math.max(0, Math.min(100, illumination));
}

function _getMoonIlluminationForDate(isoDate: string): number {
  const parsed = new Date(`${isoDate}T00:00:00.000Z`);
  if (isNaN(parsed.getTime())) return 0;
  return _getMoonIllumination(parsed);
}

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
  // New metrics — all optional so existing callers don't need to supply them
  precipitation?: number[];        // mm — hourly precipitation amount
  surface_pressure?: number[];     // hPa — barometric pressure at surface
  snowfall?: number[];             // cm — hourly snowfall
  snow_depth?: number[];           // cm — snow depth on ground
  soil_temperature_0cm?: number[]; // °F when temperature_unit=fahrenheit (Open-Meteo converts all temp vars)
  wind_gusts_10m?: number[];       // mph — wind gusts
  dew_point_2m?: number[];         // °F or °C — follows temperature_unit
  visibility?: number[];           // meters raw from API (convert to miles in getMetricValues)
  cloud_cover?: number[];          // % cloud cover
  wind_direction_10m?: number[];   // degrees 0-360 (0=N, 90=E, 180=S, 270=W)
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
  precipitation_sum?: number[]; // mm — daily total precipitation (fallback for precipitation_amount)
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

    // ── New metrics ─────────────────────────────────────────────────────────

    case 'precipitation_amount': {
      // Hourly precipitation (mm) for short windows (≤24h), daily sum for longer.
      // Mirrors the wind_speed / precipitation_probability dual-source pattern.
      if (lookaheadHours <= 24) {
        if (!forecast.hourly.precipitation) return [];
        return forecast.hourly.precipitation.filter((_, i) => {
          const time = new Date(forecast.hourly.time[i]);
          return time >= now && time <= cutoff;
        });
      }
      if (!forecast.daily.precipitation_sum) return [];
      return forecast.daily.precipitation_sum.filter((_, i) => {
        const date = new Date(forecast.daily.time[i]);
        return date >= todayUtc && date <= cutoff;
      });
    }

    case 'barometric_pressure': {
      // Hourly surface pressure (hPa). No daily fallback — pressure is only
      // meaningful at sub-daily resolution for alert purposes.
      if (!forecast.hourly.surface_pressure) return [];
      return forecast.hourly.surface_pressure.filter((_, i) => {
        const time = new Date(forecast.hourly.time[i]);
        return time >= now && time <= cutoff;
      });
    }

    case 'snowfall': {
      // Hourly snowfall (cm).
      if (!forecast.hourly.snowfall) return [];
      return forecast.hourly.snowfall.filter((_, i) => {
        const time = new Date(forecast.hourly.time[i]);
        return time >= now && time <= cutoff;
      });
    }

    case 'snow_depth': {
      // Hourly snow depth (cm) on the ground.
      if (!forecast.hourly.snow_depth) return [];
      return forecast.hourly.snow_depth.filter((_, i) => {
        const time = new Date(forecast.hourly.time[i]);
        return time >= now && time <= cutoff;
      });
    }

    case 'soil_temperature': {
      // Hourly soil temperature at 0 cm depth (°C).
      if (!forecast.hourly.soil_temperature_0cm) return [];
      return forecast.hourly.soil_temperature_0cm.filter((_, i) => {
        const time = new Date(forecast.hourly.time[i]);
        return time >= now && time <= cutoff;
      });
    }

    case 'weather_code': {
      // Hourly WMO weather code (integer). Existing operators work numerically:
      // weather_code >= 95 = any thunderstorm.
      if (!forecast.hourly.weather_code) return [];
      return forecast.hourly.weather_code.filter((_, i) => {
        const time = new Date(forecast.hourly.time[i]);
        return time >= now && time <= cutoff;
      });
    }

    case 'moon_phase': {
      // Pure math — no API field. Returns illumination % for each day in the
      // daily time array that falls within the lookahead window.
      // Uses the daily.time array as the time axis (one value per calendar day).
      return forecast.daily.time
        .filter((dateStr) => {
          const date = new Date(dateStr);
          return date >= todayUtc && date <= cutoff;
        })
        .map((dateStr) => _getMoonIlluminationForDate(dateStr));
    }

    case 'wind_gusts': {
      // Hourly wind gusts (mph) from wind_gusts_10m.
      if (!forecast.hourly.wind_gusts_10m) return [];
      return forecast.hourly.wind_gusts_10m.filter((_, i) => {
        const time = new Date(forecast.hourly.time[i]);
        return time >= now && time <= cutoff;
      });
    }

    case 'dew_point': {
      // Hourly dew point temperature (°F or °C, follows temperature_unit).
      if (!forecast.hourly.dew_point_2m) return [];
      return forecast.hourly.dew_point_2m.filter((_, i) => {
        const time = new Date(forecast.hourly.time[i]);
        return time >= now && time <= cutoff;
      });
    }

    case 'visibility': {
      // Hourly visibility — Open-Meteo returns raw meters. Convert to miles
      // for storage and comparison (US-first: 1 mile = 1609.34 m).
      if (!forecast.hourly.visibility) return [];
      return forecast.hourly.visibility
        .filter((_, i) => {
          const time = new Date(forecast.hourly.time[i]);
          return time >= now && time <= cutoff;
        })
        .map((meters) => meters / 1609.34);
    }

    case 'cloud_cover': {
      // Hourly cloud cover (%).
      if (!forecast.hourly.cloud_cover) return [];
      return forecast.hourly.cloud_cover.filter((_, i) => {
        const time = new Date(forecast.hourly.time[i]);
        return time >= now && time <= cutoff;
      });
    }

    case 'wind_direction': {
      // Hourly wind direction (degrees, 0-360). Used with the from_bearing operator.
      if (!forecast.hourly.wind_direction_10m) return [];
      return forecast.hourly.wind_direction_10m.filter((_, i) => {
        const time = new Date(forecast.hourly.time[i]);
        return time >= now && time <= cutoff;
      });
    }

    case 'pressure_tendency': {
      // Derived metric: change in surface pressure over the lookahead window.
      // last_in_window - first_in_window:
      //   positive = rising pressure (use 'gt')
      //   negative = falling pressure (use 'lt')
      if (!forecast.hourly.surface_pressure) return [];
      const inWindow = forecast.hourly.surface_pressure.filter((_, i) => {
        const time = new Date(forecast.hourly.time[i]);
        return time >= now && time <= cutoff;
      });
      if (inWindow.length < 2) return [];
      return [inWindow[inWindow.length - 1] - inWindow[0]];
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

    // ── New metrics ─────────────────────────────────────────────────────────

    case 'precipitation_amount': {
      if (lookaheadHours <= 24) {
        if (!forecast.hourly.precipitation) return [];
        return forecast.hourly.precipitation
          .map((value, i) => ({ value, time: forecast.hourly.time[i] }))
          .filter(({ time }) => {
            const t = new Date(time);
            return t >= now && t <= cutoff;
          });
      }
      if (!forecast.daily.precipitation_sum) return [];
      return forecast.daily.precipitation_sum
        .map((value, i) => ({ value, time: forecast.daily.time[i] }))
        .filter(({ time }) => {
          const date = new Date(time);
          return date >= todayUtc && date <= cutoff;
        });
    }

    case 'barometric_pressure': {
      if (!forecast.hourly.surface_pressure) return [];
      return forecast.hourly.surface_pressure
        .map((value, i) => ({ value, time: forecast.hourly.time[i] }))
        .filter(({ time }) => {
          const t = new Date(time);
          return t >= now && t <= cutoff;
        });
    }

    case 'snowfall': {
      if (!forecast.hourly.snowfall) return [];
      return forecast.hourly.snowfall
        .map((value, i) => ({ value, time: forecast.hourly.time[i] }))
        .filter(({ time }) => {
          const t = new Date(time);
          return t >= now && t <= cutoff;
        });
    }

    case 'snow_depth': {
      if (!forecast.hourly.snow_depth) return [];
      return forecast.hourly.snow_depth
        .map((value, i) => ({ value, time: forecast.hourly.time[i] }))
        .filter(({ time }) => {
          const t = new Date(time);
          return t >= now && t <= cutoff;
        });
    }

    case 'soil_temperature': {
      if (!forecast.hourly.soil_temperature_0cm) return [];
      return forecast.hourly.soil_temperature_0cm
        .map((value, i) => ({ value, time: forecast.hourly.time[i] }))
        .filter(({ time }) => {
          const t = new Date(time);
          return t >= now && t <= cutoff;
        });
    }

    case 'weather_code': {
      if (!forecast.hourly.weather_code) return [];
      return forecast.hourly.weather_code
        .map((value, i) => ({ value, time: forecast.hourly.time[i] }))
        .filter(({ time }) => {
          const t = new Date(time);
          return t >= now && t <= cutoff;
        });
    }

    case 'moon_phase': {
      // moon_phase uses daily dates as the time axis.
      return forecast.daily.time
        .filter((dateStr) => {
          const date = new Date(dateStr);
          return date >= todayUtc && date <= cutoff;
        })
        .map((dateStr) => ({
          value: _getMoonIlluminationForDate(dateStr),
          time: dateStr,
        }));
    }

    case 'wind_gusts': {
      if (!forecast.hourly.wind_gusts_10m) return [];
      return forecast.hourly.wind_gusts_10m
        .map((value, i) => ({ value, time: forecast.hourly.time[i] }))
        .filter(({ time }) => {
          const t = new Date(time);
          return t >= now && t <= cutoff;
        });
    }

    case 'dew_point': {
      if (!forecast.hourly.dew_point_2m) return [];
      return forecast.hourly.dew_point_2m
        .map((value, i) => ({ value, time: forecast.hourly.time[i] }))
        .filter(({ time }) => {
          const t = new Date(time);
          return t >= now && t <= cutoff;
        });
    }

    case 'visibility': {
      // Convert meters → miles before returning.
      if (!forecast.hourly.visibility) return [];
      return forecast.hourly.visibility
        .map((meters, i) => ({ value: meters / 1609.34, time: forecast.hourly.time[i] }))
        .filter(({ time }) => {
          const t = new Date(time);
          return t >= now && t <= cutoff;
        });
    }

    case 'cloud_cover': {
      if (!forecast.hourly.cloud_cover) return [];
      return forecast.hourly.cloud_cover
        .map((value, i) => ({ value, time: forecast.hourly.time[i] }))
        .filter(({ time }) => {
          const t = new Date(time);
          return t >= now && t <= cutoff;
        });
    }

    case 'wind_direction': {
      if (!forecast.hourly.wind_direction_10m) return [];
      return forecast.hourly.wind_direction_10m
        .map((value, i) => ({ value, time: forecast.hourly.time[i] }))
        .filter(({ time }) => {
          const t = new Date(time);
          return t >= now && t <= cutoff;
        });
    }

    case 'pressure_tendency': {
      if (!forecast.hourly.surface_pressure) return [];
      const inWindow = forecast.hourly.surface_pressure
        .map((value, i) => ({ value, time: forecast.hourly.time[i] }))
        .filter(({ time }) => {
          const t = new Date(time);
          return t >= now && t <= cutoff;
        });
      if (inWindow.length < 2) return [];
      const tendency = inWindow[inWindow.length - 1].value - inWindow[0].value;
      // Use the time of the last value in window as the matchedTime.
      return [{ value: tendency, time: inWindow[inWindow.length - 1].time }];
    }

    default:
      return [];
  }
}

// ── Comparison ───────────────────────────────────────────────────────────────

export function compare(
  actual: number,
  operator: string,
  threshold: number,
  tolerance?: number
): boolean {
  switch (operator) {
    case 'gt':  return actual > threshold;
    case 'gte': return actual >= threshold;
    case 'lt':  return actual < threshold;
    case 'lte': return actual <= threshold;
    case 'eq':  return actual === threshold;
    case 'from_bearing': {
      // Circular shortest-arc distance between `actual` (wind direction) and
      // `threshold` (target bearing). Both are in degrees [0, 360).
      //   diff = ((actual - threshold) % 360 + 360) % 360   → clockwise angle 0–359
      //   angleDiff = diff <= 180 ? diff : 360 - diff        → shortest arc 0–180
      //   triggered = angleDiff <= tolerance (default 0 = exact match only)
      const tol = tolerance ?? 0;
      const diff = ((actual - threshold) % 360 + 360) % 360;
      const angleDiff = diff <= 180 ? diff : 360 - diff;
      return angleDiff <= tol;
    }
    default:    return false;
  }
}

// ── Condition evaluation ─────────────────────────────────────────────────────
// A condition is met if ANY value within the lookahead window matches.

// Open-Meteo always returns surface_pressure in hPa. When a rule stores a
// threshold in inHg, convert the raw hPa value before comparing.
const INHG_PER_HPA = 1 / 33.8639;
const PRESSURE_METRICS = new Set(['barometric_pressure', 'pressure_tendency']);

function applyPressureUnit(value: number, metric: string, unit: string | undefined): number {
  if (PRESSURE_METRICS.has(metric) && unit === 'inHg') {
    return value * INHG_PER_HPA;
  }
  return value;
}

export function evaluateCondition(
  condition: AlertCondition,
  forecast: ForecastData,
  lookaheadHours: number
): { met: boolean; matchedValue: number | null; matchedTime: string | null } {
  const entries = getMetricEntries(condition.metric, forecast, lookaheadHours);

  for (const { value, time } of entries) {
    const converted = applyPressureUnit(value, condition.metric, condition.unit);
    if (compare(converted, condition.operator, condition.value, (condition as { tolerance?: number }).tolerance)) {
      return { met: true, matchedValue: converted, matchedTime: time };
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

// ── WMO weather code → emoji ─────────────────────────────────────────────────
// Maps WMO interpretation codes to a representative emoji for push notification
// bodies. Used by poll-weather to prepend a visual cue to the alert text.

export function weatherCodeToEmoji(code: number): string {
  if (code <= 1) return '☀️';
  if (code <= 3) return '⛅';
  if (code <= 9) return '🌫️';
  if (code <= 19) return '🌧️';
  if (code <= 29) return '🌨️';
  if (code <= 39) return '🌫️';
  if (code <= 49) return '🌫️';
  if (code <= 59) return '🌦️';
  if (code <= 69) return '🌧️';
  if (code <= 79) return '❄️';
  if (code <= 84) return '🌦️';
  if (code <= 94) return '🌨️';
  if (code <= 99) return '⛈️';
  return '🌡️';
}

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
    // New metrics
    precipitation_amount: 'Precipitation',
    barometric_pressure: 'Barometric pressure',
    snowfall: 'Snowfall',
    snow_depth: 'Snow depth',
    soil_temperature: 'Soil temperature',
    weather_code: 'Weather code',
    moon_phase: 'Moon illumination',
    wind_gusts: 'Wind gusts',
    dew_point: 'Dew point',
    visibility: 'Visibility',
    cloud_cover: 'Cloud cover',
    wind_direction: 'Wind direction',
    pressure_tendency: 'Pressure tendency',
  };

  const operatorLabels: Record<string, string> = {
    gt: 'above',
    gte: 'at or above',
    lt: 'below',
    lte: 'at or below',
    eq: 'exactly',
    from_bearing: 'from bearing',
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
