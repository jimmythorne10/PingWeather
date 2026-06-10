/**
 * DATA-001: Verify AsyncStorage migration + store persist key alignment
 *
 * The bug: migrateAsyncStorage.ts copies weatherwatch-* keys to pingweather-*
 * and deletes the originals, but the stores declared persist name: 'weatherwatch-*'.
 * After migration the new key has the data, but Zustand hydrates from the now-empty
 * old key -> silent permanent data loss for upgrading users.
 *
 * This test MUST FAIL before the rename (stores still point at weatherwatch-*)
 * and PASS after (stores point at pingweather-*).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { runAsyncStorageMigration } from '../../src/utils/migrateAsyncStorage';
import { useAlertRulesStore } from '../../src/stores/alertRulesStore';
import { useLocationsStore } from '../../src/stores/locationsStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useThemeStore } from '../../src/stores/themeStore';

beforeEach(async () => {
  // Clear AsyncStorage between tests so migration flag doesn't leak
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('DATA-001: AsyncStorage migration key alignment', () => {
  it('migration moves value from weatherwatch-alert-rules to pingweather-alert-rules', async () => {
    const testValue = JSON.stringify({ state: { rules: [{ id: 'rule-1' }] }, version: 0 });
    await AsyncStorage.setItem('weatherwatch-alert-rules', testValue);

    await runAsyncStorageMigration();

    const migratedValue = await AsyncStorage.getItem('pingweather-alert-rules');
    const oldValue = await AsyncStorage.getItem('weatherwatch-alert-rules');

    expect(migratedValue).toBe(testValue);
    expect(oldValue).toBeNull();
  });

  it('alertRulesStore persist name is pingweather-alert-rules (hydrates from migrated key)', () => {
    // This assertion FAILS before the fix: name is 'weatherwatch-alert-rules'
    // After fix: name is 'pingweather-alert-rules' — Zustand reads from the right slot
    const persistName = useAlertRulesStore.persist.getOptions().name;
    expect(persistName).toBe('pingweather-alert-rules');
  });

  it('locationsStore persist name is pingweather-locations', () => {
    const persistName = useLocationsStore.persist.getOptions().name;
    expect(persistName).toBe('pingweather-locations');
  });

  it('settingsStore persist name is pingweather-settings', () => {
    const persistName = useSettingsStore.persist.getOptions().name;
    expect(persistName).toBe('pingweather-settings');
  });

  it('themeStore persist name is pingweather-theme', () => {
    const persistName = useThemeStore.persist.getOptions().name;
    expect(persistName).toBe('pingweather-theme');
  });

  it('end-to-end: data written under old key is readable under new key after migration', async () => {
    // Simulate upgrading user: has data in old weatherwatch-* slots
    const rulesData = JSON.stringify({ state: { rules: [{ id: 'rule-99', name: 'Freeze' }] }, version: 0 });
    const locationsData = JSON.stringify({ state: { locations: [{ id: 'loc-99', name: 'Home' }] }, version: 0 });
    const settingsData = JSON.stringify({ state: { temperatureUnit: 'celsius', windSpeedUnit: 'kmh', notificationsEnabled: true }, version: 0 });
    const themeData = JSON.stringify({ state: { themeName: 'dark' }, version: 0 });

    await AsyncStorage.setItem('weatherwatch-alert-rules', rulesData);
    await AsyncStorage.setItem('weatherwatch-locations', locationsData);
    await AsyncStorage.setItem('weatherwatch-settings', settingsData);
    await AsyncStorage.setItem('weatherwatch-theme', themeData);

    await runAsyncStorageMigration();

    // After migration, data must be under the new keys (where the stores now hydrate from)
    expect(await AsyncStorage.getItem('pingweather-alert-rules')).toBe(rulesData);
    expect(await AsyncStorage.getItem('pingweather-locations')).toBe(locationsData);
    expect(await AsyncStorage.getItem('pingweather-settings')).toBe(settingsData);
    expect(await AsyncStorage.getItem('pingweather-theme')).toBe(themeData);

    // Old keys must be gone
    expect(await AsyncStorage.getItem('weatherwatch-alert-rules')).toBeNull();
    expect(await AsyncStorage.getItem('weatherwatch-locations')).toBeNull();
    expect(await AsyncStorage.getItem('weatherwatch-settings')).toBeNull();
    expect(await AsyncStorage.getItem('weatherwatch-theme')).toBeNull();
  });
});
