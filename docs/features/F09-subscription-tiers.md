# F09: Subscription Tiers & Upgrade Flow

## Overview
Three tiers — Free, Pro ($3.99/mo), Premium ($7.99/mo) — gate location counts, rule counts, polling frequency, compound conditions, alert-history retention, and (eventually) SMS alerts. Purchases go through RevenueCat; the authoritative source of truth is `profiles.subscription_tier`, updated by both the client (optimistic on purchase/restore) and the RevenueCat webhook (canonical).

## Screens Involved
- `app/upgrade.tsx` — three-tier comparison cards, Subscribe/Restore/Cancel actions
- `app/(tabs)/settings.tsx` — current plan display, "Upgrade / Manage Plan" CTA, developer tier override (dev account only)
- Multiple screens enforce limits inline: `alerts.tsx` (rule count banner + paywall link), `locations.tsx` (location count banner + paywall link), `create-rule.tsx` (polling floor + compound-condition gate)

## Data Model
Writes to:
- `profiles.subscription_tier text` CHECK `in ('free', 'pro', 'premium')` — the single source of truth on the Supabase side.

RevenueCat-side state lives in the RevenueCat dashboard (entitlements, active subscriptions, renewal dates). Edge Function `subscription-webhook` translates events into tier updates.

## State Management
Not a Zustand store of its own. `profile.subscription_tier` lives in `authStore.profile`, read via `useAuthStore((s) => s.profile)` everywhere that needs it.

`src/services/purchases.ts` wraps `react-native-purchases`:
- `initializePurchases(appUserId?)` — called in `_layout.tsx` after auth initialization.
- `loginPurchaseUser(supabaseUserId)` — calls `P.logIn` after session acquired. Uses the Supabase UUID as the RevenueCat `app_user_id` so the webhook can match directly.
- `logoutPurchaseUser()` — calls `P.logOut` if not an anonymous RC user.
- `getOfferings()` — reads the current offering's packages.
- `purchasePackage(identifier)` — runs the purchase, determines the new tier from `customerInfo.activeSubscriptions`, syncs to Supabase (belt + suspenders), returns `{ success, tier, error }`.
- `restorePurchases()` — same flow via `P.restorePurchases()`.
- `getCurrentTier()` — read-only check.

`src/services/subscriptionLogic.ts` — pure decision table (no Deno imports) mirrored by `subscription-webhook` server-side. Exports `determineAction(eventType, productId)`.

## Business Rules
- **Tier limits** from `TIER_LIMITS` constant (`src/types/index.ts`):
  - Free: `maxLocations: 1`, `maxAlertRules: 2`, `minPollingIntervalHours: 12`, `compoundConditions: false`, `alertHistoryDays: 7`, `smsAlerts: false`
  - Pro: `3`, `5`, `4`, `true`, `30`, `false`
  - Premium: `10`, `999`, `1`, `true`, `90`, `true`
- **Enforcement is client-side + RLS partial**: the client uses TIER_LIMITS to gate UI; the DB enforces only coordinate and numeric sanity (no tier-bound count limits). Supabase RLS update policy on `profiles` prevents self-escalation of `subscription_tier` (migration 00013 — WITH CHECK locks the tier to its current stored value for UPDATEs by non-service_role callers).
- **Product → tier mapping** in both client and server (must stay in sync):
  ```
  pro_monthly, pro_monthly:monthly, pro_annual → 'pro'
  premium_monthly, premium_monthly:monthly, premium_annual → 'premium'
  ```
  The `:monthly` colon variants cover RevenueCat SDK quirk where `restorePurchases()` returns `product:offering` IDs on some SDK versions.
- **Webhook event handling** (`determineAction`):
  - `INITIAL_PURCHASE` → upgrade to mapped tier
  - `RENEWAL` → re-set tier (idempotent)
  - `CANCELLATION` → no DB change (entitlement runs to expiration)
  - `EXPIRATION` → downgrade to `free`
  - `BILLING_ISSUE_DETECTED` → log only
  - Other → ignore
- **Dev override** (`isDevAccount()` → `jimmy@truthcenteredtech.com`): Settings shows a "DEV" card with tier buttons. Writes directly to `profiles.subscription_tier` via `updateProfile`. Works only because the dev account's JWT is used and WITH CHECK compares the new value to the CURRENT stored value — which means self-update only works if the value doesn't change. In practice, `authStore.updateProfile` uses the user JWT and the RLS policy should block tier changes. **Gap**: the dev override likely only works because Jimmy happens to also have service_role access via dashboard, not through the app. Needs verification.
- **Downgrade path**: `upgrade.tsx` when the user taps "Downgrade" (tier === 'free'), shows an Alert directing them to Google Play → Subscriptions. No in-app cancellation.
- **RevenueCat initialization** is best-effort — if the SDK fails to load (web platform, missing key), `initializePurchases` returns false and all subsequent calls no-op. Prevents hard crash.
- **API key source** (`src/services/purchases.ts`): Platform.select reads `expoConfig.extra.revenueCatIosApiKey` (iOS) or `revenueCatAndroidApiKey` (Android). These are set in `app.json` extra. The Android key is populated; iOS is empty string.

