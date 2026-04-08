// Tier enforcement tests
// Covers: FR-LOC-005, FR-LOC-006, FR-ALERT-007, FR-ALERT-010, FR-IAP-001
// Pure logic tests against TIER_LIMITS and store behavior.
// ────────────────────────────────────────────────────────────

import { TIER_LIMITS } from '../../src/types';
import { makeSupabaseMock, mockLocation, mockRule } from '../helpers/mocks';

const supabaseMock = makeSupabaseMock();

jest.mock('../../src/utils/supabase', () => ({
  supabase: supabaseMock,
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

describe('TIER_LIMITS constants', () => {
  // FR-LOC-006: free tier max 1 location
  it('free tier allows 1 location', () => {
    expect(TIER_LIMITS.free.maxLocations).toBe(1);
  });

  // FR-LOC-006: pro tier max 3 locations
  it('pro tier allows 3 locations', () => {
    expect(TIER_LIMITS.pro.maxLocations).toBe(3);
  });

  // FR-LOC-006: premium tier max 10 locations
  it('premium tier allows 10 locations', () => {
    expect(TIER_LIMITS.premium.maxLocations).toBe(10);
  });

  // FR-ALERT-007: free tier max 2 rules
  it('free tier allows 2 alert rules', () => {
    expect(TIER_LIMITS.free.maxAlertRules).toBe(2);
  });

  // FR-ALERT-007: pro tier max 5 rules
  it('pro tier allows 5 alert rules', () => {
    expect(TIER_LIMITS.pro.maxAlertRules).toBe(5);
  });

  // FR-ALERT-007: premium tier unlimited (effectively)
  it('premium tier allows unlimited alert rules', () => {
    expect(TIER_LIMITS.premium.maxAlertRules).toBeGreaterThanOrEqual(999);
  });

  // FR-IAP-001: free polling minimum is 12h
  it('free tier polling minimum is 12h', () => {
    expect(TIER_LIMITS.free.minPollingIntervalHours).toBe(12);
  });

  // FR-IAP-001: pro polling minimum is 4h
  it('pro tier polling minimum is 4h', () => {
    expect(TIER_LIMITS.pro.minPollingIntervalHours).toBe(4);
  });

  // FR-IAP-001: premium polling minimum is 1h
  it('premium tier polling minimum is 1h', () => {
    expect(TIER_LIMITS.premium.minPollingIntervalHours).toBe(1);
  });

  // FR-ALERT-010: compound conditions require Pro+
  it('free tier does NOT allow compound conditions', () => {
    expect(TIER_LIMITS.free.compoundConditions).toBe(false);
  });

  it('pro tier allows compound conditions', () => {
    expect(TIER_LIMITS.pro.compoundConditions).toBe(true);
  });

  it('premium tier allows compound conditions', () => {
    expect(TIER_LIMITS.premium.compoundConditions).toBe(true);
  });
});

describe('Tier enforcement — store behavior', () => {
  // FR-LOC-005: downgrade deactivates excess locations (TDD — not implemented)
  it('downgrade from pro to free deactivates excess locations', async () => {
    const { useLocationsStore } = require('../../src/stores/locationsStore');
    useLocationsStore.setState({
      locations: [
        mockLocation({ id: 'l1', is_active: true }),
        mockLocation({ id: 'l2', is_active: true }),
        mockLocation({ id: 'l3', is_active: true }),
      ],
    });
    // TDD: enforceTierLimits does not exist yet on the store
    const store: any = useLocationsStore.getState();
    expect(typeof store.enforceTierLimits).toBe('function');
    await store.enforceTierLimits('free');
    const activeCount = useLocationsStore
      .getState()
      .locations.filter((l: any) => l.is_active).length;
    expect(activeCount).toBe(1);
    // No data destroyed
    expect(useLocationsStore.getState().locations.length).toBe(3);
  });

  // FR-LOC-005: upgrade re-enables access (TDD — not implemented)
  it('upgrade from free to pro re-enables previously deactivated locations', async () => {
    const { useLocationsStore } = require('../../src/stores/locationsStore');
    useLocationsStore.setState({
      locations: [
        mockLocation({ id: 'l1', is_active: true }),
        mockLocation({ id: 'l2', is_active: false }),
        mockLocation({ id: 'l3', is_active: false }),
      ],
    });
    const store: any = useLocationsStore.getState();
    await store.enforceTierLimits('pro');
    const activeCount = useLocationsStore
      .getState()
      .locations.filter((l: any) => l.is_active).length;
    expect(activeCount).toBe(3);
  });

  // FR-ALERT-007: excess rules deactivated on downgrade (TDD — not implemented)
  it('downgrade deactivates excess alert rules', async () => {
    const { useAlertRulesStore } = require('../../src/stores/alertRulesStore');
    useAlertRulesStore.setState({
      rules: [
        mockRule({ id: 'r1', is_active: true }),
        mockRule({ id: 'r2', is_active: true }),
        mockRule({ id: 'r3', is_active: true }),
        mockRule({ id: 'r4', is_active: true }),
      ],
    });
    const store: any = useAlertRulesStore.getState();
    expect(typeof store.enforceTierLimits).toBe('function');
    await store.enforceTierLimits('free');
    const activeCount = useAlertRulesStore
      .getState()
      .rules.filter((r: any) => r.is_active).length;
    expect(activeCount).toBe(2); // free = 2 max
  });
});

describe('Tier enforcement — at-limit predicates', () => {
  // FR-LOC-006: atLimit predicate
  it('free user with 1 location is at location limit', () => {
    const count = 1;
    expect(count >= TIER_LIMITS.free.maxLocations).toBe(true);
  });

  // FR-ALERT-007: atLimit predicate
  it('free user with 2 rules is at rule limit', () => {
    const count = 2;
    expect(count >= TIER_LIMITS.free.maxAlertRules).toBe(true);
  });

  // FR-ALERT-010: free user cannot use compound conditions
  it('free user is blocked from compound conditions', () => {
    expect(TIER_LIMITS.free.compoundConditions).toBe(false);
  });
});
