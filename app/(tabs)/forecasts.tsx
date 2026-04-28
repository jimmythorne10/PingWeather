import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useStyles, useTokens } from '../../src/theme';
import { useLocationsStore } from '../../src/stores/locationsStore';
import { useAlertRulesStore } from '../../src/stores/alertRulesStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { fetchForecast } from '../../src/services/weatherApi';
import { weatherCodeToEmoji, degreesToCardinal } from '../../src/services/weatherIcon';
import { RainfallCard } from '../../src/components/RainfallCard';
import type { ThemeTokens } from '../../src/theme';
import type { HourlyForecast, DailyForecast, AlertRule } from '../../src/types';

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

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [forecasts, setForecasts] = useState<Record<string, LocationForecast>>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
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
      // fail silently
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

  const unitSymbol = temperatureUnit === 'fahrenheit' ? '°F' : '°C';

  const formatDayLabel = (date: string, index: number) => {
    if (index === 0) return 'Today';
    if (index === 1) return 'Tomorrow';
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
  };

  const formatHourLabel = (time: string) => {
    const d = new Date(time);
    return d.toLocaleTimeString('en-US', { hour: 'numeric' });
  };

  // Evaluate if a rule would trigger based on current forecast
  const ruleWouldTrigger = (rule: AlertRule, forecast: LocationForecast): { triggered: boolean; detail: string } => {
    const now = new Date();
    const cutoff = new Date(now.getTime() + rule.lookahead_hours * 60 * 60 * 1000);

    for (const condition of rule.conditions) {
      let values: number[] = [];
      if (condition.metric === 'temperature_low') {
        values = forecast.daily.temperature_2m_min.filter((_, i) => {
          const d = new Date(forecast.daily.time[i]);
          return d >= now && d <= cutoff;
        });
      } else if (condition.metric === 'temperature_high') {
        values = forecast.daily.temperature_2m_max.filter((_, i) => {
          const d = new Date(forecast.daily.time[i]);
          return d >= now && d <= cutoff;
        });
      } else if (condition.metric === 'precipitation_probability') {
        values = forecast.daily.precipitation_probability_max.filter((_, i) => {
          const d = new Date(forecast.daily.time[i]);
          return d >= now && d <= cutoff;
        });
      } else if (condition.metric === 'wind_speed') {
        values = forecast.daily.wind_speed_10m_max.filter((_, i) => {
          const d = new Date(forecast.daily.time[i]);
          return d >= now && d <= cutoff;
        });
      }

      for (const val of values) {
        let matched = false;
        if (condition.operator === 'gt' && val > condition.value) matched = true;
        if (condition.operator === 'gte' && val >= condition.value) matched = true;
        if (condition.operator === 'lt' && val < condition.value) matched = true;
        if (condition.operator === 'lte' && val <= condition.value) matched = true;
        if (matched) {
          return { triggered: true, detail: `${condition.metric.replace(/_/g, ' ')} ${val}` };
        }
      }
    }
    return { triggered: false, detail: 'Clear' };
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
                    {/* Hourly scroll */}
                    <Text style={styles.sectionLabel}>Next 24 hours</Text>
                    <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourlyRow}>
                      {forecast.hourly.time.slice(0, 24).map((time, i) => (
                        <View key={time} style={styles.hourlyItem}>
                          <Text style={styles.hourlyTime}>{formatHourLabel(time)}</Text>
                          <Text style={styles.hourlyTemp}>
                            {Math.round(forecast.hourly.temperature_2m[i])}{unitSymbol}
                          </Text>
                          {forecast.hourly.precipitation_probability[i] > 0 && (
                            <Text style={styles.hourlyRain}>
                              {forecast.hourly.precipitation_probability[i]}%
                            </Text>
                          )}
                        </View>
                      ))}
                    </ScrollView>

                    {/* Rainfall history */}
                    <RainfallCard
                      locationId={loc.id}
                      latitude={loc.latitude}
                      longitude={loc.longitude}
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
                    {forecast.daily.time.map((date, i) => (
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
                      </Pressable>
                    ))}

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
  content: { padding: 16, paddingBottom: 40, paddingTop: 20 },

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
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: t.divider,
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
});
