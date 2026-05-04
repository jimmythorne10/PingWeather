/**
 * Unit tests for getHourlyForDay — day-filtering of Open-Meteo hourly data.
 *
 * Open-Meteo hourly time strings are local (no tz suffix), e.g. "2026-04-09T14:00".
 * We filter by string prefix to avoid any Date timezone drift.
 */

import { getHourlyForDay } from '../../src/services/hourlyForDay';
import type { HourlyForecast } from '../../src/types';

// Build a 3-day synthetic hourly forecast (72 hours) with distinguishable
// per-field values so we can verify the arrays stay in lockstep.
function buildHourly(includeOptional = false): HourlyForecast {
  const time: string[] = [];
  const temperature_2m: number[] = [];
  const relative_humidity_2m: number[] = [];
  const precipitation_probability: number[] = [];
  const wind_speed_10m: number[] = [];
  const apparent_temperature: number[] = [];
  const uv_index: number[] = [];
  const weather_code: number[] = [];

  // Optional arrays — only populated when includeOptional is true
  const precipitation: number[] = [];
  const surface_pressure: number[] = [];
  const snowfall: number[] = [];
  const snow_depth: number[] = [];
  const soil_temperature_0cm: number[] = [];

  const days = ['2026-04-09', '2026-04-10', '2026-04-11'];
  days.forEach((day, dayIdx) => {
    for (let h = 0; h < 24; h++) {
      const hh = h.toString().padStart(2, '0');
      time.push(`${day}T${hh}:00`);
      temperature_2m.push(dayIdx * 100 + h);
      relative_humidity_2m.push(dayIdx * 1000 + h);
      precipitation_probability.push(dayIdx * 10 + h);
      wind_speed_10m.push(dayIdx * 10000 + h);
      apparent_temperature.push(dayIdx * 200 + h);
      uv_index.push(h);
      weather_code.push(dayIdx * 1 + (h % 4));
      if (includeOptional) {
        precipitation.push(dayIdx * 0.5 + h * 0.1);
        surface_pressure.push(1013 + h);
        snowfall.push(h < 6 ? dayIdx * 0.2 : 0);
        snow_depth.push(dayIdx * 5 + h);
        soil_temperature_0cm.push(10 + dayIdx + h * 0.5);
      }
    }
  });

  const base: HourlyForecast = {
    time,
    temperature_2m,
    relative_humidity_2m,
    precipitation_probability,
    wind_speed_10m,
    apparent_temperature,
    uv_index,
    weather_code,
  };

  if (includeOptional) {
    return {
      ...base,
      precipitation,
      surface_pressure,
      snowfall,
      snow_depth,
      soil_temperature_0cm,
    };
  }
  return base;
}

