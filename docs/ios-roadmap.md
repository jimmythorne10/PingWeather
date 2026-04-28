# iOS Roadmap — PingWeather

Branch: `feature/ios-support`
Target: Full App Store submission parity with Android

---

## Milestone 0 — External Prerequisites (Jimmy only, no code)

These block everything else. Do them before touching EAS.

| # | Task | Where | Status |
|---|------|--------|--------|
| 0.1 | Confirm Apple Developer Program enrollment ($99/yr) | developer.apple.com/account | [ ] |
| 0.2 | Create APNs Auth Key (p8) — type "Apple Push Notifications service (APNs)" | developer.apple.com → Keys → + | [ ] |
| 0.3 | Note down: Key ID, Team ID from the Apple Developer portal | developer.apple.com → Membership | [ ] |
| 0.4 | Create app in App Store Connect with bundle ID `com.truthcenteredtech.pingweather` | appstoreconnect.apple.com → Apps → + | [ ] |
| 0.5 | Note the **ASC App ID** (10-digit number shown in App Store Connect URL) | App Store Connect → App → General → App Information | [ ] |
| 0.6 | Create **App Store Connect API Key** for EAS submit (Role: App Manager or Admin) | App Store Connect → Users & Access → Keys → + | [ ] |
| 0.7 | Create RevenueCat iOS app — get `appl_*` API key | app.revenuecat.com → New App → Apple App Store | [ ] |
| 0.8 | Create iOS products in App Store Connect matching Android: `pro_monthly`, `premium_monthly`, `pro_annual`, `premium_annual` | App Store Connect → Subscriptions | [ ] |
| 0.9 | Set up RevenueCat Sandbox tester (Apple ID) for purchase testing | App Store Connect → Users & Access → Sandbox Testers | [ ] |

---

## Milestone 1 — Build Configuration (code — done on this branch)

| # | Task | File | Status |
|---|------|------|--------|
| 1.1 | iOS `bundleIdentifier`, `buildNumber`, background modes in `app.json` | `app.json` | [x] |
| 1.2 | APNs entitlement (`aps-environment: production`) in `app.json` | `app.json` | [x] |
| 1.3 | iOS build profiles in `eas.json` (development/simulator, production/store) | `eas.json` | [x] |
| 1.4 | `eas submit` iOS config skeleton (fill ASC App ID + Team ID after M0.4–0.5) | `eas.json` | [x] |
| 1.5 | RevenueCat platform-aware key selection (iOS `appl_*` vs Android `goog_*`) | `src/services/purchases.ts` | [x] |
| 1.6 | iOS RevenueCat key placeholder in `app.json` | `app.json` | [x] |

---

## Milestone 2 — EAS Credentials & Secrets (after M0)

Run these commands after M0 is complete:

```bash
# 1. Upload APNs key to EAS (prompts for p8 file path, Key ID, Team ID)
cd ~/Code/PingWeather
eas credentials --platform ios

# 2. Add iOS RevenueCat key as EAS env var
eas env:create --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value "appl_XXXXXX" --environment preview
eas env:create --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value "appl_XXXXXX" --environment production

# 3. Fill in eas.json placeholders from M0:
#    - ascAppId: the 10-digit App Store Connect App ID
#    - appleTeamId: your Apple Developer Team ID (from developer.apple.com/account)
```

Also update `app.json` `extra.revenueCatIosApiKey` with the actual `appl_*` key from RevenueCat.

---

## Milestone 3 — Simulator Build & Smoke Test (after M1 + M2)

```bash
# Build for iOS Simulator (no signing required, fast)
eas build --platform ios --profile development

# Install the .tar.gz in iOS Simulator:
# Xcode → open Simulator → drag the .app file onto it
```

**Smoke test checklist:**
- [ ] App launches, splash screen shows
- [ ] Onboarding flow completes (welcome → privacy → eula → location-setup → notification-setup → battery-setup [skip on iOS for now] → complete)
- [ ] Login / signup works
- [ ] Alert rules screen loads
- [ ] Locations screen loads
- [ ] Settings screen loads (theme toggle, units)
- [ ] NOTE: Push notifications don't work in Simulator — skip that step

---

## Milestone 4 — Push Notifications on iOS (physical device required)

APNs tokens only work on physical devices. Simulator gives a dummy token.

```bash
# Build dev client for physical device
eas build --platform ios --profile development --no-wait
# Install via EAS dashboard → QR code scan on device
```

**Test checklist:**
- [ ] Notification permission prompt appears on first launch
- [ ] Permission granted → push token registered in Supabase `profiles.push_token`
- [ ] Verify in Supabase: `SELECT push_token FROM profiles WHERE email = 'your@email.com'`
- [ ] Silent keepalive: trigger `fcm-keepalive` manually via Supabase SQL and confirm no visible notification appears
- [ ] Alert notification: trigger `poll-weather` manually and confirm notification arrives

