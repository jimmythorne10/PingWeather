import { View, Text, ScrollView, Pressable, Switch, Alert, Modal } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useStyles, useTokens } from '../../src/theme';
import { useAlertRulesStore } from '../../src/stores/alertRulesStore';
import { useLocationsStore } from '../../src/stores/locationsStore';
import { useAuthStore } from '../../src/stores/authStore';
import { ALERT_PRESETS } from '../../src/data/alert-presets';
import { TIER_LIMITS } from '../../src/types';
import type { ThemeTokens } from '../../src/theme';
import type { AlertPreset, AlertRule } from '../../src/types';

type FilterTab = 'All' | 'Active' | 'Inactive';

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

  const [filterTab, setFilterTab] = useState<FilterTab>('All');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

  useEffect(() => {
    loadRules();
    loadLocations();
  }, []);

  const filteredRules = rules.filter((r) => {
    if (filterTab === 'Active') return r.is_active;
    if (filterTab === 'Inactive') return !r.is_active;
    return true;
  });

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

    const location = locations[0];
    const pollingHours = Math.max(preset.polling_interval_hours, limits.minPollingIntervalHours);

    Alert.alert(
      preset.name,
      `Create "${preset.name}" alert for ${location.name}?\n\n${preset.description}\n\nPolling: every ${pollingHours}h | Lookahead: ${preset.lookahead_hours}h`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: async () => {
            await addRule({
              location_id: location.id,
              name: preset.name,
              conditions: preset.conditions,
              logical_operator: preset.logical_operator,
              lookahead_hours: preset.lookahead_hours,
              polling_interval_hours: pollingHours,
              cooldown_hours: preset.cooldown_hours,
            });
          },
        },
      ]
    );
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Filter toggle — FR-ALERT-001 */}
      <View style={styles.filterRow}>
        {(['All', 'Active', 'Inactive'] as FilterTab[]).map((tab) => (
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

      {atLimit && (
        <View style={styles.limitCard}>
          <Text style={styles.limitText}>
            You've reached the {tier} tier limit of {limits.maxAlertRules} rules. Upgrade for more.
          </Text>
        </View>
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
});
