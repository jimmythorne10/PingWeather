interface DailyForecast {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_probability_max: number[];
  wind_speed_10m_max: number[];
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

export function formatDigestNotification(
  forecast: ForecastData,
  locationName: string,
  temperatureUnit: 'fahrenheit' | 'celsius',
  frequency: 'daily' | 'weekly'
): DigestNotification {
  const { daily } = forecast;
  if (!daily.time.length) throw new Error('Forecast daily data is empty');

  if (frequency === 'daily') {
    const high = formatTemp(daily.temperature_2m_max[0], temperatureUnit);
    const low = formatTemp(daily.temperature_2m_min[0], temperatureUnit);
    const rain = daily.precipitation_probability_max[0];
    const wind = Math.round(daily.wind_speed_10m_max[0]);

    return {
      title: `Today's forecast — ${locationName}`,
      body: `High ${high}, Low ${low} · ${rain}% rain · ${wind} mph wind`,
    };
  }

  // Weekly: show 7-day high/low range and worst rain day
  const highs = daily.temperature_2m_max.map((f) => formatTemp(f, temperatureUnit));
  const lows = daily.temperature_2m_min.map((f) => formatTemp(f, temperatureUnit));
  const maxRain = Math.max(...daily.precipitation_probability_max);
  const weekSummary = daily.time
    .slice(0, 7)
    .map((_, i) => `${highs[i]}/${lows[i]}`)
    .join(', ');

  return {
    title: `7-day forecast — ${locationName}`,
    body: `${weekSummary} · Up to ${maxRain}% rain chance`,
  };
}
