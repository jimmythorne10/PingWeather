# PingWeather Security & Code Quality Audit

**Date:** 2026-04-24
**Auditor:** Automated code review (Claude Opus)
**Scope:** Full codebase — React Native / Expo client, Supabase Edge Functions (Deno), PostgreSQL schema, RLS policies, build and OTA configuration.

## Executive Summary
- **0 Critical** findings. No secret exposure in committed code; server-side functions authenticate; RLS is on every table; commercial Open-Meteo key now lives server-side (post migration 00013–00016 and `get-forecast` Edge Function deploy).
- **3 High** findings. The optimistic client-side tier sync after purchase is silently blocked by RLS (functional + product risk). FCM keep-alive and push-dispatch logic never prune invalid tokens (operational risk). `notifications_sent` is updated outside any transaction, so a push failure after `evaluate-alerts` already stamped `last_triggered_at` can consume a cooldown without actually delivering the notification.
- **7 Medium + 12 Low** findings. A cluster of SoC violations (UI screens reimplementing simplified weather engines, stores reaching through to Supabase directly) and best-practice deviations (silent catches that hide real errors, fraudulent-flagged jsdom tests, missing E2E coverage). None are actively exploitable but several hide real behavior from tests.
- **Overall risk rating: moderate** for an MVP shipping to a small internal-testing cohort. Not production-ready at scale until the High findings are closed and at least one E2E verification path (Maestro) is stood up.

---

## Critical Issues

*None found.*

---

## High Severity Issues

### H01 — Client-side optimistic tier sync is silently blocked by RLS
- **File / lines:** `src/services/purchases.ts` lines 266-277 (`syncTierToSupabase`); `supabase/migrations/00013_security_rls_fixes.sql` lines 21-27.
- **Issue:** After a successful RevenueCat purchase or restore, `purchases.ts` calls `supabase.from('profiles').update({ subscription_tier: tier }).eq('id', user.id)` using the user's JWT. Migration 00013 added a `WITH CHECK (auth.uid() = id and subscription_tier = (select subscription_tier from public.profiles where id = auth.uid()))` clause to the `Users can update own profile` policy. That `WITH CHECK` rejects any UPDATE whose new `subscription_tier` differs from the currently stored value — exactly the case this code targets. The call is wrapped in a try/catch that logs via `console.error`. The UI never knows the sync failed; the user sees "Welcome to PingWeather Pro!" while the DB still shows `free`.
- **Exploit scenario / impact:** No exploit. Impact is functional: the user's tier only becomes `pro`/`premium` when the `subscription-webhook` arrives seconds to minutes later. Tier-gated UI (lock icons, limits) will keep looking free until the next `fetchProfile()` picks up the webhook-driven update. If the webhook fails, the user paid but got no product.
- **Recommended fix:** Either (a) remove the client-side sync entirely and rely solely on the webhook + a `fetchProfile()` retry cycle, with a visible "Finalizing your plan..." state, or (b) add a dedicated service-role Edge Function (`sync-purchase-tier`) that the client invokes with its JWT after a successful purchase, and which validates the RevenueCat customer info server-side before writing.

### H02 — Stale Expo push tokens are never invalidated
- **File / lines:** `supabase/functions/poll-weather/index.ts` lines 83-111 (`sendPushNotification`); `supabase/functions/fcm-keepalive/index.ts` lines 24-44 (`sendBatch`); no cleanup function exists anywhere.
- **Issue:** When Expo's push service returns a non-2xx response for a stale / unregistered / invalid token, both functions log the failure but leave `profiles.push_token` untouched. Every subsequent poll (hourly) and every keepalive run (daily) keeps attempting the dead token. Expo's actual response body contains a `details.error` field indicating `DeviceNotRegistered`, `MessageTooBig`, etc. — this is not parsed.
- **Impact:** Operational noise (error logs grow), wasted Edge Function runtime, and — at scale — eventual throttling of the project's Expo push quota. For the affected user, all future notifications silently fail.
- **Recommended fix:** In both functions, parse the Expo push response body; on `DeviceNotRegistered` specifically, null the `push_token` column for that profile. Optionally, implement Expo's receipts flow (check receipts an hour after send) for a more robust cleanup.

