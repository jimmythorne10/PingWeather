// Tests for Create/Edit/Clone Rule screen
// Covers: FR-ALERT-003, FR-ALERT-004, FR-ALERT-008, FR-ALERT-009
// ────────────────────────────────────────────────────────────

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { mockProfile, mockLocation, mockRule } from '../helpers/mocks';

let mockLocalParams: any = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useSegments: () => [],
  useLocalSearchParams: () => mockLocalParams,
}));

let mockAuthState: any = { profile: mockProfile({ subscription_tier: 'pro' }) };
let mockLocationsState: any = {
  locations: [mockLocation()],
  loadLocations: jest.fn(),
};
const mockCreateRule = jest.fn(() => Promise.resolve());
const mockUpdateRule = jest.fn(() => Promise.resolve());
let mockRulesState: any = {
  rules: [],
  createRule: mockCreateRule,
  updateRule: mockUpdateRule,
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

import CreateRuleScreen from '../../app/create-rule';

describe('CreateRuleScreen — Create mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalParams = {};
    mockAuthState = { profile: mockProfile({ subscription_tier: 'pro' }) };
    mockLocationsState = { locations: [mockLocation()], loadLocations: jest.fn() };
    mockRulesState = { rules: [], createRule: mockCreateRule, updateRule: mockUpdateRule };
  });

  // FR-ALERT-003: all 8 metric options
  it('renders all 8 metric options', () => {
    render(<CreateRuleScreen />);
    ['Daily High Temp', 'Daily Low Temp', 'Hourly Temp', 'Rain Chance',
     'Wind Speed', 'Humidity', 'Feels Like', 'UV Index'].forEach((m) => {
      expect(screen.getByText(m)).toBeTruthy();
    });
  });

  // FR-ALERT-003: 5 operator options
  it('renders all 5 operator options', () => {
    render(<CreateRuleScreen />);
    ['above', 'at or above', 'below', 'at or below', 'exactly'].forEach((op) => {
      expect(screen.getByText(op)).toBeTruthy();
    });
  });

  // FR-ALERT-003: value input present
  it('renders numeric value input', () => {
    render(<CreateRuleScreen />);
    expect(screen.getByDisplayValue('32')).toBeTruthy();
  });

  // FR-ALERT-003: location chip selector
  it('renders location selector chips', () => {
    render(<CreateRuleScreen />);
    expect(screen.getByText('Home')).toBeTruthy();
  });

  // FR-ALERT-003: 7 lookahead options
  it('renders all 7 lookahead options', () => {
    render(<CreateRuleScreen />);
    // Note: "6 hours" and "12 hours" also appear in cooldown options — use getAllByText
    ['6 hours', '12 hours'].forEach((l) => {
      expect(screen.getAllByText(l).length).toBeGreaterThan(0);
    });
    ['1 day', '2 days', '3 days', '5 days', '7 days'].forEach((l) => {
      expect(screen.getByText(l)).toBeTruthy();
    });
  });

  // FR-ALERT-003: polling options filtered by tier
  it('filters polling options by tier minimum (pro = 4h min)', () => {
    render(<CreateRuleScreen />);
    // pro min = 4h, so "Every hour" and "Every 2 hrs" should NOT be present
    expect(screen.queryByText('Every hour')).toBeNull();
    expect(screen.queryByText('Every 2 hrs')).toBeNull();
    expect(screen.getByText('Every 4 hrs')).toBeTruthy();
  });

  // FR-ALERT-003: free tier polling filter (12h+)
  it('filters polling options by free tier minimum (12h min)', () => {
    mockAuthState = { profile: mockProfile({ subscription_tier: 'free' }) };
    render(<CreateRuleScreen />);
    expect(screen.queryByText('Every 4 hrs')).toBeNull();
    expect(screen.getByText('Every 12 hrs')).toBeTruthy();
  });

  // FR-ALERT-003: cooldown options
  it('renders all 5 cooldown options', () => {
    render(<CreateRuleScreen />);
    // Note: "6 hours" and "12 hours" also appear in lookahead options — use getAllByText
    ['6 hours', '12 hours'].forEach((c) => {
      expect(screen.getAllByText(c).length).toBeGreaterThan(0);
    });
    ['4 hours', '24 hours', '48 hours'].forEach((c) => {
      expect(screen.getByText(c)).toBeTruthy();
    });
  });

  // FR-ALERT-004: plain-English summary present
  it('renders plain-English summary', () => {
    render(<CreateRuleScreen />);
    expect(screen.getByText(/We'll check the forecast/i)).toBeTruthy();
  });

  // FR-ALERT-004: summary updates when metric value changes
  it('summary updates reactively when value changes', () => {
    render(<CreateRuleScreen />);
    const input = screen.getByDisplayValue('32');
    fireEvent.changeText(input, '28');
    expect(screen.getByText(/28/)).toBeTruthy();
  });

  // FR-ALERT-003: save/cancel buttons
  it('renders Save and Cancel buttons', () => {
    render(<CreateRuleScreen />);
    expect(screen.getByText('Create Alert Rule')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });
});

describe('CreateRuleScreen — Edit mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalParams = { mode: 'edit', ruleId: 'rule-1' };
    mockAuthState = { profile: mockProfile({ subscription_tier: 'pro' }) };
    mockLocationsState = { locations: [mockLocation()], loadLocations: jest.fn() };
    mockRulesState = {
      rules: [mockRule({ id: 'rule-1', name: 'My Freeze Alert' })],
      createRule: mockCreateRule,
      updateRule: mockUpdateRule,
    };
  });

  // FR-ALERT-008: title "Edit Alert Rule"
  it('shows "Edit Alert Rule" title in edit mode', () => {
    render(<CreateRuleScreen />);
    expect(screen.getByText('Edit Alert Rule')).toBeTruthy();
  });

  // FR-ALERT-008: pre-populated name field
  it('pre-populates name field with existing rule name', () => {
    render(<CreateRuleScreen />);
    expect(screen.getByDisplayValue('My Freeze Alert')).toBeTruthy();
  });

  // FR-ALERT-008: "Save Changes" button (not "Create Alert Rule")
  it('shows "Save Changes" button in edit mode', () => {
    render(<CreateRuleScreen />);
    expect(screen.getByText('Save Changes')).toBeTruthy();
    expect(screen.queryByText('Create Alert Rule')).toBeNull();
  });
});

