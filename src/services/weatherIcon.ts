// ────────────────────────────────────────────────────────────
// WMO Weather Code → Emoji
// Open-Meteo returns WMO weather interpretation codes.
// https://open-meteo.com/en/docs (see "weather_code" table)
// ────────────────────────────────────────────────────────────

/**
 * Map a WMO weather code to a representative emoji.
 *
 * Code ranges:
 *   0           clear sky                    → ☀️
 *   1, 2        mainly clear / partly cloudy → ⛅
 *   3           overcast                     → ☁️
 *   45, 48      fog / depositing rime fog    → 🌫️
 *   51–57       drizzle / freezing drizzle   → 🌦️
 *   61–67       rain / freezing rain         → 🌧️
 *   71–77       snow fall / snow grains      → ❄️
 *   80–82       rain showers                 → 🌧️
 *   85, 86      snow showers                 → 🌨️
 *   95          thunderstorm                 → ⛈️
 *   96, 99      thunderstorm with hail       → ⛈️
 *   anything else                            → ❓
 */
const CARDINAL_DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

export function degreesToCardinal(degrees: number): string {
  return CARDINAL_DIRS[Math.round(degrees / 45) % 8];
}

/** Short human-readable label for a WMO weather code. */
export function weatherCodeLabel(code: number): string {
  if (code === 0) return 'clear sky';
  if (code === 1) return 'mainly clear';
  if (code === 2) return 'partly cloudy';
  if (code === 3) return 'overcast';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 53) return 'drizzle';
  if (code >= 55 && code <= 57) return 'freezing drizzle';
  if (code === 61 || code === 63) return 'rain';
  if (code === 65) return 'heavy rain';
  if (code === 66 || code === 67) return 'freezing rain';
  if (code === 71 || code === 73) return 'snow';
  if (code === 75) return 'heavy snow';
  if (code === 77) return 'snow grains';
  if (code >= 80 && code <= 82) return 'rain showers';
  if (code === 85 || code === 86) return 'snow showers';
  if (code === 95) return 'thunderstorm';
  if (code === 96 || code === 99) return 'thunderstorm with hail';
  return `code ${code}`;
}

export function weatherCodeToEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code === 1 || code === 2) return '⛅';
  if (code === 3) return '☁️';
  if (code === 45 || code === 48) return '🌫️';
  if (code >= 51 && code <= 57) return '🌦️';
  if (code >= 61 && code <= 67) return '🌧️';
  if (code >= 71 && code <= 77) return '❄️';
  if (code >= 80 && code <= 82) return '🌧️';
  if (code === 85 || code === 86) return '🌨️';
  if (code === 95) return '⛈️';
  if (code === 96 || code === 99) return '⛈️';
  return '❓';
}
