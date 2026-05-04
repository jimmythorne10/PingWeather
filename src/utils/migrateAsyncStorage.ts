import AsyncStorage from '@react-native-async-storage/async-storage';

const MIGRATION_FLAG = 'pingweather-migration-v1-done';

/**
 * Maps each old "weatherwatch-*" AsyncStorage key to its new "pingweather-*"
 * counterpart. Add new pairs here if additional keys are ever renamed.
 */
const KEY_RENAMES: [string, string][] = [
  ['weatherwatch-alert-rules', 'pingweather-alert-rules'],
  ['weatherwatch-locations', 'pingweather-locations'],
  ['weatherwatch-settings', 'pingweather-settings'],
  ['weatherwatch-theme', 'pingweather-theme'],
];

/**
 * One-time migration that reads every old "weatherwatch-*" AsyncStorage key
 * and writes the value under the new "pingweather-*" key before removing the
 * old key. A migration-complete flag prevents this from running more than once.
 *
 * - Safe to call before Zustand store hydration.
 * - Non-fatal: any AsyncStorage error is silently swallowed so the app
 *   continues loading with fresh state rather than crashing.
 * - Idempotent: once the flag is set, subsequent calls return immediately.
 * - Conservative: will not overwrite a new key that already exists (fresh
 *   installs must not lose data written under the new key name).
 */
export async function runAsyncStorageMigration(): Promise<void> {
  try {
    const done = await AsyncStorage.getItem(MIGRATION_FLAG);
    if (done === 'true') return;

    await Promise.all(
      KEY_RENAMES.map(async ([oldKey, newKey]) => {
        const value = await AsyncStorage.getItem(oldKey);
        if (value !== null) {
          const existingNew = await AsyncStorage.getItem(newKey);
          if (existingNew === null) {
            // Only migrate when the new key slot is empty — never overwrite a
            // fresh install that already has data under the new key name.
            await AsyncStorage.setItem(newKey, value);
          }
          await AsyncStorage.removeItem(oldKey);
        }
      }),
    );

    await AsyncStorage.setItem(MIGRATION_FLAG, 'true');
  } catch {
    // Migration failure is non-fatal — app continues with fresh state.
  }
}
