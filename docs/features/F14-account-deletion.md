# F14: Account Deletion

## Overview
A user can permanently delete their account and all associated data from Settings. A single Edge Function call invokes `auth.admin.deleteUser()`, which cascades through `profiles` and downstream tables via ON DELETE CASCADE foreign keys.

## Screens Involved
- `app/(tabs)/settings.tsx` — "Delete Account" red button below Legal, above Sign Out.

## Data Model
Cascade chain (all automatic):
- `auth.users` (deleted) → `profiles` (CASCADE on `id` FK) → `locations`, `alert_rules` (CASCADE on `user_id` FK) → `alert_history` (CASCADE on `user_id`) + `alert_rules.rule_id SET NULL` in any surviving history (though user_id cascade already covers it).

Digest location FK on profiles uses SET NULL — moot here because profile itself is deleted.

## State Management
Local component state `deleting: boolean` to show a spinner. On success, `signOut()` clears the Zustand session, and the auth gate routes to `/login`.

## Business Rules
- **Double confirm** — Alert dialog with destructive-red style "Delete" option.
- **Service-side call** — `supabase.functions.invoke('delete-account', { method: 'POST' })`. Edge Function requires a valid user JWT (`verify_jwt = true` in `config.toml`).
- **JWT validated** via `adminClient.auth.getUser(jwt)` — the correct pattern (documented in the function and in `register-push-token`'s comments).
- **auth.admin.deleteUser(user.id)** is authoritative — RLS isn't involved; service role bypasses.
- **Successful delete** results in signOut + redirect.

## API Interactions
| Call | Endpoint | Auth |
|------|----------|------|
| Delete | `POST /functions/v1/delete-account` | user JWT (validated + replaced by admin client) |
| Sign out | `auth.signOut()` | local |

## Error Handling
- Missing authorization header → 401.
- JWT validation failure → 401.
- `deleteUser` failure → 500 via catch.
- Client catches error and shows an Alert with the message; `deleting` resets so user can retry.

## Edge Cases — Handled
- Multi-step deletion (any failure point) is caught in a single try/catch.
- SignOut is after successful delete, ensuring local state is cleared.
- Cascade tests via DB FK setup — no manual cleanup needed in the function.

## Edge Cases — NOT Handled (Gaps)
- **No grace period / undo** — deletion is immediate and irreversible.
- **No confirmation code / password re-entry** — someone with a short-lived unlocked device can delete the account through the UI.
- **No export** — user cannot download their alert history or settings before delete.
- **No email confirmation** — Supabase doesn't send a "your account was deleted" email automatically.
- **Session revocation** is implicit (delete → subsequent JWT invalid) but there's no active token-revocation step. An attacker with a stolen JWT could still have a brief window.
- **Orphaned RevenueCat subscription**: if the user has an active paid subscription, deleting the Supabase account doesn't cancel the Google Play subscription. They'll keep being billed until they cancel in Play Store.
- **No admin audit log** — no row is written before deletion to record "user X deleted at time Y". `console.log` in the function is the only trace.

## Test Coverage
No automated tests. The Edge Function's behavior is validated by Jimmy via direct invocation / observation.

**Verdict:** Correctness depends on DB cascade setup + the Edge Function's JWT validation. Both are present and simple. The UX gaps (no grace period, no subscription cancellation) are product decisions rather than bugs.
