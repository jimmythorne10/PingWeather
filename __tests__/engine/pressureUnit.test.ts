/**
 * Tests for barometric pressure unit conversion (hPa ↔ inHg) in evaluateCondition.
 *
 * Open-Meteo always returns surface_pressure in hPa. When a rule is created
 * with unit: 'inHg', evaluateCondition must convert the raw hPa value to inHg
 * before comparing against the threshold. This prevents a rule like "pressure
 * < 29.5 inHg" from being compared as "1013 < 29.5" (always false).
 *
 * Conversion: 1 inHg = 33.8639 hPa
 */

import { evaluateCondition, type ForecastData } from '../../src/utils/weatherEngine';
import type { AlertCondition } from '../../src/types';

function hoursFromNow(h: number): string {
  return new Date(Date.now() + h * 60 * 60 * 1000).toISOString();
}

function buildForecastWithPressure(pressureHpa: number[]): ForecastData {
  const times = pressureHpa.map((_, i) => hoursFromNow(i + 1));
  return {
    hourly: {
      time: times,
      temperature_2m: pressureHpa.map(() => 60),
      relative_humidity_2m: pressureHpa.map(() => 50),
      precipitation_probability: pressureHpa.map(() => 10),
      wind_speed_10m: pressureHpa.map(() => 5),
      apparent_temperature: pressureHpa.map(() => 58),
      uv_index: pressureHpa.map(() => 2),
      surface_pressure: pressureHpa,
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

// ── barometric_pressure — inHg unit ────────────────────────────────────────

describe('evaluateCondition — barometric_pressure with unit: inHg', () => {
  test('1013 hPa triggers "lt 30 inHg" (1013 / 33.8639 ≈ 29.91)', () => {
    const forecast = buildForecastWithPressure([1013]);
    const condition: AlertCondition = {
      metric: 'barometric_pressure',
      operator: 'lt',
      value: 30,
      unit: 'inHg',
    };
    const result = evaluateCondition(condition, forecast, 12);
    expect(result.met).toBe(true);
  });

  test('1013 hPa does NOT trigger "lt 29 inHg" (29.91 > 29)', () => {
    const forecast = buildForecastWithPressure([1013]);
    const condition: AlertCondition = {
      metric: 'barometric_pressure',
      operator: 'lt',
      value: 29,
      unit: 'inHg',
    };
    const result = evaluateCondition(condition, forecast, 12);
    expect(result.met).toBe(false);
  });

  test('high pressure 1025 hPa triggers "gt 30.2 inHg" (1025 / 33.8639 ≈ 30.26)', () => {
    const forecast = buildForecastWithPressure([1025]);
    const condition: AlertCondition = {
      metric: 'barometric_pressure',
      operator: 'gt',
      value: 30.2,
      unit: 'inHg',
    };
    const result = evaluateCondition(condition, forecast, 12);
    expect(result.met).toBe(true);
  });

  test('matchedValue is in inHg (not raw hPa)', () => {
    const forecast = buildForecastWithPressure([1013.25]); // standard atmosphere = 29.921 inHg
    const condition: AlertCondition = {
      metric: 'barometric_pressure',
      operator: 'lt',
      value: 30,
      unit: 'inHg',
    };
    const result = evaluateCondition(condition, forecast, 12);
    expect(result.met).toBe(true);
    // matchedValue should be ~29.92, not 1013
    expect(result.matchedValue).not.toBeNull();
    expect(result.matchedValue!).toBeCloseTo(29.921, 1);
  });
});

describe('evaluateCondition — barometric_pressure with unit: hPa (regression)', () => {
  test('1013 hPa triggers "lt 1015 hPa"', () => {
    const forecast = buildForecastWithPressure([1013]);
    const condition: AlertCondition = {
      metric: 'barometric_pressure',
      operator: 'lt',
      value: 1015,
      unit: 'hPa',
    };
    const result = evaluateCondition(condition, forecast, 12);
    expect(result.met).toBe(true);
  });

  test('1020 hPa does NOT trigger "lt 1015 hPa"', () => {
    const forecast = buildForecastWithPressure([1020]);
    const condition: AlertCondition = {
      metric: 'barometric_pressure',
      operator: 'lt',
      value: 1015,
      unit: 'hPa',
    };
    const result = evaluateCondition(condition, forecast, 12);
    expect(result.met).toBe(false);
  });
});

// ── pressure_tendency — inHg unit ────────────────────────────────────────

describe('evaluateCondition — pressure_tendency with unit: inHg', () => {
  test('-8 hPa tendency triggers "lt -0.2 inHg" (-8 / 33.8639 ≈ -0.236)', () => {
    // Window has pressure values [1013, 1005] → tendency = last - first = -8 hPa
    const forecast = buildForecastWithPressure([1013, 1010, 1008, 1005]);
    const condition: AlertCondition = {
      metric: 'pressure_tendency',
      operator: 'lt',
      value: -0.2,
      unit: 'inHg',
    };
    const result = evaluateCondition(condition, forecast, 12);
    expect(result.met).toBe(true);
  });

  test('+5 hPa rising tendency triggers "gt 0.1 inHg" (5 / 33.8639 ≈ 0.148)', () => {
    const forecast = buildForecastWithPressure([1010, 1012, 1014, 1015]);
    const condition: AlertCondition = {
      metric: 'pressure_tendency',
      operator: 'gt',
      value: 0.1,
      unit: 'inHg',
    };
    const result = evaluateCondition(condition, forecast, 12);
    expect(result.met).toBe(true);
  });
});
