/**
 * Tests for legal content — EULA and Privacy Policy structure
 *
 * Validates that legal documents have all required sections per PRD.
 * TDD: current content uses "WeatherWatch" branding but PRD spec is "PingWeather".
 * Those tests SHOULD fail until the content is updated.
 */

import { EULA_CONTENT, PRIVACY_POLICY_CONTENT } from '../../src/data/legal-content';

describe('Legal content', () => {
  // ── EULA ──────────────────────────────────────────────────

  describe('EULA_CONTENT', () => {
    it('has a version', () => {
      expect(EULA_CONTENT.version).toBeTruthy();
      expect(typeof EULA_CONTENT.version).toBe('string');
    });

    it('has an effective date', () => {
      expect(EULA_CONTENT.effectiveDate).toBeTruthy();
    });

    it('has a title', () => {
      expect(EULA_CONTENT.title).toBeTruthy();
    });

    it('has at least one section', () => {
      expect(Array.isArray(EULA_CONTENT.sections)).toBe(true);
      expect(EULA_CONTENT.sections.length).toBeGreaterThan(0);
    });

    it('every section has a title and body', () => {
      for (const section of EULA_CONTENT.sections) {
        expect(section.title).toBeTruthy();
        expect(section.body).toBeTruthy();
      }
    });

    it('contains a Weather Data Disclaimer section', () => {
      // PRD critical: weather forecasts are inherently uncertain disclaimer
      const section = EULA_CONTENT.sections.find((s) =>
        /weather.*(disclaimer|data)/i.test(s.title),
      );
      expect(section).toBeDefined();
      expect(section!.body).toMatch(/forecast/i);
      expect(section!.body).toMatch(/uncertain|guarantee|accuracy/i);
    });

    it('contains a Notification Delivery section', () => {
      // PRD: notification delivery not guaranteed
      const section = EULA_CONTENT.sections.find((s) => /notification/i.test(s.title));
      expect(section).toBeDefined();
      expect(section!.body).toMatch(/delivery|guarantee/i);
    });

    it('contains a Limitation of Liability section', () => {
      const section = EULA_CONTENT.sections.find((s) => /limitation of liability/i.test(s.title));
      expect(section).toBeDefined();
    });

    it('references Truth Centered Tech as the entity', () => {
      // PRD: Truth Centered Tech, Delaware, US
      const allText = EULA_CONTENT.sections.map((s) => `${s.title} ${s.body}`).join(' ');
      expect(allText).toMatch(/Truth Centered Tech/i);
    });

    it('uses the PingWeather product name (not WeatherWatch)', () => {
      // TDD: PRD says app name is "PingWeather" — current content still says "WeatherWatch"
      const allText = EULA_CONTENT.sections.map((s) => `${s.title} ${s.body}`).join(' ');
      expect(allText).toMatch(/PingWeather/);
      expect(allText).not.toMatch(/WeatherWatch/);
    });

    it('references Delaware as governing law', () => {
      const section = EULA_CONTENT.sections.find((s) => /governing law/i.test(s.title));
      expect(section).toBeDefined();
      expect(section!.body).toMatch(/Delaware/i);
    });

    it('references legal@truthcenteredtech.com contact', () => {
      const allText = EULA_CONTENT.sections.map((s) => s.body).join(' ');
      expect(allText).toMatch(/legal@truthcenteredtech\.com/);
    });
  });

  // ── Privacy Policy ────────────────────────────────────────

  describe('PRIVACY_POLICY_CONTENT', () => {
    it('has a version', () => {
      expect(PRIVACY_POLICY_CONTENT.version).toBeTruthy();
    });

    it('has an effective date', () => {
      expect(PRIVACY_POLICY_CONTENT.effectiveDate).toBeTruthy();
    });

    it('has at least one section', () => {
      expect(PRIVACY_POLICY_CONTENT.sections.length).toBeGreaterThan(0);
    });

    it('every section has a title and body', () => {
      for (const section of PRIVACY_POLICY_CONTENT.sections) {
        expect(section.title).toBeTruthy();
        expect(section.body).toBeTruthy();
      }
    });

    it('contains a GDPR section for European users', () => {
      // PRD: GDPR compliance required
      const section = PRIVACY_POLICY_CONTENT.sections.find((s) => /GDPR/i.test(s.title));
      expect(section).toBeDefined();
      expect(section!.body).toMatch(/right/i);
    });

    it('contains a CCPA section for California users', () => {
      // PRD: CCPA compliance required
      const section = PRIVACY_POLICY_CONTENT.sections.find((s) => /CCPA/i.test(s.title));
      expect(section).toBeDefined();
      expect(section!.body).toMatch(/California/i);
    });

    it('contains a COPPA / Children\'s Privacy section', () => {
      // PRD: COPPA compliance required
      const section = PRIVACY_POLICY_CONTENT.sections.find(
        (s) => /COPPA|children/i.test(s.title),
      );
      expect(section).toBeDefined();
      expect(section!.body).toMatch(/child|13/i);
    });

    it('contains a Data Deletion section', () => {
      const section = PRIVACY_POLICY_CONTENT.sections.find((s) =>
        /deletion|data deletion/i.test(s.title),
      );
      expect(section).toBeDefined();
    });

    it('references Truth Centered Tech as the entity', () => {
      const allText = PRIVACY_POLICY_CONTENT.sections.map((s) => s.body).join(' ');
      expect(allText).toMatch(/Truth Centered Tech/);
    });

    it('uses the PingWeather product name (not WeatherWatch)', () => {
      // TDD: rebrand needed
      const allText = PRIVACY_POLICY_CONTENT.sections.map((s) => `${s.title} ${s.body}`).join(' ');
      expect(allText).toMatch(/PingWeather/);
      expect(allText).not.toMatch(/WeatherWatch/);
    });

    it('references privacy@truthcenteredtech.com contact', () => {
      const allText = PRIVACY_POLICY_CONTENT.sections.map((s) => s.body).join(' ');
      expect(allText).toMatch(/privacy@truthcenteredtech\.com/);
    });
  });

  // ── Cross-document invariants ─────────────────────────────

  describe('cross-document invariants', () => {
    it('EULA and Privacy Policy have versions set', () => {
      expect(EULA_CONTENT.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(PRIVACY_POLICY_CONTENT.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('both documents have effective dates', () => {
      expect(EULA_CONTENT.effectiveDate).toBeTruthy();
      expect(PRIVACY_POLICY_CONTENT.effectiveDate).toBeTruthy();
    });
  });
});
