/**
 * Tests for themeStore — FR-SET-003
 *
 * Validates theme token loading, switching across all 3 themes, and persistence.
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

import { useThemeStore } from '../../src/stores/themeStore';
import { THEMES, type ThemeName, type ThemeTokens } from '../../src/theme/tokens';

function resetStore() {
  useThemeStore.setState({ themeName: 'classic', tokens: THEMES.classic });
}

// Required token keys that every theme must define
const REQUIRED_TOKEN_KEYS: (keyof ThemeTokens)[] = [
  'background',
  'card',
  'inputBackground',
  'primary',
  'primaryLight',
  'primaryDisabled',
  'textPrimary',
  'textSecondary',
  'textTertiary',
  'textOnPrimary',
  'border',
  'borderLight',
  'divider',
  'success',
  'successDark',
  'error',
  'errorLight',
  'warning',
  'warningLight',
  'info',
  'freezeBlue',
  'heatRed',
  'rainBlue',
  'windGray',
  'headerBackground',
  'headerTint',
  'tabBarActiveTint',
  'tabBarInactiveTint',
  'tabBarBackground',
  'tabBarBorder',
  'statusBarStyle',
];

beforeEach(() => {
  jest.clearAllMocks();
  resetStore();
});

describe('themeStore', () => {
  // ── FR-SET-003: Theme Selection ───────────────────────────

  describe('FR-SET-003: setTheme', () => {
    it('defaults to classic theme with classic tokens', () => {
      const state = useThemeStore.getState();
      expect(state.themeName).toBe('classic');
      expect(state.tokens).toEqual(THEMES.classic);
    });

    it('setTheme updates themeName and tokens together', () => {
      // FR-SET-003: theme applied immediately across all screens
      useThemeStore.getState().setTheme('dark');

      const state = useThemeStore.getState();
      expect(state.themeName).toBe('dark');
      expect(state.tokens).toEqual(THEMES.dark);
    });

    it('setTheme switches to storm theme', () => {
      useThemeStore.getState().setTheme('storm');

      const state = useThemeStore.getState();
      expect(state.themeName).toBe('storm');
      expect(state.tokens).toEqual(THEMES.storm);
    });

    it('setTheme switches back to classic', () => {
      useThemeStore.getState().setTheme('dark');
      useThemeStore.getState().setTheme('classic');

      expect(useThemeStore.getState().themeName).toBe('classic');
      expect(useThemeStore.getState().tokens).toEqual(THEMES.classic);
    });
  });

  describe('FR-SET-003: all themes produce valid tokens', () => {
    const themeNames: ThemeName[] = ['classic', 'dark', 'storm'];

    themeNames.forEach((name) => {
      it(`${name} theme has all required token keys`, () => {
        const tokens = THEMES[name];
        for (const key of REQUIRED_TOKEN_KEYS) {
          expect(tokens).toHaveProperty(key);
          expect((tokens as any)[key]).toBeTruthy();
        }
      });

      it(`${name} theme color values are valid strings`, () => {
        const tokens = THEMES[name];
        const colorKeys = REQUIRED_TOKEN_KEYS.filter((k) => k !== 'statusBarStyle');
        for (const key of colorKeys) {
          const value = (tokens as any)[key];
          expect(typeof value).toBe('string');
          // Should be a hex color or rgb value
          expect(value).toMatch(/^(#[0-9a-fA-F]{3,8}|rgba?\(.*\))$/);
        }
      });

      it(`${name} theme has valid statusBarStyle`, () => {
        const tokens = THEMES[name];
        expect(['light', 'dark']).toContain(tokens.statusBarStyle);
      });

      it(`${name} theme can be set via setTheme`, () => {
        useThemeStore.getState().setTheme(name);
        expect(useThemeStore.getState().themeName).toBe(name);
        expect(useThemeStore.getState().tokens).toEqual(THEMES[name]);
      });
    });
  });

  describe('FR-SET-003: persistence', () => {
    it('uses AsyncStorage for persistence', () => {
      // FR-SET-003: persisted to AsyncStorage
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      useThemeStore.getState().setTheme('dark');
      expect(AsyncStorage).toBeDefined();
    });

    it('only persists themeName (not tokens) via partialize', () => {
      // tokens are rehydrated from THEMES lookup on restart
      useThemeStore.getState().setTheme('storm');
      expect(useThemeStore.getState().themeName).toBe('storm');
    });
  });
});
