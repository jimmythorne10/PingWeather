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
let mockThemeState: any = { themeName: 'classic', setTheme: mockSetTheme };

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
  const tokens: any = new Proxy({}, { get: () => '#000' });
  return {
    useTokens: () => tokens,
    useStyles: (factory: any) => factory(tokens),
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
    mockThemeState = { themeName: 'classic', setTheme: mockSetTheme };
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

  // FR-SET-003: theme selector with 3 options
  it('shows 3 theme options', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('Classic')).toBeTruthy();
    expect(screen.getByText('Dark')).toBeTruthy();
    expect(screen.getByText('Storm')).toBeTruthy();
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

  // FR-SET-007: version display as "PingWeather v{version}"
  it('shows PingWeather version string', () => {
    render(<SettingsScreen />);
    expect(screen.getByText(/PingWeather v\d/)).toBeTruthy();
  });

  // FR-SET-008: developer mode (tap version 7 times) (TDD — not implemented)
  it('activates developer mode after 7 taps on version', () => {
    render(<SettingsScreen />);
    const version = screen.getByText(/PingWeather v\d/);
    for (let i = 0; i < 7; i++) fireEvent.press(version);
    expect(screen.getByText(/Developer Options/i)).toBeTruthy();
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
