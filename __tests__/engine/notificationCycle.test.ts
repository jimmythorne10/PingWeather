/**
 * Tests for decideNotificationCycle — the per-evaluation decision for
 * "should this rule fire right now, and if so what are the new counter
 * + last_triggered_at values".
 *
 * Semantic (confirmed with Jimmy 2026-04-08):
 *
 *   max_notifications = 0 or null → UNLIMITED.
 *     Use the legacy cooldown semantic: after a fire, rule is silent for
 *     `cooldown_hours`. Exactly one notification per cooldown window.
 *
 *   max_notifications > 0 → CAPPED CYCLE.
 *     Up to N notifications within a single cooldown window.
 *     The cycle starts on the FIRST fire; `last_triggered_at` is that
 *     first-fire timestamp and does NOT advance on subsequent fires
 *     within the same cycle.
 *     While count < max, each matching evaluation triggers a fire and
 *     increments count.
 *     When count reaches max, further fires are blocked until
 *     `now() >= last_triggered_at + cooldown_hours` — at which point
 *     the NEXT matching evaluation starts a new cycle: count resets to 1
 *     and last_triggered_at advances to now.
 *
 * This pure function is the single source of truth for both the
 * TypeScript tests here and the mirror implementation in
 * `supabase/functions/evaluate-alerts/index.ts`. Mirror must stay in sync.
 */

import {
  decideNotificationCycle,
  type CycleInput,
} from '../../src/engine/notificationCycle';

// Helpers to keep the test data readable
const HOUR = 60 * 60 * 1000;

function input(over: Partial<CycleInput>): CycleInput {
  return {
    now: new Date('2026-04-08T12:00:00Z'),
    cooldown_hours: 4,
    max_notifications: 0,
    notifications_sent_count: 0,
    last_triggered_at: null,
    ...over,
  };
}

describe('decideNotificationCycle — unlimited mode (max_notifications = 0)', () => {
  it('fires on the first evaluation when never triggered before', () => {
    const result = decideNotificationCycle(input({ last_triggered_at: null }));
    expect(result.fire).toBe(true);
    expect(result.next.notifications_sent_count).toBe(0);
    // last_triggered_at advances to "now" so cooldown begins from this fire
    expect(result.next.last_triggered_at).toEqual(new Date('2026-04-08T12:00:00Z').toISOString());
  });

  it('blocks fires inside the cooldown window', () => {
    const result = decideNotificationCycle(
      input({
        last_triggered_at: new Date('2026-04-08T10:00:00Z').toISOString(), // 2h ago
        cooldown_hours: 4,
      })
    );
    expect(result.fire).toBe(false);
    // Blocked evaluations MUST NOT advance state
    expect(result.next.notifications_sent_count).toBe(0);
    expect(result.next.last_triggered_at).toBe(
      new Date('2026-04-08T10:00:00Z').toISOString()
    );
  });

  it('fires again once the cooldown window has fully elapsed', () => {
    const result = decideNotificationCycle(
      input({
        last_triggered_at: new Date('2026-04-08T08:00:00Z').toISOString(), // 4h ago
        cooldown_hours: 4,
      })
    );
    expect(result.fire).toBe(true);
    expect(result.next.last_triggered_at).toEqual(new Date('2026-04-08T12:00:00Z').toISOString());
  });

  it('treats max_notifications = null as unlimited (same as 0)', () => {
    const result = decideNotificationCycle(
      input({ max_notifications: null, last_triggered_at: null })
    );
    expect(result.fire).toBe(true);
  });
});

