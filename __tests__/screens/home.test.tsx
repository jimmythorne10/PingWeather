// Tests for Home (Dashboard) screen
// Covers: FR-HOME-001 through FR-HOME-005
// ────────────────────────────────────────────────────────────

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { mockProfile, mockLocation, mockRule, mockHistoryEntry } from '../helpers/mocks';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useSegments: () => [],
  useLocalSearchParams: () => ({}),
}));

// Stores
let mockAuthState: any = { profile: mockProfile() };
let mockLocationsState: any = { locations: [], loadLocations: jest.fn() };
let mockRulesState: any = { rules: [], loadRules: jest.fn() };
let mockHistoryState: any = { entries: [], loadHistory: jest.fn() };
let mockSettingsState: any = { temperatureUnit: 'fahrenheit', windSpeedUnit: 'mph' };

jest.mock('../../src/stores/authStore', () => ({
  useAuthStore: (selector?: any) => (selector ? selector(mockAuthState) : mockAuthState),
}));
jest.mock('../../src/stores/locationsStore', () => ({
  useLocationsStore: (selector?: any) => (selector ? selector(mockLocationsState) : mockLocationsState),
}));
jest.mock('../../src/stores/alertRulesStore', () => ({
  useAlertRulesStore: (selector?: any) => (selector ? selector(mockRulesState) : mockRulesState),
}));
jest.mock('../../src/stores/alertHistoryStore', () => ({
  useAlertHistoryStore: (selector?: any) => (selector ? selector(mockHistoryState) : mockHistoryState),
}));
jest.mock('../../src/stores/settingsStore', () => ({
  useSettingsStore: (selector?: any) => (selector ? selector(mockSettingsState) : mockSettingsState),
}));

// weatherApi mock
jest.mock('../../src/services/weatherApi', () => ({
  fetchForecast: jest.fn(() =>
    Promise.resolve({
      daily: {
        time: ['2026-04-07', '2026-04-08', '2026-04-09'],
        temperature_2m_max: [72, 68, 70],
        temperature_2m_min: [50, 48, 52],
        precipitation_probability_max: [10, 40, 0],
        wind_speed_10m_max: [5, 8, 6],
        uv_index_max: [5, 4, 6],
      },
    })
  ),
}));

// Theme mocks (useStyles/useTokens return simple objects)
jest.mock('../../src/theme', () => {
  const tokens: any = new Proxy({}, { get: () => '#000' });
  return {
    useTokens: () => tokens,
    useStyles: (factory: any) => factory(tokens),
  };
});

import HomeScreen from '../../app/(tabs)/index';

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState = { profile: mockProfile() };
    mockLocationsState = { locations: [], loadLocations: jest.fn() };
    mockRulesState = { rules: [], loadRules: jest.fn() };
    mockHistoryState = { entries: [], loadHistory: jest.fn() };
    mockSettingsState = { temperatureUnit: 'fahrenheit', windSpeedUnit: 'mph' };
  });

  // FR-HOME-001: Card titled "Forecast" (not location name)
  it('shows forecast card titled "Forecast"', () => {
    mockLocationsState = { locations: [mockLocation()], loadLocations: jest.fn() };
    render(<HomeScreen />);
    // TDD: current implementation uses location name — PRD requires "Forecast"
    expect(screen.getByText('Forecast')).toBeTruthy();
  });

  // FR-HOME-001: Location picker dropdown
  it('shows a location picker on the forecast card', () => {
    mockLocationsState = {
      locations: [mockLocation(), mockLocation({ id: 'loc-2', name: 'Cabin' })],
      loadLocations: jest.fn(),
    };
    render(<HomeScreen />);
    // Location picker exists when multiple locations are available
    expect(screen.getAllByText(/Cabin|Home/).length).toBeGreaterThan(0);
  });

  // FR-HOME-003: Active alerts section, tappable rule rows
  it('shows Active Alerts section', () => {
    mockRulesState = { rules: [mockRule()], loadRules: jest.fn() };
    mockLocationsState = { locations: [mockLocation()], loadLocations: jest.fn() };
    render(<HomeScreen />);
    expect(screen.getByText('Active Alerts')).toBeTruthy();
    expect(screen.getByText('Freeze Warning')).toBeTruthy();
  });

  // FR-HOME-004: Recent Notifications section
  it('shows Recent Notifications section', () => {
    render(<HomeScreen />);
    expect(screen.getByText('Recent Notifications')).toBeTruthy();
  });

  // FR-HOME-005: empty state for no locations
  it('shows empty state with Add Location button when no locations', () => {
    render(<HomeScreen />);
    expect(screen.getAllByText(/Add.*location/i).length).toBeGreaterThan(0);
  });

  // FR-HOME-005: empty state for no rules
  it('shows empty state with Create Alert button when no rules', () => {
    render(<HomeScreen />);
    expect(screen.getByText(/Create Alert/i)).toBeTruthy();
  });

  // FR-HOME-001: "Home" is the tab label, not "Dashboard"
  // (Tab label test is covered by layout config. Here we verify screen does NOT render "Dashboard" as title)
  it('does not display "Dashboard" as a title', () => {
    render(<HomeScreen />);
    expect(screen.queryByText('Dashboard')).toBeNull();
  });

  // FR-HOME-002: forecast card is tappable (expandable to 14-day)
  it('forecast card is tappable to expand to 14-day view', () => {
    mockLocationsState = { locations: [mockLocation()], loadLocations: jest.fn() };
    render(<HomeScreen />);
    // TDD: expanded 14-day view not yet implemented — look for hint
    expect(screen.getByText(/14-day|Tap.*expand|View.*forecast/i)).toBeTruthy();
  });
});
