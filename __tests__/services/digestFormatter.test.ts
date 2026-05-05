import { formatDigestNotification } from '../../src/services/digestFormatter';

// Open-Meteo daily response shape (Fahrenheit/mph — same units as poll-weather fetchForecast)
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

describe('formatDigestNotification', () => {
  describe('daily format (Fahrenheit)', () => {
    const result = formatDigestNotification(mockForecast, 'North Pasture', 'fahrenheit', 'daily');

    it('title includes location name', () => {
      expect(result.title).toContain('North Pasture');
    });

    it('body shows 3 days separated by newlines', () => {
      expect(result.body.split('\n')).toHaveLength(3);
    });

    it('first line contains Today', () => {
      expect(result.body.split('\n')[0]).toContain('Today');
    });

    it('first line starts with weather emoji (code 0 → ☀️)', () => {
      expect(result.body.split('\n')[0]).toMatch(/^☀️/);
    });

    it('body includes today high in °F', () => {
      expect(result.body).toContain('72°F');
    });

    it('body includes today low in °F', () => {
      expect(result.body).toContain('48°F');
    });

    it('low rain probability (10%) is omitted from first line', () => {
      expect(result.body.split('\n')[0]).not.toContain('%');
    });

    it('high rain probability (60%) appears on second line', () => {
      expect(result.body.split('\n')[1]).toContain('60%');
    });

    it('second line contains Tomorrow', () => {
      expect(result.body.split('\n')[1]).toContain('Tomorrow');
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

  describe('daily format without weather_code', () => {
    const forecastNoCode = {
      daily: { ...mockForecast.daily, weather_code: undefined },
    };
    const result = formatDigestNotification(forecastNoCode, 'North Pasture', 'fahrenheit', 'daily');

    it('body still shows 3 days when weather_code is absent', () => {
      expect(result.body.split('\n')).toHaveLength(3);
    });

    it('first line starts with Today when no emoji', () => {
      expect(result.body.split('\n')[0]).toMatch(/^Today/);
    });
  });

  describe('weekly format', () => {
    const result = formatDigestNotification(mockForecast, 'North Pasture', 'fahrenheit', 'weekly');

    it('title mentions the week or forecast', () => {
      expect(result.title.toLowerCase()).toMatch(/week|forecast/);
    });

    it('body shows 5 days separated by newlines', () => {
      expect(result.body.split('\n')).toHaveLength(5);
    });

    it('body includes the highest rain day probability (80%)', () => {
      expect(result.body).toContain('80%');
    });
  });

  it('throws if daily.time array is empty', () => {
    const emptyForecast = { daily: { ...mockForecast.daily, time: [] } };
    expect(() => formatDigestNotification(emptyForecast, 'Test', 'fahrenheit', 'daily')).toThrow();
  });
});
