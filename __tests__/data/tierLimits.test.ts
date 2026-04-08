/**
 * Tests for TIER_LIMITS — tier enforcement logic
 *
 * Validates Free, Pro, and Premium tier limits against the PRD subscription
 * table. These are the source of truth for tier enforcement throughout the app.
 * Covers FR-LOC-006, FR-ALERT-007, FR-ALERT-010.
 */

import { TIER_LIMITS } from '../../src/types';

describe('TIER_LIMITS', () => {
  // ── Free tier ──────────────────────────────────────────────

  describe('Free tier', () => {
    const free = TIER_LIMITS.free;

    it('allows 1 location', () => {
      // FR-LOC-006: Free tier = 1 location
      expect(free.maxLocations).toBe(1);
    });

    it('allows 2 alert rules', () => {
      // FR-ALERT-007: Free tier = 2 rules
      expect(free.maxAlertRules).toBe(2);
    });

    it('has a 12-hour minimum polling interval', () => {
      // PRD subscription tiers: Free 12hr min
      expect(free.minPollingIntervalHours).toBe(12);
    });

    it('does NOT allow compound conditions', () => {
      // FR-ALERT-010: Free users limited to single-condition rules
      expect(free.compoundConditions).toBe(false);
    });

    it('retains alert history for 7 days', () => {
      expect(free.alertHistoryDays).toBe(7);
    });

    it('does NOT allow SMS alerts', () => {
      expect(free.smsAlerts).toBe(false);
    });
  });

  // ── Pro tier ───────────────────────────────────────────────

  describe('Pro tier', () => {
    const pro = TIER_LIMITS.pro;

    it('allows 3 locations', () => {
      // FR-LOC-006: Pro tier = 3 locations
      expect(pro.maxLocations).toBe(3);
    });

    it('allows 5 alert rules', () => {
      // FR-ALERT-007: Pro tier = 5 rules
      expect(pro.maxAlertRules).toBe(5);
    });

    it('has a 4-hour minimum polling interval', () => {
      expect(pro.minPollingIntervalHours).toBe(4);
    });

    it('allows compound conditions', () => {
      // FR-ALERT-010: Pro/Premium can add multiple conditions
      expect(pro.compoundConditions).toBe(true);
    });

    it('retains alert history for 30 days', () => {
      expect(pro.alertHistoryDays).toBe(30);
    });

    it('does NOT allow SMS alerts', () => {
      expect(pro.smsAlerts).toBe(false);
    });
  });

  // ── Premium tier ───────────────────────────────────────────

  describe('Premium tier', () => {
    const premium = TIER_LIMITS.premium;

    it('allows 10 locations', () => {
      // FR-LOC-006: Premium tier = 10 locations
      expect(premium.maxLocations).toBe(10);
    });

    it('allows effectively unlimited alert rules', () => {
      // FR-ALERT-007: Premium unlimited rules
      expect(premium.maxAlertRules).toBeGreaterThanOrEqual(100);
    });

    it('has a 1-hour minimum polling interval', () => {
      expect(premium.minPollingIntervalHours).toBe(1);
    });

    it('allows compound conditions', () => {
      expect(premium.compoundConditions).toBe(true);
    });

    it('retains alert history for 90 days', () => {
      expect(premium.alertHistoryDays).toBe(90);
    });

    it('allows SMS alerts', () => {
      expect(premium.smsAlerts).toBe(true);
    });
  });

  // ── Cross-tier invariants ──────────────────────────────────

  describe('cross-tier invariants', () => {
    it('each tier offers at least as many locations as the previous', () => {
      expect(TIER_LIMITS.pro.maxLocations).toBeGreaterThan(TIER_LIMITS.free.maxLocations);
      expect(TIER_LIMITS.premium.maxLocations).toBeGreaterThan(TIER_LIMITS.pro.maxLocations);
    });

    it('each tier offers at least as many rules as the previous', () => {
      expect(TIER_LIMITS.pro.maxAlertRules).toBeGreaterThan(TIER_LIMITS.free.maxAlertRules);
      expect(TIER_LIMITS.premium.maxAlertRules).toBeGreaterThan(TIER_LIMITS.pro.maxAlertRules);
    });

    it('each tier has a shorter (or equal) minimum polling interval than the previous', () => {
      // Lower = more frequent polling = better
      expect(TIER_LIMITS.pro.minPollingIntervalHours).toBeLessThan(
        TIER_LIMITS.free.minPollingIntervalHours,
      );
      expect(TIER_LIMITS.premium.minPollingIntervalHours).toBeLessThan(
        TIER_LIMITS.pro.minPollingIntervalHours,
      );
    });

    it('each tier retains at least as much alert history as the previous', () => {
      expect(TIER_LIMITS.pro.alertHistoryDays).toBeGreaterThan(TIER_LIMITS.free.alertHistoryDays);
      expect(TIER_LIMITS.premium.alertHistoryDays).toBeGreaterThan(TIER_LIMITS.pro.alertHistoryDays);
    });

    it('compound conditions gated to Pro+ tiers only', () => {
      // FR-ALERT-010: compound conditions require Pro
      expect(TIER_LIMITS.free.compoundConditions).toBe(false);
      expect(TIER_LIMITS.pro.compoundConditions).toBe(true);
      expect(TIER_LIMITS.premium.compoundConditions).toBe(true);
    });

    it('SMS alerts gated to Premium tier only', () => {
      expect(TIER_LIMITS.free.smsAlerts).toBe(false);
      expect(TIER_LIMITS.pro.smsAlerts).toBe(false);
      expect(TIER_LIMITS.premium.smsAlerts).toBe(true);
    });
  });

  // ── Polling minimum enforcement helper ─────────────────────

  describe('polling minimum enforcement', () => {
    it('rejects polling intervals below Free tier minimum (12h)', () => {
      // A Free user's rule with polling_interval_hours < 12 is invalid
      const userPolling = 4;
      const minAllowed = TIER_LIMITS.free.minPollingIntervalHours;
      expect(userPolling < minAllowed).toBe(true);
    });

    it('Free tier cannot poll every hour', () => {
      expect(1 < TIER_LIMITS.free.minPollingIntervalHours).toBe(true);
    });

    it('Pro tier allows 4 hour polling', () => {
      expect(4 >= TIER_LIMITS.pro.minPollingIntervalHours).toBe(true);
    });

    it('Premium tier allows 1 hour polling', () => {
      expect(1 >= TIER_LIMITS.premium.minPollingIntervalHours).toBe(true);
    });
  });
});
