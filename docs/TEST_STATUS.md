# Test Suite Status

**Last Run:** 2026-04-08
**Framework:** Jest with dual-project config (logic + components)

## Overall Status

| | Suites Running | Tests Passing | Tests Failing |
|---|---|---|---|
| **Logic project** (node env) | 12 / 12 | 273 | 20 (all TDD) |
| **Components project** (jsdom env) | 9 / 9 | 56 | 37 (all TDD) |
| **TOTAL** | **21 / 21** | **329** | **57** |

**All 21 test suites run successfully.** All 57 failing tests are expected TDD failures — they reference PRD features that don't exist yet and serve as the acceptance criteria for dev-loop to implement.

## Infrastructure

### Dual-Project Jest Config
- **Logic project** — `testEnvironment: 'node'`, custom babel config with `@babel/preset-env` + `@babel/preset-typescript`. Tests stores, engine, data structures, and flows without React Native dependencies.
- **Components project** — `testEnvironment: 'jsdom'`, adds `@babel/preset-react` for JSX. Uses `@testing-library/react-native` with `react-test-renderer`. Bypasses `jest-expo` preset to avoid the `winter/runtime.native.ts` bug where lazy global getters try to require files outside Jest's sandbox.

### Global Mocks (`jest.setup.ts`)
- `@react-native-async-storage/async-storage` — in-memory Map-backed store
- `@supabase/supabase-js` — singleton client mock with chainable query builder and `__setFromResponse` helper
- `expo-secure-store`, `expo-constants`, `expo-location`, `expo-notifications`, `expo-router`, `expo-status-bar` — lightweight stubs
- `react-native-url-polyfill/auto` — no-op

### Local Mocks (`__mocks__/`)
- Minimal stubs for logic tests that don't need React Native runtime
- Used via `moduleNameMapper` in both project configs

## Expected TDD Failures (57 total)

Each failing test maps to an unimplemented PRD requirement. These are the acceptance criteria for dev-loop.

### FR-AUTH (Authentication)
- **FR-AUTH-004 Forgot Password** — 5 failures (store method missing, login screen link missing)
- Sign out test expects `signOut` state reset chain — 1 failure

### FR-LOC (Locations)
- **FR-LOC-002 Address Search** — 2 failures (no geocoding integration)
- **FR-LOC-004 Trash Icon Delete** — 1 failure (still uses "Remove" text)
- **FR-LOC-005 Tier Downgrade Handling** — 2 failures (no deactivate-excess logic)
- **FR-LOC-006 Tier Limit Enforcement** — 3 failures (store doesn't block at limits)
- **FR-LOC-007 Timezone Storage** — 1 failure (no `timezone` column in insert payload)
- **FR-LOC-008 Default Location** — 3 failures (no `is_default`, no `setDefaultLocation`, no auto-promotion)

### FR-ALERT (Alert Rules)
- **FR-ALERT-001 Compact Cards + Filter** — 2 failures (no All/Active/Inactive filter)
- **FR-ALERT-002 Preset Dropdown** — 1 failure (still uses scroll groups)
- **FR-ALERT-006 Trash Icon Delete** — 1 failure
- **FR-ALERT-007 Tier Limit Enforcement** — 2 failures (store doesn't block)
- **FR-ALERT-008 Edit Rule** — 3 failures (pre-population, "Edit Alert Rule" title, "Save Changes" button)
- **FR-ALERT-009 Clone Rule** — 2 failures (no clone icon, no "(copy)" suffix logic)
- **FR-ALERT-010 Compound Condition Gating** — 1 failure (Free users can create multi-condition rules)

### FR-HOME (Home Screen)
- **FR-HOME-001 "Forecast" Card Title** — 1 failure (uses location name instead)
- **FR-HOME-001 Location Picker** — 1 failure
- **FR-HOME-002 14-Day Expand** — 1 failure
- **FR-HOME-003 Tappable Alert Rows** — 1 failure
- **FR-HOME-005 Empty States** — 1 failure

### FR-FORECAST (Forecasts Tab — entirely new)
- **FR-FORECAST-001 All Locations Overview** — 2 failures
- **FR-FORECAST-002 Location Detail** — 1 failure
- **FR-FORECAST-003 Rule Trigger Preview** — 1 failure
- **FR-FORECAST-004 Alert History Sub-Screen** — 1 failure
- Screen not yet implemented

### FR-SET (Settings)
- **FR-SET-006 Alert History Link** — 1 failure
- **FR-SET-007 App Version Display** — 1 failure
- **FR-SET-008 Dev Tier Override** — 1 failure
- **FR-SET-009 Delete Account** — 1 failure
- **FR-SET-010 Sign Out Confirmation** — 1 failure

### FR-ONBOARD (Onboarding)
- **FR-ONBOARD-002 Welcome "PingWeather" Branding** — 1 failure (still says WeatherWatch)
- **FR-ONBOARD-005 Address Search** — 1 failure
- **FR-ONBOARD-007 Complete "PingWeather" Branding** — 1 failure
- EULA navigation flow — 2 failures

### NFR-006 (Branding)
- **EULA content uses "PingWeather"** — 1 failure
- **Privacy Policy uses "PingWeather"** — 1 failure

## Running Tests

```bash
# Full suite
npm test

# Logic tests only
npm test -- --selectProjects logic

# Component tests only
npm test -- --selectProjects components

# Specific file
npm test -- --testPathPatterns login
```

## Coverage by PRD Section

| Section | Requirements | Tests Written | Status |
|---|---|---|---|
| Auth | FR-AUTH-001 to 005 | ✅ | 15/20 passing (3 TDD for FR-AUTH-004) |
| Onboarding | FR-ONBOARD-001 to 007 | ✅ | 13/18 passing (5 TDD) |
| Locations | FR-LOC-001 to 008 | ✅ | 22/34 passing (12 TDD) |
| Alert Rules | FR-ALERT-001 to 010 | ✅ | 18/30 passing (12 TDD) |
| Home | FR-HOME-001 to 005 | ✅ | 8/13 passing (5 TDD) |
| Forecasts | FR-FORECAST-001 to 004 | ✅ | 0/6 passing (all TDD — screen unimplemented) |
| History (sub-screen) | — | ✅ | covered under FR-FORECAST-004 |
| Settings | FR-SET-001 to 010 | ✅ | 10/15 passing (5 TDD) |
| Server-Side | FR-POLL-001 to 005 | ✅ | engine tests passing; FR-POLL-004/005 are post-MVP |
| IAP | FR-IAP-001 to 005 | ⏳ | not yet tested |
| Forecast Accuracy | FR-ACCURACY-001 to 004 | ⏳ | not yet tested (post-MVP) |

**329 passing tests form the regression suite. 57 failing tests are the dev-loop targets.**
