/**
 * Tests for pressure_tendency derived metric.
 *
 * pressure_tendency = last_in_window - first_in_window
 *   Positive = rising pressure (use operator 'gt')
 *   Negative = falling pressure (use operator 'lt')
 *
 * FR-ENGINE-PRESSURE-TENDENCY
 */

import {
  getMetricValues,
  type ForecastData,
} from '../../src/utils/weatherEngine';

// ── Helpers ────────────────────────────────────────────────────

function hoursFromNow(h: number): string {
  return new Date(Date.now() + h * 60 * 60 * 1000).toISOString();
}

function buildForecastWithPressure(pressureValues: number[], hoursOffsets: number[]): ForecastData {
  const hourlyTimes = hoursOffsets.map(hoursFromNow);
  return {
    hourly: {
      time: hourlyTimes,
      temperature_2m: hourlyTimes.map(() => 60),
      relative_humidity_2m: hourlyTimes.map(() => 50),
      precipitation_probability: hourlyTimes.map(() => 10),
      wind_speed_10m: hourlyTimes.map(() => 10),
      apparent_temperature: hourlyTimes.map(() => 58),
      uv_index: hourlyTimes.map(() => 2),
      surface_pressure: pressureValues,
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

// ── getMetricValues('pressure_tendency', ...) ──────────────────

describe("getMetricValues('pressure_tendency', ...)", () => {
  it('returns single-element array with tendency = last - first (falling pressure)', () => {
    // Pressure falls: 1013 → 1005 → tendency = 1005 - 1013 = -8
    const forecast = buildForecastWithPressure([1013, 1009, 1005], [1, 12, 24]);
    const values = getMetricValues('pressure_tendency', forecast, 24);
    expect(values).toHaveLength(1);
    expect(values[0]).toBeCloseTo(-8, 5);
  });

  it('returns single-element array with tendency = last - first (rising pressure)', () => {
    // Pressure rises: 1005 → 1013 → tendency = 1013 - 1005 = +8
    const forecast = buildForecastWithPressure([1005, 1009, 1013], [1, 12, 24]);
    const values = getMetricValues('pressure_tendency', forecast, 24);
    expect(values).toHaveLength(1);
    expect(values[0]).toBeCloseTo(8, 5);
  });

  it('falling pressure: tendency is negative — can use lt operator', () => {
    // "pressure_tendency lt -8" should trigger a storm warning
    const forecast = buildForecastWithPressure([1020, 1015, 1010, 1005], [1, 8, 16, 24]);
    const values = getMetricValues('pressure_tendency', forecast, 24);
    expect(values).toHaveLength(1);
    expect(values[0]).toBeLessThan(0);
    expect(values[0]).toBeCloseTo(-15, 5); // 1005 - 1020 = -15
  });

  it('rising pressure: tendency is positive — can use gt operator', () => {
    const forecast = buildForecastWithPressure([1005, 1013, 1018, 1023], [1, 8, 16, 24]);
    const values = getMetricValues('pressure_tendency', forecast, 24);
    expect(values).toHaveLength(1);
    expect(values[0]).toBeGreaterThan(0);
    expect(values[0]).toBeCloseTo(18, 5); // 1023 - 1005 = +18
  });

  it('returns empty array when only one value in window (need at least 2 for tendency)', () => {
    // Only 1 data point in window — cannot compute a trend
    const forecast = buildForecastWithPressure([1013, 1010], [1, 30]);
    // lookahead=24: h=1 is in, h=30 is out → only 1 value in window
    const values = getMetricValues('pressure_tendency', forecast, 24);
    expect(values).toEqual([]);
  });

  it('returns empty array when surface_pressure is absent', () => {
    const forecast: ForecastData = {
      hourly: {
        time: [hoursFromNow(1), hoursFromNow(12)],
        temperature_2m: [60, 60],
        relative_humidity_2m: [50, 50],
        precipitation_probability: [10, 10],
        wind_speed_10m: [10, 10],
        apparent_temperature: [58, 58],
        uv_index: [2, 2],
        // no surface_pressure
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
    expect(getMetricValues('pressure_tendency', forecast, 24)).toEqual([]);
  });

  it('only considers values within the lookahead window for the calculation', () => {
    // Values at h=1 and h=12 are in a 24h window; h=30 is outside
    // tendency should be based on [1013, 1009] only → 1009 - 1013 = -4
    const forecast = buildForecastWithPressure([1013, 1009, 990], [1, 12, 30]);
    const values = getMetricValues('pressure_tendency', forecast, 24);
    expect(values).toHaveLength(1);
    expect(values[0]).toBeCloseTo(-4, 5);
  });
});
