# PingWeather

> Rebrand note: this project was originally created as "WeatherWatch" and
> rebranded on 2026-04-08 after market research surfaced trademark conflicts.
> DO NOT reintroduce "WeatherWatch" anywhere user-facing. The Supabase project
> is still internally labeled `WeatherWatch` in the dashboard (cosmetic, not
> worth the migration) — that's the only exception.

## Project Overview

PingWeather is a mobile weather notification app (Android-first) that allows
users to configure custom conditional weather alerts. Users set locations,
define alert criteria (temperature thresholds, precipitation probability, wind
speed, etc.), and receive push notifications when conditions are met.

As of 2026-05-04, the MVP backend pipeline is **complete and device-verified**.
RevenueCat Android, Open-Meteo commercial license, and Play Store internal
testing are all live. The remaining gate to Android production is closed testing
(12+ testers, 14 days). iOS is blocked on Apple Developer enrollment approval.
See `docs/JIMMY_HANDOFF.md` for the shipping punch list and `.claude/memory/MEMORY.md`
for authoritative current state.

### Target Users (MVP)
- **Livestock owners** — Freeze alerts for water troughs and animal welfare
- **Hunters** — Cold front tracking, rain alerts, wind conditions
- **Outdoor workers** — Rain delay risk, high wind safety
- **Anyone** who needs proactive weather alerts instead of manually checking forecasts

### Core Value Proposition
"If-this-then-alert" weather monitoring with compound conditions, user-defined
polling intervals, and preset templates for common use cases. No consumer app
currently offers this combination.

## Tech Stack

### Frontend
- **Framework**: React Native with Expo SDK 54 (managed workflow)
- **Language**: TypeScript (strict mode)
- **State Management**: Zustand 5
- **Navigation**: Expo Router v6 (file-based routing)
- **Deep linking**: Custom scheme `pingweather://`, registered in `app.json`
- **Auth**: Supabase with PKCE flow (required for mobile reset-password to work — hash fragments are stripped by Expo Router)
- **UI**: React Native built-in components (no external UI library)
- **Theming**: Custom token-based theme system in `src/theme/`, three themes

### Backend
- **Platform**: Supabase (project id `ziyxkgbrdliwvztotxli`)
  - **Database**: PostgreSQL with RLS
  - **Auth**: Supabase Auth (email/password, email confirmation OFF)
  - **API**: Edge Functions (Deno/TypeScript) — `poll-weather`, `evaluate-alerts`, `register-push-token`, `send-digest`, `fcm-keepalive`, `delete-account`, `subscription-webhook`, `get-forecast`
  - **Scheduling**: `pg_cron` extension calling `poll-weather` hourly via `pg_net` + vault-held service role key
  - **Storage**: none used (yet)

### Weather Data
- **Primary**: Open-Meteo API — commercial license purchased (required for monetized apps). Server-side key only; client proxies via `get-forecast` Edge Function.
- **Architecture**: Server-side polling with grid-square caching. One API call per unique grid (0.1°), evaluate all matching rules against cached data.

