# Project Memory — PingWeather

> Last updated: 2026-05-07 (session 14 — full security audit + Mapbox radar + 3 EAS preview builds, 3rd succeeded; uploaded to Play Console for closed testing)

## Project Identity

- **Name:** PingWeather (rebrand from "WeatherWatch" — DO NOT reintroduce old name)
- **Entity:** Truth Centered Tech, Virginia, US
- **Stack:** Expo SDK 54 + React Native + TypeScript strict + Zustand v5 + Expo Router v6 + Supabase
- **Supabase project:** `ziyxkgbrdliwvztotxli`
- **Developer account:** `jimmy@truthcenteredtech.com` — dev tier override in Settings

---

## Current Status

**Play Store: versionCode 8 AAB built (preview profile, 2026-05-07) — being uploaded for closed testing**
**Supabase migrations: 00001–00019 applied**
**Tests: 715/715 logic tests passing**
**Edge Functions deployed (session 14): fcm-keepalive (auth hardened), subscription-webhook (HMAC-SHA256), register-push-token (token format validation), dev-tier-override (new)**
**Closed testing: Alpha track submitted 2026-05-05. versionCode 8 being uploaded 2026-05-07. Opt-in URL: https://play.google.com/apps/testing/com.truthcenteredtech.pingweather. Google Group: pingweather-betagooglegroupscom@truthcenteredtech.com. Recruitment posts pending Google approval.**
**Apple Developer enrollment: Company (Truth Centered Tech) submitted 2026-04-29 — awaiting approval.**
**Open-Meteo key rotation: COMPLETE — new key `y8A63e8V82EPsr7j` set in Supabase secrets 2026-05-03. Old key `eNFRDFntQmSudB7E` revoked.**

### Jimmy's required manual actions (still pending)

