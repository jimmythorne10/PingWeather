/**
 * Tests for getCurrentTemperature -- src/services/currentTemp.ts
 *
 * This helper finds the current LOCAL-hour's temperature entry inside
 * an HourlyForecast object using 13-character ISO string-prefix
 * matching ("2026-05-27T09") against a local-time prefix derived via
 * Intl.DateTimeFormat -- NOT toISOString() (UTC).
 *
 * Why NOT toISOString()?  Open-Meteo timestamps are in the location's
 * local time (no timezone suffix). Matching them against UTC hour
 * causes "Now: X" to never render for western-timezone users (DATA-002).
 * See CLAUDE.md Critical Rule #1.
 *
 * Date control: we use jest.useFakeTimers({ now: ... }) to pin "now"
 * to a known UTC instant so tests are deterministic regardless of
 * when they run.
 */

import { getCurrentTemperature } from '../../src/services/currentTemp';
import type { HourlyForecast } from '../../src/types';

// ── helpers ───────────────────────────────────────────────────

// Minimal HourlyForecast factory -- only time + temperature_2m are
// used by getCurrentTemperature; the rest are empty arrays to satisfy
// the TypeScript type shape.
function makeHourly(times: string[], temps: number[]): HourlyForecast {
  return {
    time: times,
    temperature_2m: temps,
    relative_humidity_2m: [],
    precipitation_probability: [],
    wind_speed_10m: [],
    apparent_temperature: [],
    uv_index: [],
    weather_code: [],
  };
}

afterEach(() => {
  jest.useRealTimers();
});

// ─────────────────────────────────────────────────────────────
// Test 1: Returns the temperature for the matching local hour
// ─────────────────────────────────────────────────────────────
it('returns the temperature for the current local hour when a matching time entry exists', () => {
  // UTC 2026-05-27T14:32Z == America/Chicago 09:32 CDT (UTC-5)
  // Local prefix for America/Chicago => "2026-05-27T09"
  jest.useFakeTimers({ now: new Date('2026-05-27T14:32:00.000Z').getTime() });

  const hourly = makeHourly(
    ['2026-05-27T07:00', '2026-05-27T08:00', '2026-05-27T09:00', '2026-05-27T10:00'],
    [68, 70, 73, 75],
  );

  const result = getCurrentTemperature(hourly, 'America/Chicago');

  // Local hour is 09 -> index 2, temp 73
  expect(result).toBe(73);
});

// ─────────────────────────────────────────────────────────────
// Test 2: Returns null for empty hourly data
// ─────────────────────────────────────────────────────────────
it('returns null when the hourly time array is empty', () => {
  jest.useFakeTimers({ now: new Date('2026-05-27T14:00:00.000Z').getTime() });

  const hourly = makeHourly([], []);

  const result = getCurrentTemperature(hourly, 'America/Chicago');

  expect(result).toBeNull();
});

// ─────────────────────────────────────────────────────────────
// Test 3: Returns null when times exist but none match current local hour
// ─────────────────────────────────────────────────────────────
it('returns null when hourly data has entries but none match the current local hour', () => {
  // UTC 14:00 => America/Chicago 09:00 CDT, but data is from previous day
  jest.useFakeTimers({ now: new Date('2026-05-27T14:00:00.000Z').getTime() });

  const hourly = makeHourly(
    ['2026-05-26T07:00', '2026-05-26T08:00', '2026-05-26T09:00'],
    [60, 62, 64],
  );

  const result = getCurrentTemperature(hourly, 'America/Chicago');

  expect(result).toBeNull();
});

// ─────────────────────────────────────────────────────────────
// Test 4: UTC offset separation -- UTC hour must NOT be used
//
// This is the regression test for DATA-002.
// UTC hour is 14 but local (America/Chicago CDT) is 09.
// The forecast only has a "09:00" entry.
// A UTC-based implementation would return null (no "14:00" entry).
// A correct local-time implementation returns 73.
// ─────────────────────────────────────────────────────────────
it('matches local-hour timestamp, not UTC hour (DATA-002 regression)', () => {
  // Pin UTC to 14:30 -- CDT is UTC-5 so local = 09:30
  jest.useFakeTimers({ now: new Date('2026-05-27T14:30:00.000Z').getTime() });

  // Forecast only has hour 09:00 (local) -- NO "14:00" entry
  const hourly = makeHourly(
    ['2026-05-27T08:00', '2026-05-27T09:00', '2026-05-27T10:00'],
    [70, 73, 76],
  );

  const result = getCurrentTemperature(hourly, 'America/Chicago');

  // Correct: matches "2026-05-27T09:00" (local hour 09), returns 73
  // Wrong (old bug): returns null because no "2026-05-27T14:00" entry
  expect(result).toBe(73);
});

// ─────────────────────────────────────────────────────────────
// Test 5: Rounds fractional temperature values
// ─────────────────────────────────────────────────────────────
it('rounds fractional temperature values to the nearest integer', () => {
  // UTC 14:00 => America/Chicago CDT 09:00
  jest.useFakeTimers({ now: new Date('2026-05-27T14:00:00.000Z').getTime() });

  const hourly = makeHourly(
    ['2026-05-27T09:00'],
    [72.6],
  );

  const result = getCurrentTemperature(hourly, 'America/Chicago');

  expect(result).toBe(73);
});

// ─────────────────────────────────────────────────────────────
// Test 6: Does not match a different hour on the same date
// ─────────────────────────────────────────────────────────────
it('does not match a forecast entry from the same date but a different local hour', () => {
  // Local (America/Chicago) hour is 09; data has 10 and 11 only
  jest.useFakeTimers({ now: new Date('2026-05-27T14:00:00.000Z').getTime() });

  const hourly = makeHourly(
    ['2026-05-27T10:00', '2026-05-27T11:00'],
    [75, 76],
  );

  const result = getCurrentTemperature(hourly, 'America/Chicago');

  expect(result).toBeNull();
});
