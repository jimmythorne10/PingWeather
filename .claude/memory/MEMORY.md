# Project Memory — PingWeather

> Persistent learnings accumulated across Claude sessions.
> Updated when non-obvious behaviors, gotchas, or platform quirks are discovered.
> Last updated: 2026-04-23

## Current Status — Ready for Android Closed Testing

**Play Store internal testing: LIVE as of 2026-04-23**
**Backend: fully deployed (migrations 00001–00011, all Edge Functions live)**
**Next step: run closed testing (alpha) with 12+ testers for 14 days → Production**

### What is complete (do not re-propose)

| Item | Status |
|---|---|
| RevenueCat Android integration | Done — `goog_XykDmtoZwUNDfBgswNJaIkDLjNC`, products created, webhook live |
| Open-Meteo commercial license | Done — $29/mo, `poll-weather` uses `customer-api.open-meteo.com` + `OPEN_METEO_API_KEY` Supabase secret. `weatherApi.ts` (client) uses `EXPO_PUBLIC_OPEN_METEO_API_KEY` EAS env var — **must be set before next build** |
| Privacy policy | Live at `truthcenteredtech.com/pingweather-privacy` |
| Play Store internal testing | Live — current build (preview AAB, versionCode 3 auto-incremented by EAS) |
| Apple Developer Program | Enrolled — Apple ID unblocked via Apple Support |
| Supabase migrations | 00001–00011 applied to live project |
| Edge Functions deployed | poll-weather, evaluate-alerts, register-push-token, send-digest, fcm-keepalive, delete-account, subscription-webhook |
| Forecast digest feature | Complete — settings UI, send-digest Edge Function, pg_cron hourly |
| FCM keepalive | Complete — silent push daily at 10:00 UTC, keeps Android in active standby |
| Battery opt prompt | Complete — platform-aware onboarding screen (Android: Unrestricted battery; iOS: Background App Refresh) |
| Forecast UI | 14-day outlook: weather icons, column headers, wind direction (NW 12 mph) |
| iOS config | On `feature/ios-support` branch — app.json, eas.json, roadmap. Blocked on M0 completion |

### What is NOT yet done (gates production)

1. **`EXPO_PUBLIC_OPEN_METEO_API_KEY` not yet set as EAS env var** — client-side forecast calls fall back to free endpoint until this is added. Run:
   ```bash
   eas env:create --name EXPO_PUBLIC_OPEN_METEO_API_KEY --value <key> --environment preview
   eas env:create --name EXPO_PUBLIC_OPEN_METEO_API_KEY --value <key> --environment production
   ```
2. **Closed testing (12+ testers, 14 days)** — required before Google allows Production button
3. **RevenueCat iOS** — blocked on Apple Developer M0 completion
4. **Real SMTP (Resend)** — deferred, Supabase mailer acceptable for now
5. **Maestro E2E suite** — deferred

### Go-to-market status

| Task | Status |
|---|---|
| Android internal testing live | Done |
| Open-Meteo commercial license | Done (code fix committed — needs EAS env var next build) |
| RevenueCat Android wired | Done |
| Privacy policy live | Done |
| Play Store store listing | Check Play Console → Store presence |
| 20 testers recruited | In progress |
| Closed testing (14 days) | Not started |
| Android production | Blocked on closed testing |
| iOS M0 (Apple enrollment) | Unblocked — Apple ID enrolled |
| iOS M2 (credentials) | Blocked on APNs key creation |

---

## Session End State (2026-04-22/23) — Feature Build + Branch Cleanup

### What was built this session

**Forecast digest (`feature/forecast-digest` → merged to main):**
- Migrations 00008-00009: digest columns on profiles, pg_cron hourly schedule
- `src/services/digestScheduler.ts` + `digestFormatter.ts` — pure logic, 19 tests
- `supabase/functions/send-digest` — hourly Edge Function, full F/C support
- Settings UI: FORECAST DIGEST section with disable-warning alert
- Migration 00010 + settings sync: `temperature_unit` column, server-synced

**FCM keepalive (`feature/forecast-digest` → merged to main):**
- Migration 00011: pg_cron daily at 10:00 UTC
- `supabase/functions/fcm-keepalive` — silent `_contentAvailable: true` push

**Battery optimization onboarding (`feature/battery-opt-prompt` → merged to main):**
- `app/onboarding/battery-setup.tsx` — platform-aware:
  - Android: "Set to Unrestricted" + `Linking.openSettings()`
  - iOS: "Enable Background App Refresh" + `Linking.openURL('app-settings:')`

**Forecast UI (`feature/forecast-ui-improvements` → merged to main):**
- `degreesToCardinal()` in `weatherIcon.ts` (13 tests)
- `wind_direction_10m_dominant` added to API + DailyForecast type
- 14-day outlook: weather icon column, column headers, "NW 12 mph" wind format

**iOS support (`feature/ios-support` — isolated, NOT merged to main):**
- `app.json`: buildNumber, UIBackgroundModes, APNs entitlement, iOS RevenueCat placeholder
- `eas.json`: iOS simulator dev profile, iOS production profile, submit skeleton
- `docs/ios-roadmap.md`: M0→M10 milestone plan

### Branch state
- `main` — all Android features, clean
- `feature/ios-support` — iOS additions only on top of main

### Tests
- 435/435 logic tests passing
- tsc clean

---

## Session End State (2026-04-22) — RC Complete, Internal Testing Build Running

