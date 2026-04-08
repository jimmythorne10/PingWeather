/**
 * Tests for weatherApi — FR-HOME-001, FR-FORECAST-002
 *
 * Validates Open-Meteo API client: URL construction, error handling,
 * unit options, and requested hourly/daily fields.
 */

import { fetchForecast } from '../../src/services/weatherApi';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

function mockFetchSuccess(body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
  } as any);
}

function mockFetchError(status: number, statusText: string) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status,
    statusText,
    json: async () => ({}),
  } as any);
}

function getLastCallUrl(): string {
  const mockFn = global.fetch as unknown as jest.Mock;
  return mockFn.mock.calls[0][0] as string;
}

const mockResponse = {
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
  // ── URL construction ──────────────────────────────────────

  describe('URL parameters', () => {
    it('constructs URL with latitude and longitude', async () => {
      // FR-HOME-001: fetches from Open-Meteo with location
      mockFetchSuccess(mockResponse);

      await fetchForecast({ latitude: 33.4484, longitude: -112.074 });

      const url = getLastCallUrl();
      expect(url).toContain('latitude=33.4484');
      expect(url).toContain('longitude=-112.074');
    });

    it('uses the Open-Meteo forecast endpoint', async () => {
      mockFetchSuccess(mockResponse);

      await fetchForecast({ latitude: 0, longitude: 0 });

      expect(getLastCallUrl()).toContain('api.open-meteo.com/v1/forecast');
    });

    it('defaults to 7 forecast days', async () => {
      mockFetchSuccess(mockResponse);

      await fetchForecast({ latitude: 0, longitude: 0 });

      expect(getLastCallUrl()).toContain('forecast_days=7');
    });

    it('supports custom forecast days (14 for FR-HOME-002/FR-FORECAST-002)', async () => {
      // FR-HOME-002: 14-day forecast
      mockFetchSuccess(mockResponse);

      await fetchForecast({ latitude: 0, longitude: 0, forecastDays: 14 });

      expect(getLastCallUrl()).toContain('forecast_days=14');
    });

    it('defaults to Fahrenheit temperature unit', async () => {
      mockFetchSuccess(mockResponse);

      await fetchForecast({ latitude: 0, longitude: 0 });

      expect(getLastCallUrl()).toContain('temperature_unit=fahrenheit');
    });

    it('supports Celsius temperature unit', async () => {
      // FR-FORECAST-002: respects user's unit preferences
      mockFetchSuccess(mockResponse);

      await fetchForecast({ latitude: 0, longitude: 0, temperatureUnit: 'celsius' });

      expect(getLastCallUrl()).toContain('temperature_unit=celsius');
    });

    it('defaults to mph wind speed unit', async () => {
      mockFetchSuccess(mockResponse);

      await fetchForecast({ latitude: 0, longitude: 0 });

      expect(getLastCallUrl()).toContain('wind_speed_unit=mph');
    });

    it('supports km/h wind speed unit', async () => {
      // FR-FORECAST-002: supports mph/kmh/knots
      mockFetchSuccess(mockResponse);

      await fetchForecast({ latitude: 0, longitude: 0, windSpeedUnit: 'kmh' });

      expect(getLastCallUrl()).toContain('wind_speed_unit=kmh');
    });

    it('supports knots wind speed unit', async () => {
      mockFetchSuccess(mockResponse);

      await fetchForecast({ latitude: 0, longitude: 0, windSpeedUnit: 'knots' });

      expect(getLastCallUrl()).toContain('wind_speed_unit=knots');
    });

    it('uses timezone=auto for location-aware times', async () => {
      // FR-LOC-007: timezone auto-detected from coordinates
      mockFetchSuccess(mockResponse);

      await fetchForecast({ latitude: 0, longitude: 0 });

      expect(getLastCallUrl()).toContain('timezone=auto');
    });
  });

  // ── Requested fields ──────────────────────────────────────

  describe('requested hourly fields', () => {
    beforeEach(() => mockFetchSuccess(mockResponse));

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
        await fetchForecast({ latitude: 0, longitude: 0 });
        const url = decodeURIComponent(getLastCallUrl());
        expect(url).toContain(field);
      });
    });
  });

  describe('requested daily fields', () => {
    beforeEach(() => mockFetchSuccess(mockResponse));

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
        await fetchForecast({ latitude: 0, longitude: 0 });
        const url = decodeURIComponent(getLastCallUrl());
        expect(url).toContain(field);
      });
    });
  });

  // ── Error handling ────────────────────────────────────────

  describe('error handling', () => {
    it('throws on non-OK HTTP response', async () => {
      // FR-HOME-001: error state if API call fails
      mockFetchError(500, 'Internal Server Error');

      await expect(fetchForecast({ latitude: 0, longitude: 0 })).rejects.toThrow(
        /Weather API error/,
      );
    });

    it('throws on 404 not found', async () => {
      mockFetchError(404, 'Not Found');

      await expect(fetchForecast({ latitude: 0, longitude: 0 })).rejects.toThrow(/404/);
    });

    it('includes status code in error message', async () => {
      mockFetchError(503, 'Service Unavailable');

      await expect(fetchForecast({ latitude: 0, longitude: 0 })).rejects.toThrow(/503/);
    });
  });

  // ── Response parsing ──────────────────────────────────────

  describe('response parsing', () => {
    it('returns parsed JSON response', async () => {
      mockFetchSuccess(mockResponse);

      const result = await fetchForecast({ latitude: 33.4, longitude: -112 });

      expect(result).toEqual(mockResponse);
      expect(result.latitude).toBe(33.4);
      expect(result.longitude).toBe(-112);
    });
  });
});
