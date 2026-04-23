// Shared mock factories for PingWeather tests
// ────────────────────────────────────────────────────────────

import type {
  Profile,
  WatchLocation,
  AlertRule,
  AlertHistoryEntry,
  SubscriptionTier,
} from '../../src/types';

export const mockProfile = (overrides: Partial<Profile> = {}): Profile => ({
  id: 'user-1',
  email: 'test@example.com',
  display_name: 'Test User',
  subscription_tier: 'free',
  onboarding_completed: true,
  eula_accepted_version: '1.0.0',
  eula_accepted_at: '2026-01-01T00:00:00Z',
  push_token: null,
  digest_enabled: false,
  digest_frequency: 'daily',
  digest_hour: 7,
  digest_day_of_week: 1,
  digest_location_id: null,
  digest_last_sent_at: null,
  temperature_unit: 'fahrenheit',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

export const mockLocation = (overrides: Partial<WatchLocation> = {}): WatchLocation => ({
  id: 'loc-1',
  user_id: 'user-1',
  name: 'Home',
  latitude: 40.7128,
  longitude: -74.006,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

export const mockRule = (overrides: Partial<AlertRule> = {}): AlertRule => ({
  id: 'rule-1',
  user_id: 'user-1',
  location_id: 'loc-1',
  name: 'Freeze Warning',
  conditions: [
    { metric: 'temperature_low', operator: 'lt', value: 32, unit: 'fahrenheit' },
  ],
  logical_operator: 'AND',
  lookahead_hours: 24,
  polling_interval_hours: 12,
  is_active: true,
  cooldown_hours: 12,
  last_triggered_at: null,
  last_polled_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

export const mockHistoryEntry = (
  overrides: Partial<AlertHistoryEntry> = {}
): AlertHistoryEntry => ({
  id: 'hist-1',
  user_id: 'user-1',
  rule_id: 'rule-1',
  rule_name: 'Freeze Warning',
  location_name: 'Home',
  conditions_met: 'Low of 28°F',
  forecast_data: {},
  triggered_at: '2026-02-01T08:00:00Z',
  notification_sent: true,
  ...overrides,
});

// Chainable Supabase mock
export const makeSupabaseMock = () => {
  const chain: any = {
    select: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    delete: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    single: jest.fn(() => Promise.resolve({ data: null, error: null })),
    then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
  };
  return {
    from: jest.fn(() => chain),
    auth: {
      getSession: jest.fn(() => Promise.resolve({ data: { session: null } })),
      signUp: jest.fn(() =>
        Promise.resolve({ data: { session: null, user: null }, error: null })
      ),
      signInWithPassword: jest.fn(() =>
        Promise.resolve({ data: { session: null, user: null }, error: null })
      ),
      signOut: jest.fn(() => Promise.resolve({ error: null })),
      resetPasswordForEmail: jest.fn(() => Promise.resolve({ data: {}, error: null })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
    __chain: chain,
  };
};

export const getTierLimits = (tier: SubscriptionTier) => {
  const limits = {
    free: { maxLocations: 1, maxAlertRules: 2, minPollingIntervalHours: 12 },
    pro: { maxLocations: 3, maxAlertRules: 5, minPollingIntervalHours: 4 },
    premium: { maxLocations: 10, maxAlertRules: 999, minPollingIntervalHours: 1 },
  };
  return limits[tier];
};
