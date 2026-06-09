import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useStyles, useTokens } from '../../src/theme';
import { useLocationsStore } from '../../src/stores/locationsStore';
import { useAlertRulesStore } from '../../src/stores/alertRulesStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { fetchForecast } from '../../src/services/weatherApi';
import { weatherCodeToEmoji, degreesToCardinal } from '../../src/services/weatherIcon';
import { getMoonIlluminationForDate, getMoonEmoji } from '../../src/utils/moonPhase';
import { ruleWouldTrigger } from '../../src/utils/forecastRulePreview';
import { RainfallCard } from '../../src/components/RainfallCard';
import type { ThemeTokens } from '../../src/theme';
import type { HourlyForecast, DailyForecast, AlertRule } from '../../src/types';

// Radar tile coverage (RainViewer/NEXRAD) is US-only in v1.
// Intl.DateTimeFormat is available in Hermes — no extra package needed.
const deviceLocale = Intl.DateTimeFormat().resolvedOptions().locale; // e.g. "en-US"
const isUSDevice = /[-_]US$/i.test(deviceLocale);

interface LocationForecast {
  hourly: HourlyForecast;
  daily: DailyForecast;
}

export default function ForecastsScreen() {
  const styles = useStyles(createStyles);
  const tokens = useTokens();
  const router = useRouter();

  const { locations, loadLocations } = useLocationsStore();
  const { rules, loadRules } = useAlertRulesStore();
  const temperatureUnit = useSettingsStore((s) => s.temperatureUnit);
  const windSpeedUnit = useSettingsStore((s) => s.windSpeedUnit);
  const pressureUnit = useSettingsStore((s) => s.pressureUnit);

  const { expandLocationId } = useLocalSearchParams<{ expandLocationId?: string }>();
  const processedExpandRef = useRef<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [forecasts, setForecasts] = useState<Record<string, LocationForecast>>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [forecastErrors, setForecastErrors] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadLocations();
    loadRules();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadLocations(), loadRules()]);
      setForecasts({});
    } finally {
      setRefreshing(false);
    }
  };

  const activeLocations = locations.filter((l) => l.is_active);

  const loadForecastFor = async (locationId: string, lat: number, lon: number) => {
    if (forecasts[locationId]) return;
    setLoadingIds((prev) => new Set(prev).add(locationId));
    setForecastErrors((prev) => {
      if (!prev[locationId]) return prev;
      const next = { ...prev };
      delete next[locationId];
      return next;
    });
    try {
      const data = await fetchForecast({
        latitude: lat,
        longitude: lon,
        forecastDays: 14,
        temperatureUnit,
        windSpeedUnit,
      });
      setForecasts((prev) => ({
        ...prev,
        [locationId]: { hourly: data.hourly, daily: data.daily },
      }));
    } catch {
      setForecastErrors((prev) => ({
        ...prev,
        [locationId]: 'Failed to load forecast. Tap to retry.',
      }));
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(locationId);
        return next;
      });
    }
  };

  const handleToggleLocation = (id: string, lat: number, lon: number) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      loadForecastFor(id, lat, lon);
    }
  };

  // Auto-expand a location when navigated from the home screen day tap.
  // processedExpandRef prevents re-firing on unrelated re-renders.
  useEffect(() => {
    if (!expandLocationId || typeof expandLocationId !== 'string') return;
    if (processedExpandRef.current === expandLocationId) return;
    if (activeLocations.length === 0) return;
    const loc = activeLocations.find((l) => l.id === expandLocationId);
    if (!loc) return;
    processedExpandRef.current = expandLocationId;
    setExpandedId(expandLocationId);
    void loadForecastFor(expandLocationId, loc.latitude, loc.longitude);
  // loadForecastFor is stable in behaviour; ref gates re-execution
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandLocationId, activeLocations]);

  const unitSymbol = temperatureUnit === 'fahrenheit' ? '°F' : '°C';

  const formatDayLabel = (date: string, index: number) => {
    if (index === 0) return 'Today';
    if (index === 1) return 'Tomorrow';
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
  };

  const formatHourLabel = (time: string) => {
    const d = new Date(time);
    return d.toLocaleTimeString(undefined, { hour: 'numeric' });
  };

  const formatSunTime = (isoDateTime: string | undefined | null): string => {
    if (!isoDateTime || isoDateTime.length < 16) return '';
    const timePart = isoDateTime.slice(11, 16);
    const [hhStr, mm] = timePart.split(':');
    const hh = parseInt(hhStr, 10);
    if (isNaN(hh)) return '';
    const period = hh >= 12 ? 'pm' : 'am';
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    return `${h12}:${mm}${period}`;
  };

  if (activeLocations.length === 0) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🌤️</Text>
          <Text style={styles.emptyTitle}>No Locations Yet</Text>
          <Text style={styles.emptyBody}>
            Add a location to see detailed forecasts and alert previews.
          </Text>
          <Pressable style={styles.addButton} onPress={() => router.push('/(tabs)/locations')}>
            <Text style={styles.addButtonText}>Add Location</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      {activeLocations.map((loc) => {
        const isExpanded = expandedId === loc.id;
        const forecast = forecasts[loc.id];
        const loading = loadingIds.has(loc.id);
        const locationRules = rules.filter((r) => r.location_id === loc.id && r.is_active);

        const forecastError = forecastErrors[loc.id];

        return (
          <View key={loc.id} style={styles.locationCard}>
            <Pressable
              style={styles.locationHeader}
              onPress={() => handleToggleLocation(loc.id, loc.latitude, loc.longitude)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.locationName}>{loc.name}</Text>
                {forecast && !isExpanded && (
                  <Text style={styles.locationSummary}>
                    {Math.round(forecast.daily.temperature_2m_max[0])}{unitSymbol} /{' '}
                    {Math.round(forecast.daily.temperature_2m_min[0])}{unitSymbol}
                    {forecast.daily.precipitation_probability_max[0] > 0 &&
                      `  ·  ${forecast.daily.precipitation_probability_max[0]}% rain`}
                  </Text>
                )}
              </View>
              <Text style={styles.expandIndicator}>{isExpanded ? '▲' : '▼'}</Text>
            </Pressable>

            {isExpanded && (
              <View style={styles.locationDetail}>
                {loading ? (
                  <ActivityIndicator color={tokens.primary} style={{ marginVertical: 24 }} />
                ) : forecast ? (
                  <>
                    {/* Radar — US only (RainViewer coverage) */}
                    {isUSDevice && (
                      <Pressable
                        style={styles.radarButton}
                        onPress={() =>
                          router.push({
                            pathname: '/radar',
                            params: {
                              lat: String(loc.latitude),
                              lng: String(loc.longitude),
                              locationName: loc.name,
                            },
                          })
                        }
                      >
                        <Text style={styles.radarButtonText}>🌧 View Radar →</Text>
                      </Pressable>
                    )}

                    {/* Hourly scroll */}
                    <Text style={styles.sectionLabel}>Next 24 hours</Text>
                    <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourlyRow}>
                      {forecast.hourly.time.slice(0, 24).map((time, i) => (
                        // Tapping an hourly item navigates to the day-detail screen for today.
                        // We use forecast.daily.time[0] (already YYYY-MM-DD) for the date param —
                        // same pattern used by the daily rows below.
                        <Pressable
                          key={time}
                          style={({ pressed }) => [styles.hourlyItem, pressed && { opacity: 0.6 }]}
                          onPress={() =>
                            router.push({
                              pathname: '/day-detail',
                              params: {
                                locationId: loc.id,
                                date: forecast.daily.time[0],
                                locationName: loc.name,
                              },
                            })
                          }
                        >
                          <Text style={styles.hourlyTime}>{formatHourLabel(time)}</Text>
                          <Text style={styles.hourlyTemp}>
                            {Math.round(forecast.hourly.temperature_2m[i])}{unitSymbol}
                          </Text>
                          {forecast.hourly.precipitation_probability[i] > 0 && (
                            <Text style={styles.hourlyRain}>
                              {forecast.hourly.precipitation_probability[i]}%
                            </Text>
                          )}
                        </Pressable>
                      ))}
                    </ScrollView>

                    {/* Rainfall history */}
                    <RainfallCard
                      locationId={loc.id}
                      latitude={loc.latitude}
                      longitude={loc.longitude}
                      timezone={loc.timezone ?? 'UTC'}
                    />

                    {/* Daily list */}
                    <Text style={styles.sectionLabel}>14-day Outlook</Text>
                    <View style={styles.dailyHeader}>
                      <View style={styles.dailyIconCol} />
                      <Text style={styles.dailyHeaderCell}>Day</Text>
                      <Text style={styles.dailyHeaderTemps}>High / Low</Text>
                      <Text style={styles.dailyHeaderRight}>Rain</Text>
                      <Text style={styles.dailyHeaderRight}>Wind</Text>
                    </View>
                    {forecast.daily.time.map((date, i) => {
                      const moonIllum = getMoonIlluminationForDate(date);
                      const moonEmoji = getMoonEmoji(moonIllum, date);
                      const uvMax = forecast.daily.uv_index_max[i];
                      // Barometric pressure: use noon hourly reading for the day when available.
                      const noonKey = `${date}T12:00`;
                      const noonIdx = forecast.hourly.time.indexOf(noonKey);
                      const pressureHPa = noonIdx >= 0
                        ? (forecast.hourly.surface_pressure?.[noonIdx] ?? undefined)
                        : undefined;

                      return (
                        <Pressable
                          key={date}
                          style={styles.dailyRow}
                          onPress={() =>
                            router.push({
                              pathname: '/day-detail',
                              params: { locationId: loc.id, date, locationName: loc.name },
                            })
                          }
                        >
                          {/* Primary row: icon / day label / hi+lo / rain / wind */}
                          <View style={styles.dailyPrimaryRow}>
                            <Text style={styles.dailyIcon}>
                              {weatherCodeToEmoji(forecast.daily.weather_code[i])}
                            </Text>
                            <Text style={styles.dailyDate}>{formatDayLabel(date, i)}</Text>
                            <Text style={styles.dailyTemps}>
                              {Math.round(forecast.daily.temperature_2m_max[i])}{unitSymbol} /{' '}
                              <Text style={styles.dailyLow}>
                                {Math.round(forecast.daily.temperature_2m_min[i])}{unitSymbol}
                              </Text>
                            </Text>
                            <Text style={styles.dailyRain}>
                              {forecast.daily.precipitation_probability_max[i]}%
                            </Text>
                            <Text style={styles.dailyWind}>
                              {degreesToCardinal(forecast.daily.wind_direction_10m_dominant[i])}{' '}
                              {Math.round(forecast.daily.wind_speed_10m_max[i])} {windSpeedUnit}
                            </Text>
                          </View>
                          {/* Secondary row: moon phase / UV / pressure / sun & moon times */}
                          <View style={styles.dailySecondaryRow}>
                            <Text style={styles.dailyMeta}>{moonEmoji}</Text>
                            {uvMax >= 3 && (
                              <Text style={styles.dailyMeta}>UV {uvMax}</Text>
                            )}
                            {pressureHPa !== undefined && (
                              <Text style={styles.dailyMeta}>
                                {pressureUnit === 'inHg'
                                  ? (pressureHPa / 33.8639).toFixed(2)
                                  : Math.round(pressureHPa)}{' '}{pressureUnit}
                              </Text>
                            )}
                            {!!forecast.daily.sunrise?.[i] && (
                              <Text style={styles.dailyMeta}>☀ {formatSunTime(forecast.daily.sunrise[i])}</Text>
                            )}
                            {!!forecast.daily.sunset?.[i] && (
                              <Text style={styles.dailyMeta}>🌇 {formatSunTime(forecast.daily.sunset[i])}</Text>
                            )}
                          </View>
                        </Pressable>
                      );
                    })}

                    {/* Rule Status Preview */}
                    {locationRules.length > 0 && (
                      <>
                        <Text style={styles.sectionLabel}>Rule Status</Text>
                        {locationRules.map((rule) => {
                          const status = ruleWouldTrigger(rule, forecast);
                          return (
                            <Pressable
                              key={rule.id}
                              style={styles.ruleStatusRow}
                              onPress={() => router.push(`/create-rule?mode=edit&ruleId=${rule.id}`)}
                            >
                              <Text style={styles.ruleStatusIcon}>
                                {status.triggered ? '⚠️' : '✓'}
                              </Text>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.ruleStatusName}>{rule.name}</Text>
                                <Text style={[
                                  styles.ruleStatusDetail,
                                  { color: status.triggered ? tokens.warning : tokens.success },
                                ]}>
                                  {status.triggered ? `Would trigger — ${status.detail}` : 'Clear'}
                                </Text>
                              </View>
                            </Pressable>
                          );
                        })}
                      </>
                    )}
                  </>
                ) : forecastError ? (
                  <View style={styles.forecastErrorBlock}>
                    <Text style={styles.forecastErrorText}>{forecastError}</Text>
                    <Pressable
                      style={({ pressed }) => [styles.retryButton, pressed && { opacity: 0.7 }]}
                      onPress={() => loadForecastFor(loc.id, loc.latitude, loc.longitude)}
                    >
                      <Text style={styles.retryButtonText}>Retry</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text style={styles.emptyBody}>Unable to load forecast.</Text>
                )}
              </View>
            )}
          </View>
        );
      })}

      <Pressable style={styles.historyLink} onPress={() => router.push('/history')}>
        <Text style={styles.historyLinkText}>View Alert History →</Text>
      </Pressable>
    </ScrollView>
  );
}

