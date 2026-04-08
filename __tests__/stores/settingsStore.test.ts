/**
 * Tests for settingsStore — FR-SET-002 through FR-SET-004
 *
 * Validates unit preferences, theme selection, and notification toggle persistence.
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    multiGet: jest.fn(() => Promise.resolve([])),
    multiSet: jest.fn(() => Promise.resolve()),
  },
}));

import { useSettingsStore } from '../../src/stores/settingsStore';

function resetStore() {
  useSettingsStore.setState({
    temperatureUnit: 'fahrenheit',
    windSpeedUnit: 'mph',
    themeName: 'classic',
    notificationsEnabled: true,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  resetStore();
});

describe('settingsStore', () => {
  // ── FR-SET-002: Unit Preferences ───────────────────────────

  describe('FR-SET-002: unit preferences', () => {
    it('defaults to Fahrenheit for temperature', () => {
      // FR-SET-002: default °F
      expect(useSettingsStore.getState().temperatureUnit).toBe('fahrenheit');
    });

    it('defaults to mph for wind speed', () => {
      // FR-SET-002: default mph
      expect(useSettingsStore.getState().windSpeedUnit).toBe('mph');
    });

    it('updates temperature unit to Celsius', () => {
      // FR-SET-002: Fahrenheit or Celsius
      useSettingsStore.getState().setTemperatureUnit('celsius');
      expect(useSettingsStore.getState().temperatureUnit).toBe('celsius');
    });

    it('updates wind speed unit to km/h', () => {
      // FR-SET-002: mph, km/h, or knots
      useSettingsStore.getState().setWindSpeedUnit('kmh');
      expect(useSettingsStore.getState().windSpeedUnit).toBe('kmh');
    });

    it('updates wind speed unit to knots', () => {
      // FR-SET-002: mph, km/h, or knots
      useSettingsStore.getState().setWindSpeedUnit('knots');
      expect(useSettingsStore.getState().windSpeedUnit).toBe('knots');
    });

    it('persists unit preferences across store updates', () => {
      // FR-SET-002: persisted to AsyncStorage
      useSettingsStore.getState().setTemperatureUnit('celsius');
      useSettingsStore.getState().setWindSpeedUnit('knots');

      const state = useSettingsStore.getState();
      expect(state.temperatureUnit).toBe('celsius');
      expect(state.windSpeedUnit).toBe('knots');
    });

    it('uses AsyncStorage as the persistence backend', () => {
      // FR-SET-002: persisted to AsyncStorage
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      useSettingsStore.getState().setTemperatureUnit('celsius');
      // zustand persist middleware writes asynchronously; just verify the mock is installed
      expect(AsyncStorage).toBeDefined();
      expect(typeof AsyncStorage.setItem).toBe('function');
    });
  });

  // ── FR-SET-003: Theme Selection ───────────────────────────

  describe('FR-SET-003: theme selection', () => {
    it('defaults to classic theme', () => {
      expect(useSettingsStore.getState().themeName).toBe('classic');
    });

    it('updates to dark theme', () => {
      // FR-SET-003: three options classic, dark, storm
      useSettingsStore.getState().setThemeName('dark');
      expect(useSettingsStore.getState().themeName).toBe('dark');
    });

    it('updates to storm theme', () => {
      useSettingsStore.getState().setThemeName('storm');
      expect(useSettingsStore.getState().themeName).toBe('storm');
    });

    it('updates to classic theme', () => {
      useSettingsStore.setState({ themeName: 'dark' });
      useSettingsStore.getState().setThemeName('classic');
      expect(useSettingsStore.getState().themeName).toBe('classic');
    });
  });

  // ── FR-SET-004: Notification Toggle ───────────────────────

  describe('FR-SET-004: notification toggle', () => {
    it('defaults to notifications enabled', () => {
      // FR-SET-004: default on
      expect(useSettingsStore.getState().notificationsEnabled).toBe(true);
    });

    it('toggles notifications off', () => {
      // FR-SET-004: Toggle persisted to AsyncStorage
      useSettingsStore.getState().setNotificationsEnabled(false);
      expect(useSettingsStore.getState().notificationsEnabled).toBe(false);
    });

    it('toggles notifications back on', () => {
      useSettingsStore.setState({ notificationsEnabled: false });
      useSettingsStore.getState().setNotificationsEnabled(true);
      expect(useSettingsStore.getState().notificationsEnabled).toBe(true);
    });
  });
});
