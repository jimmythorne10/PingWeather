import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTokens } from '../src/theme';
import { useAlertRulesStore } from '../src/stores/alertRulesStore';
import { useLocationsStore } from '../src/stores/locationsStore';
import { useAuthStore } from '../src/stores/authStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { TIER_LIMITS } from '../src/types';
import type { AlertCondition, WeatherMetric, ComparisonOperator, LogicalOperator } from '../src/types';
import { getUnitForMetric, getUnitLabel, MOON_PHASE_PRESETS, nearestMoonPhasePreset } from '../src/utils/metricHelpers';

const METRICS: { value: WeatherMetric; label: string; defaultUnit: string }[] = [
  { value: 'temperature_high', label: 'Daily High Temp', defaultUnit: '°F' },
  { value: 'temperature_low', label: 'Daily Low Temp', defaultUnit: '°F' },
  { value: 'temperature_current', label: 'Hourly Temp', defaultUnit: '°F' },
  { value: 'precipitation_probability', label: 'Rain Chance', defaultUnit: '%' },
  { value: 'wind_speed', label: 'Wind Speed', defaultUnit: 'mph' },
  { value: 'humidity', label: 'Humidity', defaultUnit: '%' },
  { value: 'feels_like', label: 'Feels Like', defaultUnit: '°F' },
  { value: 'uv_index', label: 'UV Index', defaultUnit: '' },
  // ── New metrics ──────────────────────────────────────────────────────────────
  // precipitation_amount: daily total rainfall in mm (or inches when converted)
  { value: 'precipitation_amount', label: 'Precipitation Amount', defaultUnit: 'mm' },
  // barometric_pressure: sea-level pressure in hPa — typical range 970–1040
  { value: 'barometric_pressure', label: 'Barometric Pressure', defaultUnit: 'hPa' },
  // snowfall: per-hour accumulation in cm
  { value: 'snowfall', label: 'Snowfall', defaultUnit: 'cm' },
  // snow_depth: current depth on the ground in cm
  { value: 'snow_depth', label: 'Snow Depth', defaultUnit: 'cm' },
  // soil_temperature: surface (0 cm) soil temp; Open-Meteo returns °F when temperature_unit=fahrenheit
  { value: 'soil_temperature', label: 'Soil Temperature', defaultUnit: '°F' },
  // weather_code: WMO integer code — unitless; helper text shown below value input
  { value: 'weather_code', label: 'Weather Condition', defaultUnit: '' },
  // moon_phase: % illumination — 0 = new moon, 100 = full moon
  { value: 'moon_phase', label: 'Moon Phase', defaultUnit: '%' },
  // wind_gusts: peak gust speed in mph
  { value: 'wind_gusts', label: 'Wind Gusts', defaultUnit: 'mph' },
  // dew_point: dew point temperature; follows temperature_unit
  { value: 'dew_point', label: 'Dew Point', defaultUnit: '°F' },
  // visibility: converted from raw meters to miles for display and comparison
  { value: 'visibility', label: 'Visibility', defaultUnit: 'mi' },
  // cloud_cover: percentage of sky covered by clouds
  { value: 'cloud_cover', label: 'Cloud Cover', defaultUnit: '%' },
  // wind_direction: compass bearing wind is coming FROM (0=N, 90=E, 180=S, 270=W)
  { value: 'wind_direction', label: 'Wind Direction', defaultUnit: '°' },
  // pressure_tendency: expected pressure change over lookahead window (hPa, negative=falling)
  { value: 'pressure_tendency', label: 'Pressure Tendency', defaultUnit: 'hPa' },
];

// ── Category definitions for the metric filter chips ─────────────────────────
type MetricCategory = 'all' | 'temperature' | 'wind' | 'precipitation' | 'atmosphere' | 'special';

const METRIC_CATEGORIES: { value: MetricCategory; label: string }[] = [
  { value: 'all',         label: 'All' },
  { value: 'temperature', label: 'Temperature' },
  { value: 'wind',        label: 'Wind' },
  { value: 'precipitation', label: 'Precipitation' },
  { value: 'atmosphere',  label: 'Atmosphere' },
  { value: 'special',     label: 'Special' },
];

const METRIC_CATEGORY_MAP: Record<string, MetricCategory> = {
  temperature_high:           'temperature',
  temperature_low:            'temperature',
  temperature_current:        'temperature',
  feels_like:                 'temperature',
  dew_point:                  'temperature',
  soil_temperature:           'temperature',
  wind_speed:                 'wind',
  wind_gusts:                 'wind',
  precipitation_probability:  'precipitation',
  precipitation_amount:       'precipitation',
  snowfall:                   'precipitation',
  snow_depth:                 'precipitation',
  humidity:                   'atmosphere',
  barometric_pressure:        'atmosphere',
  uv_index:                   'atmosphere',
  cloud_cover:                'atmosphere',
  visibility:                 'atmosphere',
  weather_code:               'atmosphere',
  moon_phase:                 'special',
  wind_direction:             'wind',
  pressure_tendency:          'atmosphere',
};

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

