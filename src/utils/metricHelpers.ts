import type { WeatherMetric, AlertCondition } from '../types';

// Named moon phase presets — maps a human-readable phase to an illumination
// percentage threshold. Used in the rule builder to replace raw % input.
export const MOON_PHASE_PRESETS = [
  { label: '🌑 New Moon',      value: 5,  description: '≤10% lit' },
  { label: '🌒 Crescent',      value: 25, description: '~25% lit' },
  { label: '🌓 Quarter',       value: 50, description: '~50% lit' },
  { label: '🌔 Gibbous',       value: 75, description: '~75% lit' },
  { label: '🌕 Full Moon',     value: 95, description: '≥90% lit' },
] as const;

export type MoonPhasePreset = (typeof MOON_PHASE_PRESETS)[number];

/**
 * Returns the stored unit string for a given metric.
 *
 * temperatureUnit defaults to 'fahrenheit' — matches what poll-weather and
 * get-forecast both request from Open-Meteo (temperature_unit=fahrenheit).
 * This includes soil_temperature_0cm: Open-Meteo converts all temperature
 * variables when temperature_unit is set, so values come back in °F.
 */
export function getUnitForMetric(
  metric: WeatherMetric | string,
  temperatureUnit: 'fahrenheit' | 'celsius' = 'fahrenheit',
): AlertCondition['unit'] {
  // All temperature fields (including soil) follow the user's unit preference.
  // poll-weather fetches with temperature_unit=fahrenheit, so Open-Meteo returns
  // fahrenheit for all temperature variables including soil_temperature_0cm.
  if (
    metric === 'temperature_high' ||
    metric === 'temperature_low' ||
    metric === 'temperature_current' ||
    metric === 'feels_like' ||
    metric === 'soil_temperature'
  ) {
    return temperatureUnit;
  }
  if (metric === 'precipitation_probability' || metric === 'humidity') return 'percent';
  if (metric === 'wind_speed') return 'mph';
  if (metric === 'uv_index') return 'index';
  if (metric === 'barometric_pressure') return 'hPa';
  if (metric === 'precipitation_amount') return 'mm';
  if (metric === 'snowfall' || metric === 'snow_depth') return 'cm';
  if (metric === 'moon_phase') return '%illumination';
  // weather_code is a unitless WMO integer
  return undefined;
}

/**
 * Human-readable unit label for display next to a value input.
 * Distinct from the stored unit string — e.g. 'fahrenheit' → '°F'.
 */
export function getUnitLabel(unit: AlertCondition['unit']): string {
  switch (unit) {
    case 'fahrenheit':    return '°F';
    case 'celsius':       return '°C';
    case 'percent':       return '%';
    case 'mph':           return 'mph';
    case 'kmh':           return 'km/h';
    case 'knots':         return 'kts';
    case 'index':         return '';
    case 'hPa':           return 'hPa';
    case 'mm':            return 'mm';
    case 'in':            return 'in';
    case 'cm':            return 'cm';
    case '%illumination': return '%';
    default:              return '';
  }
}

/** Returns the nearest MOON_PHASE_PRESETS entry for a given illumination value. */
export function nearestMoonPhasePreset(value: number): MoonPhasePreset {
  return MOON_PHASE_PRESETS.reduce((prev, curr) =>
    Math.abs(curr.value - value) < Math.abs(prev.value - value) ? curr : prev
  );
}