## API Interactions
| Call | Endpoint / SDK | Auth |
|------|----------------|------|
| Init | `Purchases.configure({ apiKey, appUserID })` | public RC API key |
| Login | `Purchases.logIn(supabaseUuid)` | SDK internal |
| Offerings | `Purchases.getOfferings()` | SDK internal |
| Purchase | `Purchases.purchasePackage(pkg)` | Google Play Billing under the hood |
| Restore | `Purchases.restorePurchases()` | SDK internal |
| Sync to Supabase (optimistic) | `supabase.from('profiles').update({ subscription_tier }).eq('id', user.id)` | user JWT — blocked by RLS WITH CHECK |
| Webhook (canonical) | `POST /functions/v1/subscription-webhook` | Bearer `REVENUECAT_WEBHOOK_SECRET` |

## Error Handling
- Purchase returns `{ success: false, tier: null, error: message }`. User-cancelled detected via `userCancelled` property on the error object (not treated as error).
- Restore returns `{ success: true, tier: 'free', error: 'No active subscription found' }` when no entitlement exists — ambiguous "success with no-tier" case handled in `upgrade.tsx` by checking `result.tier !== 'free'`.
- Webhook: catches everything and returns 200 to prevent RevenueCat retry storms, even on malformed payloads. Structured events validated via UUID regex and type checks.
- `updateError` server-side logs and returns 200 with `{ error: 'db_update_failed' }` — acknowledged to RevenueCat but visible to humans in logs.

## Edge Cases — Handled
- Double-initialization via `initialized` flag.
- RC SDK missing (web / Jest) via try/require pattern.
- User cancels in-flight purchase → not an error, modal just closes.
- Restore with no active subscription → explicit "No Subscription Found" alert.
- `app_user_id` malformed or non-UUID → webhook ACKs and skips DB write.
- `app_user_id` is valid UUID but no matching profile → webhook logs `user_not_found` and ACKs.
- Webhook replay on RENEWAL is idempotent (just re-writes same tier).

## Edge Cases — NOT Handled (Gaps)
- **Optimistic client-side tier sync is blocked by RLS WITH CHECK** (post-migration 00013). The code `purchases.ts → syncTierToSupabase` attempts a plain `profiles.update({ subscription_tier })` as the user. The policy permits UPDATE only if the NEW `subscription_tier` equals the CURRENT stored one. This means the optimistic sync silently fails and the user is dependent on the webhook for the tier to reflect. The UI may appear to "upgrade" while the database doesn't change until the webhook lands. **This is a functional bug.**
- **Developer tier override** likely suffers the same RLS-block problem. Unverified — may only work because the dev account goes through Supabase dashboard service-role access in practice.
- **No refund / chargeback handling** — `CANCELLATION` doesn't downgrade; `EXPIRATION` does. If Google/Apple refund mid-cycle, only `EXPIRATION` catches up.
- **No webhook replay protection** — same event delivered twice would both ACK; idempotent for renewals but a duplicate `INITIAL_PURCHASE` from another user would no-op only if app_user_ids match.
- **iOS API key is empty string** — iOS path would silently fall back to no-RC mode when built.
- **RevenueCat SDK version** (`react-native-purchases` ^9.15.2) — any breaking change upstream can break the hook.
- **No receipt validation beyond RC** — trusting RevenueCat's server to have done server-side receipt validation. Correct, but worth naming.
- **No dunning flow** in the app — `BILLING_ISSUE_DETECTED` logs but user isn't notified in-app.
- **No server-side tier-limit enforcement** on rule/location count — a Premium user who has 900 rules and downgrades to Pro relies on `enforceTierLimits` being called client-side on next login. If they don't log in again, the excess rules keep polling until the next `enforceTierLimits` pass.

## Test Coverage
- `__tests__/services/subscriptionLogic.test.ts` — covers `determineAction` for every event type, including unknown events.
- `__tests__/services/purchases.test.ts` — validates `mapProductToTier` (including the `:monthly` variants), the determineTier-from-CustomerInfo fallback chain, and the API key selection per platform.
- `__tests__/data/tierLimits.test.ts` — asserts TIER_LIMITS values and snapshot.
- `__tests__/flows/tierEnforcement.test.ts` — store-level enforcement on downgrade + upgrade cycles.

**Verdict:** Pure logic is well-tested. The Edge Function webhook has no automated tests. The RLS-blocks-optimistic-sync gap is invisible to tests because tests mock Supabase away from real RLS. Real verification requires live purchase flow, which is only performed manually.
