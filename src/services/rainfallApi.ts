import { supabase } from '../utils/supabase';

export type RainfallWindow = '24h' | '7d' | '30d';

export interface RainfallData {
  window: RainfallWindow;
  totalMm: number;
  unit: 'in' | 'mm';
  totalFormatted: string;
  days: Array<{ date: string; label: string; amount: number }>;
}

// Maps Open-Meteo hourly response shape for the fields we request.
interface HourlyRaw {
  time: string[];
  precipitation: number[];
}

// Maps Open-Meteo daily response shape for the fields we request.
interface DailyRaw {
  time: string[];
  precipitation_sum: number[];
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

async function fetch24h(
  latitude: number,
  longitude: number,
  precipitationUnit: 'inch' | 'mm',
): Promise<RainfallData> {
  const raw = await invokeGetForecast({
    latitude,
    longitude,
    forecast_days: 1,
    past_days: 1,
    hourly: ['precipitation'],
    daily: [],
    precipitation_unit: precipitationUnit,
  });

  const hourly = raw.hourly;
  if (!hourly || !Array.isArray(hourly.time) || !Array.isArray(hourly.precipitation)) {
    throw new Error('Rainfall API: unexpected hourly response shape');
  }

  const nowIso = new Date().toISOString();
  let total = 0;

  for (let i = 0; i < hourly.time.length; i++) {
    // Only accumulate hours that have already passed — future hours have no
    // observed precipitation. Open-Meteo returns past_days + forecast_days in
    // a single array; we want only the historical half.
    if (hourly.time[i] < nowIso) {
      total += hourly.precipitation[i] ?? 0;
    }
  }

  // Round to one decimal place to avoid floating-point noise accumulating
  // across 48 hourly additions.
  const rounded = Math.round(total * 10) / 10;
  const unit: 'in' | 'mm' = precipitationUnit === 'inch' ? 'in' : 'mm';

  return {
    window: '24h',
    totalMm: rounded,
    unit,
    totalFormatted: rounded === 0 ? 'No rainfall recorded' : `${rounded} ${unit}`,
    days: [],
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
    daily: ['precipitation_sum'],
    precipitation_unit: precipitationUnit,
  });

  const daily = raw.daily;
  if (!daily || !Array.isArray(daily.time) || !Array.isArray(daily.precipitation_sum)) {
    throw new Error('Rainfall API: unexpected daily response shape');
  }

  let total = 0;
  const days: RainfallData['days'] = [];

  for (let i = 0; i < daily.time.length; i++) {
    const amount = Math.round((daily.precipitation_sum[i] ?? 0) * 10) / 10;
    total += amount;
    days.push({
      date: daily.time[i],
      label: formatDayLabel(daily.time[i]),
      amount,
    });
  }

  const rounded = Math.round(total * 10) / 10;
  const unit: 'in' | 'mm' = precipitationUnit === 'inch' ? 'in' : 'mm';

  return {
    window,
    totalMm: rounded,
    unit,
    totalFormatted: rounded === 0 ? 'No rainfall recorded' : `${rounded} ${unit}`,
    days,
  };
}

export async function fetchRainfallHistory(
  latitude: number,
  longitude: number,
  window: RainfallWindow,
  precipitationUnit: 'inch' | 'mm',
): Promise<RainfallData> {
  if (window === '24h') {
    return fetch24h(latitude, longitude, precipitationUnit);
  }
  return fetchMultiDay(latitude, longitude, window, precipitationUnit);
}
