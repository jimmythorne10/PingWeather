# Tasks — design-system-v2

Rule: **no two tasks share an in-scope file.** Phase 5 fans out only across tasks with disjoint sets and
satisfied dependencies. Every retry loop is driven by `loop-budget.sh`; no prose budgets.

---

| Task | Specialist | In-scope files | Covers | Depends on |
| --- | --- | --- | --- | --- |
| **TASK-001** | tester | `__tests__/theme/lookContract.test.ts`, `__tests__/theme/noHardcodedLiterals.test.ts`, `__tests__/theme/palettesForLook.test.ts`, `__tests__/theme/radarNativeProps.test.ts`, `__tests__/stores/themeStoreLook.test.ts`, `__tests__/stores/themeStoreRehydrate.test.ts` | FEAT-001…006 | — |
| **TASK-002** | developer | `src/theme/looks.ts`, `src/theme/palettes.ts`, `src/theme/index.ts`, `src/theme/useStyles.ts`, `src/stores/themeStore.ts` | FEAT-001, 003, 004, 005 | TASK-001 |
| **TASK-003** | developer | `package.json`, `app.json` | native deps | TASK-001 |
| **TASK-004** | developer | `app/(tabs)/index.tsx`, `app/(tabs)/alerts.tsx`, `app/(tabs)/forecasts.tsx`, `app/(tabs)/locations.tsx`, `app/(tabs)/history.tsx`, `app/day-detail.tsx`, `src/components/RainfallCard.tsx`, `src/components/LocationSearchInput.tsx` | FEAT-002 | TASK-002 |
| **TASK-005** | developer | `app/login.tsx`, `app/signup.tsx`, `app/forgot-password.tsx`, `app/reset-password.tsx`, `app/upgrade.tsx` | FEAT-002 | TASK-002 |
| **TASK-006** | developer | `app/onboarding/welcome.tsx`, `privacy.tsx`, `eula.tsx`, `battery-setup.tsx`, `location-setup.tsx`, `notification-setup.tsx`, `complete.tsx`, `app/legal/eula.tsx`, `app/legal/privacy-policy.tsx` | FEAT-002 | TASK-002 |
| **TASK-007** | developer | `app/create-rule.tsx` | FEAT-002 | TASK-002 |
| **TASK-008** | developer | `src/components/WalkthroughModal.tsx`, `src/components/ScreenContainer.tsx`, `src/components/ErrorBoundary.tsx`, `app/(tabs)/_layout.tsx`, `app/onboarding/_layout.tsx` | FEAT-002 | TASK-002 |
| **TASK-009** | developer | `app/radar.tsx` | FEAT-002, 006 | TASK-002, TASK-003 |
| **TASK-010** | developer | `app/(tabs)/settings.tsx` | FEAT-002, 003 | TASK-002 |
| **TASK-011** | operator | *(no source files — device sweep)* | FEAT-008 | TASK-006, TASK-009 |

## Fan-out schedule

```
TASK-001  (tests first, recorded RED via tct-run-test.sh)
    │
    ├── TASK-002 ── TASK-003
    │                  │
    └──────────────────┴──▶ 004 · 005 · 006 · 007 · 008 · 010   (parallel, disjoint)
                                           └── TASK-009 (needs 003)
```

## Per-task constraints

- **TASK-001** — every test must import the real implementation path, never a mock of the code under
  test. Each must FAIL before implementation; a test that passes at Phase 4 is a fraud alert, not a win.
- **TASK-003** — `expo-blur`, `expo-linear-gradient`, `react-native-svg` only. Do **not** add `expo-font`
  or `@expo/vector-icons`; both are out of scope per the frozen spec.
- **TASK-006** — `app/onboarding/**` and `app/legal/**` are on the `tdd-guard.yaml` exclusion list, so
  writes here are **not** blocked by that hook. They are **not** unenforced, though: FEAT-002's literal
  scan walks all of `app/`, so a surviving inline value in these 9 files fails that test like any other.
  What is genuinely absent is any check on how they *render* — these screens have no automated UI
  coverage of any kind, and `tdd-guard` cannot be armed for them because it matches by basename and no
  per-screen test exists. **That residual hole is owned by TASK-011 / FEAT-008, not by a prose warning.**
- **TASK-007** — 18 inline selection-state ternaries. Convert each to a semantic token pair or a styles
  map; getting one wrong changes which chip reads as active, which is a behaviour regression, not a
  cosmetic one.
- **TASK-008** — `ErrorBoundary.tsx` stays a class component reading `useThemeStore.getState()`. Do not
  convert to hooks. `WalkthroughModal`'s `Math.min(screenWidth - 48, 480)` is a computation, not a style
  key — tokenise the inputs, keep the arithmetic.
- **TASK-009** — **do not touch** `MapboxGL.RasterLayer`'s `style` prop (line 65) or `styleURL` (line 45);
  neither is a React Native style. Keep `setAccessToken`/`setTelemetryEnabled` eager at module scope. This
  task carries the only `device` manifest entry.
- **TASK-010** — the Palette list must be driven by `palettesForLook()`, not a hardcoded array.
  `__tests__/screens/settings.test.tsx:87` asserts "shows 3 theme options" and **will break**; updating it
  is in scope for this task.
- **TASK-011** — operator device sweep of the 9 screens that carry no automated UI coverage:
  `app/onboarding/{welcome,privacy,eula,battery-setup,location-setup,notification-setup,complete}.tsx`
  and `app/legal/{eula,privacy-policy}.tsx`. Each must be opened in the EAS dev build under **both** looks
  and recorded by name in FEAT-008's `notes`. This task exists because the orchestrator originally wrote
  this hole up as a warning instead of giving it an owner — a warning nobody owns is how 2026-05-07
  happened twice in one day.

## Known collateral

`__tests__/stores/themeStore.test.ts` asserts every token value matches `/^(#[0-9a-fA-F]{3,8}|rgba?\(.*\))$/`.
Numeric structural tokens violate it. TASK-002 owns extending that suite with new describe blocks — not
loosening the existing regex, which would delete the colour-format guarantee it exists to provide.
