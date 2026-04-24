/**
 * Tests for alertRulesStore — FR-ALERT-001 through FR-ALERT-010
 *
 * Validates alert rule CRUD, tier enforcement, and compound condition gating.
 * Tier limit enforcement in the store and compound condition gating are TDD —
 * they don't exist in the current store and SHOULD fail.
 */

import { useAlertRulesStore } from '../../src/stores/alertRulesStore';
import { useAuthStore } from '../../src/stores/authStore';
import { supabase } from '../../src/utils/supabase';
import type { AlertCondition } from '../../src/types';

const mockFrom = supabase.from as jest.Mock;

const mockUser = { id: 'user-123', email: 'test@example.com' };

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

function setLoggedInUser(tier: 'free' | 'pro' | 'premium' = 'free') {
  useAuthStore.setState({
    user: mockUser as any,
    profile: {
      id: 'user-123',
      email: 'test@example.com',
      display_name: 'T',
      subscription_tier: tier,
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
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
  });
}

function resetStore() {
  useAlertRulesStore.setState({ rules: [], loading: false, error: null });
  useAuthStore.setState({ user: null, profile: null, session: null });
}

function mockSupabaseChain(result: { data: unknown; error: unknown }) {
  const chain: any = {
    select: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    delete: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    order: jest.fn(() => Promise.resolve(result)),
    single: jest.fn(() => Promise.resolve(result)),
    then: (cb: any) => Promise.resolve(result).then(cb),
  };
  mockFrom.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
  resetStore();
});

