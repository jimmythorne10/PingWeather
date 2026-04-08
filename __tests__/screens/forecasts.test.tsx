// Tests for Forecasts screen (replaces History tab per PRD)
// Covers: FR-FORECAST-001 through FR-FORECAST-004
// NOTE: This screen does not yet exist. Tests are written against PRD spec.
// All tests should fail until the feature is implemented.
// ────────────────────────────────────────────────────────────

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { mockProfile, mockLocation, mockRule, mockHistoryEntry } from '../helpers/mocks';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useSegments: () => [],
  useLocalSearchParams: () => ({}),
}));

let authState: any = { profile: mockProfile() };
let locationsState: any = { locations: [mockLocation()], loadLocations: jest.fn() };
let rulesState: any = { rules: [], loadRules: jest.fn() };
let historyState: any = { entries: [], loadHistory: jest.fn() };
let settingsState: any = { temperatureUnit: 'fahrenheit', windSpeedUnit: 'mph' };

jest.mock('../../src/stores/authStore', () => ({
  useAuthStore: (selector?: any) => (selector ? selector(authState) : authState),
}));
jest.mock('../../src/stores/locationsStore', () => ({
  useLocationsStore: (selector?: any) => (selector ? selector(locationsState) : locationsState),
}));
jest.mock('../../src/stores/alertRulesStore', () => ({
  useAlertRulesStore: (selector?: any) => (selector ? selector(rulesState) : rulesState),
}));
jest.mock('../../src/stores/alertHistoryStore', () => ({
  useAlertHistoryStore: (selector?: any) => (selector ? selector(historyState) : historyState),
}));
jest.mock('../../src/stores/settingsStore', () => ({
  useSettingsStore: (selector?: any) => (selector ? selector(settingsState) : settingsState),
}));

jest.mock('../../src/services/weatherApi', () => ({
  fetchForecast: jest.fn(() =>
    Promise.resolve({
      latitude: 40,
      longitude: -74,
      daily: {
        time: ['2026-04-07', '2026-04-08'],
        temperature_2m_max: [72, 68],
        temperature_2m_min: [50, 48],
        precipitation_probability_max: [10, 40],
        wind_speed_10m_max: [5, 8],
        uv_index_max: [5, 4],
      },
      hourly: {
        time: ['2026-04-07T00:00'],
        temperature_2m: [55],
        relative_humidity_2m: [60],
        precipitation_probability: [10],
        wind_speed_10m: [5],
        apparent_temperature: [54],
        uv_index: [0],
      },
    })
  ),
}));

jest.mock('../../src/theme', () => {
  const tokens: any = new Proxy({}, { get: () => '#000' });
  return {
    useTokens: () => tokens,
    useStyles: (factory: any) => factory(tokens),
  };
});

// TDD: this module doesn't exist yet
// require is wrapped in try/catch so test failure message is clear
let ForecastsScreen: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ForecastsScreen = require('../../app/(tabs)/forecasts').default;
} catch {
  ForecastsScreen = () => null;
}

describe('ForecastsScreen (TDD — not yet implemented)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    locationsState = {
      locations: [
        mockLocation({ id: 'l1', name: 'Home' }),
        mockLocation({ id: 'l2', name: 'Cabin' }),
      ],
      loadLocations: jest.fn(),
    };
  });

  // FR-FORECAST-001: all locations shown as cards
  it('shows a card for each location with current conditions', () => {
    render(<ForecastsScreen />);
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Cabin')).toBeTruthy();
  });

  // FR-FORECAST-001: empty state when no locations
  it('shows empty state when user has no locations', () => {
    locationsState = { locations: [], loadLocations: jest.fn() };
    render(<ForecastsScreen />);
    expect(screen.getByText(/Add a location to see forecasts/i)).toBeTruthy();
  });

  // FR-FORECAST-002: tappable location card navigates to detail
  it('tapping a location card opens detail view', () => {
    render(<ForecastsScreen />);
    fireEvent.press(screen.getByText('Home'));
    expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/forecast|location/));
  });

  // FR-FORECAST-002: hourly forecast in detail view
  it('shows hourly and daily forecast sections', () => {
    render(<ForecastsScreen />);
    expect(screen.getByText(/Hourly/i)).toBeTruthy();
    expect(screen.getByText(/Daily|14.day/i)).toBeTruthy();
  });

  // FR-FORECAST-003: rule trigger preview section
  it('shows Rule Status / trigger preview section when rules exist', () => {
    rulesState = { rules: [mockRule()], loadRules: jest.fn() };
    render(<ForecastsScreen />);
    expect(screen.getByText(/Rule Status|Would trigger|Clear/i)).toBeTruthy();
  });

  // FR-FORECAST-004: alert history accessible as sub-screen
  it('provides a way to view alert history sub-screen', () => {
    render(<ForecastsScreen />);
    expect(screen.getByText(/Alert History|View.*history/i)).toBeTruthy();
  });
});
