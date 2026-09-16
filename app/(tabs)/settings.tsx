import { View, Text, ScrollView, Pressable, Switch, Alert, ActivityIndicator, Platform } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
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
import type { LookTokens } from '../../src/theme/looks';
import { palettesForLook, type LookName } from '../../src/theme/looks';
import type { PaletteName } from '../../src/theme/palettes';
import type { SubscriptionTier } from '../../src/types';

const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

const LOOK_OPTIONS: { name: LookName; label: string }[] = [
  { name: 'aurora', label: 'Aurora' },
  { name: 'classic', label: 'Classic' },
];

const PALETTE_LABELS: Record<string, string> = {
  classic: 'Classic',
  dark: 'Dark',
  storm: 'Storm',
  blaze: 'Blaze',
  timber: 'Timber',
};

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
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const settings = useSettingsStore();
  const lookName = useThemeStore((s) => s.look);
  const look = useThemeStore((s) => s.tokens);
  const palette = useThemeStore((s) => s.palette);
  const setLook = useThemeStore((s) => s.setLook);
  const setPalette = useThemeStore((s) => s.setPalette);
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
        'Without a regular forecast digest, your device may delay or skip weather alerts in the background. Are you sure?',
        [
          { text: 'Keep It On', style: 'cancel' },
          {
            text: 'Turn Off',
            style: 'destructive',
            onPress: async () => {
              setDigestSaving(true);
              try {
                const ok = await updateProfile(updates);
                if (!ok) {
                  Alert.alert('Save Failed', useAuthStore.getState().error ?? 'Could not save. Please try again.');
                }
              } finally {
                setDigestSaving(false);
              }
            },
          },
        ]
      );
      return;
    }
    const effectiveUpdates = { ...updates };
    if (updates.digest_enabled === true && !digestLocationId && locations.length > 0) {
      effectiveUpdates.digest_location_id = locations[0].id;
    }
    setDigestSaving(true);
    try {
      const ok = await updateProfile(effectiveUpdates);
      if (!ok) {
        Alert.alert('Save Failed', useAuthStore.getState().error ?? 'Could not save. Please try again.');
      }
    } finally {
      setDigestSaving(false);
    }
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

  const handleNotificationToggle = async (enabled: boolean) => {
    if (!enabled) {
      settings.setNotificationsEnabled(false);
      return;
    }
    setPushRegistering(true);
    const { token, error: regError } = await registerForPushNotifications();
    setPushRegistering(false);
    if (token) {
      settings.setNotificationsEnabled(true);
    } else {
      Alert.alert(
        'Notifications Unavailable',
        regError?.toLowerCase().includes('denied')
          ? Platform.select({
              ios: 'WeatherBeacon needs notification permission. Go to iPhone Settings → WeatherBeacon → Notifications and enable them, then try again.',
              android: 'WeatherBeacon needs notification permission. Go to Settings → Apps → WeatherBeacon → Notifications and enable them, then try again.',
              default: 'WeatherBeacon needs notification permission. Enable notifications for WeatherBeacon in your device settings, then try again.',
            })
          : (regError ?? 'Could not enable notifications. Please try again.'),
        [{ text: 'OK' }]
      );
    }
  };

  const currentTier = (profile?.subscription_tier ?? 'free') as SubscriptionTier;
  const canOverrideTier = isDevAccount(profile?.email);
  const currentLimits = TIER_LIMITS[currentTier];

  // Palettes are scoped to the active look — see FEAT-003. Deriving the list
  // from palettesForLook() rather than hardcoding it is what stops a dark
  // Aurora palette being offered against Classic's light proportions.
  const paletteOptions = palettesForLook(lookName).map((name) => ({
    name: name as PaletteName,
    label: PALETTE_LABELS[name] ?? name,
  }));

  const tierOptions: { value: SubscriptionTier; label: string }[] = [
    { value: 'free', label: 'Free' },
    { value: 'pro', label: 'Pro' },
    { value: 'premium', label: 'Premium' },
  ];

  const handleTierOverride = async (tier: SubscriptionTier) => {
    if (tier === currentTier || tierSwitching) return;
    setTierSwitching(tier);
    try {
      const { error } = await supabase.functions.invoke('dev-tier-override', {
        body: { tier },
      });
      if (error) {
        console.error('Tier override failed:', error);
        Alert.alert('Error', 'Failed to update tier. Check console.');
      } else {
        // Re-fetch profile so the store reflects the new tier written by service role
        await fetchProfile();
        Alert.alert('Success', `Tier set to ${tier}`);
      }
    } catch (err) {
      console.error('Tier override error:', err);
      Alert.alert('Error', 'Failed to update tier. Check console.');
    }
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
              Switch tiers instantly for testing. Uses a service-role Edge Function to bypass RLS.
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
        <View style={styles.row}>
          <Text style={styles.label}>Barometric Pressure</Text>
          <View style={styles.toggleRow}>
            {(['hPa', 'inHg'] as const).map((unit) => (
              <Pressable
                key={unit}
                style={[styles.toggleButton, settings.pressureUnit === unit && styles.toggleActive]}
                onPress={() => { settings.setPressureUnit(unit); void updateProfile({ pressure_unit: unit }); }}
              >
                <Text style={[styles.toggleText, settings.pressureUnit === unit && styles.toggleTextActive]}>{unit}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* Look — structure. Independent of palette, which is colour. */}
      <Text style={styles.sectionTitle}>{'LOOK'}</Text>
      <View style={styles.segment}>
        {LOOK_OPTIONS.map((opt) => {
          const active = lookName === opt.name;
          return (
            <Pressable
              key={opt.name}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.segmentBtn, active && styles.segmentBtnActive]}
              onPress={() => setLook(opt.name)}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.segmentHint}>
        {lookName === 'classic'
          ? 'The original WeatherBeacon layout and colours.'
          : 'Larger type, rounder surfaces, and the dark palettes.'}
      </Text>

      {/* Palette — colour. The list changes with the look. */}
      <Text style={styles.sectionTitle}>{'PALETTE'}</Text>
      <View style={styles.card}>
        {paletteOptions.map((opt) => (
          <Pressable key={opt.name} style={styles.themeRow} onPress={() => setPalette(opt.name)}>
            <Text style={styles.label}>{opt.label}</Text>
            <Text style={styles.radio}>{palette === opt.name ? '●' : '○'}</Text>
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
            onValueChange={handleNotificationToggle}
            disabled={pushRegistering}
            trackColor={{ false: tokens.border, true: tokens.primaryLight }}
            thumbColor={settings.notificationsEnabled ? tokens.primary : tokens.textTertiary}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Refresh Push Token</Text>
        <Text style={styles.devHint}>
          Tap this if alerts or forecast digest notifications aren't arriving. Re-registers your
          device for push notifications.
        </Text>
        <Pressable
          style={[styles.pushRegisterButton, { borderColor: tokens.primary }]}
          onPress={handleRegisterPush}
          disabled={pushRegistering}
        >
          <Text style={[styles.pushRegisterText, { color: tokens.primary }]}>
            {pushRegistering ? 'Registering…' : 'Refresh Push Token'}
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

      {/* Forecast Digest */}
      <Text style={styles.sectionTitle}>{'FORECAST DIGEST'}</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.label}>Daily or weekly forecast summary</Text>
            <Text style={[styles.devHint, { marginTop: 2, marginBottom: 0 }]}>
              {Platform.select({ android: 'Keeps alerts working reliably and gives you a weather heads-up even on quiet days.', default: 'Gives you a daily weather heads-up even when no alert conditions are met.' })}
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
              <View style={[styles.row, { marginTop: look.spacing.sm, flexWrap: 'wrap' as const, gap: look.spacing.xs }]}>
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
            <View style={[styles.row, { marginTop: look.spacing.sm }]}>
              <Text style={styles.label}>Send at</Text>
              <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: look.spacing.md }}>
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
                  style={[styles.row, { paddingVertical: look.spacing.md }]}
                  onPress={() => handleDigestUpdate({ digest_location_id: loc.id })}
                  disabled={digestSaving}
                >
                  <Text style={styles.label}>{loc.name}</Text>
                  <Text style={{ fontSize: look.typography.heading.size, color: tokens.primary }}>
                    {digestLocationId === loc.id ? '●' : '○'}
                  </Text>
                </Pressable>
              ))
            )}

            {digestSaving && (
              <ActivityIndicator size="small" color={tokens.primary} style={{ marginTop: look.spacing.sm }} />
            )}
          </>
        )}
      </View>

      {/* History */}
      <Text style={styles.sectionTitle}>{'HISTORY'}</Text>
      <View style={styles.card}>
        <Pressable style={styles.row} onPress={() => router.push('/history')}>
          <Text style={styles.label}>Alert History</Text>
          <Text style={{ fontSize: look.typography.heading.size, color: tokens.textTertiary }}>{'›'}</Text>
        </Pressable>
      </View>

      {/* Help */}
      <Text style={styles.sectionTitle}>{'HELP'}</Text>
      <View style={styles.card}>
        <Pressable style={styles.row} onPress={showWalkthrough}>
          <Text style={styles.label}>Watch Tutorial</Text>
          <Text style={{ fontSize: look.typography.heading.size, color: tokens.textTertiary }}>{'›'}</Text>
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
        <Text style={styles.versionText}>{`WeatherBeacon v${APP_VERSION}`}</Text>
        <Text style={styles.versionSubtext}>by Truth Centered Tech</Text>
      </View>

      <WalkthroughModal visible={walkthroughVisible} onDismiss={dismissWalkthrough} />
    </ScrollView>
  );
}

