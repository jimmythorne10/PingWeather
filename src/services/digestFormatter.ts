interface DailyForecast {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_probability_max: number[];
  wind_speed_10m_max: number[];
  weather_code?: number[];
}

interface ForecastData {
  daily: DailyForecast;
}

export interface DigestNotification {
  title: string;
  body: string;
}

function fToC(f: number): number {
  return Math.round((f - 32) * 5 / 9);
}

function formatTemp(f: number, unit: 'fahrenheit' | 'celsius'): string {
  return unit === 'celsius' ? `${fToC(f)}°C` : `${Math.round(f)}°F`;
}

// Kept in sync with send-digest/index.ts weatherCodeToEmoji (Deno can't import from src/).
function weatherCodeToEmoji(code: number): string {
  if (code <= 1) return '☀️';
  if (code <= 3) return '⛅';
  if (code <= 49) return '🌫️';
  if (code <= 69) return '🌧️';
  if (code <= 79) return '❄️';
  if (code <= 84) return '🌦️';
  if (code <= 94) return '🌨️';
  if (code <= 99) return '⛈️';
  return '🌡️';
}

function getDayLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const weekday = new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short' });
  return `${weekday} ${m}/${d}`;
}

function buildLines(
  daily: DailyForecast,
  temperatureUnit: 'fahrenheit' | 'celsius',
  maxDays: number
): string[] {
  const count = Math.min(daily.time.length, maxDays);
  const lines: string[] = [];

  for (let i = 0; i < count; i++) {
    const label = getDayLabel(daily.time[i]);
    const hi = formatTemp(daily.temperature_2m_max[i], temperatureUnit);
    const lo = formatTemp(daily.temperature_2m_min[i], temperatureUnit);

    const code = daily.weather_code?.[i];
    const emoji = code !== undefined ? `${weatherCodeToEmoji(code)} ` : '';

    const rain = daily.precipitation_probability_max[i];
    const rainStr = rain >= 20 ? ` · ${rain}%` : '';

    lines.push(`${emoji}${label} — ${hi} / ${lo}${rainStr}`);
  }

  return lines;
}

export function formatDigestNotification(
  forecast: ForecastData,
  locationName: string,
  temperatureUnit: 'fahrenheit' | 'celsius',
  frequency: 'daily' | 'weekly'
): DigestNotification {
  const { daily } = forecast;
  if (!daily.time.length) throw new Error('Forecast daily data is empty');

  if (frequency === 'daily') {
    return {
      title: `Today's forecast — ${locationName}`,
      body: buildLines(daily, temperatureUnit, 3).join('\n'),
    };
  }

  return {
    title: `7-day forecast — ${locationName}`,
    body: buildLines(daily, temperatureUnit, 5).join('\n'),
  };
}
