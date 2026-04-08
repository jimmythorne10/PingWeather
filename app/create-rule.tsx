import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTokens } from '../src/theme';
import { useAlertRulesStore } from '../src/stores/alertRulesStore';
import { useLocationsStore } from '../src/stores/locationsStore';
import { useAuthStore } from '../src/stores/authStore';
import { TIER_LIMITS } from '../src/types';
import type { AlertCondition, WeatherMetric, ComparisonOperator, LogicalOperator } from '../src/types';

const METRICS: { value: WeatherMetric; label: string; defaultUnit: string }[] = [
  { value: 'temperature_high', label: 'Daily High Temp', defaultUnit: '°F' },
  { value: 'temperature_low', label: 'Daily Low Temp', defaultUnit: '°F' },
  { value: 'temperature_current', label: 'Hourly Temp', defaultUnit: '°F' },
  { value: 'precipitation_probability', label: 'Rain Chance', defaultUnit: '%' },
  { value: 'wind_speed', label: 'Wind Speed', defaultUnit: 'mph' },
  { value: 'humidity', label: 'Humidity', defaultUnit: '%' },
  { value: 'feels_like', label: 'Feels Like', defaultUnit: '°F' },
  { value: 'uv_index', label: 'UV Index', defaultUnit: '' },
];

const OPERATORS: { value: ComparisonOperator; label: string }[] = [
  { value: 'gt', label: 'above' },
  { value: 'gte', label: 'at or above' },
  { value: 'lt', label: 'below' },
  { value: 'lte', label: 'at or below' },
  { value: 'eq', label: 'exactly' },
];

const LOOKAHEAD_OPTIONS = [
  { hours: 6, label: '6 hours' },
  { hours: 12, label: '12 hours' },
  { hours: 24, label: '1 day' },
  { hours: 48, label: '2 days' },
  { hours: 72, label: '3 days' },
  { hours: 120, label: '5 days' },
  { hours: 168, label: '7 days' },
];

const COOLDOWN_OPTIONS = [
  { hours: 4, label: '4 hours' },
  { hours: 6, label: '6 hours' },
  { hours: 12, label: '12 hours' },
  { hours: 24, label: '24 hours' },
  { hours: 48, label: '48 hours' },
];