const createStyles = (t: ThemeTokens, look: LookTokens) => ({
  container: { flex: 1 as const, backgroundColor: t.background },
  content: { padding: look.spacing.xl, paddingBottom: look.spacing.xxxl, maxWidth: 600, alignSelf: 'center' as const, width: '100%' as const },
  sectionTitle: {
    fontSize: look.typography.label.size,
    fontWeight: look.typography.bodyStrong.weight,
    color: t.textTertiary,
    letterSpacing: look.typography.label.tracking,
    marginTop: 20,
    marginBottom: 8,
  },
  card: {
    backgroundColor: t.card,
    borderRadius: look.radius.surface,
    padding: look.spacing.lg,
    borderWidth: 1,
    borderColor: t.borderLight,
  },
  row: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: look.spacing.sm,
  },
  label: { fontSize: look.typography.body.size, color: t.textPrimary },
  value: { fontSize: look.typography.body.size, color: t.textSecondary, marginBottom: 12 },
  valueBold: { fontSize: look.typography.body.size, fontWeight: look.typography.bodyStrong.weight, color: t.textPrimary, marginBottom: 4 },
  limitsLine: { fontSize: look.typography.label.size, color: t.textTertiary },

  // Look control — a segmented switch, distinct from the Palette radio list
  // because look and palette are different axes and should not look alike.
  segment: {
    flexDirection: 'row' as const,
    backgroundColor: t.inputBackground,
    borderRadius: look.radius.surface,
    padding: look.spacing.xs,
    gap: look.spacing.xs,
  },
  segmentBtn: {
    flex: 1 as const,
    paddingVertical: look.spacing.md,
    borderRadius: look.radius.surface,
    alignItems: 'center' as const,
  },
  segmentBtnActive: { backgroundColor: t.primary },
  segmentText: {
    fontSize: look.typography.caption.size,
    fontWeight: look.typography.bodyStrong.weight,
    letterSpacing: look.typography.label.tracking,
    color: t.textSecondary,
  },
  segmentTextActive: { color: t.textOnPrimary },
  segmentHint: {
    fontSize: look.typography.label.size,
    color: t.textTertiary,
    marginTop: look.spacing.sm,
    lineHeight: look.typography.label.lineHeight,
  },
  themeRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: look.spacing.md,
  },
  radio: {
    fontSize: look.typography.heading.size,
    color: t.primary,
  },

  // Upgrade CTA
  upgradeButton: {
    backgroundColor: t.primary,
    borderRadius: look.radius.surface,
    padding: look.spacing.lg,
    marginTop: 12,
    alignItems: 'center' as const,
  },
  upgradeButtonText: { color: t.textOnPrimary, fontSize: look.typography.heading.size, fontWeight: look.typography.bodyStrong.weight },
  upgradeButtonSubtext: { color: t.textOnPrimary, fontSize: look.typography.label.size, marginTop: 4, opacity: 0.85 },

  // Dev override
  devCard: {
    borderColor: t.warning,
    borderWidth: 2,
  },
  devBadge: {
    alignSelf: 'flex-start' as const,
    backgroundColor: t.warning,
    color: '#000000',
    fontSize: look.typography.label.size,
    fontWeight: look.typography.bodyStrong.weight,
    paddingHorizontal: look.spacing.sm,
    paddingVertical: look.spacing.xs,
    borderRadius: look.radius.surface,
    marginBottom: 8,
  },
  devHint: {
    fontSize: look.typography.label.size,
    color: t.textSecondary,
    marginTop: 4,
    marginBottom: 12,
    lineHeight: look.typography.label.lineHeight,
  },
  tierRow: { flexDirection: 'row' as const, gap: look.spacing.sm },
  tierButton: {
    flex: 1 as const,
    paddingVertical: look.spacing.md,
    borderRadius: look.radius.surface,
    borderWidth: 1,
    borderColor: t.border,
    alignItems: 'center' as const,
    backgroundColor: t.inputBackground,
  },
  tierButtonActive: {
    backgroundColor: t.primary,
    borderColor: t.primary,
  },
  tierButtonText: { fontSize: look.typography.body.size, fontWeight: look.typography.bodyStrong.weight, color: t.textSecondary },
  tierButtonTextActive: { color: t.textOnPrimary },

  // Push register button + result
  pushRegisterButton: {
    marginTop: 12,
    paddingVertical: look.spacing.md,
    borderRadius: look.radius.surface,
    borderWidth: 1,
    alignItems: 'center' as const,
  },
  pushRegisterText: { fontSize: look.typography.body.size, fontWeight: look.typography.bodyStrong.weight },
  pushResult: {
    marginTop: 8,
    fontSize: look.typography.label.size,
    lineHeight: look.typography.caption.lineHeight,
  },

  // Toggles
  toggleRow: { flexDirection: 'row' as const, gap: look.spacing.xs },
  toggleButton: {
    paddingVertical: look.spacing.sm,
    paddingHorizontal: look.spacing.lg,
    borderRadius: look.radius.surface,
    backgroundColor: t.inputBackground,
    borderWidth: 1,
    borderColor: t.borderLight,
  },
  toggleActive: {
    backgroundColor: t.primary,
    borderColor: t.primary,
  },
  toggleText: { fontSize: look.typography.body.size, color: t.textSecondary, fontWeight: look.typography.bodyStrong.weight },
  toggleTextActive: { color: t.textOnPrimary },

  // Destructive
  deleteButton: {
    marginTop: 24,
    paddingVertical: look.spacing.lg,
    alignItems: 'center' as const,
    borderRadius: look.radius.surface,
    backgroundColor: t.error,
  },
  deleteButtonText: { color: '#ffffff', fontSize: look.typography.heading.size, fontWeight: look.typography.bodyStrong.weight },
  signOutButton: {
    marginTop: 12,
    paddingVertical: look.spacing.lg,
    alignItems: 'center' as const,
    borderRadius: look.radius.surface,
    borderWidth: 1,
    borderColor: t.error,
  },
  signOutText: { color: t.error, fontSize: look.typography.heading.size, fontWeight: look.typography.bodyStrong.weight },

  // Digest hour picker
  hourButton: {
    paddingHorizontal: look.spacing.md,
    paddingVertical: look.spacing.sm,
    borderRadius: look.radius.surface,
    backgroundColor: t.inputBackground,
    borderWidth: 1,
    borderColor: t.borderLight,
  },
  hourButtonText: {
    fontSize: look.typography.heading.size,
    fontWeight: look.typography.bodyStrong.weight,
    lineHeight: look.typography.heading.lineHeight,
  },

  // Version
  versionContainer: { marginTop: 24, alignItems: 'center' as const, paddingVertical: look.spacing.sm },
  versionText: { fontSize: look.typography.caption.size, color: t.textTertiary, fontWeight: look.typography.bodyStrong.weight },
  versionSubtext: { fontSize: look.typography.label.size, color: t.textTertiary, marginTop: 2 },
});
