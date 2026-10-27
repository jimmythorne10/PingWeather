// Tests for Settings screen
// Covers: FR-SET-001 through FR-SET-010
// ────────────────────────────────────────────────────────────

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { mockProfile } from '../helpers/mocks';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useSegments: () => [],
  useLocalSearchParams: () => ({}),
}));

const mockSignOut = jest.fn();
let mockAuthState: any = { profile: mockProfile({ email: 'me@test.com' }), signOut: mockSignOut };
const settingsActions = {
  setTemperatureUnit: jest.fn(),
  setWindSpeedUnit: jest.fn(),
  setNotificationsEnabled: jest.fn(),
};
let mockSettingsState: any = {
  temperatureUnit: 'fahrenheit',
  windSpeedUnit: 'mph',
  notificationsEnabled: true,
  ...settingsActions,
};
const mockSetTheme = jest.fn();
const mockSetLook = jest.fn();
const mockSetPalette = jest.fn();
// The store now carries TWO axes: `look` is structure (and `tokens` holds its
// values), `palette` is colour (and `colors` holds its values). The screen
// reads both, so the mock has to supply both or every render throws.
const { LOOKS } = jest.requireActual('../../src/theme/looks');
const { PALETTES } = jest.requireActual('../../src/theme/palettes');
let mockThemeState: any = {
  look: 'classic',
  palette: 'classic',
  tokens: LOOKS.classic,
  colors: PALETTES.classic,
  themeName: 'classic',
  setLook: mockSetLook,
  setPalette: mockSetPalette,
  setTheme: mockSetTheme,
};

jest.mock('../../src/stores/authStore', () => ({
  useAuthStore: (selector?: any) => (selector ? selector(mockAuthState) : mockAuthState),
}));
jest.mock('../../src/stores/settingsStore', () => ({
  useSettingsStore: (selector?: any) => (selector ? selector(mockSettingsState) : mockSettingsState),
}));
jest.mock('../../src/stores/themeStore', () => ({
  useThemeStore: (selector?: any) => (selector ? selector(mockThemeState) : mockThemeState),
}));

jest.mock('../../src/theme', () => {
  // Colours can stay a blanket proxy — this suite asserts text, not colour.
  // STRUCTURE cannot: factories now read look.spacing.lg, look.typography.*.size
  // and so on, so a proxy returning '#000' makes every arithmetic style NaN and
  // every nested read throw. Hand the factory the REAL classic look tokens.
  const colors: any = new Proxy({}, { get: () => '#000' });
  const { LOOKS: REAL_LOOKS } = jest.requireActual('../../src/theme/looks');
  return {
    useTokens: () => colors,
    useColors: () => colors,
    useLook: () => REAL_LOOKS.classic,
    useStyles: (factory: any) => factory(colors, REAL_LOOKS.classic),
  };
});

import SettingsScreen from '../../app/(tabs)/settings';

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState = { profile: mockProfile({ email: 'me@test.com' }), signOut: mockSignOut };
    mockSettingsState = {
      temperatureUnit: 'fahrenheit',
      windSpeedUnit: 'mph',
      notificationsEnabled: true,
      ...settingsActions,
    };
    mockThemeState = {
    look: 'classic',
    palette: 'classic',
    tokens: LOOKS.classic,
    colors: PALETTES.classic,
    themeName: 'classic',
    setLook: mockSetLook,
    setPalette: mockSetPalette,
    setTheme: mockSetTheme,
  };
  });

  // FR-SET-001: account email and tier shown
  it('displays account email and tier', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('me@test.com')).toBeTruthy();
    expect(screen.getByText('Free')).toBeTruthy();
  });

  // FR-SET-002: unit toggles present
  it('shows temperature unit toggles', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('°F')).toBeTruthy();
    expect(screen.getByText('°C')).toBeTruthy();
  });

  it('shows wind speed unit toggles', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('mph')).toBeTruthy();
    expect(screen.getByText('kmh')).toBeTruthy();
    expect(screen.getByText('knots')).toBeTruthy();
  });

  // FR-SET-003: the palette list is now SCOPED TO THE LOOK (FEAT-003), so the
  // old flat "always 3 options" assertion no longer describes the screen. Under
  // `classic` the three shipped palettes are offered; under `aurora` they must
  // NOT be, because a light palette against dark proportions is the exact
  // failure the look/palette pairing exists to prevent.
  it('offers the three classic palettes while the look is classic', () => {
    render(<SettingsScreen />);
    // "Classic" is both a look (segment) and a palette (row) — expect both.
    expect(screen.getAllByText('Classic')).toHaveLength(2);
    expect(screen.getByText('Dark')).toBeTruthy();
    expect(screen.getByText('Storm')).toBeTruthy();
  });

  it('offers only the aurora palettes while the look is aurora', () => {
    mockThemeState = {
      ...mockThemeState,
      look: 'aurora',
      palette: 'timber',
      tokens: LOOKS.aurora,
      colors: PALETTES.timber,
    };
    render(<SettingsScreen />);
    expect(screen.getByText('Timber')).toBeTruthy();
    expect(screen.getByText('Blaze')).toBeTruthy();
    expect(screen.queryByText('Storm')).toBeNull();
  });

  // FR-SET-004: notification toggle
  it('shows notifications toggle', () => {
    render(<SettingsScreen />);
    expect(screen.getByText(/Push Notifications/)).toBeTruthy();
  });

  // FR-SET-005: legal doc links
  it('shows Terms of Use and Privacy Policy links', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('Terms of Use')).toBeTruthy();
    expect(screen.getByText('Privacy Policy')).toBeTruthy();
  });

  // FR-SET-006: alert history link (TDD — not implemented)
  it('shows Alert History link', () => {
    render(<SettingsScreen />);
    expect(screen.getByText(/Alert History/i)).toBeTruthy();
  });

  // FR-SET-007: version display as "WeatherBeacon v{version}"
  it('shows WeatherBeacon version string', () => {
    render(<SettingsScreen />);
    expect(screen.getByText(/WeatherBeacon v\d/)).toBeTruthy();
  });

  // FR-SET-009: delete account button (TDD — not implemented)
  it('shows Delete Account button', () => {
    render(<SettingsScreen />);
    expect(screen.getByText(/Delete Account/i)).toBeTruthy();
  });

  // FR-SET-010: sign out button
  it('shows Sign Out button', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('Sign Out')).toBeTruthy();
  });

  // FR-SET-010: sign out should ask for confirmation (TDD — not implemented)
  it('shows confirmation dialog before signing out', () => {
    const AlertModule = require('react-native').Alert;
    const alertSpy = jest.spyOn(AlertModule, 'alert');
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Sign Out'));
    expect(alertSpy).toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
