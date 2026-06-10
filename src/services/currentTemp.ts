// ────────────────────────────────────────────────────────────
// getCurrentTemperature -- extract the current hour's temperature
// from an HourlyForecast object.
//
// Open-Meteo `time` entries look like "2026-05-27T09:00" (local time,
// no timezone suffix). We compare the first 13 chars ("2026-05-27T09")
// against a LOCAL-time prefix computed via Intl.DateTimeFormat with
// the location's IANA timezone.
//
// Why NOT toISOString()? toISOString() always returns UTC. For a user
// in America/Chicago (UTC-5), UTC 14:00 is local 09:00 -- the forecast
// has "T09:00" but the old code looked for "T14:00", never matching.
// This was DATA-002.
//
// String-prefix matching is used intentionally -- see CLAUDE.md
// Critical Rule #1. Do NOT refactor to use `new Date()` on the
// forecast timestamp strings.
// ────────────────────────────────────────────────────────────

import type { HourlyForecast } from '../types';

/**
 * Compute the current local-time hour prefix ("YYYY-MM-DDTHH") for the
 * given IANA timezone using Intl.DateTimeFormat.
 *
 * Swedish locale ("sv") is used because its date/time format is
 * "YYYY-MM-DD HH:mm:ss" -- swapping the space for "T" and slicing to 13
 * gives the prefix we need without any manual zero-padding.
 */
function localHourPrefix(tz: string): string {
  return new Intl.DateTimeFormat('sv', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  })
    .format(new Date())
    .replace(' ', 'T')
    .slice(0, 13);
}

/**
 * Returns the temperature (rounded to nearest integer) for the
 * current local hour at the given timezone, or null if no matching
 * entry exists.
 *
 * @param hourly   Open-Meteo hourly forecast (local-time timestamps, no suffix)
 * @param timezone IANA timezone string for the location, e.g. "America/Chicago"
 */
export function getCurrentTemperature(hourly: HourlyForecast, timezone: string): number | null {
  const localPrefix = localHourPrefix(timezone); // e.g. "2026-05-27T09"
  const idx = hourly.time.findIndex((t) => t.slice(0, 13) === localPrefix);
  if (idx === -1) return null;
  return Math.round(hourly.temperature_2m[idx]);
}