### Push Notifications
- **Android**: Firebase Cloud Messaging V1 via Expo Push Service
- **iOS**: APNs (deferred — not in MVP scope)
- **Client**: `expo-notifications` (lazy-loaded via `src/hooks/usePushNotifications.ts` so Expo Go doesn't crash when hook is referenced)
- **Critical**: All polling and notification sending happens server-side. On-device background tasks are unreliable on Android.

## Subscription Tiers

| Feature | Free | Pro ($3.99/mo) | Premium ($7.99/mo) |
|---|---|---|---|
| Locations | 1 | 3 | 10 |
| Alert Rules | 2 | 5 | Unlimited |
| Polling Interval | 12hr min | 4hr min | 1hr min |
| Compound Conditions | No | Yes | Yes |
| Alert History | 7 days | 30 days | 90 days |
| SMS Alerts | No | No | Yes (future) |

RevenueCat Android is live — `upgrade.tsx` calls `purchasePackage()` fully wired.
iOS key is empty (`revenueCatIosApiKey: ""` in `app.json`) — blocked on Apple Developer
approval. `jimmy@truthcenteredtech.com` has a developer tier-override in Settings
for testing gating without real payments.

## Project Structure

```
PingWeather/
├── app/                        # Expo Router screens
│   ├── (tabs)/                 # Main tab navigator (5 visible tabs)
│   │   ├── index.tsx           # Home — forecast card + active alerts + recent notifications
│   │   ├── alerts.tsx          # Alert rules — presets + custom builder + filters
│   │   ├── locations.tsx       # Monitored locations management
│   │   ├── forecasts.tsx       # Per-location forecasts + tap-to-drill-in day detail
│   │   ├── settings.tsx        # Account, theme, units, notifications, dev options
│   │   └── _layout.tsx         # Tab bar config (history is href:null — reachable by link)
│   ├── onboarding/             # Onboarding wizard
│   │   ├── welcome.tsx
│   │   ├── privacy.tsx
│   │   ├── eula.tsx
│   │   ├── location-setup.tsx
│   │   ├── notification-setup.tsx
│   │   ├── battery-setup.tsx   # Android: Unrestricted battery; iOS: Background App Refresh
│   │   └── complete.tsx
│   ├── legal/                  # EULA + privacy policy screens
│   ├── login.tsx
│   ├── signup.tsx
│   ├── forgot-password.tsx     # Enter email, send reset link
│   ├── reset-password.tsx      # Deep-linked from email, reads ?code= via PKCE
│   ├── upgrade.tsx             # Paywall (RevenueCat pending)
│   ├── create-rule.tsx         # Custom rule builder (create / edit / clone modes)
│   ├── day-detail.tsx          # Hourly breakdown for a selected day
│   ├── history.tsx             # Alert history
│   └── _layout.tsx             # Root layout (SafeAreaProvider + auth gate + Stack)
├── src/
│   ├── stores/                 # Zustand state stores (all persisted via AsyncStorage)
│   │   ├── authStore.ts
│   │   ├── locationsStore.ts
│   │   ├── alertRulesStore.ts
│   │   ├── alertHistoryStore.ts
│   │   ├── settingsStore.ts
│   │   └── themeStore.ts
│   ├── theme/                  # Token-based theme system, 3 themes
│   ├── types/                  # TypeScript type definitions
│   ├── data/                   # Static data (legal docs, presets, metric definitions)
│   ├── services/               # Pure API clients / helpers
│   │   ├── weatherApi.ts       # Open-Meteo forecast client
│   │   ├── rainfallApi.ts      # Precipitation history (24h/7d/30d) via get-forecast
│   │   ├── geocoding.ts        # Open-Meteo geocoding client
│   │   ├── hourlyForDay.ts     # Pure filter for day-detail screen
│   │   ├── weatherIcon.ts      # WMO weather code → emoji + label
│   │   ├── purchases.ts        # RevenueCat wrapper (lazy-loaded)
│   │   ├── digestFormatter.ts  # Format forecast data for digest notifications
│   │   ├── digestScheduler.ts  # Digest scheduling logic
│   │   ├── subscriptionLogic.ts # Tier limit helpers
│   │   └── parseRecoveryUrl.ts # Dead code but kept — implicit-flow fallback parser
│   ├── utils/
│   │   ├── supabase.ts         # Supabase client with PKCE flowType
│   │   ├── devAccount.ts       # isDevAccount() email gate
│   │   ├── alertsHelpers.ts    # pickDefaultLocation, filterRules, findLocationName
│   │   ├── weatherEngine.ts    # Pure weather logic — shared with Deno via _shared/
│   │   ├── metricHelpers.ts    # getUnitForMetric, getUnitLabel, getOperatorsForMetric
│   │   ├── migrateAsyncStorage.ts  # One-time weatherwatch→pingweather key migration
│   │   └── moonPhase.ts        # Moon phase calculation helpers
│   ├── components/
│   │   ├── LocationSearchInput.tsx  # Debounced geocoding autocomplete with race guard
│   │   ├── RainfallCard.tsx    # Precipitation history accordion (rainfall + snowfall)
│   │   ├── UpdateCheckScreen.tsx   # Branded OTA update check screen
│   │   ├── ErrorBoundary.tsx   # Top-level React error boundary
│   │   └── WalkthroughModal.tsx    # First-launch guided walkthrough
│   └── hooks/
│       └── usePushNotifications.ts  # Lazy-loaded expo-notifications wrapper
├── supabase/
│   ├── config.toml             # verify_jwt flags per function — DO NOT remove
│   ├── migrations/             # SQL migrations 00001–00017, all applied
│   ├── _shared/                # Deno-compatible shared code (verbatim copy of weatherEngine.ts)
│   └── functions/              # Edge Functions (Deno)
│       ├── poll-weather/       # Cron-triggered scheduler + grid cache + push dispatch
│       ├── evaluate-alerts/    # Rule evaluation engine
│       ├── register-push-token/# Stores Expo push token in profile
│       ├── send-digest/        # Daily/weekly forecast digest notifications
│       ├── fcm-keepalive/      # Daily silent push + token pruning
│       ├── delete-account/     # GDPR account deletion
│       ├── subscription-webhook/ # RevenueCat webhook → profiles.subscription_tier
│       └── get-forecast/       # Open-Meteo proxy (keeps commercial key server-side)
├── __tests__/                  # Jest tests, dual project config (logic + components)
├── assets/                     # Images, icons, notification icon
├── app.json                    # Expo config — includes scheme, permissions, plugins
├── eas.json                    # EAS Build config — development profile active
├── jest.setup.ts               # Global mocks for AsyncStorage, Supabase, expo modules
├── tsconfig.json               # TypeScript strict
├── docs/                       # PRD, known issues, test status, handoff, future features
├── .claude/                    # Claude-specific memory and prompts
│   └── memory/
│       └── MEMORY.md           # Primary persistent context — read first every session
└── CLAUDE.md                   # This file
```

## Architecture Principles

1. **Server-side polling** — All weather API polling and condition evaluation happens in Supabase Edge Functions triggered by `pg_cron`. The app is a configuration interface + notification receiver.
2. **Grid-square caching** — Cluster users by approximate location (0.1° = ~11km). One API call per grid per polling interval, then evaluate all matching users' rules against cached data.
3. **Notification reliability** — Use FCM V1 via Expo Push for delivery. Never rely on on-device background tasks for critical alerts.
4. **Tier enforcement** — Server-side logic is the authority; client shows limits for UX. `TIER_LIMITS` constant in `src/types/index.ts` is shared between client and server spec.
5. **Weather disclaimer** — Always surface that forecasts are inherently uncertain. PingWeather supplements, not replaces, official weather warnings.
6. **Secure token storage** — JWTs in `expo-secure-store` (Keystore on Android); push tokens only in `profiles.push_token` via the `register-push-token` Edge Function.

## Development Commands

```bash
# Dev server
npx expo start --dev-client        # connects to the EAS dev build APK (not Expo Go — won't work)

# Type check + tests
npx tsc --noEmit                   # strict typecheck
npx jest --selectProjects logic    # pure logic tests (fast, run on every save)
npx jest --selectProjects components  # jsdom component tests (flagged as text-presence only, NOT verification)
npm test                           # both projects

# Supabase
npx supabase db push               # apply pending migrations to live project
npx supabase functions deploy <name>  # deploy an Edge Function
npx supabase functions list        # list deployed versions

# EAS builds
eas build --platform android --profile development  # new dev APK (burns 1 credit, ~20 min)
eas credentials                    # manage FCM V1 service account + keystore

# OTA update (JS-only changes — no build credit needed)
eas update --platform android --channel preview --message "<description>"
# --platform android is REQUIRED — omitting it tries to build a web bundle (react-native-web not installed)
```

## Environment Variables

Required in `.env.local` (never committed):
```
EXPO_PUBLIC_SUPABASE_URL=https://ziyxkgbrdliwvztotxli.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key, not service role>
```

Additional local files (gitignored):
```
google-services.json              # Firebase config for FCM, in project root
```

## Testing Contract (per global CLAUDE.md §9 verification contract)

PingWeather's verification strategy, by layer:

| Layer | Tool | Runs how |
|---|---|---|
| Pure logic (stores, helpers, engine functions) | Jest `logic` project (node env) | `npx jest --selectProjects logic` — **THIS IS ACCEPTABLE VERIFICATION per the ruthless-mentor contract** |
| React Native screens | jsdom component tests exist but are **FLAGGED AS FRAUDULENT** — text presence only, not behavior. Do NOT treat as verification. | `npx jest --selectProjects components` — runs the suite but results should never be cited as proof that a UI works |
| Full UI behavior | Maestro E2E | **DEFERRED** (INFRA-001). Currently no E2E. |
| Real UI behavior | Jimmy on device, manual, noted in the completion line | The current truth — "Verified by: Jimmy on device YYYY-MM-DD" is the only accepted UI verification method until Maestro lands |
| Backend (Edge Functions) | `net.http_post` from the Supabase SQL editor, inspecting `net._http_response` + function logs + database row state | No automated backend tests — integration is validated via live calls |
| TypeScript correctness | `tsc --noEmit` | Catches type errors but **NEVER counts as runtime verification** per the contract |

**What "done" means for a UI change on this project:** the change hot-reloads
in Jimmy's EAS dev build and Jimmy tests it on his physical Android device,
then confirms the behavior in chat. That's the only accepted path until
Maestro is set up.

## Coding Standards

- TypeScript strict mode — no `any` unless interop requires it; prefer `unknown` + type guards
- Functional components with hooks
- Named exports preferred over default (except for Expo Router screens which require default)
- Keep components under 200 lines; split when they exceed
- Error handling on all external API calls with user-friendly messages
- Never log sensitive data (tokens, password hashes, JWTs)
- Supabase queries must return `Promise<boolean>` from store mutations so UI can react to failure correctly — precedent set by `locationsStore.addLocation`

## Critical Rules

These rules emerged from real bugs this session. Treat as load-bearing:

1. **Do NOT refactor `getHourlyForDay` or `formatDayLabel` to use `new Date()` on YYYY-MM-DD strings.** Both use string-prefix matching intentionally because `new Date("2026-04-09")` gives UTC midnight which drifts to the previous day in western timezones. See MEMORY.md "Day-detail hourly screen" section.
2. **Do NOT re-introduce the old `max_notifications` cycle feature without nailing the semantic first.** See MEMORY.md "Rate-limit cycle feature — REVERTED" for the post-mortem.
3. **Do NOT set `verify_jwt = true` on `poll-weather` or `evaluate-alerts` in `supabase/config.toml`.** They're internal, called by `pg_cron` (vault service_role) and by each other (service_role client). Setting JWT verification on would break the pipeline with 401 Unauthorized at the gateway, and the symptom is a silent `continue` in `poll-weather` that leaves `last_polled_at` unstamped. `register-push-token` is the only function that should have JWT verification on.
4. **Do NOT use `.update(...).eq(...).order(...).limit(...)` in supabase-js.** The `.order()` and `.limit()` modifiers are silently ignored on UPDATE. If you need to update "only the latest matching row", either `SELECT max(id)` first and then `UPDATE WHERE id = ...`, or have the inserting code return the PK via `.select(...).single()` and update by id later. This is how BUG-007 happened.
5. **Do NOT delete `src/services/parseRecoveryUrl.ts` even though it's unused.** It's the implicit-flow fallback parser that would be needed if we ever swap off PKCE. Kept intentionally.
6. **Do NOT reintroduce the "WeatherWatch" name in user-facing copy.** Rebrand to PingWeather is load-bearing for trademark clearance. The Supabase dashboard project label is still "WeatherWatch" because renaming would break the project URL — that's the only permissible usage.
7. **Android package is `com.truthcenteredtech.pingweather`.** Renaming this would invalidate the FCM credentials upload and require a new Firebase project + rebuild. Don't.

## Entity: Truth Centered Tech
- Legal contact: legal@truthcenteredtech.com
- Privacy contact: privacy@truthcenteredtech.com
- Governing law: Virginia, US
