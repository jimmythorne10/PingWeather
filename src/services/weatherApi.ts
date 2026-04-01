// ────────────────────────────────────────────────────────────
// Open-Meteo Weather API Client
// Free, no API key required, excellent forecast data
// https://open-meteo.com/en/docs
// ────────────────────────────────────────────────────────────

import type { ForecastResponse } from '../types';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

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
    ].join(','),
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_probability_max',
      'wind_speed_10m_max',
      'uv_index_max',
    ].join(','),
    timezone: 'auto',
  });

  const response = await fetch(`${BASE_URL}?${params}`);

  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<ForecastResponse>;
}
