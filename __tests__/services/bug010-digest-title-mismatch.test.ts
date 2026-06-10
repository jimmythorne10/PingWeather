// BUG-010: digestFormatter title/maxDays mismatch
//
// Weekly: title says "7-day forecast" but buildLines uses maxDays=5 → body has 5 lines.
// Daily:  title says "Today's forecast" but buildLines uses maxDays=3 → body has 3 lines,
//         implying it covers more than just today.
//
// Fix: weekly → "5-day forecast" with maxDays=5 (or bump to 7). daily → "Next 3-day forecast"
// or maxDays=1. The key invariant: the number in the title must match the line count.

import { formatDigestNotification } from '../../src/services/digestFormatter';

const mockForecast = {
  daily: {
    time: ['2026-04-22', '2026-04-23', '2026-04-24', '2026-04-25', '2026-04-26', '2026-04-27', '2026-04-28'],
    temperature_2m_max: [72.0, 68.0, 65.0, 70.0, 74.0, 71.0, 69.0],
    temperature_2m_min: [48.0, 51.0, 50.0, 52.0, 55.0, 49.0, 47.0],
    precipitation_probability_max: [10, 60, 80, 30, 5, 15, 40],
    wind_speed_10m_max: [8.0, 18.0, 22.0, 10.0, 6.0, 12.0, 9.0],
    weather_code: [0, 3, 61, 2, 0, 1, 80],
  },
};

describe('formatDigestNotification — title/day-count consistency (BUG-010)', () => {
  describe('weekly format', () => {
    const result = formatDigestNotification(mockForecast, 'Test Ranch', 'fahrenheit', 'weekly');

    it('title day count matches actual line count in body', () => {
      const lineCount = result.body.split('\n').length;
      // Extract the leading number from the title (e.g. "5-day" → 5)
      const match = result.title.match(/(\d+)-day/);
      expect(match).not.toBeNull();
      const titleDays = parseInt(match![1], 10);
      expect(titleDays).toBe(lineCount);
    });

    it('title does NOT claim 7 days when body only has 5', () => {
      // Pre-fix this fails: title says "7-day forecast" but body.split('\n').length === 5
      const lineCount = result.body.split('\n').length;
      const match = result.title.match(/(\d+)-day/);
      if (match) {
        expect(parseInt(match[1], 10)).not.toBe(7);
      }
    });
  });

  describe('daily format', () => {
    const result = formatDigestNotification(mockForecast, 'Test Ranch', 'fahrenheit', 'daily');

    it('title accurately reflects that multiple days are shown (not just "Today")', () => {
      const lineCount = result.body.split('\n').length;
      // If the title says "Today's forecast" but body shows 3 lines, that is misleading.
      // Post-fix: either title says "Next 3-day forecast" or maxDays=1 (title may say "Today").
      // The invariant: if lineCount > 1, title must NOT say "Today's" (implying a single day).
      if (lineCount > 1) {
        expect(result.title).not.toMatch(/^Today's forecast/);
      }
    });
  });
});
