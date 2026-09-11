# Spec — design-system-v2

**Feature:** Aurora design system with Classic fallback
**Purpose:** Replace 901 hardcoded style literals across all 33 screen and component files with a
two-look token contract, ship the Aurora look with the Blaze and Timber palettes, and keep the app as it
ships today reachable as Classic.

**Project:** WeatherBeacon · **Branch:** `feature/design-system-v2` · **Date:** 2026-09-11
**Input:** `.claude/specs/design-system-v2/requirements-brief.md` (vague-term-scan PASS, brief-gate PASS)

---

## Personas affected

| Persona | Impact |
| --- | --- |
| App User — livestock owner | Sees Aurora/Timber by default on a new install; overnight low and freeze figures stay in the cold semantic colour |
| App User — hunter | Can select Aurora/Blaze, the safety-orange palette, in one tap from Settings |
| App User — existing installed base | Remains on Classic through the update; offered Aurora once |
| Maintainer | Adds a screen by consuming tokens; the literal-scan test fails the build if inline values are reintroduced |
| Operator | Verifies rendering on a physical Android device — the only accepted UI verification on this project |

---

## Architecture

Two looks, each owning its own palette family. `look` selects structure, `palette` selects colour, and a
palette is only offered under the look it was designed against.

| Look | Structure | Palettes |
| --- | --- | --- |
| `aurora` | blur 18, radius 18, nav radius 26, gradient hero, floating pill nav, SVG sparkline, display 66/600/−2.6 | `blaze`, `timber` |
| `classic` | the values shipping today — radius 12, nav radius 0, no blur, flat cards, display 48/700/0 | `classic`, `dark`, `storm` |

**The accent is not the weather.** `accent` and `accent2` colour interface chrome only: active tab, armed
pill, hero gradient, floating action button. Overnight lows and freeze figures use the separate `cold`
semantic token, so a warm brand colour never renders a freeze warning.

---

## Acceptance criteria

### AC-1 — Every look supplies the complete structural token contract

- When a unit test enumerates every entry of the exported `LOOKS` record, then every look object exposes
  all 21 required structural token keys with non-null values.
  ```
  Oracle:
    type: pure-logic
    condition: >
      Import LOOKS from src/theme/looks.ts and iterate Object.entries(LOOKS). For each look, read the
      key set of its typography (7), spacing (7), radius (2), surface (1) and motion (4) groups.
    assertion: >
      For each of the 2 looks, the flattened key set deep-equals the exported REQUIRED_STRUCTURAL_KEYS
      array of length 21, and every resolved value is neither null nor undefined.
    failure_mode: >
      A look is missing a key (length < 21), carries an extra undeclared key, or resolves a key to null
      or undefined — any of which crashes a screen that reads that token at render time.
    automated: true
    confidence: high
  ```

### AC-2 — No hardcoded style literals survive outside the documented exceptions

- When a unit test scans `app/**` and `src/components/**` excluding the three files documented as
  deliberately hardcoded, then the scan reports zero numeric style literals.
  ```
  Oracle:
    type: pure-logic
    condition: >
      Walk every .ts/.tsx file under app/ and src/components/, excluding app/_layout.tsx,
      src/components/UpdateCheckScreen.tsx and the Mapbox-native props in app/radar.tsx. Match
      /\b(fontSize|fontWeight|borderRadius|padding[A-Za-z]*|gap|lineHeight|letterSpacing):\s*['"]?[0-9]/.
    assertion: >
      The collected match array has length 0, down from the 901 measured on 2026-09-09.
    failure_mode: >
      Any file still carries an inline numeric style value, meaning that screen does not respond to a
      look change and will render Aurora proportions while set to Classic.
    automated: true
    confidence: high
  ```

### AC-3 — Each look offers only the palettes that belong to it

- When a unit test reads the palette set exposed for look `aurora` and for look `classic`, then `aurora`
  exposes exactly `blaze` plus `timber` while `classic` exposes exactly `classic`, `dark`, `storm`.
  ```
  Oracle:
    type: pure-logic
    condition: >
      Call palettesForLook('aurora') and palettesForLook('classic') from src/theme/looks.ts.
    assertion: >
      palettesForLook('aurora') sorted deep-equals ['blaze','timber'] (length 2) and
      palettesForLook('classic') sorted deep-equals ['classic','dark','storm'] (length 3).
    failure_mode: >
      A palette is returned under the wrong look — e.g. 'blaze' offered under 'classic' — which renders a
      near-black ground against 12px radii and light-palette text colours.
    automated: true
    confidence: high
  ```

