import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useStyles, useTokens } from '../../src/theme';
import type { ThemeTokens } from '../../src/theme';

export default function DashboardScreen() {
  const styles = useStyles(createStyles);
  const tokens = useTokens();
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>WeatherWatch</Text>
      <Text style={styles.subtitle}>Your weather, your rules.</Text>

      {/* Current conditions summary card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Current Conditions</Text>
        <Text style={styles.cardBody}>
          Add a location to see current weather conditions.
        </Text>
        <Pressable
          style={styles.button}
          onPress={() => router.push('/(tabs)/locations')}
        >
          <Text style={styles.buttonText}>Add Location</Text>
        </Pressable>
      </View>

      {/* Active alerts summary */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Active Alerts</Text>
        <Text style={styles.cardBody}>
          No alerts configured yet. Set up your first alert rule.
        </Text>
        <Pressable
          style={styles.button}
          onPress={() => router.push('/(tabs)/alerts')}
        >
          <Text style={styles.buttonText}>Create Alert</Text>
        </Pressable>
      </View>

      {/* Recent alert history */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Notifications</Text>
        <Text style={styles.cardBody}>
          No notifications yet. Alerts will appear here when triggered.
        </Text>
      </View>

      {/* Settings gear */}
      <Pressable
        style={styles.settingsLink}
        onPress={() => router.push('/(tabs)/settings')}
      >
        <Text style={[styles.cardBody, { color: tokens.primary }]}>Settings</Text>
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
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: t.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: t.textSecondary,
    marginBottom: 24,
  },
  card: {
    backgroundColor: t.card,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: t.borderLight,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: t.textPrimary,
    marginBottom: 8,
  },
  cardBody: {
    fontSize: 14,
    color: t.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  button: {
    backgroundColor: t.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center' as const,
  },
  buttonText: {
    color: t.textOnPrimary,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  settingsLink: {
    alignItems: 'center' as const,
    paddingVertical: 12,
  },
});
