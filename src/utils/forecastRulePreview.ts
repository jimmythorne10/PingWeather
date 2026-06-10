/**
 * forecastRulePreview.ts
 *
 * Pure logic for evaluating whether an AlertRule would trigger given a local
 * forecast snapshot. Used by the Forecasts screen to render the "Rule Status"
 * preview section.
 *
 * CRITICAL — timezone-safe daily date parsing:
 * Daily forecast dates from Open-Meteo are YYYY-MM-DD strings that represent
 * calendar dates in the location's local time. Using new Date("YYYY-MM-DD")
 * parses them as UTC midnight, which in western timezones (e.g., UTC-7) places
 * that instant at 5pm or 7pm the *previous* local day — causing one-day drift
 * in the lookahead window filter.
 *
 * FIX: always split the string and use new Date(y, m-1, d), which gives local
 * midnight. This is identical to the pattern used by formatDayLabel in
 * forecasts.tsx (Critical Rule #1 in CLAUDE.md).
 */

import type { AlertRule, HourlyForecast, DailyForecast } from '../types';

export interface LocationForecast {
  hourly: HourlyForecast;
  daily: DailyForecast;
}

export interface RulePreviewResult {
  triggered: boolean;
  detail: string;
}

/**
 * Parse a YYYY-MM-DD date string as a local-time Date at midnight.
 * Never use new Date(dateString) for YYYY-MM-DD — that gives UTC midnight,
 * which drifts by a full day in western timezones.
 */
function parseDailyDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Evaluate whether a rule would trigger within its lookahead window,
 * given a current forecast snapshot.
 *
 * The cutoff is derived from `new Date()` + lookahead_hours (safe — not a
 * parsed date string). Daily dates are parsed via parseDailyDate (local-time
 * safe). Hourly timestamps remain as ISO strings compared directly to Date
 * objects; they are full ISO timestamps so there is no UTC-midnight drift risk.
 */
export function ruleWouldTrigger(
  rule: AlertRule,
  forecast: LocationForecast,
): RulePreviewResult {
  const now = new Date();
  const cutoff = new Date(now.getTime() + rule.lookahead_hours * 60 * 60 * 1000);

  for (const condition of rule.conditions) {
    let values: number[] = [];

    if (condition.metric === 'temperature_low') {
      values = forecast.daily.temperature_2m_min.filter((_, i) => {
        const dayDate = parseDailyDate(forecast.daily.time[i]);
        return dayDate >= now && dayDate <= cutoff;
      });
    } else if (condition.metric === 'temperature_high') {
      values = forecast.daily.temperature_2m_max.filter((_, i) => {
        const dayDate = parseDailyDate(forecast.daily.time[i]);
        return dayDate >= now && dayDate <= cutoff;
      });
    } else if (condition.metric === 'precipitation_probability') {
      values = forecast.daily.precipitation_probability_max.filter((_, i) => {
        const dayDate = parseDailyDate(forecast.daily.time[i]);
        return dayDate >= now && dayDate <= cutoff;
      });
    } else if (condition.metric === 'wind_speed') {
      values = forecast.daily.wind_speed_10m_max.filter((_, i) => {
        const dayDate = parseDailyDate(forecast.daily.time[i]);
        return dayDate >= now && dayDate <= cutoff;
      });
    }

    for (const val of values) {
      let matched = false;
      if (condition.operator === 'gt' && val > condition.value) matched = true;
      if (condition.operator === 'gte' && val >= condition.value) matched = true;
      if (condition.operator === 'lt' && val < condition.value) matched = true;
      if (condition.operator === 'lte' && val <= condition.value) matched = true;
      if (matched) {
        return {
          triggered: true,
          detail: `${condition.metric.replace(/_/g, ' ')} ${val}`,
        };
      }
    }
  }

  return { triggered: false, detail: 'Clear' };
}
