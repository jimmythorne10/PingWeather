/**
 * BUG-001: mutations must return Promise<boolean>
 *
 * Verifies that:
 * 1. authStore.updateProfile returns false on Supabase error AND sets store.error
 * 2. authStore.updateProfile returns true on success
 * 3. alertRulesStore.createRule returns false on error AND sets store.error
 * 4. alertRulesStore.createRule returns true on success
 * 5. alertRulesStore.updateRule returns false on error AND sets store.error
 * 6. alertRulesStore.updateRule returns true on success
 *
 * These tests were written BEFORE the implementation — they must fail on the
 * unpatched codebase (Promise<void> returns undefined, which is !== false/true).
 */

import { useAuthStore } from '../../src/stores/authStore';
import { useAlertRulesStore } from '../../src/stores/alertRulesStore';
import { supabase } from '../../src/utils/supabase';
import type { AlertCondition } from '../../src/types';

const mockFrom = supabase.from as jest.Mock;

// ── helpers ─────────────────────────────────────────────────────────────────

const mockUser = { id: 'user-123', email: 'test@example.com' };

function resetAuthStore() {
  useAuthStore.setState({
    session: null,
    user: mockUser as any,
    profile: null,
    initialized: true,
    loading: false,
    error: null,
  });
}

function resetRulesStore() {
  useAlertRulesStore.setState({ rules: [], loading: false, error: null });
  useAuthStore.setState({
    user: mockUser as any,
    profile: {
      id: 'user-123',
      email: 'test@example.com',
      display_name: 'T',
      subscription_tier: 'free',
      onboarding_completed: true,
      eula_accepted_version: '1.0.0',
      eula_accepted_at: '2026-01-01',
      push_token: null,
      digest_enabled: false,
      digest_frequency: 'daily' as const,
      digest_hour: 7,
      digest_day_of_week: 1,
      digest_location_id: null,
      digest_last_sent_at: null,
      temperature_unit: 'fahrenheit' as const,
      wind_speed_unit: 'mph' as const,
      pressure_unit: 'hPa' as const,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
    session: null,
    initialized: true,
    loading: false,
    error: null,
  });
}

/** Build a Supabase chain mock that resolves its terminal call with `result`. */
function mockChainResolving(result: { data: unknown; error: unknown }) {
  const chain: any = {
    select: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    delete: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    in: jest.fn(() => chain),
    order: jest.fn(() => Promise.resolve(result)),
    single: jest.fn(() => Promise.resolve(result)),
    then: (cb: any) => Promise.resolve(result).then(cb),
  };
  mockFrom.mockReturnValue(chain);
  return chain;
}

const baseCondition: AlertCondition = {
  metric: 'temperature_low',
  operator: 'lt',
  value: 32,
  unit: 'fahrenheit',
};

const baseRuleInput = {
  location_id: 'loc-1',
  name: 'Freeze Warning',
  conditions: [baseCondition],
  logical_operator: 'AND' as const,
  lookahead_hours: 24,
  polling_interval_hours: 12,
  cooldown_hours: 12,
};

const sampleRule = {
  id: 'rule-1',
  user_id: 'user-123',
  ...baseRuleInput,
  is_active: true,
  last_triggered_at: null,
  last_polled_at: null,
  created_at: '2026-04-01',
  updated_at: '2026-04-01',
};

// ── beforeEach ───────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  resetAuthStore();
  resetRulesStore();
});

// ── authStore.updateProfile ──────────────────────────────────────────────────

