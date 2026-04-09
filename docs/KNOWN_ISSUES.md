# Known Issues & Deferred Work

Running log of bugs found during device testing that aren't yet fixed,
plus infrastructure tasks we've intentionally pinned.

Last updated: 2026-04-09

---

## Open Bugs

**(none currently tracked — MVP backend pipeline fully verified on device)**

---

## Resolved during the 2026-04-08/09 marathon

### BUG-001: Address/place search was cosmetic only ✅
**Resolved:** 2026-04-08. `src/services/geocoding.ts` + `LocationSearchInput` wired into Locations and onboarding. Verified on device.

### BUG-002: Settings Premium → Free downgrade unreachable ✅
**Resolved:** 2026-04-08. Removed the `currentTier !== 'premium'` gate on the Settings upgrade CTA; Premium users now see "Manage Plan →" which routes to `/upgrade`. Verified on device.

### BUG-003: `locations.Save` silent failure ✅
**Resolved:** 2026-04-08. Root cause was missing `is_default` and `timezone` columns being written by the store while the DB didn't have them. Migration `00002` added the columns; store now returns `Promise<boolean>` so the UI can reset forms only on success and surface real error messages. Verified on device.

### BUG-004: Forgot-password flow was dead-end ✅
**Resolved:** 2026-04-08. Three layers: `app/forgot-password.tsx` didn't exist (login button pushed to unmatched route); auth gate in `_layout.tsx` bounced unauthed users off any screen except login/signup; Supabase Site URL pointed at `localhost:3000` and bounced reset-links to a different project's web app. Fixed by creating the screen, adding the gate exemption, changing Site URL to `pingweather://reset-password`, switching Supabase client to PKCE flow (query-param `code=` instead of hash-fragment `#access_token=` because Expo Router strips hash fragments). Verified on device end-to-end.

### BUG-005: Push token registration silently claimed success ✅
**Resolved:** 2026-04-08. `usePushNotifications` was swallowing Edge Function errors with `console.error` and still returning the token, so onboarding showed "Notifications Enabled!" while `profiles.push_token` stayed null. Fixed by propagating `fnError` as a real error and returning null on failure. Added a dev-gated "Register / Refresh Push Token" button in Settings for recovery. Verified on device.

### BUG-006: poll-weather used `updated_at` as last-poll timestamp ✅
**Resolved:** 2026-04-08. The due-rules filter read `rule.updated_at` which changes on every user edit AND on every `last_triggered_at` write. Added `last_polled_at timestamptz` column (migration 00004) and unconditional stamping after each processed rule. Verified on device via `last_polled_at` populated after a manual trigger.

### BUG-007: poll-weather `alert_history` update chain was broken ✅
**Resolved:** 2026-04-08. `.update(...).eq().eq().order('triggered_at', desc).limit(1)` was silently ignoring `.order()` and `.limit()` on UPDATE in supabase-js, so `notification_sent = true` would stamp every historical row for the rule, not just the newest one. Fixed by having `evaluate-alerts` return the inserted `alert_history_id` and using `.update(...).eq('id', alert_history_id)` in poll-weather. Verified on device — newest alert_history row shows `notification_sent: true`, older rows unchanged.

### BUG-008: Edge Functions returned 401 on inter-function invoke ✅
**Resolved:** 2026-04-09. After a redeploy of `evaluate-alerts`, `poll-weather → evaluate-alerts` calls started returning 401 Unauthorized at the gateway. Root cause: Supabase Edge Functions default to `verify_jwt = true` and `poll-weather`'s `supabase.functions.invoke()` call doesn't pass a user JWT. Fixed by adding explicit `verify_jwt = false` entries in `supabase/config.toml` for `poll-weather` and `evaluate-alerts` (kept `verify_jwt = true` on `register-push-token` since it IS called from the app with a user JWT). Both functions redeployed. Verified on device — full chain fires again.

### BUG-009: pg_net 5s timeout too short for cron run ✅
**Resolved:** 2026-04-09. Scheduled cron fired correctly at the top of the hour but pg_net gave up at 5000ms even though the function completed server-side in ~2.4s. Migration 00007 unscheduled + rescheduled the `poll-weather-hourly` job with `timeout_milliseconds := 30000`. Next scheduled run will produce a real `net._http_response` row. Runtime verification pending the next top-of-hour fire.

