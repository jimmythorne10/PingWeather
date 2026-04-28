# PingWeather — Developer Architecture

Comprehensive technical reference for engineers joining the codebase. This document is self-contained: you should not need to open any other doc to understand how the app works, what the moving parts are, or how to run it.

## 1. Tech stack

### Client (React Native / Expo)
- **Runtime:** React Native 0.81.5, React 19.1.0
- **Framework:** Expo SDK ~54.0.33 (managed workflow with `expo-dev-client`)
- **Language:** TypeScript ~5.9.2, strict mode
- **Routing:** `expo-router` ~6.0.23 (file-based, see `app/` directory structure)
- **State:** `zustand` ^5.0.12 (6 stores, persisted or session-only)
- **Storage:** `@react-native-async-storage/async-storage` for Zustand persistence; `expo-secure-store` for Supabase JWT storage
- **Networking:** `@supabase/supabase-js` ^2.101.1 with `react-native-url-polyfill/auto`
- **Push:** `expo-notifications` ^0.32.16 (lazy-loaded via hook)
- **Purchases:** `react-native-purchases` ^9.15.2 (RevenueCat)
- **OTA:** `expo-updates` ~29.0.16
- **Animations:** `react-native-reanimated` ~4.1.1 + `react-native-worklets` 0.5.1
- **Deep linking:** custom scheme `pingweather://` (see `app.json → expo.scheme`)
- **New architecture:** enabled (`newArchEnabled: true` in `app.json`)

### Backend (Supabase)
- **Project ID:** `ziyxkgbrdliwvztotxli` (cosmetic dashboard label still "WeatherWatch" from pre-rebrand)
- **Database:** PostgreSQL 17 with Row Level Security enabled on every public table
- **Auth:** Supabase Auth — email/password, PKCE flow (`flowType: 'pkce'` in the client), email confirmation OFF
- **Edge Functions:** Deno runtime, TypeScript source. Eight deployed. Auth model per-function, declared in `supabase/config.toml`.
- **Scheduled jobs:** `pg_cron` + `pg_net` + `supabase_vault`. Three recurring jobs plus one cleanup cron.
- **Extensions used:** `pgcrypto`, `pg_cron`, `pg_net`, `vault`.
- **No storage buckets, no realtime subscriptions, no custom auth provider.**

### Third-party services
- **Open-Meteo** — weather data. Free tier (`api.open-meteo.com`) as fallback; commercial tier (`customer-api.open-meteo.com`) in production. API key stored server-side only as Supabase secret `OPEN_METEO_API_KEY`.
- **RevenueCat** — subscription management. Android public API key in `app.json` extra (`revenueCatAndroidApiKey`). Webhook secret `REVENUECAT_WEBHOOK_SECRET` set as Edge Function secret.
- **Firebase Cloud Messaging V1** — Android push delivery. `google-services.json` in project root (gitignored).
- **Expo Push Service** — push dispatch proxy. Routes to FCM on Android, APNs on iOS.
- **EAS (Expo Application Services)** — builds and OTA updates. Project ID `6456b66e-6e5a-4881-984f-20e2f3b477f4`.

### Build config
`eas.json` — three profiles:
- `development` → dev client, internal distribution, `channel: "development"`, iOS simulator OK
- `preview` → internal distribution, auto-increment version, Android `buildType: "app-bundle"`, `channel: "preview"`
- `production` → store distribution, auto-increment, Android app-bundle, `channel: "production"`

## 2. Directory structure