### H03 — `last_triggered_at` is stamped before push succeeds; failed pushes burn cooldowns
- **File / lines:** `supabase/functions/evaluate-alerts/index.ts` lines 104-112; `supabase/functions/poll-weather/index.ts` lines 339-357.
- **Issue:** `evaluate-alerts` writes `alert_rules.last_triggered_at = evalNow` for every triggered rule before returning. `poll-weather` then attempts Expo push dispatch. If the push fails (network, invalid token, Expo downtime), there is no rollback — the rule's cooldown has already been consumed. The user never got notified but the rule won't fire again for `cooldown_hours`.
- **Impact:** Real missed alerts in failure scenarios. A user whose token is temporarily unregistered and then re-registered would miss a freeze warning with no indication anything went wrong. The `alert_history` row exists with `notification_sent: false`, which is the only trace.
- **Recommended fix:** Move the `last_triggered_at` UPDATE from `evaluate-alerts` to `poll-weather` and perform it only for rules whose push dispatch succeeded (or whose dedup skip was intentional). Alternatively, add a "last_notified_at" column distinct from `last_triggered_at` and use that for cooldown math — so we can observe triggers vs. actual notifications and retry failed pushes on subsequent cycles.

---

## Medium Severity Issues

### M01 — Server digest uses hardcoded `mph` regardless of user preference
- **File / lines:** `supabase/functions/send-digest/index.ts` line 162; client-side reference `src/services/digestFormatter.ts` lines 28-32 has the correct multi-unit logic.
- **Issue:** The server's `formatDigest` always concatenates ` mph wind` to the notification body. The client formatter respects `windSpeedUnit: 'mph' | 'kmh' | 'knots'` but it is not used server-side.
- **Impact:** Users who set km/h or knots see a °C (or °F) + mph mixed digest. Mild UX papercut; becomes a real issue in markets like AU/NZ/EU.
- **Fix:** Port the `formatWind` logic from `src/services/digestFormatter.ts` into `send-digest/index.ts`, or extract to a shared module readable by Deno.

### M02 — `profiles.push_token` is a single-valued column (one device per user)
- **File / lines:** `supabase/migrations/00001_initial_schema.sql` line 20.
- **Issue:** `push_token text` on profiles. Signing in on a second device overwrites the first device's token. Expo / FCM tokens are per-device; only the most-recently-registered device ever receives notifications.
- **Impact:** A user with a phone + tablet installs only delivers to the device they last registered from. If they alternate, notifications follow whichever was registered last.
- **Fix:** Normalize into a `push_tokens` table with `(user_id, token, platform, created_at)`. Poll/digest dispatch iterates tokens per user.

### M03 — `ruleWouldTrigger` preview on Forecasts screen silently ignores most metrics
- **File / lines:** `app/(tabs)/forecasts.tsx` lines 100-140.
- **Issue:** The local "Rule Status" preview only checks `temperature_high`, `temperature_low`, `precipitation_probability`, `wind_speed`. Rules using `humidity`, `feels_like`, `uv_index`, or `temperature_current` always show "Clear" even when they'd trigger.
- **Impact:** Misleading UI. A user with a "UV > 8" rule sees "Clear" even when the server is about to fire them a notification.
- **Fix:** Either replace the inline function with `evaluateRule` from `src/utils/weatherEngine.ts` (which covers all metrics) or remove the preview entirely. The inline re-implementation is pure SoC violation (see V01).

### M04 — Generic error fallback in `alertHistoryStore.loadHistory` hides real errors
- **File / lines:** `src/stores/alertHistoryStore.ts` lines 28-31.
- **Issue:** Unlike `alertRulesStore` / `locationsStore` (which were updated per `FIX 4` comments to surface real error messages), `alertHistoryStore.loadHistory` still sets `error: 'Failed to load alert history'` regardless of the underlying cause.
- **Impact:** Debugging an RLS change or schema drift is harder — the user and Jimmy both see the same opaque message whether it's a 403 or a timeout.
- **Fix:** Mirror the pattern from the other stores: `const message = err instanceof Error ? err.message : 'Failed to load alert history'; set({ ..., error: message })`.

### M05 — `addNotificationResponseReceivedListener` is inert — tapping a notification doesn't deep-link
- **File / lines:** `src/hooks/usePushNotifications.ts` lines 131-134.
- **Issue:** The listener is registered but its callback is a no-op. The comment says "Future: navigate to the alert's rule detail via response.notification.request.content.data.rule_id". `poll-weather` does include `data: { rule_id }` in every push.
- **Impact:** User taps a "Freeze Warning" notification → app opens to Home screen. They have to hunt for the rule manually.
- **Fix:** Implement navigation inside the response listener, using `router.push(\`/create-rule?mode=edit&ruleId=${rule_id}\`)`.

