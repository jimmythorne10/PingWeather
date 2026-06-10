// BUG-010: send-digest local weatherCodeToEmoji is out of sync with _shared/weatherEngine.ts
// WMO codes 10-19 should map to rain (🌧️) not fog (🌫️) — the local copy lumps them with fog.
//
// This test imports the SHARED engine (the authoritative source) and asserts the correct
// mapping for a code in the 10-19 range. Once send-digest removes its local copy and
// imports from the shared engine, this test continues to pass — and serves as a permanent
// regression guard.

import { weatherCodeToEmoji } from '../../src/utils/weatherEngine';

describe('weatherCodeToEmoji (shared engine — BUG-010 regression)', () => {
  it('code 15 (drizzle) maps to rain emoji 🌧️, not fog 🌫️', () => {
    expect(weatherCodeToEmoji(15)).toBe('🌧️');
  });

  it('code 10 maps to rain emoji 🌧️, not fog 🌫️', () => {
    expect(weatherCodeToEmoji(10)).toBe('🌧️');
  });

  it('code 19 maps to rain emoji 🌧️, not fog 🌫️', () => {
    expect(weatherCodeToEmoji(19)).toBe('🌧️');
  });

  it('code 5 maps to fog emoji 🌫️', () => {
    // codes 4-9 ARE fog in the shared engine
    expect(weatherCodeToEmoji(5)).toBe('🌫️');
  });

  it('code 0 maps to sunny ☀️', () => {
    expect(weatherCodeToEmoji(0)).toBe('☀️');
  });

  it('code 3 maps to partly cloudy ⛅', () => {
    expect(weatherCodeToEmoji(3)).toBe('⛅');
  });
});