```
PingWeather/
├── app/                          # Expo Router file-based routing
│   ├── _layout.tsx               # Root layout: ErrorBoundary, auth gate, OTA check, RevenueCat login
│   ├── index.tsx                 # Redirect to (tabs)
│   ├── (tabs)/                   # Tab navigator — 5 visible tabs + 1 hidden (history)
│   │   ├── _layout.tsx           # Tab bar config; history.href = null
│   │   ├── index.tsx             # Home — forecast card + active alerts + recent notifications
│   │   ├── alerts.tsx            # Alert rules list, preset library, filters, custom rule entry
│   │   ├── locations.tsx         # Location management CRUD
│   │   ├── forecasts.tsx         # Per-location expandable forecast cards
│   │   ├── history.tsx           # Alert history (href:null, accessed via direct link)
│   │   └── settings.tsx          # Settings + digest + dev overrides
│   ├── onboarding/               # First-run wizard
│   │   ├── _layout.tsx           # Stack with slide_from_right
│   │   ├── welcome.tsx
│   │   ├── privacy.tsx           # Privacy highlights (not full policy)
│   │   ├── eula.tsx              # Full EULA, records acceptance
│   │   ├── location-setup.tsx    # Add first location
│   │   ├── notification-setup.tsx # Request push permission, register token
│   │   ├── battery-setup.tsx     # Android battery-opt whitelist guidance
│   │   └── complete.tsx          # Sets onboarding_completed=true, routes to /
│   ├── legal/
│   │   ├── eula.tsx              # Post-onboarding EULA viewer
│   │   └── privacy-policy.tsx    # Post-onboarding privacy policy viewer
│   ├── login.tsx
│   ├── signup.tsx
│   ├── forgot-password.tsx
│   ├── reset-password.tsx        # Deep-linked; handles ?code= via PKCE
│   ├── upgrade.tsx               # RevenueCat paywall, tier cards, Restore
│   ├── create-rule.tsx           # Custom rule builder (create/edit/clone modes)
│   └── day-detail.tsx            # Hourly breakdown for a selected date
├── src/
│   ├── types/
│   │   └── index.ts              # All TypeScript types + TIER_LIMITS constant
│   ├── stores/                   # 6 Zustand stores, most persisted to AsyncStorage
│   │   ├── authStore.ts          # Session, user, profile, auth actions
│   │   ├── locationsStore.ts     # Locations CRUD + tier enforcement
│   │   ├── alertRulesStore.ts    # Rules CRUD + tier enforcement
│   │   ├── alertHistoryStore.ts  # Read-only history fetch
│   │   ├── settingsStore.ts      # Local unit prefs + cosmetic notif toggle
│   │   └── themeStore.ts         # Current theme name + derived tokens
│   ├── services/                 # Pure API clients + domain helpers (no React dependencies)
│   │   ├── weatherApi.ts         # fetchForecast via get-forecast Edge Function
│   │   ├── geocoding.ts          # Open-Meteo geocoding (client-direct, public API)
│   │   ├── purchases.ts          # RevenueCat SDK wrapper
│   │   ├── subscriptionLogic.ts  # determineAction decision table (pure)
│   │   ├── digestFormatter.ts    # Digest notification formatter (client copy)
│   │   ├── digestScheduler.ts    # shouldSendDigest pure time gate
│   │   ├── hourlyForDay.ts       # Hourly filter by YYYY-MM-DD prefix
│   │   ├── weatherIcon.ts        # WMO code → emoji + compass direction
│   │   └── parseRecoveryUrl.ts   # Implicit-flow recovery URL parser (currently unused)
│   ├── utils/
│   │   ├── supabase.ts           # Supabase client (PKCE flow, SecureStore adapter)
│   │   ├── weatherEngine.ts      # Pure eval: gridKey, evaluateRule, etc. (shared with Edge Functions)
│   │   ├── alertsHelpers.ts      # pickDefaultLocation, filterRules, findLocationName
│   │   └── devAccount.ts         # isDevAccount(email) email gate
│   ├── hooks/
│   │   ├── useLocation.ts        # Device GPS via expo-location
│   │   └── usePushNotifications.ts # Expo push token flow + Edge Function registration
│   ├── components/
│   │   ├── ErrorBoundary.tsx     # Class-component React error boundary
│   │   └── LocationSearchInput.tsx # Debounced geocoding autocomplete
│   ├── data/
│   │   ├── alert-presets.ts      # 11 ALERT_PRESETS templates
│   │   └── legal-content.ts      # EULA_CONTENT and PRIVACY_POLICY_CONTENT
│   └── theme/
│       ├── index.ts              # Barrel export
│       ├── tokens.ts             # THEMES record: classic/dark/storm + ThemeTokens type
│       └── useStyles.ts          # useStyles + useTokens hooks
├── supabase/
│   ├── config.toml               # Per-function verify_jwt flags (CRITICAL — do not change without understanding impact)
│   ├── migrations/               # 16 applied SQL migrations (00001–00016)
│   └── functions/
│       ├── _shared/
│       │   └── weatherEngine.ts  # Identical content to src/utils/weatherEngine.ts
│       ├── poll-weather/         # Hourly cron: grid-grouped forecast fetch + evaluate dispatch + push
│       ├── evaluate-alerts/      # Called by poll-weather; pure eval + history write
│       ├── get-forecast/         # Client-invoked Open-Meteo proxy (keeps API key server-side)
│       ├── register-push-token/  # Client-invoked token registration
│       ├── send-digest/          # Hourly cron: digest push dispatch
│       ├── fcm-keepalive/        # Daily cron: silent pushes to all tokens
│       ├── delete-account/       # Client-invoked account deletion
│       └── subscription-webhook/ # RevenueCat webhook receiver
├── __tests__/                    # Jest tests, dual project config
│   ├── data/                     # Pure data tests (presets, tier limits, dev account, etc.)
│   ├── engine/                   # evaluateConditions coverage
│   ├── flows/                    # Multi-store integration (authFlow, tierEnforcement)
│   ├── helpers/                  # mocks
│   ├── screens/                  # jsdom text-presence tests — FLAGGED AS FRAUDULENT per Testing Contract
│   ├── services/                 # Service-layer tests
│   └── stores/                   # Store action tests
├── __mocks__/                    # Jest module mocks
├── assets/                       # Icons, splash, notification icon
├── plugins/
│   └── withAdiRegistration       # Custom Expo config plugin
├── scripts/                      # Supabase admin scripts (ts-node)
├── app.json                      # Expo config: scheme, permissions, plugins, EAS projectId, RC key
├── eas.json                      # 3 EAS profiles (dev/preview/production)
├── tsconfig.json                 # TypeScript strict
├── jest.setup.ts                 # Global mocks (AsyncStorage, Supabase, expo modules)
├── google-services.json          # Firebase config (gitignored)
├── docs/
│   ├── KNOWN_ISSUES.md           # Historical bug log
│   ├── features/                 # F## feature specs (this document's siblings)
│   ├── architecture/             # This doc + executive/customer + diagrams
│   └── security/                 # security-audit.md
└── CLAUDE.md                     # Project-scoped AI assistant instructions
```

