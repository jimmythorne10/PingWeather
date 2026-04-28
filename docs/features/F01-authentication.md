# F01: Authentication

## Overview
Email-and-password authentication backed by Supabase Auth, with a PKCE flow for password recovery so reset links survive Expo Router's deep-link handling. Users sign up, sign in, and reset passwords from dedicated screens; sessions are persisted in iOS Keychain / Android Keystore via `expo-secure-store`.

## Screens Involved
- `app/login.tsx` — sign-in form
- `app/signup.tsx` — account creation form
- `app/forgot-password.tsx` — email capture for reset
- `app/reset-password.tsx` — deep-linked screen that exchanges the recovery `?code=` for a session and updates the password
- `app/_layout.tsx` — auth gate (routes unauthenticated users to `/login`, authenticated incomplete-onboarding users to `/onboarding/welcome`, authenticated + onboarded users to `/(tabs)`)

## Data Model
| Table | Columns touched | Operation |
|-------|-----------------|-----------|
| `auth.users` | id, email, encrypted password | INSERT on signup, password UPDATE on reset, validated on signin |
| `public.profiles` | id (FK to auth.users), email, display_name, subscription_tier (default `free`), onboarding_completed (default false), push_token, etc. | INSERT via `handle_new_user()` trigger on `auth.users` insert; SELECT on every `fetchProfile()`; UPDATE on `updateProfile()` |

The profile row is automatically created by a Postgres trigger `public.handle_new_user()` — no client-side insert happens after signup.

## State Management
Store: `src/stores/authStore.ts` (Zustand, not persisted — tokens live in SecureStore, profile is re-fetched on initialize).

State shape:
```
session: Session | null
user: User | null
profile: Profile | null
initialized: boolean
loading: boolean
error: string | null
```

Actions used:
- `initialize()` — reads session from SecureStore, subscribes to `onAuthStateChange`. Tears down prior subscription to prevent stacking on hot-reload.
- `signUp(email, password, displayName)` — `supabase.auth.signUp` with `display_name` in user metadata.
- `signIn(email, password)` — `supabase.auth.signInWithPassword`.
- `forgotPassword(email)` — `supabase.auth.resetPasswordForEmail` with `redirectTo` built by `Linking.createURL('/reset-password')` (produces `pingweather://reset-password` on standalone, `exp://…` on Expo Go).
- `signOut()` — `supabase.auth.signOut`, always resets local state regardless of network outcome.
- `fetchProfile()` — reads `profiles` by `auth.uid()`. On success, seeds `settingsStore.temperatureUnit` from `profile.temperature_unit` (lazy import to avoid circular dependency).
- `updateProfile(updates)` — UPDATE with `.select().single()` return, replaces local `profile`.

## Business Rules
- **Email confirmation is OFF** in Supabase. Signup produces an immediately-usable session (confirmed in `authStore.signUp` — store sets session from `data.session` right away).
- **Password minimum**: enforced only on reset (`reset-password.tsx` line 72-75: `if (password.length < 8)`). Signup does NOT enforce client-side length — Supabase default minimum is 6 chars.
- **Profile creation** is atomic with user creation (Postgres trigger).
- **PKCE flow** (`supabase.ts` `flowType: 'pkce'`) — password recovery delivers the recovery token as `?code=…` in the query string, not the legacy hash fragment. Expo Router strips `#fragment` but preserves query strings.
- **`redirectTo`** for password reset must be whitelisted in Supabase Auth → URL Configuration.

## API Interactions
| Type | Endpoint / table | Auth |
|------|------------------|------|
| Supabase Auth | `auth.signUp` | anon key |
| Supabase Auth | `auth.signInWithPassword` | anon key |
| Supabase Auth | `auth.resetPasswordForEmail` | anon key |
| Supabase Auth | `auth.exchangeCodeForSession` | anon key (called in `reset-password.tsx`) |
| Supabase Auth | `auth.updateUser({ password })` | user JWT (authenticated via recovery session) |
| Supabase REST | `from('profiles').select('*').eq('id', user.id)` | user JWT (RLS) |
| Supabase REST | `from('profiles').update(...).eq('id', user.id)` | user JWT (RLS, WITH CHECK on subscription_tier) |

## Error Handling
- All auth actions catch the thrown error and set `state.error` to `err.message` (falling back to a generic string).
- `initialize()` wraps its entire body in try/catch and always sets `initialized: true` on exit — even network failure unblocks the loading spinner.
- `onAuthStateChange` callback has a separate `.catch` on `fetchProfile()` so a bad network on cold-start doesn't strand the app with `profile: null` (which would hang both the onboarding branch and tabs branch of the auth gate).
- `forgotPassword` intentionally returns success regardless of whether the email exists — prevents account-enumeration.

## Edge Cases — Handled
- Hot-reload during dev: `_authSubscription?.unsubscribe()` before re-registering prevents listener pile-up.
- Recovery screen on cold-start: `reset-password.tsx` handles the deep link via `useLocalSearchParams`, which is populated before first render.
- Recovery screen session activation: `_layout.tsx` has `inRecovery` guard so auth gate doesn't bounce the user off the reset-password screen once Supabase flips `session` to truthy.
- Supabase returns generic errors for invalid email during reset: `authStore.forgotPassword` treats network/DB errors distinctly from "email not found".
- SignOut network failure: local state (`session`, `user`, `profile`) is cleared in `finally` so the user is always signed out locally.

## Edge Cases — NOT Handled (Gaps)
- **No rate limiting** client-side on login attempts. Supabase enforces its own throttle server-side, but there is no UI debounce or lockout message.
- **No password strength meter** or zxcvbn-style scoring on signup. Only the `>= 8 chars` rule on reset is enforced; signup itself relies on Supabase default (6).
- **No email format validation**. Users can submit malformed emails and only see the error after Supabase responds.
- **No resend-verification-email flow** — moot while email confirmation is OFF, but a gap if it's turned on.
- **No MFA / 2FA** of any kind.
- **Token refresh failure** is not surfaced to the user — Supabase silently clears the session and the auth gate bounces them to `/login`, which looks like an unexpected signout.
- **Deep-link error params** (`?error=…&error_description=…`) are surfaced on reset-password but not on any other screen — an error arriving on `/login` via deep link would be ignored.

## Test Coverage
Test files:
- `__tests__/stores/authStore.test.ts` — unit tests for the store actions (sign-in success/failure, sign-up, profile fetch, error clearing). Mocks `supabase.auth` and `supabase.from(...)` via `__mocks__/` shims.
- `__tests__/flows/authFlow.test.ts` — simulates end-to-end store orchestration: signup → profile creation → onboarding flag → sign-out.
- `__tests__/services/parseRecoveryUrl.test.ts` — validates the hash-fragment/query-string parser (the backup implicit-flow parser kept for future use).
- `__tests__/screens/login.test.tsx`, `signup.test.tsx` — jsdom text-presence tests. **Flagged as fraudulent** per project Testing Contract — they verify labels, not behaviour. Do NOT trust these to catch regressions.

**Verdict:** Unit tests catch logic regressions (field parsing, state transitions, error paths). The screen tests would NOT catch a regression where, say, `signIn` was stubbed to a no-op — they would still pass because they only assert on rendered copy. Maestro E2E is DEFERRED (INFRA-001 per project CLAUDE.md).
