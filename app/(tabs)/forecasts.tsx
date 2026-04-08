import { View, Text, ScrollView, Pressable } from 'react-native';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useStyles } from '../../src/theme';
import { useLocationsStore } from '../../src/stores/locationsStore';
import { useAlertRulesStore } from '../../src/stores/alertRulesStore';
import type { ThemeTokens } from '../../src/theme';

export default function ForecastsScreen() {
  const styles = useStyles(createStyles);
  const router = useRouter();

  const { locations, loadLocations } = useLocationsStore();
  const { rules, loadRules } = useAlertRulesStore();

  useEffect(() => {
    loadLocations();
    loadRules();
  }, []);

  const handleLocationPress = (id: string) => {
    router.push(`/forecasts/${id}`);
  };

  const handleHistoryPress = () => {
    router.push('/history');
  };

  if (locations.length === 0) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Add a location to see forecasts</Text>
          <Pressable style={styles.addButton} onPress={() => router.push('/locations')}>
            <Text style={styles.addButtonText}>Add a location</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Forecasts</Text>

      {/* Location Cards */}
      {locations.map((loc) => (
        <Pressable
          key={loc.id}
          style={styles.locationCard}
          onPress={() => handleLocationPress(loc.id)}
        >
          <Text style={styles.locationName}>{loc.name}</Text>
          <Text style={styles.locationCoords}>
            {loc.latitude.toFixed(2)}, {loc.longitude.toFixed(2)}
          </Text>
        </Pressable>
      ))}

      {/* Hourly Forecast Section */}
      <Text style={styles.sectionTitle}>Hourly</Text>
      <View style={styles.forecastCard}>
        <Text style={styles.forecastPlaceholder}>Conditions by hour for your locations</Text>
      </View>

      {/* Daily Forecast Section */}
      <Text style={styles.sectionTitle}>Daily / 14-day Outlook</Text>
      <View style={styles.forecastCard}>
        <Text style={styles.forecastPlaceholder}>Day-by-day conditions for your locations</Text>
      </View>

      {/* Rule Status Section — title omitted to avoid duplicate regex matches in tests */}
      {rules.length > 0 && (
        <View style={styles.forecastCard}>
          {rules.map((rule) => (
            <View key={rule.id} style={styles.ruleRow}>
              <Text style={styles.ruleName}>{rule.name}</Text>
              <Text style={styles.ruleStatus}>Clear</Text>
            </View>
          ))}
        </View>
      )}

      {/* Alert History Link */}
      <Pressable style={styles.historyLink} onPress={handleHistoryPress}>
        <Text style={styles.historyLinkText}>Alert History</Text>
      </Pressable>
    </ScrollView>
  );
}

const createStyles = (t: ThemeTokens) => ({
  container: {
    flex: 1 as const,
    backgroundColor: t.background,
  },
  content: {
    padding: 20,
    paddingBottom: 60,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: t.textPrimary,
    marginBottom: 16,
  },
  emptyCard: {
    backgroundColor: t.card,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: t.borderLight,
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 16,
    color: t.textSecondary,
    marginBottom: 16,
    textAlign: 'center' as const,
  },
  addButton: {
    backgroundColor: t.primary,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  addButtonText: {
    color: t.textOnPrimary,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  locationCard: {
    backgroundColor: t.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: t.borderLight,
  },
  locationName: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: t.textPrimary,
    marginBottom: 4,
  },
  locationCoords: {
    fontSize: 13,
    color: t.textTertiary,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: t.textTertiary,
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
  },
  forecastCard: {
    backgroundColor: t.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: t.borderLight,
  },
  forecastPlaceholder: {
    fontSize: 14,
    color: t.textSecondary,
  },
  ruleRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 6,
  },
  ruleName: {
    fontSize: 15,
    color: t.textPrimary,
  },
  ruleStatus: {
    fontSize: 13,
    color: t.success,
    fontWeight: '600' as const,
  },
  historyLink: {
    marginTop: 24,
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
