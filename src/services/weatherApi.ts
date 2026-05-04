// ─────────────────────────────────────────────────────────────────────────────
// Weather API Client — proxies through the get-forecast Edge Function.
//
// ARCHITECTURE CHANGE (2026-04-24):
//   Previously this file called Open-Meteo directly using
//   EXPO_PUBLIC_OPEN_METEO_API_KEY. That key was visible to anyone who
//   decompiled the APK — a direct violation of the Open-Meteo commercial
//   license terms. All requests now route through the get-forecast Edge
//   Function, which holds the key server-side as a Supabase function secret.
//
// AFTER DEPLOYING THIS CHANGE, Jimmy must:
//   1. Revoke the current commercial key at customer.open-meteo.com
//   2. Issue a new key and set it as:
//        npx supabase secrets set OPEN_METEO_API_KEY=<new-key>
//   3. Remove EXPO_PUBLIC_OPEN_METEO_API_KEY from EAS:
//        eas env:delete --name EXPO_PUBLIC_OPEN_METEO_API_KEY --non-interactive
//      (do this for both preview and production profiles)
//   4. Deploy the get-forecast function:
//        npx supabase functions deploy get-forecast
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from '../utils/supabase';
import type { ForecastResponse } from '../types';

interface FetchForecastOptions {
  latitude: number;
  longitude: number;
  forecastDays?: number;
  temperatureUnit?: 'fahrenheit' | 'celsius';
  windSpeedUnit?: 'mph' | 'kmh' | 'knots';
}

export async function fetchForecast(
  options: FetchForecastOptions
): Promise<ForecastResponse> {
  const {
    latitude,
    longitude,
    forecastDays = 7,
    temperatureUnit = 'fahrenheit',
    windSpeedUnit = 'mph',
  } = options;

  const { data, error } = await supabase.functions.invoke('get-forecast', {
    body: {
      latitude,
      longitude,
      forecast_days: forecastDays,
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
        'precipitation',
        'surface_pressure',
        'snowfall',
        'snow_depth',
        'soil_temperature_0cm',
      ],
      daily: [
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_probability_max',
        'wind_speed_10m_max',
        'wind_direction_10m_dominant',
        'uv_index_max',
        'weather_code',
        'precipitation_sum',
      ],
    },
  });

  if (error) {
    throw new Error(`Weather API error: ${error.message}`);
  }

  return data as ForecastResponse;
}
