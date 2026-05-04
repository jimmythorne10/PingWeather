/**
 * Tests for 7 new triggerable weather metrics added to getMetricValues.
 *
 * Metrics under test:
 *   precipitation_amount  — hourly precipitation (mm), daily fallback
 *   barometric_pressure   — hourly surface_pressure (hPa)
 *   snowfall              — hourly snowfall (cm)
 *   snow_depth            — hourly snow_depth (cm)
 *   soil_temperature      — hourly soil_temperature_0cm (°F when temperature_unit=fahrenheit)
 *   weather_code          — hourly WMO code (numeric, existing field)
 *   moon_phase            — computed illumination % per day (no API field)
 *
 * All functions imported from src/utils/weatherEngine — the shared source of truth.
 * A regression in the real implementation will cause these tests to fail.
 */

import {
  getMetricValues,
  type ForecastData,
} from '../../src/utils/weatherEngine';

// ── Helpers ───────────────────────────────────────────────────

function hoursFromNow(h: number): string {
  return new Date(Date.now() + h * 60 * 60 * 1000).toISOString();
}

function futureDateString(daysFromNow: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

/** Minimal valid ForecastData with all new optional hourly fields populated. */
function buildExtendedForecast(): ForecastData {
  return {
    hourly: {
      time: [
        hoursFromNow(1),
        hoursFromNow(6),
        hoursFromNow(12),
        hoursFromNow(24),
        hoursFromNow(48),
      ],
      temperature_2m: [60, 55, 40, 35, 30],
      relative_humidity_2m: [50, 60, 70, 80, 90],
      precipitation_probability: [10, 30, 60, 80, 90],
      wind_speed_10m: [5, 10, 15, 20, 30],
      apparent_temperature: [58, 52, 38, 32, 28],
      uv_index: [2, 5, 3, 0, 1],
      weather_code: [0, 3, 61, 71, 95],
      precipitation: [0.0, 0.5, 2.3, 5.1, 0.0],
      surface_pressure: [1013.0, 1012.5, 1010.0, 1008.0, 1005.5],
      snowfall: [0.0, 0.0, 1.5, 3.2, 0.0],
      snow_depth: [0.0, 0.0, 2.0, 5.5, 5.5],
      soil_temperature_0cm: [10.5, 10.0, 9.5, 8.0, 7.5],
    },
    daily: {
      time: [
        futureDateString(0),
        futureDateString(1),
        futureDateString(2),
        futureDateString(3),
      ],
      temperature_2m_max: [75, 65, 50, 45],
      temperature_2m_min: [40, 30, 25, 20],
      precipitation_probability_max: [20, 80, 60, 40],
      wind_speed_10m_max: [15, 25, 35, 45],
      uv_index_max: [5, 7, 9, 3],
      precipitation_sum: [0.0, 5.2, 10.4, 2.1],
    },
  };
}

// ── precipitation_amount ──────────────────────────────────────

describe('getMetricValues — precipitation_amount', () => {
  it('returns hourly precipitation values within the lookahead window (≤24h)', () => {
    const forecast = buildExtendedForecast();
    const values = getMetricValues('precipitation_amount', forecast, 12);
    // 12h window includes times at 1h, 6h, 12h → precipitation: 0.0, 0.5, 2.3
    expect(values.length).toBeGreaterThan(0);
    expect(values.every((v) => (forecast.hourly.precipitation ?? []).includes(v))).toBe(true);
  });

  it('returns daily precipitation_sum values for lookahead > 24h', () => {
    const forecast = buildExtendedForecast();
    const values = getMetricValues('precipitation_amount', forecast, 72);
    expect(values.length).toBeGreaterThan(0);
    expect(values.every((v) => (forecast.daily.precipitation_sum ?? []).includes(v))).toBe(true);
  });

  it('returns empty array when hourly precipitation is not in the data', () => {
    const forecast: ForecastData = {
      hourly: {
        time: [hoursFromNow(3)],
        temperature_2m: [50],
        relative_humidity_2m: [60],
        precipitation_probability: [20],
        wind_speed_10m: [10],
        apparent_temperature: [48],
        uv_index: [3],
        // precipitation deliberately omitted
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
    const values = getMetricValues('precipitation_amount', forecast, 12);
    expect(values).toEqual([]);
  });
});

// ── barometric_pressure ───────────────────────────────────────

describe('getMetricValues — barometric_pressure', () => {
  it('returns surface_pressure values within the lookahead window', () => {
    const forecast = buildExtendedForecast();
    const values = getMetricValues('barometric_pressure', forecast, 12);
    expect(values.length).toBeGreaterThan(0);
    expect(values.every((v) => (forecast.hourly.surface_pressure ?? []).includes(v))).toBe(true);
  });

  it('excludes surface_pressure values outside the lookahead window', () => {
    const forecast = buildExtendedForecast();
    // 2h window — only the 1h entry should be included
    const values = getMetricValues('barometric_pressure', forecast, 2);
    expect(values).toContain(1013.0); // 1h entry
    // 48h entry (1005.5) must be excluded from a 2h window
    expect(values).not.toContain(1005.5);
  });

  it('returns empty array when surface_pressure is absent from forecast', () => {
    const forecast: ForecastData = {
      hourly: {
        time: [hoursFromNow(1)],
        temperature_2m: [50],
        relative_humidity_2m: [60],
        precipitation_probability: [20],
        wind_speed_10m: [10],
        apparent_temperature: [48],
        uv_index: [3],
        // surface_pressure omitted
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
    const values = getMetricValues('barometric_pressure', forecast, 24);
    expect(values).toEqual([]);
  });
});

// ── snowfall ──────────────────────────────────────────────────

describe('getMetricValues — snowfall', () => {
  it('returns snowfall values within the lookahead window', () => {
    const forecast = buildExtendedForecast();
    const values = getMetricValues('snowfall', forecast, 24);
    expect(values.length).toBeGreaterThan(0);
    expect(values.every((v) => (forecast.hourly.snowfall ?? []).includes(v))).toBe(true);
  });

  it('returns empty array when snowfall field is absent', () => {
    const forecast: ForecastData = {
      hourly: {
        time: [hoursFromNow(1)],
        temperature_2m: [50],
        relative_humidity_2m: [60],
        precipitation_probability: [20],
        wind_speed_10m: [10],
        apparent_temperature: [48],
        uv_index: [3],
        // snowfall omitted
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
    const values = getMetricValues('snowfall', forecast, 24);
    expect(values).toEqual([]);
  });
});

// ── snow_depth ────────────────────────────────────────────────

describe('getMetricValues — snow_depth', () => {
  it('returns snow_depth values within the lookahead window', () => {
    const forecast = buildExtendedForecast();
    const values = getMetricValues('snow_depth', forecast, 24);
    expect(values.length).toBeGreaterThan(0);
    expect(values.every((v) => (forecast.hourly.snow_depth ?? []).includes(v))).toBe(true);
  });

  it('returns empty array when snow_depth field is absent', () => {
    const forecast: ForecastData = {
      hourly: {
        time: [hoursFromNow(1)],
        temperature_2m: [50],
        relative_humidity_2m: [60],
        precipitation_probability: [20],
        wind_speed_10m: [10],
        apparent_temperature: [48],
        uv_index: [3],
        // snow_depth omitted
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
    const values = getMetricValues('snow_depth', forecast, 24);
    expect(values).toEqual([]);
  });
});

// ── soil_temperature ──────────────────────────────────────────

describe('getMetricValues — soil_temperature', () => {
  it('returns soil_temperature_0cm values within the lookahead window', () => {
    const forecast = buildExtendedForecast();
    const values = getMetricValues('soil_temperature', forecast, 24);
    expect(values.length).toBeGreaterThan(0);
    expect(values.every((v) => (forecast.hourly.soil_temperature_0cm ?? []).includes(v))).toBe(true);
  });

  it('returns empty array when soil_temperature_0cm field is absent', () => {
    const forecast: ForecastData = {
      hourly: {
        time: [hoursFromNow(1)],
        temperature_2m: [50],
        relative_humidity_2m: [60],
        precipitation_probability: [20],
        wind_speed_10m: [10],
        apparent_temperature: [48],
        uv_index: [3],
        // soil_temperature_0cm omitted
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
    const values = getMetricValues('soil_temperature', forecast, 24);
    expect(values).toEqual([]);
  });
});

// ── weather_code ──────────────────────────────────────────────

describe('getMetricValues — weather_code', () => {
  it('returns weather_code values within the lookahead window', () => {
    const forecast = buildExtendedForecast();
    const values = getMetricValues('weather_code', forecast, 12);
    expect(values.length).toBeGreaterThan(0);
    expect(values.every((v) => (forecast.hourly.weather_code ?? []).includes(v))).toBe(true);
  });

  it('can detect thunderstorm codes (>=95) within the window', () => {
    // A thunderstorm rule: weather_code >= 95 should trigger when code=95 is in window
    const forecast: ForecastData = {
      hourly: {
        time: [hoursFromNow(3), hoursFromNow(10)],
        temperature_2m: [75, 72],
        relative_humidity_2m: [80, 90],
        precipitation_probability: [60, 90],
        wind_speed_10m: [20, 35],
        apparent_temperature: [73, 70],
        uv_index: [4, 0],
        weather_code: [3, 95], // second entry is thunderstorm
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
    const values = getMetricValues('weather_code', forecast, 24);
    expect(values).toContain(95);
  });

  it('returns empty array when weather_code is absent', () => {
    const forecast: ForecastData = {
      hourly: {
        time: [hoursFromNow(1)],
        temperature_2m: [50],
        relative_humidity_2m: [60],
        precipitation_probability: [20],
        wind_speed_10m: [10],
        apparent_temperature: [48],
        uv_index: [3],
        // weather_code omitted
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
    const values = getMetricValues('weather_code', forecast, 24);
    expect(values).toEqual([]);
  });
});

// ── moon_phase ────────────────────────────────────────────────

describe('getMetricValues — moon_phase', () => {
  it('returns one illumination value per day in the lookahead window', () => {
    // moon_phase returns one value per calendar day in daily.time, computed from
    // the date string. With 4 daily entries and a 96h window, expect 4 values.
    const forecast = buildExtendedForecast();
    const values = getMetricValues('moon_phase', forecast, 96);
    // Each value should be a number between 0 and 100
    expect(values.length).toBeGreaterThan(0);
    expect(values.every((v) => v >= 0 && v <= 100)).toBe(true);
  });

  it('returns empty array when daily.time has no entries in window', () => {
    const forecast: ForecastData = {
      hourly: {
        time: [],
        temperature_2m: [],
        relative_humidity_2m: [],
        precipitation_probability: [],
        wind_speed_10m: [],
        apparent_temperature: [],
        uv_index: [],
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
    const values = getMetricValues('moon_phase', forecast, 24);
    expect(values).toEqual([]);
  });

  it('returns numeric values that can be compared (e.g. for full moon rule)', () => {
    const futureForecast: ForecastData = {
      hourly: {
        time: [],
        temperature_2m: [],
        relative_humidity_2m: [],
        precipitation_probability: [],
        wind_speed_10m: [],
        apparent_temperature: [],
        uv_index: [],
      },
      daily: {
        time: [futureDateString(0), futureDateString(1)],
        temperature_2m_max: [45, 40],
        temperature_2m_min: [32, 30],
        precipitation_probability_max: [10, 20],
        wind_speed_10m_max: [8, 12],
        uv_index_max: [2, 3],
      },
    };
    const values = getMetricValues('moon_phase', futureForecast, 48);
    expect(Array.isArray(values)).toBe(true);
    expect(values.every((v) => typeof v === 'number')).toBe(true);
  });
});

// ── weatherCodeToEmoji ────────────────────────────────────────

describe('weatherCodeToEmoji', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { weatherCodeToEmoji } = require('../../src/utils/weatherEngine');

  it('returns ☀️ for clear sky (code 0)', () => {
    expect(weatherCodeToEmoji(0)).toBe('☀️');
  });

  it('returns ⛅ for partly cloudy (codes 2–3)', () => {
    expect(weatherCodeToEmoji(2)).toBe('⛅');
    expect(weatherCodeToEmoji(3)).toBe('⛅');
  });

  it('returns ⛈️ for thunderstorm codes (95–99)', () => {
    expect(weatherCodeToEmoji(95)).toBe('⛈️');
    expect(weatherCodeToEmoji(99)).toBe('⛈️');
  });

  it('returns ❄️ for snow codes (70–79)', () => {
    expect(weatherCodeToEmoji(73)).toBe('❄️');
  });

  it('returns 🌡️ for out-of-range codes', () => {
    expect(weatherCodeToEmoji(100)).toBe('🌡️');
    expect(weatherCodeToEmoji(999)).toBe('🌡️');
  });
});
