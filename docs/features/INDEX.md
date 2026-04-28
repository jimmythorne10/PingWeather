# PingWeather Feature Index

Comprehensive catalog of every user-facing feature, derived from source code inspection on 2026-04-24.

Each feature entry links to a standalone spec in this directory.

| ID  | Feature                         | Primary screens                                    | Status                     |
|-----|----------------------------------|----------------------------------------------------|----------------------------|
| F01 | Authentication                   | `login.tsx`, `signup.tsx`, `forgot-password.tsx`, `reset-password.tsx` | Live — email/password + PKCE recovery |
| F02 | Onboarding flow                  | `onboarding/welcome.tsx` → `…/complete.tsx`        | Live                       |
| F03 | Location management              | `(tabs)/locations.tsx`                             | Live                       |
| F04 | Alert rule creation & management | `(tabs)/alerts.tsx`, `create-rule.tsx`             | Live                       |
| F05 | Weather engine (condition eval)  | `supabase/functions/{poll-weather,evaluate-alerts}` | Live (server-side)         |
| F06 | Push notifications               | `src/hooks/usePushNotifications.ts`, `functions/register-push-token` | Live (Android FCM V1)      |
| F07 | Forecast view                    | `(tabs)/index.tsx`, `(tabs)/forecasts.tsx`, `day-detail.tsx` | Live                       |
| F08 | Alert history                    | `(tabs)/history.tsx`                               | Live                       |
| F09 | Subscription tiers & upgrade     | `upgrade.tsx`, `src/services/purchases.ts`, `functions/subscription-webhook` | Live — Android only        |
| F10 | Forecast digest                  | `(tabs)/settings.tsx` (config), `functions/send-digest` | Live                       |
| F11 | Settings & preferences           | `(tabs)/settings.tsx`                              | Live                       |
| F12 | Theming (light / dark / storm)   | `src/theme/`, `src/stores/themeStore.ts`           | Live                       |
| F13 | Legal & compliance (EULA, Privacy) | `legal/eula.tsx`, `legal/privacy-policy.tsx`, `onboarding/eula.tsx` | Live                       |
| F14 | Account deletion                 | `(tabs)/settings.tsx`, `functions/delete-account`  | Live                       |
| F15 | Developer tier override          | `(tabs)/settings.tsx` (dev-only)                   | Live — gated to `jimmy@truthcenteredtech.com` |
| F16 | FCM keep-alive                   | `functions/fcm-keepalive`                          | Live — daily cron          |
| F17 | OTA updates                      | `app/_layout.tsx` (expo-updates bootstrap)          | Live                       |

Individual feature files: `F##-<slug>.md`.
