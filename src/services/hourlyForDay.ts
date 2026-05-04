// ────────────────────────────────────────────────────────────
// getHourlyForDay — filter a HourlyForecast to a single local day.
//
// Open-Meteo returns `time` as location-local ISO strings (we pass
// timezone=auto), e.g. "2026-04-09T14:00". No timezone suffix, no Z.
// Match on the "YYYY-MM-DD" prefix to avoid JS Date timezone drift.
// ────────────────────────────────────────────────────────────

import type { HourlyForecast } from '../types';

export function getHourlyForDay(hourly: HourlyForecast, isoDate: string): HourlyForecast {
  const indices: number[] = [];
  for (let i = 0; i < hourly.time.length; i++) {
    // Match strictly on the date prefix. An ISO timestamp like
    // "2026-04-09T14:00" .startsWith("2026-04-09") is true; the separator
    // char at position 10 ("T") prevents collisions with e.g. "2026-04-091".
    if (hourly.time[i].startsWith(isoDate)) {
      indices.push(i);
    }
  }

  const pick = <T>(arr: T[]): T[] => indices.map((i) => arr[i]);
  // Optional arrays — only include in the result when the source is present.
  const pickOpt = <T>(arr: T[] | undefined): T[] | undefined =>
    arr !== undefined ? pick(arr) : undefined;

  return {
    time: pick(hourly.time),
    temperature_2m: pick(hourly.temperature_2m),
    relative_humidity_2m: pick(hourly.relative_humidity_2m),
    precipitation_probability: pick(hourly.precipitation_probability),
    wind_speed_10m: pick(hourly.wind_speed_10m),
    apparent_temperature: pick(hourly.apparent_temperature),
    uv_index: pick(hourly.uv_index),
    weather_code: pick(hourly.weather_code),
    // Optional new metric fields — forwarded when present in the source.
    precipitation: pickOpt(hourly.precipitation),
    surface_pressure: pickOpt(hourly.surface_pressure),
    snowfall: pickOpt(hourly.snowfall),
    snow_depth: pickOpt(hourly.snow_depth),
    soil_temperature_0cm: pickOpt(hourly.soil_temperature_0cm),
  };
}
