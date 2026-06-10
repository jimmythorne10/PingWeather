import { supabase } from '../utils/supabase';

export type RainfallWindow = '24h' | '7d' | '30d';

export interface RainfallData {
  window: RainfallWindow;
  totalMm: number;
  unit: 'in' | 'mm';
  totalFormatted: string;
  days: Array<{ date: string; label: string; amount: number }>;
  // Snow fields — Open-Meteo applies precipitation_unit to snowfall, so unit matches rain
  snowTotal: number;
  snowUnit: 'in' | 'cm';
  snowTotalFormatted: string;
  snowDays: Array<{ date: string; label: string; amount: number }>;
}

// Maps Open-Meteo hourly response shape for the fields we request.
interface HourlyRaw {
  time: string[];
  precipitation: number[];
  snowfall?: number[];
}

// Maps Open-Meteo daily response shape for the fields we request.
interface DailyRaw {
  time: string[];
  precipitation_sum: number[];
  snowfall_sum?: number[];
}

interface ForecastRaw {
  hourly?: HourlyRaw;
  daily?: DailyRaw;
}

function formatDayLabel(date: string): string {
  // Safe local-date construction: pass Y/M/D integers directly so there is no
  // UTC-midnight drift (the bug that hits `new Date("YYYY-MM-DD")`).
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'numeric',
    day: 'numeric',
  });
}

async function invokeGetForecast(body: Record<string, unknown>): Promise<ForecastRaw> {
  const { data, error } = await supabase.functions.invoke('get-forecast', { body });
  if (error) {
    throw new Error(`Rainfall API error: ${(error as { message: string }).message}`);
  }
  return data as ForecastRaw;
}

/**
 * Compute the current local "now" as a no-suffix ISO string truncated to the
 * hour boundary ("YYYY-MM-DDTHH:00"), matching the format Open-Meteo uses for
 * its hourly timestamps.
 *
 * Swedish locale ("sv") gives "YYYY-MM-DD HH:mm:ss"; we swap the space for "T"
 * and slice to 13 chars to get "YYYY-MM-DDTHH", then append ":00".
 *
 * Do NOT use new Date().toISOString() here -- that returns UTC, which will
 * miscategorise future-local hours as already-passed for western-timezone users
 * (DATA-002).
 */
function localNowHourIso(tz: string): string {
  const prefix = new Intl.DateTimeFormat('sv', {
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
  return `${prefix}:00`; // e.g. "2026-04-27T12:00"
}

async function fetch24h(
  latitude: number,
  longitude: number,
  precipitationUnit: 'inch' | 'mm',
  timezone: string,
): Promise<RainfallData> {
  const raw = await invokeGetForecast({
    latitude,
    longitude,
    forecast_days: 1,
    past_days: 1,
    hourly: ['precipitation', 'snowfall'],
    daily: [],
    precipitation_unit: precipitationUnit,
  });

  const hourly = raw.hourly;
  if (!hourly || !Array.isArray(hourly.time) || !Array.isArray(hourly.precipitation)) {
    throw new Error('Rainfall API: unexpected hourly response shape');
  }

  // Compute the local "now" anchor in the same format as Open-Meteo timestamps
  // ("YYYY-MM-DDTHH:00", no suffix). Lexicographic comparison works because
  // both sides use the same zero-padded ISO-like format.
  const localNow = localNowHourIso(timezone);
  let total = 0;
  let snowTotal = 0;

  for (let i = 0; i < hourly.time.length; i++) {
    // Only accumulate hours that have already passed (local time) -- future
    // hours have no observed precipitation. Open-Meteo returns past_days +
    // forecast_days in a single array; we want only the historical half.
    if (hourly.time[i] <= localNow) {
      total += hourly.precipitation[i] ?? 0;
      snowTotal += hourly.snowfall?.[i] ?? 0;
    }
  }

  // Round to one decimal place to avoid floating-point noise accumulating
  // across 48 hourly additions.
  const rounded = Math.round(total * 10) / 10;
  const unit: 'in' | 'mm' = precipitationUnit === 'inch' ? 'in' : 'mm';

  // Open-Meteo applies precipitation_unit to snowfall too:
  //   inch → snowfall in inches; mm → snowfall in cm
  const snowUnit: 'in' | 'cm' = precipitationUnit === 'inch' ? 'in' : 'cm';
  const snowRounded = Math.round(snowTotal * 10) / 10;

  return {
    window: '24h',
    totalMm: rounded,
    unit,
    totalFormatted: rounded === 0 ? 'No rainfall recorded' : `${rounded} ${unit}`,
    days: [],
    snowTotal: snowRounded,
    snowUnit,
    snowTotalFormatted: snowRounded === 0 ? 'No snowfall recorded' : `${snowRounded} ${snowUnit}`,
    snowDays: [],
  };
}

async function fetchMultiDay(
  latitude: number,
  longitude: number,
  window: '7d' | '30d',
  precipitationUnit: 'inch' | 'mm',
): Promise<RainfallData> {
  const pastDays = window === '7d' ? 7 : 30;

  const raw = await invokeGetForecast({
    latitude,
    longitude,
    forecast_days: 1,
    past_days: pastDays,
    hourly: [],
    daily: ['precipitation_sum', 'snowfall_sum'],
    precipitation_unit: precipitationUnit,
  });

  const daily = raw.daily;
  if (!daily || !Array.isArray(daily.time) || !Array.isArray(daily.precipitation_sum)) {
    throw new Error('Rainfall API: unexpected daily response shape');
  }

  let total = 0;
  let snowTotalRaw = 0;
  const days: RainfallData['days'] = [];
  const snowDays: RainfallData['snowDays'] = [];

  for (let i = 0; i < daily.time.length; i++) {
    const amount = Math.round((daily.precipitation_sum[i] ?? 0) * 10) / 10;
    total += amount;
    days.push({
      date: daily.time[i],
      label: formatDayLabel(daily.time[i]),
      amount,
    });

    const snowAmount = Math.round((daily.snowfall_sum?.[i] ?? 0) * 10) / 10;
    snowTotalRaw += snowAmount;
    snowDays.push({
      date: daily.time[i],
      label: formatDayLabel(daily.time[i]),
      amount: snowAmount,
    });
  }

  const rounded = Math.round(total * 10) / 10;
  const unit: 'in' | 'mm' = precipitationUnit === 'inch' ? 'in' : 'mm';

  const snowUnit: 'in' | 'cm' = precipitationUnit === 'inch' ? 'in' : 'cm';
  const snowTotal = Math.round(snowTotalRaw * 10) / 10;

  return {
    window,
    totalMm: rounded,
    unit,
    totalFormatted: rounded === 0 ? 'No rainfall recorded' : `${rounded} ${unit}`,
    days,
    snowTotal,
    snowUnit,
    snowTotalFormatted: snowTotal === 0 ? 'No snowfall recorded' : `${snowTotal} ${snowUnit}`,
    snowDays,
  };
}

export async function fetchRainfallHistory(
  latitude: number,
  longitude: number,
  window: RainfallWindow,
  precipitationUnit: 'inch' | 'mm',
  timezone: string,
): Promise<RainfallData> {
  if (window === '24h') {
    return fetch24h(latitude, longitude, precipitationUnit, timezone);
  }
  return fetchMultiDay(latitude, longitude, window, precipitationUnit);
}
