# Plan — design-system-v2

**Spec:** `.claude/specs/design-system-v2/spec.md` (frozen, `sha256:241114cb…`)
**Branch:** `feature/design-system-v2`

---

## 1. New modules

| File | Purpose | Layer | Complexity |
| --- | --- | --- | --- |
| `src/theme/looks.ts` | `LOOKS` record (aurora, classic), `REQUIRED_STRUCTURAL_KEYS`, `palettesForLook()` | pure-logic | medium |
| `src/theme/palettes.ts` | `PALETTES` — blaze, timber, plus classic/dark/storm re-exported byte-for-byte from `tokens.ts` | pure-logic | low |
| `src/theme/index.ts` | Extend exports; keep `useStyles`/`useTokens` signatures source-compatible | pure-logic | low |

`src/theme/tokens.ts` is **not deleted**. `THEMES.classic|dark|storm` remain the literal source of the
three Classic palettes so AC-4's byte-for-byte assertion has something real to compare against.

## 2. Modified modules

| File | Change | Layer |
| --- | --- | --- |
| `src/theme/useStyles.ts` | Factory receives `{tokens, colors}` instead of colour-only tokens | pure-logic |
| `src/stores/themeStore.ts` | Second persisted axis `look`; `setLook()`; `onRehydrateStorage` re-resolves **both** look tokens and palette colours | pure-logic |
| `app/(tabs)/settings.tsx` | New Look segmented control; Palette list filtered by `palettesForLook()` | mobile-ui |

## 3. Structural token contract — 21 keys

```
typography (7)  display · title · heading · body · bodyStrong · caption · label
spacing    (7)  xs 4 · sm 8 · md 12 · lg 16 · xl 24 · xxl 32 · xxxl 48
radius     (2)  surface · nav
surface    (1)  blur
motion     (4)  fast · base · slow · easing
```

`LOOKS.aurora` — display 66/600/−2.6, radius 18, nav 26, blur 18.
`LOOKS.classic` — display 48/700/0, radius 12, nav 0, blur 0. Values lifted from the shipping screens,
not invented.

## 4. Migration surface — by consumption pattern

The expert briefing found three structurally different ways screens read tokens. This drives sequencing,
because **Group B cannot be migrated by value substitution at all.**

| Group | Pattern | Files | Work |
| --- | --- | --- | --- |
| A | `useStyles(factory)` — already token-parameterised | 9 | Reference new token groups |
| B | `useTokens()` + **module-scope** `StyleSheet.create` | 15 | **Convert to a factory first**, then migrate |
| C | Component-scope `createStyles(t)` | 1 (`radar.tsx`) | Already correct |

Group B is the bulk of the cost and is invisible in the 901-literal count: those style blocks have no
access to the tokens variable, so every literal in them is unreachable until the file is restructured.

## 5. Named hard cases

- **`app/create-rule.tsx`** — 18 inline `style={{…}}` ternaries on selection state (lines 342–803), mixing
  token colours with weight/size literals. An error here changes which chip reads as active. Owns its own task.
- **`src/components/WalkthroughModal.tsx`** — zero `StyleSheet.create`, 11 fully inline objects, and a
  computed `Math.min(screenWidth - 48, 480)` at line 47 feeding `maxWidth`. Literals feed a computation,
  not a style key.
- **`app/(tabs)/_layout.tsx`** — `height: 60 + insets.bottom` and `maxWidth: 600` inside a React Navigation
  `screenOptions` object, invisible to any scanner reading only `StyleSheet.create`.
- **`app/radar.tsx`** — 4-way nested ternary on `backgroundColor` (lines 89–97); `MapboxGL.RasterLayer`
  `style` prop at line 65 is **Mapbox-native, not an RN style**; `styleURL` at line 45 is a tile constant.
  Eager module-level `setAccessToken` at lines 7–9 must not be lazy-loaded.
- **`src/components/ErrorBoundary.tsx`** — class component reading `useThemeStore.getState()` at line 62.
  Must stay a class; do not "fix" into a hook.

## 6. Untouched by contract

`app/_layout.tsx` (lines 156, 192) and `src/components/UpdateCheckScreen.tsx` (lines 108, 138) keep
hardcoded brand navy to match the native splash. `app/index.tsx` is a 4-line `<Redirect>`.

## 7. Native dependencies

`expo-blur`, `expo-linear-gradient`, `react-native-svg` — added to `package.json`, config plugins in
`app.json` where required. **Two EAS builds and one Apple review round.** Not an OTA.

## 8. Data flow

```
AsyncStorage 'pingweather-theme'  { look, palette }
        │  onRehydrateStorage re-resolves BOTH
        ▼
themeStore  { look, palette, tokens: LOOKS[look], colors: PALETTES[palette] }
        │
        ▼
useStyles(({tokens, colors}) => StyleSheet.create({…}))
        │
        ▼
27 screens + 6 components
```

`palettesForLook()` gates the Settings palette list, so a palette can never be selected under a look it
was not designed against — the failure AC-3 exists to prevent.

## 9. Sequencing risk

`LOOKS`/`PALETTES` (TASK-002) must land before any screen migration, or migrating files reference tokens
that do not yet exist. Native deps (TASK-003) must land before Aurora surfaces render. Everything else
parallelises on disjoint file sets.
