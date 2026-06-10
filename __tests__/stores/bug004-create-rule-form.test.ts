/**
 * BUG-004: create-rule.tsx blank form on cold-start deep-link (edit/clone)
 *
 * Verifies that the pure function deriveRuleForm:
 * 1. Returns NOT_READY sentinel when rules array is empty and ruleId is present
 * 2. Returns NOT_READY sentinel when rules array is empty and mode is create
 *    (no sentinel needed for create — but should NOT crash)
 * 3. Returns populated values once the rules array contains the target rule (edit)
 * 4. Returns name with "(copy)" suffix for clone mode
 * 5. Returns default create-mode values when mode is undefined and no ruleId
 *
 * Tests MUST fail before the function is extracted (the file won't exist yet).
 */

import { deriveRuleForm, NOT_READY } from '../../src/utils/deriveRuleForm';
import type { AlertRule, AlertCondition } from '../../src/types';

// ── fixtures ─────────────────────────────────────────────────────────────────

const baseCondition: AlertCondition = {
  metric: 'temperature_low',
  operator: 'lt',
  value: 32,
  unit: 'fahrenheit',
};

const sampleRule: AlertRule = {
  id: 'rule-abc',
  user_id: 'user-1',
  location_id: 'loc-1',
  name: 'Freeze Warning',
  conditions: [baseCondition],
  logical_operator: 'AND',
  lookahead_hours: 24,
  polling_interval_hours: 12,
  is_active: true,
  cooldown_hours: 12,
  last_triggered_at: null,
  last_polled_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

// ── tests ─────────────────────────────────────────────────────────────────────

describe('BUG-004: deriveRuleForm', () => {
  describe('edit mode — rules empty (cold-start)', () => {
    it('returns NOT_READY when rules is empty and ruleId is present', () => {
      const result = deriveRuleForm([], 'rule-abc', 'edit');
      expect(result).toBe(NOT_READY);
    });
  });

  describe('clone mode — rules empty (cold-start)', () => {
    it('returns NOT_READY when rules is empty and ruleId is present', () => {
      const result = deriveRuleForm([], 'rule-abc', 'clone');
      expect(result).toBe(NOT_READY);
    });
  });

  describe('edit mode — rules loaded', () => {
    it('returns populated values when rules contains the target rule', () => {
      const result = deriveRuleForm([sampleRule], 'rule-abc', 'edit');
      expect(result).not.toBe(NOT_READY);
      if (result === NOT_READY) return; // type narrowing
      expect(result.name).toBe('Freeze Warning');
      expect(result.selectedLocationId).toBe('loc-1');
      expect(result.conditions).toEqual([baseCondition]);
      expect(result.logicalOp).toBe('AND');
      expect(result.lookaheadHours).toBe(24);
      expect(result.pollingHours).toBe(12);
      expect(result.cooldownHours).toBe(12);
    });
  });

  describe('clone mode — rules loaded', () => {
    it('appends "(copy)" to the name', () => {
      const result = deriveRuleForm([sampleRule], 'rule-abc', 'clone');
      expect(result).not.toBe(NOT_READY);
      if (result === NOT_READY) return;
      expect(result.name).toBe('Freeze Warning (copy)');
    });

    it('copies all other fields identically to the source rule', () => {
      const result = deriveRuleForm([sampleRule], 'rule-abc', 'clone');
      if (result === NOT_READY) throw new Error('unexpected NOT_READY');
      expect(result.selectedLocationId).toBe('loc-1');
      expect(result.conditions).toEqual([baseCondition]);
      expect(result.logicalOp).toBe('AND');
      expect(result.lookaheadHours).toBe(24);
    });
  });

  describe('create mode (no ruleId)', () => {
    it('returns default form values when mode is undefined and no ruleId', () => {
      const result = deriveRuleForm([], undefined, undefined);
      expect(result).not.toBe(NOT_READY);
      if (result === NOT_READY) return;
      expect(result.name).toBe('');
      expect(result.selectedLocationId).toBe('');
      // Default first condition
      expect(result.conditions[0].metric).toBe('temperature_low');
      expect(result.logicalOp).toBe('AND');
    });

    it('returns defaults even when rules is non-empty (create does not look up a rule)', () => {
      const result = deriveRuleForm([sampleRule], undefined, undefined);
      expect(result).not.toBe(NOT_READY);
      if (result === NOT_READY) return;
      expect(result.name).toBe('');
    });
  });

  describe('edit mode — ruleId not found in non-empty rules array', () => {
    it('returns NOT_READY when ruleId does not match any rule (stale link)', () => {
      const result = deriveRuleForm([sampleRule], 'rule-not-here', 'edit');
      expect(result).toBe(NOT_READY);
    });
  });
});
