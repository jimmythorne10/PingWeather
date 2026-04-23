# Jimmy handoff — current state

Last updated: 2026-04-23

---

## What is DONE — do not re-propose any of this

### Backend pipeline
- Full chain verified on device: `pg_cron → poll-weather → evaluate-alerts → Expo push → FCM V1 → Android`
- Schema: migrations 00001–00011 applied to live Supabase
- Edge Functions deployed: poll-weather, evaluate-alerts, register-push-token, send-digest, fcm-keepalive, delete-account, subscription-webhook
- Vault: poll_weather_service_role_key, poll_weather_function_url, OPEN_METEO_API_KEY, REVENUECAT_WEBHOOK_SECRET

### Monetization
- RevenueCat Android: `goog_XykDmtoZwUNDfBgswNJaIkDLjNC`, Play Console products created (pro_monthly $3.99, premium_monthly $7.99), entitlements configured, webhook verified
- Open-Meteo commercial: $29/mo, poll-weather uses commercial endpoint, weatherApi.ts updated to use commercial endpoint via `EXPO_PUBLIC_OPEN_METEO_API_KEY`

### Compliance
- Privacy policy live: `truthcenteredtech.com/pingweather-privacy`
- Account deletion: Edge Function + Settings UI (Google Play requirement)
- ACCESS_BACKGROUND_LOCATION removed

### Distribution
- Apple Developer Program: enrolled (unblocked 2026-04-23)
- Play Store: internal testing LIVE (build: preview AAB, autoIncrement from versionCode 3)

### Features shipped to main
- Forecast digest (daily/weekly notification with weather summary)
- FCM keepalive (silent daily push to keep Android in active standby)
- Battery optimization onboarding (Android: Unrestricted; iOS: Background App Refresh)
- 14-day forecast: weather icons, column headers, wind direction
- Temperature unit server sync

---

## What still gates Android production

| Blocker | Owner | Notes |
|---|---|---|
| `EXPO_PUBLIC_OPEN_METEO_API_KEY` EAS env var | Jimmy | Run `eas env:create` for preview + production. Required for next build to use commercial endpoint client-side |
| Closed testing (12+ testers, 14 days) | Jimmy | Start the clock NOW — every day not started is a day of delay |
| Store listing complete | Jimmy | Check Play Console → Store presence — screenshots, description, content rating |

---

## What still gates iOS

| Blocker | Notes |
|---|---|
| APNs Auth Key (p8) | developer.apple.com → Keys → + (type: APNs) |
| App Store Connect app | appstoreconnect.apple.com → Apps → + (bundle: com.truthcenteredtech.pingweather) |
| ASC App ID + Team ID | Fill into eas.json placeholders |
| RevenueCat iOS app | app.revenuecat.com → get `appl_*` key → EAS env var |
| iOS products in ASC | pro_monthly, premium_monthly, pro_annual, premium_annual |

Full iOS milestone plan: `docs/ios-roadmap.md`

---

## Deferred (post-launch, non-blocking)

- Real SMTP via Resend (INFRA-005) — Supabase mailer acceptable short-term
- Maestro E2E suite (INFRA-001) — Jimmy verifies on device for now
- Annual pricing tier (pro_annual, premium_annual)
- RevenueCat iOS (blocked on Apple M0)

---

## Go-to-market path

**Android (do now):**
1. Add `EXPO_PUBLIC_OPEN_METEO_API_KEY` EAS env var
2. Recruit 12-20 testers (friends, family, farming/hunting communities)
3. Move to Closed Testing → start 14-day clock
4. Promote to Production

**iOS (after Android is stable):**
1. Complete M0 (APNs key, ASC app, RevenueCat iOS) — see ios-roadmap.md
2. `eas build --platform ios --profile development` (device build, no simulator)
3. TestFlight → Apple Review (24–72 hrs)

**Channels for testers/launch:**
- Facebook farming/ranching/hunting groups
- r/betatesting, r/farming, r/homesteading, r/hunting
- LinkedIn personal network
- Local agricultural community contacts
- Lead with a concrete use case: "frozen water trough alert", "frost warning", "cold front for hunting"

---

## If you're picking this up fresh

1. Read `.claude/memory/MEMORY.md` — authoritative state
2. Read `docs/KNOWN_ISSUES.md` — bug history + deferred infra
3. Read `CLAUDE.md` — project overview and critical rules
4. Check recent `git log` — commits tell the full story
5. **Do not re-propose anything in the "DONE" section above.**
