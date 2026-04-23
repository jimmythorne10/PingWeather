import { formatDigestNotification } from '../../src/services/digestFormatter';

// Open-Meteo daily response shape (Fahrenheit/mph — same units as poll-weather fetchForecast)
const mockForecast = {
  daily: {
    time: ['2026-04-22', '2026-04-23', '2026-04-24', '2026-04-25', '2026-04-26', '2026-04-27', '2026-04-28'],
    temperature_2m_max: [72.0, 68.0, 65.0, 70.0, 74.0, 71.0, 69.0],
    temperature_2m_min: [48.0, 51.0, 50.0, 52.0, 55.0, 49.0, 47.0],
    precipitation_probability_max: [10, 60, 80, 30, 5, 15, 40],
    wind_speed_10m_max: [8.0, 18.0, 22.0, 10.0, 6.0, 12.0, 9.0],
  },
};

describe('formatDigestNotification', () => {
  describe('daily format (Fahrenheit)', () => {
    const result = formatDigestNotification(mockForecast, 'North Pasture', 'fahrenheit', 'daily');

    it('title includes location name', () => {
      expect(result.title).toContain('North Pasture');
    });

    it('body includes today high and low in °F', () => {
      expect(result.body).toContain('72°F');
      expect(result.body).toContain('48°F');
    });

    it('body includes precipitation probability', () => {
      expect(result.body).toContain('10%');
    });

    it('body includes wind speed', () => {
      expect(result.body).toContain('8 mph');
    });
  });

  describe('daily format (Celsius)', () => {
    const result = formatDigestNotification(mockForecast, 'North Pasture', 'celsius', 'daily');

    it('converts high to Celsius (72°F = 22°C)', () => {
      expect(result.body).toContain('22°C');
    });

    it('converts low to Celsius (48°F = 9°C)', () => {
      expect(result.body).toContain('9°C');
    });
  });

  describe('weekly format', () => {
    const result = formatDigestNotification(mockForecast, 'North Pasture', 'fahrenheit', 'weekly');

    it('title mentions the week', () => {
      expect(result.title.toLowerCase()).toMatch(/week|forecast/);
    });

    it('body includes multiple days of data', () => {
      // weekly should include more than just today — check for multiple temp values
      const tempMatches = result.body.match(/°F/g) ?? [];
      expect(tempMatches.length).toBeGreaterThan(1);
    });

    it('body includes the highest rain day probability', () => {
      expect(result.body).toContain('80%');
    });
  });

  it('throws if daily.time array is empty', () => {
    const emptyForecast = { daily: { ...mockForecast.daily, time: [] } };
    expect(() => formatDigestNotification(emptyForecast, 'Test', 'fahrenheit', 'daily')).toThrow();
  });
});