### M06 — No rate limiting / account lockout on failed login
- **File / lines:** `app/login.tsx` lines 14-17; `src/stores/authStore.ts` lines 90-101.
- **Issue:** Users can submit `signIn(email, password)` repeatedly. Supabase has its own server-side throttle but there is no client-side debounce, CAPTCHA, or lockout UI.
- **Impact:** Limited — Supabase rate-limits at the auth endpoint — but there is no user-visible signal when the throttle kicks in (they just see repeated "Invalid credentials").
- **Fix:** Add a per-device attempt counter + back-off delay for repeated failures, and surface the Supabase rate-limit error distinctly.

### M07 — `forecast_cache` is readable by all authenticated users, never expired or sized
- **File / lines:** `supabase/migrations/00012_forecast_cache.sql` lines 18-20; `supabase/functions/poll-weather/index.ts` lines 152-162 (upsert).
- **Issue:** Any authenticated user can SELECT any row from `forecast_cache` via the policy `auth.role() = 'authenticated'`. No TTL or size cap. The table grows unbounded (one row per 0.1° grid ever polled).
- **Impact:** Minor information leak — a user can enumerate grid keys to see which ~11km squares other users have in active rules. Low data-sensitivity, but an unintended signal. Storage grows indefinitely; no cleanup job exists.
- **Fix:** Add a cron job deleting `forecast_cache` rows older than 6 hours. Limit the policy to `service_role` reads only — clients don't read this table (only the server-side `send-digest` does).

### M08 — Server functions invoked via `supabase.functions.invoke` from inside Deno use the user JWT context confusingly
- **File / lines:** `supabase/functions/poll-weather/index.ts` lines 179-185.
- **Issue:** `poll-weather` creates a service-role Supabase client and uses it for DB operations, then calls `supabase.functions.invoke('evaluate-alerts', ...)`. The `invoke` inherits the client's `Authorization` header — service role. This works, but the bearer check in `evaluate-alerts` requires `authHeader === "Bearer " + SUPABASE_SERVICE_ROLE_KEY` exactly. Any change to the client library's header-generation logic would silently 401 the cross-function call with no alert.
- **Impact:** Fragile integration. No test covers this contract; failure mode is a silent break in the alert pipeline.
- **Fix:** Either add an explicit `headers: { Authorization: \`Bearer ${serviceRoleKey}\` }` on the invoke call (self-documenting), or create a private wrapper that asserts the expected header.

---

## Low Severity Issues

### L01 — `react-native-url-polyfill/auto` is side-effect-imported
- **File / lines:** `src/utils/supabase.ts` line 1.
- **Issue:** Works correctly; simply worth naming because disabling tree-shaking of that import would silently break the Supabase client URL parsing. No known active issue.
- **Fix:** None needed; document in developer onboarding.

### L02 — `SUPABASE_SERVICE_ROLE_KEY` string-comparison auth is timing-safe only by accident
- **File / lines:** `supabase/functions/evaluate-alerts/index.ts` line 34; `poll-weather/index.ts` line 221; `subscription-webhook/index.ts` line 71.
- **Issue:** All three use `===` for bearer comparison against an env var. No `crypto.timingSafeEqual` wrapping. V8 may short-circuit on first mismatched byte in theory.
- **Impact:** Theoretical timing-side-channel; Expo Push Service and RevenueCat don't use these functions as attack vectors, so the realistic risk is near zero. Still a best-practice deviation.
- **Fix:** Replace with a constant-time comparison helper.

### L03 — `app.json` contains the RevenueCat Android public API key in `extra`
- **File / lines:** `app.json` line 75 (`"revenueCatAndroidApiKey": "goog_..."`).
- **Issue:** Public keys are safe to embed, but they're embedded in both source control AND the built APK. If a future plugin accidentally copies `extra` to logs, the key leaks.
- **Impact:** Minimal — RevenueCat's design is that these keys are public. Mainly a hygiene note.
- **Fix:** Consider moving to `EXPO_PUBLIC_REVENUECAT_API_KEY` env var and keeping `extra.revenueCatAndroidApiKey` out of the committed `app.json`.