describe('alertRulesStore', () => {
  // ── FR-ALERT-001: Load / View Rules ─────────────────────

  describe('FR-ALERT-001: loadRules', () => {
    it('loads rules from Supabase', async () => {
      mockSupabaseChain({ data: [sampleRule], error: null });

      await useAlertRulesStore.getState().loadRules();

      expect(mockFrom).toHaveBeenCalledWith('alert_rules');
      expect(useAlertRulesStore.getState().rules).toEqual([sampleRule]);
    });

    it('handles load error — surfaces real error message', async () => {
      // FIX 4: The store now passes the real error message through rather than
      // masking it with a generic string. This makes it actionable for debugging.
      mockSupabaseChain({ data: null, error: new Error('DB error') });

      await useAlertRulesStore.getState().loadRules();

      expect(useAlertRulesStore.getState().error).toBe('DB error');
    });
  });

  // ── FR-ALERT-003: Create Custom Rule ─────────────────────

  describe('FR-ALERT-003: createRule', () => {
    it('includes user_id from auth state', async () => {
      // FR-ALERT-003: Rule saved to Supabase with user_id
      setLoggedInUser('free');
      const chain = mockSupabaseChain({ data: sampleRule, error: null });

      await useAlertRulesStore.getState().createRule(baseRuleInput);

      expect(chain.insert).toHaveBeenCalled();
      const insertArg = chain.insert.mock.calls[0][0];
      expect(insertArg.user_id).toBe('user-123');
    });

    it('sets is_active to true by default', async () => {
      setLoggedInUser('free');
      const chain = mockSupabaseChain({ data: sampleRule, error: null });

      await useAlertRulesStore.getState().createRule(baseRuleInput);

      expect(chain.insert.mock.calls[0][0].is_active).toBe(true);
    });

    it('prepends new rule to the list', async () => {
      setLoggedInUser('free');
      useAlertRulesStore.setState({ rules: [{ ...sampleRule, id: 'old' } as any] });
      mockSupabaseChain({ data: sampleRule, error: null });

      await useAlertRulesStore.getState().createRule(baseRuleInput);

      expect(useAlertRulesStore.getState().rules[0].id).toBe('rule-1');
      expect(useAlertRulesStore.getState().rules).toHaveLength(2);
    });

    it('fails if not authenticated — surfaces real error message', async () => {
      // FIX 4: The store now surfaces the real thrown error message so the
      // caller gets "Not authenticated" rather than the generic fallback.
      useAuthStore.setState({ user: null });
      mockSupabaseChain({ data: null, error: null });

      await useAlertRulesStore.getState().createRule(baseRuleInput);

      expect(useAlertRulesStore.getState().error).toBe('Not authenticated');
    });
  });

  // ── FR-ALERT-005: Toggle Rule ─────────────────────

  describe('FR-ALERT-005: toggleRule', () => {
    it('updates is_active flag in Supabase and local state', async () => {
      // FR-ALERT-005: is_active flag updated
      useAlertRulesStore.setState({ rules: [sampleRule] });
      const chain = mockSupabaseChain({ data: null, error: null });

      await useAlertRulesStore.getState().toggleRule('rule-1', false);

      expect(chain.update).toHaveBeenCalledWith({ is_active: false });
      expect(useAlertRulesStore.getState().rules[0].is_active).toBe(false);
    });
  });

  // ── FR-ALERT-006: Delete Rule ─────────────────────

  describe('FR-ALERT-006: deleteRule', () => {
    it('deletes the rule from Supabase and removes from state', async () => {
      // FR-ALERT-006: Rule removed from UI immediately
      useAlertRulesStore.setState({ rules: [sampleRule] });
      const chain = mockSupabaseChain({ data: null, error: null });

      await useAlertRulesStore.getState().deleteRule('rule-1');

      expect(chain.delete).toHaveBeenCalled();
      expect(useAlertRulesStore.getState().rules).toHaveLength(0);
    });
  });

  // ── FR-ALERT-007: Tier Limit Enforcement ─────────────────────
  // TDD: Store does not currently enforce tier limits. These tests SHOULD fail.

  describe('FR-ALERT-007: tier limit enforcement', () => {
    it('blocks creating a 3rd rule on Free tier (limit 2)', async () => {
      // FR-ALERT-007: Free limited to 2 rules
      setLoggedInUser('free');
      useAlertRulesStore.setState({
        rules: [
          { ...sampleRule, id: 'r1' },
          { ...sampleRule, id: 'r2' },
        ],
      });
      mockSupabaseChain({ data: null, error: null });

      await useAlertRulesStore.getState().createRule(baseRuleInput);

      expect(useAlertRulesStore.getState().rules).toHaveLength(2);
      expect(useAlertRulesStore.getState().error).toBeTruthy();
    });

    it('blocks creating a 6th rule on Pro tier (limit 5)', async () => {
      // FR-ALERT-007: Pro limited to 5 rules
      setLoggedInUser('pro');
      const rules = Array.from({ length: 5 }, (_, i) => ({ ...sampleRule, id: `r${i}` }));
      useAlertRulesStore.setState({ rules });
      mockSupabaseChain({ data: null, error: null });

      await useAlertRulesStore.getState().createRule(baseRuleInput);

      expect(useAlertRulesStore.getState().rules).toHaveLength(5);
    });

    it('allows unlimited rules on Premium tier', async () => {
      // FR-ALERT-007: Premium unlimited
      setLoggedInUser('premium');
      const rules = Array.from({ length: 50 }, (_, i) => ({ ...sampleRule, id: `r${i}` }));
      useAlertRulesStore.setState({ rules });
      mockSupabaseChain({ data: { ...sampleRule, id: 'r50' }, error: null });

      await useAlertRulesStore.getState().createRule(baseRuleInput);

      expect(useAlertRulesStore.getState().rules.length).toBeGreaterThan(50);
    });
  });

  // ── FR-ALERT-008: Edit Existing Rule ─────────────────────

  describe('FR-ALERT-008: updateRule', () => {
    it('updates the rule via Supabase', async () => {
      // FR-ALERT-008: updates existing rule via updateRule
      useAlertRulesStore.setState({ rules: [sampleRule] });
      const updated = { ...sampleRule, name: 'Updated Name' };
      const chain = mockSupabaseChain({ data: updated, error: null });

      await useAlertRulesStore.getState().updateRule('rule-1', { name: 'Updated Name' });

      expect(chain.update).toHaveBeenCalled();
      expect(useAlertRulesStore.getState().rules[0].name).toBe('Updated Name');
    });

    it('includes updated_at timestamp on update', async () => {
      useAlertRulesStore.setState({ rules: [sampleRule] });
      const chain = mockSupabaseChain({ data: sampleRule, error: null });

      await useAlertRulesStore.getState().updateRule('rule-1', { name: 'x' });

      const updateArg = chain.update.mock.calls[0][0];
      expect(updateArg).toHaveProperty('updated_at');
    });
  });

  // ── FR-ALERT-010: Compound Conditions (Pro+) ─────────────────────
  // TDD: Compound condition gating is not yet enforced in the store.

  describe('FR-ALERT-010: compound condition gating', () => {
    it('blocks Free users from creating rules with multiple conditions', async () => {
      // FR-ALERT-010: Free users limited to single-condition rules
      setLoggedInUser('free');
      mockSupabaseChain({ data: null, error: null });

      const compoundRule = {
        ...baseRuleInput,
        conditions: [
          baseCondition,
          { metric: 'wind_speed' as const, operator: 'gt' as const, value: 25, unit: 'mph' as const },
        ],
      };

      await useAlertRulesStore.getState().createRule(compoundRule);

      // Rule should not be created on Free tier
      expect(useAlertRulesStore.getState().rules).toHaveLength(0);
      expect(useAlertRulesStore.getState().error).toBeTruthy();
    });

    it('allows Pro users to create compound rules with AND logic', async () => {
      // FR-ALERT-010: Pro/Premium can add multiple conditions with AND logic
      setLoggedInUser('pro');
      const compoundRule = {
        ...baseRuleInput,
        conditions: [
          baseCondition,
          { metric: 'wind_speed' as const, operator: 'gt' as const, value: 25, unit: 'mph' as const },
        ],
        logical_operator: 'AND' as const,
      };
      mockSupabaseChain({ data: { ...sampleRule, conditions: compoundRule.conditions }, error: null });

      await useAlertRulesStore.getState().createRule(compoundRule);

      expect(useAlertRulesStore.getState().rules).toHaveLength(1);
    });

    it('allows Premium users to create compound rules with OR logic', async () => {
      // FR-ALERT-010: Pro/Premium can add multiple conditions with OR logic
      setLoggedInUser('premium');
      const compoundRule = {
        ...baseRuleInput,
        conditions: [
          baseCondition,
          { metric: 'precipitation_probability' as const, operator: 'gt' as const, value: 70, unit: 'percent' as const },
        ],
        logical_operator: 'OR' as const,
      };
      mockSupabaseChain({ data: { ...sampleRule, conditions: compoundRule.conditions }, error: null });

      await useAlertRulesStore.getState().createRule(compoundRule);

      expect(useAlertRulesStore.getState().rules).toHaveLength(1);
    });
  });

  describe('clearError', () => {
    it('clears the error state', () => {
      useAlertRulesStore.setState({ error: 'oops' });
      useAlertRulesStore.getState().clearError();
      expect(useAlertRulesStore.getState().error).toBeNull();
    });
  });
});
