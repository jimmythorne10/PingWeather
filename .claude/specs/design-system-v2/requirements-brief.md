# Requirements Brief — design-system-v2

**Project:** WeatherBeacon
**Branch:** `feature/design-system-v2`
**Date:** 2026-09-11 (round 6)
**Source:** Operator request 2026-09-09, refined across six design rounds against the visual preview at
`.claude/specs/design-system-v2/preview.html` and the Phase 0 expert briefing.

---

## Context

The operator's original words: the UI "doesn't feel modern enough and feels very AI generated", with a
request for a wholesale visual upgrade across every screen plus a Settings toggle to "revert to classic".

Those are quality judgments, not testable statements, so they were decomposed into measured structural
defects. A literal audit over all 33 files in `app/` and `src/components/` found: 21 distinct `fontSize`
values across 317 uses (including eight consecutive integers, 11 through 18); one weight, `'600'`,
carrying 70 of 145 weight declarations; 33 distinct spacing values on no grid; 11 `borderRadius` values
serving 4 roles; `letterSpacing` used 10 times in the whole app; and exactly one `shadowOpacity` and one
`elevation` across 27 screens.

The subjective complaint is a consequence of those six measurable absences. This brief specifies the
absences being closed. Whether the result is attractive remains a judgment reserved to the operator on a
physical device, recorded separately as Scenario 6.

## Round history

Six rounds, each rejected for a stated reason, recorded so the decision is auditable:

1. **Depth & Surface** — hierarchy from 16px radii and a four-level shadow ramp. Rejected 2026-09-10:
   the operator asked for square edges.
2. **Ruled / Blocked** — radius 0, no shadow, separation by hairline or by tone. Blocked became the
   front-runner; both were rejected as "not modern enough".
3. **Nocturne / Signal / Grid** — dark grounds with monospace data. Grid became the front-runner.
4. **Aurora** — the operator supplied three reference images sharing a blue-to-violet gradient, ambient
   glow, gradient-filled data and a floating nav. Priced two ways: an over-the-air approximation using
   baked image assets, and a full-fidelity version requiring native modules.
5. **Aurora Full selected.** Four hunting-audience palettes offered against it.
6. **Blaze and Timber selected** as the two palettes, with Classic defined as the current shipped state.

## Settled design decisions

**Two looks, each owning its own palette family.**

| Look | Structure | Palettes |
| --- | --- | --- |
| `aurora` | Frosted surfaces at blur 18, 18px radius, 26px nav radius, gradient hero, floating pill nav, SVG sparkline | `blaze`, `timber` |
| `classic` | The values shipping today: 12px radius, 48px display at weight 700, flat cards, standard tab bar, no blur | `classic`, `dark`, `storm` |

Earlier rounds held look and palette fully independent. That broke once every candidate became dark: a
dark structure on the light `classic` palette is incoherent. **Resolved by making each look own a palette
family.** Selecting Classic restores the old proportions *and* the old colours, which is what a user means
by "revert to classic".

**The accent is not the weather.** The app's signature alert is a freeze, so an orange freeze warning is
nonsense. Every palette carries a separate `cold` semantic token used for overnight lows and freeze
figures, while `accent` and `accent2` are reserved for interface chrome: active tab, armed pill, hero
gradient, floating action button.

## Actors

| Actor | Role |
| --- | --- |
| Maintainer | Engineer working in the WeatherBeacon codebase, including future sessions |
| App User | Any WeatherBeacon account holder on Free, Pro or Premium |
| Operator | Jimmy — the only party who can verify rendering on a physical device |

---

## Scenarios

### Scenario 1: Every look supplies the complete structural token contract

- **Actor**: Maintainer
- **Trigger**: The token contract is extended past colour into typography, spacing, radius, surface and motion
- **When**: A unit test enumerates every entry of the exported `LOOKS` record
- **Then**: Every look object exposes all 21 required structural token keys with non-null values
- **Quality Thresholds**: 21 structural keys present per look, 0 missing
- **Error State**: The contract test fails naming the look and the specific missing key

### Scenario 2: No hardcoded style literals survive outside the documented exceptions

- **Actor**: Maintainer
- **Trigger**: A repository scan runs after the migration is complete
- **When**: A unit test scans `app/**` plus `src/components/**`, skipping the 3 files documented as deliberately hardcoded
- **Then**: The scan reports 0 numeric `fontSize`, `fontWeight`, `borderRadius`, `padding`, `gap`, `lineHeight`, `letterSpacing` literals
- **Quality Thresholds**: 0 remaining literals, reduced from the 901 measured on 2026-09-09
- **Error State**: The scan fails listing each surviving literal as file, line and property name

