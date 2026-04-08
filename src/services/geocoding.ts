/**
 * Geocoding service
 * Client for the Open-Meteo Geocoding API (free, no key required)
 * Provides location search for autocomplete functionality
 */

/**
 * Typed result from Open-Meteo Geocoding API
 * All optional fields may be missing for rural locations
 */
export interface GeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  country_code?: string;
  admin1?: string; // state/region
  admin2?: string; // county/district
  timezone?: string;
}

/**
 * API response shape from Open-Meteo
 */
interface OpenMeteoResponse {
  results?: GeocodingResult[] | null;
  generationtime_ms?: number;
}

const OPEN_METEO_BASE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const MIN_QUERY_LENGTH = 2;
const DEFAULT_LIMIT = 5;

/**
 * Formats a GeocodingResult for display in a dropdown/list
 * Prioritizes admin1 (state/region) over admin2 (county/district)
 *
 * Examples:
 *   "Paris, Île-de-France, France"
 *   "Austin, Texas, United States"
 *   "Gruver, Texas, United States"  (no admin2)
 *   "Timbuktu, Mali"                 (no admin1)
 *   "Somewhere"                      (no country)
 */
export function formatLocationLabel(result: GeocodingResult): string {
  const parts: string[] = [result.name];

  if (result.admin1) {
    parts.push(result.admin1);
  }

  if (result.country) {
    parts.push(result.country);
  }

  return parts.join(', ');
}

/**
 * Searches for places matching the query using Open-Meteo Geocoding API
 *
 * Behavior:
 * - Returns [] if query is empty or < 2 chars (after trimming) — avoids spamming API
 * - Returns [] if Open-Meteo returns no results (results: null or missing)
 * - Throws Error on network failure or non-2xx response (caller handles for UI)
 * - Max 5 results by default, configurable via second arg
 *
 * @param query Search string (e.g., "Paris", "New York")
 * @param limit Maximum number of results (default: 5)
 * @returns Array of matching places, or [] if no matches
 * @throws Error on network failure or HTTP error response
 */
export async function searchPlaces(query: string, limit: number = DEFAULT_LIMIT): Promise<GeocodingResult[]> {
  // Trim and validate query length
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < MIN_QUERY_LENGTH) {
    return [];
  }

  // Build request URL with required parameters
  const params = new URLSearchParams({
    name: trimmedQuery,
    count: limit.toString(),
    language: 'en',
    format: 'json',
  });

  const url = `${OPEN_METEO_BASE_URL}?${params.toString()}`;

  // Make request
  const response = await fetch(url);

  // Validate HTTP status
  if (!response.ok) {
    throw new Error(`Geocoding API error: ${response.status} ${response.statusText}`);
  }

  // Parse JSON response
  const data: OpenMeteoResponse = await response.json();

  // Return results or empty array if no matches
  return data.results ?? [];
}
