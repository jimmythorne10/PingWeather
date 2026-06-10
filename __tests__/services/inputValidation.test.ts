// __tests__/services/inputValidation.test.ts
//
// TDD for SEC-002: input validation / allowlists for get-forecast and
// evaluate-alerts Edge Functions.
// The helpers under test live at:
//   supabase/functions/get-forecast/validation.ts
//   supabase/functions/evaluate-alerts/validation.ts

import {
  validateHourlyVars,
  validateDailyVars,
  clampForecastDays,
  validateTemperatureUnit,
  validateWindSpeedUnit,
  validatePrecipitationUnit,
  type ValidationResult,
} from "../../supabase/functions/get-forecast/validation";

import {
  validateEvaluateAlertsBody,
  type EvaluateAlertsBodyValidation,
} from "../../supabase/functions/evaluate-alerts/validation";

// ── get-forecast: hourly variable allowlist ────────────────────────────────

describe("validateHourlyVars", () => {
  test("accepts all known hourly variables (the default list)", () => {
    const known = [
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
    ];
    const result: ValidationResult = validateHourlyVars(known);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test("rejects an unknown hourly variable name", () => {
    const result: ValidationResult = validateHourlyVars(["temperature_2m", "hacker_field"]);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/hacker_field/);
  });

  test("rejects an empty array (caller should fall back to defaults)", () => {
    // Empty arrays should be rejected so callers always supply the full list or nothing
    // (the Edge Function uses defaults when the array is empty — it should not
    // validate an empty array as "ok")
    const result: ValidationResult = validateHourlyVars([]);
    expect(result.valid).toBe(false);
  });

  test("rejects non-string values in the array", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: ValidationResult = validateHourlyVars(["temperature_2m", 42 as any]);
    expect(result.valid).toBe(false);
  });
});

// ── get-forecast: daily variable allowlist ────────────────────────────────

describe("validateDailyVars", () => {
  test("accepts all known daily variables (the default list, including BUG-007 fields)", () => {
    const known = [
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
    ];
    const result: ValidationResult = validateDailyVars(known);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test("rejects an unknown daily variable name", () => {
    const result: ValidationResult = validateDailyVars(["temperature_2m_max", "evil_param"]);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/evil_param/);
  });

  test("rejects an empty array", () => {
    const result: ValidationResult = validateDailyVars([]);
    expect(result.valid).toBe(false);
  });
});

// ── get-forecast: forecast_days clamp/reject ──────────────────────────────

describe("clampForecastDays", () => {
  test("returns the value unchanged for valid range 1-16", () => {
    expect(clampForecastDays(1)).toEqual({ valid: true, value: 1 });
    expect(clampForecastDays(7)).toEqual({ valid: true, value: 7 });
    expect(clampForecastDays(16)).toEqual({ valid: true, value: 16 });
  });

  test("rejects -1 (below minimum)", () => {
    const result = clampForecastDays(-1);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  test("rejects 0 (below minimum)", () => {
    const result = clampForecastDays(0);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  test("rejects 17 (above maximum)", () => {
    const result = clampForecastDays(17);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  test("rejects 99 (well above maximum)", () => {
    const result = clampForecastDays(99);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  test("rejects non-integer (float)", () => {
    const result = clampForecastDays(3.5);
    expect(result.valid).toBe(false);
  });

  test("rejects non-number (string cast)", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = clampForecastDays("7" as any);
    expect(result.valid).toBe(false);
  });
});

// ── get-forecast: temperature_unit allowlist ──────────────────────────────

describe("validateTemperatureUnit", () => {
  test("accepts celsius", () => {
    expect(validateTemperatureUnit("celsius").valid).toBe(true);
  });

  test("accepts fahrenheit", () => {
    expect(validateTemperatureUnit("fahrenheit").valid).toBe(true);
  });

  test("rejects foobar", () => {
    const result = validateTemperatureUnit("foobar");
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  test("rejects empty string", () => {
    expect(validateTemperatureUnit("").valid).toBe(false);
  });
});

// ── get-forecast: wind_speed_unit allowlist ───────────────────────────────

describe("validateWindSpeedUnit", () => {
  test("accepts mph", () => {
    expect(validateWindSpeedUnit("mph").valid).toBe(true);
  });

  test("accepts kmh", () => {
    expect(validateWindSpeedUnit("kmh").valid).toBe(true);
  });

  test("accepts ms", () => {
    expect(validateWindSpeedUnit("ms").valid).toBe(true);
  });

  test("accepts kn", () => {
    expect(validateWindSpeedUnit("kn").valid).toBe(true);
  });

  test("rejects foobar", () => {
    const result = validateWindSpeedUnit("foobar");
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ── get-forecast: precipitation_unit allowlist ────────────────────────────

describe("validatePrecipitationUnit", () => {
  test("accepts mm", () => {
    expect(validatePrecipitationUnit("mm").valid).toBe(true);
  });

  test("accepts inch", () => {
    expect(validatePrecipitationUnit("inch").valid).toBe(true);
  });

  test("rejects foobar", () => {
    const result = validatePrecipitationUnit("foobar");
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ── evaluate-alerts: body guard ───────────────────────────────────────────

describe("validateEvaluateAlertsBody", () => {
  const validRule = { id: "r1", user_id: "u1", name: "test", is_active: true };
  const validForecast = {
    hourly: { time: [], temperature_2m: [] },
    daily: { time: [], temperature_2m_max: [] },
  };

  test("accepts a valid body with rules array and forecast with hourly+daily", () => {
    const result: EvaluateAlertsBodyValidation = validateEvaluateAlertsBody({
      rules: [validRule],
      forecast: validForecast,
      location_name: "Test Location",
    });
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test("rejects when rules is null", () => {
    const result = validateEvaluateAlertsBody({
      rules: null,
      forecast: validForecast,
      location_name: "Test Location",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  test("rejects when rules is not an array (object instead)", () => {
    const result = validateEvaluateAlertsBody({
      rules: { id: "r1" },
      forecast: validForecast,
      location_name: "Test Location",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  test("rejects when forecast.hourly is missing", () => {
    const result = validateEvaluateAlertsBody({
      rules: [validRule],
      forecast: { daily: validForecast.daily },
      location_name: "Test Location",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  test("rejects when forecast.daily is missing", () => {
    const result = validateEvaluateAlertsBody({
      rules: [validRule],
      forecast: { hourly: validForecast.hourly },
      location_name: "Test Location",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  test("rejects when forecast is null", () => {
    const result = validateEvaluateAlertsBody({
      rules: [validRule],
      forecast: null,
      location_name: "Test Location",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  test("rejects when forecast is entirely missing (undefined)", () => {
    const result = validateEvaluateAlertsBody({
      rules: [validRule],
      forecast: undefined,
      location_name: "Test Location",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  test("accepts an empty rules array (zero active rules is valid — evaluate returns zero results)", () => {
    const result = validateEvaluateAlertsBody({
      rules: [],
      forecast: validForecast,
      location_name: "Test Location",
    });
    expect(result.valid).toBe(true);
  });
});
