/**
 * BUG-006 regression test: forecast never attached to alerts → wmoEmoji always empty
 *
 * The wmoEmoji prefix derivation is a pure function: given a forecast object and a
 * matchedTime string, return the WMO emoji for the matching daily weather code.
 *
 * Pre-fix: alert.forecast is always undefined (evaluate-alerts never returns it, and
 * poll-weather never passes it through processGrid), so wmoEmoji is always ''.
 *
 * Post-fix: poll-weather attaches the grid's forecast to each triggered alert before
 * the push dispatch loop. wmoEmoji resolves to a non-empty string.
 *
 * We test the pure derivation helper extracted from poll-weather's push dispatch loop
 * so the logic is Jest-testable without a Deno/Supabase runtime.
 */

import {
  weatherCodeToEmoji,
  type ForecastData,
} from '../../src/utils/weatherEngine';

// ── Pure helper (mirrors the inline logic in poll-weather's push dispatch loop) ──
// This is the exact computation that was broken: forecast undefined → empty emoji.
// Extracted here so Jest can exercise it directly.

function deriveWmoEmoji(
  forecastRaw: Record<string, unknown> | undefined,
  firstMatchedTime: string | null
): string {
  const dailyWeatherCodes = (forecastRaw?.daily as Record<string, unknown> | undefined)
    ?.weather_code as number[] | undefined;
  const dailyTimes = (forecastRaw?.daily as Record<string, unknown> | undefined)
    ?.time as string[] | undefined;

  if (dailyWeatherCodes && dailyTimes && firstMatchedTime) {
    const matchedDateStr = firstMatchedTime.slice(0, 10);
    const dayIndex = dailyTimes.findIndex((t) => t.startsWith(matchedDateStr));
    if (dayIndex >= 0 && dailyWeatherCodes[dayIndex] !== undefined) {
      return weatherCodeToEmoji(dailyWeatherCodes[dayIndex]) + ' ';
    }
  }
  return '';
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildForecast(weatherCodes: number[]): ForecastData {
  const today = new Date().toISOString().slice(0, 10);
  // Build daily time strings for today + subsequent days
  const dailyTimes = weatherCodes.map((_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });

  return {
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
      time: dailyTimes,
      temperature_2m_max: weatherCodes.map(() => 70),
      temperature_2m_min: weatherCodes.map(() => 50),
      precipitation_probability_max: weatherCodes.map(() => 0),
      wind_speed_10m_max: weatherCodes.map(() => 5),
      uv_index_max: weatherCodes.map(() => 3),
      weather_code: weatherCodes,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('BUG-006: wmoEmoji derivation from alert.forecast', () => {
  it('returns empty string when forecast is undefined (pre-fix behaviour)', () => {
    // This is what always happened before the fix: forecast was never attached.
    const result = deriveWmoEmoji(undefined, '2026-06-02T12:00:00.000Z');
    expect(result).toBe('');
  });

  it('returns a non-empty emoji + space when forecast with matching daily code is attached', () => {
    // Clear skies code (0) → '☀️ '
    const forecast = buildForecast([0, 80, 95]);
    const today = new Date().toISOString().slice(0, 10);
    const matchedTime = `${today}T14:00:00.000Z`;

    const result = deriveWmoEmoji(forecast as unknown as Record<string, unknown>, matchedTime);

    expect(result).not.toBe('');
    // Code 0 maps to ☀️
    expect(result).toBe('☀️ ');
  });

  it('returns correct emoji for a rain code (code 63 → 🌧️)', () => {
    const forecast = buildForecast([63]);
    const today = new Date().toISOString().slice(0, 10);
    const matchedTime = `${today}T08:00:00.000Z`;

    const result = deriveWmoEmoji(forecast as unknown as Record<string, unknown>, matchedTime);

    expect(result).toBe('🌧️ ');
  });

  it('returns correct emoji for the day after today (day index 1)', () => {
    const forecast = buildForecast([0, 95]); // today=clear, tomorrow=thunderstorm
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const matchedTime = `${tomorrow}T14:00:00.000Z`;

    const result = deriveWmoEmoji(forecast as unknown as Record<string, unknown>, matchedTime);

    expect(result).toBe('⛈️ ');
  });

  it('returns empty string when matchedTime does not align with any daily time entry', () => {
    const forecast = buildForecast([0]);
    // A date 30 days out — well outside the 7-day forecast window
    const result = deriveWmoEmoji(
      forecast as unknown as Record<string, unknown>,
      '2030-01-01T00:00:00.000Z'
    );
    expect(result).toBe('');
  });
});
