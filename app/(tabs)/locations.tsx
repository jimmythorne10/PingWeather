import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, Switch, RefreshControl } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useStyles, useTokens } from '../../src/theme';
import { useLocationsStore } from '../../src/stores/locationsStore';
import { useAuthStore } from '../../src/stores/authStore';
import { useDeviceLocation } from '../../src/hooks/useLocation';
import { LocationSearchInput } from '../../src/components/LocationSearchInput';
import { TIER_LIMITS } from '../../src/types';
import type { ThemeTokens } from '../../src/theme';
import type { WatchLocation } from '../../src/types';

export default function LocationsScreen() {
  const styles = useStyles(createStyles);
  const tokens = useTokens();
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const { locations, loading, error: storeError, loadLocations, addLocation, updateLocation, removeLocation, toggleLocation, clearError } =
    useLocationsStore();
  const { getLocation, loading: geoLoading, error: geoError } = useDeviceLocation();

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isEditing = editingId !== null;

  const tier = profile?.subscription_tier ?? 'free';
  const limits = TIER_LIMITS[tier];
  const atLimit = locations.length >= limits.maxLocations;

  // Count locations that are inactive (over-tier)
  const inactiveLocations = locations.filter((l) => !l.is_active);

  useEffect(() => {
    loadLocations();
  }, []);

  const handleUseDeviceLocation = async () => {
    const result = await getLocation();
    if (result) {
      setLat(result.latitude.toString());
      setLon(result.longitude.toString());
    }
  };

  const resetForm = () => {
    setShowAdd(false);
    setEditingId(null);
    setName('');
    setLat('');
    setLon('');
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLocations();
    setRefreshing(false);
  };

  const handleSave = async () => {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    if (!name.trim() || isNaN(latitude) || isNaN(longitude)) return;

    setSaving(true);
    let success = false;
    if (editingId) {
      success = await updateLocation(editingId, { name: name.trim(), latitude, longitude });
    } else {
      success = await addLocation(name.trim(), latitude, longitude);
    }
    setSaving(false);
    if (success) {
      resetForm();
    }
    // On failure, leave the form open so the user can see the error and retry
  };

  const handleEdit = (loc: WatchLocation) => {
    setEditingId(loc.id);
    setName(loc.name);
    setLat(loc.latitude.toString());
    setLon(loc.longitude.toString());
    setShowAdd(true);
  };

  const handleDelete = (loc: WatchLocation) => {
    Alert.alert(
      'Remove Location',
      `Remove "${loc.name}"? Alert rules for this location will also be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeLocation(loc.id) },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Locations</Text>
          <Text style={styles.subtitle}>
            {locations.length}/{limits.maxLocations} locations ({tier} tier)
          </Text>
        </View>
        {(!atLimit || isEditing) && (
          <Pressable
            style={styles.addHeaderButton}
            onPress={() => (showAdd ? resetForm() : setShowAdd(true))}
          >
            <Text style={styles.addHeaderButtonText}>{showAdd ? 'Cancel' : '+ Add'}</Text>
          </Pressable>
        )}
      </View>

      {/* Inactive banner — FR-LOC-005 */}
      {inactiveLocations.length > 0 && (
        <View style={styles.inactiveBanner}>
          <Text style={styles.inactiveBannerText}>
            You have {inactiveLocations.length} inactive location{inactiveLocations.length > 1 ? 's' : ''}. Upgrade to reactivate them.
          </Text>
        </View>
      )}

      {/* Add/Edit location form */}
      {showAdd && (
        <View style={styles.addCard}>
          <Text style={styles.formTitle}>
            {isEditing ? 'Edit Location' : 'Add Location'}
          </Text>
          {storeError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{storeError}</Text>
              <Pressable onPress={clearError} hitSlop={8} accessibilityLabel="Dismiss error">
                <Text style={styles.errorBannerDismiss}>✕</Text>
              </Pressable>
            </View>
          )}
          <TextInput
            style={styles.input}
            placeholder="Location name (e.g., North Pasture)"
            placeholderTextColor={tokens.textTertiary}
            value={name}
            onChangeText={setName}
          />

          <LocationSearchInput
            onSelect={(result) => {
              setName(result.name);
              setLat(result.latitude.toString());
              setLon(result.longitude.toString());
            }}
            placeholder="Search place or address"
          />

          <Pressable style={styles.geoButton} onPress={handleUseDeviceLocation} disabled={geoLoading}>
            {geoLoading ? (
              <ActivityIndicator size="small" color={tokens.primary} />
            ) : (
              <Text style={styles.geoButtonText}>Use My Current Location</Text>
            )}
          </Pressable>
          {geoError && <Text style={styles.errorText}>{geoError}</Text>}
          <View style={styles.coordRow}>
            <TextInput
              style={[styles.input, styles.coordInput]}
              placeholder="Latitude"
              placeholderTextColor={tokens.textTertiary}
              keyboardType="numeric"
              value={lat}
              onChangeText={setLat}
            />
            <TextInput
              style={[styles.input, styles.coordInput]}
              placeholder="Longitude"
              placeholderTextColor={tokens.textTertiary}
              keyboardType="numeric"
              value={lon}
              onChangeText={setLon}
            />
          </View>
          <Pressable
            style={[
              styles.saveButton,
              (!name.trim() || !lat || !lon) && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={!name.trim() || !lat || !lon || saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Save Location'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Store error banner — shown when form is closed */}
      {!showAdd && storeError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{storeError}</Text>
          <Pressable onPress={clearError} hitSlop={8} accessibilityLabel="Dismiss error">
            <Text style={styles.errorBannerDismiss}>✕</Text>
          </Pressable>
        </View>
      )}

      {/* Location list */}
      {loading && locations.length === 0 ? (
        <ActivityIndicator size="large" color={tokens.primary} style={{ marginTop: 40 }} />
      ) : locations.length === 0 && !showAdd ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>📍</Text>
          <Text style={styles.emptyTitle}>No locations yet</Text>
          <Text style={styles.emptyBody}>
            Add your first location to start receiving weather alerts.
          </Text>
          <Pressable style={styles.emptyButton} onPress={() => setShowAdd(true)}>
            <Text style={styles.emptyButtonText}>+ Add Location</Text>
          </Pressable>
        </View>
      ) : (
        locations.map((loc, index) => (
          <Pressable
            key={loc.id}
            style={styles.locationCard}
            onPress={() => handleEdit(loc)}
          >
            <View style={styles.locationHeader}>
              <View style={styles.locationTitleRow}>
                <Pressable
                  accessibilityLabel="Default location"
                  style={styles.starButton}
                  onPress={(e) => e.stopPropagation?.()}
                >
                  <Text style={styles.starIcon}>{(loc as WatchLocation).is_default || (index === 0 && !locations.some((l) => (l as WatchLocation).is_default)) ? '⭐' : '☆'}</Text>
                </Pressable>
                <Text style={styles.locationName}>{loc.name}</Text>
              </View>
              <Switch
                value={loc.is_active}
                onValueChange={(val) => toggleLocation(loc.id, val)}
                trackColor={{ false: tokens.border, true: tokens.primaryLight }}
                thumbColor={loc.is_active ? tokens.primary : tokens.textTertiary}
              />
            </View>
            <Text style={styles.locationCoords}>
              {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
            </Text>
            <View style={styles.cardActions}>
              <Text style={styles.editHint}>Tap to edit</Text>
              <Pressable
                accessibilityLabel="Delete location"
                onPress={(e) => {
                  e.stopPropagation?.();
                  handleDelete(loc);
                }}
                style={styles.trashButton}
                hitSlop={8}
              >
                <Text style={styles.trashIcon}>🗑️</Text>
              </Pressable>
            </View>
          </Pressable>
        ))
      )}

      {atLimit && !showAdd && tier !== 'premium' && (
        <Pressable style={styles.limitCard} onPress={() => router.push('/upgrade')}>
          <Text style={styles.limitText}>
            You've reached the {tier} tier limit of {limits.maxLocations} location
            {limits.maxLocations > 1 ? 's' : ''}.
          </Text>
          <Text style={styles.limitLink}>Upgrade to add more →</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const createStyles = (t: ThemeTokens) => ({
  container: { flex: 1 as const, backgroundColor: t.background },
  content: { padding: 20, paddingBottom: 40 },
  headerRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: '700' as const, color: t.textPrimary },
  subtitle: { fontSize: 13, color: t.textTertiary, marginTop: 2 },
  addHeaderButton: {
    backgroundColor: t.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  addHeaderButtonText: { color: t.textOnPrimary, fontWeight: '600' as const, fontSize: 14 },

  // Inactive banner
  inactiveBanner: {
    backgroundColor: t.warningLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  inactiveBannerText: { fontSize: 14, color: t.textSecondary, textAlign: 'center' as const },

  // Error banner
  errorBanner: {
    backgroundColor: t.errorLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  errorBannerText: { fontSize: 14, color: t.error, flex: 1, marginRight: 8 },
  errorBannerDismiss: { fontSize: 16, color: t.error, fontWeight: '700' as const },

  // Add form
  addCard: {
    backgroundColor: t.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: t.borderLight,
  },
  input: {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: t.textPrimary,
    backgroundColor: t.inputBackground,
    marginBottom: 10,
  },
  geoButton: {
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: t.primary,
    alignItems: 'center' as const,
    marginBottom: 10,
  },
  geoButtonText: { color: t.primary, fontWeight: '600' as const, fontSize: 14 },
  errorText: { color: t.error, fontSize: 13, marginBottom: 8 },
  coordRow: { flexDirection: 'row' as const, gap: 10 },
  coordInput: { flex: 1 as const },
  saveButton: {
    backgroundColor: t.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center' as const,
    marginTop: 4,
  },
  saveButtonDisabled: { backgroundColor: t.primaryDisabled },
  saveButtonText: { color: t.textOnPrimary, fontWeight: '600' as const, fontSize: 16 },

  // Empty state
  emptyCard: {
    backgroundColor: t.card,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: t.borderLight,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: t.textPrimary, marginBottom: 8 },
  emptyBody: { fontSize: 14, color: t.textSecondary, textAlign: 'center' as const, marginBottom: 20, lineHeight: 20 },
  emptyButton: { backgroundColor: t.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  emptyButtonText: { color: t.textOnPrimary, fontSize: 16, fontWeight: '600' as const },

  // Location card
  locationCard: {
    backgroundColor: t.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: t.borderLight,
  },
  locationHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  locationTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  starButton: { padding: 2 },
  starIcon: { fontSize: 18 },
  locationName: { fontSize: 17, fontWeight: '600' as const, color: t.textPrimary },
  locationCoords: { fontSize: 13, color: t.textTertiary, marginTop: 4, marginBottom: 8 },
  cardActions: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginTop: 4,
  },
  editHint: { fontSize: 12, color: t.textTertiary, fontStyle: 'italic' as const },
  trashButton: { padding: 4 },
  trashIcon: { fontSize: 18 },
  formTitle: { fontSize: 16, fontWeight: '600' as const, color: t.textPrimary, marginBottom: 10 },

  // Limit warning
  limitCard: {
    backgroundColor: t.warningLight,
    borderRadius: 8,
    padding: 14,
    marginTop: 12,
  },
  limitText: { fontSize: 14, color: t.textSecondary, textAlign: 'center' as const },
  limitLink: { fontSize: 14, color: t.primary, fontWeight: '600' as const, textAlign: 'center' as const, marginTop: 4 },
});
