// ────────────────────────────────────────────────────────────
// Open-Meteo Weather API Client
// Commercial plan required for monetized use.
// https://open-meteo.com/en/docs
// ────────────────────────────────────────────────────────────

import type { ForecastResponse } from '../types';

const COMMERCIAL_KEY = process.env.EXPO_PUBLIC_OPEN_METEO_API_KEY ?? '';
const BASE_URL = COMMERCIAL_KEY
  ? 'https://customer-api.open-meteo.com/v1/forecast'
  : 'https://api.open-meteo.com/v1/forecast';

interface FetchForecastOptions {
  latitude: number;
  longitude: number;
  forecastDays?: number; // 1-16, default 7
  temperatureUnit?: 'fahrenheit' | 'celsius';
  windSpeedUnit?: 'mph' | 'kmh' | 'knots';
}

export async function fetchForecast(options: FetchForecastOptions): Promise<ForecastResponse> {
  const {
    latitude,
    longitude,
    forecastDays = 7,
    temperatureUnit = 'fahrenheit',
    windSpeedUnit = 'mph',
  } = options;

  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    forecast_days: forecastDays.toString(),
    temperature_unit: temperatureUnit,
    wind_speed_unit: windSpeedUnit,
    hourly: [
      'temperature_2m',
      'relative_humidity_2m',
      'precipitation_probability',
      'wind_speed_10m',
      'apparent_temperature',
      'uv_index',
      'weather_code',
    ].join(','),
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_probability_max',
      'wind_speed_10m_max',
      'wind_direction_10m_dominant',
      'uv_index_max',
      'weather_code',
    ].join(','),
    timezone: 'auto',
    ...(COMMERCIAL_KEY ? { apikey: COMMERCIAL_KEY } : {}),
  });

  const response = await fetch(`${BASE_URL}?${params}`);

  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<ForecastResponse>;
}
