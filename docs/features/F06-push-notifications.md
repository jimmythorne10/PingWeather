# F06: Push Notifications

## Overview
Expo Push tokens are requested on-device, registered server-side via an authenticated Edge Function, and consumed by `poll-weather` and `send-digest` to deliver both alert and digest notifications. Android uses FCM V1 transport, iOS APNs (iOS not yet shipped).

## Screens Involved
- `app/onboarding/notification-setup.tsx` — first-run permission request + token registration
- `app/(tabs)/settings.tsx` — Push Notifications on/off toggle (local only, does not affect server); developer "Register / Refresh Push Token" button (dev account only)
- `src/hooks/usePushNotifications.ts` — lazy-loaded `expo-notifications` wrapper

## Data Model
Writes to:
- `public.profiles.push_token` (single column, text). Updated by the `register-push-token` Edge Function.

No tables for history of token changes — the current token is the only state.

Android notification channels created on first hook invocation:
- `weather-alerts` (importance: MAX, vibration, lightColor `#1E3A5F`, sound)
- `forecast-digest` (importance: DEFAULT, sound)

## State Management
No dedicated Zustand store. Hook-local state only:
- `expoPushToken: string | null`
- `error: string | null`
- `subscriptions: Array<{ remove }>` ref for listener cleanup

`settingsStore.notificationsEnabled` boolean exists but is purely local UI state — it does NOT gate server-side push dispatch. This is a gap (see below).

## Business Rules
- **`expo-notifications` is lazy-loaded** via require() inside `getNotifications()` — Expo Go on SDK 53+ crashes if the module is imported at startup. The hook no-ops safely in Expo Go and reports the error.
- **Android channels created before permission request** — per Expo / FCM best practice so the channels exist when Android displays the permission dialog.
- **EAS `projectId` required** to mint an Expo push token: `Constants.expoConfig?.extra?.eas?.projectId`. Missing projectId is surfaced as an error.
- **Server registration is mandatory** — the hook will NOT return `token` as success if the `register-push-token` Edge Function call fails. Also checks for 2xx with `{ error: '…' }` body (some Edge Function errors come back that way).
- **Registration is a one-shot write** — subsequent calls update `profiles.push_token` unconditionally via `adminClient` (bypasses RLS since service_role is used server-side, but the JWT was verified first).
- **No un-registration** — when a user signs out or deletes the app, the token stays. The account-delete cascade clears it; simple sign-out does not.
- **Notification handler** (set globally via `setNotificationHandler`): shows banner, plays sound, sets badge, shows in list. Set only once via `handlerConfigured` flag.
- **Listeners** registered in `useEffect`:
  - `addNotificationReceivedListener` — currently no-ops (handler is set at module scope)
  - `addNotificationResponseReceivedListener` — no-ops; comment says future work is to navigate via `content.data.rule_id`

## API Interactions
| Call | Endpoint | Auth |
|------|----------|------|
| Set Android channels | `Notifications.setNotificationChannelAsync(...)` | native |
| Get permission status | `Notifications.getPermissionsAsync()` | native |
| Request permission | `Notifications.requestPermissionsAsync({})` | native |
| Get Expo push token | `Notifications.getExpoPushTokenAsync({ projectId })` | EAS projectId in app config |
| Register token server-side | `supabase.functions.invoke('register-push-token', { body: { push_token } })` | user JWT (Edge Function calls `adminClient.auth.getUser(jwt)` to validate) |
| Send push (from backend) | `POST https://exp.host/--/api/v2/push/send` with `{ to, sound, title, body, data }` | none (Expo push token is the identifier) |

## Error Handling
Hook helper `fail(msg)` centralizes the error-return pattern. Failure paths:
- Notifications module not available (Expo Go) → `"Push notifications are not available in Expo Go. Use a development build."`
- Permission denied → `"Push notification permission denied."`
- Missing EAS projectId → `"EAS projectId missing from app config — cannot get push token."`
- Edge Function failure (fnError) → parses `context.json()` for body error, returns `"${status}: ${body.error}"` or a message fallback.
- 2xx body with `{ error: '…' }` → `"Server rejected push token: ${error}"`.

Server-side `register-push-token`:
- Missing Authorization header → 401.
- `adminClient.auth.getUser(jwt)` fail → 401 Unauthorized.
- Missing `push_token` in body or non-string → 400.
- DB update failure → 500 via generic catch.

## Edge Cases — Handled
- Double-registration of listeners on hook re-mount: `subscriptions.current.forEach(s => s.remove())` in cleanup.
- 2xx with error body from Edge Function — detected via dual-path check.
- Expo Go environment — hook reports inability instead of crashing.
- Android notification channel IDs are set at the channel level so FCM delivers into the right priority bucket.

## Edge Cases — NOT Handled (Gaps)
- **Invalid / unregistered device tokens**: when Expo push returns `DeviceNotRegistered`, the token stays in the profile. Every poll cycle re-attempts and fails silently. No cleanup job.
- **Token rotation on app reinstall**: the new token replaces the old one when the user re-registers, but if they don't proactively visit the dev-only "Register / Refresh" button (and aren't the dev account), the old token keeps being tried.
- **Multiple devices**: the `push_token` column is single-valued. Signing in on a second device overwrites the first device's token. Only the most recent device receives pushes.
- **`settingsStore.notificationsEnabled` is cosmetic**: toggling it OFF does not stop the server from sending pushes. The row in `profiles.push_token` is what actually matters.
- **iOS not verified**: the infrastructure is wired, APNs entitlement is declared in `app.json`, but there's no shipped iOS build and no mention of verified delivery.
- **No delivery receipts** consulted from Expo Push — the boolean `response.ok` indicates Expo accepted the message, not that the device received it.
- **Silent failures on Android Doze / battery optimization**: the `fcm-keepalive` daily ping is a mitigation (F16) but delivery is not guaranteed.
- **`addNotificationResponseReceivedListener` is inert** — tapping a notification doesn't navigate to the rule detail. Data payload is discarded.
- **Category / action buttons** (quick reply / dismiss) not set up.
- **No rich notifications** (images, expanded layout) despite Android supporting BigPicture style (flagged as backlog in MEMORY.md).

## Test Coverage
- `__tests__/stores/settingsStore.test.ts` — validates `notificationsEnabled` local toggle.
- No tests for `usePushNotifications` itself (would require mocking `expo-notifications` and Constants). The hook's error paths are only validated manually.
- `__tests__/screens/settings.test.tsx` — jsdom text-presence for the "Register / Refresh Push Token" button visibility (dev account gate).

**Verdict:** Real delivery is only verified by Jimmy on his physical Android device. A regression that broke the Edge Function auth validation would escape all unit tests.
