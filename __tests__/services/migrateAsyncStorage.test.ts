import AsyncStorage from '@react-native-async-storage/async-storage';
import { runAsyncStorageMigration } from '../../src/utils/migrateAsyncStorage';

const MIGRATION_FLAG = 'pingweather-migration-v1-done';

// The mock is an in-memory Map; clear it before each test so state doesn't bleed.
beforeEach(async () => {
  await AsyncStorage.clear();
  // Clear jest mock call history too so call-count assertions are per-test.
  jest.clearAllMocks();
});

describe('runAsyncStorageMigration', () => {
  it('migrates old key to new key when old key exists and new key does not', async () => {
    await AsyncStorage.setItem('weatherwatch-settings', '{"temperatureUnit":"F"}');

    await runAsyncStorageMigration();

    const newValue = await AsyncStorage.getItem('pingweather-settings');
    expect(newValue).toBe('{"temperatureUnit":"F"}');
  });

  it('does NOT overwrite new key when both old and new keys already exist', async () => {
    await AsyncStorage.setItem('weatherwatch-theme', '"dark"');
    await AsyncStorage.setItem('pingweather-theme', '"light"');

    await runAsyncStorageMigration();

    // New key must remain the winner.
    const newValue = await AsyncStorage.getItem('pingweather-theme');
    expect(newValue).toBe('"light"');
  });

  it('removes the old key after migration', async () => {
    await AsyncStorage.setItem('weatherwatch-locations', '[{"id":"1"}]');

    await runAsyncStorageMigration();

    const oldValue = await AsyncStorage.getItem('weatherwatch-locations');
    expect(oldValue).toBeNull();
  });

  it('sets the migration flag after successful migration', async () => {
    await runAsyncStorageMigration();

    const flag = await AsyncStorage.getItem(MIGRATION_FLAG);
    expect(flag).toBe('true');
  });

  it('skips all migration work when flag is already set', async () => {
    await AsyncStorage.setItem(MIGRATION_FLAG, 'true');
    // Plant an old key to prove it is not touched.
    await AsyncStorage.setItem('weatherwatch-alert-rules', '[]');

    await runAsyncStorageMigration();

    // Old key must still be there — migration must have no-op'd.
    const oldValue = await AsyncStorage.getItem('weatherwatch-alert-rules');
    expect(oldValue).toBe('[]');
    // New key must NOT have been written.
    const newValue = await AsyncStorage.getItem('pingweather-alert-rules');
    expect(newValue).toBeNull();
  });

  it('is idempotent — calling twice produces the same final state', async () => {
    await AsyncStorage.setItem('weatherwatch-settings', '{"temperatureUnit":"C"}');

    await runAsyncStorageMigration();
    await runAsyncStorageMigration();

    const newValue = await AsyncStorage.getItem('pingweather-settings');
    expect(newValue).toBe('{"temperatureUnit":"C"}');
    const oldValue = await AsyncStorage.getItem('weatherwatch-settings');
    expect(oldValue).toBeNull();
  });

  it('does not throw when AsyncStorage.getItem rejects', async () => {
    jest
      .spyOn(AsyncStorage, 'getItem')
      .mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(runAsyncStorageMigration()).resolves.toBeUndefined();
  });

  it('migrates all four store keys in a single pass', async () => {
    await AsyncStorage.setItem('weatherwatch-alert-rules', '[{"id":"r1"}]');
    await AsyncStorage.setItem('weatherwatch-locations', '[{"id":"l1"}]');
    await AsyncStorage.setItem('weatherwatch-settings', '{"temperatureUnit":"F"}');
    await AsyncStorage.setItem('weatherwatch-theme', '"storm"');

    await runAsyncStorageMigration();

    expect(await AsyncStorage.getItem('pingweather-alert-rules')).toBe('[{"id":"r1"}]');
    expect(await AsyncStorage.getItem('pingweather-locations')).toBe('[{"id":"l1"}]');
    expect(await AsyncStorage.getItem('pingweather-settings')).toBe('{"temperatureUnit":"F"}');
    expect(await AsyncStorage.getItem('pingweather-theme')).toBe('"storm"');
  });
});
