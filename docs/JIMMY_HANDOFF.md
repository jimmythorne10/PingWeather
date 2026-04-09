# Jimmy handoff — current state

Last updated: 2026-04-09 after the marathon session.

This used to be a "what Jimmy still has to do" checklist. Most of that list
is now complete. This doc now tracks **what's actually left before ship** so
any agent / person picking up the project has a current picture.

---

## MVP backend pipeline — DONE

Fully verified on device (Jimmy, 2026-04-08/09):

- EAS dev build installed on Android phone, package `com.truthcenteredtech.pingweather`
- Auth (sign-up, sign-in, forgot-password via PKCE deep link)
- Onboarding + notification permission prompt
- Location add with geocoding search
- Settings: tier override (dev-gated), theme, units, Premium→Free downgrade
- Push token registration (dev-gated Settings button)
- Direct Expo push → FCM V1 → Android notification
- `poll-weather` → `evaluate-alerts` → phone buzz (full chain)
- Bug A fix: `last_polled_at` stamping
- Bug B fix: PK-targeted `alert_history.notification_sent` update
- pg_cron scheduled auto-fire at top of hour (first observed 2026-04-09 03:00 UTC)
- Day-detail hourly screen (tap a day in Forecasts → hourly breakdown with weather icons)

Supabase schema at migration 00007. Vault has `poll_weather_service_role_key`
and `poll_weather_function_url`. Cron job `poll-weather-hourly` active with
30s pg_net timeout.

---

## Still open before shipping

These are in rough priority order for "what gates a store submission".

### 1. RevenueCat wiring (monetization)
`app/upgrade.tsx` shows a paywall but Subscribe buttons are stubs. Without
this the app can't charge anyone. Roughly a day of work once Play Console
products are created.

See `docs/KNOWN_ISSUES.md` → INFRA-004 for the step list.

### 2. Real SMTP provider (forgot-password UX)
Supabase default mailer is ~4 emails/hour and spam-prone. Fine for dev,
unacceptable at scale. Resend setup is about 30 minutes if you own the
domain (truthcenteredtech.com is already yours).

See INFRA-005.

### 3. Open-Meteo commercial license
Free tier is non-commercial use only. Paid subscriptions = commercial.
Grab the license before first production submission. Low cost, short form.

See INFRA-006.

### 4. Store listings + production build
Icons, screenshots, privacy policy URL, terms URL, listing copy, `eas build
--profile production`, submit. 1-2 days of work plus review time.

See INFRA-007.

### 5. Annual pricing tier (business model)
Currently only monthly ($3.99 Pro / $7.99 Premium). Add annual variants
with ~15% discount — standard SaaS pattern, improves LTV and cash flow.
Covered by the RevenueCat wiring step above.

### 6. Maestro E2E regression suite
Every current "works" claim is Jimmy-on-device manual testing. That doesn't
scale past the first 3-4 users. Before adding more features or a test
cohort, invest 6 hours in Maestro setup + critical-path flows.

See INFRA-001.

---

## Device verification backlog — none outstanding

Everything I've written code for has been verified on device as of this
session. Next time you add something, queue the verification steps here.

---

## If you're picking this up fresh

1. Read `.claude/memory/MEMORY.md` — that's the authoritative state
2. Read `docs/KNOWN_ISSUES.md` — has the full bug history + deferred infra
3. Read `CLAUDE.md` — project overview
4. Look at recent git log — the commits since `6af583b` tell the full story
5. If a memory entry claims something is "verified on device", trust it.
   If it says "NOT yet verified", that's an honest open question.

The first thing any fresh agent should do is NOT re-propose work that's
already done. The other agent that reviewed this project on 2026-04-09
read the then-stale docs and confidently listed "Supabase URL config",
"APK rebuild", and "pg_cron vault secrets" as blockers. Those were all
done the day before. Don't repeat that mistake.
