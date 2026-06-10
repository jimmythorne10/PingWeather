/**
 * Tests for alertHistoryStore
 *
 * Covers: loadHistory and deleteEntry
 *
 * Salesforce analogy: this store is like a custom list controller that
 * wraps DML calls and holds the result in a reactive property. We mock
 * the Supabase layer (the "database callout") so we only test that our
 * JavaScript glue code — the store — calls the right method with the
 * right arguments and updates its own state correctly. Same reason
 * you mock HTTP callouts in Apex test classes.
 */

import { useAlertHistoryStore } from '../../src/stores/alertHistoryStore';
import { supabase } from '../../src/utils/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { TIER_LIMITS } from '../../src/types';
import type { SubscriptionTier } from '../../src/types';

const mockFrom = supabase.from as jest.Mock;

// ── sample data ───────────────────────────────────────────────
const sampleEntry = {
  id: 'entry-1',
  user_id: 'user-1',
  rule_id: 'rule-1',
  rule_name: 'Freeze Warning',
  location_name: 'North Pasture',
  conditions_met: 'Temperature dropped below 32°F',
  forecast_data: {},
  triggered_at: '2026-05-01T08:00:00Z',
  notification_sent: true,
};

// ── Supabase chain mock factory ───────────────────────────────
// Mirrors the exact pattern used in alertRulesStore.test.ts and
// locationsStore.test.ts — a chainable builder where the terminal
// call (order/single/eq-as-terminal) resolves to `result`.
function mockSupabaseChain(result: { data: unknown; error: unknown }) {
  const chain: any = {
    select: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    delete: jest.fn(() => chain),
    eq: jest.fn(() => Promise.resolve(result)),
    gte: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => Promise.resolve(result)),
    single: jest.fn(() => Promise.resolve(result)),
    then: (cb: any) => Promise.resolve(result).then(cb),
  };
  mockFrom.mockReturnValue(chain);
  return chain;
}

// ── Auth store mock helper ─────────────────────────────────────
function setAuthTier(tier: SubscriptionTier) {
  useAuthStore.setState({
    profile: (global as any).mockProfile({ subscription_tier: tier }),
  } as any);
}

// ── Cutoff ISO string helper (mirrors store implementation) ────
// Uses Date.now() arithmetic — same approach mandated in the store.
// We freeze time in each tier test so the value is deterministic.
function expectedCutoff(days: number, now: number): string {
  return new Date(now - days * 86400000).toISOString();
}

// ── store reset helper ────────────────────────────────────────
function resetStore() {
  useAlertHistoryStore.setState({ entries: [], loading: false, error: null });
}

beforeEach(() => {
  jest.clearAllMocks();
  resetStore();
  // Default to free tier; individual tests override as needed
  setAuthTier('free');
});

// ─────────────────────────────────────────────────────────────
// loadHistory
// ─────────────────────────────────────────────────────────────

