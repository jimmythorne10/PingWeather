import { View, Text, ScrollView, Pressable, Switch, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useStyles, useTokens } from '../../src/theme';
import { useAuthStore } from '../../src/stores/authStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useThemeStore } from '../../src/stores/themeStore';
import type { ThemeTokens } from '../../src/theme';
import type { ThemeName } from '../../src/theme/tokens';

const APP_VERSION = '1.0.0';

export default function SettingsScreen() {
  const styles = useStyles(createStyles);
  const tokens = useTokens();
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const settings = useSettingsStore();
  const { themeName, setTheme } = useThemeStore();

  const [versionTapCount, setVersionTapCount] = useState(0);
  const developerMode = versionTapCount >= 7;

  const themeOptions: { name: ThemeName; label: string }[] = [
    { name: 'classic', label: 'Classic' },
    { name: 'dark', label: 'Dark' },
    { name: 'storm', label: 'Storm' },
  ];

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: () => signOut(),
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action is permanent and cannot be undone. Type "DELETE" to confirm.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // Client-side placeholder — actual deletion requires server-side call
          },
        },
      ]
    );
  };

  const handleVersionTap = () => {
    setVersionTapCount((prev) => prev + 1);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Account */}
      <Text style={styles.sectionTitle}>{'ACCOUNT'}</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{profile?.email ?? '—'}</Text>
        <Text style={styles.label}>Tier</Text>
        <Text style={styles.value}>
          {(profile?.subscription_tier ?? 'free').charAt(0).toUpperCase() +
            (profile?.subscription_tier ?? 'free').slice(1)}
        </Text>
      </View>

      {/* Units */}
      <Text style={styles.sectionTitle}>{'UNITS'}</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Temperature</Text>
          <View style={styles.toggleRow}>
            <Pressable
              style={[
                styles.toggleButton,
                settings.temperatureUnit === 'fahrenheit' && styles.toggleActive,
              ]}
              onPress={() => settings.setTemperatureUnit('fahrenheit')}
            >
              <Text
                style={[
                  styles.toggleText,
                  settings.temperatureUnit === 'fahrenheit' && styles.toggleTextActive,
                ]}
              >
                °F
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.toggleButton,
                settings.temperatureUnit === 'celsius' && styles.toggleActive,
              ]}
              onPress={() => settings.setTemperatureUnit('celsius')}
            >
              <Text
                style={[
                  styles.toggleText,
                  settings.temperatureUnit === 'celsius' && styles.toggleTextActive,
                ]}
              >
                °C
              </Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Wind Speed</Text>
          <View style={styles.toggleRow}>
            {(['mph', 'kmh', 'knots'] as const).map((unit) => (
              <Pressable
                key={unit}
                style={[
                  styles.toggleButton,
                  settings.windSpeedUnit === unit && styles.toggleActive,
                ]}
                onPress={() => settings.setWindSpeedUnit(unit)}
              >
                <Text
                  style={[
                    styles.toggleText,
                    settings.windSpeedUnit === unit && styles.toggleTextActive,
                  ]}
                >
                  {unit}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* Theme */}
      <Text style={styles.sectionTitle}>{'THEME'}</Text>
      <View style={styles.card}>
        {themeOptions.map((opt) => (
          <Pressable
            key={opt.name}
            style={[styles.row, { paddingVertical: 12 }]}
            onPress={() => setTheme(opt.name)}
          >
            <Text style={styles.label}>{opt.label}</Text>
            <Text style={{ fontSize: 18, color: tokens.primary }}>
              {themeName === opt.name ? '●' : '○'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Notifications */}
      <Text style={styles.sectionTitle}>{'NOTIFICATIONS'}</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Push Notifications</Text>
          <Switch
            value={settings.notificationsEnabled}
            onValueChange={settings.setNotificationsEnabled}
            trackColor={{ false: tokens.border, true: tokens.primaryLight }}
            thumbColor={settings.notificationsEnabled ? tokens.primary : tokens.textTertiary}
          />
        </View>
      </View>

      {/* History */}
      <Text style={styles.sectionTitle}>{'HISTORY'}</Text>
      <View style={styles.card}>
        <Pressable style={styles.row} onPress={() => router.push('/history')}>
          <Text style={styles.label}>Alert History</Text>
          <Text style={{ fontSize: 16, color: tokens.textTertiary }}>{'›'}</Text>
        </Pressable>
      </View>

      {/* Legal */}
      <Text style={styles.sectionTitle}>{'LEGAL'}</Text>
      <View style={styles.card}>
        <Pressable style={styles.row} onPress={() => router.push('/legal/eula')}>
          <Text style={styles.label}>Terms of Use</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={() => router.push('/legal/privacy-policy')}>
          <Text style={styles.label}>Privacy Policy</Text>
        </Pressable>
      </View>

      {/* Delete Account */}
      <Pressable style={styles.deleteButton} onPress={handleDeleteAccount}>
        <Text style={styles.deleteButtonText}>Delete Account</Text>
      </Pressable>

      {/* Sign out */}
      <Pressable style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>

      {/* Developer Options (easter egg) */}
      {developerMode && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Developer Options</Text>
          <Text style={styles.value}>Internal diagnostics enabled</Text>
        </View>
      )}

      {/* Version — tappable easter egg */}
      <Pressable onPress={handleVersionTap} style={styles.versionContainer}>
        <Text style={styles.versionText}>{`PingWeather v${APP_VERSION}`}</Text>
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: t.textTertiary,
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
  },
  card: {
    backgroundColor: t.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: t.borderLight,
  },
  row: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 4,
  },
  label: {
    fontSize: 16,
    color: t.textPrimary,
  },
  value: {
    fontSize: 14,
    color: t.textSecondary,
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: 'row' as const,
    gap: 4,
  },
  toggleButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: t.inputBackground,
    borderWidth: 1,
    borderColor: t.borderLight,
  },
  toggleActive: {
    backgroundColor: t.primary,
    borderColor: t.primary,
  },
  toggleText: {
    fontSize: 14,
    color: t.textSecondary,
    fontWeight: '500' as const,
  },
  toggleTextActive: {
    color: t.textOnPrimary,
  },
  deleteButton: {
    marginTop: 32,
    paddingVertical: 14,
    alignItems: 'center' as const,
    borderRadius: 8,
    backgroundColor: t.error,
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  signOutButton: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center' as const,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: t.error,
  },
  signOutText: {
    color: t.error,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  versionContainer: {
    marginTop: 24,
    alignItems: 'center' as const,
    paddingVertical: 8,
  },
  versionText: {
    fontSize: 13,
    color: t.textTertiary,
  },
});
