/**
 * Tests for temperature unit conversion (Fahrenheit ↔ Celsius) in evaluateCondition.
 *
 * poll-weather always fetches from Open-Meteo with temperature_unit=fahrenheit,
 * so all temperature values arrive as °F. When a rule is created with unit: 'celsius',
 * evaluateCondition must convert the raw °F value to °C before comparing against
 * the stored Celsius threshold.
 *
 * Without conversion, a threshold of 22°C (stored as 22) is compared against a
 * Fahrenheit value (e.g. 50°F), giving 50 >= 22 = true — a false positive at any
 * temperature above 22°F (-5.5°C), which is nearly always.
 *
 * Conversion: C = (F - 32) * 5/9
 *
 * Affected metrics: temperature_current, temperature_high, temperature_low,
 *                   feels_like, soil_temperature, dew_point
 */

import { evaluateCondition, type ForecastData } from '../../src/utils/weatherEngine';
import type { AlertCondition } from '../../src/types';

function hoursFromNow(h: number): string {
  return new Date(Date.now() + h * 60 * 60 * 1000).toISOString();
}

function buildForecastWithTemp(tempF: number[]): ForecastData {
  const times = tempF.map((_, i) => hoursFromNow(i + 1));
  return {
    hourly: {
      time: times,
      temperature_2m: tempF,
      apparent_temperature: tempF.map((t) => t - 2),
      relative_humidity_2m: tempF.map(() => 50),
      precipitation_probability: tempF.map(() => 10),
      wind_speed_10m: tempF.map(() => 5),
      uv_index: tempF.map(() => 2),
      surface_pressure: tempF.map(() => 1013),
      dew_point_2m: tempF.map((t) => t - 10),
      soil_temperature_0cm: tempF,
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
}

// ── temperature_current — Celsius unit ────────────────────────────────────────

describe('evaluateCondition — temperature_current with unit: celsius', () => {
  test('50°F does NOT trigger "gte 22°C" (50°F = 10°C < 22°C)', () => {
    const forecast = buildForecastWithTemp([50]);
    const condition: AlertCondition = {
      metric: 'temperature_current',
      operator: 'gte',
      value: 22,
      unit: 'celsius',
    };
    expect(evaluateCondition(condition, forecast, 12).met).toBe(false);
  });

  test('73°F triggers "gte 22°C" (73°F ≈ 22.8°C > 22°C)', () => {
    const forecast = buildForecastWithTemp([73]);
    const condition: AlertCondition = {
      metric: 'temperature_current',
      operator: 'gte',
      value: 22,
      unit: 'celsius',
    };
    expect(evaluateCondition(condition, forecast, 12).met).toBe(true);
  });

  test('28°F triggers "lt 0°C" (28°F = -2.2°C < 0°C) — freeze alert', () => {
    const forecast = buildForecastWithTemp([28]);
    const condition: AlertCondition = {
      metric: 'temperature_current',
      operator: 'lt',
      value: 0,
      unit: 'celsius',
    };
    expect(evaluateCondition(condition, forecast, 12).met).toBe(true);
  });

  test('34°F does NOT trigger "lt 0°C" (34°F = 1.1°C > 0°C)', () => {
    const forecast = buildForecastWithTemp([34]);
    const condition: AlertCondition = {
      metric: 'temperature_current',
      operator: 'lt',
      value: 0,
      unit: 'celsius',
    };
    expect(evaluateCondition(condition, forecast, 12).met).toBe(false);
  });

  test('matchedValue is in °C (not raw °F)', () => {
    const forecast = buildForecastWithTemp([32]); // 32°F = 0°C
    const condition: AlertCondition = {
      metric: 'temperature_current',
      operator: 'lte',
      value: 0,
      unit: 'celsius',
    };
    const result = evaluateCondition(condition, forecast, 12);
    expect(result.met).toBe(true);
    expect(result.matchedValue).toBeCloseTo(0, 1);
  });
});

// ── feels_like — Celsius unit ─────────────────────────────────────────────────

describe('evaluateCondition — feels_like with unit: celsius', () => {
  test('50°F feels_like does NOT trigger "gte 15°C" (50°F = 10°C)', () => {
    const forecast = buildForecastWithTemp([60]); // apparent_temperature = 58°F
    const condition: AlertCondition = {
      metric: 'feels_like',
      operator: 'gte',
      value: 15,
      unit: 'celsius',
    };
    // apparent_temperature = 60-2 = 58°F = 14.4°C, which is < 15°C
    expect(evaluateCondition(condition, forecast, 12).met).toBe(false);
  });
});

// ── dew_point — Celsius unit ──────────────────────────────────────────────────

describe('evaluateCondition — dew_point with unit: celsius', () => {
  test('50°F dew_point does NOT trigger "gte 15°C" (50°F = 10°C)', () => {
    const forecast = buildForecastWithTemp([60]); // dew_point = 50°F = 10°C
    const condition: AlertCondition = {
      metric: 'dew_point',
      operator: 'gte',
      value: 15,
      unit: 'celsius',
    };
    expect(evaluateCondition(condition, forecast, 12).met).toBe(false);
  });
});

// ── Fahrenheit regression ─────────────────────────────────────────────────────

describe('evaluateCondition — temperature_current with unit: fahrenheit (regression)', () => {
  test('50°F triggers "gte 45°F" — no conversion, unchanged behavior', () => {
    const forecast = buildForecastWithTemp([50]);
    const condition: AlertCondition = {
      metric: 'temperature_current',
      operator: 'gte',
      value: 45,
      unit: 'fahrenheit',
    };
    expect(evaluateCondition(condition, forecast, 12).met).toBe(true);
  });

  test('freeze alert: 30°F triggers "lt 32°F"', () => {
    const forecast = buildForecastWithTemp([30]);
    const condition: AlertCondition = {
      metric: 'temperature_current',
      operator: 'lt',
      value: 32,
      unit: 'fahrenheit',
    };
    expect(evaluateCondition(condition, forecast, 12).met).toBe(true);
  });
});
