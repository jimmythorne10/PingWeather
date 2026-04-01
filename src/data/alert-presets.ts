// ────────────────────────────────────────────────────────────
// Alert Presets — Quick-start templates for common use cases
// ────────────────────────────────────────────────────────────

import type { AlertPreset } from '../types';

export const ALERT_PRESETS: AlertPreset[] = [
  // ── Livestock / Agriculture ──────────────────────────────
  {
    id: 'freeze-warning',
    name: 'Freeze Warning',
    description: 'Alert when temperature drops below 32°F within 24 hours. Protect water troughs and livestock.',
    icon: '🧊',
    category: 'livestock',
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
    description: 'Alert when temperature drops below 20°F. Pipes, livestock, and equipment at serious risk.',
    icon: '❄️',
    category: 'livestock',
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
    description: 'Alert when temperature exceeds 100°F. Heat stress risk for animals and workers.',
    icon: '🔥',
    category: 'livestock',
    conditions: [
      { metric: 'temperature_high', operator: 'gt', value: 100, unit: 'fahrenheit' },
    ],
    logical_operator: 'AND',
    lookahead_hours: 48,
    polling_interval_hours: 4,
    cooldown_hours: 12,
  },

  // ── Hunting ──────────────────────────────────────────────
  {
    id: 'rain-hunting',
    name: 'Rain Alert (Hunting)',
    description: 'Alert when rain probability exceeds 50% in the next 3 days. Plan around wet conditions.',
    icon: '🌧️',
    category: 'hunting',
    conditions: [
      { metric: 'precipitation_probability', operator: 'gt', value: 50, unit: 'percent' },
    ],
    logical_operator: 'AND',
    lookahead_hours: 72,
    polling_interval_hours: 4,
    cooldown_hours: 12,
  },
  {
    id: 'cold-front-hunting',
    name: 'Cold Front Incoming',
    description: 'Alert when daily high drops 15°F+ from current. Deer move heavily during cold fronts.',
    icon: '🦌',
    category: 'hunting',
    conditions: [
      // This is a differential alert — requires special handling in the evaluator.
      // Stored as temperature_high lt (current - 15), evaluated dynamically.
      { metric: 'temperature_high', operator: 'lt', value: -15, unit: 'fahrenheit' },
    ],
    logical_operator: 'AND',
    lookahead_hours: 72,
    polling_interval_hours: 4,
    cooldown_hours: 24,
  },
  {
    id: 'high-wind-hunting',
    name: 'High Wind Warning',
    description: 'Alert when wind exceeds 20 mph. Scent dispersal and shot accuracy affected.',
    icon: '💨',
    category: 'hunting',
    conditions: [
      { metric: 'wind_speed', operator: 'gt', value: 20, unit: 'mph' },
    ],
    logical_operator: 'AND',
    lookahead_hours: 48,
    polling_interval_hours: 4,
    cooldown_hours: 12,
  },

  // ── Outdoor Work ─────────────────────────────────────────
  {
    id: 'rain-work',
    name: 'Rain Delay Risk',
    description: 'Alert when rain probability exceeds 60% in next 8 hours. Plan work schedule.',
    icon: '🏗️',
    category: 'outdoor_work',
    conditions: [
      { metric: 'precipitation_probability', operator: 'gt', value: 60, unit: 'percent' },
    ],
    logical_operator: 'AND',
    lookahead_hours: 8,
    polling_interval_hours: 4,
    cooldown_hours: 6,
  },
  {
    id: 'high-wind-work',
    name: 'High Wind (Work Safety)',
    description: 'Alert when wind exceeds 30 mph. Unsafe for elevated work and crane operations.',
    icon: '⚠️',
    category: 'outdoor_work',
    conditions: [
      { metric: 'wind_speed', operator: 'gt', value: 30, unit: 'mph' },
    ],
    logical_operator: 'AND',
    lookahead_hours: 24,
    polling_interval_hours: 4,
    cooldown_hours: 8,
  },

  // ── General ──────────────────────────────────────────────
  {
    id: 'rain-general',
    name: 'Rain Incoming',
    description: 'Alert when there is a high chance of rain in the next 24 hours.',
    icon: '☔',
    category: 'general',
    conditions: [
      { metric: 'precipitation_probability', operator: 'gt', value: 70, unit: 'percent' },
    ],
    logical_operator: 'AND',
    lookahead_hours: 24,
    polling_interval_hours: 12,
    cooldown_hours: 12,
  },
  {
    id: 'high-uv',
    name: 'High UV Index',
    description: 'Alert when UV index exceeds 8. Protect skin and limit outdoor exposure.',
    icon: '☀️',
    category: 'general',
    conditions: [
      { metric: 'uv_index', operator: 'gt', value: 8, unit: 'index' },
    ],
    logical_operator: 'AND',
    lookahead_hours: 24,
    polling_interval_hours: 12,
    cooldown_hours: 24,
  },
];
