import { View, Text, Pressable, StyleSheet, TextInput, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTokens } from '../../src/theme';
import { useDeviceLocation } from '../../src/hooks/useLocation';
import { useLocationsStore } from '../../src/stores/locationsStore';
import { LocationSearchInput } from '../../src/components/LocationSearchInput';

export default function LocationSetupScreen() {
  const router = useRouter();
  const t = useTokens();
  const { getLocation, loading: locLoading, error: locError } = useDeviceLocation();
  const addLocation = useLocationsStore((s) => s.addLocation);
  const [locationName, setLocationName] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleUseCurrentLocation = async () => {
    const result = await getLocation();
    if (result) {
      setCoords(result);
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
      if (!locationName) setLocationName('My Location');
    }
  };

  const handleNext = async () => {
    if (coords && locationName) {
      setSaving(true);
      const ok = await addLocation(locationName.trim(), coords.latitude, coords.longitude, timezone);
      setSaving(false);
      // FIX 7: Don't advance if the Supabase insert failed. The store already
      // set its `error` field — the error display in the UI will surface it.
      // Without this guard the user advances through onboarding with no
      // location saved and hits the app in a broken state.
      if (!ok) return;
    }
    router.push('/onboarding/notification-setup');
  };

  const hasLocation = coords !== null && locationName.trim().length > 0;

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <View style={styles.content}>
        <Text style={styles.icon}>📍</Text>
        <Text style={[styles.title, { color: t.textPrimary }]}>Add Your First Location</Text>
        <Text style={[styles.subtitle, { color: t.textSecondary }]}>
          Give it a name (e.g., "Home", "North Pasture", "Job Site") and we'll
          find its coordinates.
        </Text>

        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: t.inputBackground,
              borderColor: t.border,
              color: t.textPrimary,
            },
          ]}
          placeholder="Location name"
          placeholderTextColor={t.textTertiary}
          value={locationName}
          onChangeText={setLocationName}
        />

        {/* Address/place search — FR-ONBOARD-005 / FR-LOC-002 */}
        <LocationSearchInput
          onSelect={(result) => {
            setLocationName(result.name);
            setCoords({ latitude: result.latitude, longitude: result.longitude });
            setTimezone(result.timezone ?? null);
          }}
          placeholder="Search place or address"
        />

        <Pressable
          style={[
            styles.locationButton,
            { borderColor: coords ? t.success : t.primary },
            coords && { backgroundColor: t.primaryLight },
          ]}
          onPress={handleUseCurrentLocation}
          disabled={locLoading}
        >
          {locLoading ? (
            <ActivityIndicator color={t.primary} />
          ) : (
            <Text style={[styles.locationButtonText, { color: coords ? t.success : t.primary }]}>
              {coords
                ? `Location set (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`
                : 'Use My Current Location'}
            </Text>
          )}
        </Pressable>

        {locError && (
          <Text style={[styles.errorText, { color: t.error }]}>{locError}</Text>
        )}

        <Text style={[styles.orText, { color: t.textTertiary }]}>
          — or enter coordinates manually —
        </Text>

        <View style={styles.coordRow}>
          <TextInput
            style={[
              styles.coordInput,
              { backgroundColor: t.inputBackground, borderColor: t.border, color: t.textPrimary },
            ]}
            placeholder="Latitude"
            placeholderTextColor={t.textTertiary}
            keyboardType="numeric"
            value={coords?.latitude.toString() ?? ''}
            onChangeText={(val) => {
              const lat = parseFloat(val);
              if (!isNaN(lat)) setCoords((c) => ({ latitude: lat, longitude: c?.longitude ?? 0 }));
            }}
          />
          <TextInput
            style={[
              styles.coordInput,
              { backgroundColor: t.inputBackground, borderColor: t.border, color: t.textPrimary },
            ]}
            placeholder="Longitude"
            placeholderTextColor={t.textTertiary}
            keyboardType="numeric"
            value={coords?.longitude.toString() ?? ''}
            onChangeText={(val) => {
              const lon = parseFloat(val);
              if (!isNaN(lon)) setCoords((c) => ({ latitude: c?.latitude ?? 0, longitude: lon }));
            }}
          />
        </View>
      </View>

      <View style={styles.buttons}>
        <Pressable
          style={styles.skipButton}
          onPress={() => router.push('/onboarding/notification-setup')}
        >
          <Text style={[styles.skipText, { color: t.textTertiary }]}>Skip for now</Text>
        </Pressable>

        <Pressable
          style={[
            styles.nextButton,
            { backgroundColor: hasLocation ? t.primary : t.primaryDisabled },
          ]}
          onPress={handleNext}
          disabled={!hasLocation || saving}
        >
          <Text style={[styles.nextButtonText, { color: t.textOnPrimary }]}>
            {saving ? 'Saving...' : 'Next'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
    paddingTop: 60,
    paddingBottom: 48,
  },
  content: {
    alignItems: 'center',
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  locationButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 8,
  },
  locationButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 8,
  },
  orText: {
    fontSize: 13,
    marginTop: 12,
    marginBottom: 12,
  },
  coordRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  coordInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  buttons: {
    gap: 12,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 15,
  },
  nextButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
});