### L04 — `src/services/weatherApi.ts` file header comments still reference post-deploy steps
- **File / lines:** lines 1-20.
- **Issue:** The top-of-file comment block documents manual steps Jimmy needs to perform (key rotation, EAS env deletion). Correct instructions, but the comments remain even after deploy is complete. Future contributors might re-do the steps.
- **Fix:** Move rotation-runbook to a `docs/operations/` file and shorten the source comment to "See docs/operations/open-meteo-rotation.md".

### L05 — Onboarding advances even if profile write fails
- **File / lines:** `app/onboarding/eula.tsx` lines 12-18; `complete.tsx` lines 11-16.
- **Issue:** `updateProfile` errors are silently absorbed into `authStore.error`. The screens don't check the return and push to the next route regardless.
- **Impact:** On a flaky network during onboarding, `eula_accepted_version` or `onboarding_completed` may not be written, but the user lands in the app. The next cold start re-routes them to onboarding (auth-gate logic), looking like a bug.
- **Fix:** Await the update, check store error state, and show an inline retry if non-null.

### L06 — `home.tsx` silent-fails forecast load
- **File / lines:** `app/(tabs)/index.tsx` lines 55-58.
- **Issue:** `try / catch { /* fail silently */ }`. User sees "Unable to load weather data." with no retry button or diagnostic.
- **Fix:** Surface the error message; add a "Retry" button.

### L07 — `weatherApi.fetchForecast` throws on error but some callers assume shape
- **File / lines:** `src/services/weatherApi.ts` line 72; `day-detail.tsx` lines 55-64 (caller catches; fine). `forecasts.tsx` line 53 (caller catches silently; acceptable). `home.tsx` silent (L06).
- **Issue:** Consistent behavior across callers, inconsistent surfacing.
- **Fix:** Centralize the "silent-fail vs display" decision in the service layer by returning `Result<ForecastResponse, string>` instead of throwing.

### L08 — `alert_history` has no user-facing delete UI despite RLS policy permitting it
- **File / lines:** `supabase/migrations/00015_alert_history_improvements.sql` lines 40-42 adds the DELETE policy; no UI consumes it.
- **Impact:** Dead DB policy; could lead to a GDPR finding if someone expects the policy implies functionality.
- **Fix:** Either remove the policy or expose a "Clear history" button in Settings.

### L09 — `subscription-webhook` auth accepts a raw bearer equal to `REVENUECAT_WEBHOOK_SECRET` with no HMAC over body
- **File / lines:** `supabase/functions/subscription-webhook/index.ts` lines 66-79.
- **Issue:** RevenueCat's HMAC-SHA256 header verification (over the raw body) is not performed. If the shared secret leaks, an attacker with any trace of the secret can forge events. HMAC-over-body would prevent replay of a captured valid event against a different user.
- **Fix:** Adopt RevenueCat's HMAC verification: compute `hmac('sha256', WEBHOOK_SECRET, rawBody)` and compare against the `X-RevenueCat-Signature` header.

### L10 — Fraudulent-flagged jsdom screen tests run alongside the real test suite
- **File / lines:** `package.json` lines 60-108 (Jest `components` project); `__tests__/screens/*.tsx`.
- **Issue:** Per the project's Testing Contract, these tests are "text-presence only, not behavior" and must not be cited as verification. They still contribute to the global pass count, blurring the line between real and fake coverage.
- **Fix:** Either move them to a `.skip.test.tsx` suffix, rename the project to `components-smoke`, or mark each test with a `describe.skip` + a comment, and make `npm test` produce separate exit codes per project.

### L11 — No logs for dev-tier-override writes
- **File / lines:** `app/(tabs)/settings.tsx` lines 112-117.
- **Issue:** The dev account can flip tiers via the UI (currently likely blocked by RLS, F15 gap). Even once working, the action is not audited anywhere.
- **Fix:** Route dev tier changes through an audit-logged Edge Function so dashboards can trace who set what when.

### L12 — `signOut` swallows errors and clears state regardless
- **File / lines:** `src/stores/authStore.ts` lines 128-137.
- **Issue:** Intentional: on a network failure we still want the user's local session cleared. But a Supabase error here (e.g., invalidating tokens server-side failed) is swallowed. If the JWT remained valid server-side, an attacker with the old JWT could keep reading data until natural expiry.
- **Fix:** Log the server-side error to a monitoring tool. Continue to clear local state (current behavior is correct on balance).

