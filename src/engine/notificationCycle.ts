/**
 * Pure decision function for "should this rule fire right now"
 *
 * Single source of truth for the notification-cycle semantic. The matching
 * implementation in `supabase/functions/evaluate-alerts/index.ts` must mirror
 * this logic exactly (it can't `import` from src/ because Deno doesn't resolve
 * those paths). Keep them in lockstep — any change here requires the mirror
 * to be updated in the same commit.
 *
 * Semantic (confirmed with Jimmy 2026-04-08):
 *
 *   max_notifications = 0 or null → UNLIMITED.
 *     Legacy cooldown semantic. After a fire, rule is silent for
 *     `cooldown_hours`. Exactly one notification per cooldown window.
 *
 *   max_notifications > 0 → CAPPED CYCLE.
 *     Up to N notifications within a single cooldown window.
 *     `last_triggered_at` is the CYCLE ANCHOR (the first-fire timestamp),
 *     not the most-recent-fire timestamp. It does not advance while we
 *     count up to the cap.
 *     When count reaches the cap, further fires are blocked until
 *     `now >= last_triggered_at + cooldown_hours`, at which point the next
 *     matching evaluation starts a new cycle (count = 1, anchor = now).
 *
 * The function does not have side effects. The caller is responsible for
 * persisting `result.next.notifications_sent_count` and
 * `result.next.last_triggered_at` back to the database if `result.fire` is
 * true — and for NOT persisting them if `result.fire` is false (the fields
 * returned on a blocked evaluation are unchanged from the input).
 */

export interface CycleInput {
  /** "now" for this evaluation */
  now: Date;
  /** rule.cooldown_hours */
  cooldown_hours: number;
  /**
   * rule.max_notifications — 0 or null means unlimited (legacy cooldown
   * semantic). > 0 means capped cycle.
   */
  max_notifications: number | null;
  /** rule.notifications_sent_count — current count within the active cycle */
  notifications_sent_count: number;
  /** rule.last_triggered_at — ISO string or null (never fired) */
  last_triggered_at: string | null;
}

export interface CycleDecision {
  fire: boolean;
  next: {
    notifications_sent_count: number;
    last_triggered_at: string | null;
  };
}

function isCycleElapsed(
  now: Date,
  lastTriggeredAt: string | null,
  cooldownHours: number
): boolean {
  if (!lastTriggeredAt) return true;
  const anchor = new Date(lastTriggeredAt).getTime();
  const windowMs = cooldownHours * 60 * 60 * 1000;
  return now.getTime() - anchor >= windowMs;
}

export function decideNotificationCycle(input: CycleInput): CycleDecision {
  const {
    now,
    cooldown_hours,
    max_notifications,
    notifications_sent_count,
    last_triggered_at,
  } = input;

  const unchanged: CycleDecision = {
    fire: false,
    next: {
      notifications_sent_count,
      last_triggered_at,
    },
  };

  const isUnlimited = !max_notifications || max_notifications <= 0;

  if (isUnlimited) {
    // Legacy: one fire per cooldown window.
    if (isCycleElapsed(now, last_triggered_at, cooldown_hours)) {
      return {
        fire: true,
        next: {
          // Counter is not meaningful in unlimited mode — keep at 0.
          notifications_sent_count: 0,
          last_triggered_at: now.toISOString(),
        },
      };
    }
    return unchanged;
  }

  // Capped cycle mode.
  // If the cycle has fully elapsed (or we've never fired), start a brand
  // new cycle: count goes to 1, anchor advances to now.
  if (isCycleElapsed(now, last_triggered_at, cooldown_hours)) {
    return {
      fire: true,
      next: {
        notifications_sent_count: 1,
        last_triggered_at: now.toISOString(),
      },
    };
  }

  // Still inside the current cycle. Fire only if under the cap.
  if (notifications_sent_count < max_notifications) {
    return {
      fire: true,
      next: {
        notifications_sent_count: notifications_sent_count + 1,
        // Anchor stays put — the cycle is still the same.
        last_triggered_at,
      },
    };
  }

  // At or over the cap, still inside the cycle. Block.
  return unchanged;
}