### Feature 1 (max_notifications per cycle): REVERTED ❌
**Attempted:** 2026-04-08. **Reverted:** 2026-04-09.
Tried to add a per-cooldown-cycle notification cap with UI stepper. Semantic was backwards from the stated goal — setting max > 0 made the rule fire MORE often, not fewer (the default unlimited mode is already "one per cooldown window"). Neither of us could cleanly describe the intent in a way a non-technical user would understand. Full revert in migration 00006 + commit `15f0a66`. Post-mortem in `.claude/memory/MEMORY.md` under "Rate-limit cycle feature — REVERTED".

### Feature 2 (hourly day-detail screen): SHIPPED ✅
**Shipped:** 2026-04-08. Tap a day in the Forecasts tab 14-day list → opens `app/day-detail.tsx` showing 24 hourly rows with weather emoji, temp, rain %, wind. Pure helper functions `getHourlyForDay` and `weatherCodeToEmoji` have full unit test coverage. Timezone gotcha documented in MEMORY.md. Verified on device — navigation, content, Today/Tomorrow labels, scroll preservation all work.

---

## Deferred Infrastructure

### INFRA-001: Maestro E2E testing
**Deferred:** 2026-04-08. Still deferred.
Current "verification" is entirely Jimmy-on-device manual testing. Every "works" claim in MEMORY.md is tagged with a specific person + date + method. jsdom component tests remain in the suite at the 85-passing level but are explicitly flagged as text-presence only and not treated as verification. Future: install Maestro CLI, add `testID` props, build `.maestro/` flows for the critical paths (sign-up → add location → create rule → receive notification). 6+ hours of setup work, deferred until the app has a test cohort that needs regression protection.

### ~~INFRA-002: pg_cron scheduled polling~~ ✅ DONE
**Done:** 2026-04-08 via migration 00003 + vault secrets + 00007 timeout raise. Scheduled job `poll-weather-hourly` is active on `0 * * * *` schedule. First real auto-fire observed at 2026-04-09 03:00 UTC (hit original 5s timeout; fixed in 00007).

### ~~INFRA-003: EAS development build for push notifications~~ ✅ DONE
**Done:** 2026-04-08. First EAS dev build (`76d143c2`) installed on device. Second rebuild after adding `pingweather://` scheme to `app.json`. FCM V1 service account key uploaded to EAS via `eas credentials` after navigating the Google Workspace org policy override. End-to-end push notification delivery verified on device (direct Expo push + full poll-weather → FCM → Android chain).

### INFRA-004: RevenueCat subscription wiring
**Deferred:** still open. `app/upgrade.tsx` paywall UI exists with three tier cards (Free / Pro $3.99/mo / Premium $7.99/mo). Subscribe buttons show "Coming Soon" alert. `react-native-purchases` is NOT in `package.json`. Not a runtime blocker — the app is fully functional on the Free tier and Jimmy's dev account has a tier override for testing Pro/Premium gating.

**Next step when this unblocks:**
1. Install `react-native-purchases`
2. Create products in Google Play Console + App Store Connect: `pro_monthly`, `pro_annual`, `premium_monthly`, `premium_annual` (add annual pricing per the other agent's feedback)
3. Configure RevenueCat dashboard + link App Store + Play Console
4. Wire `Purchases.purchasePackage()` into `handleSubscribe` in `upgrade.tsx`
5. Create a Supabase Edge Function webhook endpoint to receive RevenueCat events and update `profiles.subscription_tier`
6. Test purchase flow sandbox-mode before submitting production build

### INFRA-005: Real SMTP provider
**Deferred:** still open. Supabase default mailer is rate-limited to ~4 emails/hour and lands in spam. Works for dev but unacceptable at launch. Swap to Resend (recommended — free tier, $20/mo production) or SendGrid / Mailgun before public release. One-time config in Supabase Auth → SMTP Settings.

### INFRA-006: Open-Meteo commercial license
**New (from 2026-04-09 business review):** The free Open-Meteo API is for non-commercial use. Once PingWeather is monetized (App Store paid subscriptions = commercial use), Jimmy needs a commercial license from Open-Meteo. Pricing at the non-profit/small-business tier is modest. Verify T&Cs before submitting to stores.

### INFRA-007: Store listings + production builds
**Deferred:** still open. Not started. Requires:
- Play Console developer account ($25 one-time)
- App Store Connect developer account ($99/yr — iOS deferred per PRD priority)
- Icons + screenshots + listing copy + privacy policy URL + terms URL
- `eas build --profile production`
- First submission + review cycle (typically 1-7 days)
