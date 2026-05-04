# Project Memory — PingWeather

> Last updated: 2026-05-03 (session 10 — wind direction, pressure tendency, 4 new metrics, AsyncStorage migration, OTA live)

## Project Identity

- **Name:** PingWeather (rebrand from "WeatherWatch" — DO NOT reintroduce old name)
- **Entity:** Truth Centered Tech, Virginia, US
- **Stack:** Expo SDK 54 + React Native + TypeScript strict + Zustand v5 + Expo Router v6 + Supabase
- **Supabase project:** `ziyxkgbrdliwvztotxli`
- **Developer account:** `jimmy@truthcenteredtech.com` — dev tier override in Settings

---

## Current Status

**Play Store internal testing: LIVE — versionCode 7 installed**
**OTA LIVE — preview channel, update group `e5cce15f-2f55-41e0-a70c-66fdc591e2cd`, commit `43bd16b`**
**Supabase migrations: 00001–00017 applied**
**Tests: 684/684 logic tests passing**
**Edge Functions: poll-weather + get-forecast redeployed 2026-05-03 (new hourly params)**
**Next milestone: closed testing (12+ testers, 14 days)**
**Closed testing: RECRUITING — tester list in progress. Jimmy posted Discord pitch 2026-04-29. Play Console track created.**
**Apple Developer enrollment: Company (Truth Centered Tech) submitted 2026-04-29 — awaiting approval.**
**Open-Meteo key rotation: COMPLETE — new key `y8A63e8V82EPsr7j` set in Supabase secrets 2026-05-03. Old key `eNFRDFntQmSudB7E` revoked. `EXPO_PUBLIC_OPEN_METEO_API_KEY` removed from EAS preview + production.**

### Jimmy's required manual actions (still pending)

_(none — Open-Meteo key rotation complete)_

### Completed — do not re-propose

