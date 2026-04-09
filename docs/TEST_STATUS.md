# Test Suite Status

**Last Run:** 2026-04-09
**Framework:** Jest with dual-project config (logic + components)

## Overall Status

```
Test Suites: 27 passed, 27 total
Tests:       463 passed, 463 total
```

- Logic project: 18 suites, 378 tests
- Components project: 9 suites, 85 tests

## Coverage by PRD Section

| Section | Requirements | Status |
|---|---|---|
| Auth | FR-AUTH-001 to 005 | ✅ Logic covered; PKCE flow + forgot-password + reset-password device-verified |
| Onboarding | FR-ONBOARD-001 to 007 | ✅ Device-verified |
| Locations | FR-LOC-001 to 008 | ✅ Device-verified incl. geocoding + default location + timezone |
| Alert Rules | FR-ALERT-001 to 010 | ✅ Device-verified; note `max_notifications` feature was attempted + reverted (see KNOWN_ISSUES Feature 1) |
| Home | FR-HOME-001 to 005 | ✅ Device-verified; forecast card always shows 14 days (no collapse toggle) |
| Forecasts | FR-FORECAST-001 to 004 | ✅ Device-verified; day-detail hourly drill-in added + verified |
| Settings | FR-SET-001 to 010 | ✅ Device-verified; Premium downgrade + dev tier override + dev-gated push register |
| Server-Side | FR-POLL-001 to 005 | ✅ `poll-weather` + `evaluate-alerts` deployed, cron auto-fire verified, full push chain verified on device |
| IAP | FR-IAP-001 to 005 | ⏳ RevenueCat wiring open (INFRA-004) |
| Forecast Accuracy | FR-ACCURACY-001 to 004 | ⏳ Post-MVP |
| NFR-006 Branding | PingWeather everywhere user-facing | ✅ Device-verified |

## Infrastructure

### Dual-Project Jest Config
- **Logic project** — `testEnvironment: 'node'`, custom babel config with `@babel/preset-env` + `@babel/preset-typescript`. Tests stores, engine, data structures, flows, and pure service helpers without React Native dependencies. **This is the only test layer that counts as verification per the ruthless-mentor contract.**
- **Components project** — `testEnvironment: 'jsdom'`, adds `@babel/preset-react` for JSX. Uses `@testing-library/react-native` with `react-test-renderer`. Bypasses `jest-expo` preset to avoid the `winter/runtime.native.ts` lazy-getter bug. **Explicitly flagged in MEMORY.md as text-presence only — NOT real verification.** Results here should never be cited as proof that a UI works. 8 fraudulent tests were deleted on 2026-04-08; the remaining 85 are kept for now but will be removed the moment any of them fail without a corresponding user-facing change.

### Global Mocks (`jest.setup.ts`)
- `@react-native-async-storage/async-storage` — in-memory Map-backed store
- `@supabase/supabase-js` — singleton client mock with chainable query builder and `__setFromResponse` helper
- `expo-linking` — deterministic `createURL(path) => 'pingweather://' + path` so auth store tests can assert exact `redirectTo` value
- `expo-secure-store`, `expo-constants`, `expo-location`, `expo-notifications`, `expo-router`, `expo-status-bar` — lightweight stubs
- Global factory helpers: `mockProfile`, `mockLocation`, `mockRule` on `globalThis`

### Local Mocks (`__mocks__/`)
- Minimal stubs for logic tests that don't need React Native runtime
- Used via `moduleNameMapper` in both project configs

## Running Tests

```bash
# Full suite
npm test

# Logic tests only
npm test -- --selectProjects logic

# Component tests only
npm test -- --selectProjects components

# Specific file
npx jest __tests__/services/hourlyForDay.test.ts --selectProjects logic
```

## What's Not Covered by Unit Tests (and why)

The following are NOT covered by any Jest test and the only verification paths available are device-on-Jimmy or manual SQL inspection:

- **Edge Function runtime behavior** — `poll-weather`, `evaluate-alerts`, `register-push-token` run in Deno and can't be imported by Node Jest. Verification: `net.http_post` from the Supabase SQL editor, inspecting `net._http_response` + function logs + database row state after the call.
- **React Native screen behavior** — the jsdom components project is flagged as unreliable. Verification: Jimmy on device.
- **Supabase RLS policies** — no automated policy tests. Verification: manual SELECT/INSERT/UPDATE as authenticated user vs service role.
- **FCM V1 push delivery** — tested via direct `net.http_post` to `exp.host/--/api/v2/push/send` using Jimmy's real push token in his profile. One-shot smoke tests, not automated.
- **pg_cron schedule firing** — verified by waiting for the top of the hour and inspecting `cron.job_run_details` + `net._http_response`.

## What's Next

1. **Maestro E2E suite** (INFRA-001) — the real fix for the components-layer verification gap.
2. **RevenueCat SDK integration** (INFRA-004) — once installed, add sandbox-mode test cases for the purchase lifecycle in the logic project.
3. **Integration tests for the Edge Functions** — possibly a separate Deno test runner using `deno test` against a local Supabase instance. Not urgent.