const COMPASS_DIRECTIONS = [
  { label: 'N', value: 0 },
  { label: 'NE', value: 45 },
  { label: 'E', value: 90 },
  { label: 'SE', value: 135 },
  { label: 'S', value: 180 },
  { label: 'SW', value: 225 },
  { label: 'W', value: 270 },
  { label: 'NW', value: 315 },
] as const;

const BEARING_TOLERANCES = [
  { label: '±22.5°', value: 22.5 },
  { label: '±45°', value: 45 },
  { label: '±67.5°', value: 67.5 },
  { label: '±90°', value: 90 },
] as const;

export default function CreateRuleScreen() {
  const router = useRouter();
  const t = useTokens();
  const params = useLocalSearchParams<{ mode?: string; ruleId?: string }>();
  const mode = params.mode; // 'edit' | 'clone' | undefined (create)
  const ruleId = params.ruleId;

  const profile = useAuthStore((s) => s.profile);
  const { locations, loadLocations } = useLocationsStore();
  const { rules, createRule, updateRule, loadRules } = useAlertRulesStore();

  const temperatureUnit = useSettingsStore((s) => s.temperatureUnit);
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
  // Category filter state — one entry per condition, defaults to 'all'
  const [conditionCategories, setConditionCategories] = useState<MetricCategory[]>(() =>
    (sourceRule?.conditions ?? [{ metric: 'temperature_low' }]).map(() => 'all' as MetricCategory)
  );

  useEffect(() => {
    // FIX 12: Load both locations and rules on mount. On a cold-start deep
    // link into this screen (e.g., tapping "edit" from a notification), the
    // Zustand store may be empty. Without loadRules() here, sourceRule is
    // undefined, all useState initialisers get their default values, and the
    // form opens blank instead of pre-populated.
    loadLocations();
    loadRules();
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
    setConditionCategories([...conditionCategories, 'all']);
  };

  const removeCondition = (index: number) => {
    if (conditions.length <= 1) return;
    setConditions(conditions.filter((_, i) => i !== index));
    setConditionCategories(conditionCategories.filter((_, i) => i !== index));
  };

  const setConditionCategory = (index: number, category: MetricCategory) => {
    setConditionCategories(conditionCategories.map((c, i) => i === index ? category : c));
  };

  const updateCondition = (index: number, updates: Partial<AlertCondition>) => {
    setConditions(conditions.map((c, i) => i === index ? { ...c, ...updates } : c));
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
            {/* Metric selector — category filter + filtered metric chips */}
            <Text style={[styles.condLabel, { color: t.textTertiary }]}>WHEN</Text>
            {/* Category filter row */}
            <View style={[styles.chipRow, { marginBottom: 6 }]}>
              {METRIC_CATEGORIES.map((cat) => {
                const isActive = (conditionCategories[index] ?? 'all') === cat.value;
                return (
                  <Pressable
                    key={cat.value}
                    style={[
                      styles.chip,
                      styles.categoryChip,
                      { borderColor: isActive ? t.primary : t.border },
                      isActive && { backgroundColor: t.primaryLight },
                    ]}
                    onPress={() => setConditionCategory(index, cat.value)}
                  >
                    <Text style={{ color: isActive ? t.primary : t.textTertiary, fontSize: 12, fontWeight: '500' }}>
                      {cat.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {/* Filtered metric chips */}
            <View style={styles.chipRow}>
              {METRICS.filter((m) => {
                const activeCategory = conditionCategories[index] ?? 'all';
                return activeCategory === 'all' || METRIC_CATEGORY_MAP[m.value] === activeCategory;
              }).map((m) => (
                <Pressable
                  key={m.value}
                  style={[
                    styles.chip,
                    { borderColor: condition.metric === m.value ? t.primary : t.border },
                    condition.metric === m.value && { backgroundColor: t.primaryLight },
                  ]}
                  onPress={() => {
                    if (m.value === 'wind_direction') {
                      updateCondition(index, { metric: 'wind_direction', operator: 'from_bearing', unit: 'degrees', value: 0, tolerance: 45 });
                    } else {
                      updateCondition(index, { metric: m.value, unit: getUnitForMetric(m.value, temperatureUnit) });
                    }
                  }}
                >
                  <Text style={{ color: condition.metric === m.value ? t.primary : t.textSecondary, fontSize: 13 }}>
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Operator selector — hidden for wind_direction (operator is always from_bearing) */}
            {condition.metric !== 'wind_direction' && (
              <>
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
              </>
            )}

            {/* Value input */}
            <Text style={[styles.condLabel, { color: t.textTertiary }]}>
              {condition.metric === 'wind_direction' ? 'COMING FROM' : 'VALUE'}
            </Text>
            {condition.metric === 'moon_phase' ? (
              <View style={styles.chipRow}>
                {MOON_PHASE_PRESETS.map((preset) => {
                  const isSelected = nearestMoonPhasePreset(condition.value).value === preset.value;
                  return (
                    <Pressable
                      key={preset.value}
                      style={[
                        styles.chip,
                        styles.moonChip,
                        { borderColor: isSelected ? t.primary : t.border },
                        isSelected && { backgroundColor: t.primaryLight },
                      ]}
                      onPress={() => updateCondition(index, { value: preset.value })}
                    >
                      <Text style={{ color: isSelected ? t.primary : t.textPrimary, fontSize: 14, fontWeight: '500' }}>
                        {preset.label}
                      </Text>
                      <Text style={{ color: isSelected ? t.primary : t.textTertiary, fontSize: 11 }}>
                        {preset.description}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : condition.metric === 'wind_direction' ? (
              <>
                <View style={styles.chipRow}>
                  {COMPASS_DIRECTIONS.map((dir) => {
                    const isSelected = condition.value === dir.value;
                    return (
                      <Pressable
                        key={dir.value}
                        style={[
                          styles.chip,
                          { borderColor: isSelected ? t.primary : t.border },
                          isSelected && { backgroundColor: t.primaryLight },
                        ]}
                        onPress={() => updateCondition(index, { value: dir.value })}
                      >
                        <Text style={{ color: isSelected ? t.primary : t.textSecondary, fontSize: 14, fontWeight: isSelected ? '700' : '400' }}>
                          {dir.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={[styles.condLabel, { color: t.textTertiary }]}>WITHIN</Text>
                <View style={styles.chipRow}>
                  {BEARING_TOLERANCES.map((tol) => {
                    const isSelected = (condition.tolerance ?? 45) === tol.value;
                    return (
                      <Pressable
                        key={tol.value}
                        style={[
                          styles.chip,
                          { borderColor: isSelected ? t.primary : t.border },
                          isSelected && { backgroundColor: t.primaryLight },
                        ]}
                        onPress={() => updateCondition(index, { tolerance: tol.value })}
                      >
                        <Text style={{ color: isSelected ? t.primary : t.textSecondary, fontSize: 13 }}>
                          {tol.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : (
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
                  {getUnitLabel(condition.unit)}
                </Text>
              </View>
            )}

            {/* Metric-specific helper text */}
            {condition.metric === 'weather_code' && (
              <Text style={[styles.metricHelperText, { color: t.textTertiary }]}>
                WMO weather codes: ≥95 thunderstorm, ≥80 snow showers, ≥61 rain, ≥51 drizzle, ≥45 fog
              </Text>
            )}
            {condition.metric === 'barometric_pressure' && (
              <Text style={[styles.metricHelperText, { color: t.textTertiary }]}>
                Normal sea level = 1013 hPa. Typical range 970–1040 hPa. Below 1005 hPa may indicate approaching storm.
              </Text>
            )}
            {condition.metric === 'visibility' && (
              <Text style={[styles.metricHelperText, { color: t.textTertiary }]}>
                Clear day = 10+ mi. Dense fog = &lt; 0.25 mi. Typical fog alert threshold: 1 mi.
              </Text>
            )}
            {condition.metric === 'cloud_cover' && (
              <Text style={[styles.metricHelperText, { color: t.textTertiary }]}>
                0% = clear sky, 100% = fully overcast.
              </Text>
            )}
            {condition.metric === 'wind_gusts' && (
              <Text style={[styles.metricHelperText, { color: t.textTertiary }]}>
                Peak wind speed — typically higher than sustained wind. More damaging to structures.
              </Text>
            )}
            {condition.metric === 'dew_point' && (
              <Text style={[styles.metricHelperText, { color: t.textTertiary }]}>
                Above 65°F (18°C) feels oppressive. Above 70°F (21°C) very uncomfortable.
              </Text>
            )}
            {condition.metric === 'wind_direction' && (
              <Text style={[styles.metricHelperText, { color: t.textTertiary }]}>
                The compass direction wind is coming FROM. North wind blows south. Wider tolerance catches more wind events.
              </Text>
            )}
            {condition.metric === 'pressure_tendency' && (
              <Text style={[styles.metricHelperText, { color: t.textTertiary }]}>
                Expected pressure change over the forecast window. Negative = falling (storm risk). A drop of –8 hPa or more is a classic approaching-storm signal. Positive = rising (clearing).
              </Text>
            )}

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
              if (c.metric === 'wind_direction') {
                const dir = COMPASS_DIRECTIONS.find((d) => d.value === c.value)?.label ?? `${c.value}°`;
                return `the wind comes from ${dir} (±${c.tolerance ?? 45}°)`;
              }
              const op = OPERATORS.find((o) => o.value === c.operator)?.label ?? c.operator;
              const unitLabel = getUnitLabel(c.unit);
              const valueDisplay = c.metric === 'moon_phase'
                ? nearestMoonPhasePreset(c.value).label
                : c.metric === 'pressure_tendency'
                ? `${c.value > 0 ? '+' : ''}${c.value} hPa`
                : `${c.value}${unitLabel ? ' ' + unitLabel : ''}`;
              return `the ${metric} goes ${op} ${valueDisplay}`;
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
  moonChip: {
    paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', minWidth: 100,
  },
  categoryChip: {
    paddingVertical: 5, paddingHorizontal: 10,
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
  metricHelperText: { fontSize: 12, lineHeight: 17, marginTop: 8 },
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