---

## Milestone 5 — Deep Linking on iOS (after M3)

The PKCE reset-password flow uses `pingweather://reset-password` deep links.

**Test checklist:**
- [ ] Open the app, navigate to Forgot Password
- [ ] Enter email, tap Send Reset Link
- [ ] Open the email on iOS, tap the link
- [ ] Confirm the reset-password screen opens in-app (not Safari)
- [ ] Complete password reset
- [ ] If it opens in Safari instead: add `associatedDomains` entitlement and Universal Links

---

## Milestone 6 — RevenueCat iOS In-App Purchases (after M0.7–0.9)

**Setup:**
- [ ] Products created in App Store Connect (M0.8) and linked in RevenueCat dashboard
- [ ] RevenueCat iOS API key added to EAS (M2)
- [ ] Sandbox tester Apple ID created (M0.9)

**Test checklist (on physical device, Sandbox mode):**
- [ ] Sign in with Sandbox tester Apple ID in iOS Settings → App Store → Sandbox Account
- [ ] Open PingWeather → upgrade screen → tap Pro
- [ ] Sandbox purchase sheet appears with test pricing
- [ ] Purchase completes, tier updates to Pro in app
- [ ] RevenueCat dashboard shows the sandbox purchase
- [ ] Restore Purchases flow works

---

## Milestone 7 — Battery Optimization Prompt — iOS Variant (after `feature/battery-opt-prompt` merged)

The existing Android screen fast-forwards on iOS. Add iOS-specific content:

**Changes needed** (on `feature/battery-opt-prompt` branch):
- Update `app/onboarding/battery-setup.tsx` iOS path to show "Enable Background App Refresh" instructions instead of routing straight to complete
- Button: `Linking.openURL('app-settings:')` — deep links to PingWeather's Settings page on iOS
- Explain: Settings → PingWeather → Background App Refresh → ON

---

## Milestone 8 — TestFlight Submission (after M4 + M5 + M6)

```bash
# Build production-signed IPA for TestFlight
eas build --platform ios --profile production --non-interactive

# Submit to App Store Connect (TestFlight)
eas submit --platform ios --latest
```

**Before submitting:**
- [ ] Fill `eas.json` `ascAppId` and `appleTeamId` with real values (M2)
- [ ] App Store Connect API Key uploaded to EAS via `eas credentials`
- [ ] App version / buildNumber correct in `app.json`

**After submitting:**
- [ ] Apple's automated checks pass (usually 5–15 min)
- [ ] Add internal testers in TestFlight
- [ ] Install via TestFlight → test the golden path

---

## Milestone 9 — App Store Listing & Screenshots

**Required by Apple before public release:**
- [ ] App name: "PingWeather"
- [ ] Subtitle (30 chars max): "Smart Weather Alerts"
- [ ] Description: adapt from `docs/store-listing/google-play-listing.md`
- [ ] Keywords (100 chars): weather, alerts, livestock, farming, hunting, notifications, forecast
- [ ] Screenshots — required sizes:
  - iPhone 6.7" (1290 × 2796) — at least 3
  - iPhone 6.1" (1179 × 2556) — recommended
  - iPad 13" (2064 × 2752) — only if `supportsTablet: true` (it is)
- [ ] Privacy Policy URL: `https://truthcenteredtech.com/pingweather-privacy`
- [ ] Privacy Nutrition Labels (Data Used to Track You, Data Linked to You, etc.)
  - Email address (account), Location (optional, linked to account), Identifiers

---

## Milestone 10 — App Store Production Release (after M9)

```bash
eas build --platform ios --profile production
eas submit --platform ios --latest
```

- [ ] Submit for Apple Review
- [ ] Review typically 24–72 hours for a new app
- [ ] Common rejection reasons to pre-empt:
  - Missing "restore purchases" button on paywall (RevenueCat handles this — verify it's visible)
  - Crasher on startup (run M3 + M4 smoke tests thoroughly)
  - Privacy policy URL not accessible
  - Guideline 3.1.1 — in-app purchase for subscriptions (must use Apple IAP — RevenueCat handles this)

---

## What's Already Done on This Branch

| Item | Status |
|------|--------|
| `app.json` iOS background modes (silent push) | Done |
| `app.json` APNs entitlement | Done |
| `app.json` iOS build number | Done |
| `eas.json` iOS development (simulator) profile | Done |
| `eas.json` iOS production profile | Done |
| `eas.json` submit config skeleton | Done |
| `purchases.ts` platform-aware RevenueCat key | Done |
| `fcm-keepalive` `_contentAvailable: true` (on `feature/forecast-digest`) | Done |

## What Blocks Everything

**M0 is the blocker.** No code change unblocks this — Apple Developer membership, APNs key, and App Store Connect app must exist before EAS can sign an iOS build.

Start M0 today while the Android internal testing is running.