---

## Separation of Concerns Violations

### V01 (High) — Forecast screen reimplements a simplified weather engine inline
- **File / lines:** `app/(tabs)/forecasts.tsx` lines 100-140 (`ruleWouldTrigger`).
- **Layer drift:** A `(tabs)` screen is a presentation component. Condition evaluation logic belongs in `src/utils/weatherEngine.ts` (or at worst a new `src/services/ruleStatus.ts`).
- **Why problematic:** Duplicated logic drifts (only 4 metrics covered vs. 8 in the engine — see M03). No tests cover the inline version. Future engine changes don't reach the preview.
- **Refactor:** Call `evaluateRule` from `src/utils/weatherEngine.ts` with the already-fetched forecast. Requires adapting the forecast shape (client's ForecastResponse vs. engine's ForecastData are nearly identical — normalize in a helper).

### V02 (Medium) — Zustand stores talk to Supabase directly; there is no service / repository layer for alert rules, locations, or history
- **File / lines:** `src/stores/alertRulesStore.ts`, `locationsStore.ts`, `alertHistoryStore.ts` — all import `supabase` from `src/utils/supabase.ts` and run queries inline.
- **Layer drift:** The "Services" folder exists (`weatherApi.ts`, `geocoding.ts`, `purchases.ts`) but it's used only for external API clients. Internal data-access is embedded in stores.
- **Why problematic:** Swapping Supabase for another backend (or mocking it cleanly for tests) requires touching every store. Business logic (tier enforcement in `createRule`) sits beside data-access code, violating single responsibility.
- **Refactor:** Introduce `src/repositories/alertRulesRepo.ts` etc. with pure CRUD functions returning `Result<T, Error>`. Stores orchestrate the repos but don't know about Supabase specifics.

### V03 (Medium) — Auth store reaches sideways into settings store
- **File / lines:** `src/stores/authStore.ts` lines 155-164 (lazy import of settingsStore inside fetchProfile).
- **Layer drift:** Two sibling stores are coupled via a runtime circular-dependency workaround. The comment documents this ("auth → settings is safe; settings → auth would cycle"), but the underlying coupling is a smell.
- **Why problematic:** Testing fetchProfile requires mocking the settings store. The coupling is invisible in the type graph because it's a dynamic import.
- **Refactor:** Introduce a preferences bootstrapper that both stores subscribe to, or emit a profile-fetched event and let settings store listen.

### V04 (Medium) — Digest formatter logic lives in two places with divergent implementations
- **File / lines:** `src/services/digestFormatter.ts` (client); `supabase/functions/send-digest/index.ts` lines 146-179 (server).
- **Layer drift:** Pure formatting logic should be in `supabase/functions/_shared/` (next to `weatherEngine.ts`), not duplicated.
- **Why problematic:** M01 exists because the server copy drifted from the client copy. Tests cover the client copy only. Any behavior claim made based on `digestFormatter.test.ts` is false for server-produced notifications.
- **Refactor:** Move the formatter to `_shared/digestFormatter.ts` and import from both sides (Edge Function via relative path, Jest via TypeScript resolver — same pattern as `weatherEngine.ts`).

### V05 (Low) — UI screens consume `TIER_LIMITS` directly to decide button visibility
- **File / lines:** `app/(tabs)/alerts.tsx` lines 31-33, 67-77; `locations.tsx` lines 33-38; `create-rule.tsx` lines 59-61, 110-113, 346.
- **Layer drift:** Business rule ("can this user add another rule?") leaks into multiple screens.
- **Why problematic:** Changing limit semantics (e.g., adding a grace period) requires touching every screen.
- **Refactor:** Centralize in a `src/services/entitlements.ts` with `canAddRule(tier, currentCount)`, `canAddLocation(...)`, etc. Screens call those functions.

### V06 (Low) — `_layout.tsx` handles OTA update checks, auth initialization, RevenueCat login, deep-link routing, and status-bar config
- **File / lines:** `app/_layout.tsx` — whole file.
- **Layer drift:** Root layout has at least five distinct responsibilities.
- **Why problematic:** Change to any one requires understanding all. Error from any silently affects others (e.g., OTA check timing changes delay auth init).
- **Refactor:** Extract `useOtaUpdate()` hook, keep `initialize` + auth-state reaction in a dedicated `useAuthGate()` hook, and let the component be a thin composition.

