import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useThemeStore } from '../stores/themeStore';
import type { ThemeTokens } from './tokens';

type StyleFactory<T extends StyleSheet.NamedStyles<T>> = (tokens: ThemeTokens) => T;

export function useStyles<T extends StyleSheet.NamedStyles<T>>(factory: StyleFactory<T>): T {
  const tokens = useThemeStore((s) => s.tokens);
  return useMemo(() => StyleSheet.create(factory(tokens)), [tokens, factory]);
}

export function useTokens(): ThemeTokens {
  return useThemeStore((s) => s.tokens);
}