describe('decideNotificationCycle — capped cycle mode (max_notifications > 0)', () => {
  it('fires the first time and sets count to 1, anchoring the cycle', () => {
    const result = decideNotificationCycle(
      input({
        max_notifications: 3,
        last_triggered_at: null,
        notifications_sent_count: 0,
      })
    );
    expect(result.fire).toBe(true);
    expect(result.next.notifications_sent_count).toBe(1);
    expect(result.next.last_triggered_at).toEqual(
      new Date('2026-04-08T12:00:00Z').toISOString()
    );
  });

  it('keeps firing within the cycle while count < max, NOT advancing last_triggered_at', () => {
    // Cycle started 1h ago, count = 1, max = 3, cooldown = 4h
    const cycleStart = new Date('2026-04-08T11:00:00Z').toISOString();
    const result = decideNotificationCycle(
      input({
        max_notifications: 3,
        notifications_sent_count: 1,
        last_triggered_at: cycleStart,
      })
    );
    expect(result.fire).toBe(true);
    expect(result.next.notifications_sent_count).toBe(2);
    // Critical: last_triggered_at does NOT advance — the cycle anchor stays put
    expect(result.next.last_triggered_at).toBe(cycleStart);
  });

  it('fires the third time bringing count to the cap', () => {
    const cycleStart = new Date('2026-04-08T11:00:00Z').toISOString();
    const result = decideNotificationCycle(
      input({
        max_notifications: 3,
        notifications_sent_count: 2,
        last_triggered_at: cycleStart,
      })
    );
    expect(result.fire).toBe(true);
    expect(result.next.notifications_sent_count).toBe(3);
    expect(result.next.last_triggered_at).toBe(cycleStart);
  });

  it('blocks further fires once count reaches max, within the cooldown window', () => {
    // Cycle started 2h ago, count = 3 = max, cooldown = 4h
    // Still 2h left in the cycle — must block
    const cycleStart = new Date('2026-04-08T10:00:00Z').toISOString();
    const result = decideNotificationCycle(
      input({
        max_notifications: 3,
        notifications_sent_count: 3,
        last_triggered_at: cycleStart,
        cooldown_hours: 4,
      })
    );
    expect(result.fire).toBe(false);
    expect(result.next.notifications_sent_count).toBe(3);
    expect(result.next.last_triggered_at).toBe(cycleStart);
  });

  it('starts a new cycle after cooldown_hours elapses from the cycle start', () => {
    // Cycle started 4.5h ago, count = 3 (capped), cooldown = 4h
    // Window has fully elapsed — next fire begins a fresh cycle
    const cycleStart = new Date('2026-04-08T07:30:00Z').toISOString();
    const result = decideNotificationCycle(
      input({
        max_notifications: 3,
        notifications_sent_count: 3,
        last_triggered_at: cycleStart,
        cooldown_hours: 4,
      })
    );
    expect(result.fire).toBe(true);
    expect(result.next.notifications_sent_count).toBe(1);
    // New cycle anchor
    expect(result.next.last_triggered_at).toEqual(
      new Date('2026-04-08T12:00:00Z').toISOString()
    );
  });

  it('handles max_notifications = 1 (fire once per cooldown window)', () => {
    // First fire
    const first = decideNotificationCycle(
      input({ max_notifications: 1, last_triggered_at: null })
    );
    expect(first.fire).toBe(true);
    expect(first.next.notifications_sent_count).toBe(1);

    // Immediate second evaluation — blocked, count = max
    const second = decideNotificationCycle(
      input({
        max_notifications: 1,
        notifications_sent_count: 1,
        last_triggered_at: new Date('2026-04-08T11:30:00Z').toISOString(),
      })
    );
    expect(second.fire).toBe(false);

    // After cooldown — fires again, fresh cycle
    const third = decideNotificationCycle(
      input({
        max_notifications: 1,
        notifications_sent_count: 1,
        last_triggered_at: new Date('2026-04-08T07:00:00Z').toISOString(), // 5h ago
      })
    );
    expect(third.fire).toBe(true);
    expect(third.next.notifications_sent_count).toBe(1);
  });

  it('starts fresh when cycle has elapsed even if count was mid-cycle (user reactivated)', () => {
    // Simulate user toggled the rule off and back on; stale count=2 but cycle
    // anchor is long past. Next fire should start clean.
    const result = decideNotificationCycle(
      input({
        max_notifications: 3,
        notifications_sent_count: 2,
        last_triggered_at: new Date('2026-04-07T00:00:00Z').toISOString(), // 36h ago
        cooldown_hours: 4,
      })
    );
    expect(result.fire).toBe(true);
    expect(result.next.notifications_sent_count).toBe(1);
    expect(result.next.last_triggered_at).toEqual(
      new Date('2026-04-08T12:00:00Z').toISOString()
    );
  });
});

describe('decideNotificationCycle — edge cases', () => {
  it('boundary: exactly at cooldown_hours elapsed should start a new cycle', () => {
    const result = decideNotificationCycle(
      input({
        max_notifications: 2,
        notifications_sent_count: 2,
        last_triggered_at: new Date('2026-04-08T08:00:00Z').toISOString(), // exactly 4h ago
        cooldown_hours: 4,
      })
    );
    expect(result.fire).toBe(true);
    expect(result.next.notifications_sent_count).toBe(1);
  });

  it('never throws on missing fields — returns safe defaults', () => {
    expect(() =>
      decideNotificationCycle({
        now: new Date(),
        cooldown_hours: 4,
        max_notifications: 0,
        notifications_sent_count: 0,
        last_triggered_at: null,
      })
    ).not.toThrow();
  });
});
