/**
 * Tests for weatherApi — FR-HOME-001, FR-FORECAST-002
 *
 * Validates the get-forecast Edge Function proxy client: body construction,
 * error handling, unit options, and requested hourly/daily fields.
 *
 * fetchForecast now calls supabase.functions.invoke('get-forecast', { body })
 * instead of fetch() directly. Mocks target supabase.functions.invoke via the
 * singleton set up in jest.setup.ts.
 */

import { fetchForecast } from '../../src/services/weatherApi';
import { supabase } from '../../src/utils/supabase';

afterEach(() => {
  jest.clearAllMocks();
});

// ── Mock helpers ──────────────────────────────────────────────────────────────

function mockInvokeSuccess(body: unknown) {
  (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
    data: body,
    error: null,
  });
}

function mockInvokeError(message: string) {
  (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
    data: null,
    error: { message },
  });
}

/** Returns the body argument passed to the most recent supabase.functions.invoke call. */
function getLastInvokeBody(): Record<string, unknown> {
  const mockFn = supabase.functions.invoke as jest.Mock;
  return mockFn.mock.calls[0][1].body as Record<string, unknown>;
}

/** Returns the function name passed to the most recent supabase.functions.invoke call. */
function getLastInvokeFunctionName(): string {
  const mockFn = supabase.functions.invoke as jest.Mock;
  return mockFn.mock.calls[0][0] as string;
}

const mockForecastData = {
  latitude: 33.4,
  longitude: -112,
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

describe('weatherApi — fetchForecast', () => {
  // ── Edge Function routing ─────────────────────────────────

  describe('Edge Function routing', () => {
    it('invokes the get-forecast Edge Function', async () => {
      // FR-HOME-001: proxies through get-forecast, not Open-Meteo directly
      mockInvokeSuccess(mockForecastData);

      await fetchForecast({ latitude: 33.4484, longitude: -112.074 });

      expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
      expect(getLastInvokeFunctionName()).toBe('get-forecast');
    });
  });

  // ── Body parameters ───────────────────────────────────────

  describe('body parameters', () => {
    it('sends latitude and longitude in the request body', async () => {
      // FR-HOME-001: fetches forecast for a given location
      mockInvokeSuccess(mockForecastData);

      await fetchForecast({ latitude: 33.4484, longitude: -112.074 });

      const body = getLastInvokeBody();
      expect(body.latitude).toBe(33.4484);
      expect(body.longitude).toBe(-112.074);
    });

    it('defaults to 7 forecast days', async () => {
      mockInvokeSuccess(mockForecastData);

      await fetchForecast({ latitude: 0, longitude: 0 });

      expect(getLastInvokeBody().forecast_days).toBe(7);
    });

    it('supports custom forecast days (14 for FR-HOME-002/FR-FORECAST-002)', async () => {
      // FR-HOME-002: 14-day forecast
      mockInvokeSuccess(mockForecastData);

      await fetchForecast({ latitude: 0, longitude: 0, forecastDays: 14 });

      expect(getLastInvokeBody().forecast_days).toBe(14);
    });

    it('defaults to Fahrenheit temperature unit', async () => {
      mockInvokeSuccess(mockForecastData);

      await fetchForecast({ latitude: 0, longitude: 0 });

      expect(getLastInvokeBody().temperature_unit).toBe('fahrenheit');
    });

    it('supports Celsius temperature unit', async () => {
      // FR-FORECAST-002: respects user unit preferences
      mockInvokeSuccess(mockForecastData);

      await fetchForecast({ latitude: 0, longitude: 0, temperatureUnit: 'celsius' });

      expect(getLastInvokeBody().temperature_unit).toBe('celsius');
    });

    it('defaults to mph wind speed unit', async () => {
      mockInvokeSuccess(mockForecastData);

      await fetchForecast({ latitude: 0, longitude: 0 });

      expect(getLastInvokeBody().wind_speed_unit).toBe('mph');
    });

    it('supports km/h wind speed unit', async () => {
      // FR-FORECAST-002: supports mph/kmh/knots
      mockInvokeSuccess(mockForecastData);

      await fetchForecast({ latitude: 0, longitude: 0, windSpeedUnit: 'kmh' });

      expect(getLastInvokeBody().wind_speed_unit).toBe('kmh');
    });

    it('supports knots wind speed unit', async () => {
      mockInvokeSuccess(mockForecastData);

      await fetchForecast({ latitude: 0, longitude: 0, windSpeedUnit: 'knots' });

      expect(getLastInvokeBody().wind_speed_unit).toBe('knots');
    });
  });

  // ── Requested fields ──────────────────────────────────────

  describe('requested hourly fields', () => {
    const hourlyFields = [
      'temperature_2m',
      'relative_humidity_2m',
      'precipitation_probability',
      'wind_speed_10m',
      'apparent_temperature',
      'uv_index',
    ];

    hourlyFields.forEach((field) => {
      it(`requests hourly ${field}`, async () => {
        // FR-POLL-002: all 8 metrics need backing hourly fields
        mockInvokeSuccess(mockForecastData);
        await fetchForecast({ latitude: 0, longitude: 0 });
        const body = getLastInvokeBody();
        expect(body.hourly).toEqual(expect.arrayContaining([field]));
      });
    });
  });

  describe('requested daily fields', () => {
    const dailyFields = [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_probability_max',
      'wind_speed_10m_max',
      'uv_index_max',
    ];

    dailyFields.forEach((field) => {
      it(`requests daily ${field}`, async () => {
        // FR-HOME-001: 3-day forecast with high/low/rain%
        mockInvokeSuccess(mockForecastData);
        await fetchForecast({ latitude: 0, longitude: 0 });
        const body = getLastInvokeBody();
        expect(body.daily).toEqual(expect.arrayContaining([field]));
      });
    });
  });

  // ── Error handling ────────────────────────────────────────

  describe('error handling', () => {
    it('throws when invoke returns an error object', async () => {
      // FR-HOME-001: surfaces API error to the caller
      mockInvokeError('Failed to fetch forecast');

      await expect(fetchForecast({ latitude: 0, longitude: 0 })).rejects.toThrow(
        /Weather API error/,
      );
    });

    it('includes the upstream error message in the thrown error', async () => {
      mockInvokeError('Service Unavailable');

      await expect(fetchForecast({ latitude: 0, longitude: 0 })).rejects.toThrow(
        'Weather API error: Service Unavailable',
      );
    });

    it('throws on a network-level edge function error', async () => {
      mockInvokeError('Network request failed');

      await expect(fetchForecast({ latitude: 0, longitude: 0 })).rejects.toThrow(
        /Weather API error/,
      );
    });
  });

  // ── Response passthrough ──────────────────────────────────

  describe('response passthrough', () => {
    it('returns the data object from invoke as-is', async () => {
      // The client is a thin proxy — it must not mutate the response shape.
      mockInvokeSuccess(mockForecastData);

      const result = await fetchForecast({ latitude: 33.4, longitude: -112 });

      expect(result).toEqual(mockForecastData);
      expect(result.latitude).toBe(33.4);
      expect(result.longitude).toBe(-112);
    });
  });
});
