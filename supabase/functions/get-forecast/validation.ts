// supabase/functions/get-forecast/validation.ts
//
// Input validation helpers for the get-forecast Edge Function.
//
// Importable in both Deno (Edge Function) and Node 18+ (Jest logic tests).
// No Deno-specific globals — pure TypeScript.

/** Shared result type for all validators in this file. */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/** Result variant that also carries the validated numeric value when valid. */
export interface ClampResult extends ValidationResult {
  value?: number;
}

// ── Allowlists ────────────────────────────────────────────────────────────────
//
// These lists mirror exactly the defaultHourly / defaultDaily arrays in
// index.ts (BUG-007 fields moonrise/moonset included).  A client-supplied
// variable that is not in the allowlist is rejected with a 400 rather than
// forwarded to the Open-Meteo API.

export const HOURLY_ALLOWLIST: ReadonlySet<string> = new Set([
  "temperature_2m",
  "relative_humidity_2m",
  "precipitation_probability",
  "wind_speed_10m",
  "apparent_temperature",
  "uv_index",
  "weather_code",
  "precipitation",
  "surface_pressure",
  "snowfall",
  "snow_depth",
  "soil_temperature_0cm",
  "wind_gusts_10m",
  "dew_point_2m",
  "visibility",
  "cloud_cover",
  "wind_direction_10m",
]);

export const DAILY_ALLOWLIST: ReadonlySet<string> = new Set([
  "temperature_2m_max",
  "temperature_2m_min",
  "precipitation_probability_max",
  "wind_speed_10m_max",
  "wind_direction_10m_dominant",
  "uv_index_max",
  "weather_code",
  "precipitation_sum",
  "sunrise",
  "sunset",
  "snowfall_sum",
]);

// ── Validators ────────────────────────────────────────────────────────────────

/**
 * Validate a client-supplied hourly variable array against the allowlist.
 *
 * An empty array is rejected — the caller must either omit the field (and
 * the Edge Function will use defaults) or supply a non-empty validated list.
 */
export function validateHourlyVars(vars: unknown[]): ValidationResult {
  if (vars.length === 0) {
    return { valid: false, error: "hourly array must not be empty; omit the field to use defaults" };
  }
  for (const v of vars) {
    if (typeof v !== "string") {
      return { valid: false, error: `hourly variables must be strings; got ${typeof v}` };
    }
    if (!HOURLY_ALLOWLIST.has(v)) {
      return { valid: false, error: `unknown hourly variable: "${v}"` };
    }
  }
  return { valid: true };
}

/**
 * Validate a client-supplied daily variable array against the allowlist.
 *
 * Same empty-array rule as hourly.
 */
export function validateDailyVars(vars: unknown[]): ValidationResult {
  if (vars.length === 0) {
    return { valid: false, error: "daily array must not be empty; omit the field to use defaults" };
  }
  for (const v of vars) {
    if (typeof v !== "string") {
      return { valid: false, error: `daily variables must be strings; got ${typeof v}` };
    }
    if (!DAILY_ALLOWLIST.has(v)) {
      return { valid: false, error: `unknown daily variable: "${v}"` };
    }
  }
  return { valid: true };
}

/**
 * Validate and return forecast_days.
 *
 * Valid range: 1–16 (integer).  Non-integers and out-of-range values are
 * rejected with a descriptive error rather than silently clamped, so the
 * client learns immediately when it sends a bad value.
 */
export function clampForecastDays(value: unknown): ClampResult {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { valid: false, error: "forecast_days must be a number" };
  }
  if (!Number.isInteger(value)) {
    return { valid: false, error: "forecast_days must be an integer" };
  }
  if (value < 1 || value > 16) {
    return { valid: false, error: `forecast_days must be between 1 and 16; got ${value}` };
  }
  return { valid: true, value };
}

/** Valid temperature_unit values accepted by Open-Meteo. */
export const TEMPERATURE_UNITS: ReadonlySet<string> = new Set(["celsius", "fahrenheit"]);

/** Validate temperature_unit. */
export function validateTemperatureUnit(unit: unknown): ValidationResult {
  if (typeof unit !== "string" || !TEMPERATURE_UNITS.has(unit)) {
    return {
      valid: false,
      error: `temperature_unit must be one of: ${[...TEMPERATURE_UNITS].join(", ")}; got "${unit}"`,
    };
  }
  return { valid: true };
}

/** Valid wind_speed_unit values accepted by Open-Meteo. */
export const WIND_SPEED_UNITS: ReadonlySet<string> = new Set(["mph", "kmh", "ms", "kn"]);

/** Validate wind_speed_unit. */
export function validateWindSpeedUnit(unit: unknown): ValidationResult {
  if (typeof unit !== "string" || !WIND_SPEED_UNITS.has(unit)) {
    return {
      valid: false,
      error: `wind_speed_unit must be one of: ${[...WIND_SPEED_UNITS].join(", ")}; got "${unit}"`,
    };
  }
  return { valid: true };
}

/** Valid precipitation_unit values accepted by Open-Meteo. */
export const PRECIPITATION_UNITS: ReadonlySet<string> = new Set(["mm", "inch"]);

/** Validate precipitation_unit. */
export function validatePrecipitationUnit(unit: unknown): ValidationResult {
  if (typeof unit !== "string" || !PRECIPITATION_UNITS.has(unit)) {
    return {
      valid: false,
      error: `precipitation_unit must be one of: ${[...PRECIPITATION_UNITS].join(", ")}; got "${unit}"`,
    };
  }
  return { valid: true };
}