describe('loadHistory', () => {
  it('loads entries from Supabase and stores them', async () => {
    mockSupabaseChain({ data: [sampleEntry], error: null });

    await useAlertHistoryStore.getState().loadHistory();

    expect(mockFrom).toHaveBeenCalledWith('alert_history');
    expect(useAlertHistoryStore.getState().entries).toEqual([sampleEntry]);
    expect(useAlertHistoryStore.getState().loading).toBe(false);
    expect(useAlertHistoryStore.getState().error).toBeNull();
  });

  it('sets error state and clears loading when Supabase returns an error', async () => {
    mockSupabaseChain({ data: null, error: new Error('DB unavailable') });

    await useAlertHistoryStore.getState().loadHistory();

    expect(useAlertHistoryStore.getState().entries).toEqual([]);
    expect(useAlertHistoryStore.getState().loading).toBe(false);
    expect(useAlertHistoryStore.getState().error).toBe('Failed to load alert history');
  });

  it('replaces existing entries on reload', async () => {
    // Pre-load with stale data
    useAlertHistoryStore.setState({ entries: [sampleEntry] });
    const freshEntry = { ...sampleEntry, id: 'entry-2', rule_name: 'Wind Alert' };
    mockSupabaseChain({ data: [freshEntry], error: null });

    await useAlertHistoryStore.getState().loadHistory();

    const { entries } = useAlertHistoryStore.getState();
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('entry-2');
  });

  // ── Tier-based date filter tests (BUG-011) ────────────────────
  // These tests assert that loadHistory applies .gte('triggered_at', cutoff)
  // using the cutoff derived from the tier's alertHistoryDays.
  // They FAIL before the fix (no .gte call in the original implementation).

  it.each([
    ['free', TIER_LIMITS.free.alertHistoryDays],
    ['pro', TIER_LIMITS.pro.alertHistoryDays],
    ['premium', TIER_LIMITS.premium.alertHistoryDays],
  ] as [SubscriptionTier, number][])(
    'applies .gte("triggered_at", cutoff) for %s tier (%i days)',
    async (tier, days) => {
      const fakeNow = 1_748_822_400_000; // fixed epoch so cutoff is deterministic
      jest.spyOn(Date, 'now').mockReturnValue(fakeNow);

      setAuthTier(tier);
      const chain = mockSupabaseChain({ data: [], error: null });

      await useAlertHistoryStore.getState().loadHistory();

      const cutoff = expectedCutoff(days, fakeNow);
      expect(chain.gte).toHaveBeenCalledWith('triggered_at', cutoff);

      jest.restoreAllMocks();
    }
  );

  it('defaults to free-tier cutoff (7 days) when profile is null', async () => {
    const fakeNow = 1_748_822_400_000;
    jest.spyOn(Date, 'now').mockReturnValue(fakeNow);

    // Simulate no profile (unauthenticated or profile not yet loaded)
    useAuthStore.setState({ profile: null } as any);
    const chain = mockSupabaseChain({ data: [], error: null });

    await useAlertHistoryStore.getState().loadHistory();

    const cutoff = expectedCutoff(TIER_LIMITS.free.alertHistoryDays, fakeNow);
    expect(chain.gte).toHaveBeenCalledWith('triggered_at', cutoff);

    jest.restoreAllMocks();
  });
});

// ─────────────────────────────────────────────────────────────
// deleteEntry
// ─────────────────────────────────────────────────────────────

describe('deleteEntry', () => {
  it('calls Supabase delete with the correct id and removes entry from state', async () => {
    // Start with two entries so we can verify only the right one is removed
    const secondEntry = { ...sampleEntry, id: 'entry-2', rule_name: 'Rain Alert' };
    useAlertHistoryStore.setState({ entries: [sampleEntry, secondEntry] });

    const chain = mockSupabaseChain({ data: null, error: null });

    await useAlertHistoryStore.getState().deleteEntry('entry-1');

    // Verify Supabase was called on the right table
    expect(mockFrom).toHaveBeenCalledWith('alert_history');
    // Verify delete was called
    expect(chain.delete).toHaveBeenCalled();
    // Verify eq was called with the correct id
    expect(chain.eq).toHaveBeenCalledWith('id', 'entry-1');

    // entry-1 removed; entry-2 remains
    const { entries } = useAlertHistoryStore.getState();
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('entry-2');
  });

  it('sets error state and leaves entries unchanged when Supabase returns an error', async () => {
    useAlertHistoryStore.setState({ entries: [sampleEntry] });

    mockSupabaseChain({ data: null, error: new Error('Row not found') });

    await useAlertHistoryStore.getState().deleteEntry('entry-1');

    // State is unchanged — the entry is still there
    const { entries, error } = useAlertHistoryStore.getState();
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('entry-1');

    // Error field is populated with the store's error message
    expect(error).toBe('Failed to delete alert history entry');
  });

  it('does not mutate entries when called with an id that is not in local state but delete succeeds', async () => {
    // DB delete succeeds for a stale/unknown id — store should still filter
    // (filter on unknown id produces same array, no crash)
    useAlertHistoryStore.setState({ entries: [sampleEntry] });
    mockSupabaseChain({ data: null, error: null });

    await useAlertHistoryStore.getState().deleteEntry('non-existent-id');

    // No crash; entries unchanged because filter finds no match
    const { entries, error } = useAlertHistoryStore.getState();
    expect(entries).toHaveLength(1);
    expect(error).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// clearError
// ─────────────────────────────────────────────────────────────

describe('clearError', () => {
  it('resets the error field to null', () => {
    useAlertHistoryStore.setState({ error: 'something went wrong' });

    useAlertHistoryStore.getState().clearError();

    expect(useAlertHistoryStore.getState().error).toBeNull();
  });
});
