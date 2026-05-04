/**
 * Tests for moonPhase utilities — getMoonIllumination, getMoonIlluminationForDate,
 * and getMoonEmoji.
 *
 * Algorithm: Julian Date → days since known new moon (Jan 6 2000 UTC = JD 2451550.1)
 * → modulo synodic period (29.53058867 days) → phase angle → illumination.
 *
 * Known reference dates used for regression anchors:
 *   New moon:         2000-01-06 (the known anchor, ~0% lit)
 *   Waxing crescent:  2000-01-09 (~6.4% lit)
 *   First quarter:    2000-01-13 (~50% lit, waxing)
 *   Waxing gibbous:   2000-01-16 (~71% lit)
 *   Full moon:        2000-01-20 (~98% lit)
 *   Waning gibbous:   2000-01-25 (~86% lit)
 *   Last quarter:     2000-01-29 (~47% lit, waning)
 *   Waning crescent:  2000-02-01 (~18% lit)
 *   Next new moon:    2000-02-05
 */

import {
  getMoonIllumination,
  getMoonIlluminationForDate,
  getMoonEmoji,
} from '../../src/utils/moonPhase';

describe('getMoonIllumination', () => {
  it('returns near 0 at the known new moon anchor (Jan 6 2000 UTC)', () => {
    // JD 2451550.1 is the known new moon used as our epoch anchor.
    // At this exact date, days-since-new-moon ≈ 0, so illumination ≈ 0.
    const newMoon = new Date('2000-01-06T18:14:00Z'); // approx new moon time
    const illum = getMoonIllumination(newMoon);
    expect(illum).toBeGreaterThanOrEqual(0);
    expect(illum).toBeLessThan(10); // within 10% of new moon
  });

  it('returns near 100 at a known full moon (Jan 20 2000 UTC)', () => {
    // ~14.77 days after the Jan 6 2000 new moon is the first full moon.
    // Illumination should be close to 100.
    const fullMoon = new Date('2000-01-20T04:41:00Z'); // approx full moon time
    const illum = getMoonIllumination(fullMoon);
    expect(illum).toBeGreaterThan(90); // within 10% of full
    expect(illum).toBeLessThanOrEqual(100);
  });

  it('returns approximately 50 at first quarter (~7 days after new moon)', () => {
    // First quarter is ~7.38 days after new moon. Illumination ≈ 50%.
    // We allow a wide ±20% band since the exact quarter time varies.
    const firstQuarter = new Date('2000-01-13T22:00:00Z'); // ~7.16 days after Jan 6
    const illum = getMoonIllumination(firstQuarter);
    expect(illum).toBeGreaterThan(30);
    expect(illum).toBeLessThan(70);
  });

  it('returns near 0 again one synodic period after the anchor', () => {
    // Exactly one synodic period (29.53058867 days) after the anchor is
    // the next new moon — illumination should again be near 0.
    const nextNewMoon = new Date('2000-02-05T13:03:00Z'); // approx next new moon
    const illum = getMoonIllumination(nextNewMoon);
    expect(illum).toBeGreaterThanOrEqual(0);
    expect(illum).toBeLessThan(10);
  });

  it('always returns a value between 0 and 100 inclusive', () => {
    // Fuzz test: 30 dates spanning 3 years should all produce valid output.
    const start = new Date('2024-01-01').getTime();
    const msPerDay = 86_400_000;
    for (let i = 0; i < 30; i++) {
      const d = new Date(start + i * 37 * msPerDay); // sample every 37 days
      const illum = getMoonIllumination(d);
      expect(illum).toBeGreaterThanOrEqual(0);
      expect(illum).toBeLessThanOrEqual(100);
    }
  });
});

describe('getMoonIlluminationForDate', () => {
  it('parses YYYY-MM-DD string and returns same value as getMoonIllumination for that UTC date', () => {
    const dateStr = '2024-03-25'; // a known date
    const fromString = getMoonIlluminationForDate(dateStr);
    // midnight UTC for that date
    const fromDate = getMoonIllumination(new Date('2024-03-25T00:00:00.000Z'));
    expect(fromString).toBeCloseTo(fromDate, 1);
  });

  it('handles an invalid date string gracefully (returns 0)', () => {
    // The contract: invalid input should not throw and should return 0
    // (a safe fallback — new moon is a valid moon state).
    const illum = getMoonIlluminationForDate('not-a-date');
    expect(typeof illum).toBe('number');
    expect(illum).toBe(0);
  });
});

