// ────────────────────────────────────────────────────────────
// Alert Presets — Quick-start templates for common use cases
// Categories are neutral/general-purpose.
// ────────────────────────────────────────────────────────────

import type { AlertPreset } from '../types';

export const ALERT_PRESETS: AlertPreset[] = [
  // ── Temperature ──────────────────────────────────────────
  {
    id: 'freeze-warning',
    name: 'Freeze Warning',
    description: 'Alert when temperature drops below 32°F. Protect pipes, plants, and equipment.',
    icon: '🧊',
    category: 'temperature',
    conditions: [
      { metric: 'temperature_low', operator: 'lt', value: 32, unit: 'fahrenheit' },
    ],
    logical_operator: 'AND',
    lookahead_hours: 24,
    polling_interval_hours: 4,
    cooldown_hours: 12,
  },
  {
    id: 'hard-freeze',
    name: 'Hard Freeze',
    description: 'Alert when temperature drops below 20°F. Serious risk to pipes, plants, and equipment.',
    icon: '❄️',
    category: 'temperature',
    conditions: [
      { metric: 'temperature_low', operator: 'lt', value: 20, unit: 'fahrenheit' },
    ],
    logical_operator: 'AND',
    lookahead_hours: 48,
    polling_interval_hours: 4,
    cooldown_hours: 12,
  },
  {
    id: 'extreme-heat',
    name: 'Extreme Heat',
    description: 'Alert when temperature exceeds 100°F. Heat stress risk for people, animals, and equipment.',
    icon: '🔥',
    category: 'temperature',
    conditions: [
      { metric: 'temperature_high', operator: 'gt', value: 100, unit: 'fahrenheit' },
    ],
    logical_operator: 'AND',
    lookahead_hours: 48,
    polling_interval_hours: 4,
    cooldown_hours: 12,
  },
  {
    id: 'cold-front',
    name: 'Cold Front Incoming',
    description: 'Alert when a sharp temperature drop is expected. Plan ahead for sudden changes.',
    icon: '📉',
    category: 'temperature',
    conditions: [
      // Differential alert — evaluated dynamically by comparing forecast to current
      { metric: 'temperature_high', operator: 'lt', value: -15, unit: 'fahrenheit' },
    ],
    logical_operator: 'AND',
    lookahead_hours: 72,
    polling_interval_hours: 4,
    cooldown_hours: 24,
  },

  // ── Precipitation ────────────────────────────────────────
  {
    id: 'rain-likely',
    name: 'Rain Likely',
    description: 'Alert when rain probability exceeds 70% in the next 24 hours.',
    icon: '☔',
    category: 'precipitation',
    conditions: [
      { metric: 'precipitation_probability', operator: 'gt', value: 70, unit: 'percent' },
    ],
    logical_operator: 'AND',
    lookahead_hours: 24,
    polling_interval_hours: 12,
    cooldown_hours: 12,
  },
  {
    id: 'rain-possible',
    name: 'Rain Possible',
    description: 'Alert when rain probability exceeds 50% in the next 3 days. Good for planning ahead.',
    icon: '🌧️',
    category: 'precipitation',
    conditions: [
      { metric: 'precipitation_probability', operator: 'gt', value: 50, unit: 'percent' },
    ],
    logical_operator: 'AND',
    lookahead_hours: 72,
    polling_interval_hours: 4,
    cooldown_hours: 12,
  },

  // ── Wind ─────────────────────────────────────────────────
  {
    id: 'high-wind',
    name: 'High Wind',
    description: 'Alert when wind exceeds 25 mph. Secure loose items and outdoor equipment.',
    icon: '💨',
    category: 'wind',
    conditions: [
      { metric: 'wind_speed', operator: 'gt', value: 25, unit: 'mph' },
    ],
    logical_operator: 'AND',
    lookahead_hours: 24,
    polling_interval_hours: 4,
    cooldown_hours: 8,
  },
  {
    id: 'dangerous-wind',
    name: 'Dangerous Wind',
    description: 'Alert when wind exceeds 40 mph. Unsafe conditions for outdoor work and travel.',
    icon: '⚠️',
    category: 'wind',
    conditions: [
      { metric: 'wind_speed', operator: 'gt', value: 40, unit: 'mph' },
    ],
    logical_operator: 'AND',
    lookahead_hours: 24,
    polling_interval_hours: 4,
    cooldown_hours: 8,
  },

  // ── Work & Safety ────────────────────────────────────────
  {
    id: 'rain-delay',
    name: 'Rain Delay Risk',
    description: 'Alert when rain is likely within 8 hours. Plan your outdoor work schedule.',
    icon: '🏗️',
    category: 'work',
    conditions: [
      { metric: 'precipitation_probability', operator: 'gt', value: 60, unit: 'percent' },
    ],
    logical_operator: 'AND',
    lookahead_hours: 8,
    polling_interval_hours: 4,
    cooldown_hours: 6,
  },
  {
    id: 'high-uv',
    name: 'High UV Index',
    description: 'Alert when UV index exceeds 8. Protect skin and limit outdoor exposure.',
    icon: '☀️',
    category: 'work',
    conditions: [
      { metric: 'uv_index', operator: 'gt', value: 8, unit: 'index' },
    ],
    logical_operator: 'AND',
    lookahead_hours: 24,
    polling_interval_hours: 12,
    cooldown_hours: 24,
  },

  // ── Severe Weather ───────────────────────────────────────
  {
    id: 'thunderstorm-alert',
    name: 'Thunderstorm Alert',
    description: 'Alert when thunderstorms are forecast. WMO code ≥95 indicates thunderstorm activity.',
    icon: '⛈️',
    category: 'severe',
    conditions: [
      { metric: 'weather_code', operator: 'gte', value: 95 },
    ],
    logical_operator: 'AND',
    lookahead_hours: 12,
    polling_interval_hours: 4,
    cooldown_hours: 6,
  },
  {
    id: 'heavy-snowfall',
    name: 'Heavy Snowfall Warning',
    description: 'Alert when significant snowfall is forecast. 5 cm (~2 inches) per hour.',
    icon: '🌨️',
    category: 'severe',
    conditions: [
      { metric: 'snowfall', operator: 'gte', value: 5, unit: 'cm' },
    ],
    logical_operator: 'AND',
    lookahead_hours: 24,
    polling_interval_hours: 6,
    cooldown_hours: 12,
  },
  {
    id: 'storm-approaching',
    name: 'Storm Approaching',
    description: 'Alert when barometric pressure drops below storm threshold. Pressure ≤1005 hPa signals an approaching low-pressure system.',
    icon: '🌪️',
    category: 'severe',
    conditions: [
      { metric: 'barometric_pressure', operator: 'lte', value: 1005, unit: 'hPa' },
    ],
    logical_operator: 'AND',
    lookahead_hours: 24,
    polling_interval_hours: 4,
    cooldown_hours: 8,
  },

  // ── Nature / Moon ────────────────────────────────────────
  {
    id: 'full-moon-alert',
    name: 'Full Moon',
    description: 'Alert when moon is near full (≥85% illumination). Useful for outdoor activities, photography, and nocturnal observation.',
    icon: '🌕',
    category: 'work',
    conditions: [
      { metric: 'moon_phase', operator: 'gte', value: 85, unit: '%illumination' },
    ],
    logical_operator: 'AND',
    lookahead_hours: 72,
    polling_interval_hours: 24,
    cooldown_hours: 48,
  },

  // ── Wind Gusts ───────────────────────────────────────────────
  {
    id: 'dangerous-gusts',
    name: 'Dangerous Gusts',
    description: 'Alert when wind gusts exceed 50 mph. Risk to structures, outdoor equipment, and trees.',
    icon: '🌬️',
    category: 'wind',
    conditions: [
      { metric: 'wind_gusts', operator: 'gt', value: 50, unit: 'mph' },
    ],
    logical_operator: 'AND',
    lookahead_hours: 24,
    polling_interval_hours: 4,
    cooldown_hours: 6,
  },

  // ── Atmosphere ───────────────────────────────────────────────
  {
    id: 'low-visibility-fog',
    name: 'Low Visibility / Fog',
    description: 'Alert when visibility drops below 1 mile. Dangerous for driving and outdoor work.',
    icon: '🌫️',
    category: 'work',
    conditions: [
      { metric: 'visibility', operator: 'lt', value: 1, unit: 'miles' },
    ],
    logical_operator: 'AND',
    lookahead_hours: 12,
    polling_interval_hours: 4,
    cooldown_hours: 6,
  },
  {
    id: 'overcast-sky',
    name: 'Clear Sky Window',
    description: 'Alert when cloud cover is below 20%. Ideal for stargazing, photography, and moon observation.',
    icon: '🔭',
    category: 'work',
    conditions: [
      { metric: 'cloud_cover', operator: 'lt', value: 20, unit: 'percent' },
    ],
    logical_operator: 'AND',
    lookahead_hours: 24,
    polling_interval_hours: 6,
    cooldown_hours: 12,
  },

  // ── Farming / Planting ───────────────────────────────────
  {
    id: 'soil-warm-planting',
    name: 'Soil Warm for Planting',
    description: 'Alert when soil is warm enough for planting. 10°C (50°F) is the minimum for most crops.',
    icon: '🌱',
    category: 'work',
    conditions: [
      { metric: 'soil_temperature', operator: 'gte', value: 10, unit: 'celsius' },
    ],
    logical_operator: 'AND',
    lookahead_hours: 48,
    polling_interval_hours: 12,
    cooldown_hours: 24,
  },
];
