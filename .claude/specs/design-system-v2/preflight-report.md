# Preflight Report — design-system-v2

**Feature:** WeatherBeacon design-system overhaul (token contract + modern default look + Revert to Classic)
**Date:** 2026-09-09
**Branch:** `feature/design-system-v2`
**Orchestrator:** ship-loop

---

## Expert Briefing — key findings

Produced by `pingWeatherExpert` (sonnet), read-only pass over all 33 files in `app/` + `src/components/`.

### 1. The real cost center is structural, not numeric

Screens consume tokens in three different shapes:

| Group | Pattern | Files | Migration cost |
|---|---|---|---|
| A | `useStyles(factory)` — memoized, token-parameterized | 9 | Low — reference the new fields |
| B | `useTokens()` + **module-scope** `StyleSheet.create` | **15** | **High — style block has NO access to tokens** |
| C | Component-scope `createStyles(t)` called in render | 1 (`radar.tsx`) | Low — already correct |

Group B is the finding that matters. Those 15 files apply color by merging an inline `{color: t.x}` object at render; every `fontSize`/`padding`/`borderRadius` literal in them is structurally unreachable from any token. Each file must be converted to a factory *before* a single literal can be tokenized. This is not visible in the 901-literal audit.

Group B files: `login`, `signup`, `forgot-password`, `reset-password`, `upgrade`, `create-rule`, `legal/eula`, `legal/privacy-policy`, and all 7 `onboarding/*` content screens.

### 2. Architecture decision required before Phase 2

`ThemeTokens` is one flat interface with a single axis of variation: **color palette** (`classic`/`dark`/`storm`). The feature needs a second, orthogonal axis: **structural look**.

Making `modern` a 4th `ThemeName` is wrong — it would conflate palette with look, and `dark`/`storm` users would never receive the new design. **Resolved architecture: two independent axes**, `look: 'modern' | 'classic'` (type/spacing/radius/elevation/motion) crossed with `palette: 'classic' | 'dark' | 'storm'` (colors). `themeStore` persists two keys instead of one. "Revert to Classic" switches `look` only and leaves the user's color choice untouched.

### 3. Files that must NOT be tokenized (deliberate hardcoding)

- `app/_layout.tsx:156,192` — `#1E3A5F` / `#FFFFFF` loading screen, pinned to brand navy to match the native splash. Comment at lines 150-151 states the intent. Tokenizing reintroduces a color flash before theme state hydrates.
- `src/components/UpdateCheckScreen.tsx:108,138` — same rationale, stated in its own header comment.

### 4. Native-surface crash risk — one file

`app/radar.tsx` only (`@rnmapbox/maps`):
- Line 65 `MapboxGL.RasterLayer style={{ rasterOpacity }}` is a **Mapbox-native prop, not an RN StyleSheet style**. 52 `style={{` sites exist codebase-wide; any migration tooling must special-case this one out or it injects an RN-shaped object into a native layer prop — the exact class of bug behind the two broken OTAs of 2026-05-07.
- Line 45 `styleURL={MapboxGL.StyleURL.Dark}` is a Mapbox tile-style constant, hardcoded and intentionally not theme-driven. Out of scope.
- Lines 7-9 `setAccessToken`/`setTelemetryEnabled` are eager module-level side effects. Do not lazy-load this module as part of the refactor.
- `__tests__/screens/radar.test.tsx` fully mocks Mapbox (lines 28-44), so it **cannot** catch a native-prop regression.

### 5. Regression-risk sites (computed/dynamic styling)

- `create-rule.tsx` — 18 inline selection-state ternaries mixing token colors with weight/size literals. Highest-density hard case; an error here changes which chip reads as active.
- `WalkthroughModal.tsx:47` — `Math.min(screenWidth - 48, 480)` from `useWindowDimensions()`; literals feed a computation, not a style key. Also has zero `StyleSheet.create` — 11 fully inline style objects.
- `(tabs)/_layout.tsx:24,27` — `height: 60 + insets.bottom`, `maxWidth: 600` inside a React Navigation `screenOptions` object, invisible to any tool scanning only `StyleSheet.create`.
- `radar.tsx:89-97` — 4-way nested ternary on `backgroundColor` keyed to frame state.
- `ErrorBoundary.tsx:62` — class component reading `useThemeStore.getState().tokens`; must stay a class, do not "fix" into a hook.
- Confirmed absent: no `Dimensions.get`, no platform-conditional styling (all 8 `Platform.*` sites are keyboard behavior or copy text), no WebView.

### 6. Test surface

- `__tests__/stores/themeStore.test.ts` — the only real theme test, Jest `logic`, acceptable verification. **Its `REQUIRED_TOKEN_KEYS` array is hardcoded to the 30 color fields and it asserts every token value matches `/^(#[0-9a-fA-F]{3,8}|rgba?\(.*\))$/`.** Numeric structural tokens will violate that regex — the test needs new describe blocks, not a patched regex.
- `__tests__/screens/settings.test.tsx:87` asserts `'shows 3 theme options'` — breaks the moment the look toggle lands.
- Six other jsdom screen tests mock `useTokens`/`useThemeStore` only to satisfy imports; **none assert any style value**, so none would fail if a literal changed to a token of a different value. Confirms there is no existing net for visual regression.

### 7. Correction accepted on Maestro descoping

The expert pushed back on the "no native surface" justification in BLOCK-005. Accepted with refinement: this feature adds no native surface, but `radar.tsx` *has* existing native surface. Mitigation is not a Maestro install — it is (a) an explicit tooling exclusion for Mapbox props, and (b) a named device-verification requirement for the radar screen specifically, recorded as a `device` manifest entry.

---

## Blocker Status

| ID | Name | Status | Owner |
|---|---|---|---|
| BLOCK-001 | eas-cli >= 20.x | **resolved** | orchestrator |
| BLOCK-002 | OTA channel read from `eas build:list` | owned | orchestrator |
| BLOCK-003 | Clean tree at OTA time (stray `nul`) | pending | operator |
| BLOCK-004 | Device for aesthetic verification | owned | operator |
| BLOCK-005 | Maestro toolchain | resolved (descoped, with refinement above) | operator |

**0 unresolved and unowned.** BLOCK-003 is `pending` but owned by the operator and does not block Phases 1-6 — it blocks only the OTA push in Phase 7.

## Operator decisions recorded (2026-09-09)

1. **Visual direction:** Depth & Surface — elevation as the organizing principle, real shadow ramp, consistent radius, 8pt rhythm, restrained tracking.
2. **Visual preview before spec freeze:** yes — build it.
3. **Revert to Classic semantics:** normalized current look. Classic keeps today's colors, proportions and layout snapped onto the new token scales. Near-identical, occasionally off a pixel where an arbitrary 13px becomes 14px. One screen tree, two token sets, no maintenance fork.

---

## Cleared to Proceed: **YES**

Phase 0.5 (elicitation) is required — the request contains unquantified quality terms ("modern", "slick") that `vague-term-scan.sh` and `brief-gate.sh` will block on. The visual preview is the elicitation instrument.