## 3. Layer-by-layer breakdown

### UI layer — Expo Router conventions
- **File-based routing:** every `.tsx` under `app/` is a route. `_layout.tsx` files define nested navigators.
- **Root layout** (`app/_layout.tsx`) is the bouncer: it wraps everything in `ErrorBoundary` + `SafeAreaProvider`, shows a spinner during `useAuthStore.initialize()` + `Updates.checkForUpdateAsync()`, then reads `session` and `profile.onboarding_completed` to decide whether to route to `/login`, `/onboarding/welcome`, or `/(tabs)`.
- **Stack screens** declared inside the root `<Stack>` use `presentation: 'modal'` for `upgrade`, `headerShown: true` for `create-rule`, `day-detail`, `upgrade`, and legal screens.
- **Tab navigator** (`app/(tabs)/_layout.tsx`) — 5 visible tabs, `history` is declared with `href: null` so it's reachable only by explicit `router.push`.
- **Deep links:** `pingweather://reset-password?code=…` lands on `app/reset-password.tsx` via Expo Router's URL parsing. `_layout.tsx` has an `inRecovery` guard so the auth gate doesn't bounce the user off this screen when Supabase flips `session` to truthy.

### State layer — Zustand stores
Six stores, all in `src/stores/`:

1. **`authStore`** (not persisted — tokens in SecureStore, profile re-fetched).
   - State: `session, user, profile, initialized, loading, error`.
   - Module-level `_authSubscription` handle protects against listener stacking on hot-reload.
   - `fetchProfile` does a lazy dynamic-import of `settingsStore` to seed `temperatureUnit` without a circular import.

2. **`locationsStore`** (persisted: `locations` only).
   - AsyncStorage key: `weatherwatch-locations` (historical, predates rebrand).
   - `addLocation` returns `Promise<boolean>` so callers (onboarding, locations screen) can abort-on-failure.
   - `setDefaultLocation` guards against null user (two-step unset-all-then-set would otherwise corrupt the partial unique index).
   - `enforceTierLimits(tier)` persists activation/deactivation to Supabase — without this, reloads would resurrect over-quota locations.

3. **`alertRulesStore`** (persisted: `rules` only).
   - Key: `weatherwatch-alert-rules`.
   - `createRule` enforces tier `maxAlertRules` and `compoundConditions` before insert.
   - `enforceTierLimits` same pattern as locations.

4. **`alertHistoryStore`** (not persisted).
   - Single `loadHistory` action, `SELECT * ORDER BY triggered_at DESC LIMIT 100`.
   - No `rule_id` filter — full history.

5. **`settingsStore`** (persisted: all fields).
   - `temperatureUnit`, `windSpeedUnit`, `notificationsEnabled`.
   - `notificationsEnabled` is cosmetic only — does NOT gate server push dispatch.
   - Note: `themeName` was previously here and was removed in FIX 5 to avoid double-persistence drift with `themeStore`.

