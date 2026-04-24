# Project Memory — PingWeather

> Last updated: 2026-04-24 (session 3 — comprehensive review)

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
**Supabase migrations: 00001–00016 applied** (00013–00016 new this session)
**Tests: 465/465 logic tests passing**
**Next step: deploy migrations 00013–00016, deploy get-forecast Edge Function, OTA update, install versionCode 7**

### Jimmy's required manual actions before next OTA

1. **Revoke Open-Meteo commercial key** at customer.open-meteo.com — the old key `eNFRDFntQmSudB7E` is now baked into APK bundles and should be rotated
2. **Generate new Open-Meteo key**, update Supabase function secret `OPEN_METEO_API_KEY` via `npx supabase secrets set OPEN_METEO_API_KEY=<new-key>`
3. **Remove `EXPO_PUBLIC_OPEN_METEO_API_KEY`** from EAS env (preview + production profiles) — no longer needed; client now calls get-forecast Edge Function

### Completed — do not re-propose

| Item | Notes |
|---|---|
| RevenueCat Android | `goog_XykDmtoZwUNDfBgswNJaIkDLjNC`, products + webhook live |
| Open-Meteo commercial license | Supabase secret: `OPEN_METEO_API_KEY` (client key rotated per manual actions above) |
| Privacy policy | `truthcenteredtech.com/pingweather-privacy` |
| Play Store internal testing | versionCode 5 live; versionCode 7 queued |
| Apple Developer Program | Enrolled |
| Edge Functions | poll-weather, evaluate-alerts, register-push-token, send-digest, fcm-keepalive, delete-account, subscription-webhook, get-forecast — all deployed |
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
| Security fixes | RLS WITH CHECK, forecast_cache policy, coordinate CHECK constraints (migration 00013) |
| Missing indexes | locations.user_id, alert_rules.location_id/user_id (migration 00014) |
| alert_history dedup | Unique index on (rule_id, hour_utc) — no duplicate push same hour (migration 00015) |
| Digest/keepalive cron fix | Vault secret names corrected, both cron jobs now fire (migration 00016) |
| Open-Meteo key security | get-forecast Edge Function proxies with server-side key; client never sees key |
| weatherEngine shared module | Pure logic in src/utils/weatherEngine.ts (Jest) + supabase/functions/_shared/ (Deno) |
| Fraudulent tests fixed | Tests now import from src/utils/weatherEngine — not inline clones |

### Backlog — nice to have, not blocking

- **Digest: multi-day (3-day) forecast view** — show 3 days instead of just today; format as Today/Sat/Sun with high/low/rain
- **Digest: weather condition images/icons** — WMO weather code → emoji or image in push body (Android supports BigPicture style)
- **Favicon** — currently just a dot; not blocking for mobile but fix before any web presence

### Not done — gates production

1. **Install versionCode 7** — after OTA is deployed
2. **Deploy migrations 00013–00016** — `npx supabase db push`
3. **Deploy get-forecast** — `npx supabase functions deploy get-forecast`
4. **OTA update** — `eas update --branch preview --message "Security fixes + cache key fix + digest cron fix"`
5. **Rotate Open-Meteo commercial API key** — key `eNFRDFntQmSudB7E` is baked into versionCode 7 APK bundle. Must be rotated before production launch. Steps: find key management in Open-Meteo account (check purchase confirmation email), revoke old key, generate new, then `npx supabase secrets set OPEN_METEO_API_KEY=<new-key>` + remove `EXPO_PUBLIC_OPEN_METEO_API_KEY` from EAS preview/production env vars
6. **Closed testing (12+ testers, 14 days)** — clock starts at tester #12
7. **RevenueCat iOS** — blocked on Apple M0
8. **Real SMTP (Resend)** — deferred
9. **Maestro E2E suite** — deferred
10. **Integration test: timezone backfill** — `SUPABASE_SERVICE_ROLE_KEY=<key> npx ts-node scripts/test-timezone-backfill.ts`

---

## Architecture

### Open-Meteo call architecture — do not change without understanding

```
Client (app open / pull-to-refresh)
  → get-forecast Edge Function (verify_jwt=true) → Open-Meteo (server-side key) → response

pg_cron hourly
  → poll-weather → Open-Meteo (server-side OPEN_METEO_API_KEY) → forecast_cache (upsert, key = gridKey(lat,lon))
       ↓
  evaluate-alerts → alert notifications

pg_cron hourly
  → send-digest → forecast_cache if < 2h old (same gridKey), else Open-Meteo fallback
```

**Client calls get-forecast Edge Function (NOT Open-Meteo directly).** Rationale: keeps commercial API key server-side only. The old direct-fetch pattern baked the key into the APK bundle. **Do not revert to direct Open-Meteo calls from client.**

