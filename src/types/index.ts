// ────────────────────────────────────────────────────────────
// PingWeather Core Types
// ────────────────────────────────────────────────────────────

// Subscription tiers
export type SubscriptionTier = 'free' | 'pro' | 'premium';

export interface TierLimits {
  maxLocations: number;
  maxAlertRules: number;
  minPollingIntervalHours: number;
  compoundConditions: boolean;
  alertHistoryDays: number;
  smsAlerts: boolean;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    maxLocations: 1,
    maxAlertRules: 2,
    minPollingIntervalHours: 12,
    compoundConditions: false,
    alertHistoryDays: 7,
    smsAlerts: false,
  },
  pro: {
    maxLocations: 3,
    maxAlertRules: 5,
    minPollingIntervalHours: 4,
    compoundConditions: true,
    alertHistoryDays: 30,
    smsAlerts: false,
  },
  premium: {
    maxLocations: 10,
    maxAlertRules: 999, // effectively unlimited
    minPollingIntervalHours: 1,
    compoundConditions: true,
    alertHistoryDays: 90,
    smsAlerts: true,
  },
};

// User profile
export interface Profile {
  id: string;
  email: string;
  display_name: string;
  subscription_tier: SubscriptionTier;
  onboarding_completed: boolean;
  eula_accepted_version: string | null;
  eula_accepted_at: string | null;
  push_token: string | null;
  digest_enabled: boolean;
  digest_frequency: 'daily' | 'weekly';
  digest_hour: number;
  digest_day_of_week: number;
  digest_location_id: string | null;
  digest_last_sent_at: string | null;
  temperature_unit: 'fahrenheit' | 'celsius';
  wind_speed_unit: WindSpeedUnit;
  created_at: string;
  updated_at: string;
}

// Location
export interface WatchLocation {
  id: string;
  user_id: string;
  name: string; // e.g., "North Pasture", "Job Site #2"
  latitude: number;
  longitude: number;
  is_active: boolean;
  is_default?: boolean;
  timezone?: string | null;
  created_at: string;
}

// Weather conditions that can be monitored
export type WeatherMetric =
  | 'temperature_high'
  | 'temperature_low'
  | 'temperature_current'
  | 'precipitation_probability'
  | 'wind_speed'
  | 'humidity'
  | 'feels_like'
  | 'uv_index'
  | 'precipitation_amount'
  | 'barometric_pressure'
  | 'snowfall'
  | 'snow_depth'
  | 'soil_temperature'
  | 'weather_code'
  | 'moon_phase'
  | 'wind_gusts'
  | 'dew_point'
  | 'visibility'
  | 'cloud_cover'
  | 'wind_direction'
  | 'pressure_tendency';

export type ComparisonOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'from_bearing';

export type TemperatureUnit = 'fahrenheit' | 'celsius';
export type WindSpeedUnit = 'mph' | 'kmh' | 'knots';

// Alert rule configuration
export interface AlertCondition {
  metric: WeatherMetric;
  operator: ComparisonOperator;
  value: number;
  unit?: TemperatureUnit | WindSpeedUnit | 'percent' | 'index' | 'hPa' | 'mm' | 'in' | 'cm' | '%illumination' | 'miles' | 'km' | 'degrees';
  /** Used by the `from_bearing` operator — how many degrees either side of `value` to trigger. */
  tolerance?: number;
}

export type LogicalOperator = 'AND' | 'OR';

export interface AlertRule {
  id: string;
  user_id: string;
  location_id: string;
  name: string; // e.g., "Freeze Warning", "Rain Alert"
  conditions: AlertCondition[];
  logical_operator: LogicalOperator; // how to combine multiple conditions
  lookahead_hours: number; // how far ahead to check (e.g., 72 = 3 days)
  polling_interval_hours: number; // how often to check
  is_active: boolean;
  cooldown_hours: number; // minimum hours between repeat alerts
  last_triggered_at: string | null;
  /** Internal stamp written by poll-weather after each poll run. */
  last_polled_at: string | null;
  created_at: string;
  updated_at: string;
}

// Alert history entry
export interface AlertHistoryEntry {
  id: string;
  user_id: string;
  rule_id: string;
  rule_name: string;
  location_name: string;
  conditions_met: string; // human-readable summary
  forecast_data: Record<string, unknown>; // snapshot of relevant forecast data
  triggered_at: string;
  notification_sent: boolean;
}

// Preset templates for common use cases
export interface AlertPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'temperature' | 'precipitation' | 'wind' | 'work' | 'severe';
  conditions: AlertCondition[];
  logical_operator: LogicalOperator;
  lookahead_hours: number;
  polling_interval_hours: number;
  cooldown_hours: number;
}

// Open-Meteo forecast response (simplified)
export interface HourlyForecast {
  time: string[];
  temperature_2m: number[];
  relative_humidity_2m: number[];
  precipitation_probability: number[];
  wind_speed_10m: number[];
  apparent_temperature: number[];
  uv_index: number[];
  weather_code: number[];
  // Optional new fields — present when the caller requests them
  precipitation?: number[];        // mm
  surface_pressure?: number[];     // hPa
  snowfall?: number[];             // cm
  snow_depth?: number[];           // cm
  soil_temperature_0cm?: number[]; // °C
  wind_gusts_10m?: number[];       // mph — wind gusts
  dew_point_2m?: number[];         // °F or °C — follows temperature_unit
  visibility?: number[];           // meters raw from API (convert to miles in getMetricValues)
  cloud_cover?: number[];          // % cloud cover
  wind_direction_10m?: number[];   // degrees 0-360 (0=N, 90=E, 180=S, 270=W)
}

export interface DailyForecast {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_probability_max: number[];
  wind_speed_10m_max: number[];
  wind_direction_10m_dominant: number[];
  uv_index_max: number[];
  weather_code: number[];
  precipitation_sum?: number[];
}

export interface ForecastResponse {
  latitude: number;
  longitude: number;
  hourly: HourlyForecast;
  daily: DailyForecast;
}
