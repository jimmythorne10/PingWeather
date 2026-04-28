# F15: Developer Tier Override

## Overview
A Settings-screen card visible only to `jimmy@truthcenteredtech.com` that shows three tier buttons. Intended to let Jimmy test paid-tier functionality without going through the RevenueCat purchase flow.

## Screens Involved
- `app/(tabs)/settings.tsx` — `DEVELOPER OPTIONS` section, gated by `canOverrideTier = isDevAccount(profile?.email)`.

## Data Model
Attempts to write `profiles.subscription_tier` via `updateProfile({ subscription_tier })`.

## State Management
Uses `authStore.updateProfile`. Local `tierSwitching: SubscriptionTier | null` for button disabled-state.

## Business Rules
- **Gate**: `isDevAccount(email)` case-insensitive equality with `'jimmy@truthcenteredtech.com'`.
- **Three buttons** (free / pro / premium). Tapping a different tier triggers `updateProfile`.
- **No RevenueCat interaction** — purely a DB tier write.

## Security Consideration — Likely Broken
Migration 00013 added a WITH CHECK clause to the profiles UPDATE policy:
```sql
with check (
  auth.uid() = id
  and subscription_tier = (select subscription_tier from public.profiles where id = auth.uid())
)
```
This means: an authenticated UPDATE to `profiles` is allowed only if the new row's `subscription_tier` equals the currently stored value. In other words, *the tier cannot be changed via a user JWT* — only service_role (which bypasses RLS) can change it.

The dev tier override code path uses the user's JWT via `authStore.updateProfile`. This means **the dev override should be rejected by RLS**.

If Jimmy actually sees the tier change, one of the following is true:
1. The migration 00013 hasn't been applied in the target environment (MEMORY.md notes 00013-00016 are new and may not all be deployed).
2. The `error` case is silently swallowed by `authStore.updateProfile` (which only sets `state.error = 'Failed to update profile'` with no surfacing in Settings) and Jimmy uses the Supabase dashboard to change tiers for real.
3. Some other path (service-role usage, different policy) makes this work.

This should be verified against the live DB. The UI presently shows the buttons as successful without confirming the backend change.

## API Interactions
- `profiles.update({ subscription_tier }).eq('id', user.id)` — user JWT.

## Error Handling
- `updateProfile` sets `state.error` on failure. Settings does not render this error.

## Edge Cases — Handled
- Case-insensitive email match.
- Null email safety.
- Concurrent tier-switches blocked by `tierSwitching` state.

## Edge Cases — NOT Handled (Gaps)
- **RLS rejection likely silent** as above.
- **No feedback** to Jimmy on whether the write succeeded.
- **Not cleared on sign-out** — but the `isDevAccount` gate fails once there's no profile, so the section disappears.

## Test Coverage
- `__tests__/data/devAccount.test.ts` — `isDevAccount` gate semantics.

**Verdict:** The gate works. The write does not (as of migration 00013). This is a developer-tooling gap that is low-risk (Jimmy is the only audience) but should be acknowledged.