### Scenario 3: Each look offers only the palettes that belong to it

- **Actor**: App User
- **Trigger**: A user opens the Palette list in Settings
- **When**: A unit test reads the palette set exposed for look `aurora` and for look `classic`
- **Then**: `aurora` exposes exactly `blaze` plus `timber`, while `classic` exposes exactly `classic`, `dark`, `storm`
- **Quality Thresholds**: 2 palettes under aurora, 3 under classic
- **Error State**: A palette appears under a look whose structure it was not designed against, producing a dark palette on light proportions

### Scenario 4: Revert to Classic restores the recorded proportions and the recorded colours

- **Actor**: App User
- **Trigger**: A user selects Classic in the Settings look control
- **When**: `setLook('classic')` is dispatched from a state where look equals `aurora`
- **Then**: The resolved structural tokens deep-equal the frozen `LOOKS.classic` snapshot taken from `src/theme/tokens.ts`
- **Quality Thresholds**: none
- **Error State**: Any resolved token differs from the classic snapshot, so the revert is incomplete

### Scenario 5: The look choice survives an app restart

- **Actor**: App User
- **Trigger**: The app is relaunched after the user changed the look
- **When**: The theme store rehydrates from AsyncStorage carrying a persisted look of `classic`
- **Then**: The store resolves structural tokens to the classic set before first render
- **Quality Thresholds**: none
- **Error State**: The store resolves to `aurora` tokens, discarding the user's stored preference

### Scenario 6: The radar screen still renders on a physical device

- **Actor**: Operator
- **Trigger**: The migration has touched styling in `app/radar.tsx`
- **When**: The operator opens the Radar screen in the EAS dev build on a physical Android device
- **Then**: The Mapbox raster layer renders without crashing the screen
- **Quality Thresholds**: none
- **Error State**: The screen crashes or renders blank, indicating a native prop was corrupted by the migration

---

## Out of scope

- Custom typefaces. `expo-font` stays out; hierarchy is built from size, weight and tracking on the OS
  font stack.
- Altering the three existing colour palettes. `classic`, `dark` and `storm` are preserved byte-for-byte
  under look `classic`; they are carried forward, never edited.
- Maestro E2E. Descoped with reasons recorded in `.claude/preflight.yaml` BLOCK-005.
- Any change to the colour values in `app/_layout.tsx` or `src/components/UpdateCheckScreen.tsx`. Both pin
  brand navy deliberately to match the native splash; tokenizing them reintroduces a launch colour flash.
- The `styleURL` constant and the `RasterLayer` style prop in `app/radar.tsx`. Both are Mapbox-native, not
  React Native styles.

## Quality thresholds, consolidated

| Measure | Today | Required |
| --- | --- | --- |
| Distinct `fontSize` values | 21 | 7 per look |
| Distinct spacing values | 33 | 7 |
| Distinct `borderRadius` values | 11 | 2 per look |
| Hardcoded literals in scope | 901 | 0 |
| Structural token keys per look | 0 | 21 |
| Looks defined | 0 | 2 |
| Palettes defined | 3 | 5 |

## Deployment constraint — changed at round 5

This is **no longer an over-the-air change.** The `aurora` look requires three native modules that are
not in the current build: `expo-blur` for the frosted surfaces, `expo-linear-gradient` for the hero and
accent gradients, and `react-native-svg` for the forecast sparkline. Shipping it therefore costs two new
store binaries and one further Apple review round, on an app whose iOS Build 5 cleared review on
2026-06-10 after a rejection cycle.

Once those modules are in the binary, palette values are plain JavaScript and every later palette edit
ships over the air for zero build credits. `react-native-reanimated` 4.1.1 and `react-native-worklets`
0.5.1 are already installed with `newArchEnabled` true, so motion needs no new dependency.

## Rollout assumptions carried into Phase 1

Both are recorded here so the spec approval step confirms or reverses them. Neither is frozen.

1. **Timber is the default palette** for new installs. The project CLAUDE.md names livestock owners,
   hunters and outdoor workers as target users; Blaze is the palette that narrows the app to hunting
   alone. Blaze remains one tap away in Settings.
2. **Existing users stay on look `classic`** through the update and are offered `aurora` once, rather
   than receiving a dark interface they did not request.

## Open Questions

<!-- none -->
