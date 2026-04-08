// Tests for Locations screen
// Covers: FR-LOC-001 through FR-LOC-008
// ────────────────────────────────────────────────────────────

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { mockProfile, mockLocation } from '../helpers/mocks';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useSegments: () => [],
  useLocalSearchParams: () => ({}),
}));

let mockAuthState: any = { profile: mockProfile({ subscription_tier: 'free' }) };
let mockLocationsState: any = {
  locations: [],
  loading: false,
  loadLocations: jest.fn(),
  addLocation: jest.fn(),
  removeLocation: jest.fn(),
  toggleLocation: jest.fn(),
};

jest.mock('../../src/stores/authStore', () => ({
  useAuthStore: (selector?: any) => (selector ? selector(mockAuthState) : mockAuthState),
}));
jest.mock('../../src/stores/locationsStore', () => ({
  useLocationsStore: (selector?: any) => (selector ? selector(mockLocationsState) : mockLocationsState),
}));

jest.mock('../../src/hooks/useLocation', () => ({
  useDeviceLocation: () => ({
    getLocation: jest.fn(() => Promise.resolve({ latitude: 40, longitude: -74 })),
    loading: false,
    error: null,
  }),
}));

jest.mock('../../src/theme', () => {
  const tokens: any = new Proxy({}, { get: () => '#000' });
  return {
    useTokens: () => tokens,
    useStyles: (factory: any) => factory(tokens),
  };
});

import LocationsScreen from '../../app/(tabs)/locations';

describe('LocationsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState = { profile: mockProfile({ subscription_tier: 'free' }) };
    mockLocationsState = {
      locations: [],
      loading: false,
      loadLocations: jest.fn(),
      addLocation: jest.fn(),
      removeLocation: jest.fn(),
      toggleLocation: jest.fn(),
    };
  });

  // FR-LOC-001: shows tier display
  it('shows location count vs tier limit', () => {
    render(<LocationsScreen />);
    expect(screen.getByText(/0\/1.*free/i)).toBeTruthy();
  });

  // FR-LOC-001: renders location list
  it('renders location cards', () => {
    mockLocationsState.locations = [mockLocation({ name: 'Home Ranch' })];
    render(<LocationsScreen />);
    expect(screen.getByText('Home Ranch')).toBeTruthy();
  });

  // FR-LOC-001: empty state
  it('shows empty state when no locations', () => {
    render(<LocationsScreen />);
    expect(screen.getByText(/No locations yet/i)).toBeTruthy();
  });

  // FR-LOC-002: GPS option in add form
  it('shows "Use My Current Location" GPS option when adding', () => {
    render(<LocationsScreen />);
    fireEvent.press(screen.getByText(/\+ Add Location/i));
    expect(screen.getByText(/Use My Current Location/i)).toBeTruthy();
  });

  // FR-LOC-002: manual lat/long entry
  it('shows manual lat/long inputs', () => {
    render(<LocationsScreen />);
    fireEvent.press(screen.getByText(/\+ Add Location/i));
    expect(screen.getByPlaceholderText('Latitude')).toBeTruthy();
    expect(screen.getByPlaceholderText('Longitude')).toBeTruthy();
  });

  // FR-LOC-002: place/address search (TDD — not implemented)
  it('shows address/place search option', () => {
    render(<LocationsScreen />);
    fireEvent.press(screen.getByText(/\+ Add Location/i));
    expect(screen.getByPlaceholderText(/search.*place|address/i)).toBeTruthy();
  });

  // FR-LOC-004: trash icon for delete (not "Remove" text)
  it('uses trash icon for delete (not text)', () => {
    mockLocationsState.locations = [mockLocation()];
    render(<LocationsScreen />);
    expect(screen.getByLabelText(/delete|trash|remove/i)).toBeTruthy();
  });

  // FR-LOC-003: toggle switch for active/inactive
  it('renders toggle switch for each location', () => {
    mockLocationsState.locations = [mockLocation()];
    const { UNSAFE_getAllByType } = render(<LocationsScreen />);
    const Switch = require('react-native').Switch;
    expect(UNSAFE_getAllByType(Switch).length).toBeGreaterThan(0);
  });

  // FR-LOC-006: tier limit hides add button
  it('hides + Add button when at tier limit', () => {
    mockLocationsState.locations = [mockLocation()];
    render(<LocationsScreen />);
    expect(screen.queryByText('+ Add')).toBeNull();
    expect(screen.getByText(/reached.*limit|upgrade/i)).toBeTruthy();
  });

  // FR-LOC-008: default location indicator (TDD — not implemented)
  it('shows default location indicator', () => {
    mockLocationsState.locations = [mockLocation()];
    render(<LocationsScreen />);
    expect(screen.getByLabelText(/default.*location|star/i)).toBeTruthy();
  });

  // FR-LOC-005: downgraded locations shown dimmed (TDD)
  it('shows inactive banner when user has inactive locations over tier limit', () => {
    mockLocationsState.locations = [
      mockLocation({ id: 'l1', is_active: true }),
      mockLocation({ id: 'l2', is_active: false }),
    ];
    render(<LocationsScreen />);
    // PRD FR-LOC-005 requires banner for inactive count
    expect(screen.getByText(/inactive location|upgrade to reactivate/i)).toBeTruthy();
  });
});
