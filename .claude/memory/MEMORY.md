# Project Memory — PingWeather

> Last updated: 2026-04-24 (session 2)

## Project Identity

- **Name:** PingWeather (rebrand from "WeatherWatch" — DO NOT reintroduce old name)
- **Entity:** Truth Centered Tech, Virginia, US
- **Stack:** Expo SDK 54 + React Native + TypeScript strict + Zustand v5 + Expo Router v6 + Supabase
- **Supabase project:** `ziyxkgbrdliwvztotxli`
- **Developer account:** `jimmy@truthcenteredtech.com` — dev tier override in Settings

---

## Current Status

**Play Store internal testing: LIVE**
**EAS build versionCode 7 queued** — build ID `63650036-b779-4bc1-881d-a61d0f11dadb`
**Supabase migrations: 00001–00012 applied**
**Tests: 450/450 logic tests passing**
**Next step: install versionCode 7 → recruit 12+ testers for closed testing (14 days)**

### Completed — do not re-propose

| Item | Notes |
|---|---|
| RevenueCat Android | `goog_XykDmtoZwUNDfBgswNJaIkDLjNC`, products + webhook live |
| Open-Meteo commercial license | EAS: `EXPO_PUBLIC_OPEN_METEO_API_KEY=eNFRDFntQmSudB7E`; Supabase secret: `OPEN_METEO_API_KEY` |
| Privacy policy | `truthcenteredtech.com/pingweather-privacy` |
| Play Store internal testing | versionCode 5 live; versionCode 7 queued |
| Apple Developer Program | Enrolled |
| Edge Functions | poll-weather, evaluate-alerts, register-push-token, send-digest, fcm-keepalive, delete-account, subscription-webhook — all deployed |
| Push token registration | Fixed — `adminClient.auth.getUser(jwt)` pattern |
| delete-account | Fixed — same broken getUser() pattern; was always 401 |
| forecast_cache table | Migration 00012 — poll-weather writes, send-digest reads (< 2h) |
| evaluate-alerts batching | N serial writes → N parallel inserts + 1 batch UPDATE IN |
| poll-weather timezone backfill | `extractTimezone()` writes IANA tz to `locations.timezone` when null. 7 unit tests. |
| Forecast digest timezone fix | All locations backfilled `America/New_York`; `addLocation()` now stores timezone from geocoding |
| Forecast day label TZ fix | `new Date(y, m-1, d)` — ships in versionCode 7 |
| EAS OTA configured | `expo-updates`, `runtimeVersion: sdkVersion`, channels in eas.json — active after versionCode 7 installed |
| usePushNotifications refactor | Returns `{token, error}` object |
| Forecast digest + send-digest | Complete — hourly Edge Function, daily/weekly, F/C support |
| FCM keepalive | Daily silent push at 10:00 UTC (migration 00011) |
| Battery opt prompt | `app/onboarding/battery-setup.tsx` |
| Forecast UI | 14-day outlook: icons, headers, "NW 12 mph" wind format |
| iOS config | `feature/ios-support` branch — blocked on Apple M0 |

### Not done — gates production

1. **Install versionCode 7** — fixes TZ display bug, activates OTA
2. **Closed testing (12+ testers, 14 days)** — clock starts at tester #12
3. **RevenueCat iOS** — blocked on Apple M0
4. **Real SMTP (Resend)** — deferred
5. **Maestro E2E suite** — deferred
6. **Integration test: timezone backfill** — `scripts/test-timezone-backfill.ts` written; run with `SUPABASE_SERVICE_ROLE_KEY=<key> npx ts-node scripts/test-timezone-backfill.ts`

---

## Architecture

### Open-Meteo call architecture — do not change without understanding

```
Client (app open / pull-to-refresh)
  → Open-Meteo directly → always fresh ✅

pg_cron hourly
  → poll-weather → Open-Meteo (once per 0.1° grid) → forecast_cache (upsert)
       ↓
  evaluate-alerts → alert notifications

pg_cron hourly
  → send-digest → forecast_cache if < 2h old, else Open-Meteo fallback
```

**Client MUST stay on direct Open-Meteo calls.** Routing through cache introduces up to 1-hour staleness — explicitly rejected 2026-04-24. Client also needs `weather_code` + `wind_direction_10m_dominant` (drives icons + wind display) that poll-weather doesn't fetch.

### Edge Function JWT validation — critical pattern

Always use `adminClient.auth.getUser(jwt)` where `adminClient = createClient(url, serviceRoleKey)`.

`createClient(anonKey, { global: { headers: { Authorization } } }).auth.getUser()` **always returns null** — fresh client has no session object. This burned us in register-push-token AND delete-account.

### Location timezone — required for digest

`locations.timezone` (IANA string) must be non-null for send-digest to fire (`shouldSendNow` returns false immediately when null). Populated by:
1. `addLocation()` passes `result.timezone` from geocoding API response
2. `poll-weather` backfills from Open-Meteo response when null

If a location has `timezone: null`, the digest silently skips that user forever.

### Geocoding API returns timezone

Open-Meteo Geocoding API includes `timezone?: string` in results. Pass it through `addLocation(name, lat, lon, timezone)` — the 4th param is optional. Both `locations.tsx` and `location-setup.tsx` do this now.

### Edge Function test pattern

Extract pure logic as named function, copy verbatim into `__tests__/services/<name>.test.ts`. See `processInBatches.test.ts` and `pollWeatherTimezone.test.ts`.

### Store return contract

`locationsStore.addLocation` and `updateLocation` return `Promise<boolean>`. UI consumers MUST check the return.

---

## Known Bugs & Workarounds

### Day-detail hourly screen — TZ gotcha (DO NOT REFACTOR)
`getHourlyForDay` uses `.startsWith(isoDate)` — `new Date("YYYY-MM-DD")` gives UTC midnight, drifts to previous day west of UTC.

### supabase-js UPDATE + ORDER/LIMIT silently no-ops (BUG-007)
`.update().eq().order().limit()` — order/limit ignored on UPDATE. Always update by PK.

### Rate-limit cycle feature — REVERTED
DO NOT re-attempt without concrete UX research.

### FCM V1 setup gotchas
- Google Workspace orgs block service account key creation — disable org policy `iam.disableServiceAccountKeyCreation` temporarily
- EAS credentials path: Android → development → Google Service Account → Manage Push Notifications (FCM V1). NOT the top-level "Upload" (that's Play Store)
- Delete local JSON immediately after EAS upload

### Jest config
- `logic` project — node env, all stores/services/helpers. Acceptable verification.
- `components` project — jsdom, text-presence only. **FRAUDULENT VERIFICATION** — never cite as proof UI works.
- jest-expo preset NOT used (winter runtime bug)

---

## Environment & Tooling

### SDK pins (Expo SDK 54)
expo-router ~6.0.23, expo-notifications ~0.32.16, expo-location ~19.0.8, expo-constants ~18.0.13, expo-linking ~8.0.11, expo-secure-store ~15.0.8

### EAS build discipline
`autoIncrement: true` handles versionCode in preview + production. Never manually bump.

### Deploy order (always)
1. `npx supabase functions deploy <name>`
2. `npx supabase db push`
3. `eas build --platform android --profile preview`

### RevenueCat products
`src/services/purchases.ts` TIER_PACKAGE_MAP: `pro: '$rc_pro_monthly'`, `premium: '$rc_premium_monthly'`
`subscription-webhook` PRODUCT_TIER_MAP handles both bare productId and `product:base_plan` format.
RC service account setup required disabling GCP org policy `iam.disableServiceAccountKeyCreation` temporarily.
