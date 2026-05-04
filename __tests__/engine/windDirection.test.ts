/**
 * Tests for wind direction condition:
 *   - `from_bearing` operator (circular math in compare())
 *   - `getMetricValues('wind_direction', ...)` extraction from wind_direction_10m
 *
 * FR-ENGINE-WIND-DIR
 */

import {
  compare,
  getMetricValues,
  type ForecastData,
} from '../../src/utils/weatherEngine';

// ── Helpers ────────────────────────────────────────────────────

function hoursFromNow(h: number): string {
  return new Date(Date.now() + h * 60 * 60 * 1000).toISOString();
}

function buildForecastWithWindDir(windDirValues: number[], hoursOffsets: number[]): ForecastData {
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
      wind_direction_10m: windDirValues,
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

// ── compare() with from_bearing ────────────────────────────────

describe('compare() — from_bearing operator', () => {
  // bearing=0 (north), tolerance=45
  // angleDiff = abs(((actual - 0) % 360 + 360) % 360 - 180)
  // For actual=350: remainder = 350, diff = |350 - 180| = 170... wait that's wrong.
  // Let me re-read the spec formula:
  //   angleDiff = abs(((actual - bearing) % 360 + 360) % 360 - 180)
  // Wait, the spec says: triggered = angleDiff <= tolerance
  // But the angleDiff formula gives the "angular distance from 180" not "from bearing".
  // Re-reading: ((actual - bearing) % 360 + 360) % 360 gives the clockwise angle from bearing to actual
  // Subtracting 180 and abs gives the "distance from the opposite direction"
  // So angleDiff = abs(normalized_diff - 180)
  // For actual=350, bearing=0: normalized = (350 % 360 + 360) % 360 = 350; diff = |350-180| = 170 → NOT triggered
  //
  // Hmm, that doesn't match the spec intent. Let me re-read the spec more carefully:
  //   "angleDiff = abs(((actual - bearing) % 360 + 360) % 360 - 180)"
  //   "triggered = angleDiff <= tolerance"
  //   "Example: bearing=270 (west), tolerance=45 → triggers for any wind direction in the 225°–315° range."
  //
  // For actual=270 (same as bearing=270): ((270-270)%360+360)%360 = 0; |0-180| = 180 → NOT triggered? That's wrong.
  //
  // I think there's a sign issue in the spec formula. The correct circular distance formula is:
  //   diff = ((actual - bearing) % 360 + 360) % 360   (0–359, clockwise angle)
  //   angleDiff = diff <= 180 ? diff : 360 - diff     (shortest arc, 0–180)
  //   triggered = angleDiff <= tolerance
  //
  // Verify spec example: bearing=270, tolerance=45, actual=315: diff=(315-270+360)%360=45; angleDiff=45; 45<=45 ✓
  // Verify: bearing=270, tolerance=45, actual=225: diff=(225-270+360)%360=315; angleDiff=360-315=45; 45<=45 ✓
  // Verify: bearing=0, actual=350: diff=(350-0+360)%360=350; angleDiff=360-350=10; 10<=45 → triggered ✓
  // Verify: bearing=0, actual=180: diff=(180-0+360)%360=180; angleDiff=180; 180<=45 → NOT triggered ✓
  //
  // The spec's formula is wrong — the correct implementation uses shortest-arc distance.
  // Tests below test the CORRECT behavior (matching the spec's stated examples).

  it('bearing=0 (north), actual=350° — within 10°, should trigger', () => {
    expect(compare(350, 'from_bearing', 0, 45)).toBe(true);
  });

  it('bearing=0 (north), actual=46° — just outside 45° tolerance, should NOT trigger', () => {
    expect(compare(46, 'from_bearing', 0, 45)).toBe(false);
  });

  it('bearing=0 (north), actual=180° (south) — 180° away, should NOT trigger', () => {
    expect(compare(180, 'from_bearing', 0, 45)).toBe(false);
  });

  it('bearing=0 (north), actual=45° — exactly at tolerance, should trigger', () => {
    expect(compare(45, 'from_bearing', 0, 45)).toBe(true);
  });

  it('bearing=270 (west), actual=315° — 45° from west, should trigger (tolerance=45)', () => {
    expect(compare(315, 'from_bearing', 270, 45)).toBe(true);
  });

  it('bearing=270 (west), actual=225° — 45° from west, should trigger (tolerance=45)', () => {
    expect(compare(225, 'from_bearing', 270, 45)).toBe(true);
  });

  it('bearing=270 (west), actual=135° — 135° away, should NOT trigger', () => {
    expect(compare(135, 'from_bearing', 270, 45)).toBe(false);
  });

  it('bearing=270 (west), actual=270° — exact match, should trigger', () => {
    expect(compare(270, 'from_bearing', 270, 45)).toBe(true);
  });

  it('wraps correctly at 360/0 boundary — bearing=0, actual=10, tolerance=45 → trigger', () => {
    expect(compare(10, 'from_bearing', 0, 45)).toBe(true);
  });

  it('returns false when tolerance is undefined (defaults to 0)', () => {
    // No tolerance means exact match only — actual=1 does NOT equal bearing=0
    expect(compare(1, 'from_bearing', 0, undefined)).toBe(false);
  });

  it('returns true for exact bearing match with tolerance=0', () => {
    expect(compare(270, 'from_bearing', 270, 0)).toBe(true);
  });
});

// ── getMetricValues('wind_direction', ...) ─────────────────────

describe("getMetricValues('wind_direction', ...)", () => {
  it('returns values from wind_direction_10m within lookahead window', () => {
    const forecast = buildForecastWithWindDir([270, 280, 315, 45], [1, 6, 12, 24]);
    const values = getMetricValues('wind_direction', forecast, 24);
    expect(values.length).toBeGreaterThan(0);
    expect(values).toContain(270);
    expect(values).toContain(315);
  });

  it('excludes values outside the lookahead window', () => {
    const forecast = buildForecastWithWindDir([270, 45], [1, 30]);
    const values = getMetricValues('wind_direction', forecast, 24);
    // h=1 is in window, h=30 is outside 24h window
    expect(values).toContain(270);
    expect(values).not.toContain(45);
  });

  it('returns empty array when wind_direction_10m is absent', () => {
    const forecast: ForecastData = {
      hourly: {
        time: [hoursFromNow(1)],
        temperature_2m: [60],
        relative_humidity_2m: [50],
        precipitation_probability: [10],
        wind_speed_10m: [10],
        apparent_temperature: [58],
        uv_index: [2],
        // no wind_direction_10m
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
    expect(getMetricValues('wind_direction', forecast, 24)).toEqual([]);
  });

  it('returns empty array when wind_direction_10m is present but empty', () => {
    const forecast = buildForecastWithWindDir([], []);
    expect(getMetricValues('wind_direction', forecast, 24)).toEqual([]);
  });
});