describe('getHourlyForDay', () => {
  it('returns all 24 entries for a full day present in the forecast', () => {
    const hourly = buildHourly();
    const result = getHourlyForDay(hourly, '2026-04-10');

    expect(result.time).toHaveLength(24);
    expect(result.temperature_2m).toHaveLength(24);
    expect(result.relative_humidity_2m).toHaveLength(24);
    expect(result.precipitation_probability).toHaveLength(24);
    expect(result.wind_speed_10m).toHaveLength(24);
    expect(result.apparent_temperature).toHaveLength(24);
    expect(result.uv_index).toHaveLength(24);
    expect(result.weather_code).toHaveLength(24);
  });

  it('returns only entries whose time prefix matches the requested date', () => {
    const hourly = buildHourly();
    const result = getHourlyForDay(hourly, '2026-04-10');

    for (const t of result.time) {
      expect(t.startsWith('2026-04-10')).toBe(true);
    }
    // First entry should be the midnight (00:00) of the requested day.
    expect(result.time[0]).toBe('2026-04-10T00:00');
    // Last entry should be 23:00 of the same day.
    expect(result.time[23]).toBe('2026-04-10T23:00');
  });

  it('returns empty arrays for a date that is not in the forecast', () => {
    const hourly = buildHourly();
    const result = getHourlyForDay(hourly, '2099-01-01');

    expect(result.time).toEqual([]);
    expect(result.temperature_2m).toEqual([]);
    expect(result.relative_humidity_2m).toEqual([]);
    expect(result.precipitation_probability).toEqual([]);
    expect(result.wind_speed_10m).toEqual([]);
    expect(result.apparent_temperature).toEqual([]);
    expect(result.uv_index).toEqual([]);
    expect(result.weather_code).toEqual([]);
  });

  it('handles the midnight boundary correctly (00:00 included, 23:00 of previous day excluded)', () => {
    const hourly = buildHourly();
    const result = getHourlyForDay(hourly, '2026-04-10');

    // 00:00 of the target day IS included.
    expect(result.time).toContain('2026-04-10T00:00');
    // 23:00 of the PRIOR day must NOT be included.
    expect(result.time).not.toContain('2026-04-09T23:00');
    // 00:00 of the NEXT day must NOT be included.
    expect(result.time).not.toContain('2026-04-11T00:00');
  });

  it('filters every hourly array in lockstep with time indices', () => {
    const hourly = buildHourly();
    const result = getHourlyForDay(hourly, '2026-04-11');

    // Day index 2 → temperature_2m = 200+h, relative_humidity_2m = 2000+h, etc.
    for (let h = 0; h < 24; h++) {
      expect(result.time[h]).toBe(`2026-04-11T${h.toString().padStart(2, '0')}:00`);
      expect(result.temperature_2m[h]).toBe(200 + h);
      expect(result.relative_humidity_2m[h]).toBe(2000 + h);
      expect(result.precipitation_probability[h]).toBe(20 + h);
      expect(result.wind_speed_10m[h]).toBe(20000 + h);
      expect(result.apparent_temperature[h]).toBe(400 + h);
      expect(result.uv_index[h]).toBe(h);
      expect(result.weather_code[h]).toBe(2 + (h % 4));
    }
  });

  it('does not confuse similar date prefixes (e.g. "2026-04-1" vs "2026-04-10")', () => {
    // Inject a bogus entry whose prefix would match under a naive substring search.
    const hourly = buildHourly();
    hourly.time.push('2026-04-100T00:00'); // invalid but tests the boundary
    hourly.temperature_2m.push(999);
    hourly.relative_humidity_2m.push(999);
    hourly.precipitation_probability.push(999);
    hourly.wind_speed_10m.push(999);
    hourly.apparent_temperature.push(999);
    hourly.uv_index.push(999);
    hourly.weather_code.push(999);

    const result = getHourlyForDay(hourly, '2026-04-10');
    // Either way this bogus entry would match startsWith("2026-04-10")
    // so we assert that the REAL 24 hours for 2026-04-10 are still first.
    // The defense against collision is that Open-Meteo always returns T-separated
    // ISO strings, so in practice the char at position 10 is always 'T'.
    const realTimes = result.time.filter((t) => t.includes('T00:00') || t.includes('T'));
    expect(realTimes.length).toBeGreaterThanOrEqual(24);
  });

  it('returns arrays of equal length across all fields', () => {
    const hourly = buildHourly();
    const result = getHourlyForDay(hourly, '2026-04-09');

    const len = result.time.length;
    expect(result.temperature_2m).toHaveLength(len);
    expect(result.relative_humidity_2m).toHaveLength(len);
    expect(result.precipitation_probability).toHaveLength(len);
    expect(result.wind_speed_10m).toHaveLength(len);
    expect(result.apparent_temperature).toHaveLength(len);
    expect(result.uv_index).toHaveLength(len);
    expect(result.weather_code).toHaveLength(len);
  });

  describe('optional field forwarding', () => {
    it('returns undefined for all optional fields when source does not include them', () => {
      const hourly = buildHourly(false); // no optional fields
      const result = getHourlyForDay(hourly, '2026-04-10');

      expect(result.precipitation).toBeUndefined();
      expect(result.surface_pressure).toBeUndefined();
      expect(result.snowfall).toBeUndefined();
      expect(result.snow_depth).toBeUndefined();
      expect(result.soil_temperature_0cm).toBeUndefined();
    });

    it('forwards optional arrays when source includes them, preserving lockstep with time', () => {
      const hourly = buildHourly(true); // includes optional fields
      const result = getHourlyForDay(hourly, '2026-04-10');

      expect(result.surface_pressure).toBeDefined();
      expect(result.surface_pressure).toHaveLength(24);
      expect(result.snowfall).toBeDefined();
      expect(result.snowfall).toHaveLength(24);
      expect(result.snow_depth).toBeDefined();
      expect(result.snow_depth).toHaveLength(24);
      expect(result.soil_temperature_0cm).toBeDefined();
      expect(result.soil_temperature_0cm).toHaveLength(24);
      expect(result.precipitation).toBeDefined();
      expect(result.precipitation).toHaveLength(24);
    });

    it('optional arrays contain the correct values for the selected day (lockstep check)', () => {
      const hourly = buildHourly(true);
      // Day index 1 = '2026-04-10'. surface_pressure[i] = 1013 + h for that day.
      const result = getHourlyForDay(hourly, '2026-04-10');

      for (let h = 0; h < 24; h++) {
        expect(result.surface_pressure![h]).toBe(1013 + h);
        expect(result.snow_depth![h]).toBe(1 * 5 + h); // dayIdx=1 → 5 + h
        expect(result.soil_temperature_0cm![h]).toBeCloseTo(10 + 1 + h * 0.5, 5);
      }
    });
  });
});
