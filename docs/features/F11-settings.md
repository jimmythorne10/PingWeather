# F11: Settings & Preferences

## Overview
A central screen for account info, plan display, unit preferences (temperature, wind), theme selection, notification toggle, digest configuration, alert history shortcut, legal document links, account deletion, sign-out, and (for the dev account) tier override + push token refresh.

## Screens Involved
- `app/(tabs)/settings.tsx` — single screen, vertically scrolled sections

## Data Model
Reads/writes via `updateProfile` on `public.profiles`:
- `temperature_unit` (migration 00010) — synced to server when the user changes unit
- `digest_*` fields (F10)
- `subscription_tier` (dev override only)

Local-only (AsyncStorage via Zustand persist):
- `settingsStore.temperatureUnit` (persisted)
- `settingsStore.windSpeedUnit` (persisted, not synced to server)
- `settingsStore.notificationsEnabled` (persisted, cosmetic only)
- `themeStore.themeName` (persisted, `tokens` derived on rehydrate)

## State Management
- `authStore.profile` for account/plan/digest fields
- `authStore.updateProfile` for server writes
- `settingsStore` for unit prefs (partially server-backed)
- `themeStore` for the three themes
- `locationsStore` for the digest location picker
- `usePushNotifications` for dev-only register button

## Business Rules
- **Temperature unit** — dual-write: both `settingsStore.setTemperatureUnit(unit)` (local) and `updateProfile({ temperature_unit: unit })` (server). Server copy is consumed by `send-digest`.
- **Wind unit** — local only. No server mirror. Digest notifications from the server use mph regardless (documented gap in F10).
- **Notifications toggle** — `settingsStore.notificationsEnabled` — local only. Does NOT tell the server to stop sending pushes; it's a display preference only (further gap, F06).
- **Theme** — three choices (`classic` / `dark` / `storm`). Stored locally.
- **Dev override section** (`canOverrideTier = isDevAccount(profile?.email)`): visible only when `profile.email.toLowerCase() === 'jimmy@truthcenteredtech.com'`. Shows tier buttons and a push-token re-registration button.
- **Delete Account**: double-confirm Alert, then `supabase.functions.invoke('delete-account', { method: 'POST' })`, then sign out (cascade).
- **Sign Out**: Alert confirmation, then `signOut()`.
- **Digest controls** (detailed in F10) — only rendered when `digestEnabled`.
- **Hour picker** uses `‹ / ›` arrow buttons cycling 0-23 with `(h + 23) % 24` and `(h + 1) % 24`.

## API Interactions
| Action | Endpoint | Auth |
|--------|----------|------|
| Load profile | via authStore initialize / fetchProfile | user JWT |
| Update temperature unit | `profiles.update({ temperature_unit })` | user JWT |
| Update digest fields | `profiles.update({ digest_* })` | user JWT |
| Dev tier override | `profiles.update({ subscription_tier })` | user JWT — likely blocked by RLS WITH CHECK (F09 gap) |
| Register push | `functions.invoke('register-push-token', { body: { push_token } })` | user JWT |
| Delete account | `functions.invoke('delete-account', { method: 'POST' })` | user JWT |
| Sign out | `auth.signOut()` | user JWT |

## Error Handling
- `updateProfile` errors set `authStore.error`; Settings doesn't surface this prominently.
- Delete account shows an Alert with the error message on failure, leaves the user signed in.
- Dev tier override doesn't display errors — the UI assumes success.
- Push register displays the result inline (truncated token on success, error message on failure).

## Edge Cases — Handled
- Dev account gating is case-insensitive.
- Profile null fallback — shows `—` for email and default values for digest when `profile` is undefined.
- Digest save spinner via `digestSaving` state.
- Tier-switching busy guard via `tierSwitching` state prevents concurrent writes.

## Edge Cases — NOT Handled (Gaps)
- **Tier override likely broken** — the authenticated UPDATE on `subscription_tier` is gated by the WITH CHECK policy added in migration 00013 that only permits the tier to equal its current value. The dev override would be rejected by RLS. In practice, Jimmy's dashboard access / service role may be what lets him actually flip tiers. Not a security issue (the RLS is correct) but it means the DEV UI doesn't actually work as written through the app's JWT. Confirmation needed.
- **Wind unit not server-synced** — dust-bunny inconsistency with temperature_unit behavior.
- **Notifications toggle is cosmetic** — gap documented in F06.
- **No confirmation on destructive unit change** — switching from °F to °C during an active Alert threshold display shows stale F values until next fetch.
- **Delete account has no grace period / email confirmation** — irreversible, immediate.
- **Push register result** only shows a truncated token string — not whether it was successfully saved to `profiles.push_token` (Edge Function does return success but the hook reports it only as "✓ Registered").
- **Theme change** is instant but no "preview" — the user commits immediately.

## Test Coverage
- `__tests__/stores/settingsStore.test.ts` — validates temperature unit, wind unit, notification toggle setters.
- `__tests__/stores/themeStore.test.ts` — validates theme switching and token rehydrate.
- `__tests__/data/devAccount.test.ts` — `isDevAccount` case-insensitive, null/undefined handling.
- `__tests__/screens/settings.test.tsx` — jsdom text-presence for section headers and dev-card gating.

**Verdict:** Store tests cover the locally-persisted preferences. The server-sync behavior (temperature unit writing to profile) is not integration-tested. The dev-override RLS-block hypothesis is not tested against live RLS.
