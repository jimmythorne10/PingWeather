import { View, Text, ScrollView, Pressable, Switch, Alert, Modal, RefreshControl } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useStyles, useTokens } from '../../src/theme';
import { useAlertRulesStore } from '../../src/stores/alertRulesStore';
import { useLocationsStore } from '../../src/stores/locationsStore';
import { useAuthStore } from '../../src/stores/authStore';
import { ALERT_PRESETS } from '../../src/data/alert-presets';
import { TIER_LIMITS } from '../../src/types';
import { pickDefaultLocation, filterRules, findLocationName, type AlertsTabFilter } from '../../src/utils/alertsHelpers';
import type { ThemeTokens } from '../../src/theme';
import type { AlertPreset, AlertRule } from '../../src/types';

const PRESET_CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'temperature', label: 'Temperature' },
  { value: 'precipitation', label: 'Precipitation' },
  { value: 'wind', label: 'Wind' },
  { value: 'work', label: 'Work & Safety' },
];

export default function AlertsScreen() {
  const styles = useStyles(createStyles);
  const tokens = useTokens();
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const { rules, loading, loadRules, deleteRule, toggleRule } = useAlertRulesStore();
  const { locations, loadLocations } = useLocationsStore();
  const addRule = useAlertRulesStore((s) => s.createRule);

  const tier = profile?.subscription_tier ?? 'free';
  const limits = TIER_LIMITS[tier];
  const atLimit = rules.length >= limits.maxAlertRules;

  const [filterTab, setFilterTab] = useState<AlertsTabFilter>('All');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [locationFilter, setLocationFilter] = useState<string | 'all'>('all');
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [presetConfirmState, setPresetConfirmState] = useState<{
    preset: AlertPreset;
    locationId: string;
  } | null>(null);

  useEffect(() => {
    loadRules();
    loadLocations();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadRules(), loadLocations()]);
    } finally {
      setRefreshing(false);
    }
  };

  const filteredRules = filterRules(rules, filterTab, locationFilter);

  const filteredPresets = selectedCategory === 'all'
    ? ALERT_PRESETS
    : ALERT_PRESETS.filter((p) => p.category === selectedCategory);

  const handlePresetTap = (preset: AlertPreset) => {
    if (atLimit) {
      Alert.alert('Limit Reached', `${tier} tier allows ${limits.maxAlertRules} alert rules. Upgrade for more.`);
      return;
    }
    if (locations.length === 0) {
      Alert.alert('No Locations', 'Add a location first before creating an alert rule.', [
        { text: 'Add Location', onPress: () => router.push('/(tabs)/locations') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }

    const defaultLoc = pickDefaultLocation(locations);
    if (!defaultLoc) {
      Alert.alert('No Active Locations', 'All locations are inactive. Activate one first.');
      return;
    }

    setPresetConfirmState({ preset, locationId: defaultLoc.id });
  };

  const handlePresetCreate = async () => {
    if (!presetConfirmState) return;

    const { preset, locationId } = presetConfirmState;
    const pollingHours = Math.max(preset.polling_interval_hours, limits.minPollingIntervalHours);

    await addRule({
      location_id: locationId,
      name: preset.name,
      conditions: preset.conditions,
      logical_operator: preset.logical_operator,
      lookahead_hours: preset.lookahead_hours,
      polling_interval_hours: pollingHours,
      cooldown_hours: preset.cooldown_hours,
    });

    setPresetConfirmState(null);
  };

  const handleDeleteRule = (rule: AlertRule) => {
    Alert.alert(
      'Delete Alert Rule',
      `Delete "${rule.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteRule(rule.id) },
      ]
    );
  };

  const handleCloneRule = (rule: AlertRule) => {
    router.push(`/create-rule?mode=clone&ruleId=${rule.id}`);
  };

  const operatorLabel = (op: string) => {
    const labels: Record<string, string> = {
      gt: '>', gte: '>=', lt: '<', lte: '<=', eq: '=',
    };
    return labels[op] ?? op;
  };

  const metricLabel = (m: string) => {
    const labels: Record<string, string> = {
      temperature_high: 'High', temperature_low: 'Low', temperature_current: 'Temp',
      precipitation_probability: 'Rain %', wind_speed: 'Wind', humidity: 'Humidity',
      feels_like: 'Feels like', uv_index: 'UV',
    };
    return labels[m] ?? m;
  };

  const selectedCategoryLabel = PRESET_CATEGORIES.find((c) => c.value === selectedCategory)?.label ?? 'All Categories';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >

      {/* Filter toggle — FR-ALERT-001 */}
      <View style={styles.filterRow}>
        {(['All', 'Active', 'Inactive'] as AlertsTabFilter[]).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.filterTab, filterTab === tab && styles.filterTabActive]}
            onPress={() => setFilterTab(tab)}
          >
            <Text style={[styles.filterTabText, filterTab === tab && styles.filterTabTextActive]}>
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Location filter dropdown — show only when multiple locations exist */}
      {locations.length > 1 && (
        <>
          <Pressable
            accessibilityLabel="location filter"
            style={styles.dropdownButton}
            onPress={() => setLocationDropdownOpen(true)}
          >
            <Text style={styles.dropdownButtonText}>
              {locationFilter === 'all'
                ? 'All Locations'
                : findLocationName(locations, locationFilter)}
            </Text>
            <Text style={styles.dropdownChevron}>▼</Text>
          </Pressable>

          <Modal
            visible={locationDropdownOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setLocationDropdownOpen(false)}
          >
            <Pressable style={styles.modalOverlay} onPress={() => setLocationDropdownOpen(false)}>
              <View style={styles.modalContent}>
                <Pressable
                  key="all-locations"
                  style={[styles.modalOption, locationFilter === 'all' && styles.modalOptionSelected]}
                  onPress={() => {
                    setLocationFilter('all');
                    setLocationDropdownOpen(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, locationFilter === 'all' && styles.modalOptionTextSelected]}>
                    All Locations
                  </Text>
                </Pressable>
                {locations.map((loc) => (
                  <Pressable
                    key={loc.id}
                    style={[styles.modalOption, locationFilter === loc.id && styles.modalOptionSelected]}
                    onPress={() => {
                      setLocationFilter(loc.id);
                      setLocationDropdownOpen(false);
                    }}
                  >
                    <Text style={[styles.modalOptionText, locationFilter === loc.id && styles.modalOptionTextSelected]}>
                      {loc.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Pressable>
          </Modal>
        </>
      )}

      {/* Rule count */}
      <Text style={styles.sectionSubtitle}>
        {rules.length}/{limits.maxAlertRules} rules ({tier} tier)
      </Text>

      {/* Active rules */}
      {filteredRules.length > 0 && (
        <>
          {filteredRules.map((rule) => (
            <Pressable
              key={rule.id}
              style={styles.ruleCard}
              onPress={() => router.push(`/create-rule?mode=edit&ruleId=${rule.id}`)}
            >
              <View style={styles.ruleHeader}>
                <Text style={styles.ruleName}>{rule.name}</Text>
                <Switch
                  value={rule.is_active}
                  onValueChange={(val) => toggleRule(rule.id, val)}
                  trackColor={{ false: tokens.border, true: tokens.primaryLight }}
                  thumbColor={rule.is_active ? tokens.primary : tokens.textTertiary}
                />
              </View>
              <Text style={styles.ruleLocation}>
                {findLocationName(locations, rule.location_id)}
              </Text>
              <View style={styles.ruleConditions}>
                {rule.conditions.map((c, i) => (
                  <Text key={i} style={styles.conditionText}>
                    {metricLabel(c.metric)} {operatorLabel(c.operator)} {c.value}
                    {c.unit === 'fahrenheit' ? '°F' : c.unit === 'celsius' ? '°C' : c.unit === 'percent' ? '%' : c.unit === 'mph' ? ' mph' : ''}
                    {i < rule.conditions.length - 1 ? ` ${rule.logical_operator} ` : ''}
                  </Text>
                ))}
              </View>
              <Text style={styles.ruleDetails}>
                Every {rule.polling_interval_hours}h | {rule.lookahead_hours}h lookahead | {rule.cooldown_hours}h cooldown
              </Text>
              {rule.max_notifications > 0 && (
                <Text style={styles.ruleDetails}>
                  Sent {rule.notifications_sent_count} / {rule.max_notifications} this cycle
                </Text>
              )}
              {rule.last_triggered_at && (
                <Text style={styles.ruleTriggered}>
                  Last triggered: {new Date(rule.last_triggered_at).toLocaleDateString()}
                </Text>
              )}
              <View style={styles.ruleActions}>
                <Pressable
                  accessibilityLabel="Clone rule"
                  onPress={() => handleCloneRule(rule)}
                  style={styles.iconButton}
                >
                  <Text style={styles.iconButtonText}>📋</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="Delete rule"
                  onPress={() => handleDeleteRule(rule)}
                  style={styles.iconButton}
                >
                  <Text style={styles.iconButtonText}>🗑️</Text>
                </Pressable>
              </View>
            </Pressable>
          ))}
          <View style={styles.divider} />
        </>
      )}

      {/* Presets section */}
      <Text style={styles.sectionTitle}>Quick Start Presets</Text>
      <Text style={styles.sectionSubtitle}>
        Tap a preset to create an alert rule instantly.
      </Text>

      {/* Preset category dropdown — FR-ALERT-002 */}
      <Pressable
        accessibilityLabel="category picker"
        style={styles.dropdownButton}
        onPress={() => setCategoryDropdownOpen(true)}
      >
        <Text style={styles.dropdownButtonText}>{selectedCategoryLabel}</Text>
        <Text style={styles.dropdownChevron}>▼</Text>
      </Pressable>

      <Modal
        visible={categoryDropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCategoryDropdownOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setCategoryDropdownOpen(false)}>
          <View style={styles.modalContent}>
            {PRESET_CATEGORIES.map((cat) => (
              <Pressable
                key={cat.value}
                style={[styles.modalOption, selectedCategory === cat.value && styles.modalOptionSelected]}
                onPress={() => {
                  setSelectedCategory(cat.value);
                  setCategoryDropdownOpen(false);
                }}
              >
                <Text style={[styles.modalOptionText, selectedCategory === cat.value && styles.modalOptionTextSelected]}>
                  {cat.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Preset confirmation modal with location picker */}
      <Modal
        visible={presetConfirmState !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPresetConfirmState(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setPresetConfirmState(null)}
        >
          <Pressable
            style={styles.presetConfirmModalContent}
            onPress={(e) => e.stopPropagation()}
          >
            {presetConfirmState && (
              <>
                <Text style={styles.presetConfirmTitle}>
                  {presetConfirmState.preset.name}
                </Text>
                <Text style={styles.presetConfirmDescription}>
                  {presetConfirmState.preset.description}
                </Text>

                {locations.filter((l) => l.is_active).length > 1 && (
                  <>
                    <Text style={styles.presetConfirmLocationLabel}>
                      Location
                    </Text>
                    <View style={styles.presetConfirmLocationButtons}>
                      {locations
                        .filter((l) => l.is_active)
                        .map((loc) => (
                          <Pressable
                            key={loc.id}
                            style={[
                              styles.presetConfirmLocationButton,
                              presetConfirmState.locationId === loc.id &&
                                styles.presetConfirmLocationButtonSelected,
                            ]}
                            onPress={() =>
                              setPresetConfirmState({
                                ...presetConfirmState,
                                locationId: loc.id,
                              })
                            }
                          >
                            <Text
                              style={[
                                styles.presetConfirmLocationButtonText,
                                presetConfirmState.locationId === loc.id &&
                                  styles.presetConfirmLocationButtonTextSelected,
                              ]}
                            >
                              {loc.name}
                            </Text>
                          </Pressable>
                        ))}
                    </View>
                  </>
                )}

                <View style={styles.presetConfirmActions}>
                  <Pressable
                    style={styles.presetConfirmCancelButton}
                    onPress={() => setPresetConfirmState(null)}
                  >
                    <Text style={styles.presetConfirmCancelButtonText}>
                      Cancel
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.presetConfirmCreateButton}
                    onPress={handlePresetCreate}
                  >
                    <Text style={styles.presetConfirmCreateButtonText}>
                      Create
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {filteredPresets.map((preset) => (
        <Pressable
          key={preset.id}
          style={[styles.presetCard, atLimit && styles.presetDisabled]}
          onPress={() => handlePresetTap(preset)}
        >
          <Text style={styles.presetIcon}>{preset.icon}</Text>
          <View style={styles.presetInfo}>
            <Text style={styles.presetName}>{preset.name}</Text>
            <Text style={styles.presetDesc}>{preset.description}</Text>
          </View>
        </Pressable>
      ))}

      {/* Custom builder */}
      {!atLimit && (
        <Pressable
          style={[styles.customButton, { borderColor: tokens.primary }]}
          onPress={() => router.push('/create-rule')}
        >
          <Text style={{ color: tokens.primary, fontSize: 16, fontWeight: '600' }}>+ Build Custom Alert Rule</Text>
        </Pressable>
      )}

      {atLimit && tier !== 'premium' && (
        <Pressable style={styles.limitCard} onPress={() => router.push('/upgrade')}>
          <Text style={styles.limitText}>
            You've reached the {tier} tier limit of {limits.maxAlertRules} rules.
          </Text>
          <Text style={styles.limitLink}>Upgrade for more →</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const createStyles = (t: ThemeTokens) => ({
  container: { flex: 1 as const, backgroundColor: t.background },
  content: { padding: 20, paddingBottom: 40 },

  // Filter toggle
  filterRow: {
    flexDirection: 'row' as const,
    backgroundColor: t.card,
    borderRadius: 10,
    padding: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: t.borderLight,
  },
  filterTab: {
    flex: 1 as const,
    paddingVertical: 8,
    alignItems: 'center' as const,
    borderRadius: 7,
  },
  filterTabActive: {
    backgroundColor: t.primary,
  },
  filterTabText: { fontSize: 14, fontWeight: '600' as const, color: t.textSecondary },
  filterTabTextActive: { color: t.textOnPrimary },

  sectionTitle: { fontSize: 20, fontWeight: '700' as const, color: t.textPrimary, marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, color: t.textTertiary, marginBottom: 16 },

  // Rule card
  ruleCard: {
    backgroundColor: t.card, borderRadius: 12, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: t.borderLight,
  },
  ruleHeader: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const,
    alignItems: 'center' as const, marginBottom: 8,
  },
  ruleName: { fontSize: 17, fontWeight: '600' as const, color: t.textPrimary },
  ruleLocation: { fontSize: 12, color: t.textTertiary, marginBottom: 6 },
  ruleConditions: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, marginBottom: 6 },
  conditionText: { fontSize: 14, color: t.primary, fontWeight: '500' as const },
  ruleDetails: { fontSize: 12, color: t.textTertiary, marginBottom: 4 },
  ruleTriggered: { fontSize: 12, color: t.textTertiary, marginBottom: 8 },
  ruleActions: {
    flexDirection: 'row' as const,
    justifyContent: 'flex-end' as const,
    gap: 12,
    marginTop: 8,
  },
  iconButton: { padding: 4 },
  iconButtonText: { fontSize: 18 },

  divider: { height: 1, backgroundColor: t.divider, marginVertical: 20 },

  // Preset dropdown
  dropdownButton: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  dropdownButtonText: { fontSize: 15, color: t.textPrimary, fontWeight: '500' as const },
  dropdownChevron: { fontSize: 12, color: t.textTertiary },

  // Modal
  modalOverlay: {
    flex: 1 as const,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  modalContent: {
    backgroundColor: t.card,
    borderRadius: 14,
    padding: 8,
    width: 280,
  },
  modalOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalOptionSelected: { backgroundColor: t.primaryLight },
  modalOptionText: { fontSize: 16, color: t.textPrimary },
  modalOptionTextSelected: { color: t.primary, fontWeight: '600' as const },

  // Preset card
  presetCard: {
    backgroundColor: t.card, borderRadius: 12, padding: 16, marginBottom: 8,
    flexDirection: 'row' as const, alignItems: 'center' as const,
    borderWidth: 1, borderColor: t.borderLight,
  },
  presetDisabled: { opacity: 0.5 },
  presetIcon: { fontSize: 28, marginRight: 14 },
  presetInfo: { flex: 1 as const },
  presetName: { fontSize: 16, fontWeight: '600' as const, color: t.textPrimary, marginBottom: 2 },
  presetDesc: { fontSize: 13, color: t.textSecondary, lineHeight: 18 },

  // Custom builder
  customButton: {
    borderWidth: 1, borderRadius: 12, paddingVertical: 18, alignItems: 'center' as const, marginTop: 20,
  },

  // Limit
  limitCard: { backgroundColor: t.warningLight, borderRadius: 8, padding: 14, marginTop: 12 },
  limitText: { fontSize: 14, color: t.textSecondary, textAlign: 'center' as const },
  limitLink: { fontSize: 14, color: t.primary, fontWeight: '600' as const, textAlign: 'center' as const, marginTop: 4 },

  // Preset confirmation modal
  presetConfirmModalContent: {
    backgroundColor: t.card,
    borderRadius: 16,
    padding: 20,
    width: 320,
  } as any,
  presetConfirmTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: t.textPrimary,
    marginBottom: 8,
  },
  presetConfirmDescription: {
    fontSize: 14,
    color: t.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  presetConfirmLocationLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: t.textPrimary,
    marginBottom: 10,
  },
  presetConfirmLocationButtons: {
    flexDirection: 'column' as const,
    gap: 8,
    marginBottom: 16,
  },
  presetConfirmLocationButton: {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center' as const,
  },
  presetConfirmLocationButtonSelected: {
    borderColor: t.primary,
    backgroundColor: t.primaryLight,
  },
  presetConfirmLocationButtonText: {
    fontSize: 14,
    color: t.textPrimary,
    fontWeight: '500' as const,
  },
  presetConfirmLocationButtonTextSelected: {
    color: t.primary,
    fontWeight: '600' as const,
  },
  presetConfirmActions: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  presetConfirmCancelButton: {
    flex: 1 as const,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: t.border,
    alignItems: 'center' as const,
  },
  presetConfirmCancelButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: t.textPrimary,
  },
  presetConfirmCreateButton: {
    flex: 1 as const,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: t.primary,
    alignItems: 'center' as const,
  },
  presetConfirmCreateButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: t.textOnPrimary,
  },
});
