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
