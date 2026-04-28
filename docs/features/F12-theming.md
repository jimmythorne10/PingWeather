# F12: Theming

## Overview
Three hand-tuned color palettes (`classic`, `dark`, `storm`) applied throughout the app via a token-based theme system. Selection persists to AsyncStorage and rehydrates on launch.

## Screens Involved
- Settings `THEME` section with three radio-style rows.
- Every themed component consumes via `useStyles`, `useTokens`, or `useThemeStore((s) => s.tokens)`.

## Data Model
No server storage — theme is a device preference only.

AsyncStorage key: `weatherwatch-theme` with partialized state `{ themeName }`.

## State Management
Store: `src/stores/themeStore.ts`

State:
```
themeName: ThemeName  // 'classic' | 'dark' | 'storm'
tokens: ThemeTokens   // full color set, derived from THEMES[themeName]
setTheme(name: ThemeName)
```

Rehydrate logic: after AsyncStorage reads `themeName`, `onRehydrateStorage` sets `state.tokens = THEMES[state.themeName]`.

Hooks (`src/theme/useStyles.ts`, re-exported via `src/theme/index.ts`):
- `useTokens()` — returns current `tokens` object
- `useStyles(createStyles)` — memoizes a StyleSheet factory keyed on the current theme

## Business Rules
- **Three themes** defined in `src/theme/tokens.ts`:
  - `classic` (default) — white backgrounds, deep navy primary (#1E3A5F)
  - `dark` — gray-900 backgrounds, sky-blue primary (#63B3ED)
  - `storm` — slate-950 backgrounds, electric cyan primary (#38BDF8)
- **Tokens cover**: backgrounds, primary + variants, text (primary/secondary/tertiary/on-primary), borders, dividers, semantic (success/error/warning/info), weather-specific (freezeBlue, heatRed, rainBlue, windGray), nav chrome (header/tab bar), status bar style.
- **StatusBar style** hardcoded to `'light'` in `_layout.tsx` regardless of theme (so the system bar always has white glyphs). This is a minor inconsistency — the classic theme could arguably use `'dark'`.
- **Login and signup screens** use `useTokens` directly with inline styles rather than `useStyles(createStyles)` factories.

## API Interactions
None.

## Error Handling
None needed — theme lookups always succeed (enum-indexed record).

## Edge Cases — Handled
- Hot-reload: persisted `themeName` rehydrates `tokens` via `onRehydrateStorage`.
- Unknown theme names can't be stored (TypeScript narrow).

## Edge Cases — NOT Handled (Gaps)
- **No system-theme sync** — Android/iOS dark-mode preference is ignored; users manually pick.
- **No "auto" mode** to follow the OS.
- **StatusBar color inconsistency** — always light regardless of background.
- **No accessibility contrast audit** — some secondary text colors may fail WCAG AA against their backgrounds (not verified).
- **No per-screen theme override** or previews.

## Test Coverage
- `__tests__/stores/themeStore.test.ts` — setTheme, tokens match THEMES[name], rehydrate reinstates tokens.

**Verdict:** Feature is simple; test coverage is adequate. No visual regression tests (no snapshot or Playwright/Maestro).
