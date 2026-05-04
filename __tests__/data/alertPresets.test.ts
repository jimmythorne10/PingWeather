/**
 * Tests for ALERT_PRESETS — preset structure validation
 *
 * Validates that every alert preset has the required fields, valid metric/operator
 * values, valid categories, and reasonable polling intervals. These back the
 * preset flow in FR-ALERT-002.
 */

import { ALERT_PRESETS } from '../../src/data/alert-presets';
import type {
  AlertPreset,
  ComparisonOperator,
  WeatherMetric,
  LogicalOperator,
} from '../../src/types';

const VALID_METRICS: WeatherMetric[] = [
  'temperature_high',
  'temperature_low',
  'temperature_current',
  'precipitation_probability',
  'wind_speed',
  'humidity',
  'feels_like',
  'uv_index',
  // New metrics added 2026-05-03
  'precipitation_amount',
  'barometric_pressure',
  'snowfall',
  'snow_depth',
  'soil_temperature',
  'weather_code',
  'moon_phase',
  // New metrics added 2026-05-04
  'wind_gusts',
  'dew_point',
  'visibility',
  'cloud_cover',
];

const VALID_OPERATORS: ComparisonOperator[] = ['gt', 'gte', 'lt', 'lte', 'eq'];

const VALID_CATEGORIES: AlertPreset['category'][] = [
  'temperature',
  'precipitation',
  'wind',
  'work',
  'severe',
];

const VALID_LOGICAL_OPERATORS: LogicalOperator[] = ['AND', 'OR'];

describe('ALERT_PRESETS', () => {
  it('exports a non-empty array of presets', () => {
    expect(Array.isArray(ALERT_PRESETS)).toBe(true);
    expect(ALERT_PRESETS.length).toBeGreaterThan(0);
  });

  it('has unique preset ids', () => {
    const ids = ALERT_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  describe.each(ALERT_PRESETS)('preset: $id', (preset) => {
    it('has required fields', () => {
      // FR-ALERT-002: presets must have complete config
      expect(preset.id).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(preset.icon).toBeTruthy();
      expect(preset.category).toBeTruthy();
      expect(Array.isArray(preset.conditions)).toBe(true);
      expect(preset.conditions.length).toBeGreaterThan(0);
      expect(preset.logical_operator).toBeTruthy();
      expect(typeof preset.lookahead_hours).toBe('number');
      expect(typeof preset.polling_interval_hours).toBe('number');
      expect(typeof preset.cooldown_hours).toBe('number');
    });

    it('has a valid category', () => {
      expect(VALID_CATEGORIES).toContain(preset.category);
    });

    it('has a valid logical operator', () => {
      expect(VALID_LOGICAL_OPERATORS).toContain(preset.logical_operator);
    });

    it('uses only valid metrics and operators in conditions', () => {
      for (const condition of preset.conditions) {
        expect(VALID_METRICS).toContain(condition.metric);
        expect(VALID_OPERATORS).toContain(condition.operator);
        expect(typeof condition.value).toBe('number');
      }
    });

    it('has a reasonable polling interval (1-24 hours)', () => {
      // Polling intervals should be within sensible bounds and snap to tier minimums
      expect(preset.polling_interval_hours).toBeGreaterThanOrEqual(1);
      expect(preset.polling_interval_hours).toBeLessThanOrEqual(24);
    });

    it('has a reasonable lookahead (1 hour to 7 days)', () => {
      expect(preset.lookahead_hours).toBeGreaterThanOrEqual(1);
      expect(preset.lookahead_hours).toBeLessThanOrEqual(168);
    });

    it('has a reasonable cooldown (1 hour to 2 days)', () => {
      expect(preset.cooldown_hours).toBeGreaterThanOrEqual(1);
      expect(preset.cooldown_hours).toBeLessThanOrEqual(48);
    });
  });

  it('covers all 4 preset categories', () => {
    // FR-ALERT-002: Dropdown options: Temperature, Precipitation, Wind, Work & Safety
    const categories = new Set(ALERT_PRESETS.map((p) => p.category));
    expect(categories).toEqual(new Set(VALID_CATEGORIES));
  });

  it('includes a Freeze Warning preset (freeze/cold use case)', () => {
    // Target use case: freeze alerts for pipes, plants, and equipment
    const freeze = ALERT_PRESETS.find((p) => p.id === 'freeze-warning');
    expect(freeze).toBeDefined();
    expect(freeze!.category).toBe('temperature');
    expect(freeze!.conditions[0].metric).toBe('temperature_low');
    expect(freeze!.conditions[0].operator).toBe('lt');
  });
});
