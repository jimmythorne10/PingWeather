# Known Issues & Deferred Work

Running log of bugs found during device testing that aren't yet fixed,
plus infrastructure tasks we've intentionally pinned.

---

## Open Bugs

(none currently tracked — device verification pending for BUG-001 fix)

---

## Resolved

### BUG-001: Address/place search is cosmetic only ✅ FIXED (pending device verification)
**Discovered:** 2026-04-08
**Resolved:** 2026-04-08 in commit ae569f2
**Severity:** Medium
**Fix:** Built `src/services/geocoding.ts` (Open-Meteo Geocoding API, 25 unit tests) and `src/components/LocationSearchInput.tsx` (debounced search, results dropdown, race-condition guard). Wired into Locations tab and onboarding location setup. Both screens' cosmetic TextInputs replaced.
**Verified by:** Unit tests on the service layer (fetch mock, response parsing, error paths, query validation). UI behavior requires device test — Jimmy to confirm autocomplete actually renders and tap-to-select populates the form.

---

## Deferred Infrastructure

### INFRA-001: Maestro E2E testing
**Deferred:** 2026-04-08 — Jimmy doesn't have time for setup right now
**Why it matters:** jsdom + `@testing-library/react-native` tests are checking text presence, not real behavior. They missed:
- `onPress={() => {}}` no-ops on Home forecast card
- Tab label "Dashboard" vs "Home"
- Settings tab hidden from bottom bar
- Unmatched route on Forecasts tab detail view
- Forecast card collapsing on horizontal scroll drag
- Safe area overlap with status bar
- Tab bar not filling width
- This bug (address search field is cosmetic)

**When we pick this up:**
- Jimmy installs Maestro CLI via Git Bash: `curl -Ls "https://get.maestro.mobile.dev" | bash`
- Confirms `adb devices` works
- Picks Expo Go vs EAS dev build target
- Creates dedicated `maestro-test@truthcenteredtech.com` test account in Supabase
- I'll add `testID` props across the UI, write flows in `.maestro/`, and add an `npm run test:e2e` script

**Non-jsdom tests we CAN write today (pure logic):**
- Store actions (locationsStore, alertRulesStore, authStore)
- Evaluate-alerts engine logic
- Tier limits enforcement
- Data validation (legal content, presets, types)
- Dev account gate (`isDevAccount` — already covered)

### INFRA-002: pg_cron scheduled polling
**Deferred:** Needs manual enable + SQL setup in Supabase dashboard
**Status:** pg_cron extension enabled per Jimmy. Still need to write the schedule SQL for `poll-weather` Edge Function.

### INFRA-003: EAS development build for push notifications
**Deferred:** Not in scope until after core UX is stable
**Why:** Push notifications don't work in Expo Go. Requires Firebase project + `google-services.json` + `eas build --platform android --profile development`.

### INFRA-004: RevenueCat subscription wiring
**Deferred:** Paywall UI stub exists at `app/upgrade.tsx`. Subscribe buttons show "Coming Soon" alert.
**Next step:** Install `react-native-purchases`, configure products in Google Play Console + App Store Connect, wire `Purchases.purchasePackage()` into the subscribe handlers, add a Supabase Edge Function webhook endpoint for subscription status updates.
