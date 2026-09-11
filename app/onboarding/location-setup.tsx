import { View, Text, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useStyles, useTokens } from '../../src/theme';
import { useDeviceLocation } from '../../src/hooks/useLocation';
import { useLocationsStore } from '../../src/stores/locationsStore';
import { LocationSearchInput } from '../../src/components/LocationSearchInput';

export default function LocationSetupScreen() {
  const router = useRouter();
  const t = useTokens();
  const { getLocation, loading: locLoading, error: locError } = useDeviceLocation();
  const addLocation = useLocationsStore((s) => s.addLocation);
  const [locationName, setLocationName] = useState('');
  const [latStr, setLatStr] = useState('');
  const [lonStr, setLonStr] = useState('');
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const styles = useStyles((c, look) => ({
    container: {
      flex: 1,
      justifyContent: 'space-between',
      padding: look.spacing.xl,
      paddingTop: look.spacing.xxxl + look.spacing.md,
      paddingBottom: look.spacing.xxxl,
      backgroundColor: c.background,
    },
    content: {
      alignItems: 'center',
      maxWidth: 480,
      alignSelf: 'center',
      width: '100%',
    },
    icon: {
      fontSize: look.typography.display.size,
      marginBottom: 16,
    },
    title: {
      fontSize: look.typography.title.size,
      fontWeight: look.typography.title.weight,
      marginBottom: 8,
      textAlign: 'center',
      color: c.textPrimary,
    },
    subtitle: {
      fontSize: look.typography.body.size,
      textAlign: 'center',
      lineHeight: look.typography.body.lineHeight,
      marginBottom: 32,
      color: c.textSecondary,
    },
    input: {
      width: '100%',
      borderWidth: 1,
      borderRadius: look.radius.surface,
      paddingVertical: look.spacing.lg,
      paddingHorizontal: look.spacing.lg,
      fontSize: look.typography.heading.size,
      marginBottom: 16,
      backgroundColor: c.inputBackground,
      borderColor: c.border,
      color: c.textPrimary,
    },
    locationButton: {
      width: '100%',
      // Tie between md(12)/lg(16) for literal 14 — no exact guide entry;
      // md chosen for consistency with the same tie elsewhere in this migration.
      paddingVertical: look.spacing.md,
      borderRadius: look.radius.surface,
      borderWidth: 1,
      alignItems: 'center',
      marginBottom: 8,
    },
    locationButtonText: {
      fontSize: look.typography.bodyStrong.size,
      fontWeight: look.typography.bodyStrong.weight,
    },
    errorText: {
      fontSize: look.typography.caption.size,
      marginTop: 4,
      marginBottom: 8,
      color: c.error,
    },
    orText: {
      fontSize: look.typography.caption.size,
      marginTop: 12,
      marginBottom: 12,
      color: c.textTertiary,
    },
    coordRow: {
      flexDirection: 'row',
      gap: look.spacing.md,
      width: '100%',
    },
    coordInput: {
      flex: 1,
      borderWidth: 1,
      borderRadius: look.radius.surface,
      // Tie between md(12)/lg(16) for literal 14 — no exact guide entry;
      // md chosen for consistency with the same tie elsewhere in this migration.
      paddingVertical: look.spacing.md,
      paddingHorizontal: look.spacing.md,
      fontSize: look.typography.bodyStrong.size,
      backgroundColor: c.inputBackground,
      borderColor: c.border,
      color: c.textPrimary,
    },
    buttons: {
      gap: look.spacing.md,
      maxWidth: 480,
      alignSelf: 'center',
      width: '100%',
    },
    nextButton: {
      paddingVertical: look.spacing.lg,
      borderRadius: look.radius.surface,
      alignItems: 'center',
      backgroundColor: c.primary,
    },
    nextButtonText: {
      fontSize: look.typography.heading.size,
      fontWeight: look.typography.heading.weight,
      color: c.textOnPrimary,
    },
  }));

  const parsedLat = parseFloat(latStr);
  const parsedLon = parseFloat(lonStr);
  const hasValidCoords = !isNaN(parsedLat) && !isNaN(parsedLon);

  const handleUseCurrentLocation = async () => {
    const result = await getLocation();
    if (result) {
      setGpsCoords(result);
      setLatStr(result.latitude.toFixed(6));
      setLonStr(result.longitude.toFixed(6));
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
      if (!locationName) setLocationName('My Location');
    }
  };

  const handleNext = async () => {
    if (hasValidCoords && locationName.trim()) {
      setSaving(true);
      const ok = await addLocation(locationName.trim(), parsedLat, parsedLon, timezone);
      setSaving(false);
      // BUG-002: Surface save failure so the user is not left in a dead-end.
      if (!ok) {
        Alert.alert(
          'Could not save location',
          useLocationsStore.getState().error ?? 'Please try again.',
        );
        return;
      }
    }
    router.push('/onboarding/notification-setup');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>📍</Text>
        <Text style={styles.title}>Add Your First Location</Text>
        <Text style={styles.subtitle}>
          Give it a name (e.g., "Home", "North Pasture", "Job Site") and we'll
          find its coordinates.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Location name"
          placeholderTextColor={t.textTertiary}
          value={locationName}
          onChangeText={setLocationName}
        />

        {/* Address/place search — FR-ONBOARD-005 / FR-LOC-002 */}
        <LocationSearchInput
          onSelect={(result) => {
            setLocationName(result.name);
            setLatStr(result.latitude.toFixed(6));
            setLonStr(result.longitude.toFixed(6));
            setGpsCoords({ latitude: result.latitude, longitude: result.longitude });
            setTimezone(result.timezone ?? null);
          }}
          placeholder="Search place or address"
        />

        <Pressable
          style={[
            styles.locationButton,
            { borderColor: gpsCoords ? t.success : t.primary },
            gpsCoords && { backgroundColor: t.primaryLight },
          ]}
          onPress={handleUseCurrentLocation}
          disabled={locLoading}
        >
          {locLoading ? (
            <ActivityIndicator color={t.primary} />
          ) : (
            <Text style={[styles.locationButtonText, { color: gpsCoords ? t.success : t.primary }]}>
              {gpsCoords
                ? `Location set (${gpsCoords.latitude.toFixed(4)}, ${gpsCoords.longitude.toFixed(4)})`
                : 'Continue'}
            </Text>
          )}
        </Pressable>

        {locError && (
          <Text style={styles.errorText}>{locError}</Text>
        )}

        <Text style={styles.orText}>
          — or enter coordinates manually —
        </Text>

        <View style={styles.coordRow}>
          <TextInput
            style={styles.coordInput}
            placeholder="Latitude"
            placeholderTextColor={t.textTertiary}
            keyboardType="numeric"
            value={latStr}
            onChangeText={setLatStr}
          />
          <TextInput
            style={styles.coordInput}
            placeholder="Longitude"
            placeholderTextColor={t.textTertiary}
            keyboardType="numeric"
            value={lonStr}
            onChangeText={setLonStr}
          />
        </View>
      </View>

      <View style={styles.buttons}>
        <Pressable
          style={styles.nextButton}
          onPress={handleNext}
          disabled={saving}
        >
          <Text style={styles.nextButtonText}>
            {saving ? 'Saving...' : 'Next'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
