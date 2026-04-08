/**
 * Unit tests for geocoding service
 * Tests the Open-Meteo Geocoding API client with mocked fetch
 */

import { searchPlaces, formatLocationLabel, GeocodingResult } from '../../src/services/geocoding';

describe('geocoding service', () => {
  beforeEach(() => {
    // Clear fetch mock before each test
    jest.clearAllMocks();
  });

  describe('formatLocationLabel', () => {
    it('formats location with name, admin1, and country', () => {
      const result: GeocodingResult = {
        id: 2988507,
        name: 'Paris',
        latitude: 48.85341,
        longitude: 2.3488,
        country: 'France',
        country_code: 'FR',
        admin1: 'Île-de-France',
        admin2: 'Paris',
      };

      const label = formatLocationLabel(result);
      expect(label).toBe('Paris, Île-de-France, France');
    });

    it('formats location without admin1 (rural area)', () => {
      const result: GeocodingResult = {
        id: 123,
        name: 'Timbuktu',
        latitude: 16.7667,
        longitude: -3.0026,
        country: 'Mali',
        country_code: 'ML',
      };

      const label = formatLocationLabel(result);
      expect(label).toBe('Timbuktu, Mali');
    });

    it('formats location without admin2 (state level)', () => {
      const result: GeocodingResult = {
        id: 123,
        name: 'Austin',
        latitude: 30.2672,
        longitude: -97.7431,
        country: 'United States',
        country_code: 'US',
        admin1: 'Texas',
      };

      const label = formatLocationLabel(result);
      expect(label).toBe('Austin, Texas, United States');
    });

    it('formats location with only name and country (no admin fields)', () => {
      const result: GeocodingResult = {
        id: 123,
        name: 'Gruver',
        latitude: 36.26,
        longitude: -101.56,
        country: 'United States',
        country_code: 'US',
      };

      const label = formatLocationLabel(result);
      expect(label).toBe('Gruver, United States');
    });

    it('formats location with only name when no country provided', () => {
      const result: GeocodingResult = {
        id: 123,
        name: 'Somewhere',
        latitude: 0,
        longitude: 0,
      };

      const label = formatLocationLabel(result);
      expect(label).toBe('Somewhere');
    });

    it('prioritizes admin1 over admin2 when both present', () => {
      const result: GeocodingResult = {
        id: 123,
        name: 'Springfield',
        latitude: 39.76,
        longitude: -89.65,
        country: 'United States',
        country_code: 'US',
        admin1: 'Illinois',
        admin2: 'Sangamon County',
      };

      const label = formatLocationLabel(result);
      expect(label).toBe('Springfield, Illinois, United States');
    });
  });

  describe('searchPlaces', () => {
    it('returns empty array for empty query without calling fetch', async () => {
      const mockFetch = jest.spyOn(global, 'fetch');

      const result = await searchPlaces('');

      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns empty array for whitespace-only query without calling fetch', async () => {
      const mockFetch = jest.spyOn(global, 'fetch');

      const result = await searchPlaces('   ');

      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns empty array for 1-character query without calling fetch', async () => {
      const mockFetch = jest.spyOn(global, 'fetch');

      const result = await searchPlaces('a');

      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('calls fetch with correct URL for valid 2-character query', async () => {
      const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          results: [],
          generationtime_ms: 0.1,
        }))
      );

      await searchPlaces('ny');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://geocoding-api.open-meteo.com/v1/search')
      );
    });

    it('parses and returns results from successful API response', async () => {
      const mockResults = [
        {
          id: 2988507,
          name: 'Paris',
          latitude: 48.85341,
          longitude: 2.3488,
          country_code: 'FR',
          country: 'France',
          admin1: 'Île-de-France',
          admin2: 'Paris',
          timezone: 'Europe/Paris',
        },
      ];

      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          results: mockResults,
          generationtime_ms: 0.37,
        }))
      );

      const result = await searchPlaces('paris');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockResults[0]);
    });

    it('returns empty array when API returns no results (results key missing)', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          generationtime_ms: 0.1,
        }))
      );

      const result = await searchPlaces('nonexistent place xyz');

      expect(result).toEqual([]);
    });

    it('returns empty array when API returns null results', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          results: null,
          generationtime_ms: 0.1,
        }))
      );

      const result = await searchPlaces('nonexistent place xyz');

      expect(result).toEqual([]);
    });

    it('throws Error on network failure (fetch rejects)', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network timeout'));

      await expect(searchPlaces('paris')).rejects.toThrow();
    });

    it('throws Error on non-2xx HTTP response', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Bad request' }), { status: 400 })
      );

      await expect(searchPlaces('paris')).rejects.toThrow();
    });

    it('throws Error on 500 server error', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
      );

      await expect(searchPlaces('paris')).rejects.toThrow();
    });

    it('URL-encodes the query parameter', async () => {
      const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          results: [],
          generationtime_ms: 0.1,
        }))
      );

      await searchPlaces('new york');

      const callUrl = (mockFetch.mock.calls[0][0] as string);
      expect(callUrl).toContain('name=new+york');
    });

    it('respects custom limit parameter (fewer than default)', async () => {
      const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          results: [],
          generationtime_ms: 0.1,
        }))
      );

      await searchPlaces('paris', 3);

      const callUrl = (mockFetch.mock.calls[0][0] as string);
      expect(callUrl).toContain('count=3');
    });

    it('defaults to limit of 5 when not specified', async () => {
      const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          results: [],
          generationtime_ms: 0.1,
        }))
      );

      await searchPlaces('paris');

      const callUrl = (mockFetch.mock.calls[0][0] as string);
      expect(callUrl).toContain('count=5');
    });

    it('returns up to the specified number of results', async () => {
      const mockResults = Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        name: `Place ${i + 1}`,
        latitude: i,
        longitude: i,
        country: 'TestLand',
      }));

      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          results: mockResults,
          generationtime_ms: 0.1,
        }))
      );

      const result = await searchPlaces('place', 5);

      expect(result).toHaveLength(5);
    });

    it('handles results with missing optional fields', async () => {
      const mockResults = [
        {
          id: 123,
          name: 'Rural Place',
          latitude: 45.0,
          longitude: -120.0,
          // Missing: country_code, country, admin1, admin2, timezone, population
        },
      ];

      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          results: mockResults,
          generationtime_ms: 0.1,
        }))
      );

      const result = await searchPlaces('rural');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Rural Place');
      expect(result[0].country).toBeUndefined();
      expect(result[0].admin1).toBeUndefined();
    });

    it('includes timezone in results when present', async () => {
      const mockResults = [
        {
          id: 2988507,
          name: 'Paris',
          latitude: 48.85341,
          longitude: 2.3488,
          country: 'France',
          country_code: 'FR',
          admin1: 'Île-de-France',
          timezone: 'Europe/Paris',
        },
      ];

      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          results: mockResults,
          generationtime_ms: 0.1,
        }))
      );

      const result = await searchPlaces('paris');

      expect(result[0].timezone).toBe('Europe/Paris');
    });

    it('calls API with correct query parameters (name, count, language, format)', async () => {
      const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          results: [],
          generationtime_ms: 0.1,
        }))
      );

      await searchPlaces('sydney');

      const callUrl = (mockFetch.mock.calls[0][0] as string);
      expect(callUrl).toContain('https://geocoding-api.open-meteo.com/v1/search');
      expect(callUrl).toContain('language=en');
      expect(callUrl).toContain('format=json');
    });

    it('trims whitespace from query before validation', async () => {
      const mockFetch = jest.spyOn(global, 'fetch');

      // Query with leading/trailing whitespace that becomes < 2 chars after trim
      await searchPlaces('  a  ');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('makes valid request for 2-char trimmed query', async () => {
      const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          results: [],
          generationtime_ms: 0.1,
        }))
      );

      await searchPlaces('  ab  ');

      expect(mockFetch).toHaveBeenCalled();
    });
  });
});
