# Requirements Brief — design-system-v2

**Project:** WeatherBeacon
**Branch:** `feature/design-system-v2`
**Date:** 2026-09-09
**Source:** Operator request 2026-09-09, refined through the visual preview at
`.claude/specs/design-system-v2/preview.html` and the Phase 0 expert briefing.

---

## Context

The operator's original words: the UI "doesn't feel modern enough and feels very AI generated",
and the request was for a wholesale visual upgrade across every screen plus a Settings toggle to
"revert to classic".

Those are quality judgments, not testable statements, so they were decomposed into measured
structural defects. A literal audit over all 33 files in `app/` and `src/components/` found:
21 distinct `fontSize` values across 317 uses (including eight consecutive integers, 11 through 18);
one weight, `'600'`, carrying 70 of 145 weight declarations; 33 distinct spacing values on no grid;
11 `borderRadius` values serving 4 roles; `letterSpacing` used 10 times in the whole app; and
exactly one `shadowOpacity` and one `elevation` across 27 screens.

The subjective complaint is a consequence of those six measurable absences. This brief specifies
the absences being closed. Whether the result is attractive remains a judgment reserved to the
operator on a physical device, recorded separately as Scenario 6.

**Look name:** the new structural token set is named `depth` (from the "Depth & Surface" direction);
the preserved one is named `classic`. These are the two values of the `look` axis.

## Architecture decision (settled in Phase 0)

`ThemeTokens` currently has a single axis of variation: color palette (`classic` / `dark` / `storm`).
This feature adds a second, **orthogonal** axis:

- `look`: `depth` | `classic` — typography, spacing, radius, elevation, motion
- `palette`: `classic` | `dark` | `storm` — colors, unchanged from today

Adding the new design as a fourth `palette` name was rejected: it would conflate the two concepts and
would leave every Dark and Storm user permanently on the old proportions.

## Actors

| Actor | Role |
| --- | --- |
| Maintainer | Engineer working in the WeatherBeacon codebase, including future sessions |
| App User | Any WeatherBeacon account holder on Free, Pro or Premium |
| Operator | Jimmy — the only party who can verify rendering on a physical device |

---

## Scenarios

### Scenario 1: Every theme supplies the complete structural token contract

- **Actor**: Maintainer
- **Trigger**: The token contract is extended past color into typography, spacing, radius, elevation and motion
- **When**: A unit test enumerates every entry of the exported `LOOKS` record
- **Then**: Every look object exposes all 26 required structural token keys with non-null values
- **Quality Thresholds**: 26 structural keys present per look, 0 missing
- **Error State**: The contract test fails naming the look and the specific missing key

### Scenario 2: No hardcoded style literals survive outside the documented exceptions

- **Actor**: Maintainer
- **Trigger**: A repository scan runs after the migration is complete
- **When**: A unit test scans `app/**` plus `src/components/**`, skipping the 3 files documented as deliberately hardcoded
- **Then**: The scan reports 0 numeric `fontSize`, `fontWeight`, `borderRadius`, `padding`, `gap`, `lineHeight`, `letterSpacing` literals
- **Quality Thresholds**: 0 remaining literals, reduced from the 901 measured on 2026-09-09
- **Error State**: The scan fails listing each surviving literal as file, line and property name

### Scenario 3: Changing the look leaves the user's color choice untouched

- **Actor**: App User
- **Trigger**: A user whose palette is Storm switches the look control
- **When**: `setLook('classic')` is dispatched while the persisted palette equals `storm`
- **Then**: The resolved palette still equals `storm`
- **Quality Thresholds**: none
- **Error State**: The palette resolves to a value other than `storm`, meaning the two axes are coupled

### Scenario 4: Revert to Classic restores the recorded classic proportions

- **Actor**: App User
- **Trigger**: A user selects Classic in the Settings look control
- **When**: `setLook('classic')` is dispatched from a state where look equals `depth`
- **Then**: The resolved structural tokens deep-equal the frozen `LOOKS.classic` snapshot
- **Quality Thresholds**: none
- **Error State**: Any resolved structural token differs from the classic snapshot, so the revert is incomplete

### Scenario 5: The look choice survives an app restart

- **Actor**: App User
- **Trigger**: The app is relaunched after the user changed the look
- **When**: The theme store rehydrates from AsyncStorage carrying a persisted look of `classic`
- **Then**: The store resolves structural tokens to the classic set before first render
- **Quality Thresholds**: none
- **Error State**: The store resolves to `depth` tokens, discarding the user's stored preference

### Scenario 6: The radar screen still renders on a physical device

- **Actor**: Operator
- **Trigger**: The migration has touched styling in `app/radar.tsx`
- **When**: The operator opens the Radar screen in the EAS dev build on a physical Android device
- **Then**: The Mapbox raster layer renders without crashing the screen
- **Quality Thresholds**: none
- **Error State**: The screen crashes or renders blank, indicating a native prop was corrupted by the migration

---

## Out of scope

- Custom typefaces, vector icon sets, blur effects, haptics and programmatic gradients. Each requires
  a native module absent from the build, which would force new binaries for both stores plus another
  Apple review round. Hierarchy is built from size, weight and tracking on the OS font stack.
- Changes to the three existing color palettes. Colors are held constant so the change under test is
  structural only.
- Maestro E2E. Descoped with reasons recorded in `.claude/preflight.yaml` BLOCK-005.
- Any change to `app/_layout.tsx` or `src/components/UpdateCheckScreen.tsx` color values. Both pin brand
  navy deliberately to match the native splash; tokenizing them reintroduces a launch color flash.
- The `styleURL` constant and the `RasterLayer` style prop in `app/radar.tsx`. Both are Mapbox-native,
  not React Native styles.

## Quality thresholds, consolidated

| Measure | Today | Required |
| --- | --- | --- |
| Distinct `fontSize` values | 21 | 7 |
| Distinct spacing values | 33 | 7 |
| Distinct `borderRadius` values | 11 | 4 |
| Elevation levels defined | 1 | 4 |
| Hardcoded literals in scope | 901 | 0 |
| Structural token keys per look | 0 | 26 |

## Deployment constraint

Ships over the air. Every value in the contract is a plain JavaScript style prop or an
already-installed dependency: `react-native-reanimated` 4.1.1 and `react-native-worklets` 0.5.1 are
both present with `newArchEnabled` true. No build credits, no store review, and rollback is
republishing the prior update.

## Open Questions

<!-- none -->