export default function CreateRuleScreen() {
  const router = useRouter();
  const t = useTokens();
  const params = useLocalSearchParams<{ mode?: string; ruleId?: string }>();
  const mode = params.mode; // 'edit' | 'clone' | undefined (create)
  const ruleId = params.ruleId;

  const profile = useAuthStore((s) => s.profile);
  const { locations, loadLocations } = useLocationsStore();
  const { rules, createRule, updateRule } = useAlertRulesStore();

  const tier = profile?.subscription_tier ?? 'free';
  const limits = TIER_LIMITS[tier];

  // Find source rule for edit/clone modes
  const sourceRule = (mode === 'edit' || mode === 'clone') && ruleId
    ? rules.find((r) => r.id === ruleId)
    : undefined;

  const [name, setName] = useState(() => {
    if (sourceRule && mode === 'clone') return `${sourceRule.name} (copy)`;
    if (sourceRule && mode === 'edit') return sourceRule.name;
    return '';
  });
  const [selectedLocationId, setSelectedLocationId] = useState(() =>
    sourceRule ? sourceRule.location_id : ''
  );
  const [conditions, setConditions] = useState<AlertCondition[]>(() =>
    sourceRule
      ? sourceRule.conditions
      : [{ metric: 'temperature_low', operator: 'lt', value: 32, unit: 'fahrenheit' }]
  );
  const [logicalOp, setLogicalOp] = useState<LogicalOperator>(
    sourceRule ? sourceRule.logical_operator : 'AND'
  );
  const [lookaheadHours, setLookaheadHours] = useState(
    sourceRule ? sourceRule.lookahead_hours : 24
  );
  const [pollingHours, setPollingHours] = useState(
    sourceRule ? sourceRule.polling_interval_hours : limits.minPollingIntervalHours
  );
  const [cooldownHours, setCooldownHours] = useState(
    sourceRule ? sourceRule.cooldown_hours : 12
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    if (locations.length > 0 && !selectedLocationId) {
      setSelectedLocationId(locations[0].id);
    }
  }, [locations]);

  const addCondition = () => {
    if (!limits.compoundConditions) {
      Alert.alert('Upgrade Required', 'Compound conditions require Pro tier or higher.');
      return;
    }
    setConditions([...conditions, { metric: 'precipitation_probability', operator: 'gt', value: 50, unit: 'percent' }]);
  };

  const removeCondition = (index: number) => {
    if (conditions.length <= 1) return;
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, updates: Partial<AlertCondition>) => {
    setConditions(conditions.map((c, i) => i === index ? { ...c, ...updates } : c));
  };

  const getUnitForMetric = (metric: WeatherMetric): AlertCondition['unit'] => {
    if (metric.includes('temperature') || metric === 'feels_like') return 'fahrenheit';
    if (metric === 'precipitation_probability' || metric === 'humidity') return 'percent';
    if (metric === 'wind_speed') return 'mph';
    if (metric === 'uv_index') return 'index';
    return undefined;
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Give your alert rule a name.');
      return;
    }
    if (!selectedLocationId) {
      Alert.alert('Location Required', 'Select a location to monitor.');
      return;
    }

    setSaving(true);
    if (mode === 'edit' && ruleId && updateRule) {
      await updateRule(ruleId, {
        location_id: selectedLocationId,
        name: name.trim(),
        conditions,
        logical_operator: logicalOp,
        lookahead_hours: lookaheadHours,
        polling_interval_hours: Math.max(pollingHours, limits.minPollingIntervalHours),
        cooldown_hours: cooldownHours,
      });
    } else {
      await createRule({
        location_id: selectedLocationId,
        name: name.trim(),
        conditions,
        logical_operator: logicalOp,
        lookahead_hours: lookaheadHours,
        polling_interval_hours: Math.max(pollingHours, limits.minPollingIntervalHours),
        cooldown_hours: cooldownHours,
      });
    }
    setSaving(false);
    router.back();
  };

  const screenTitle =
    mode === 'edit' ? 'Edit Alert Rule' :
    mode === 'clone' ? 'Clone Alert Rule' :
    'Custom Alert Rule';

  const saveButtonLabel =
    mode === 'edit' ? 'Save Changes' : 'Create Alert Rule';

  return (
    <ScrollView style={[styles.container, { backgroundColor: t.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: t.textPrimary }]}>{screenTitle}</Text>

      {/* Rule Name */}
      <Text style={[styles.label, { color: t.textSecondary }]}>RULE NAME</Text>
      <TextInput
        style={[styles.input, { backgroundColor: t.inputBackground, borderColor: t.border, color: t.textPrimary }]}
        placeholder="e.g., Freeze Warning, Rain Alert"
        placeholderTextColor={t.textTertiary}
        value={name}
        onChangeText={setName}
      />

      {/* Location */}
      <Text style={[styles.label, { color: t.textSecondary }]}>LOCATION</Text>
      {locations.length === 0 ? (
        <Pressable
          style={[styles.input, { backgroundColor: t.inputBackground, borderColor: t.border }]}
          onPress={() => router.push('/(tabs)/locations')}
        >
          <Text style={{ color: t.primary }}>Add a location first</Text>
        </Pressable>
      ) : (
        <View style={[styles.chipRow]}>
          {locations.map((loc) => (
            <Pressable
              key={loc.id}
              style={[
                styles.chip,
                { borderColor: selectedLocationId === loc.id ? t.primary : t.border },
                selectedLocationId === loc.id && { backgroundColor: t.primaryLight },
              ]}
              onPress={() => setSelectedLocationId(loc.id)}
            >
              <Text style={{ color: selectedLocationId === loc.id ? t.primary : t.textSecondary, fontSize: 14 }}>
                {loc.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Conditions */}
      <Text style={[styles.label, { color: t.textSecondary }]}>CONDITIONS</Text>
      {conditions.map((condition, index) => (
        <View key={index}>
          {index > 0 && (
            <View style={styles.logicalRow}>
              <Pressable
                style={[styles.logicalChip, logicalOp === 'AND' && { backgroundColor: t.primary }]}
                onPress={() => setLogicalOp('AND')}
              >
                <Text style={{ color: logicalOp === 'AND' ? t.textOnPrimary : t.textSecondary, fontSize: 13 }}>AND</Text>
              </Pressable>
              <Pressable
                style={[styles.logicalChip, logicalOp === 'OR' && { backgroundColor: t.primary }]}
                onPress={() => setLogicalOp('OR')}
              >
                <Text style={{ color: logicalOp === 'OR' ? t.textOnPrimary : t.textSecondary, fontSize: 13 }}>OR</Text>
              </Pressable>
            </View>
          )}
          <View style={[styles.conditionCard, { backgroundColor: t.card, borderColor: t.borderLight }]}>
            {/* Metric selector */}
            <Text style={[styles.condLabel, { color: t.textTertiary }]}>WHEN</Text>
            <View style={styles.chipRow}>
              {METRICS.map((m) => (
                <Pressable
                  key={m.value}
                  style={[
                    styles.chip,
                    { borderColor: condition.metric === m.value ? t.primary : t.border },
                    condition.metric === m.value && { backgroundColor: t.primaryLight },
                  ]}
                  onPress={() => updateCondition(index, { metric: m.value, unit: getUnitForMetric(m.value) })}
                >
                  <Text style={{ color: condition.metric === m.value ? t.primary : t.textSecondary, fontSize: 13 }}>
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Operator selector */}
            <Text style={[styles.condLabel, { color: t.textTertiary }]}>IS</Text>
            <View style={styles.chipRow}>
              {OPERATORS.map((op) => (
                <Pressable
                  key={op.value}
                  style={[
                    styles.chip,
                    { borderColor: condition.operator === op.value ? t.primary : t.border },
                    condition.operator === op.value && { backgroundColor: t.primaryLight },
                  ]}
                  onPress={() => updateCondition(index, { operator: op.value })}
                >
                  <Text style={{ color: condition.operator === op.value ? t.primary : t.textSecondary, fontSize: 13 }}>
                    {op.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Value input */}
            <Text style={[styles.condLabel, { color: t.textTertiary }]}>VALUE</Text>
            <View style={styles.valueRow}>
              <TextInput
                style={[styles.valueInput, { backgroundColor: t.inputBackground, borderColor: t.border, color: t.textPrimary }]}
                keyboardType="numeric"
                value={condition.value.toString()}
                onChangeText={(val) => {
                  const num = parseFloat(val);
                  if (!isNaN(num)) updateCondition(index, { value: num });
                }}
              />
              <Text style={[styles.unitLabel, { color: t.textTertiary }]}>
                {METRICS.find((m) => m.value === condition.metric)?.defaultUnit ?? ''}
              </Text>
            </View>

            {/* Remove button */}
            {conditions.length > 1 && (
              <Pressable onPress={() => removeCondition(index)} style={styles.removeBtn}>
                <Text style={{ color: t.error, fontSize: 14 }}>Remove condition</Text>
              </Pressable>
            )}
          </View>
        </View>
      ))}

      <Pressable
        style={[styles.addCondBtn, { borderColor: t.primary }]}
        onPress={addCondition}
      >
        <Text style={{ color: t.primary, fontSize: 15 }}>+ Add Condition</Text>
      </Pressable>

      {/* Lookahead */}
      <Text style={[styles.label, { color: t.textSecondary }]}>HOW FAR AHEAD SHOULD WE LOOK?</Text>
      <Text style={[styles.helperText, { color: t.textTertiary }]}>
        Shorter windows are more accurate. Longer windows give you more lead time.
      </Text>
      <View style={styles.chipRow}>
        {LOOKAHEAD_OPTIONS.map((opt) => (
          <Pressable
            key={opt.hours}
            style={[
              styles.chip,
              { borderColor: lookaheadHours === opt.hours ? t.primary : t.border },
              lookaheadHours === opt.hours && { backgroundColor: t.primaryLight },
            ]}
            onPress={() => setLookaheadHours(opt.hours)}
          >
            <Text style={{ color: lookaheadHours === opt.hours ? t.primary : t.textSecondary, fontSize: 13 }}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Polling interval */}
      <Text style={[styles.label, { color: t.textSecondary }]}>HOW OFTEN SHOULD WE CHECK?</Text>
      <Text style={[styles.helperText, { color: t.textTertiary }]}>
        More frequent checks catch changes faster but use more battery.
      </Text>
      <View style={styles.chipRow}>
        {[1, 2, 4, 6, 8, 12, 24].filter((h) => h >= limits.minPollingIntervalHours).map((h) => (
          <Pressable
            key={h}
            style={[
              styles.chip,
              { borderColor: pollingHours === h ? t.primary : t.border },
              pollingHours === h && { backgroundColor: t.primaryLight },
            ]}
            onPress={() => setPollingHours(h)}
          >
            <Text style={{ color: pollingHours === h ? t.primary : t.textSecondary, fontSize: 13 }}>
              {h === 1 ? 'Every hour' : h < 24 ? `Every ${h} hrs` : 'Once a day'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Cooldown — reframed as "don't bug me" */}
      <Text style={[styles.label, { color: t.textSecondary }]}>AFTER AN ALERT, WAIT BEFORE ALERTING AGAIN</Text>
      <Text style={[styles.helperText, { color: t.textTertiary }]}>
        Prevents repeated notifications for the same weather event.
      </Text>
      <View style={styles.chipRow}>
        {COOLDOWN_OPTIONS.map((opt) => (
          <Pressable
            key={opt.hours}
            style={[
              styles.chip,
              { borderColor: cooldownHours === opt.hours ? t.primary : t.border },
              cooldownHours === opt.hours && { backgroundColor: t.primaryLight },
            ]}
            onPress={() => setCooldownHours(opt.hours)}
          >
            <Text style={{ color: cooldownHours === opt.hours ? t.primary : t.textSecondary, fontSize: 13 }}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Summary — plain English */}
      <View style={[styles.summaryCard, { backgroundColor: t.primaryLight, borderColor: t.primary }]}>
        <Text style={[styles.summaryTitle, { color: t.primary }]}>Here's what will happen:</Text>
        <Text style={[styles.summaryText, { color: t.textPrimary }]}>
          {(() => {
            const loc = locations.find((l) => l.id === selectedLocationId);
            const locName = loc?.name ?? 'your location';

            // Build the condition sentence
            const condParts = conditions.map((c) => {
              const metric = METRICS.find((m) => m.value === c.metric)?.label?.toLowerCase() ?? c.metric;
              const op = OPERATORS.find((o) => o.value === c.operator)?.label ?? c.operator;
              const unit = METRICS.find((m) => m.value === c.metric)?.defaultUnit ?? '';
              return `the ${metric} goes ${op} ${c.value}${unit}`;
            });

            const condSentence = condParts.length === 1
              ? condParts[0]
              : condParts.slice(0, -1).join(', ') + (logicalOp === 'AND' ? ' and ' : ' or ') + condParts[condParts.length - 1];

            // Lookahead in plain words
            const lookahead = LOOKAHEAD_OPTIONS.find((o) => o.hours === lookaheadHours)?.label ?? `${lookaheadHours} hours`;

            // Polling in plain words
            const polling = pollingHours === 1 ? 'every hour' :
              pollingHours === 24 ? 'once a day' :
              `every ${pollingHours} hours`;

            // Cooldown in plain words
            const cooldown = cooldownHours <= 6 ? `${cooldownHours} hours` :
              cooldownHours === 12 ? 'half a day' :
              cooldownHours === 24 ? 'a full day' :
              `${cooldownHours} hours`;

            return `We'll check the forecast for ${locName} ${polling}. If ${condSentence} anytime in the next ${lookahead}, you'll get a notification.\n\nAfter alerting you, we'll wait at least ${cooldown} before notifying you again for this rule.`;
          })()}
        </Text>
      </View>

      {/* Save */}
      <Pressable
        style={[styles.saveBtn, { backgroundColor: saving ? t.primaryDisabled : t.primary }]}
        onPress={handleSave}
        disabled={saving || !name.trim() || !selectedLocationId}
      >
        <Text style={[styles.saveBtnText, { color: t.textOnPrimary }]}>
          {saving ? 'Saving...' : saveButtonLabel}
        </Text>
      </Pressable>

      <Pressable style={styles.cancelBtn} onPress={() => router.back()}>
        <Text style={{ color: t.textTertiary, fontSize: 16 }}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginTop: 20, marginBottom: 4 },
  helperText: { fontSize: 13, lineHeight: 18, marginBottom: 10 },
  input: {
    borderWidth: 1, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16, fontSize: 16,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14,
  },
  conditionCard: {
    borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 8,
  },
  condLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginTop: 12, marginBottom: 6 },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  valueInput: {
    borderWidth: 1, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14, fontSize: 20, fontWeight: '700', width: 100, textAlign: 'center',
  },
  unitLabel: { fontSize: 16 },
  removeBtn: { marginTop: 12, alignItems: 'flex-end' },
  logicalRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 8 },
  logicalChip: { borderRadius: 6, paddingVertical: 6, paddingHorizontal: 16, borderWidth: 1, borderColor: '#ccc' },
  addCondBtn: {
    borderWidth: 1, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 12,
  },
  summaryCard: {
    borderWidth: 1, borderRadius: 12, padding: 16, marginTop: 24,
  },
  summaryTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  summaryText: { fontSize: 14, lineHeight: 22 },
  saveBtn: {
    paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 20,
  },
  saveBtnText: { fontSize: 18, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', paddingVertical: 16 },
});