describe('CreateRuleScreen — Clone mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalParams = { mode: 'clone', ruleId: 'rule-1' };
    mockAuthState = { profile: mockProfile({ subscription_tier: 'pro' }) };
    mockLocationsState = { locations: [mockLocation()], loadLocations: jest.fn() };
    mockRulesState = {
      rules: [mockRule({ id: 'rule-1', name: 'My Freeze Alert' })],
      createRule: mockCreateRule,
      updateRule: mockUpdateRule,
    };
  });

  // FR-ALERT-009: title "Clone Alert Rule"
  it('shows "Clone Alert Rule" title in clone mode', () => {
    render(<CreateRuleScreen />);
    expect(screen.getByText('Clone Alert Rule')).toBeTruthy();
  });

  // FR-ALERT-009: pre-populated with "(copy)" suffix
  it('pre-populates name field with "(copy)" suffix', () => {
    render(<CreateRuleScreen />);
    expect(screen.getByDisplayValue(/My Freeze Alert.*\(copy\)/)).toBeTruthy();
  });

  // FR-ALERT-009: save button is "Create Alert Rule" (not "Save Changes")
  it('shows Create Alert Rule button (creates new, not edit)', () => {
    render(<CreateRuleScreen />);
    expect(screen.getByText('Create Alert Rule')).toBeTruthy();
  });
});
