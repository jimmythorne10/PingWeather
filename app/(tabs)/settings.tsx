import { View, Text, ScrollView, Pressable, Switch, Alert, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useStyles, useTokens } from '../../src/theme';
import { useAuthStore } from '../../src/stores/authStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useThemeStore } from '../../src/stores/themeStore';
import { useLocationsStore } from '../../src/stores/locationsStore';
import { usePushNotifications } from '../../src/hooks/usePushNotifications';
import { useWalkthrough } from '../../src/hooks/useWalkthrough';
import { WalkthroughModal } from '../../src/components/WalkthroughModal';
import { isDevAccount } from '../../src/utils/devAccount';
import { supabase } from '../../src/utils/supabase';
import { TIER_LIMITS } from '../../src/types';
import type { ThemeTokens } from '../../src/theme';
import type { ThemeName } from '../../src/theme/tokens';
import type { SubscriptionTier } from '../../src/types';

const APP_VERSION = '1.0.0';

const DAY_LABELS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatHour(h: number): string {
  if (h === 0) return '12:00 AM';
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return '12:00 PM';
  return `${h - 12}:00 PM`;
}

export default function SettingsScreen() {
  const styles = useStyles(createStyles);
  const tokens = useTokens();
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const settings = useSettingsStore();
  const { themeName, setTheme } = useThemeStore();
  const { registerForPushNotifications } = usePushNotifications();

  const locations = useLocationsStore((s) => s.locations);

  const { visible: walkthroughVisible, show: showWalkthrough, dismiss: dismissWalkthrough } = useWalkthrough();

  const [tierSwitching, setTierSwitching] = useState<SubscriptionTier | null>(null);
  const [pushRegistering, setPushRegistering] = useState(false);
  const [pushResult, setPushResult] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [digestSaving, setDigestSaving] = useState(false);

  const digestEnabled = profile?.digest_enabled ?? false;
  const digestFrequency = profile?.digest_frequency ?? 'daily';
  const digestHour = profile?.digest_hour ?? 7;
  const digestDayOfWeek = profile?.digest_day_of_week ?? 1;
  const digestLocationId = profile?.digest_location_id ?? null;

  const handleDigestUpdate = async (updates: Partial<{
    digest_enabled: boolean;
    digest_frequency: 'daily' | 'weekly';
    digest_hour: number;
    digest_day_of_week: number;
    digest_location_id: string | null;
  }>) => {
    if (updates.digest_enabled === false) {
      Alert.alert(
        'Turn Off Digest?',
        'Without a regular forecast digest, Android may put this app into deep sleep and delay or skip your weather alerts. Are you sure?',
        [
          { text: 'Keep It On', style: 'cancel' },
          {
            text: 'Turn Off',
            style: 'destructive',
            onPress: async () => {
              setDigestSaving(true);
              await updateProfile(updates);
              setDigestSaving(false);
            },
          },
        ]
      );
      return;
    }
    setDigestSaving(true);
    await updateProfile(updates);
    setDigestSaving(false);
  };

  const handleRegisterPush = async () => {
    setPushResult(null);
    setPushRegistering(true);
    const { token, error: regError } = await registerForPushNotifications();
    setPushRegistering(false);
    if (token) {
      setPushResult(`✓ Registered: ${token.slice(0, 32)}…`);
    } else {
      setPushResult(`✗ ${regError ?? 'Registration failed (check logs).'}`);
    }
  };

  const currentTier = (profile?.subscription_tier ?? 'free') as SubscriptionTier;
  const canOverrideTier = isDevAccount(profile?.email);
  const currentLimits = TIER_LIMITS[currentTier];

  const themeOptions: { name: ThemeName; label: string }[] = [
    { name: 'classic', label: 'Classic' },
    { name: 'dark', label: 'Dark' },
    { name: 'storm', label: 'Storm' },
  ];

  const tierOptions: { value: SubscriptionTier; label: string }[] = [
    { value: 'free', label: 'Free' },
    { value: 'pro', label: 'Pro' },
    { value: 'premium', label: 'Premium' },
  ];

  const handleTierOverride = async (tier: SubscriptionTier) => {
    if (tier === currentTier || tierSwitching) return;
    setTierSwitching(tier);
    await updateProfile({ subscription_tier: tier });
    setTierSwitching(null);
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account, locations, alert rules, and history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const { error } = await supabase.functions.invoke('delete-account', {
                method: 'POST',
              });
              if (error) throw error;
              // Sign out clears local state; auth gate redirects to /login
              await signOut();
            } catch (err) {
              setDeleting(false);
              const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
              Alert.alert('Deletion Failed', msg);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Account */}
      <Text style={styles.sectionTitle}>{'ACCOUNT'}</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{profile?.email ?? '—'}</Text>
        <Text style={styles.label}>Current plan</Text>
        <Text style={styles.valueBold}>
          {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
        </Text>
        <Text style={styles.limitsLine}>
          {currentLimits.maxLocations} location{currentLimits.maxLocations !== 1 ? 's' : ''} ·{' '}
          {currentLimits.maxAlertRules === 999 ? 'unlimited' : currentLimits.maxAlertRules} rule
          {currentLimits.maxAlertRules !== 1 ? 's' : ''} ·{' '}
          {currentLimits.minPollingIntervalHours}h min polling
        </Text>
      </View>

      {/* Plan CTA — always visible so Premium users can downgrade */}
      <Pressable style={styles.upgradeButton} onPress={() => router.push('/upgrade')}>
        <Text style={styles.upgradeButtonText}>
          {currentTier === 'free'
            ? 'Upgrade to Pro or Premium →'
            : currentTier === 'pro'
              ? 'Upgrade to Premium →'
              : 'Manage Plan →'}
        </Text>
        <Text style={styles.upgradeButtonSubtext}>
          {currentTier === 'premium'
            ? 'Change plan or cancel subscription'
            : 'More locations, faster polling, compound alerts'}
        </Text>
      </Pressable>

      {/* Developer Tier Override — only for the developer account */}
      {canOverrideTier && (
        <>
          <Text style={styles.sectionTitle}>{'DEVELOPER OPTIONS'}</Text>
          <View style={[styles.card, styles.devCard]}>
            <Text style={styles.devBadge}>DEV</Text>
            <Text style={styles.label}>Tier Override</Text>
            <Text style={styles.devHint}>
              Switch tiers instantly for testing. This writes directly to your profile in Supabase.
              Only visible to the developer account.
            </Text>
            <View style={styles.tierRow}>
              {tierOptions.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[
                    styles.tierButton,
                    currentTier === opt.value && styles.tierButtonActive,
                    tierSwitching === opt.value && { opacity: 0.5 },
                  ]}
                  onPress={() => handleTierOverride(opt.value)}
                  disabled={tierSwitching !== null}
                >
                  <Text
                    style={[
                      styles.tierButtonText,
                      currentTier === opt.value && styles.tierButtonTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={[styles.card, styles.devCard, { marginTop: 12 }]}>
            <Text style={styles.devBadge}>DEV</Text>
            <Text style={styles.label}>Push Token</Text>
            <Text style={styles.devHint}>
              Re-request notification permission and push the latest Expo token to your Supabase
              profile. Useful after a fresh install or if notifications aren't arriving.
            </Text>
            <Pressable
              style={[styles.pushRegisterButton, { borderColor: tokens.primary }]}
              onPress={handleRegisterPush}
              disabled={pushRegistering}
            >
              <Text style={[styles.pushRegisterText, { color: tokens.primary }]}>
                {pushRegistering ? 'Registering…' : 'Register / Refresh Push Token'}
              </Text>
            </Pressable>
            {pushResult && (
              <Text
                selectable
                style={[
                  styles.pushResult,
                  { color: pushResult.startsWith('✓') ? tokens.success : tokens.error },
                ]}
              >
                {pushResult}
              </Text>
            )}
          </View>
        </>
      )}

      {/* Units */}
      <Text style={styles.sectionTitle}>{'UNITS'}</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Temperature</Text>
          <View style={styles.toggleRow}>
            <Pressable
              style={[styles.toggleButton, settings.temperatureUnit === 'fahrenheit' && styles.toggleActive]}
              onPress={() => { settings.setTemperatureUnit('fahrenheit'); void updateProfile({ temperature_unit: 'fahrenheit' }); }}
            >
              <Text style={[styles.toggleText, settings.temperatureUnit === 'fahrenheit' && styles.toggleTextActive]}>°F</Text>
            </Pressable>
            <Pressable
              style={[styles.toggleButton, settings.temperatureUnit === 'celsius' && styles.toggleActive]}
              onPress={() => { settings.setTemperatureUnit('celsius'); void updateProfile({ temperature_unit: 'celsius' }); }}
            >
              <Text style={[styles.toggleText, settings.temperatureUnit === 'celsius' && styles.toggleTextActive]}>°C</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Wind Speed</Text>
          <View style={styles.toggleRow}>
            {(['mph', 'kmh', 'knots'] as const).map((unit) => (
              <Pressable
                key={unit}
                style={[styles.toggleButton, settings.windSpeedUnit === unit && styles.toggleActive]}
                onPress={() => { settings.setWindSpeedUnit(unit); void updateProfile({ wind_speed_unit: unit }); }}
              >
                <Text style={[styles.toggleText, settings.windSpeedUnit === unit && styles.toggleTextActive]}>{unit}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* Theme */}
      <Text style={styles.sectionTitle}>{'THEME'}</Text>
      <View style={styles.card}>
        {themeOptions.map((opt) => (
          <Pressable key={opt.name} style={[styles.row, { paddingVertical: 12 }]} onPress={() => setTheme(opt.name)}>
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

      {/* Forecast Digest */}
      <Text style={styles.sectionTitle}>{'FORECAST DIGEST'}</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.label}>Daily or weekly forecast summary</Text>
            <Text style={[styles.devHint, { marginTop: 2, marginBottom: 0 }]}>
              Keeps alerts working reliably on Android and gives you a weather heads-up even on quiet days.
            </Text>
          </View>
          <Switch
            value={digestEnabled}
            onValueChange={(val) => handleDigestUpdate({ digest_enabled: val })}
            disabled={digestSaving}
            trackColor={{ false: tokens.border, true: tokens.primaryLight }}
            thumbColor={digestEnabled ? tokens.primary : tokens.textTertiary}
          />
        </View>

        {digestEnabled && (
          <>
            {/* Frequency */}
            <View style={[styles.row, { marginTop: 12 }]}>
              <Text style={styles.label}>Frequency</Text>
              <View style={styles.toggleRow}>
                {(['daily', 'weekly'] as const).map((f) => (
                  <Pressable
                    key={f}
                    style={[styles.toggleButton, digestFrequency === f && styles.toggleActive]}
                    onPress={() => handleDigestUpdate({ digest_frequency: f })}
                    disabled={digestSaving}
                  >
                    <Text style={[styles.toggleText, digestFrequency === f && styles.toggleTextActive]}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Day of week (weekly only) */}
            {digestFrequency === 'weekly' && (
              <View style={[styles.row, { marginTop: 8, flexWrap: 'wrap' as const, gap: 4 }]}>
                <Text style={[styles.label, { width: '100%' as unknown as number, marginBottom: 6 }]}>Day</Text>
                {DAY_LABELS.slice(1).map((label, i) => {
                  const day = i + 1;
                  return (
                    <Pressable
                      key={day}
                      style={[styles.toggleButton, digestDayOfWeek === day && styles.toggleActive]}
                      onPress={() => handleDigestUpdate({ digest_day_of_week: day })}
                      disabled={digestSaving}
                    >
                      <Text style={[styles.toggleText, digestDayOfWeek === day && styles.toggleTextActive]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Hour picker */}
            <View style={[styles.row, { marginTop: 8 }]}>
              <Text style={styles.label}>Send at</Text>
              <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 }}>
                <Pressable
                  onPress={() => handleDigestUpdate({ digest_hour: (digestHour + 23) % 24 })}
                  disabled={digestSaving}
                  style={styles.hourButton}
                >
                  <Text style={[styles.hourButtonText, { color: tokens.primary }]}>{'‹'}</Text>
                </Pressable>
                <Text style={[styles.label, { minWidth: 72, textAlign: 'center' as const }]}>
                  {formatHour(digestHour)}
                </Text>
                <Pressable
                  onPress={() => handleDigestUpdate({ digest_hour: (digestHour + 1) % 24 })}
                  disabled={digestSaving}
                  style={styles.hourButton}
                >
                  <Text style={[styles.hourButtonText, { color: tokens.primary }]}>{'›'}</Text>
                </Pressable>
              </View>
            </View>

            {/* Location picker */}
            <Text style={[styles.label, { marginTop: 12, marginBottom: 6 }]}>Location</Text>
            {locations.length === 0 ? (
              <Text style={styles.devHint}>Add a location first to enable the digest.</Text>
            ) : (
              locations.map((loc) => (
                <Pressable
                  key={loc.id}
                  style={[styles.row, { paddingVertical: 10 }]}
                  onPress={() => handleDigestUpdate({ digest_location_id: loc.id })}
                  disabled={digestSaving}
                >
                  <Text style={styles.label}>{loc.name}</Text>
                  <Text style={{ fontSize: 16, color: tokens.primary }}>
                    {digestLocationId === loc.id ? '●' : '○'}
                  </Text>
                </Pressable>
              ))
            )}

            {digestSaving && (
              <ActivityIndicator size="small" color={tokens.primary} style={{ marginTop: 8 }} />
            )}
          </>
        )}
      </View>

      {/* History */}
      <Text style={styles.sectionTitle}>{'HISTORY'}</Text>
      <View style={styles.card}>
        <Pressable style={styles.row} onPress={() => router.push('/history')}>
          <Text style={styles.label}>Alert History</Text>
          <Text style={{ fontSize: 16, color: tokens.textTertiary }}>{'›'}</Text>
        </Pressable>
      </View>

      {/* Help */}
      <Text style={styles.sectionTitle}>{'HELP'}</Text>
      <View style={styles.card}>
        <Pressable style={styles.row} onPress={showWalkthrough}>
          <Text style={styles.label}>Watch Tutorial</Text>
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
      <Pressable
        style={[styles.deleteButton, deleting && { opacity: 0.6 }]}
        onPress={handleDeleteAccount}
        disabled={deleting}
      >
        {deleting
          ? <ActivityIndicator color="#ffffff" />
          : <Text style={styles.deleteButtonText}>Delete Account</Text>
        }
      </Pressable>

      {/* Sign Out */}
      <Pressable style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>

      {/* Version */}
      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>{`PingWeather v${APP_VERSION}`}</Text>
        <Text style={styles.versionSubtext}>by Truth Centered Tech</Text>
      </View>

      <WalkthroughModal visible={walkthroughVisible} onDismiss={dismissWalkthrough} />
    </ScrollView>
  );
}

const createStyles = (t: ThemeTokens) => ({
  container: { flex: 1 as const, backgroundColor: t.background },
  content: { padding: 20, paddingBottom: 60 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
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
    paddingVertical: 8,
  },
  label: { fontSize: 15, color: t.textPrimary },
  value: { fontSize: 14, color: t.textSecondary, marginBottom: 12 },
  valueBold: { fontSize: 15, fontWeight: '600' as const, color: t.textPrimary, marginBottom: 4 },
  limitsLine: { fontSize: 12, color: t.textTertiary },

  // Upgrade CTA
  upgradeButton: {
    backgroundColor: t.primary,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    alignItems: 'center' as const,
  },
  upgradeButtonText: { color: t.textOnPrimary, fontSize: 16, fontWeight: '700' as const },
  upgradeButtonSubtext: { color: t.textOnPrimary, fontSize: 12, marginTop: 4, opacity: 0.85 },

  // Dev override
  devCard: {
    borderColor: t.warning,
    borderWidth: 2,
  },
  devBadge: {
    alignSelf: 'flex-start' as const,
    backgroundColor: t.warning,
    color: '#000000',
    fontSize: 10,
    fontWeight: '700' as const,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 8,
  },
  devHint: { fontSize: 12, color: t.textSecondary, marginTop: 4, marginBottom: 12, lineHeight: 18 },
  tierRow: { flexDirection: 'row' as const, gap: 8 },
  tierButton: {
    flex: 1 as const,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: t.border,
    alignItems: 'center' as const,
    backgroundColor: t.inputBackground,
  },
  tierButtonActive: {
    backgroundColor: t.primary,
    borderColor: t.primary,
  },
  tierButtonText: { fontSize: 14, fontWeight: '600' as const, color: t.textSecondary },
  tierButtonTextActive: { color: t.textOnPrimary },

  // Push register button + result
  pushRegisterButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center' as const,
  },
  pushRegisterText: { fontSize: 14, fontWeight: '600' as const },
  pushResult: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 15,
  },

  // Toggles
  toggleRow: { flexDirection: 'row' as const, gap: 4 },
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
  toggleText: { fontSize: 14, color: t.textSecondary, fontWeight: '500' as const },
  toggleTextActive: { color: t.textOnPrimary },

  // Destructive
  deleteButton: {
    marginTop: 24,
    paddingVertical: 14,
    alignItems: 'center' as const,
    borderRadius: 8,
    backgroundColor: t.error,
  },
  deleteButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' as const },
  signOutButton: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center' as const,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: t.error,
  },
  signOutText: { color: t.error, fontSize: 16, fontWeight: '600' as const },

  // Digest hour picker
  hourButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: t.inputBackground,
    borderWidth: 1,
    borderColor: t.borderLight,
  },
  hourButtonText: { fontSize: 20, fontWeight: '600' as const, lineHeight: 24 },

  // Version
  versionContainer: { marginTop: 24, alignItems: 'center' as const, paddingVertical: 8 },
  versionText: { fontSize: 13, color: t.textTertiary, fontWeight: '600' as const },
  versionSubtext: { fontSize: 11, color: t.textTertiary, marginTop: 2 },
});
