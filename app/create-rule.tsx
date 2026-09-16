import { View, Text, ScrollView, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useState, useEffect, useMemo } from 'react';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useStyles, useTokens } from '../src/theme';
import type { ThemeTokens } from '../src/theme';
import type { LookTokens } from '../src/theme/looks';
import { useAlertRulesStore } from '../src/stores/alertRulesStore';
import { useLocationsStore } from '../src/stores/locationsStore';
import { useAuthStore } from '../src/stores/authStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { TIER_LIMITS } from '../src/types';
import type { AlertCondition, WeatherMetric, ComparisonOperator, LogicalOperator } from '../src/types';
import { getUnitForMetric, getUnitLabel, MOON_PHASE_PRESETS, nearestMoonPhasePreset } from '../src/utils/metricHelpers';
import { weatherCodeLabel, weatherCodeToEmoji } from '../src/services/weatherIcon';
import { deriveRuleForm, NOT_READY } from '../src/utils/deriveRuleForm';

// Sorted alphabetically by label so users can scan predictably.
const METRICS: { value: WeatherMetric; label: string; summaryLabel?: string; defaultUnit: string }[] = [
  { value: 'barometric_pressure', label: 'Barometric Pressure', defaultUnit: 'hPa' },
  { value: 'cloud_cover',         label: 'Cloud Cover',         defaultUnit: '%' },
  { value: 'temperature_high',    label: 'Daily High Temp',     defaultUnit: '°F' },
  { value: 'temperature_low',     label: 'Daily Low Temp',      defaultUnit: '°F' },
  { value: 'dew_point',           label: 'Dew Point',           defaultUnit: '°F' },
  { value: 'feels_like',          label: 'Feels Like',          summaryLabel: 'feels-like temperature', defaultUnit: '°F' },
  { value: 'temperature_current', label: 'Hourly Temp',         summaryLabel: 'current temperature',    defaultUnit: '°F' },
  { value: 'humidity',            label: 'Humidity',            defaultUnit: '%' },
  { value: 'moon_phase',          label: 'Moon Phase',          defaultUnit: '%' },
  { value: 'precipitation_amount',label: 'Precipitation Amount',defaultUnit: 'mm' },
  { value: 'pressure_tendency',   label: 'Pressure Tendency',   defaultUnit: 'hPa' },
  { value: 'precipitation_probability', label: 'Rain Chance',   defaultUnit: '%' },
  { value: 'snow_depth',          label: 'Snow Depth',          defaultUnit: 'cm' },
  { value: 'snowfall',            label: 'Snowfall',            defaultUnit: 'cm' },
  { value: 'soil_temperature',    label: 'Soil Temperature',    defaultUnit: '°F' },
  { value: 'uv_index',            label: 'UV Index',            summaryLabel: 'UV index',               defaultUnit: '' },
  { value: 'visibility',          label: 'Visibility',          defaultUnit: 'mi' },
  { value: 'weather_code',        label: 'Weather Condition',   defaultUnit: '' },
  { value: 'wind_direction',      label: 'Wind Direction',      defaultUnit: '°' },
  { value: 'wind_gusts',          label: 'Wind Gusts',          summaryLabel: 'wind gust speed',        defaultUnit: 'mph' },
  { value: 'wind_speed',          label: 'Wind Speed',          defaultUnit: 'mph' },
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

// Controlled numeric input that keeps a local string buffer so mid-edit states
// like "" or "-" don't snap back to the last valid number. Syncs from `value`
// when an external change (preset chip, compass bearing) sets a new number.
function NumericInput({
  value,
  onValueChange,
  style,
}: {
  value: number;
  onValueChange: (n: number) => void;
  style?: object;
}) {
  const [text, setText] = useState(value.toString());

  useEffect(() => {
    // Only overwrite the local text when the external value genuinely changed
    // (e.g. a preset chip set it). Don't clobber while the user is mid-edit.
    if (parseFloat(text) !== value) {
      setText(value.toString());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <TextInput
      style={style}
      keyboardType="numeric"
      value={text}
      onChangeText={(val) => {
        setText(val);
        const num = parseFloat(val);
        if (!isNaN(num)) onValueChange(num);
      }}
    />
  );
}

export default function CreateRuleScreen() {
  const router = useRouter();
  const t = useTokens();
  const styles = useStyles(createStyles);
  const params = useLocalSearchParams<{ mode?: string; ruleId?: string }>();
  const mode = params.mode; // 'edit' | 'clone' | undefined (create)
  const ruleId = params.ruleId;

  const profile = useAuthStore((s) => s.profile);
  const { locations, loadLocations } = useLocationsStore();
  const { rules, createRule, updateRule, loadRules } = useAlertRulesStore();

  const temperatureUnit = useSettingsStore((s) => s.temperatureUnit);
  const pressureUnit = useSettingsStore((s) => s.pressureUnit);
  const tier = profile?.subscription_tier ?? 'free';
  const limits = TIER_LIMITS[tier];

  // BUG-004 fix: Gate the form on explicit loaded flags set after async calls
  // resolve. useState initialisers run once — if rules/locations aren't loaded
  // yet they get stale defaults that never update. Instead we wait here.
  const [rulesLoaded, setRulesLoaded] = useState(false);
  const [locationsLoaded, setLocationsLoaded] = useState(false);

  useEffect(() => {
    void loadLocations().then(() => setLocationsLoaded(true));
    void loadRules().then(() => setRulesLoaded(true));
  }, []);

  // Derive form values from the store via useMemo so they react when rules
  // populates (rather than one-shot useState initialisers). NOT_READY is
  // returned until the required rule is present.
  const derivedForm = useMemo(
    () => deriveRuleForm(rules, ruleId, mode),
    [rules, ruleId, mode]
  );

  // Form state — initialised from derivedForm once it is ready. Using separate
  // useState fields (rather than a single object) preserves the fine-grained
  // update callbacks used throughout the component.
  const ready = rulesLoaded && locationsLoaded && derivedForm !== NOT_READY;

  const [name, setName] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [conditions, setConditions] = useState<AlertCondition[]>([
    { metric: 'temperature_low', operator: 'lt', value: 32, unit: 'fahrenheit' },
  ]);
  const [logicalOp, setLogicalOp] = useState<LogicalOperator>('AND');
  const [lookaheadHours, setLookaheadHours] = useState(24);
  const [pollingHours, setPollingHours] = useState(limits.minPollingIntervalHours);
  const [cooldownHours, setCooldownHours] = useState(12);
  const [saving, setSaving] = useState(false);
  const [conditionCategories, setConditionCategories] = useState<MetricCategory[]>(['all']);
  // Track whether we've seeded form state from derivedForm so we only do it once.
  const [formSeeded, setFormSeeded] = useState(false);

  useEffect(() => {
    if (formSeeded || derivedForm === NOT_READY) return;
    // Both stores are loaded and derivedForm has real values — seed form state.
    setName(derivedForm.name);
    setSelectedLocationId(derivedForm.selectedLocationId);
    setConditions(derivedForm.conditions);
    setLogicalOp(derivedForm.logicalOp);
    setLookaheadHours(derivedForm.lookaheadHours);
    setPollingHours(
      Math.max(derivedForm.pollingHours, limits.minPollingIntervalHours)
    );
    setCooldownHours(derivedForm.cooldownHours);
    setConditionCategories(derivedForm.conditions.map(() => 'all' as MetricCategory));
    setFormSeeded(true);
  }, [derivedForm, formSeeded, limits.minPollingIntervalHours]);

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
    let ok: boolean;
    if (mode === 'edit' && ruleId && updateRule) {
      ok = await updateRule(ruleId, {
        location_id: selectedLocationId,
        name: name.trim(),
        conditions,
        logical_operator: logicalOp,
        lookahead_hours: lookaheadHours,
        polling_interval_hours: Math.max(pollingHours, limits.minPollingIntervalHours),
        cooldown_hours: cooldownHours,
      });
    } else {
      ok = await createRule({
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
    if (!ok) {
      Alert.alert('Save Failed', useAlertRulesStore.getState().error ?? 'Could not save. Please try again.');
      return;
    }
    router.back();
  };

  const screenTitle =
    mode === 'edit' ? 'Edit Alert Rule' :
    mode === 'clone' ? 'Clone Alert Rule' :
    'Custom Alert Rule';

  const saveButtonLabel =
    mode === 'edit' ? 'Save Changes' : 'Create Alert Rule';

  // BUG-004: Show spinner until rules + locations are both hydrated and the
  // form state has been seeded. Without this gate the form renders blank and
  // never updates because useState initialisers are one-shot.
  if (!ready || !formSeeded) {
    return (
      <>
        <Stack.Screen options={{ title: screenTitle, gestureEnabled: true, headerBackVisible: true }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={t.primary} />
        </View>
      </>
    );
  }

  return (
    <>
    <Stack.Screen options={{ title: screenTitle, gestureEnabled: true, headerBackVisible: true }} />
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
              <Text style={[styles.locationChipLabel, { color: selectedLocationId === loc.id ? t.primary : t.textSecondary }]}>
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
                style={[styles.logicalChip, { borderColor: t.border }, logicalOp === 'AND' && { backgroundColor: t.primary }]}
                onPress={() => setLogicalOp('AND')}
              >
                <Text style={[styles.chipLabelCaption, { color: logicalOp === 'AND' ? t.textOnPrimary : t.textSecondary }]}>AND</Text>
              </Pressable>
              <Pressable
                style={[styles.logicalChip, { borderColor: t.border }, logicalOp === 'OR' && { backgroundColor: t.primary }]}
                onPress={() => setLogicalOp('OR')}
              >
                <Text style={[styles.chipLabelCaption, { color: logicalOp === 'OR' ? t.textOnPrimary : t.textSecondary }]}>OR</Text>
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
                    <Text style={[styles.categoryChipLabel, { color: isActive ? t.primary : t.textTertiary }]}>
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
                    } else if (m.value === 'pressure_tendency') {
                      // Initialize with a sensible falling-pressure default so the
                      // direction UI starts in a meaningful state.
                      const unit = getUnitForMetric('pressure_tendency', temperatureUnit, pressureUnit);
                      const defaultDrop = pressureUnit === 'inHg' ? -0.24 : -8;
                      updateCondition(index, { metric: 'pressure_tendency', operator: 'lte', value: defaultDrop, unit });
                    } else {
                      // Reset from_bearing operator if switching away from wind_direction —
                      // from_bearing is invalid for every other metric.
                      const opOverride = condition.operator === 'from_bearing' ? { operator: 'lt' as const } : {};
                      updateCondition(index, { metric: m.value, unit: getUnitForMetric(m.value, temperatureUnit, pressureUnit), ...opOverride });
                    }
                  }}
                >
                  <Text style={[styles.chipLabelCaption, { color: condition.metric === m.value ? t.primary : t.textSecondary }]}>
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Operator selector — hidden for wind_direction and pressure_tendency (both use custom UIs) */}
            {condition.metric !== 'wind_direction' && condition.metric !== 'pressure_tendency' && (
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
                      <Text style={[styles.chipLabelCaption, { color: condition.operator === op.value ? t.primary : t.textSecondary }]}>
                        {op.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {/* Value input — label changes per metric; pressure_tendency uses its own inline labels */}
            {condition.metric !== 'pressure_tendency' && (
              <Text style={[styles.condLabel, { color: t.textTertiary }]}>
                {condition.metric === 'wind_direction' ? 'COMING FROM' : 'VALUE'}
              </Text>
            )}
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
                      <Text style={[styles.moonPresetLabel, { color: isSelected ? t.primary : t.textPrimary }]}>
                        {preset.label}
                      </Text>
                      <Text style={[styles.moonPresetDesc, { color: isSelected ? t.primary : t.textTertiary }]}>
                        {preset.description}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : condition.metric === 'pressure_tendency' ? (
              <>
                <Text style={[styles.condLabel, { color: t.textTertiary }]}>DIRECTION</Text>
                <View style={styles.chipRow}>
                  {([{ label: 'Falling ↓', falling: true }, { label: 'Rising ↑', falling: false }] as const).map(({ label, falling }) => {
                    const isSelected = falling ? condition.value <= 0 : condition.value > 0;
                    return (
                      <Pressable
                        key={label}
                        style={[
                          styles.chip,
                          { borderColor: isSelected ? t.primary : t.border },
                          isSelected && { backgroundColor: t.primaryLight },
                        ]}
                        onPress={() => {
                          const magnitude = Math.abs(condition.value) || (pressureUnit === 'inHg' ? 0.24 : 8);
                          updateCondition(index, {
                            value: falling ? -magnitude : magnitude,
                            operator: falling ? 'lte' : 'gte',
                          });
                        }}
                      >
                        <Text style={[styles.chipLabelCaption, { color: isSelected ? t.primary : t.textSecondary }]}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={[styles.condLabel, { color: t.textTertiary }]}>BY AT LEAST</Text>
                <View style={styles.valueRow}>
                  <NumericInput
                    style={[styles.valueInput, { backgroundColor: t.inputBackground, borderColor: t.border, color: t.textPrimary }]}
                    value={Math.abs(condition.value) || (pressureUnit === 'inHg' ? 0.24 : 8)}
                    onValueChange={(num) => {
                      const isFalling = condition.value <= 0;
                      updateCondition(index, { value: isFalling ? -num : num });
                    }}
                  />
                  <Text style={[styles.unitLabel, { color: t.textTertiary }]}>
                    {getUnitLabel(condition.unit)}
                  </Text>
                </View>
              </>
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
                        <Text
                          style={[
                            styles.compassLabel,
                            isSelected && styles.compassLabelSelected,
                            { color: isSelected ? t.primary : t.textSecondary },
                          ]}
                        >
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
                        <Text style={[styles.chipLabelCaption, { color: isSelected ? t.primary : t.textSecondary }]}>
                          {tol.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : (
              <View style={styles.valueRow}>
                <NumericInput
                  style={[styles.valueInput, { backgroundColor: t.inputBackground, borderColor: t.border, color: t.textPrimary }]}
                  value={condition.value}
                  onValueChange={(num) => updateCondition(index, { value: num })}
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
                {pressureUnit === 'inHg'
                  ? 'Normal sea level = 29.92 inHg. Typical range 28.64–30.71 inHg. Below 29.68 inHg may indicate approaching storm.'
                  : 'Normal sea level = 1013 hPa. Typical range 970–1040 hPa. Below 1005 hPa may indicate approaching storm.'}
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
                {pressureUnit === 'inHg'
                  ? 'How much pressure changes over the forecast window. Falls precede storms; rises indicate clearing. A drop of 0.24 inHg or more is a classic approaching-storm signal.'
                  : 'How much pressure changes over the forecast window. Falls precede storms; rises indicate clearing. A drop of 8 hPa or more is a classic approaching-storm signal.'}
              </Text>
            )}

            {/* Remove button */}
            {conditions.length > 1 && (
              <Pressable onPress={() => removeCondition(index)} style={styles.removeBtn}>
                <Text style={[styles.removeConditionText, { color: t.error }]}>Remove condition</Text>
              </Pressable>
            )}
          </View>
        </View>
      ))}

      <Pressable
        style={[styles.addCondBtn, { borderColor: t.primary }]}
        onPress={addCondition}
      >
        <Text style={[styles.addConditionText, { color: t.primary }]}>+ Add Condition</Text>
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
            <Text style={[styles.chipLabelCaption, { color: lookaheadHours === opt.hours ? t.primary : t.textSecondary }]}>
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
            <Text style={[styles.chipLabelCaption, { color: pollingHours === h ? t.primary : t.textSecondary }]}>
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
            <Text style={[styles.chipLabelCaption, { color: cooldownHours === opt.hours ? t.primary : t.textSecondary }]}>
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
              const found = METRICS.find((m) => m.value === c.metric);
              const metric = found?.summaryLabel ?? found?.label?.toLowerCase() ?? c.metric;
              if (c.metric === 'wind_direction') {
                const dir = COMPASS_DIRECTIONS.find((d) => d.value === c.value)?.label ?? `${c.value}°`;
                return `the wind comes from ${dir} (±${c.tolerance ?? 45}°)`;
              }
              if (c.metric === 'pressure_tendency') {
                const direction = c.value < 0 ? 'drops' : 'rises';
                const magnitude = Math.abs(c.value);
                const ptUnit = getUnitLabel(c.unit);
                return `the pressure ${direction} by at least ${magnitude}${ptUnit ? ' ' + ptUnit : ''}`;
              }
              const op = OPERATORS.find((o) => o.value === c.operator)?.label ?? 'matches';
              const unitLabel = getUnitLabel(c.unit);
              const valueDisplay = c.metric === 'moon_phase'
                ? nearestMoonPhasePreset(c.value).label
                : c.metric === 'weather_code'
                ? `${weatherCodeToEmoji(c.value)} ${weatherCodeLabel(c.value)} (WMO ${c.value})`
                : `${c.value}${unitLabel ? ' ' + unitLabel : ''}`;
              return `the ${metric} is ${op} ${valueDisplay}`;
            });

            const condSentence = condParts.length === 1
              ? condParts[0]
              : condParts.slice(0, -1).join(', ') + (logicalOp === 'AND' ? ' and ' : ' or ') + condParts[condParts.length - 1];

            // Lookahead in plain words — '1 day' label reads poorly as "in the next 1 day"
            const lookaheadProseMap: Record<number, string> = { 24: 'day', 48: '2 days', 72: '3 days', 120: '5 days', 168: '7 days' };
            const lookahead = lookaheadProseMap[lookaheadHours] ?? LOOKAHEAD_OPTIONS.find((o) => o.hours === lookaheadHours)?.label ?? `${lookaheadHours} hours`;

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
        <Text style={[styles.cancelText, { color: t.textTertiary }]}>Cancel</Text>
      </Pressable>
    </ScrollView>
    </>
  );
}

// Colour is intentionally unused here — every colour value in this screen is
// still resolved inline from `useTokens()` at the call site (selection-state
// ternaries choose between existing colour tokens, none of which changed).
// This factory only collapses the structural (size/weight/spacing) literals
// onto the shared look. Keeping the `(c, look)` signature matches the rest of
// the migrated screens even though `c` isn't referenced.
const createStyles = (_c: ThemeTokens, look: LookTokens) => ({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
  content: { padding: look.spacing.xl, paddingBottom: look.spacing.xxxl, maxWidth: 640, alignSelf: 'center' as const, width: '100%' as const },
  title: { fontSize: look.typography.title.size, fontWeight: look.typography.title.weight, marginBottom: 20 },
  label: {
    fontSize: look.typography.label.size,
    fontWeight: look.typography.label.weight,
    letterSpacing: look.typography.label.tracking,
    marginTop: 20,
    marginBottom: 4,
  },
  helperText: { fontSize: look.typography.caption.size, lineHeight: look.typography.caption.lineHeight, marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderRadius: look.radius.surface,
    paddingVertical: look.spacing.lg,
    paddingHorizontal: look.spacing.lg,
    fontSize: look.typography.heading.size,
  },
  chipRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: look.spacing.sm },
  chip: {
    borderWidth: 1,
    borderRadius: look.radius.surface,
    paddingVertical: look.spacing.sm,
    paddingHorizontal: look.spacing.lg,
  },
  // Chip label text where only the colour varies by selection — fontSize 13
  // across every one of these sites (metric, operator, AND/OR, pressure
  // direction, bearing tolerance, lookahead, polling, cooldown chips).
  chipLabelCaption: { fontSize: look.typography.caption.size },
  locationChipLabel: { fontSize: look.typography.body.size },
  categoryChipLabel: { fontSize: look.typography.label.size, fontWeight: look.typography.label.weight },
  moonChip: {
    paddingVertical: look.spacing.md,
    paddingHorizontal: look.spacing.lg,
    alignItems: 'center' as const,
    minWidth: 100,
  },
  moonPresetLabel: { fontSize: look.typography.bodyStrong.size, fontWeight: look.typography.bodyStrong.weight },
  moonPresetDesc: { fontSize: look.typography.label.size },
  categoryChip: {
    paddingVertical: look.spacing.xs,
    paddingHorizontal: look.spacing.md,
  },
  conditionCard: {
    borderWidth: 1,
    borderRadius: look.radius.surface,
    padding: look.spacing.lg,
    marginBottom: 8,
  },
  condLabel: {
    fontSize: look.typography.label.size,
    fontWeight: look.typography.label.weight,
    letterSpacing: look.typography.label.tracking,
    marginTop: 12,
    marginBottom: 6,
  },
  valueRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: look.spacing.md },
  valueInput: {
    borderWidth: 1,
    borderRadius: look.radius.surface,
    paddingVertical: look.spacing.md,
    paddingHorizontal: look.spacing.lg,
    fontSize: look.typography.heading.size,
    fontWeight: look.typography.heading.weight,
    width: 100,
    textAlign: 'center' as const,
  },
  unitLabel: { fontSize: look.typography.heading.size },
  metricHelperText: { fontSize: look.typography.label.size, lineHeight: look.typography.label.lineHeight, marginTop: 8 },
  removeBtn: { marginTop: 12, alignItems: 'flex-end' as const },
  removeConditionText: { fontSize: look.typography.body.size },
  addConditionText: { fontSize: look.typography.body.size },
  logicalRow: { flexDirection: 'row' as const, justifyContent: 'center' as const, gap: look.spacing.sm, marginVertical: 8 },
  logicalChip: {
    borderRadius: look.radius.surface,
    paddingVertical: look.spacing.sm,
    paddingHorizontal: look.spacing.lg,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  // Wind-direction compass label: fontSize is constant, but fontWeight is
  // selection-driven ('700' when selected, '400' otherwise in the original).
  // Split into a base + selected override so the ternary lives in the JSX
  // style array instead of inside a literal object. bodyStrong is the closest
  // token weight to the original bold '700' (both looks define it as '600').
  compassLabel: { fontSize: look.typography.body.size, fontWeight: look.typography.body.weight },
  compassLabelSelected: { fontWeight: look.typography.bodyStrong.weight },
  addCondBtn: {
    borderWidth: 1,
    borderRadius: look.radius.surface,
    paddingVertical: look.spacing.lg,
    alignItems: 'center' as const,
    marginTop: 12,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: look.radius.surface,
    padding: look.spacing.lg,
    marginTop: 24,
  },
  summaryTitle: { fontSize: look.typography.heading.size, fontWeight: look.typography.heading.weight, marginBottom: 8 },
  summaryText: { fontSize: look.typography.body.size, lineHeight: look.typography.body.lineHeight },
  saveBtn: {
    paddingVertical: look.spacing.lg,
    borderRadius: look.radius.surface,
    alignItems: 'center' as const,
    marginTop: 20,
  },
  saveBtnText: { fontSize: look.typography.heading.size, fontWeight: look.typography.heading.weight },
  cancelBtn: { alignItems: 'center' as const, paddingVertical: look.spacing.lg },
  cancelText: { fontSize: look.typography.heading.size },
});