describe('getMoonEmoji', () => {
  // Reference illumination values confirmed via the test harness:
  //   2000-01-06: ~0.07%  → new moon
  //   2000-01-09: ~6.38%  → waxing crescent (just above 6.25 threshold)
  //   2000-01-16: ~70.81% → waxing gibbous
  //   2000-01-20: ~97.91% → full moon (>93.75)
  //   2000-01-25: ~85.78% → waning gibbous
  //   2000-01-29: ~47.32% → last quarter (43.75–56.25, waning)
  //   2000-02-01: ~18.10% → waning crescent (6.25–43.75, waning)

  it('returns new moon emoji at the anchor date (illumination ~0)', () => {
    const illum = getMoonIlluminationForDate('2000-01-06');
    const emoji = getMoonEmoji(illum, '2000-01-06');
    expect(emoji).toBe('🌑');
  });

  it('returns waxing crescent for a date shortly after new moon', () => {
    // Jan 09 = ~6.38% illumination, waxing — just above 6.25 threshold
    const illum = getMoonIlluminationForDate('2000-01-09');
    const emoji = getMoonEmoji(illum, '2000-01-09');
    expect(emoji).toBe('🌒');
  });

  it('returns waxing gibbous for a date between first quarter and full moon', () => {
    // Jan 16 = ~70.81% illumination, waxing
    const illum = getMoonIlluminationForDate('2000-01-16');
    const emoji = getMoonEmoji(illum, '2000-01-16');
    expect(emoji).toBe('🌔');
  });

  it('returns full moon emoji at the known full moon date', () => {
    // Jan 20 = ~97.91% illumination (> 93.75 threshold)
    const illum = getMoonIlluminationForDate('2000-01-20');
    const emoji = getMoonEmoji(illum, '2000-01-20');
    expect(emoji).toBe('🌕');
  });

  it('returns waning gibbous shortly after the full moon', () => {
    // Jan 25 = ~85.78% illumination, waning (43.75–93.75, waning half)
    const illum = getMoonIlluminationForDate('2000-01-25');
    const emoji = getMoonEmoji(illum, '2000-01-25');
    expect(emoji).toBe('🌖');
  });

  it('returns last quarter emoji around last quarter phase', () => {
    // Jan 29 = ~47.32% illumination, waning (43.75–56.25, waning half)
    const illum = getMoonIlluminationForDate('2000-01-29');
    const emoji = getMoonEmoji(illum, '2000-01-29');
    expect(emoji).toBe('🌗');
  });

  it('returns waning crescent before the next new moon', () => {
    // Feb 01 = ~18.10% illumination, waning (6.25–43.75, waning half)
    const illum = getMoonIlluminationForDate('2000-02-01');
    const emoji = getMoonEmoji(illum, '2000-02-01');
    expect(emoji).toBe('🌘');
  });

  it('returns one of the 8 valid moon emojis for any date', () => {
    const valid = new Set(['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘']);
    const start = new Date('2024-01-01').getTime();
    const msPerDay = 86_400_000;
    for (let i = 0; i < 60; i++) {
      const d = new Date(start + i * 3 * msPerDay); // every 3 days
      const isoDate = d.toISOString().slice(0, 10);
      const illum = getMoonIlluminationForDate(isoDate);
      const emoji = getMoonEmoji(illum, isoDate);
      expect(valid.has(emoji)).toBe(true);
    }
  });

  it('handles an invalid date string without throwing', () => {
    expect(() => getMoonEmoji(0, 'invalid')).not.toThrow();
    const emoji = getMoonEmoji(0, 'invalid');
    expect(typeof emoji).toBe('string');
    expect(emoji.length).toBeGreaterThan(0);
  });
});
