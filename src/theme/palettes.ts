// ────────────────────────────────────────────────────────────
// WeatherBeacon — PALETTE tokens (colour).
//
// Structure lives in ./looks.ts. This file owns colour only.
//
// classic / dark / storm are CARRIED FORWARD from tokens.ts by reference, not
// copied and not edited — the spec puts changing them out of scope, and
// FEAT-003 asserts PALETTES[name] deep-equals THEMES[name] for all three.
//
// blaze / timber are the two new Aurora palettes. Both are dark, drawn from
// the hunting world rather than from a dashboard.
//
// THE ACCENT IS NOT THE WEATHER. `primary`/`accent2` colour interface chrome
// only — active tab, armed pill, hero gradient, FAB. Overnight lows and freeze
// figures use `freezeBlue`, which stays cold in every palette, because this
// app's signature alert is a freeze and an orange freeze warning is nonsense.
// ────────────────────────────────────────────────────────────

import { THEMES, type ThemeTokens } from './tokens';

export type PaletteName = 'classic' | 'dark' | 'storm' | 'blaze' | 'timber';

/** Extras only the Aurora look consumes. Legacy palettes do not carry them. */
export interface AuroraExtras {
  /** Gradient end-stop. `primary` is the start. */
  accent2: string;
  /** Ambient bloom behind the header. */
  glowFrom: string;
  glowTo: string;
}

export type PaletteTokens = ThemeTokens & Partial<AuroraExtras>;

// Blaze — safety orange on warm black. The colour this audience is legally
// required to wear, so the app reads as hunting before a word is understood.
const blaze: PaletteTokens = {
  background: '#0B0A09',
  card: '#14110F',
  inputBackground: '#1A1613',

  primary: '#FF4D0F',
  primaryLight: '#2A1308',
  primaryDisabled: '#5A4A42',

  textPrimary: '#F7F3EF',
  textSecondary: '#B8ADA4',
  textTertiary: '#78706A',
  textOnPrimary: '#FFFFFF',

  border: '#2E2823',
  borderLight: '#221D19',
  divider: '#221D19',

  success: '#6FBF73',
  successDark: '#4E9A57',
  error: '#FF6B5A',
  errorLight: '#3A1714',
  warning: '#FFB04A',
  warningLight: '#332208',
  info: '#6FB6E8',

  freezeBlue: '#6FB6E8',
  heatRed: '#FF8A6B',
  rainBlue: '#5AA8DC',
  windGray: '#9A9089',

  headerBackground: '#0B0A09',
  headerTint: '#F7F3EF',
  tabBarActiveTint: '#FF9A3D',
  tabBarInactiveTint: '#78706A',
  tabBarBackground: '#14110F',
  tabBarBorder: '#2E2823',
  statusBarStyle: 'light',

  accent2: '#FF9A3D',
  glowFrom: 'rgba(255, 77, 15, 0.50)',
  glowTo: 'rgba(255, 138, 43, 0.20)',
};

// Timber — moss into aged brass on a green-black ground. No orange anywhere.
// Reads as gear rather than as an app, and keeps ranchers and outdoor crews in
// frame instead of narrowing the product to hunting alone.
const timber: PaletteTokens = {
  background: '#0A0C0A',
  card: '#111510',
  inputBackground: '#161A15',

  primary: '#46743A',
  primaryLight: '#16250F',
  primaryDisabled: '#4A5245',

  textPrimary: '#F0F2EA',
  textSecondary: '#A8B09C',
  textTertiary: '#6B7263',
  textOnPrimary: '#FFFFFF',

  border: '#262C22',
  borderLight: '#1C2119',
  divider: '#1C2119',

  success: '#8FC47A',
  successDark: '#5F9A50',
  error: '#D97A6B',
  errorLight: '#331A15',
  warning: '#C0A03A',
  warningLight: '#2B2410',
  info: '#7FB5C4',

  freezeBlue: '#7FB5C4',
  heatRed: '#D98A6B',
  rainBlue: '#6FA6B8',
  windGray: '#8A9280',

  headerBackground: '#0A0C0A',
  headerTint: '#F0F2EA',
  tabBarActiveTint: '#C0A03A',
  tabBarInactiveTint: '#6B7263',
  tabBarBackground: '#111510',
  tabBarBorder: '#262C22',
  statusBarStyle: 'light',

  accent2: '#C0A03A',
  glowFrom: 'rgba(70, 116, 58, 0.52)',
  glowTo: 'rgba(192, 160, 58, 0.20)',
};

export const PALETTES: Record<PaletteName, PaletteTokens> = {
  // Referenced, not spread — a spread would silently diverge the moment
  // tokens.ts changed, and FEAT-003 exists to catch exactly that.
  classic: THEMES.classic,
  dark: THEMES.dark,
  storm: THEMES.storm,
  blaze,
  timber,
};

export function isPaletteName(value: string): value is PaletteName {
  return value in PALETTES;
}
