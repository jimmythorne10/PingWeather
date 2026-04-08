import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
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
import type { DailyForecast } from '../../src/types';

export default function DashboardScreen() {
  const styles = useStyles(createStyles);
  const tokens = useTokens();
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const { locations, loadLocations } = useLocationsStore();
  const { rules, loadRules } = useAlertRulesStore();
  const { entries, loadHistory } = useAlertHistoryStore();
  const temperatureUnit = useSettingsStore((s) => s.temperatureUnit);
  const windSpeedUnit = useSettingsStore((s) => s.windSpeedUnit);

  const [weather, setWeather] = useState<{ daily: DailyForecast } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  useEffect(() => {
    loadLocations();
    loadRules();
    loadHistory();
  }, []);

  // Fetch weather for primary location
  useEffect(() => {
    const primaryLocation = locations.find((l) => l.is_active);
    if (!primaryLocation) return;

    setWeatherLoading(true);
    fetchForecast({
      latitude: primaryLocation.latitude,
      longitude: primaryLocation.longitude,
      forecastDays: 3,
      temperatureUnit,
      windSpeedUnit,
    })
      .then((data) => setWeather({ daily: data.daily }))
      .catch(() => {})
      .finally(() => setWeatherLoading(false));
  }, [locations, temperatureUnit, windSpeedUnit]);

  const primaryLocation = locations.find((l) => l.is_active);
  const activeRules = rules.filter((r) => r.is_active);
  const recentAlerts = entries.slice(0, 5);
  const unitSymbol = temperatureUnit === 'fahrenheit' ? '°F' : '°C';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>PingWeather</Text>
          <Text style={styles.subtitle}>
            {profile?.display_name ? `Hey, ${profile.display_name}` : 'Your weather, your rules.'}
          </Text>
        </View>
        <Pressable onPress={() => router.push('/(tabs)/settings')}>
          <Text style={{ fontSize: 24 }}>{'⚙️'}</Text>
        </Pressable>
      </View>

      {/* Forecast card — FR-HOME-001/002 */}
      <Pressable style={styles.card} onPress={() => {}}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Forecast</Text>
          {primaryLocation && (
            <Text style={styles.cardSubtitle}>{primaryLocation.name}</Text>
          )}
        </View>
        {!primaryLocation ? (
          <>
            <Text style={styles.cardBody}>Set up a location to see weather conditions.</Text>
            <Pressable style={styles.button} onPress={() => router.push('/(tabs)/locations')}>
              <Text style={styles.buttonText}>Add location</Text>
            </Pressable>
          </>
        ) : (
          <>
            {weatherLoading ? (
              <ActivityIndicator color={tokens.primary} style={{ marginVertical: 16 }} />
            ) : weather ? (
              <View style={styles.forecastRow}>
                {weather.daily.time.slice(0, 3).map((date, i) => {
                  const dayLabel = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
                  const high = Math.round(weather.daily.temperature_2m_max[i]);
                  const low = Math.round(weather.daily.temperature_2m_min[i]);
                  const rain = weather.daily.precipitation_probability_max[i];
                  return (
                    <View key={date} style={styles.forecastDay}>
                      <Text style={styles.forecastDayLabel}>{dayLabel}</Text>
                      <Text style={styles.forecastHigh}>{high}{unitSymbol}</Text>
                      <Text style={styles.forecastLow}>{low}{unitSymbol}</Text>
                      {rain > 0 && (
                        <Text style={styles.forecastRain}>{rain}% rain</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.cardBody}>Unable to load weather data.</Text>
            )}
            <Text style={styles.forecastExpandHint}>Tap to expand · View 14-day forecast</Text>
          </>
        )}
      </Pressable>

      {/* Active alerts summary */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Active Alerts</Text>
          <Text style={styles.cardBadge}>{activeRules.length}</Text>
        </View>
        {activeRules.length === 0 ? (
          <>
            <Text style={styles.cardBody}>No alerts configured yet.</Text>
            <Pressable style={styles.button} onPress={() => router.push('/(tabs)/alerts')}>
              <Text style={styles.buttonText}>Create Alert</Text>
            </Pressable>
          </>
        ) : (
          <>
            {activeRules.slice(0, 3).map((rule) => (
              <View key={rule.id} style={styles.ruleRow}>
                <Text style={styles.ruleName}>{rule.name}</Text>
                <Text style={styles.ruleInterval}>Every {rule.polling_interval_hours}h</Text>
              </View>
            ))}
            {activeRules.length > 3 && (
              <Pressable onPress={() => router.push('/(tabs)/alerts')}>
                <Text style={[styles.cardBody, { color: tokens.primary }]}>
                  +{activeRules.length - 3} more...
                </Text>
              </Pressable>
            )}
          </>
        )}
      </View>

      {/* Recent notifications */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Notifications</Text>
        {recentAlerts.length === 0 ? (
          <Text style={styles.cardBody}>
            No notifications yet. Alerts will appear here when triggered.
          </Text>
        ) : (
          recentAlerts.map((entry) => (
            <View key={entry.id} style={styles.historyRow}>
              <View>
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
          <Pressable onPress={() => router.push('/(tabs)/history')}>
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
  content: { padding: 20, paddingBottom: 40 },
  headerRow: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const,
    alignItems: 'center' as const, marginBottom: 20,
  },
  title: { fontSize: 28, fontWeight: '700' as const, color: t.textPrimary },
  subtitle: { fontSize: 15, color: t.textSecondary, marginTop: 2 },

  card: {
    backgroundColor: t.card, borderRadius: 12, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: t.borderLight,
  },
  cardHeaderRow: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const,
    alignItems: 'center' as const, marginBottom: 8,
  },
  cardTitle: { fontSize: 18, fontWeight: '600' as const, color: t.textPrimary, marginBottom: 8 },
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

  // Forecast
  forecastRow: { flexDirection: 'row' as const, justifyContent: 'space-around' as const, marginTop: 8 },
  forecastDay: { alignItems: 'center' as const, gap: 4 },
  forecastDayLabel: { fontSize: 14, fontWeight: '600' as const, color: t.textSecondary },
  forecastHigh: { fontSize: 22, fontWeight: '700' as const, color: t.textPrimary },
  forecastLow: { fontSize: 16, color: t.textTertiary },
  forecastRain: { fontSize: 12, color: t.rainBlue, fontWeight: '500' as const },
  forecastExpandHint: { fontSize: 12, color: t.textTertiary, textAlign: 'center' as const, marginTop: 12 },

  // Rules summary
  ruleRow: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const,
    alignItems: 'center' as const, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: t.divider,
  },
  ruleName: { fontSize: 15, color: t.textPrimary, fontWeight: '500' as const },
  ruleInterval: { fontSize: 13, color: t.textTertiary },

  // History
  historyRow: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: t.divider,
  },
  historyRule: { fontSize: 15, fontWeight: '500' as const, color: t.textPrimary },
  historySummary: { fontSize: 13, color: t.textSecondary, marginTop: 2 },
  historyTime: { fontSize: 12, color: t.textTertiary },
});
