import { View, Text, ScrollView, Pressable, ActivityIndicator, Modal, RefreshControl } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useStyles, useTokens } from '../../src/theme';
import { useLook } from '../../src/theme/useStyles';
import type { LookTokens } from '../../src/theme/looks';
import { useAuthStore } from '../../src/stores/authStore';
import { useLocationsStore } from '../../src/stores/locationsStore';
import { useAlertRulesStore } from '../../src/stores/alertRulesStore';
import { useAlertHistoryStore } from '../../src/stores/alertHistoryStore';
import { fetchForecast } from '../../src/services/weatherApi';
import { getCurrentTemperature } from '../../src/services/currentTemp';
import { weatherCodeToEmoji } from '../../src/services/weatherIcon';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useWalkthrough } from '../../src/hooks/useWalkthrough';
import { WalkthroughModal } from '../../src/components/WalkthroughModal';
import type { ThemeTokens } from '../../src/theme';
import type { DailyForecast, HourlyForecast, WatchLocation } from '../../src/types';

export default function HomeScreen() {
  const styles = useStyles(createStyles);
  const tokens = useTokens();
  const look = useLook();
  const router = useRouter();
  const { visible: walkthroughVisible, dismiss: dismissWalkthrough } = useWalkthrough({ autoShow: true });
  const { locations, loadLocations } = useLocationsStore();
  const { rules, loadRules } = useAlertRulesStore();
  const { entries, loadHistory } = useAlertHistoryStore();
  const temperatureUnit = useSettingsStore((s) => s.temperatureUnit);
  const windSpeedUnit = useSettingsStore((s) => s.windSpeedUnit);

  const [weather, setWeather] = useState<{ daily: DailyForecast; hourly: HourlyForecast } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadLocations();
    loadRules();
    loadHistory();
  }, []);

  const activeLocations = locations.filter((l) => l.is_active);
  const defaultLocation = activeLocations.find((l) => (l as WatchLocation).is_default) ?? activeLocations[0];
  const selectedLocation =
    (selectedLocationId ? activeLocations.find((l) => l.id === selectedLocationId) : null) ??
    defaultLocation ??
    null;

  const fetchWeatherForLocation = async (location: WatchLocation | undefined) => {
    if (!location) return;
    setWeatherError(null);
    try {
      const data = await fetchForecast({
        latitude: location.latitude,
        longitude: location.longitude,
        forecastDays: 4, // today + 3 upcoming days
        temperatureUnit,
        windSpeedUnit,
      });
      setWeather({ daily: data.daily, hourly: data.hourly });
    } catch {
      setWeatherError('Unable to load weather. Pull down to retry.');
    }
  };

  useEffect(() => {
    if (!selectedLocation) return;
    setWeatherLoading(true);
    fetchWeatherForLocation(selectedLocation).finally(() => setWeatherLoading(false));
  }, [selectedLocation?.id, temperatureUnit, windSpeedUnit]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadLocations(),
        loadRules(),
        loadHistory(),
        fetchWeatherForLocation(selectedLocation),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const activeRules = rules.filter((r) => r.is_active);
  const recentAlerts = entries.slice(0, 5);
  const unitSymbol = temperatureUnit === 'fahrenheit' ? '°F' : '°C';

  // Finds the current-hour index in hourly.time using the same local-time
  // prefix approach as getCurrentTemperature (Intl.DateTimeFormat, not
  // toISOString which is UTC). Falls back to UTC when timezone is unknown.
  const getCurrentHourIndex = (hourly: HourlyForecast, tz: string): number => {
    const localPrefix = new Intl.DateTimeFormat('sv', {
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
    return hourly.time.findIndex((t) => t.slice(0, 13) === localPrefix);
  };

  // "Thu 5/29" — used for the 3-day section rows (indices 1-3)
  const formatDayLabel = (date: string, index: number) => {
    if (index === 0) return 'Today';
    if (index === 1) return 'Tomorrow';
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      {/* ─── Forecast card ─────────────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Forecast</Text>
          <View style={styles.cardHeaderRight}>
            {selectedLocation && activeLocations.length > 1 ? (
              <Pressable onPress={() => setPickerOpen(true)} style={styles.locationPicker}>
                <Text style={styles.locationPickerText}>{selectedLocation.name} ▾</Text>
              </Pressable>
            ) : selectedLocation ? (
              <Text style={styles.cardSubtitle}>{selectedLocation.name}</Text>
            ) : null}
          </View>
        </View>

        {!selectedLocation ? (
          <>
            <Text style={styles.cardBody}>Add a location to see weather conditions.</Text>
            <Pressable style={styles.button} onPress={() => router.push('/(tabs)/locations')}>
              <Text style={styles.buttonText}>Add Location</Text>
            </Pressable>
          </>
        ) : weatherLoading ? (
          <ActivityIndicator color={tokens.primary} style={{ marginVertical: 16 }} />
        ) : !weather && weatherError ? (
          <>
            <Text style={styles.cardBody}>{weatherError}</Text>
          </>
        ) : weather ? (
          <>
            {/* ── Part 1: Today's conditions ───────────────────── */}
            {(() => {
              const tz = selectedLocation?.timezone ?? 'UTC';
              const currentTemp = getCurrentTemperature(weather.hourly, tz);
              const hourIdx = getCurrentHourIndex(weather.hourly, tz);
              const currentWind =
                hourIdx !== -1 ? Math.round(weather.hourly.wind_speed_10m[hourIdx]) : null;
              const maxWind = Math.round(weather.daily.wind_speed_10m_max[0]);
              const high = Math.round(weather.daily.temperature_2m_max[0]);
              const low = Math.round(weather.daily.temperature_2m_min[0]);
              const rain = weather.daily.precipitation_probability_max[0];
              const weatherEmoji = weatherCodeToEmoji(weather.daily.weather_code[0]);

              return (
                <View style={styles.todayBlock}>
                  {/* Top row: big emoji + Now temp + High/Low */}
                  <View style={styles.todayTopRow}>
                    <Text style={styles.todayEmoji}>{weatherEmoji}</Text>

                    <View style={styles.todayTempGroup}>
                      {currentTemp !== null ? (
                        <Text style={styles.todayNow}>Now: {currentTemp}{unitSymbol}</Text>
                      ) : null}
                      <View style={styles.todayHiLoRow}>
                        <Text style={styles.todayHigh}>↑ {high}{unitSymbol}</Text>
                        <Text style={styles.todayLow}>↓ {low}{unitSymbol}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Details row: rain + wind */}
                  <View style={styles.todayDetailsRow}>
                    <Text style={styles.todayDetail}>
                      🌧 {rain}%
                    </Text>
                    <Text style={styles.todayDetail}>
                      {currentWind !== null
                        ? `💨 ${currentWind} → ${maxWind} ${windSpeedUnit}`
                        : `💨 max ${maxWind} ${windSpeedUnit}`}
                    </Text>
                  </View>

                  {/* Sunrise / sunset */}
                  {!!weather.daily.sunrise?.[0] && (
                    <Text style={styles.todaySunRow}>
                      ☀ {formatSunTime(weather.daily.sunrise[0])} · 🌇 {formatSunTime(weather.daily.sunset?.[0])}
                    </Text>
                  )}
                </View>
              );
            })()}

            {/* ── Part 2: Next 3 days (indices 1, 2, 3) ────────── */}
            {weather.daily.time.length > 1 && (
              <View style={styles.nextDaysBlock}>
                <View style={styles.nextDaysDivider} />
                {[1, 2, 3].filter((i) => i < weather.daily.time.length).map((i) => {
                  const date = weather.daily.time[i];
                  const high = Math.round(weather.daily.temperature_2m_max[i]);
                  const low = Math.round(weather.daily.temperature_2m_min[i]);
                  const rain = weather.daily.precipitation_probability_max[i];
                  const wind = Math.round(weather.daily.wind_speed_10m_max[i]);
                  const emoji = weatherCodeToEmoji(weather.daily.weather_code[i]);
                  return (
                    <Pressable
                      key={date}
                      style={({ pressed }) => [styles.nextDayRow, pressed && { opacity: 0.7 }]}
                      onPress={() => {
                        if (selectedLocation) {
                          router.navigate({
                            pathname: '/day-detail',
                            params: {
                              locationId: selectedLocation.id,
                              date,
                              locationName: selectedLocation.name,
                            },
                          });
                        }
                      }}
                    >
                      <Text style={styles.nextDayLabel}>{formatDayLabel(date, i)}</Text>
                      <Text style={styles.nextDayEmoji}>{emoji}</Text>
                      <View style={styles.nextDayTemps}>
                        <Text style={styles.nextDayHigh}>↑{high}{unitSymbol}</Text>
                        <Text style={styles.nextDayLow}>↓{low}{unitSymbol}</Text>
                      </View>
                      <Text style={styles.nextDayRain}>🌧 {rain}%</Text>
                      <Text style={styles.nextDayWind}>💨 {wind} {windSpeedUnit}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        ) : (
          <Text style={styles.cardBody}>Unable to load weather data.</Text>
        )}
      </View>

      {/* ─── Location picker modal ─────────────────────────────── */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setPickerOpen(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Location</Text>
            {activeLocations.map((loc) => (
              <Pressable
                key={loc.id}
                style={styles.modalOption}
                onPress={() => {
                  setSelectedLocationId(loc.id);
                  setPickerOpen(false);
                }}
              >
                <Text style={[
                  styles.modalOptionText,
                  selectedLocation?.id === loc.id && { color: tokens.primary, fontWeight: look.typography.title.weight },
                ]}>
                  {loc.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* ─── Active alerts ─────────────────────────────────────── */}
      <Pressable style={styles.card} onPress={() => router.push('/(tabs)/alerts')}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Active Alerts</Text>
          <Text style={styles.cardBadge}>{activeRules.length}</Text>
        </View>
        {activeRules.length === 0 ? (
          <>
            <Text style={styles.cardBody}>
              Set up your first alert so we can ping you when weather changes.
            </Text>
            <Pressable
              style={styles.button}
              onPress={(e) => {
                e.stopPropagation?.();
                router.push('/(tabs)/alerts');
              }}
            >
              <Text style={styles.buttonText}>Create Alert</Text>
            </Pressable>
          </>
        ) : (
          <>
            {activeRules.slice(0, 3).map((rule) => (
              <Pressable
                key={rule.id}
                style={styles.ruleRow}
                onPress={(e) => {
                  e.stopPropagation?.();
                  router.push(`/create-rule?mode=edit&ruleId=${rule.id}`);
                }}
              >
                <Text style={styles.ruleName}>{rule.name}</Text>
                <Text style={styles.ruleInterval}>Every {rule.polling_interval_hours}h</Text>
              </Pressable>
            ))}
            {activeRules.length > 3 && (
              <Text style={[styles.cardBody, { color: tokens.primary, marginTop: 8 }]}>
                +{activeRules.length - 3} more...
              </Text>
            )}
          </>
        )}
      </Pressable>

      {/* ─── Recent notifications ──────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Notifications</Text>
        {recentAlerts.length === 0 ? (
          <Text style={styles.cardBody}>
            No notifications yet — we'll show them here when your alerts trigger.
          </Text>
        ) : (
          recentAlerts.map((entry) => (
            <View key={entry.id} style={styles.historyRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyRule}>{entry.rule_name}</Text>
                <Text style={styles.historySummary}>{entry.conditions_met}</Text>
              </View>
              <Text style={styles.historyTime}>
                {(() => {
                  const [y, mo, d] = entry.triggered_at.slice(0, 10).split('-').map(Number);
                  return new Date(y, mo - 1, d).toLocaleDateString();
                })()}
              </Text>
            </View>
          ))
        )}
        {recentAlerts.length > 0 && (
          <Pressable onPress={() => router.push('/history')}>
            <Text style={[styles.cardBody, { color: tokens.primary, marginTop: 8 }]}>
              View all history
            </Text>
          </Pressable>
        )}
      </View>

      <WalkthroughModal visible={walkthroughVisible} onDismiss={dismissWalkthrough} />
    </ScrollView>
  );
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

const createStyles = (t: ThemeTokens, look: LookTokens) => ({
  container: { flex: 1 as const, backgroundColor: t.background },
  content: {
    padding: look.spacing.lg,
    paddingBottom: look.spacing.xxxl,
    paddingTop: look.spacing.xl,
    maxWidth: 600,
    alignSelf: 'center' as const,
    width: '100%' as const,
  },

  card: {
    backgroundColor: t.card, borderRadius: look.radius.surface, padding: look.spacing.lg, marginBottom: 12,
    borderWidth: 1, borderColor: t.borderLight,
  },
  cardHeaderRow: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const,
    alignItems: 'center' as const, marginBottom: 12,
  },
  cardHeaderRight: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: look.spacing.sm,
  },
  cardTitle: {
    fontSize: look.typography.heading.size,
    fontWeight: look.typography.heading.weight,
    letterSpacing: look.typography.heading.tracking,
    color: t.textPrimary,
  },
  cardBadge: {
    backgroundColor: t.primary, color: t.textOnPrimary,
    fontSize: look.typography.caption.size,
    fontWeight: look.typography.caption.weight,
    letterSpacing: look.typography.caption.tracking,
    paddingHorizontal: look.spacing.md, paddingVertical: look.spacing.xs, borderRadius: look.radius.surface,
  },
  cardBody: { fontSize: look.typography.body.size, color: t.textSecondary, lineHeight: look.typography.body.lineHeight, marginBottom: 12 },

  button: {
    backgroundColor: t.primary, paddingVertical: look.spacing.md, paddingHorizontal: look.spacing.xl,
    borderRadius: look.radius.surface, alignItems: 'center' as const,
  },
  buttonText: {
    color: t.textOnPrimary,
    fontSize: look.typography.heading.size,
    fontWeight: look.typography.heading.weight,
    letterSpacing: look.typography.heading.tracking,
  },

  cardSubtitle: { fontSize: look.typography.caption.size, color: t.textTertiary },

  locationPicker: {
    paddingVertical: look.spacing.xs,
    paddingHorizontal: look.spacing.md,
    borderRadius: look.radius.surface,
    backgroundColor: t.primaryLight,
  },
  locationPickerText: {
    fontSize: look.typography.caption.size,
    color: t.primary,
    fontWeight: look.typography.caption.weight,
    letterSpacing: look.typography.caption.tracking,
  },

  // ── Today's conditions block ──────────────────────────────────
  todayBlock: {
    marginBottom: 4,
    alignItems: 'center' as const,
  },
  todayTopRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: look.spacing.md,
    marginBottom: 8,
  },
  todayEmoji: {
    fontSize: look.typography.display.size,
    lineHeight: look.typography.display.lineHeight,
  },
  todayTempGroup: {
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  todayNow: {
    fontSize: look.typography.title.size,
    fontWeight: look.typography.title.weight,
    letterSpacing: look.typography.title.tracking,
    color: t.textPrimary,
    lineHeight: look.typography.title.lineHeight,
  },
  todayHiLoRow: {
    flexDirection: 'row' as const,
    gap: look.spacing.md,
    marginTop: 2,
  },
  todayHigh: {
    fontSize: look.typography.bodyStrong.size,
    fontWeight: look.typography.bodyStrong.weight,
    letterSpacing: look.typography.bodyStrong.tracking,
    color: t.textPrimary,
  },
  todayLow: {
    fontSize: look.typography.body.size,
    color: t.textTertiary,
  },
  todayDetailsRow: {
    flexDirection: 'row' as const,
    gap: look.spacing.lg,
    marginBottom: 6,
    justifyContent: 'center' as const,
  },
  todayDetail: {
    fontSize: look.typography.body.size,
    color: t.textSecondary,
  },
  todaySunRow: {
    fontSize: look.typography.caption.size,
    color: t.textTertiary,
    textAlign: 'center' as const,
  },

  // ── Next 3 days block ─────────────────────────────────────────
  nextDaysBlock: {
    marginTop: 4,
  },
  nextDaysDivider: {
    height: 1,
    backgroundColor: t.borderLight,
    marginBottom: 8,
  },
  nextDayRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: look.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: t.divider,
    gap: look.spacing.sm,
  },
  nextDayLabel: {
    fontSize: look.typography.caption.size,
    fontWeight: look.typography.caption.weight,
    letterSpacing: look.typography.caption.tracking,
    color: t.textSecondary,
    width: 80,
  },
  nextDayEmoji: {
    fontSize: look.typography.heading.size,
    width: 28,
    textAlign: 'center' as const,
  },
  nextDayTemps: {
    flexDirection: 'row' as const,
    gap: look.spacing.sm,
    flex: 1 as const,
  },
  nextDayHigh: {
    fontSize: look.typography.bodyStrong.size,
    fontWeight: look.typography.bodyStrong.weight,
    letterSpacing: look.typography.bodyStrong.tracking,
    color: t.textPrimary,
  },
  nextDayLow: {
    fontSize: look.typography.body.size,
    color: t.textTertiary,
  },
  nextDayRain: {
    fontSize: look.typography.label.size,
    color: t.rainBlue,
    width: 48,
    textAlign: 'right' as const,
  },
  nextDayWind: {
    fontSize: look.typography.label.size,
    color: t.textTertiary,
    width: 72,
    textAlign: 'right' as const,
  },

  // ── Modal ─────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1 as const,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: look.spacing.xl,
  },
  modalContent: {
    backgroundColor: t.card,
    borderRadius: look.radius.surface,
    padding: look.spacing.xl,
    width: '100%' as const,
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: look.typography.heading.size,
    fontWeight: look.typography.heading.weight,
    letterSpacing: look.typography.heading.tracking,
    color: t.textPrimary,
    marginBottom: 12,
  },
  modalOption: { paddingVertical: look.spacing.md, borderBottomWidth: 1, borderBottomColor: t.divider },
  modalOptionText: { fontSize: look.typography.heading.size, color: t.textPrimary },

  // ── Alert rules ───────────────────────────────────────────────
  ruleRow: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const,
    alignItems: 'center' as const, paddingVertical: look.spacing.md,
    borderBottomWidth: 1, borderBottomColor: t.divider,
  },
  ruleName: {
    fontSize: look.typography.bodyStrong.size,
    color: t.textPrimary,
    fontWeight: look.typography.bodyStrong.weight,
    letterSpacing: look.typography.bodyStrong.tracking,
  },
  ruleInterval: { fontSize: look.typography.caption.size, color: t.textTertiary },

  // ── History rows ──────────────────────────────────────────────
  historyRow: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const, paddingVertical: look.spacing.sm,
    borderBottomWidth: 1, borderBottomColor: t.divider,
  },
  historyRule: {
    fontSize: look.typography.bodyStrong.size,
    fontWeight: look.typography.bodyStrong.weight,
    letterSpacing: look.typography.bodyStrong.tracking,
    color: t.textPrimary,
  },
  historySummary: { fontSize: look.typography.caption.size, color: t.textSecondary, marginTop: 2 },
  historyTime: { fontSize: look.typography.label.size, color: t.textTertiary, marginLeft: 8 },
});