**Cache key must be `gridKey(lat, lon)` everywhere.** Both poll-weather write and send-digest read use the shared `gridKey()` function from `_shared/weatherEngine.ts` — rounds to 0.1°. Any mismatch causes permanent cache miss.

### weatherEngine shared module — critical for test integrity

`src/utils/weatherEngine.ts` — the single source of truth for all pure weather logic:
- `gridKey`, `extractTimezone`, `processInBatches`
- `getMetricValues`, `compare`, `evaluateCondition`, `evaluateRule`, `isInCooldown`
- `formatConditionSummary`
- All shared interfaces: `AlertRule`, `ForecastData`, `Condition`, `EvalResult`

`supabase/functions/_shared/weatherEngine.ts` is a **verbatim copy** for Deno bundler.
Supabase bundler cannot import outside `supabase/` directory — `../../src/utils/` resolves to a non-existent path in the bundle.

**Rule:** Any logic change to weatherEngine MUST be applied to both copies. Tests import from `src/utils/weatherEngine`.

### Edge Function JWT validation — critical pattern

Always use `adminClient.auth.getUser(jwt)` where `adminClient = createClient(url, serviceRoleKey)`.

`createClient(anonKey, { global: { headers: { Authorization } } }).auth.getUser()` **always returns null** — fresh client has no session object. This burned us in register-push-token AND delete-account.

### Vault secret names — do not guess

`npx supabase db query "select name from vault.decrypted_secrets" --linked` to see what's actually in vault.

Existing secrets: `poll_weather_function_url`, `poll_weather_service_role_key`.
Wrong names (migration 00009/00011 used these — they return NULL): `supabase_url`, `service_role_key`.
Migration 00016 fixes the digest/keepalive cron jobs by deriving their URLs from `poll_weather_function_url` via regexp_replace.

### Location timezone — required for digest

`locations.timezone` (IANA string) must be non-null for send-digest to fire (`shouldSendNow` returns false immediately when null). Populated by:
1. `addLocation()` passes `result.timezone` from geocoding API response
2. `poll-weather` backfills from Open-Meteo response when null

If a location has `timezone: null`, the digest silently skips that user forever.

### Geocoding API returns timezone

Open-Meteo Geocoding API includes `timezone?: string` in results. Pass it through `addLocation(name, lat, lon, timezone)` — the 4th param is optional. Both `locations.tsx` and `location-setup.tsx` do this now.

### Edge Function test pattern

Pure logic lives in `src/utils/weatherEngine.ts`. Tests import directly from there — no inline copies.
See `evaluateConditions.test.ts`, `processInBatches.test.ts`, `pollWeatherTimezone.test.ts`.

### Store return contract

`locationsStore.addLocation` and `updateLocation` return `Promise<boolean>`. UI consumers MUST check the return.

---

## Known Bugs & Workarounds

### Day-detail hourly screen — TZ gotcha (DO NOT REFACTOR)
`getHourlyForDay` uses `.startsWith(isoDate)` — `new Date("YYYY-MM-DD")` gives UTC midnight, drifts to previous day west of UTC.

### supabase-js UPDATE + ORDER/LIMIT silently no-ops (BUG-007)
`.update().eq().order().limit()` — order/limit ignored on UPDATE. Always update by PK.

### Supabase bundler path resolution
Edge Functions can only import from within `supabase/` directory. Relative paths like `../../src/utils/` appear to resolve but the bundler resolves them relative to `supabase/` root — ending up at `supabase/src/utils/` which doesn't exist. Symptom: deploy succeeds but function fails at runtime with module-not-found. Fix: use `../_shared/` for shared code.

### date_trunc is STABLE not IMMUTABLE
PostgreSQL index expressions must be IMMUTABLE. `date_trunc('hour', timestamptz)` is STABLE. Workaround: wrap in a dedicated function declared IMMUTABLE (see migration 00015 `triggered_at_hour_utc(timestamptz)`).

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

### AsyncStorage brand key migration (P3 — deferred)
Stores use `weatherwatch-*` AsyncStorage keys (old brand name). Users upgrading after a key rename would lose persisted state. Needs a migration strategy before production launch.

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

### OTA deploy (JS-only changes, post versionCode 7)
`eas update --branch preview --message "<description>"`
No new build required for pure-JS changes. Activates after versionCode 7 installed.

### RevenueCat products
`src/services/purchases.ts` TIER_PACKAGE_MAP: `pro: '$rc_pro_monthly'`, `premium: '$rc_premium_monthly'`
`subscription-webhook` PRODUCT_TIER_MAP handles both bare productId and `product:base_plan` format (e.g. `pro_monthly:monthly`).
RC service account setup required disabling GCP org policy `iam.disableServiceAccountKeyCreation` temporarily.
