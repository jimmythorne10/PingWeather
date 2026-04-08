// Tests for Alerts screen
// Covers: FR-ALERT-001 through FR-ALERT-010
// ────────────────────────────────────────────────────────────

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { mockProfile, mockLocation, mockRule } from '../helpers/mocks';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useSegments: () => [],
  useLocalSearchParams: () => ({}),
}));

let mockAuthState: any = { profile: mockProfile({ subscription_tier: 'free' }) };
let mockLocationsState: any = { locations: [mockLocation()], loadLocations: jest.fn() };
let mockRulesState: any = {
  rules: [],
  loading: false,
  loadRules: jest.fn(),
  deleteRule: jest.fn(),
  toggleRule: jest.fn(),
  createRule: jest.fn(),
};

jest.mock('../../src/stores/authStore', () => ({
  useAuthStore: (selector?: any) => (selector ? selector(mockAuthState) : mockAuthState),
}));
jest.mock('../../src/stores/locationsStore', () => ({
  useLocationsStore: (selector?: any) => (selector ? selector(mockLocationsState) : mockLocationsState),
}));
jest.mock('../../src/stores/alertRulesStore', () => ({
  useAlertRulesStore: (selector?: any) => (selector ? selector(mockRulesState) : mockRulesState),
}));

jest.mock('../../src/theme', () => {
  const tokens: any = new Proxy({}, { get: () => '#000' });
  return {
    useTokens: () => tokens,
    useStyles: (factory: any) => factory(tokens),
  };
});

jest.mock('../../src/data/alert-presets', () => ({
  ALERT_PRESETS: [
    {
      id: 'p1',
      name: 'Freeze Alert',
      description: 'Freeze warning',
      icon: '❄️',
      category: 'temperature',
      conditions: [{ metric: 'temperature_low', operator: 'lt', value: 32, unit: 'fahrenheit' }],
      logical_operator: 'AND',
      lookahead_hours: 24,
      polling_interval_hours: 12,
      cooldown_hours: 12,
    },
  ],
}));

import AlertsScreen from '../../app/(tabs)/alerts';

describe('AlertsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState = { profile: mockProfile({ subscription_tier: 'free' }) };
    mockLocationsState = { locations: [mockLocation()], loadLocations: jest.fn() };
    mockRulesState = {
      rules: [],
      loading: false,
      loadRules: jest.fn(),
      deleteRule: jest.fn(),
      toggleRule: jest.fn(),
      createRule: jest.fn(),
    };
  });

  // FR-ALERT-001: filter toggle All/Active/Inactive (TDD — not implemented)
  it('renders All/Active/Inactive filter toggle', () => {
    render(<AlertsScreen />);
    expect(screen.getByText(/^All$/)).toBeTruthy();
    expect(screen.getByText(/^Active$/)).toBeTruthy();
    expect(screen.getByText(/^Inactive$/)).toBeTruthy();
  });

  // FR-ALERT-001: compact rule cards (single row)
  it('renders rule cards when rules exist', () => {
    mockRulesState.rules = [mockRule()];
    render(<AlertsScreen />);
    expect(screen.getByText('Freeze Warning')).toBeTruthy();
  });

  // FR-ALERT-001: trash icon for delete (not text "Delete")
  it('uses a trash icon for delete (not text)', () => {
    mockRulesState.rules = [mockRule()];
    render(<AlertsScreen />);
    // TDD: PRD explicitly requires icon, not text
    expect(screen.queryByText('Delete')).toBeNull();
    expect(screen.getByLabelText(/delete|trash|remove/i)).toBeTruthy();
  });

  // FR-ALERT-002: preset category selector is a dropdown, not scroll groups
  it('renders a preset category dropdown (not scroll groups)', () => {
    render(<AlertsScreen />);
    // TDD: current UI uses categorized sections. PRD requires a dropdown/combobox
    expect(screen.getByLabelText(/category.*picker|preset.*dropdown/i)).toBeTruthy();
  });

  // FR-ALERT-003: "+ Build Custom Alert Rule" button
  it('renders "+ Build Custom Alert Rule" button', () => {
    render(<AlertsScreen />);
    expect(screen.getByText(/\+ Build Custom Alert Rule/)).toBeTruthy();
  });

  // FR-ALERT-003: custom rule button navigates to create-rule
  it('navigates to /create-rule when custom button tapped', () => {
    render(<AlertsScreen />);
    fireEvent.press(screen.getByText(/\+ Build Custom Alert Rule/));
    expect(mockPush).toHaveBeenCalledWith('/create-rule');
  });

  // FR-ALERT-007: tier limit warning when at limit
  it('shows tier limit warning when at rule limit (free tier)', () => {
    mockRulesState.rules = [mockRule({ id: 'r1' }), mockRule({ id: 'r2' })]; // free = 2 max
    render(<AlertsScreen />);
    expect(screen.getByText(/reached.*limit|upgrade/i)).toBeTruthy();
  });

  // FR-ALERT-009: clone icon present on rule cards
  it('renders clone icon on rule cards', () => {
    mockRulesState.rules = [mockRule()];
    render(<AlertsScreen />);
    // TDD: clone feature not implemented yet
    expect(screen.getByLabelText(/clone|duplicate/i)).toBeTruthy();
  });

  // FR-ALERT-001: rule count vs tier limit
  it('shows rule count vs tier limit', () => {
    mockRulesState.rules = [mockRule()];
    render(<AlertsScreen />);
    expect(screen.getByText(/1\/2/)).toBeTruthy();
  });

  // FR-ALERT-008: tapping a rule navigates to edit
  it('tapping a rule card navigates to the rule editor', () => {
    mockRulesState.rules = [mockRule()];
    render(<AlertsScreen />);
    fireEvent.press(screen.getByText('Freeze Warning'));
    // TDD: rule cards not yet tappable
    expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/create-rule|edit/));
  });

  // FR-ALERT-010: compound condition tier gating — covered in tierEnforcement.test
});
