# Project Memory — PingWeather

> Persistent learnings maintained across Claude sessions.
> Updated when non-obvious behaviors, gotchas, or platform quirks are discovered.
> Last updated: 2026-04-08

## Project Overview

- **Name:** PingWeather (rebrand from original "WeatherWatch" — do NOT reintroduce the old name anywhere user-facing)
- **Entity:** Truth Centered Tech, Delaware, US (legal@truthcenteredtech.com, privacy@truthcenteredtech.com)
- **Stack:** Expo SDK 54 + React Native 0.81 + TypeScript strict + Zustand v5 + Expo Router v6 + Supabase
- **Target:** Android primary, iOS secondary (untested)
- **Supabase project id:** `ziyxkgbrdliwvztotxli` (already linked via `supabase/config.toml`)
- **Developer account (special privileges):** `jimmy@truthcenteredtech.com` — only this email sees the dev tier override in Settings

## Architecture Learnings

### Geocoding Service Structure
**Discovered:** 2026-04-08
Pure, testable service wrapping Open-Meteo Geocoding API. No deps, uses native `fetch`, handles optional fields, validates query length client-side (2+ chars) to avoid API spam.
- `src/services/geocoding.ts` — formatLocationLabel, searchPlaces
- `__tests__/services/geocoding.test.ts` — 25 unit tests with mocked fetch

### Store Return Contract
**Discovered:** 2026-04-08 (after Save silent-failure bug)
`locationsStore.addLocation` and `updateLocation` return `Promise<boolean>`, not `Promise<void>`. UI consumers MUST check the return to decide whether to reset forms. All catch blocks log via `console.error('[storeName] <action> error:', err)` and surface the real `err.message` to state — no generic fallback strings.

### Jest dual-project config
**Discovered:** 2026-04-08
Single jest-expo preset cannot handle both logic and component tests due to expo `winter/runtime.native.ts` lazy polyfills hitting Jest's sandbox. Split into two projects:
- `logic` — testEnvironment `node`, babel-jest with preset-env + preset-typescript. Tests stores, services, helpers, engine.
- `components` — testEnvironment `jsdom`, babel-jest with preset-env + preset-typescript + preset-react. Tests screen renders via `@testing-library/react-native`.
- **jest-expo preset is NOT used anywhere** because it triggers the winter runtime bug. Dropped intentionally.
- Global mocks in `jest.setup.ts` cover AsyncStorage, Supabase singleton, expo modules, expo-router.
- Local `__mocks__/` stubs include `react-native.js` with just the primitives used in tests.

### Tests can be fraudulent
**Discovered:** 2026-04-08 (Jimmy called this out multiple times)
jsdom tests with `getByText` only verify text presence — they do NOT verify real behavior. A test that fails only when text is missing will PASS when `onPress={() => {}}` is a no-op, when a tab has the wrong label, when a route is unmatched, or when a scroll gesture is blocked by a Pressable wrapper. **Do not claim "works/done/fixed" based on jsdom tests.** State verification method explicitly per the ruthless-mentor contract. Maestro is the right tool for RN UI verification; until it's set up, Jimmy verifies on device.

## Known Bugs & Workarounds

### Dev tier override gate
**Status:** fixed
**What:** Only `jimmy@truthcenteredtech.com` sees the Developer Options section in Settings. Check lives in `src/utils/devAccount.ts` → `isDevAccount(email)` (case-insensitive, whitespace-trimmed). Unit tested.

### app.json stripped for Expo Go
**Status:** technical debt — must restore before EAS build
**What:** During Expo Go crash troubleshooting, several things were removed from `app.json` that need to come back for a real dev build:
- `expo-notifications` plugin config (icon + color)
- `expo-location` plugin config (iOS + Android permission strings)
- Android permissions array (`ACCESS_FINE_LOCATION`, `RECEIVE_BOOT_COMPLETED`, `ACCESS_BACKGROUND_LOCATION`, etc.)
- `googleServicesFile: "./google-services.json"` reference
- `newArchEnabled: true`
- `edgeToEdgeEnabled: true` on Android
These must be re-added before `eas build` can produce a notification-capable APK.