describe('BUG-001: authStore.updateProfile returns Promise<boolean>', () => {
  it('returns false when Supabase returns an error', async () => {
    mockChainResolving({ data: null, error: new Error('DB write failed') });

    const result = await useAuthStore.getState().updateProfile({ display_name: 'X' });

    expect(result).toBe(false);
  });

  it('sets store.error when Supabase returns an error', async () => {
    mockChainResolving({ data: null, error: new Error('DB write failed') });

    await useAuthStore.getState().updateProfile({ display_name: 'X' });

    expect(useAuthStore.getState().error).toBeTruthy();
  });

  it('returns true on success', async () => {
    const updatedProfile = {
      id: 'user-123',
      email: 'test@example.com',
      display_name: 'X',
      subscription_tier: 'free',
      onboarding_completed: true,
      eula_accepted_version: '1.0.0',
      eula_accepted_at: '2026-01-01',
      push_token: null,
      digest_enabled: false,
      digest_frequency: 'daily',
      digest_hour: 7,
      digest_day_of_week: 1,
      digest_location_id: null,
      digest_last_sent_at: null,
      temperature_unit: 'fahrenheit',
      wind_speed_unit: 'mph',
      pressure_unit: 'hPa',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    };
    mockChainResolving({ data: updatedProfile, error: null });

    const result = await useAuthStore.getState().updateProfile({ display_name: 'X' });

    expect(result).toBe(true);
  });

  it('returns false (not undefined) when user is not set', async () => {
    useAuthStore.setState({ user: null });

    const result = await useAuthStore.getState().updateProfile({ display_name: 'X' });

    // The guard-return when there is no user must also be boolean false, not void/undefined.
    expect(result).toBe(false);
  });
});

// ── alertRulesStore.createRule ───────────────────────────────────────────────

describe('BUG-001: alertRulesStore.createRule returns Promise<boolean>', () => {
  it('returns false when Supabase returns an error', async () => {
    mockChainResolving({ data: null, error: new Error('insert failed') });

    const result = await useAlertRulesStore.getState().createRule(baseRuleInput);

    expect(result).toBe(false);
  });

  it('sets store.error when Supabase returns an error', async () => {
    mockChainResolving({ data: null, error: new Error('insert failed') });

    await useAlertRulesStore.getState().createRule(baseRuleInput);

    expect(useAlertRulesStore.getState().error).toBeTruthy();
  });

  it('returns true on success', async () => {
    mockChainResolving({ data: sampleRule, error: null });

    const result = await useAlertRulesStore.getState().createRule(baseRuleInput);

    expect(result).toBe(true);
  });

  it('returns false when tier limit is exceeded (no DB call needed)', async () => {
    // Fill to the Free tier limit (2 rules)
    useAlertRulesStore.setState({
      rules: [
        { ...sampleRule, id: 'r1' },
        { ...sampleRule, id: 'r2' },
      ],
    });
    mockChainResolving({ data: null, error: null });

    const result = await useAlertRulesStore.getState().createRule(baseRuleInput);

    expect(result).toBe(false);
    expect(useAlertRulesStore.getState().error).toBeTruthy();
  });
});

// ── alertRulesStore.updateRule ───────────────────────────────────────────────

describe('BUG-001: alertRulesStore.updateRule returns Promise<boolean>', () => {
  it('returns false when Supabase returns an error', async () => {
    useAlertRulesStore.setState({ rules: [sampleRule] });
    mockChainResolving({ data: null, error: new Error('update failed') });

    const result = await useAlertRulesStore.getState().updateRule('rule-1', { name: 'X' });

    expect(result).toBe(false);
  });

  it('sets store.error when Supabase returns an error', async () => {
    useAlertRulesStore.setState({ rules: [sampleRule] });
    mockChainResolving({ data: null, error: new Error('update failed') });

    await useAlertRulesStore.getState().updateRule('rule-1', { name: 'X' });

    expect(useAlertRulesStore.getState().error).toBeTruthy();
  });

  it('returns true on success', async () => {
    useAlertRulesStore.setState({ rules: [sampleRule] });
    mockChainResolving({ data: { ...sampleRule, name: 'X' }, error: null });

    const result = await useAlertRulesStore.getState().updateRule('rule-1', { name: 'X' });

    expect(result).toBe(true);
  });
});
