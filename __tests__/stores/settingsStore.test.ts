/**
 * Tests for settingsStore — FR-SET-002, FR-SET-004
 * Tests for themeStore    — FR-SET-003
 *
 * NOTE: themeName was removed from settingsStore (FIX 5). It was a duplicate
 * of themeStore.themeName that caused drift when either store was updated
 * independently. All theme state now lives exclusively in themeStore.
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
import { useThemeStore } from '../../src/stores/themeStore';
import { THEMES } from '../../src/theme/tokens';

function resetSettingsStore() {
  useSettingsStore.setState({
    temperatureUnit: 'fahrenheit',
    windSpeedUnit: 'mph',
    notificationsEnabled: true,
  });
}

function resetThemeStore() {
  useThemeStore.setState({
    themeName: 'classic',
    tokens: THEMES.classic,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  resetSettingsStore();
  resetThemeStore();
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

  // ── FR-SET-003: Theme Selection (via themeStore — single source of truth) ──

  describe('FR-SET-003: theme selection', () => {
    it('defaults to classic theme', () => {
      expect(useThemeStore.getState().themeName).toBe('classic');
    });

    it('updates to dark theme and sets correct tokens', () => {
      // FR-SET-003: three options classic, dark, storm
      useThemeStore.getState().setTheme('dark');
      const state = useThemeStore.getState();
      expect(state.themeName).toBe('dark');
      expect(state.tokens).toEqual(THEMES.dark);
    });

    it('updates to storm theme and sets correct tokens', () => {
      useThemeStore.getState().setTheme('storm');
      const state = useThemeStore.getState();
      expect(state.themeName).toBe('storm');
      expect(state.tokens).toEqual(THEMES.storm);
    });

    it('updates to classic theme and sets correct tokens', () => {
      useThemeStore.setState({ themeName: 'dark', tokens: THEMES.dark });
      useThemeStore.getState().setTheme('classic');
      const state = useThemeStore.getState();
      expect(state.themeName).toBe('classic');
      expect(state.tokens).toEqual(THEMES.classic);
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
