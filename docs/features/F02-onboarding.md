# F02: Onboarding Flow

## Overview
A seven-screen first-run wizard that introduces the app, captures privacy/EULA acceptance, seeds the user's first location, requests push notification permission, and (on Android) educates the user about battery optimization before marking `profile.onboarding_completed = true`.

## Screens Involved
Linear flow (each screen `push`es to the next):
1. `app/onboarding/welcome.tsx` — brand intro, feature bullets, "Get Started" button
2. `app/onboarding/privacy.tsx` — privacy-highlights screen (not the full policy; that's under Legal)
3. `app/onboarding/eula.tsx` — full Terms of Use text from `legal-content.ts`; tapping "I Accept" writes `eula_accepted_version` + `eula_accepted_at` to profile
4. `app/onboarding/location-setup.tsx` — add first location by device GPS, geocoding search, or manual coordinates
5. `app/onboarding/notification-setup.tsx` — request push permission, register Expo push token with the server
6. `app/onboarding/battery-setup.tsx` — Android-only guidance to whitelist the app from battery optimization (iOS variant explains Background App Refresh)
7. `app/onboarding/complete.tsx` — sets `onboarding_completed: true`, triggers `fetchProfile()`, navigates to `/`

Layout: `app/onboarding/_layout.tsx` — plain Stack with `slide_from_right` animation.

Auth-gate routing (`app/_layout.tsx`): if `session && profile && profile.onboarding_completed === false && !inOnboarding && !inRecovery` → `router.replace('/onboarding/welcome')`.

## Data Model
| Screen | Tables / columns written |
|--------|--------------------------|
| EULA | `profiles.eula_accepted_version`, `profiles.eula_accepted_at` |
| Location setup | `locations` (INSERT — `user_id`, `name`, `latitude`, `longitude`, `is_active: true`, `is_default: true` if first, `timezone`) |
| Notification setup | `profiles.push_token` (via `register-push-token` Edge Function) |
| Complete | `profiles.onboarding_completed = true` |

## State Management
- `useAuthStore.updateProfile` is the write path for profile updates.
- `useLocationsStore.addLocation` persists the first location and returns `Promise<boolean>` so the onboarding screen can abort-on-failure.
- `usePushNotifications().registerForPushNotifications()` handles the entire permission → token → server-register chain.

No dedicated onboarding store — each screen reads/writes through the existing feature stores.

## Business Rules
- **EULA version is recorded** at acceptance time (`EULA_CONTENT.version` from `legal-content.ts` — currently `1.0.0`). Future re-prompt logic can compare this against a newer version.
- **Location setup is skippable**: "Skip for now" button advances to notification setup without adding a location.
- **Notification setup is skippable**: "I'll do this later" button advances to battery setup.
- **Battery setup is skippable**: "Skip for now (not recommended)" — includes the platform-specific deep link into Settings (`app-settings:` for iOS, `Linking.openSettings()` for Android).
- **Only after `complete.tsx`** is `onboarding_completed` flipped true — the user can't escape the wizard by force-navigating; the auth gate re-routes them back.
- **Location save failure must block progression**: `location-setup.tsx` calls `addLocation` and checks the boolean return (`FIX 7` per inline comment). If `false`, the wizard does not advance.

## API Interactions
| Call | Endpoint | Auth |
|------|----------|------|
| Accept EULA | Supabase REST: `profiles.update({ eula_accepted_version, eula_accepted_at })` | user JWT |
| Geocoding search | `https://geocoding-api.open-meteo.com/v1/search` | none (public API) |
| Device location | `expo-location` native API | user grant |
| Add location | Supabase REST: `locations.insert(...)` | user JWT |
| Request push permission | `expo-notifications` native API | user grant |
| Get Expo push token | `Notifications.getExpoPushTokenAsync({ projectId })` | EAS project ID from app config |
| Register push token | `supabase.functions.invoke('register-push-token', { body: { push_token } })` | user JWT (Edge Function validates via `adminClient.auth.getUser(jwt)`) |
| Mark complete | Supabase REST: `profiles.update({ onboarding_completed: true })` + `fetchProfile()` | user JWT |

## Error Handling
- Geocoding API errors are surfaced in the `LocationSearchInput` component (shows "Search failed — try again").
- Device location denial is surfaced via `useDeviceLocation().error`.
- Push permission denial returns `{ token: null, error: 'Push notification permission denied.' }` from the hook.
- EAS `projectId` missing is surfaced as an error in the hook (would block push registration entirely).
- `register-push-token` Edge Function errors are surfaced via the hook's dual-path error handler (examines both `fnError` and `{ error: '…' }` bodies inside 2xx responses — see `FIX` inside `usePushNotifications.ts`).

## Edge Cases — Handled
- Geolocation permission denied: `handleUseCurrentLocation` leaves coords unset; user can fall back to typing lat/lon.
- Location name auto-fill from geocoding pick.
- Platform branching for the "next screen" logic — Android routes through battery-setup, iOS skips to complete.
- Race condition in geocoding (user keeps typing during in-flight request): `LocationSearchInput` has `activeQueryRef` that discards stale responses.
- Duplicate search suppression: `lastSelectedLabelRef` prevents re-searching a value the user just picked.

## Edge Cases — NOT Handled (Gaps)
- **No "back" guard** — tapping the hardware back button from `complete.tsx` returns to the battery screen, from which the user could skip forward again. Not harmful but UX-strange.
- **No profile failure recovery** — if `updateProfile({ onboarding_completed: true })` fails (network), the user hits `/` but `profile.onboarding_completed` is still false, and the auth gate will yo-yo them back to the wizard on the next navigation.
- **Location set to (0, 0) by manual edit** — the coord-edit TextInputs don't validate the pair as a real point; a user can advance with `lat: 0, lon: 0` (technically valid per RLS CHECK constraints, but nonsensical). Nothing warns them.
- **No "change my mind" for EULA** — once accepted, no UI to re-review and revoke inside onboarding.
- **Timezone capture** relies on `Intl.DateTimeFormat().resolvedOptions().timeZone` (device timezone) when using GPS, which may differ from the location's actual timezone if the user sets up a remote location from home. `poll-weather` backfills the correct IANA zone on first poll, but digests scheduled before that first poll use the wrong zone.
- **No error retry** for the final `onboarding_completed` write — if it fails, the user is silently stuck.

## Test Coverage
- `__tests__/screens/onboarding.test.tsx` — jsdom text-presence test. Verifies title strings and button labels. **Would not catch** a regression where the screens are wired up to the wrong Supabase table.
- `__tests__/data/legalContent.test.ts` — validates the EULA/privacy-policy content module renders expected sections.

Real verification: Jimmy device-tested on first boot after install. No Maestro E2E coverage of the onboarding flow.