### AC-4 — Revert to Classic restores the recorded proportions and the recorded colours

- When `setLook('classic')` is dispatched from a state where look equals `aurora`, then the resolved
  structural tokens and palette deep-equal the frozen Classic snapshot.
  ```
  Oracle:
    type: pure-logic
    condition: >
      Set useThemeStore state to { look: 'aurora', palette: 'timber' }, then call
      getState().setLook('classic').
    assertion: >
      getState().tokens deep-equals LOOKS.classic, AND getState().palette equals 'classic' with
      getState().colors deep-equalling the PALETTES.classic object whose values match
      src/theme/tokens.ts THEMES.classic byte-for-byte (background '#F0F4F8', primary '#1E3A5F',
      textPrimary '#1A202C', freezeBlue '#63B3ED').
    failure_mode: >
      Structure reverts but colours stay dark, or colours revert but radii stay at 18 — a partial revert
      that leaves the user in a state neither look defines.
    automated: true
    confidence: high
  ```

### AC-5 — The look choice survives an app restart

- When the theme store rehydrates from AsyncStorage carrying a persisted look of `classic`, then the
  store resolves structural tokens to the classic set before first render.
  ```
  Oracle:
    type: pure-logic
    condition: >
      Seed the AsyncStorage mock with the persisted key 'pingweather-theme' holding
      { state: { look: 'classic', palette: 'classic' } }, then trigger the store's onRehydrateStorage
      callback.
    assertion: >
      Immediately after rehydration and before any setLook call, getState().tokens deep-equals
      LOOKS.classic and getState().look equals 'classic'.
    failure_mode: >
      tokens remain LOOKS.aurora because onRehydrateStorage only restored the look NAME without
      re-resolving the token object — the same defect class the existing themeStore avoids for colours.
    automated: true
    confidence: high
  ```

### AC-6 — The radar screen still renders on a physical device

- When the operator opens the Radar screen in the EAS dev build on a physical Android device, then the
  Mapbox raster layer renders without crashing the screen.
  ```
  Oracle:
    type: mobile-ui
    condition: >
      Install the EAS dev build carrying the migration, open the app, navigate to the Radar screen, and
      scrub the frame timeline.
    assertion: >
      The map tiles draw, the scrub control responds, and no red-box error or blank screen appears.
    failure_mode: >
      Blank screen or a native crash, indicating the migration rewrote MapboxGL.RasterLayer's style prop
      (app/radar.tsx line 65) as if it were a React Native style object.
    automated: false
    confidence: medium
  ```
  **Not automatable on this project.** `__tests__/screens/radar.test.tsx` mocks `@rnmapbox/maps`
  entirely (lines 28-44), so it cannot observe a native prop regression. Maestro is descoped in
  `.claude/preflight.yaml` BLOCK-005. Verified by the operator on device; see the manifest `notes`.

---

## Out of scope

- Custom typefaces. `expo-font` stays out; hierarchy comes from size, weight and tracking on the OS font stack.
- Altering the three existing colour palettes. `classic`, `dark` and `storm` are carried forward byte-for-byte under look `classic`, never edited.
- Maestro E2E. Descoped with reasons in `.claude/preflight.yaml` BLOCK-005.
- The colour values in `app/_layout.tsx` and `src/components/UpdateCheckScreen.tsx` — both pin brand navy deliberately to match the native splash.
- The `styleURL` constant and the `RasterLayer` style prop in `app/radar.tsx` — Mapbox-native, not React Native styles.
- Shipping the OTA itself. This spec ends at a verified, committed branch; the store submission is a separate operation.

## External dependencies

Three native modules must be added to the build. This feature **cannot ship over the air.**

| Dependency | Needed for | Status |
| --- | --- | --- |
| `expo-blur` | Frosted Aurora surfaces | not installed |
| `expo-linear-gradient` | Hero and accent gradients | not installed |
| `react-native-svg` | Forecast sparkline | not installed |
| `react-native-reanimated` 4.1.1 | Motion tokens | installed |
| `react-native-worklets` 0.5.1 | Reanimated 4 worklets | installed |

Cost: 2 EAS build credits, 1 Apple review round, 1 Play rollout. Palette edits after that binary ship
over the air for free. `eas-cli` 20.1.0 verified 2026-09-09 (BLOCK-001 resolved).

## Rollout decisions

1. **Timber is the default palette** for new installs. Blaze is one tap away in Settings.
2. **Existing users stay on look `classic`** through the update and are offered Aurora once.

Both were recorded as assumptions in the brief and are confirmed by this spec. Changing either after
freeze is a new spec version, not an edit.