6. **`themeStore`** (persisted: `themeName` only; `tokens` derived on rehydrate).
   - `setTheme(name)` updates both `themeName` and `tokens`.
   - `onRehydrateStorage` reinstates `tokens` from the `THEMES` map after AsyncStorage read.

### Service layer — `src/services/`
Pure modules (no React) that wrap external APIs and encapsulate domain helpers.

- **`weatherApi.ts`** — `fetchForecast(options)`. Calls `supabase.functions.invoke('get-forecast', { body: {...} })`. Throws on non-2xx.
- **`geocoding.ts`** — `searchPlaces(query, limit)`, `formatLocationLabel(result)`. Calls `https://geocoding-api.open-meteo.com/v1/search` directly (public API, no key). Min-query-length guard, trims, URL-encoded params.
- **`purchases.ts`** — RevenueCat wrapper. Lazy-loaded via `require('react-native-purchases')` inside `getPurchases()`. Exposes `initializePurchases`, `loginPurchaseUser`, `logoutPurchaseUser`, `getOfferings`, `purchasePackage`, `restorePurchases`, `getCurrentTier`. The `syncTierToSupabase` after purchase is currently broken by RLS (see security-audit H01).
- **`subscriptionLogic.ts`** — pure `determineAction(eventType, productId): { action, newTier }`. Server-side webhook has an identical decision table.
- **`digestFormatter.ts`** — `formatDigestNotification(forecast, locationName, temperatureUnit, frequency, windSpeedUnit)`. Respects temperature and wind units. **Server-side `send-digest` has a divergent copy that doesn't respect wind unit — known bug M01.**
- **`digestScheduler.ts`** — pure `shouldSendDigest(profile, locationTimezone, nowUtc): boolean`. Mirror logic lives in `send-digest`.
- **`hourlyForDay.ts`** — `getHourlyForDay(hourly, isoDate)`. Critical: prefix-match on `YYYY-MM-DD` to avoid JS Date UTC-drift. Do not refactor to `new Date()`.
- **`weatherIcon.ts`** — `weatherCodeToEmoji(code)`, `degreesToCardinal(degrees)`.
- **`parseRecoveryUrl.ts`** — DEAD CODE kept intentionally as the implicit-flow fallback for PKCE migration. See project CLAUDE.md critical rules.

### Utility layer — `src/utils/`
- **`supabase.ts`** — creates the Supabase client with a `SecureStore` storage adapter (Keychain on iOS, Keystore on Android, localStorage on web). `flowType: 'pkce'` is mandatory for mobile password-reset deep links.
- **`weatherEngine.ts`** — pure evaluation logic shared byte-for-byte with `supabase/functions/_shared/weatherEngine.ts`. Exports `gridKey`, `extractTimezone`, `getMetricValues`, `compare`, `evaluateCondition`, `evaluateRule`, `isInCooldown`, `formatConditionSummary`, `processInBatches`. Zero Deno or Supabase imports.
- **`alertsHelpers.ts`** — UI-adjacent filter helpers.
- **`devAccount.ts`** — single email equality check for dev tier override gate.

### Edge Functions — `supabase/functions/`
All under `supabase/functions/<name>/index.ts`. Deno runtime. Eight functions:

| Function | Trigger | `verify_jwt` | Purpose |
|----------|---------|:------------:|---------|
| `poll-weather` | pg_cron (hourly) | false | Grid-grouped forecast fetch + evaluate dispatch + push send. Accepts service_role or `POLL_WEATHER_SECRET` bearer. |
| `evaluate-alerts` | poll-weather (internal) | false | Pure eval + alert_history insert + last_triggered_at batch update. Service role only. |
| `get-forecast` | Mobile client | **true** | Open-Meteo proxy (keeps commercial API key server-side). |
| `register-push-token` | Mobile client | **true** | Validates JWT via `adminClient.auth.getUser(jwt)`, writes `profiles.push_token`. |
| `send-digest` | pg_cron (hourly) | false | Filters profiles by digest_enabled + time gate + forecast_cache lookup + push. |
| `fcm-keepalive` | pg_cron (daily 10:00 UTC) | false | Silent data-only push to every `push_token`. |
| `delete-account` | Mobile client | **true** | Validates JWT, `auth.admin.deleteUser(user.id)`, cascade handles the rest. |
| `subscription-webhook` | RevenueCat | false | Bearer-secret auth + UUID validation + tier update. |

