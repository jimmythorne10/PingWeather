/**
 * Tests for moonPhase utilities — getMoonIllumination and getMoonIlluminationForDate.
 *
 * Algorithm: Julian Date → days since known new moon (Jan 6 2000 UTC = JD 2451550.1)
 * → modulo synodic period (29.53058867 days) → phase angle → illumination.
 *
 * Known reference dates used for regression anchors:
 *   New moon:       2000-01-06 (the known anchor)
 *   Full moon:      ~14.765 days after new moon, i.e. ~2000-01-20 (Jan 20)
 *   First quarter:  ~7.38 days after new moon, i.e. ~2000-01-13 (Jan 13)
 *   Another new:    one full synodic period after anchor = 2000-02-05
 */

import {
  getMoonIllumination,
  getMoonIlluminationForDate,
} from '../src/utils/moonPhase';

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