| Item | Notes |
|---|---|
| RevenueCat Android | `goog_XykDmtoZwUNDfBgswNJaIkDLjNC`, products + webhook live |
| Open-Meteo commercial license + key rotation | Supabase secret `OPEN_METEO_API_KEY` set to new key `y8A63e8V82EPsr7j` 2026-05-03. Old key `eNFRDFntQmSudB7E` revoked. `EXPO_PUBLIC_OPEN_METEO_API_KEY` removed from EAS preview + production. |
| Privacy policy | `truthcenteredtech.com/pingweather-privacy` |
| Play Store internal testing | versionCode 7 live |
| Play Store listing | Screenshots, short/full description, data safety form — all complete. Store listing fully populated as of session ~5. |
| Apple Developer Program | Company enrollment submitted 2026-04-29 — awaiting approval (1–3 business days). Personal account showed "Enroll today" — enrollment is for Truth Centered Tech entity, not personal. |
| Edge Functions | poll-weather, evaluate-alerts, register-push-token, send-digest, fcm-keepalive, delete-account, subscription-webhook, get-forecast — all deployed |
| Push token registration | Fixed — `adminClient.auth.getUser(jwt)` pattern |
| delete-account | Fixed — same broken getUser() pattern; was always 401 |
| forecast_cache table | Migration 00012 — poll-weather writes, send-digest reads (< 2h) |
| evaluate-alerts batching | N serial writes → N parallel inserts + 1 batch UPDATE IN |
| poll-weather timezone backfill | `extractTimezone()` writes IANA tz to `locations.timezone` when null. 7 unit tests. |
| Forecast digest timezone fix | All locations backfilled `America/New_York`; `addLocation()` now stores timezone from geocoding |
| Forecast day label TZ fix | `new Date(y, m-1, d)` — shipped in versionCode 7 + OTA |
| EAS OTA configured + active | `expo-updates`, `runtimeVersion: sdkVersion`, channels in eas.json — live since OTA 2026-04-28 |
| usePushNotifications refactor | Returns `{token, error}` object |
| Forecast digest + send-digest | Complete — hourly Edge Function, daily/weekly, F/C support |
| FCM keepalive | Daily silent push at 10:00 UTC (migration 00011) |
| Battery opt prompt | `app/onboarding/battery-setup.tsx` |
| Forecast UI | 14-day outlook: icons, headers, "NW 12 mph" wind format |
| iOS config | `feature/ios-support` branch — merged to main 2026-04-28, blocked on Apple M0 for actual build |
| Security fixes | RLS WITH CHECK, forecast_cache policy, coordinate CHECK constraints (migration 00013) |
| Missing indexes | locations.user_id, alert_rules.location_id/user_id (migration 00014) |
| alert_history dedup | Unique index on (rule_id, hour_utc) — no duplicate push same hour (migration 00015) |
| Digest/keepalive cron fix | Vault secret names corrected, both cron jobs now fire (migration 00016) |
| Open-Meteo key security | get-forecast Edge Function proxies with server-side key; client never sees key |
| weatherEngine shared module | Pure logic in src/utils/weatherEngine.ts (Jest) + supabase/functions/_shared/ (Deno) |
| Fraudulent tests fixed | Tests now import from src/utils/weatherEngine — not inline clones |
| Rainfall history feature | `rainfallApi.ts` + `RainfallCard.tsx` — 24h/7d/30d windows, inch/mm auto-unit, shown in forecasts tab collapsed by default (accordion, lazy-load on expand) — **device verified** |
| Enhanced notifications | `matchedTime` propagated through evaluateCondition → evaluateRule → poll-weather; day label prepended to push body (e.g. "Tomorrow: High 95°F...") |
| Home screen forecast tap | Day cards tap → Forecasts tab via `router.navigate('/(tabs)/forecasts', { expandLocationId })`. Forecasts tab reads param + auto-expands/loads that location. `processedExpandRef` prevents re-fire on unrelated renders. — **device verified** |
| day-detail header/padding | Removed duplicate native Stack header (`headerShown: false`); safe area handled via `useSafeAreaInsets` inline contentContainerStyle (`paddingTop: insets.top+16, paddingBottom: Math.max(insets.bottom+40, 80)`). Still reachable from Forecasts tab 14-day row tap. |
| Wind speed unit profile sync | Settings screen syncs wind_speed_unit to Supabase profiles immediately on change |
| migration 00017 | Adds `wind_speed_unit` column to profiles table — applied remotely |
| syncTierToSupabase removed | Client-side tier sync removed from purchases.ts; subscription-webhook is only valid write path (RLS blocks user-JWT writes) |
| FCM keepalive token pruning | `fcm-keepalive` now prunes DeviceNotRegistered tokens in a single batch UPDATE |
| 7 new alert metrics | precipitation_amount, barometric_pressure, snowfall, snow_depth, soil_temperature, weather_code, moon_phase — in weatherEngine + types + rule builder + 5 new presets. Shipped OTA `53231720` 2026-05-03. **Device verification pending.** |
| WMO emoji in notifications | `weatherCodeToEmoji()` in weatherEngine; prepended to poll-weather push body. Shipped same OTA. |
| 3-day digest | send-digest shows Today/Tomorrow/DayName with Hi/Lo/emoji/rain%. Deployed 2026-05-03. **Live invocation verification pending.** |
| Branded OTA update screen | `UpdateCheckScreen.tsx` — navy background, animated pulse, 5s timeout/fallback. `checkAutomatically: NEVER` in app.json. Shipped same OTA. **Device verification pending (preview/production build only).** |
| Moon phase chip picker + unit bugs fixed | Rule builder: moon_phase shows 🌑🌒🌓🌔🌕 phase chips (not raw %). soil_temperature unit fixed (was hardcoded celsius; now follows user's temperatureUnit). snow_depth unit was also wrong. `src/utils/metricHelpers.ts` extracted. 62 tests were silently skipped (wrong __tests__ subdirectory) — moved to `__tests__/engine/` where logic project picks them up. 524 → 586 tests. |
| Forecast UI — new metrics display | forecasts.tsx daily cards: moon emoji + UV index (≥3) + baro pressure (noon reading). day-detail hourly rows: surface_pressure, snowfall, snow_depth, soil_temperature with user unit. **Device verification pending.** |
| 4 new metrics: wind_gusts, dew_point, visibility, cloud_cover | Full pipeline: Open-Meteo → get-forecast → weatherEngine → types → rule builder. Visibility stored in miles (÷1609.34 at engine layer). Category-filtered metric selector replaces flat chip list. |
| Wind direction (from_bearing operator) | Circular math: `diff = ((actual - bearing) % 360 + 360) % 360; angleDiff = diff ≤ 180 ? diff : 360-diff; triggered = angleDiff ≤ tolerance`. UI: compass bearing chips (N/NE/E/SE/S/SW/W/NW) + tolerance selector (±22.5°–±90°). Presets: north-wind preset. 18 unit tests. |
| Pressure tendency | Derived metric: `last - first` of surface_pressure in eval window. Positive = rising, negative = falling. Preset: rapid-pressure-drop (lt -8 hPa). 8 unit tests. |
| AsyncStorage migration | One-time migration from `weatherwatch-*` → `pingweather-*` keys on first app launch. Flag: `pingweather-migration-v1-done`. Non-fatal, safe for fresh installs. Runs in `_layout.tsx` startup. 8 unit tests. |
| OTA `e5cce15f` | All session-10 work shipped. Edge Functions redeployed (poll-weather + get-forecast) to fetch new hourly params. **Device verification pending.** |

### Backlog — nice to have, not blocking

- **Favicon** — currently just a dot; not blocking for mobile but fix before any web presence

### Not done — gates production

1. **Closed testing (12+ testers, 14 days)** — IN PROGRESS recruiting. Track created in Play Console, tester list being built. Jimmy posted Discord pitch 2026-04-29. Clock starts at tester #12 opt-in.
3. **RevenueCat iOS** — blocked on Apple M0
4. **Real SMTP (Resend)** — deferred
5. **Maestro E2E suite** — deferred
6. **Integration test: timezone backfill** — `SUPABASE_SERVICE_ROLE_KEY=<key> npx ts-node scripts/test-timezone-backfill.ts`
7. **Jimmy device verification** — RainfallCard accordion and forecast tap auto-expand confirmed session 6. Notification day label still pending. From session 8: 7 new metrics in rule builder, 5 new presets, branded OTA screen (preview build only), 3-day digest (verify via SQL editor invocation). From session 9+10: moon phase chip picker, unit fixes, forecast UI new metrics display, wind direction compass picker, pressure tendency, AsyncStorage migration — all in OTA `e5cce15f`.

---

## Architecture

### Open-Meteo call architecture — do not change without understanding

```
Client (app open / pull-to-refresh)
  → get-forecast Edge Function (verify_jwt=true) → Open-Meteo (server-side key) → response

Client (rainfall history — RainfallCard)
  → get-forecast Edge Function (past_days + precipitation_unit params) → Open-Meteo → response

pg_cron hourly
  → poll-weather → Open-Meteo (server-side OPEN_METEO_API_KEY) → forecast_cache (upsert, key = gridKey(lat,lon))
       ↓
  evaluate-alerts → alert notifications (with matchedTime day label)

pg_cron hourly
  → send-digest → forecast_cache if < 2h old (same gridKey), else Open-Meteo fallback
```

**Client calls get-forecast Edge Function (NOT Open-Meteo directly).** Rationale: keeps commercial API key server-side only. The old direct-fetch pattern baked the key into the APK bundle. **Do not revert to direct Open-Meteo calls from client.**

**Cache key must be `gridKey(lat, lon)` everywhere.** Both poll-weather write and send-digest read use the shared `gridKey()` function from `_shared/weatherEngine.ts` — rounds to 0.1°. Any mismatch causes permanent cache miss.

### get-forecast — supported extra params

Beyond the default 7-day forecast, `get-forecast` forwards these optional body params to Open-Meteo:
- `past_days` — integer 0-92; used by `rainfallApi.ts` for rainfall history
- `precipitation_unit` — `'inch'` or `'mm'`; used by `rainfallApi.ts`

### OTA deployment — ALWAYS use --platform android

```bash
eas update --platform android --channel preview --message "<description>"
```

**`--platform android` is required.** Without it, `eas update` tries to export web bundle and fails because `react-native-web` is not installed. This burned us once — do not omit.

### weatherEngine shared module — critical for test integrity

`src/utils/weatherEngine.ts` — the single source of truth for all pure weather logic:
- `gridKey`, `extractTimezone`, `processInBatches`
- `getMetricValues`, `compare`, `evaluateCondition`, `evaluateRule`, `isInCooldown`
- `formatConditionSummary`
- `formatMatchedDate(time: string | null | undefined): string | null` — converts ISO/YYYY-MM-DD to "Today"/"Tomorrow"/locale date string; null for invalid/missing
- `matchedTime?: string | null` in `EvaluationResult.matchDetails` — set by `evaluateCondition` when condition is met; propagated through `evaluateRule`; used by `poll-weather` to prepend day label to push notification body
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

### Subscription tier write path

`subscription_tier` on `profiles` has RLS WITH CHECK that blocks user-JWT writes. **The only valid write path is the `subscription-webhook` Edge Function** (service role). `syncTierToSupabase` was removed from `purchases.ts` — do not re-add client-side tier sync.

---

## Known Bugs & Workarounds

### Day-detail hourly screen — TZ gotcha (DO NOT REFACTOR)
`getHourlyForDay` uses `.startsWith(isoDate)` — `new Date("YYYY-MM-DD")` gives UTC midnight, drifts to previous day west of UTC.

### supabase-js UPDATE + ORDER/LIMIT silently no-ops (BUG-007)
`.update().eq().order().limit()` — order/limit ignored on UPDATE. Always update by PK.

### Supabase bundler path resolution
Edge Functions can only import from within `supabase/` directory. Relative paths like `../../src/utils/` appear to resolve but the bundler resolves them relative to `supabase/` root — ending up at `supabase/src/utils/` which doesn't exist. Symptom: deploy succeeds but function fails at runtime with module-not-found. Fix: use `../_shared/` for shared code.

The CLI emits a non-fatal WARN about `supabase\src\utils\weatherEngine.ts` not found — this is from scanning comment text in the file, not an actual import. Ignore it.

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

### eas update requires --platform android
`eas update` without `--platform` tries to export web bundle → fails with missing `react-native-web` dependency. Always run: `eas update --platform android --channel preview --message "..."`.

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

### OTA deploy (JS-only changes)
```bash
eas update --platform android --channel preview --message "<description>"
```
Active since versionCode 7 installed. `--platform android` is required — see Known Bugs.

### RevenueCat products
`src/services/purchases.ts` TIER_PACKAGE_MAP: `pro: '$rc_pro_monthly'`, `premium: '$rc_premium_monthly'`
`subscription-webhook` PRODUCT_TIER_MAP handles both bare productId and `product:base_plan` format (e.g. `pro_monthly:monthly`).
RC service account setup required disabling GCP org policy `iam.disableServiceAccountKeyCreation` temporarily.
