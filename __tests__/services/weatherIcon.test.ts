/**
 * Unit tests for weatherCodeToEmoji
 * Covers every branch of the WMO weather code mapping.
 */

import { weatherCodeToEmoji, degreesToCardinal } from '../../src/services/weatherIcon';

describe('weatherCodeToEmoji', () => {
  it('returns clear sky sun for code 0', () => {
    expect(weatherCodeToEmoji(0)).toBe('☀️');
  });

  it('returns partly cloudy for codes 1 and 2', () => {
    expect(weatherCodeToEmoji(1)).toBe('⛅');
    expect(weatherCodeToEmoji(2)).toBe('⛅');
  });

  it('returns cloud for overcast (code 3)', () => {
    expect(weatherCodeToEmoji(3)).toBe('☁️');
  });

  it('returns fog for codes 45 and 48', () => {
    expect(weatherCodeToEmoji(45)).toBe('🌫️');
    expect(weatherCodeToEmoji(48)).toBe('🌫️');
  });

  it('returns light-rain emoji for drizzle range 51–57', () => {
    for (const code of [51, 53, 55, 56, 57]) {
      expect(weatherCodeToEmoji(code)).toBe('🌦️');
    }
  });

  it('returns rain cloud for rain range 61–67', () => {
    for (const code of [61, 63, 65, 66, 67]) {
      expect(weatherCodeToEmoji(code)).toBe('🌧️');
    }
  });

  it('returns snowflake for snow range 71–77', () => {
    for (const code of [71, 73, 75, 77]) {
      expect(weatherCodeToEmoji(code)).toBe('❄️');
    }
  });

  it('returns rain cloud for rain shower range 80–82', () => {
    for (const code of [80, 81, 82]) {
      expect(weatherCodeToEmoji(code)).toBe('🌧️');
    }
  });

  it('returns snow cloud for snow shower codes 85 and 86', () => {
    expect(weatherCodeToEmoji(85)).toBe('🌨️');
    expect(weatherCodeToEmoji(86)).toBe('🌨️');
  });

  it('returns thunderstorm for code 95', () => {
    expect(weatherCodeToEmoji(95)).toBe('⛈️');
  });

  it('returns thunderstorm for hail codes 96 and 99', () => {
    expect(weatherCodeToEmoji(96)).toBe('⛈️');
    expect(weatherCodeToEmoji(99)).toBe('⛈️');
  });

  it('returns question mark for unknown/out-of-range codes', () => {
    expect(weatherCodeToEmoji(-1)).toBe('❓');
    expect(weatherCodeToEmoji(4)).toBe('❓');
    expect(weatherCodeToEmoji(50)).toBe('❓');
    expect(weatherCodeToEmoji(68)).toBe('❓');
    expect(weatherCodeToEmoji(78)).toBe('❓');
    expect(weatherCodeToEmoji(83)).toBe('❓');
    expect(weatherCodeToEmoji(87)).toBe('❓');
    expect(weatherCodeToEmoji(100)).toBe('❓');
    expect(weatherCodeToEmoji(999)).toBe('❓');
  });

  it('treats NaN as unknown', () => {
    expect(weatherCodeToEmoji(Number.NaN)).toBe('❓');
  });
});

describe('degreesToCardinal', () => {
  it('maps 0 to N', () => expect(degreesToCardinal(0)).toBe('N'));
  it('maps 360 to N', () => expect(degreesToCardinal(360)).toBe('N'));
  it('maps 45 to NE', () => expect(degreesToCardinal(45)).toBe('NE'));
  it('maps 90 to E', () => expect(degreesToCardinal(90)).toBe('E'));
  it('maps 135 to SE', () => expect(degreesToCardinal(135)).toBe('SE'));
  it('maps 180 to S', () => expect(degreesToCardinal(180)).toBe('S'));
  it('maps 225 to SW', () => expect(degreesToCardinal(225)).toBe('SW'));
  it('maps 270 to W', () => expect(degreesToCardinal(270)).toBe('W'));
  it('maps 315 to NW', () => expect(degreesToCardinal(315)).toBe('NW'));
  it('rounds 22° to N (boundary)', () => expect(degreesToCardinal(22)).toBe('N'));
  it('rounds 23° to NE (boundary)', () => expect(degreesToCardinal(23)).toBe('NE'));
  it('rounds 337° to NW', () => expect(degreesToCardinal(337)).toBe('NW'));
  it('rounds 338° back to N (wraps)', () => expect(degreesToCardinal(338)).toBe('N'));
});