### assets/notification-icon.png missing
**Status:** blocker for EAS build
**What:** The `expo-notifications` plugin expects `./assets/notification-icon.png` to exist. Currently doesn't. Create a plain 96x96 white PNG (placeholder) before building.

### pg_cron scheduled polling not yet set up
**Status:** open
**What:** The `pg_cron` extension has been enabled in Supabase, but no cron job has been created yet to call the `poll-weather` Edge Function hourly. SQL to be written.

### Address search on locations no longer cosmetic
**Status:** fixed 2026-04-08
**What:** BUG-001. Was previously a dead TextInput. Now uses real `<LocationSearchInput>` component backed by `searchPlaces` from the geocoding service. Debounced 300ms, race-guard via `lastSelectedLabelRef`, keeps selected label visible after tap-to-select, suppresses follow-up search via ref check in debounce effect.

### Expo Go cannot test push notifications
**Status:** by-design
**What:** expo-notifications was removed from Expo Go in SDK 53+. Any push notification work requires an EAS development build. Lazy-load the notifications module via `usePushNotifications.ts` (already done) so the app doesn't crash in Expo Go when the feature is unused.

### Dead fraudulent component tests
**Status:** open risk
**What:** The `__tests__/screens/*.test.tsx` files pass via shallow jsdom renders that only check for text presence. They're kept in the suite but must NOT be treated as verification of real behavior. Device or Maestro tests are the real verification. When behavior breaks, delete the offending shallow test rather than massaging it back to green.

## Environment & Tooling Notes

### SDK version pins
All `expo-*` packages must match Expo SDK 54 (NOT 55). Several packages default to latest (SDK 55) on `npm install` and must be pinned:
```
expo-router ~6.0.23
expo-notifications ~0.32.16
expo-location ~19.0.8
expo-constants ~18.0.13
expo-linking ~8.0.11
expo-secure-store ~15.0.8
jest-expo ~54.0.0    (still in devDeps but NOT used by jest config)
react-native-reanimated ~4.1.1
react-native-gesture-handler ~2.28.0
react-native-safe-area-context ~5.6.0
react-native-screens ~4.16.0
@react-native-async-storage/async-storage 2.2.0
```

### Windows terminal
Jimmy uses Windows with Git Bash and PowerShell/CMD. `~` shortcut only works in Git Bash. PowerShell/CMD need `C:\Users\jimmy\Code\WeatherWatch\`.

### Expo Go lazy loading
`expo-notifications` is imported lazily in `src/hooks/usePushNotifications.ts` via `require` inside the hook (not top-level) so Expo Go doesn't crash when the hook is referenced but not invoked.

### Supabase migration workflow
`npx supabase db push` is linked and authenticated. Migrations live in `supabase/migrations/`:
- `00001_initial_schema.sql` — base tables (profiles, locations, alert_rules, alert_history) + RLS
- `00002_add_location_default_and_timezone.sql` — adds `is_default boolean` and `timezone text` to locations + partial unique index for one default per user

### Supabase auth email confirmation
Turned OFF in the Supabase project dashboard (Sign In / Providers → Email → Confirm email = off). If a new Supabase project is created, this must be turned off again or signup won't work without email verification.

## Deployment Notes

### EAS build — not yet attempted
When picking this up: see docs/KNOWN_ISSUES.md INFRA-003 for the full checklist. Short version:
1. Create Firebase project → add Android app with package `com.truthcenteredtech.weatherwatch` → download `google-services.json` to project root (gitignored)
2. Restore stripped `app.json` native config (see "app.json stripped for Expo Go" above)
3. Add placeholder `assets/notification-icon.png`
4. `eas init` to populate `extra.eas.projectId` in app.json
5. `eas build --platform android --profile development`
6. Install APK on device
7. Run `npx expo start --dev-client` to iterate without rebuilding
Expo push service (`https://exp.host/--/api/v2/push/send`) is used by the poll-weather Edge Function — works with EAS builds, no direct FCM setup needed for MVP.

### Build quota discipline
Jimmy has blown through EAS build quota before. Rule: ONE good dev build, then iterate JS over `--dev-client`. Only rebuild when changing native modules, plugin config, permissions, or Expo SDK. Plan for ~3-5 total rebuilds over MVP, not 30.