const createStyles = (t: ThemeTokens) => ({
  container: { flex: 1 as const, backgroundColor: t.background },
  content: { padding: 16, paddingBottom: 40, paddingTop: 20, maxWidth: 680, alignSelf: 'center' as const, width: '100%' as const },

  emptyCard: {
    backgroundColor: t.card,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: t.borderLight,
    marginTop: 40,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: t.textPrimary,
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    color: t.textSecondary,
    marginBottom: 20,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
  addButton: {
    backgroundColor: t.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  addButtonText: {
    color: t.textOnPrimary,
    fontSize: 16,
    fontWeight: '600' as const,
  },

  locationCard: {
    backgroundColor: t.card,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: t.borderLight,
    overflow: 'hidden' as const,
  },
  locationHeader: {
    padding: 16,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  locationName: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: t.textPrimary,
  },
  locationSummary: {
    fontSize: 13,
    color: t.textSecondary,
    marginTop: 4,
  },
  expandIndicator: {
    fontSize: 14,
    color: t.textTertiary,
    marginLeft: 12,
  },

  locationDetail: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: t.divider,
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: t.textTertiary,
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },

  hourlyRow: {
    flexDirection: 'row' as const,
    gap: 12,
    paddingVertical: 4,
  },
  hourlyItem: {
    alignItems: 'center' as const,
    minWidth: 56,
  },
  hourlyTime: { fontSize: 11, color: t.textTertiary, marginBottom: 4 },
  hourlyTemp: { fontSize: 16, fontWeight: '600' as const, color: t.textPrimary },
  hourlyRain: { fontSize: 10, color: t.rainBlue, marginTop: 2 },

  dailyHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: t.divider,
    marginBottom: 2,
  },
  dailyIconCol: { width: 26 as const },
  dailyHeaderCell: { fontSize: 11, color: t.textTertiary, flex: 1.5 as const, fontWeight: '500' as const },
  dailyHeaderTemps: { fontSize: 11, color: t.textTertiary, flex: 2 as const, fontWeight: '500' as const },
  dailyHeaderRight: { fontSize: 11, color: t.textTertiary, flex: 1.2 as const, textAlign: 'right' as const, fontWeight: '500' as const },

  dailyRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: t.divider,
  },
  dailyPrimaryRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  dailySecondaryRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    alignItems: 'center' as const,
    marginTop: 2,
    marginLeft: 26,
    gap: 10,
  },
  dailyMeta: {
    fontSize: 10,
    color: t.textTertiary,
  },

  dailyIcon: { fontSize: 16, width: 26 as const },
  dailyDate: { fontSize: 13, color: t.textPrimary, flex: 1.5 as const },
  dailyTemps: { fontSize: 14, color: t.textPrimary, flex: 2 as const, fontWeight: '600' as const },
  dailyLow: { color: t.textTertiary, fontWeight: '400' as const },
  dailyRain: { fontSize: 12, color: t.rainBlue, flex: 1.2 as const, textAlign: 'right' as const },
  dailyWind: { fontSize: 11, color: t.textTertiary, flex: 1.2 as const, textAlign: 'right' as const },

  ruleStatusRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 10,
    gap: 10,
  },
  ruleStatusIcon: { fontSize: 18 },
  ruleStatusName: { fontSize: 14, fontWeight: '500' as const, color: t.textPrimary },
  ruleStatusDetail: { fontSize: 12, marginTop: 2 },

  historyLink: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: 'center' as const,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: t.borderLight,
    backgroundColor: t.card,
  },
  historyLinkText: {
    fontSize: 15,
    color: t.primary,
    fontWeight: '600' as const,
  },

  radarButton: {
    marginTop: 12,
    marginBottom: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: t.rainBlue,
    backgroundColor: t.primaryLight,
    alignItems: 'center' as const,
  },
  radarButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: t.primary,
  },

  forecastErrorBlock: {
    paddingVertical: 20,
    alignItems: 'center' as const,
  },
  forecastErrorText: {
    fontSize: 14,
    color: t.error,
    marginBottom: 12,
    textAlign: 'center' as const,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: t.primary,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: t.textOnPrimary,
  },
});
