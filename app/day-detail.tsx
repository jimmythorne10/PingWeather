import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStyles, useTokens } from '../src/theme';
import { useLocationsStore } from '../src/stores/locationsStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { fetchForecast } from '../src/services/weatherApi';
import { weatherCodeToEmoji, degreesToCardinal } from '../src/services/weatherIcon';
import { getHourlyForDay } from '../src/services/hourlyForDay';
import { findDayIndex } from '../src/services/dayDetailHelpers';
import type { ThemeTokens } from '../src/theme';
import type { HourlyForecast, DailyForecast } from '../src/types';

interface ForecastState {
  hourly: HourlyForecast;
  daily: DailyForecast;
}

export default function DayDetailScreen() {
  const styles = useStyles(createStyles);
  const tokens = useTokens();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{
    locationId?: string;
    date?: string;
    locationName?: string;
  }>();
  // Normalize params: undefined/non-string → null so guards below are explicit.
  const locationId = typeof params.locationId === 'string' && params.locationId ? params.locationId : null;
  const date = typeof params.date === 'string' ? params.date : '';
  const locationName = typeof params.locationName === 'string' ? params.locationName : '';

  const locations = useLocationsStore((s) => s.locations);
  const loadLocations = useLocationsStore((s) => s.loadLocations);
  const temperatureUnit = useSettingsStore((s) => s.temperatureUnit);
  const windSpeedUnit = useSettingsStore((s) => s.windSpeedUnit);
  const pressureUnit = useSettingsStore((s) => s.pressureUnit);

  const [forecast, setForecast] = useState<ForecastState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const location = locationId ? locations.find((l) => l.id === locationId) : undefined;

  // Guard 1: missing locationId param — set error immediately, skip everything.
  useEffect(() => {
    if (!locationId) {
      setError('No location specified. Please go back and try again.');
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    if (locations.length === 0) {
      loadLocations();
    }
  }, [locations.length, loadLocations]);

  // Guard 2: locationId provided but not found after locations have loaded.
  // Without this, loading stays true forever when the id is invalid/stale.
  useEffect(() => {
    if (!locationId) return; // Guard 1 already handled this
    if (locations.length === 0) return; // Still loading locations
    if (!location) {
      setError('Location not found. It may have been deleted.');
      setLoading(false);
    }
  }, [locationId, location, locations.length]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!location) return;
      setLoading(true);
      setError(null);
      try {
        const data = await fetchForecast({
          latitude: location.latitude,
          longitude: location.longitude,
          forecastDays: 14,
          temperatureUnit,
          windSpeedUnit,
        });
        if (cancelled) return;
        setForecast({ hourly: data.hourly, daily: data.daily });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load forecast';
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [location, temperatureUnit, windSpeedUnit]);

  // findDayIndex guards against empty date: startsWith('') matches every string,
  // which would silently show day 0 instead of an error.
  const dailyIndex = useMemo(() => {
    if (!forecast) return -1;
    return findDayIndex(forecast.daily.time, date);
  }, [forecast, date]);

  const hoursForDay = useMemo(() => {
    if (!forecast) return null;
    return getHourlyForDay(forecast.hourly, date);
  }, [forecast, date]);

  const unitSymbol = temperatureUnit === 'fahrenheit' ? '°F' : '°C';
  const soilUnit = temperatureUnit === 'fahrenheit' ? '°F' : '°C';

  const dayLabel = useMemo(() => formatDayLabel(date), [date]);

  const headerTitle = locationName || location?.name || 'Day Forecast';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: Math.max(insets.bottom + 40, 80),
        paddingHorizontal: 16,
        maxWidth: 640,
        alignSelf: 'center' as const,
        width: '100%' as const,
      }}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerLocation} numberOfLines={1}>
            {headerTitle}
          </Text>
          <Text style={styles.headerDay}>{dayLabel}</Text>
        </View>
      </View>

      {loading && (
        <View style={styles.centerBox}>
          <ActivityIndicator color={tokens.primary} size="large" />
          <Text style={styles.loadingText}>Loading forecast…</Text>
        </View>
      )}

      {!loading && error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Unable to load forecast</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <Pressable onPress={() => router.back()} style={styles.errorBack} hitSlop={8}>
            <Text style={styles.errorBackText}>← Go back</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && forecast && dailyIndex >= 0 && hoursForDay && (
        <>
          {/* Day summary card */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryEmoji}>
              {weatherCodeToEmoji(forecast.daily.weather_code[dailyIndex])}
            </Text>
            <View style={styles.summaryTempRow}>
              <Text style={styles.summaryHigh}>
                {Math.round(forecast.daily.temperature_2m_max[dailyIndex])}
                {unitSymbol}
              </Text>
              <Text style={styles.summarySep}>/</Text>
              <Text style={styles.summaryLow}>
                {Math.round(forecast.daily.temperature_2m_min[dailyIndex])}
                {unitSymbol}
              </Text>
            </View>

            <View style={styles.summaryMetricsRow}>
              <View style={styles.summaryMetric}>
                <Text style={styles.summaryMetricLabel}>RAIN</Text>
                <Text style={styles.summaryMetricValue}>
                  {forecast.daily.precipitation_probability_max[dailyIndex]}%
                </Text>
              </View>
              <View style={styles.summaryMetric}>
                <Text style={styles.summaryMetricLabel}>WIND MAX</Text>
                <Text style={styles.summaryMetricValue}>
                  {Math.round(forecast.daily.wind_speed_10m_max[dailyIndex])} {windSpeedUnit}
                </Text>
              </View>
              <View style={styles.summaryMetric}>
                <Text style={styles.summaryMetricLabel}>WIND RANGE</Text>
                <Text style={styles.summaryMetricValue}>
                  {formatWindRange(hoursForDay.wind_speed_10m, windSpeedUnit)}
                </Text>
              </View>
            </View>

            {!!forecast.daily.sunrise?.[dailyIndex] && (
              <View style={styles.summaryAstroRow}>
                <View style={styles.summaryAstroMetric}>
                  <Text style={styles.summaryMetricLabel}>SUNRISE</Text>
                  <Text style={styles.summaryMetricValue}>
                    ☀ {formatSunTime(forecast.daily.sunrise[dailyIndex]!)}
                  </Text>
                </View>
                {!!forecast.daily.sunset?.[dailyIndex] && (
                  <View style={styles.summaryAstroMetric}>
                    <Text style={styles.summaryMetricLabel}>SUNSET</Text>
                    <Text style={styles.summaryMetricValue}>
                      🌇 {formatSunTime(forecast.daily.sunset[dailyIndex]!)}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Hourly list */}
          <Text style={styles.sectionLabel}>Hourly</Text>
          {hoursForDay.time.length === 0 ? (
            <Text style={styles.emptyBody}>No hourly data for this day.</Text>
          ) : (
            <View style={styles.hourlyList}>
              {hoursForDay.time.map((t, i) => {
                const pressure = hoursForDay.surface_pressure?.[i];
                const snowfallVal = hoursForDay.snowfall?.[i];
                const snowDepthVal = hoursForDay.snow_depth?.[i];
                const soilTempVal = hoursForDay.soil_temperature_0cm?.[i];
                const hasExtra =
                  pressure !== undefined ||
                  (snowfallVal !== undefined && snowfallVal > 0) ||
                  (snowDepthVal !== undefined && snowDepthVal > 0) ||
                  soilTempVal !== undefined;

                return (
                  <View key={t} style={styles.hourlyRow}>
                    {/* Primary row */}
                    <View style={styles.hourlyPrimary}>
                      <Text style={styles.hourTime}>{formatHourLabel(t)}</Text>
                      <Text style={styles.hourEmoji}>
                        {weatherCodeToEmoji(hoursForDay.weather_code[i])}
                      </Text>
                      <Text style={styles.hourTemp}>
                        {Math.round(hoursForDay.temperature_2m[i])}
                        {unitSymbol}
                      </Text>
                      <Text style={styles.hourRain}>
                        {hoursForDay.precipitation_probability[i]}%
                      </Text>
                      <Text style={styles.hourWind}>
                        {hoursForDay.wind_direction_10m?.[i] !== undefined
                          ? `${degreesToCardinal(hoursForDay.wind_direction_10m[i])} `
                          : ''}
                        {Math.round(hoursForDay.wind_speed_10m[i])} {windSpeedUnit}
                      </Text>
                    </View>
                    {/* Secondary row — only rendered when at least one optional field is present */}
                    {hasExtra && (
                      <View style={styles.hourlyExtra}>
                        {pressure !== undefined && (
                          <Text style={styles.hourExtraItem}>
                            {pressureUnit === 'inHg'
                              ? `${(pressure / 33.8639).toFixed(2)} inHg`
                              : `${Math.round(pressure)} hPa`}
                          </Text>
                        )}
                        {snowfallVal !== undefined && snowfallVal > 0 && (
                          <Text style={styles.hourExtraItem}>Snow {snowfallVal.toFixed(1)} cm</Text>
                        )}
                        {snowDepthVal !== undefined && snowDepthVal > 0 && (
                          <Text style={styles.hourExtraItem}>Depth {snowDepthVal.toFixed(1)} cm</Text>
                        )}
                        {soilTempVal !== undefined && (
                          <Text style={styles.hourExtraItem}>Soil {Math.round(soilTempVal)}{soilUnit}</Text>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}

      {!loading && !error && forecast && dailyIndex < 0 && (
        <View style={styles.errorCard}>
          <Text style={styles.errorIcon}>📅</Text>
          <Text style={styles.errorTitle}>
            {date ? 'Date not in forecast window' : 'No date specified'}
          </Text>
          <Text style={styles.errorBody}>
            {date
              ? 'The selected day is outside the 14-day forecast range.'
              : 'A date is required to show the day detail.'}
          </Text>
          <Pressable onPress={() => router.back()} style={styles.errorBack} hitSlop={8}>
            <Text style={styles.errorBackText}>← Go back</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

// ────────────────────────────────────────────────────────────
// Helpers (kept local because they rely on screen-level formatting)
// ────────────────────────────────────────────────────────────

function formatDayLabel(isoDate: string): string {
  if (!isoDate) return '';
  // Parse as local-date: "YYYY-MM-DD". new Date("2026-04-09") is UTC midnight
  // which drifts in western timezones, so construct from parts.
  const parts = isoDate.split('-').map((n) => parseInt(n, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return isoDate;
  const [y, m, d] = parts;
  const target = new Date(y, m - 1, d);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (target.getTime() === today.getTime()) return 'Today';
  if (target.getTime() === tomorrow.getTime()) return 'Tomorrow';

  return target.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatHourLabel(time: string): string {
  // time is "YYYY-MM-DDTHH:00" (Open-Meteo local, no tz suffix)
  const match = /T(\d{2}):/.exec(time);
  if (!match) return time;
  const hh = parseInt(match[1], 10);
  const period = hh >= 12 ? 'pm' : 'am';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}${period}`;
}

function formatSunTime(isoDateTime: string | undefined | null): string {
  if (!isoDateTime || isoDateTime.length < 16) return '';
  const timePart = isoDateTime.slice(11, 16);
  const [hhStr, mm] = timePart.split(':');
  const hh = parseInt(hhStr, 10);
  if (isNaN(hh)) return '';
  const period = hh >= 12 ? 'pm' : 'am';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${mm}${period}`;
}

function formatWindRange(winds: number[], unit: string): string {
  if (winds.length === 0) return `— ${unit}`;
  let min = Infinity;
  let max = -Infinity;
  for (const w of winds) {
    if (w < min) min = w;
    if (w > max) max = w;
  }
  return `${Math.round(min)}–${Math.round(max)} ${unit}`;
}

const createStyles = (t: ThemeTokens) => ({
  container: { flex: 1 as const, backgroundColor: t.background },

  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 16,
    gap: 12,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.borderLight,
  },
  backArrow: { fontSize: 20, color: t.primary, fontWeight: '600' as const },
  headerLocation: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: t.textPrimary,
  },
  headerDay: {
    fontSize: 13,
    color: t.textSecondary,
    marginTop: 2,
  },

  centerBox: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 12,
    color: t.textSecondary,
    fontSize: 13,
  },

  errorCard: {
    backgroundColor: t.card,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: t.borderLight,
    marginTop: 24,
  },
  errorIcon: { fontSize: 40, marginBottom: 10 },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: t.textPrimary,
    marginBottom: 6,
  },
  errorBody: {
    fontSize: 13,
    color: t.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 19,
  },
  errorBack: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: t.primary,
  },
  errorBackText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: t.textOnPrimary,
  },

  summaryCard: {
    backgroundColor: t.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: t.borderLight,
    alignItems: 'center' as const,
  },
  summaryEmoji: { fontSize: 64, marginBottom: 8 },
  summaryTempRow: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    gap: 10,
  },
  summaryHigh: {
    fontSize: 40,
    fontWeight: '700' as const,
    color: t.textPrimary,
  },
  summarySep: { fontSize: 28, color: t.textTertiary },
  summaryLow: {
    fontSize: 28,
    fontWeight: '500' as const,
    color: t.textTertiary,
  },
  summaryMetricsRow: {
    flexDirection: 'row' as const,
    width: '100%' as const,
    justifyContent: 'space-around' as const,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: t.divider,
  },
  summaryMetric: { alignItems: 'center' as const, flex: 1 as const },
  summaryMetricLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: t.textTertiary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryMetricValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: t.textPrimary,
  },
  summaryAstroRow: {
    flexDirection: 'row' as const,
    width: '100%' as const,
    justifyContent: 'space-around' as const,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: t.divider,
    flexWrap: 'wrap' as const,
    gap: 12,
  },
  summaryAstroMetric: { alignItems: 'center' as const, minWidth: 70 as const },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: t.textTertiary,
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
  },

  hourlyList: {
    backgroundColor: t.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.borderLight,
    overflow: 'hidden' as const,
  },
  hourlyRow: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: t.divider,
  },
  hourlyPrimary: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  hourlyExtra: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginTop: 3,
    marginLeft: 82, // align under temp column (time 52 + emoji 30)
    gap: 10,
  },
  hourExtraItem: {
    fontSize: 10,
    color: t.textTertiary,
  },
  hourTime: {
    fontSize: 13,
    color: t.textPrimary,
    width: 52,
  },
  hourEmoji: { fontSize: 18, width: 30, textAlign: 'center' as const },
  hourTemp: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: t.textPrimary,
    flex: 1 as const,
    textAlign: 'center' as const,
  },
  hourRain: {
    fontSize: 12,
    color: t.rainBlue,
    flex: 1 as const,
    textAlign: 'right' as const,
  },
  hourWind: {
    fontSize: 12,
    color: t.textTertiary,
    flex: 1 as const,
    textAlign: 'right' as const,
    marginLeft: 10,
  },

  emptyBody: {
    fontSize: 14,
    color: t.textSecondary,
    textAlign: 'center' as const,
    paddingVertical: 20,
  },
});
