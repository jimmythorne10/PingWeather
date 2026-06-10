/**
 * deriveRuleForm — pure function extracted from create-rule.tsx
 *
 * BUG-004 fix: On a cold-start deep-link into edit/clone mode the Zustand
 * rules array is empty when the screen first renders. Because useState
 * initialisers only run once, sourceRule is undefined and the form stays
 * permanently blank.
 *
 * This function is the single source of truth for the initial form values.
 * The screen gates its render on rulesLoaded so this function is only called
 * once the data is actually present, avoiding the stale-initialiser trap.
 */

import type { AlertCondition, AlertRule, LogicalOperator } from '../types';

// ── Types ────────────────────────────────────────────────────────────────────

export interface RuleFormValues {
  name: string;
  selectedLocationId: string;
  conditions: AlertCondition[];
  logicalOp: LogicalOperator;
  lookaheadHours: number;
  pollingHours: number;
  cooldownHours: number;
}

/**
 * Sentinel returned when the required rule is not yet in the store
 * (i.e., loadRules() hasn't resolved or the ruleId doesn't match any rule).
 * The screen should show a spinner until this is no longer returned.
 */
export const NOT_READY = Symbol('NOT_READY');
export type NotReady = typeof NOT_READY;

// ── Default create-mode values ────────────────────────────────────────────────

const DEFAULT_CONDITION: AlertCondition = {
  metric: 'temperature_low',
  operator: 'lt',
  value: 32,
  unit: 'fahrenheit',
};

const DEFAULT_FORM: RuleFormValues = {
  name: '',
  selectedLocationId: '',
  conditions: [DEFAULT_CONDITION],
  logicalOp: 'AND',
  lookaheadHours: 24,
  pollingHours: 12,
  cooldownHours: 12,
};

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Derive the initial form values for the create-rule screen.
 *
 * @param rules   Current rules array from the store (may be empty on cold-start)
 * @param ruleId  The ruleId URL param (undefined in create mode)
 * @param mode    'edit' | 'clone' | undefined (create)
 *
 * Returns:
 *   - NOT_READY  when edit/clone mode needs a rule but it isn't loaded yet
 *   - RuleFormValues  populated from the source rule (edit/clone) or defaults (create)
 */
export function deriveRuleForm(
  rules: AlertRule[],
  ruleId: string | undefined,
  mode: string | undefined
): RuleFormValues | NotReady {
  const isEditOrClone = mode === 'edit' || mode === 'clone';

  if (isEditOrClone) {
    // Need a rule — check if it's available
    const sourceRule = ruleId ? rules.find((r) => r.id === ruleId) : undefined;
    if (!sourceRule) {
      // Rules haven't loaded yet (or ruleId is stale) — signal not ready
      return NOT_READY;
    }

    return {
      name: mode === 'clone' ? `${sourceRule.name} (copy)` : sourceRule.name,
      selectedLocationId: sourceRule.location_id,
      conditions: sourceRule.conditions,
      logicalOp: sourceRule.logical_operator,
      lookaheadHours: sourceRule.lookahead_hours,
      pollingHours: sourceRule.polling_interval_hours,
      cooldownHours: sourceRule.cooldown_hours,
    };
  }

  // Create mode — return defaults immediately; no rule lookup required
  return { ...DEFAULT_FORM, conditions: [{ ...DEFAULT_CONDITION }] };
}
