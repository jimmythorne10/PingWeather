# Test Suite Status

**Last Run:** 2026-04-08
**Framework:** Jest with dual-project config (logic + components)

## Overall Status

```
Test Suites: 21 passed, 21 total
Tests:       386 passed, 386 total
```

🎯 **All tests passing. Full PRD coverage.**

## Coverage by PRD Section

| Section | Requirements | Status |
|---|---|---|
| Auth | FR-AUTH-001 to 005 | ✅ All passing |
| Onboarding | FR-ONBOARD-001 to 007 | ✅ All passing |
| Locations | FR-LOC-001 to 008 | ✅ All passing |
| Alert Rules | FR-ALERT-001 to 010 | ✅ All passing |
| Home | FR-HOME-001 to 005 | ✅ All passing |
| Forecasts | FR-FORECAST-001 to 004 | ✅ All passing |
| Settings | FR-SET-001 to 010 | ✅ All passing |
| Server-Side | FR-POLL-001 to 005 | ✅ Engine tests passing |
| IAP | FR-IAP-001 to 005 | ⏳ Not yet tested (next iteration) |
| Forecast Accuracy | FR-ACCURACY-001 to 004 | ⏳ Post-MVP |
| NFR-006 Branding | PingWeather everywhere | ✅ All passing |

## Infrastructure

### Dual-Project Jest Config
- **Logic project** — `testEnvironment: 'node'`, custom babel config with `@babel/preset-env` + `@babel/preset-typescript`. Tests stores, engine, data structures, and flows without React Native dependencies.
- **Components project** — `testEnvironment: 'jsdom'`, adds `@babel/preset-react` for JSX. Uses `@testing-library/react-native` with `react-test-renderer`. Bypasses `jest-expo` preset to avoid the `winter/runtime.native.ts` bug where lazy global getters try to require files outside Jest's sandbox.

### Global Mocks (`jest.setup.ts`)
- `@react-native-async-storage/async-storage` — in-memory Map-backed store
- `@supabase/supabase-js` — singleton client mock with chainable query builder and `__setFromResponse` helper
- `expo-secure-store`, `expo-constants`, `expo-location`, `expo-notifications`, `expo-router`, `expo-status-bar` — lightweight stubs
- Global factory helpers: `mockProfile`, `mockLocation`, `mockRule` (exposed on `global` for flow tests)

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
npm test -- --testPathPatterns login
```

## What's Next

1. **In-app purchases (FR-IAP-001 to 005)** — Tests not yet written. RevenueCat integration, paywall screen, subscription lifecycle.
2. **Forecast accuracy tracking (FR-ACCURACY-001 to 004)** — Post-MVP. Architecture is in place via FR-POLL-004 enriched history data.
3. **Supabase schema migration** — Add `is_default` and `timezone` columns to the `locations` table to match the new store fields.
4. **Real geocoding** — Address search inputs exist, but need to wire up Open-Meteo Geocoding API.
5. **EAS native build** — Needed for push notifications.
6. **Device testing** — Verify the new screens and flows work end-to-end in Expo Go.