1. **Recruit 12+ closed testers** — Post to r/betatesting, Discord, Facebook groups. Opt-in URL: https://play.google.com/apps/testing/com.truthcenteredtech.pingweather. 14-day clock starts at tester #12. Do NOT move to open testing until device-verified.
2. **Device verify versionCode 8** — Core flows: login, add location, create rule, receive notification. Many features pending device verification (see Completed table notes).
3. **Move EXPO_PUBLIC_REVENUECAT_ANDROID_KEY to EAS env var** — Currently hardcoded in `app.json` extra. Should be `sensitive` EAS var + `process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` in purchases.ts. Low urgency but is a key hygiene issue.
4. **Check Apple Developer approval** — Submitted 2026-04-29 (now 8+ days). Check developer.apple.com portal / email. Approval unlocks iOS build path.
5. **After Apple approval: `eas credentials --platform ios`** — Upload APNs `.p8` auth key. Without it, push notifications don't reach iOS devices.
6. **After Apple approval: Create app in App Store Connect** — Get `ascAppId` (numeric App Store app ID) and `appleTeamId`, then fill them into `eas.json` submit config (currently `PLACEHOLDER_*`).
7. **Before iOS launch: `revenueCatIosApiKey`** — Fill in `app.json` extra field. RevenueCat silently no-ops on iOS until this is set.

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
| Account deletion web page | `truthcenteredtech.com/pingweather-delete-account` — created 2026-05-05 for Google Play Data Safety form requirement |
| Data Safety form | Updated 2026-05-05: purchase history added, account deletion URL corrected, advertising ID declared No. Submitted with 17-change review. |
| Multi-line digest notification | send-digest shows uniform `Weekday M/D — Hi/Lo · rain%` format (3 days for daily, 5 for weekly), emoji prefix from WMO code, rain only when ≥20%. `getDayLabel(isoDate)` uses UTC to avoid timezone drift. `formatDigestNotification` in `src/services/digestFormatter.ts`. **Device verified by Jimmy 2026-05-04.** |
| Push token auto-refresh on launch | `refreshPushToken()` called in `app/_layout.tsx` startup (when session exists). Fixes `DeviceNotRegistered` errors after APK reinstall rotates FCM token. 20 digestFormatter tests. |
| Notification channels at every launch | `setupNotificationChannels()` called at app startup (not just onboarding). Ensures `forecast-digest` Android channel exists after fresh installs / APK upgrades. |
| Temperature unit conversion in evaluateCondition | `poll-weather` fetches with `temperature_unit=fahrenheit` hardcoded. Celsius users' thresholds were compared against raw °F values (false positives). Fixed: `applyTemperatureUnit()` in `weatherEngine.ts` converts °F→°C for all temp metrics when `unit='celsius'`. Same fix in `_shared/weatherEngine.ts`. 9 new tests in `__tests__/engine/temperatureUnit.test.ts`. |
| OTA `9452f087` | push token refresh + notification channels fix deployed 2026-05-04 |
| OTA `f8043ecc` | temperature unit conversion fix deployed 2026-05-04 |
| Branded OTA update screen | `UpdateCheckScreen.tsx` — navy background, animated pulse, 5s timeout/fallback. `checkAutomatically: NEVER` in app.json. Shipped same OTA. **Device verification pending (preview/production build only).** |
| Moon phase chip picker + unit bugs fixed | Rule builder: moon_phase shows 🌑🌒🌓🌔🌕 phase chips (not raw %). soil_temperature unit fixed (was hardcoded celsius; now follows user's temperatureUnit). snow_depth unit was also wrong. `src/utils/metricHelpers.ts` extracted. 62 tests were silently skipped (wrong __tests__ subdirectory) — moved to `__tests__/engine/` where logic project picks them up. 524 → 586 tests. |
| Forecast UI — new metrics display | forecasts.tsx daily cards: moon emoji + UV index (≥3) + baro pressure (noon reading). day-detail hourly rows: surface_pressure, snowfall, snow_depth, soil_temperature with user unit. **Device verification pending.** |
| 4 new metrics: wind_gusts, dew_point, visibility, cloud_cover | Full pipeline: Open-Meteo → get-forecast → weatherEngine → types → rule builder. Visibility stored in miles (÷1609.34 at engine layer). Category-filtered metric selector replaces flat chip list. |
| Wind direction (from_bearing operator) | Circular math: `diff = ((actual - bearing) % 360 + 360) % 360; angleDiff = diff ≤ 180 ? diff : 360-diff; triggered = angleDiff ≤ tolerance`. UI: compass bearing chips (N/NE/E/SE/S/SW/W/NW) + tolerance selector (±22.5°–±90°). Presets: north-wind preset. 18 unit tests. |
| Pressure tendency | Derived metric: `last - first` of surface_pressure in eval window. Positive = rising, negative = falling. Preset: rapid-pressure-drop (lt -8 hPa). 8 unit tests. |
| AsyncStorage migration | One-time migration from `weatherwatch-*` → `pingweather-*` keys on first app launch. Flag: `pingweather-migration-v1-done`. Non-fatal, safe for fresh installs. Runs in `_layout.tsx` startup. 8 unit tests. |
| OTA `e5cce15f` | All session-10 work shipped. Edge Functions redeployed (poll-weather + get-forecast) to fetch new hourly params. **Device verification pending.** |
| inHg pressure unit | `PressureUnit` type in `src/types/index.ts`. `settingsStore` adds `pressureUnit` (default hPa). `metricHelpers.getUnitForMetric` takes optional 3rd param. `weatherEngine` converts at `evaluateCondition` via `applyPressureUnit()` — stored unit drives conversion so backend handles inHg rules automatically. Settings UI toggle. `forecasts.tsx` + `day-detail.tsx` display with unit. `__tests__/engine/pressureUnit.test.ts` (8 tests). |
| Summary card fixes | `from_bearing` raw operator leak fixed via `opOverride` on metric chip switch. `summaryLabel` optional field on METRICS decouples chip label from prose (fixes "feels like is", "wind gusts is", "uv index", "hourly temp"). Verb changed from "goes" to "is". Weather code shows emoji + label + WMO code. Lookahead prose map fixes "in the next 1 day". Pressure tendency early-return: "the pressure drops/rises by at least X unit". |
| Alphabetical metric ordering | METRICS array in `create-rule.tsx` reordered A→Z (Barometric Pressure → Wind Speed). |
| Pressure tendency direction UI | Direction chips (Falling ↓ / Rising ↑) replace raw operator chips for pressure_tendency metric. Magnitude input (always positive). Internal storage unchanged: lte/negative for falling, gte/positive for rising. Summary prose: "the pressure drops/rises by at least X unit". |
| NumericInput wrapper | `NumericInput` component with local string state buffer in `create-rule.tsx`. Fixes backspace freeze where `value={number.toString()}` overwrote intermediate empty/partial states. |
| Snow in Precipitation History | `rainfallApi.ts`: `HourlyRaw.snowfall?`, `DailyRaw.snowfall_sum?`, `RainfallData` snow fields. Both fetch functions request snowfall. Open-Meteo applies `precipitation_unit` to snowfall so no manual cm→in conversion. `RainfallCard.tsx` renamed to "PRECIPITATION HISTORY"; snow section shown when `snowTotal > 0` with `freezeBlue` color + SNOWFALL sub-label. RAINFALL sub-label shown only when snow section also present. |
| Favicon | `assets/favicon.png` replaced with PingWeather branded icon (copy of `assets/icon.png` — navy/orange raindrop+wifi). |
| OTA `96876e3e` | Session 11 work deployed 2026-05-04: inHg pressure unit, pressure tendency direction UI, rule builder summary/grammar/alphabetical fixes, NumericInput backspace fix, snow in precipitation history, favicon. **Device verification pending.** |
| Security hardening (session 13) | M02: dropped `forecast_cache` authenticated SELECT policy (migration 00018). M03: push token format regex in `register-push-token`. M04: alert_rules + locations input length CHECK constraints (migration 00019). LOW-04: removed `RECEIVE_BOOT_COMPLETED` + `WAKE_LOCK` from `app.json`. LOW-01: `@xmldom/xmldom` HIGH resolved via `npm audit fix`. LOW-02: `send_digest_auth_token` rotated; old value scrubbed from MEMORY.md. |
| Security audit session 14 | Full 11-issue audit for open testing. H01: `fcm-keepalive` bearer auth added. H03: `subscription-webhook` HMAC-SHA256 body verification (`X-RevenueCat-Signature`, raw body with `req.text()`). M01: `dev-tier-override` Edge Function created + two bugs fixed (wrong JWT pattern → `adminClient.auth.getUser(jwt)`; wrong VALID_TIERS `['free','basic','pro']` → `['free','pro','premium']`). Settings screen wired to invoke it. All Edge Functions redeployed. |
| Mapbox animated radar screen | `@rnmapbox/maps` 10.3.0 + RainViewer radar tiles (real NEXRAD data, free with attribution). EAS env vars: `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` + `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` (preview + production, sensitive). No radar API key needed — RainViewer public endpoint. Attribution: "Radar by RainViewer". RainViewer ToC: free tier OK for commercial use with attribution; revisit paid tier at production scale. Rainbow.ai was removed (it was an ML precipitation model, not real radar). `EXPO_PUBLIC_RAINBOW_API_KEY` scrubbed from .env.local; still present in EAS preview + production envs — remove with `eas env:delete`. |
| EAS preview build versionCode 8 | Build succeeded 2026-05-07 after two 401 failures (see Mapbox EAS gotcha in Known Bugs). Uploaded to Play Console for closed testing. |

### Backlog — nice to have, not blocking

_(none)_

### Not done — gates production

1. **Closed testing (12+ testers, 14 days)** — versionCode 8 being uploaded 2026-05-07. Once live in Play Console: verify Google Group allows external members (incognito test pending), then post recruitment to r/betatesting + Discord + Facebook groups. Clock starts at tester #12 opt-in.
2. **RevenueCat iOS** — blocked on Apple Developer approval
3. **Real SMTP (Resend)** — deferred
4. **Maestro E2E suite** — deferred
5. **Integration test: timezone backfill** — `SUPABASE_SERVICE_ROLE_KEY=<key> npx ts-node scripts/test-timezone-backfill.ts`
6. **Jimmy device verification** — RainfallCard accordion and forecast tap auto-expand confirmed session 6. Digest multi-line notification confirmed session 12. Still pending: 7 new metrics in rule builder (5 new presets), branded OTA screen, moon phase chip picker, forecast UI new metrics, wind direction compass, pressure tendency, AsyncStorage migration (OTA `e5cce15f`). From session 10/11 (OTA `96876e3e`): inHg display in forecasts/day-detail, alphabetical metric ordering, pressure tendency direction UI, snow in precipitation history — all pending Jimmy on-device. Radar screen + all session 14 security changes also pending device verification.

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
- `past_days` — integer 0-92; used by `rainfallApi.ts` for precipitation history
- `precipitation_unit` — `'inch'` or `'mm'`; used by `rainfallApi.ts`; applies to snowfall too (Open-Meteo converts both)
- Custom `hourly`/`daily` arrays — `rainfallApi.ts` passes `['precipitation','snowfall']` / `['precipitation_sum','snowfall_sum']`

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

Existing secrets: `poll_weather_function_url`, `poll_weather_service_role_key`, `send_digest_auth_token`.
Wrong names (migration 00009/00011 used these — they return NULL): `supabase_url`, `service_role_key`.
Migration 00016 fixes the digest/keepalive cron jobs by deriving their URLs from `poll_weather_function_url` via regexp_replace.

`send_digest_auth_token` — the value is stored in the Supabase Vault only and must NEVER be documented in source, memory files, or chat. To rotate: generate a new value with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and update the vault secret at Dashboard -> Project Settings -> Vault -> send_digest_auth_token.

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

### EAS env var substitution — critical gotcha (burned 2 build credits)

EAS substitutes `$VAR` patterns in top-level `app.json` string values (e.g. `extra`, `name`). **It does NOT substitute inside plugin configuration objects.** So:
```json
["@rnmapbox/maps", { "RNMapboxMapsDownloadToken": "$MAPBOX_DOWNLOAD_TOKEN" }]
```
…passes the literal string `$MAPBOX_DOWNLOAD_TOKEN` to the plugin, not the actual token. The plugin then writes `MAPBOX_DOWNLOADS_TOKEN=$MAPBOX_DOWNLOAD_TOKEN` to `gradle.properties`, and Gradle sends that literal string as the Maven password → 401.

**The correct pattern for native build-time tokens:** Set the env var directly (e.g. `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` as `sensitive`). The Gradle template reads it via `System.getenv()`. Don't route it through the plugin config.

**Visibility rules:** `sensitive` = encrypted, substituted in top-level app.json strings, available as env var in build environment. `secret` = secure vault, NOT substituted anywhere, available as env var.

### Pre-OTA verification gate — non-negotiable (burned 2 production pushes 2026-05-07)

Two broken OTA updates were shipped on 2026-05-07 (radar crash, then crash fix that may also be broken).
Root failures: (1) `tdd-guard.yaml` was missing — TDD hook was unarmed, never fired. (2) OTA was pushed immediately after `tsc --noEmit` clean, without hot-reload on device.

**Rules enforced from 2026-05-07 onward:**
- `tdd-guard.yaml` is now in `.claude/` — any Edit/Write to `src/**`, `app/**`, or `supabase/functions/**` without a referencing test file will be blocked.
- `bash-gate.yaml` now has an `eas update` warn gate — reminder fires before every OTA push.
- Pre-OTA checklist: (1) make change, (2) tell Jimmy to hot-reload via `npx expo start --dev-client`, (3) Jimmy confirms on device in chat, (4) THEN run `eas update`.
- Native component crashes (rnmapbox, etc.) are NOT caught by jsdom render tests — mocks hide them. Only device verification or Maestro E2E catches these. Never claim a native UI change is verified by Jest alone.

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