Critical: JWT flags in `supabase/config.toml` are load-bearing. Turning on JWT for `poll-weather` or `evaluate-alerts` would 401 the `pg_cron` calls and silently break the alert pipeline (see CLAUDE.md rule #3).

Shared code: `supabase/functions/_shared/weatherEngine.ts` — must stay byte-identical to `src/utils/weatherEngine.ts`.

### Database — `supabase/migrations/`
Sixteen applied migrations. Evolution:

- **00001** — Initial schema: `profiles`, `locations`, `alert_rules`, `alert_history`. RLS enabled. `handle_new_user()` trigger auto-creates profile row. `set_updated_at()` trigger on profiles + alert_rules.
- **00002** — `locations.is_default` (partial unique index: one default per user) + `locations.timezone`.
- **00003** — `pg_cron` + `pg_net` schedule for `poll-weather-hourly` at `0 * * * *` UTC. Requires two vault secrets: `poll_weather_service_role_key` and `poll_weather_function_url`.
- **00004** — `alert_rules.last_polled_at` + partial index on active rules.
- **00005** — `max_notifications` + `notifications_sent_count` (rate-limit cycle feature).
- **00006** — **Reverts 00005**. The feature's semantic was backwards; see MEMORY.md post-mortem. Keeps `last_polled_at`.
- **00007** — Raises `pg_net` timeout on the poll-weather cron from default 5s to 30s. Fixes a silent-failure bug.
- **00008** — Digest fields on `profiles` (`digest_enabled`, `digest_frequency`, `digest_hour`, `digest_day_of_week`, `digest_location_id`, `digest_last_sent_at`).
- **00009** — `send-digest-hourly` cron. **Note:** originally referenced nonexistent vault secrets `supabase_url` / `service_role_key` — silently failed until migration 00016.
- **00010** — `profiles.temperature_unit` so `send-digest` can format in user's preferred unit.
- **00011** — `fcm-keepalive-daily` cron at `0 10 * * *` UTC. Same vault-secret bug as 00009, fixed in 00016.
- **00012** — `forecast_cache` table with RLS (authenticated users SELECT; service role upsert). See security-audit M07 for the "readable by all authenticated" concern.
- **00013** — Security hardening: (a) `profiles` UPDATE WITH CHECK locks `subscription_tier` — blocks self-escalation (also incidentally blocks the optimistic purchase sync, see H01); (b) drops the world-writable `forecast_cache` FOR ALL policy; (c) adds WITH CHECK on `locations` and `alert_rules` UPDATE to prevent `user_id` reassignment; (d) numeric sanity constraints on `alert_rules` (cooldown, polling, lookahead ranges); (e) coordinate CHECK constraints on `locations`.
- **00014** — Missing FK indexes: `idx_locations_user_id`, `idx_alert_rules_location_id`, `idx_alert_rules_user_id`.
- **00015** — `alert_history` dedup unique index on `(rule_id, triggered_at_hour_utc(triggered_at))`, GDPR/CCPA user DELETE policy, 90-day retention cleanup cron at `0 3 * * *` UTC.
- **00016** — Rewrites `send-digest-hourly` and `fcm-keepalive-daily` to derive their URLs by regex-replacing the function name at the end of `poll_weather_function_url`. Both jobs ran silently broken from 00009/00011 apply date until 00016 was applied.

Full RLS policy list:
- `profiles`: SELECT (`auth.uid() = id`), UPDATE (`auth.uid() = id` USING + WITH CHECK locking tier).
- `locations`: SELECT/INSERT/UPDATE/DELETE, all gated on `auth.uid() = user_id`. UPDATE has WITH CHECK.
- `alert_rules`: same as locations.
- `alert_history`: SELECT and DELETE gated on `auth.uid() = user_id`. No user INSERT policy (service role only).
- `forecast_cache`: SELECT `auth.role() = 'authenticated'`. No explicit write policy (service role bypasses RLS).

Indexes beyond PKs:
- `idx_locations_one_default_per_user` (partial: `WHERE is_default`)
- `idx_locations_user_id`
- `idx_alert_rules_last_polled_active` (partial: `WHERE is_active`)
- `idx_alert_rules_location_id`, `idx_alert_rules_user_id`
- `idx_alert_history_user_triggered (user_id, triggered_at DESC)`
- `idx_alert_history_dedup` (unique, partial: `WHERE rule_id IS NOT NULL`)

Cron jobs:
| Name | Schedule | Function |
|------|---------|----------|
| `poll-weather-hourly` | `0 * * * *` | `/functions/v1/poll-weather` |
| `send-digest-hourly` | `0 * * * *` | `/functions/v1/send-digest` |
| `fcm-keepalive-daily` | `0 10 * * *` | `/functions/v1/fcm-keepalive` |
| `alert-history-cleanup` | `0 3 * * *` | Direct DELETE statement (no function) |

All HTTP cron jobs use `timeout_milliseconds := 30000`.

## 4. Authentication flow

**Signup:**
1. Client: `supabase.auth.signUp({ email, password, options: { data: { display_name } } })`.
2. Supabase creates `auth.users` row. Trigger `handle_new_user` fires → `profiles` row created.
3. Response includes a session (email confirmation is OFF). Store sets session/user, calls `fetchProfile`.

**Signin:**
1. Client: `supabase.auth.signInWithPassword({ email, password })`.
2. Supabase returns session. Store persists via SecureStore (adapter wraps Supabase's storage contract).
3. `fetchProfile` reads `profiles` by `auth.uid()`; RLS enforces self-only.

**Password reset:**
1. Client: `supabase.auth.resetPasswordForEmail(email, { redirectTo: Linking.createURL('/reset-password') })`.
2. Email arrives with a link like `pingweather://reset-password?code=<pkce_code>`.
3. Expo Router routes to `app/reset-password.tsx`, `useLocalSearchParams` reads `code`.
4. Screen calls `supabase.auth.exchangeCodeForSession(code)` — Supabase mints a recovery session.
5. `_layout.tsx` auth gate sees `session` = truthy and `segments[0] === 'reset-password'` → stays on the screen (the `inRecovery` guard).
6. User submits new password. `supabase.auth.updateUser({ password })` succeeds; store `auth.signOut()` to force a clean sign-in with the new password. Route replaces to `/login`.

**Session refresh:** handled automatically by Supabase client (`autoRefreshToken: true`). On cold start, `initialize()` reads the persisted session, calls `onAuthStateChange`, fetches profile.

## 5. Subscription system

**Tiers** live in `TIER_LIMITS` (src/types/index.ts). Source of truth on the DB is `profiles.subscription_tier`.

**Purchase flow:**
1. Client calls `purchasePackage(TIER_PACKAGE_MAP[tier])` from `src/services/purchases.ts`.
2. RevenueCat SDK opens Google Play Billing. User confirms.
3. RevenueCat receives the purchase event, returns `customerInfo` to the SDK, which also fires a webhook to our `subscription-webhook` Edge Function.
4. Client-side: `syncTierToSupabase(newTier)` runs a `profiles.update({ subscription_tier })` with the user's JWT. **This UPDATE is rejected by RLS** (migration 00013 WITH CHECK — see H01). Error is logged, not surfaced.
5. Server-side (authoritative): webhook receives `INITIAL_PURCHASE`, `determineAction` returns `{ action: 'upgrade', newTier: 'pro' }`, webhook validates `app_user_id` UUID + profile existence, writes `subscription_tier` via service role.
6. Client's next `fetchProfile` call picks up the update.

**Other events:**
- `RENEWAL` — same as initial purchase (idempotent).
- `CANCELLATION` — no DB change (entitlement runs through expiration).
- `EXPIRATION` — downgrade to `free`.
- `BILLING_ISSUE_DETECTED` — log only.
- Unknown types — ignored.

**Tier enforcement:**
- **Client-side** — stores check `TIER_LIMITS[tier]` on every create/add.
- **DB** — no count constraints. RLS WITH CHECK on `profiles` prevents self-escalation.
- **Downgrade deactivation** — `enforceTierLimits(tier)` on relevant stores; persists to Supabase.

## 6. Alert lifecycle (the critical path)

Tracing what happens from "user creates alert" to "push notification arrives":

1. **Rule creation** (`create-rule.tsx` → `alertRulesStore.createRule`):
   - Client-side tier check.
   - `INSERT INTO alert_rules (...) RETURNING *`. RLS allows self-insert only.
   - Row lands with `is_active: true`, `last_polled_at: null`, `last_triggered_at: null`.

2. **Cron fires** (`poll-weather-hourly` at `0 * * * *` UTC):
   - `pg_cron` runs the SQL scheduled in migration 00007 — `net.http_post` to `/functions/v1/poll-weather` with service_role bearer.
   - `pg_net` awaits the response (up to 30s timeout).

3. **poll-weather runs:**
   - `SELECT * FROM alert_rules !inner locations WHERE alert_rules.is_active AND locations.is_active`.
   - Filter to rules where `last_polled_at IS NULL OR now - last_polled_at >= polling_interval_hours * 3600s`.
   - Group by `gridKey(lat, lon)` — rounds coords to 0.1°.
   - `processInBatches(groups, CONCURRENCY_LIMIT=10, processGrid)` — parallel within batch, sequential between batches.

4. **processGrid (per grid):**
   - Validate coords are in range (raises if corrupt).
   - `fetchForecast(lat, lon)` → Open-Meteo (customer endpoint when `OPEN_METEO_API_KEY` set, else free endpoint). 10s AbortController timeout.
   - In parallel:
     - `forecast_cache.upsert({ grid_key, lat, lon, forecast_json, fetched_at: now })`.
     - If the location's `timezone` was null and Open-Meteo returned one: `locations.update({ timezone: ianaZone })`.
   - Both are best-effort; failures log but don't block.
   - `supabase.functions.invoke('evaluate-alerts', { body: { rules, forecast, location_name } })`.

5. **evaluate-alerts:**
   - Bearer check: `Authorization === "Bearer ${SUPABASE_SERVICE_ROLE_KEY}"`. 401 otherwise.
   - For each rule: skip if `isInCooldown(rule, now)`. Call `evaluateRule(rule, forecast)` → `{ triggered, summary, matchDetails }`.
   - For each triggered result: INSERT into `alert_history` (catches 23505 as "dedup hit — already alerted this hour"). Stores the history row's `id` in `historyIdByRule`.
   - Batch UPDATE `alert_rules.last_triggered_at = now` for every triggered rule's id (single IN query).
   - Returns `{ evaluated, triggered, alerts: [{ rule_id, rule_name, user_id, summary, details, alert_history_id }] }`.

6. **Back in poll-weather:**
   - Collect all triggeredAlerts across grids. Fail-open on per-grid errors — `Promise.allSettled`.
   - Batch UPDATE `last_polled_at` for all successfully-evaluated rules.
   - If any alerts triggered: batch fetch `profiles.push_token` for the unique user_ids (single query), build a `Map<user_id, token>`.
   - Promise.allSettled over `allTriggeredAlerts`:
     - Look up token in the map (skip if missing).
     - `sendPushNotification(token, title, body, data)` — POST to `https://exp.host/--/api/v2/push/send`.
     - If ok and we have `alert_history_id`: `alert_history.update({ notification_sent: true }).eq('id', alert_history_id)`.
   - Logs failures; returns summary `{ message, locationsChecked, rulesEvaluated, alertsTriggered, failedGrids }`.

7. **Expo Push → FCM V1 → device:**
   - Expo forwards to FCM. FCM delivers to the Android device. Device notification channel `weather-alerts` (high importance, vibration, sound).
   - `usePushNotifications` listeners are registered but the response listener is currently inert (M05).

8. **History:**
   - User opens History tab → `alertHistoryStore.loadHistory` → `alert_history.select().order(triggered_at desc).limit(100)`.

## 7. Digest system
Detailed in F10. One-liner: hourly cron → fetch profiles with digest_enabled + location + push_token → for each, check local-time gate → read from `forecast_cache` (or fall back to Open-Meteo) → `formatDigest` → push via Expo → update `digest_last_sent_at`.

Known quirk: server's `formatDigest` hardcodes "mph" (M01). Client's `digestFormatter.ts` has the correct logic. These should converge.

## 8. FCM keep-alive
Detailed in F16. Daily silent data-only push at 10:00 UTC. Purpose: keep the app in Android's Active/Working Set so alert pushes aren't deprioritized on quiet weather days. Reads every non-null `push_token` in pages of 500, sends in Expo batches of 100. Fire-and-forget.

## 9. OTA update configuration
- `app.json` → `"runtimeVersion": { "policy": "sdkVersion" }` — updates bind to the Expo SDK version.
- `eas.json` channels: `development` / `preview` / `production`.
- `_layout.tsx` checks for updates on startup in non-dev mode. If available, fetches and calls `Updates.reloadAsync()` (never returns — restarts the JS runtime).
- Ship an OTA: `eas update --branch preview --message "…"`.

Publishable via OTA: any JS-only change. Not publishable via OTA: native module version changes, `app.json` changes that affect the native shell, new permissions, Expo SDK upgrades. All of those require a full `eas build`.

## 10. Testing approach

Dual Jest project (see `package.json` `jest.projects`):
- `logic` (node env) — runs against `__tests__/stores/`, `__tests__/engine/`, `__tests__/data/`, `__tests__/flows/`, `__tests__/services/`. These are the load-bearing verification suite.
- `components` (jsdom env) — runs against `__tests__/screens/`. **Per the project's Testing Contract, these are flagged as fraudulent (text-presence only, not behavior) and must not be cited as evidence of UI correctness.**

Shared mocks:
- `__mocks__/async-storage.js`, `expo-*` shims, `react-native.js`, etc.
- `jest.setup.ts` globally mocks AsyncStorage, Supabase, and expo modules.

Coverage by layer:
- **Stores** — all six have direct tests (authStore, locationsStore, alertRulesStore, settingsStore, themeStore). Actions, error paths, tier-enforcement logic.
- **Pure engine** — comprehensive (`evaluateConditions.test.ts`) covering AND/OR, cooldown, empty conditions, daily-date UTC fix, invalid metrics.
- **Pure services** — digestScheduler, digestFormatter, processInBatches, hourlyForDay, weatherIcon, parseRecoveryUrl, geocoding, subscriptionLogic, purchases (mapProductToTier + determineTier), pollWeatherTimezone.
- **Data** — presets, tier limits, dev account, legal content.
- **Flows** — authFlow, tierEnforcement (multi-store).
- **Screens** — jsdom text presence. Do not treat as verification.
- **Edge Functions** — no automated tests. Validated via `net.http_post` from the Supabase SQL editor + function logs.
- **Integration (Supabase RLS, real network, Expo push)** — no automated tests. Validated by Jimmy on device.

Commands:
- `npx jest --selectProjects logic` — real tests.
- `npx jest --selectProjects components` — smoke only; don't trust.
- `npm test` — both.
- `npx tsc --noEmit` — type check.

## 11. Known issues and workarounds
Sourced from `.claude/memory/MEMORY.md` and `docs/KNOWN_ISSUES.md` — summary only; those files are canonical.

- **Client-optimistic tier sync blocked by RLS** — H01 in security audit. Fix is pending.
- **Server digest wind unit hardcoded mph** — M01. Fix: port client formatter to `_shared/`.
- **Stale push tokens never cleaned** — H02.
- **Failed push consumes cooldown** — H03.
- **`ruleWouldTrigger` preview on Forecasts screen only covers 4 of 8 metrics** — M03, inline logic should use `evaluateRule`.
- **Rule-name change doesn't update past history snapshots** — by design.
- **Auth store → settings store lazy import** — workaround for circular dep, documented in code.
- **Do not refactor `getHourlyForDay` to use `new Date("YYYY-MM-DD")`** — UTC midnight drift; project CLAUDE.md critical rule.
- **Do not reintroduce `max_notifications` without fixing the semantic** — previous attempt was reverted (migration 00006).
- **JWT flags in `config.toml` are load-bearing** — do not change without understanding.

## 12. Development setup

**Required environment (dev):**
```
EXPO_PUBLIC_SUPABASE_URL=https://ziyxkgbrdliwvztotxli.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```
In `.env.local` (gitignored; see `.env.local.example` for the template).

`google-services.json` in project root (gitignored). Required for Android FCM.

**Dev server:**
```
npx expo start --dev-client
```
Requires an EAS dev build APK installed on the device. Expo Go will NOT work (new arch + native deps).

**Type check + tests:**
```
npx tsc --noEmit
npx jest --selectProjects logic
```

**Supabase:**
```
npx supabase db push                            # apply pending migrations
npx supabase functions deploy <name>            # deploy one function
npx supabase functions list                     # list deployed versions
npx supabase secrets set OPEN_METEO_API_KEY=... # set function secrets
npx supabase db query "<sql>" --linked          # one-off SQL
```

**EAS builds:**
```
eas build --platform android --profile development   # dev APK
eas build --platform android --profile preview       # internal APK
eas build --platform android --profile production    # store AAB
eas update --branch preview --message "..."          # OTA push
eas credentials                                       # manage FCM / keystore
```

**Build sizing** (per project memory):
- Dev builds: 200-300 MB
- Preview builds: smaller
- Play Console upload limit: 160 MB
- Use `preview` profile for Play Console uploads, not `development`.

Project-specific critical rules are in `CLAUDE.md` at project root and in `.claude/memory/MEMORY.md`. Read both before making changes.