---

## Best Practice Deviations

### D01 (High) — Fraudulent-flagged tests are not segregated from real tests
See L10. Separating out the "smoke" project in package.json would prevent anyone from claiming green on "all tests pass" as evidence of behavior.

### D02 (High) — No E2E / device verification automation
Per the project's own Testing Contract, "Jimmy on device" is currently the only accepted UI verification. Deferred (INFRA-001). This is a process-hardening gap, not a code bug.

### D03 (Medium) — Silent catches ("fail silently") in multiple forecast fetch paths (L06, L07)
Observability is poor. A real outage can be mistaken for "just no data to show".

### D04 (Medium) — `try / catch` blocks commonly set `state.error` without a user-visible surface
`authStore.updateProfile` sets `state.error = 'Failed to update profile'`; Settings does not render this error. Similarly `deleteRule` and `toggleRule` set error but the list screen doesn't prominently display it.

### D05 (Medium) — `setHours` mutation pattern in `day-detail.tsx` formatDayLabel relies on local-timezone date construction
`const target = new Date(y, m-1, d); today.setHours(0,0,0,0); tomorrow.setDate(...)`. Correct for today/tomorrow matching; mutating `today` after use makes the code harder to read. Consider returning a helper that returns the enum `{Today, Tomorrow, Other}`.

### D06 (Medium) — `FOR ALL` / `USING(true)` policy was shipped once on `forecast_cache` before being removed in migration 00013
Historical — mentioned because it demonstrates the danger of broad RLS policies in early schemas. Current state is correct, but worth a mention in the audit trail.

### D07 (Medium) — `subscription-webhook` ACKs 200 on every failure including internal DB errors
Pragmatic (prevents retry storms) but means operational errors are invisible to RevenueCat's dashboard. Combine with alerting on structured log output to compensate.

### D08 (Low) — Inline magic numbers: 100 (history limit), 500 (page size), 10 (concurrency), 14 (forecast days)
Scattered; should be named constants in a config module.

### D09 (Low) — Store `partialize` omits loading/error as intended, but the persisted keys still use `weatherwatch-*` rather than `pingweather-*`
Not a functional issue. Changing the keys would wipe users' cached state on upgrade, so there's a backwards-compat reason. Worth a comment.

### D10 (Low) — `Home` screen's pull-to-refresh doesn't re-fetch the forecast when no location change has occurred
`fetchWeatherForLocation` is in the `Promise.all` but it doesn't force a cache-bust on `forecasts` state. On first pull, the forecast is fetched fresh; on subsequent pulls within the session with same unit preferences, it may refetch anyway. Verify.

### D11 (Low) — `temperature_current` metric name is misleading
The engine's `temperature_current` actually reads the `hourly.temperature_2m` array across the lookahead window — it's not "the current moment's temperature", it's "hourly temps during the lookahead". Rename to `temperature_hourly` for clarity or add a doc-comment.

### D12 (Low) — Condition `eq` operator on floating-point values is likely to never match
See F04 gaps. Should be explicitly disallowed in the UI or converted to a "within epsilon" comparison.

---

## Recommended Priority Order (Top 10)

1. **H01** — Fix the optimistic tier-sync so a purchase actually updates the DB (service-role Edge Function or webhook-only model with UI "finalizing" state). Blocks production billing flow.
2. **H02** — Prune invalid push tokens in `poll-weather` and `fcm-keepalive`. Blocks reliable notifications at any non-trivial user count.
3. **H03** — Stop consuming cooldown on failed push; introduce `last_notified_at` column.
4. **M01 / V04** — Port digest formatter to `_shared/` and wire both client + server to the same code path. Eliminates °C + mph mixed digest bug.
5. **V01 / M03** — Replace `forecasts.tsx` inline `ruleWouldTrigger` with `evaluateRule` from `weatherEngine.ts`. Fixes rule-preview accuracy for 4 of 8 metrics.
6. **M04** — Surface real error messages in `alertHistoryStore.loadHistory`.
7. **M05** — Wire the notification-tap handler to deep-link into the rule edit screen.
8. **D01 / L10** — Segregate fraudulent-flagged tests so "tests pass" is honest.
9. **M07** — Add TTL cleanup for `forecast_cache`, tighten its SELECT policy to `service_role` only.
10. **L09** — Add HMAC-over-body verification on the RevenueCat webhook before broadening user count.
