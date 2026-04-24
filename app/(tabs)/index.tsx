import { View, Text, ScrollView, Pressable, ActivityIndicator, Modal, RefreshControl } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useStyles, useTokens } from '../../src/theme';
import { useAuthStore } from '../../src/stores/authStore';
import { useLocationsStore } from '../../src/stores/locationsStore';
import { useAlertRulesStore } from '../../src/stores/alertRulesStore';
import { useAlertHistoryStore } from '../../src/stores/alertHistoryStore';
import { fetchForecast } from '../../src/services/weatherApi';
import { useSettingsStore } from '../../src/stores/settingsStore';
import type { ThemeTokens } from '../../src/theme';
import type { DailyForecast, WatchLocation } from '../../src/types';

export default function HomeScreen() {
  const styles = useStyles(createStyles);
  const tokens = useTokens();
  const router = useRouter();
  const { locations, loadLocations } = useLocationsStore();
  const { rules, loadRules } = useAlertRulesStore();
  const { entries, loadHistory } = useAlertHistoryStore();
  const temperatureUnit = useSettingsStore((s) => s.temperatureUnit);
  const windSpeedUnit = useSettingsStore((s) => s.windSpeedUnit);

  const [weather, setWeather] = useState<{ daily: DailyForecast } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const FORECAST_DAYS = 14;

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
    try {
      const data = await fetchForecast({
        latitude: location.latitude,
        longitude: location.longitude,
        forecastDays: FORECAST_DAYS,
        temperatureUnit,
        windSpeedUnit,
      });
      setWeather({ daily: data.daily });
    } catch {
      // fail silently
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

  const formatDayLabel = (date: string, index: number) => {
    if (index === 0) return 'Today';
    if (index === 1) return 'Tomorrow';
    return new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      {/* Forecast card — no Pressable wrapper (blocks horizontal scroll) */}
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
        ) : weather ? (
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.forecastRow}
          >
            {weather.daily.time.slice(0, FORECAST_DAYS).map((date, i) => {
              const high = Math.round(weather.daily.temperature_2m_max[i]);
              const low = Math.round(weather.daily.temperature_2m_min[i]);
              const rain = weather.daily.precipitation_probability_max[i];
              const wind = Math.round(weather.daily.wind_speed_10m_max[i]);
              return (
                <View key={date} style={styles.forecastDay}>
                  <Text style={styles.forecastDayLabel}>{formatDayLabel(date, i)}</Text>
                  <Text style={styles.forecastHigh}>{high}{unitSymbol}</Text>
                  <Text style={styles.forecastLow}>{low}{unitSymbol}</Text>
                  {rain > 0 && <Text style={styles.forecastRain}>{rain}%</Text>}
                  <Text style={styles.forecastWind}>{wind} {windSpeedUnit}</Text>
                </View>
              );
            })}
          </ScrollView>
        ) : (
          <Text style={styles.cardBody}>Unable to load weather data.</Text>
        )}
      </View>

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
                  selectedLocation?.id === loc.id && { color: tokens.primary, fontWeight: '700' },
                ]}>
                  {loc.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Active alerts — tappable card, tappable rows */}
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

      {/* Recent notifications */}
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
                {new Date(entry.triggered_at).toLocaleDateString()}
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
    </ScrollView>
  );
}

const createStyles = (t: ThemeTokens) => ({
  container: { flex: 1 as const, backgroundColor: t.background },
  content: { padding: 16, paddingBottom: 40, paddingTop: 20 },

  card: {
    backgroundColor: t.card, borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: t.borderLight,
  },
  cardHeaderRow: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const,
    alignItems: 'center' as const, marginBottom: 12,
  },
  cardHeaderRight: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  cardTitle: { fontSize: 18, fontWeight: '600' as const, color: t.textPrimary },
  cardBadge: {
    backgroundColor: t.primary, color: t.textOnPrimary, fontSize: 13, fontWeight: '700' as const,
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12,
  },
  cardBody: { fontSize: 14, color: t.textSecondary, lineHeight: 20, marginBottom: 12 },

  button: {
    backgroundColor: t.primary, paddingVertical: 12, paddingHorizontal: 20,
    borderRadius: 8, alignItems: 'center' as const,
  },
  buttonText: { color: t.textOnPrimary, fontSize: 16, fontWeight: '600' as const },

  cardSubtitle: { fontSize: 13, color: t.textTertiary },

  locationPicker: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: t.primaryLight,
  },
  locationPickerText: { fontSize: 13, color: t.primary, fontWeight: '600' as const },

  forecastRow: {
    flexDirection: 'row' as const,
    gap: 16,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  forecastDay: {
    alignItems: 'center' as const,
    gap: 4,
    minWidth: 60,
  },
  forecastDayLabel: { fontSize: 12, fontWeight: '600' as const, color: t.textSecondary, textAlign: 'center' as const },
  forecastHigh: { fontSize: 20, fontWeight: '700' as const, color: t.textPrimary },
  forecastLow: { fontSize: 14, color: t.textTertiary },
  forecastRain: { fontSize: 11, color: t.rainBlue, fontWeight: '500' as const },
  forecastWind: { fontSize: 10, color: t.textTertiary },

  modalOverlay: {
    flex: 1 as const,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 20,
  },
  modalContent: {
    backgroundColor: t.card,
    borderRadius: 12,
    padding: 20,
    width: '100%' as const,
    maxWidth: 320,
  },
  modalTitle: { fontSize: 18, fontWeight: '600' as const, color: t.textPrimary, marginBottom: 12 },
  modalOption: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.divider },
  modalOptionText: { fontSize: 16, color: t.textPrimary },

  ruleRow: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const,
    alignItems: 'center' as const, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: t.divider,
  },
  ruleName: { fontSize: 15, color: t.textPrimary, fontWeight: '500' as const },
  ruleInterval: { fontSize: 13, color: t.textTertiary },

  historyRow: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: t.divider,
  },
  historyRule: { fontSize: 15, fontWeight: '500' as const, color: t.textPrimary },
  historySummary: { fontSize: 13, color: t.textSecondary, marginTop: 2 },
  historyTime: { fontSize: 12, color: t.textTertiary, marginLeft: 8 },
});
