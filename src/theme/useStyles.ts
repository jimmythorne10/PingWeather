import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useThemeStore } from '../stores/themeStore';
import type { LookTokens } from './looks';
import type { PaletteTokens } from './palettes';

/**
 * Style factories receive COLOUR first and STRUCTURE second.
 *
 * The colour-first argument order is deliberate and load-bearing: every
 * existing screen is written as `useStyles((t) => ({ … t.primary … }))`, so
 * keeping colour in position one lets all 26 of them keep working untouched
 * while screens migrate to the structural tokens one task at a time. A
 * migrated screen simply widens its factory to `(c, look) => …`.
 */
type StyleFactory<T extends StyleSheet.NamedStyles<T>> = (
  colors: PaletteTokens,
  look: LookTokens
) => T;

export function useStyles<T extends StyleSheet.NamedStyles<T>>(factory: StyleFactory<T>): T {
  const colors = useThemeStore((s) => s.colors);
  const look = useThemeStore((s) => s.tokens);
  return useMemo(() => StyleSheet.create(factory(colors, look)), [colors, look, factory]);
}

/** Colour tokens for the active palette. */
export function useColors(): PaletteTokens {
  return useThemeStore((s) => s.colors);
}

/** Structural tokens for the active look. */
export function useLook(): LookTokens {
  return useThemeStore((s) => s.tokens);
}

/**
 * @deprecated Colour alias kept so the 26 unmigrated callers keep compiling.
 * `useTokens()` meant colour before the look axis existed; the store field it
 * used to read now holds structure, so this forwards to `useColors()` rather
 * than silently handing screens a set of numbers where they expect hex.
 * Migrating callers should move to `useColors()` / `useLook()`.
 */
export function useTokens(): PaletteTokens {
  return useColors();
}
