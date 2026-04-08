# Test Suite Status

**Last Run:** 2026-04-08
**Framework:** Jest with dual-project config (logic + components)

## Overall Status

| Project | Suites Passing | Tests Passing | Notes |
|---|---|---|---|
| **logic** (node env) | 6 / 12 | 211 / 213 | 2 actual TDD failures (expected), 6 suite setup bugs |
| **components** (jest-expo) | 0 / 9 | 0 / ? | Blocked by jest-expo winter runtime bug |

## Logic Project

### Passing Suites (211 tests)
- `__tests__/stores/settingsStore.test.ts` — Unit preferences, theme, notifications
- `__tests__/stores/themeStore.test.ts` — Theme tokens for all 3 themes
- `__tests__/data/tierLimits.test.ts` — Free/Pro/Premium tier limits
- `__tests__/data/alertPresets.test.ts` — Preset structure validation (all 10 presets)
- `__tests__/engine/evaluateConditions.test.ts` — Alert evaluation engine (all operators, metrics, cooldown, lookahead)
- `__tests__/data/weatherApi.test.ts` — Open-Meteo client URL params and error handling

### Failing Tests (2 — Expected TDD)
- `legalContent.test.ts › EULA_CONTENT › uses the PingWeather product name` — FR-NFR-006 branding consistency (EULA still says WeatherWatch)
- `legalContent.test.ts › PRIVACY_POLICY_CONTENT › uses the PingWeather product name` — same

### Broken Test Files (Hoisting Bug — Dev-Loop to Fix)
The following files have `jest.mock()` factories that reference `mockFoo` const variables declared at module scope. This triggers a TDZ error because `jest.mock()` is hoisted but const declarations are not. Fix pattern: move mock variables inside the factory, or use the global `jest.setup.ts` mocks.

- `__tests__/stores/authStore.test.ts` (FR-AUTH-001 to FR-AUTH-005)
- `__tests__/stores/locationsStore.test.ts` (FR-LOC-001 to FR-LOC-008)
- `__tests__/stores/alertRulesStore.test.ts` (FR-ALERT-001 to FR-ALERT-010)
- `__tests__/data/legalContent.test.ts` (above 2 failures are in this file — factory conflict with global mock)
- `__tests__/flows/authFlow.test.ts` (FR-AUTH flows end-to-end)
- `__tests__/flows/tierEnforcement.test.ts` (FR-LOC-005, FR-ALERT-007, FR-IAP-001)

## Components Project (Blocked)

All 9 screen test files fail to run due to a known bug in `jest-expo@54.x` where `expo/src/winter/runtime.native.ts` throws "You are trying to import a file outside of the scope of the test code" during module initialization. This is a jest-expo preset issue, not a test code issue.

Blocked files:
- `__tests__/screens/login.test.tsx`
- `__tests__/screens/signup.test.tsx`
- `__tests__/screens/onboarding.test.tsx`
- `__tests__/screens/home.test.tsx`
- `__tests__/screens/alerts.test.tsx`
- `__tests__/screens/locations.test.tsx`
- `__tests__/screens/settings.test.tsx`
- `__tests__/screens/createRule.test.tsx`
- `__tests__/screens/forecasts.test.tsx`

**Workaround options:**
1. Pin jest-expo to a version that doesn't have the winter runtime bug
2. Add a custom Jest resolver that stubs `expo/src/winter/runtime.native.ts`
3. Move component tests to the logic project with a minimal react-native stub (no react-native-web, no winter polyfill)
4. Wait for jest-expo upstream fix

## PRD Coverage Summary

Despite the setup issues, the test suite covers:

- **FR-AUTH** (5 requirements) — tests written, suite blocked by hoisting bug
- **FR-ONBOARD** (7) — component tests written, blocked by jest-expo
- **FR-LOC** (8) — store tests blocked by hoisting, component tests blocked by jest-expo
- **FR-ALERT** (10) — store tests blocked by hoisting, component tests blocked by jest-expo
- **FR-HOME** (5) — component tests written, blocked by jest-expo
- **FR-FORECAST** (4) — component tests written for unimplemented screen (pure TDD gaps)
- **FR-SET** (10) — component tests written, blocked by jest-expo
- **FR-POLL** (5) — engine tests PASSING (evaluateConditions.test.ts)
- **FR-ACCURACY** (4) — not yet tested (post-MVP planned)
- **FR-IAP** (5) — not yet tested (subscription purchase flow)
- **NFR-006 branding** — 2 failing tests catching the WeatherWatch → PingWeather rebrand gap

## Next Steps

1. Fix hoisting bugs in 6 logic test files (mechanical refactor)
2. Resolve jest-expo winter runtime bug (pick from workaround options above)
3. Feed failing tests into dev-loop to drive feature implementation
4. Add FR-ACCURACY and FR-IAP tests when those features are built