**RevenueCat integration — fully wired:**
- RC service account JSON created in GCC (required disabling org policy `iam.disableServiceAccountKeyCreation` temporarily)
- Play Console service account granted: View app info, View financial data, Manage orders and subscriptions
- RC credentials now show "Valid credentials" (propagated ~36hr after setup)
- Products created in Play Console: `pro_monthly` ($3.99), `premium_monthly` ($7.99) — US only
- Products imported to RC, entitlements (`pro`, `premium`) and default offering configured
- `REVENUECAT_WEBHOOK_SECRET` set in Supabase dashboard
- `subscription-webhook` Edge Function deployed and verified
- RC SDK key `goog_XykDmtoZwUNDfBgswNJaIkDLjNC` in `app.json` extra.revenueCatAndroidApiKey
- `src/services/purchases.ts` TIER_PACKAGE_MAP: `pro: '$rc_pro_monthly'`, `premium: '$rc_premium_monthly'`
- `supabase/functions/subscription-webhook/index.ts` PRODUCT_TIER_MAP handles both bare and `product:base_plan` format

**Open-Meteo commercial license:**
- $29/mo Standard plan purchased
- `poll-weather` Edge Function: reads `OPEN_METEO_API_KEY`, uses `customer-api.open-meteo.com`
- `OPEN_METEO_API_KEY` secret set in Supabase dashboard
- `weatherApi.ts` (client): reads `EXPO_PUBLIC_OPEN_METEO_API_KEY`, uses `customer-api.open-meteo.com` when present — **EAS env var still needs to be created**

---

## Session End State (2026-04-21) — Play Store Submission

**Google Play compliance fixes:**
- `ACCESS_BACKGROUND_LOCATION` removed
- `delete-account` Edge Function built and deployed
- Privacy policy live at `truthcenteredtech.com/pingweather-privacy`

**ADI (Android Developer Identity) fix:**
- `plugins/withAdiRegistration.js` — copies `adi-registration.properties` to native path during prebuild

---

## Session End State (2026-04-09)

**MVP backend pipeline COMPLETE and verified on device.**
Full chain: `pg_cron → poll-weather → evaluate-alerts → Expo push → FCM V1 → Android`

Schema at migration 00007. Vault: `poll_weather_service_role_key`, `poll_weather_function_url`. Cron: `poll-weather-hourly` active, 30s pg_net timeout.

---

## Project Overview

- **Name:** PingWeather (rebrand from "WeatherWatch" — DO NOT reintroduce old name)
- **Entity:** Truth Centered Tech, Virginia, US
- **Stack:** Expo SDK 54 + React Native + TypeScript strict + Zustand v5 + Expo Router v6 + Supabase
- **Supabase project:** `ziyxkgbrdliwvztotxli`
- **Developer account:** `jimmy@truthcenteredtech.com` — dev tier override in Settings

---

## Architecture Learnings

### Open-Meteo dual-endpoint pattern
Server (`poll-weather`): reads `OPEN_METEO_API_KEY` Supabase secret → commercial endpoint.
Client (`weatherApi.ts`): reads `EXPO_PUBLIC_OPEN_METEO_API_KEY` EAS env var → commercial endpoint.
Both fall back to free URL when key absent (dev/test). The EAS env var must be set separately from the Supabase secret — they are different systems.

### Geocoding Service Structure
Pure, testable service wrapping Open-Meteo Geocoding API.
- `src/services/geocoding.ts` — formatLocationLabel, searchPlaces
- `__tests__/services/geocoding.test.ts` — 25 unit tests

### Store Return Contract
`locationsStore.addLocation` and `updateLocation` return `Promise<boolean>`. UI consumers MUST check the return. All catch blocks log via `console.error('[storeName] <action> error:', err)`.

### Jest dual-project config
- `logic` — node env, covers stores/services/helpers/engine/data/flows
- `components` — jsdom env, text-presence only, FLAGGED AS FRAUDULENT VERIFICATION
- jest-expo preset NOT used (triggers winter runtime bug)

### Fraudulent component tests
jsdom tests verify text presence only. Never cite as proof a UI works. Device or Maestro is required.

### bash-gate.yaml
- `version_incremented` rule replaced with `warn` — `autoIncrement: true` in eas.json handles version bumping
- `field_nonempty` checks `revenueCatAndroidApiKey` (was `revenueCatApiKey` before platform-aware refactor)

---

## Known Bugs & Workarounds

### Day-detail hourly screen — TZ gotcha
`getHourlyForDay` uses `.startsWith(isoDate)` NOT `new Date()` — parsing YYYY-MM-DD gives UTC midnight, drifts to previous day west of UTC. DO NOT refactor to use Date() constructor.

### supabase-js UPDATE + ORDER/LIMIT silently no-ops
`.update(...).eq(...).order(...).limit(...)` — order/limit ignored on UPDATE. Always update by PK. (BUG-007)

### Rate-limit cycle feature — REVERTED
DO NOT re-attempt without concrete UX research. See full post-mortem in prior session notes.

### FCM V1 setup gotchas
- Google Workspace orgs block service account key creation by default — must disable org policy temporarily
- EAS credentials: Android → development → Google Service Account → Manage Push Notifications (FCM V1) — NOT the top-level "Upload" which is for Play Store submissions
- Delete local JSON immediately after EAS upload

---

## Environment & Tooling Notes

### SDK version pins (Expo SDK 54)
expo-router ~6.0.23, expo-notifications ~0.32.16, expo-location ~19.0.8,
expo-constants ~18.0.13, expo-linking ~8.0.11, expo-secure-store ~15.0.8

### Supabase migration workflow
`npx supabase db push` — linked and authenticated. Migrations 00001–00011 applied.

### EAS build discipline
`autoIncrement: true` in preview + production profiles handles versionCode. Never manually bump unless removing autoIncrement.

---

## Deployment Notes

### Deploy order (always)
1. `npx supabase functions deploy <name>` — deploy functions first
2. `npx supabase db push` — apply migrations (pg_cron schedules reference deployed functions)
3. `eas build --platform android --profile preview` — build only after backend is live
