/**
 * POLISH-002: cold-front preset regression
 *
 * The original cold-front condition was:
 *   { metric: 'temperature_high', operator: 'lt', value: -15 }
 *
 * A temperature_high value of -15°F or lower is essentially impossible in the
 * continental US, so the preset NEVER fires. This test asserts that a realistic
 * frigid forecast (temperature_high = 28°F — a genuine cold front) triggers
 * the cold-front condition.
 *
 * Run: npx jest --selectProjects logic --testPathPattern="polish002-coldFront"
 */

import { ALERT_PRESETS } from '../../src/data/alert-presets';
import { evaluateCondition } from '../../src/utils/weatherEngine';
import type { ForecastData } from '../../src/utils/weatherEngine';

// Build a minimal ForecastData with a frigid temperature_high.
function buildFrigidForecast(): ForecastData {
  const nowPlus12h = new Date(Date.now() + 12 * 3_600_000).toISOString();
  const nowPlus24h = new Date(Date.now() + 24 * 3_600_000).toISOString();
  const todayStr = new Date().toISOString().slice(0, 10);
  const tomorrowStr = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  return {
    hourly: {
      time: [nowPlus12h, nowPlus24h],
      temperature_2m: [28, 25],
      relative_humidity_2m: [70, 75],
      precipitation_probability: [20, 30],
      wind_speed_10m: [15, 18],
      apparent_temperature: [18, 15],
      uv_index: [1, 1],
    },
    daily: {
      time: [todayStr, tomorrowStr],
      temperature_2m_max: [28, 25],   // cold front: high only reaches 28°F
      temperature_2m_min: [15, 12],
      precipitation_probability_max: [20, 30],
      wind_speed_10m_max: [15, 18],
      uv_index_max: [1, 1],
    },
  };
}

describe('POLISH-002: cold-front preset condition', () => {
  it('cold-front preset exists in ALERT_PRESETS', () => {
    const preset = ALERT_PRESETS.find((p) => p.id === 'cold-front');
    expect(preset).toBeDefined();
  });

  it('cold-front condition triggers on a realistic frigid forecast (temp_high = 28°F)', () => {
    const preset = ALERT_PRESETS.find((p) => p.id === 'cold-front');
    expect(preset).toBeDefined();

    const condition = preset!.conditions[0];
    const forecast = buildFrigidForecast();

    // With value: -15, a temp_high of 28°F does NOT satisfy temperature_high < -15 → fails
    // After fix (value: 40), a temp_high of 28°F satisfies temperature_high < 40 → passes
    const result = evaluateCondition(condition, forecast, preset!.lookahead_hours);
    expect(result.met).toBe(true);
  });

  it('cold-front condition does NOT trigger on a warm day (temp_high = 75°F)', () => {
    const preset = ALERT_PRESETS.find((p) => p.id === 'cold-front');
    expect(preset).toBeDefined();

    const condition = preset!.conditions[0];
    const nowPlus12h = new Date(Date.now() + 12 * 3_600_000).toISOString();
    const todayStr = new Date().toISOString().slice(0, 10);
    const tomorrowStr = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

    const warmForecast: ForecastData = {
      hourly: {
        time: [nowPlus12h],
        temperature_2m: [75],
        relative_humidity_2m: [40],
        precipitation_probability: [5],
        wind_speed_10m: [5],
        apparent_temperature: [73],
        uv_index: [6],
      },
      daily: {
        time: [todayStr, tomorrowStr],
        temperature_2m_max: [75, 78],
        temperature_2m_min: [55, 58],
        precipitation_probability_max: [5, 10],
        wind_speed_10m_max: [5, 8],
        uv_index_max: [6, 7],
      },
    };

    const result = evaluateCondition(condition, warmForecast, preset!.lookahead_hours);
    expect(result.met).toBe(false);
  });

  it('cold-front description accurately describes the < 40°F threshold behavior', () => {
    const preset = ALERT_PRESETS.find((p) => p.id === 'cold-front');
    expect(preset).toBeDefined();
    // After fix the description should mention 40°F, not be generic / detached
    expect(preset!.description).toMatch(/40/);
  });
});
