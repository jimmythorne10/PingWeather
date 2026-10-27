# Device sweep — FEAT-007 + FEAT-008 (TASK-011)

Operator-only. Nothing automated on this project can close these two entries.
Budget: ~25 minutes, one Android phone, the laptop on the same Wi-Fi.

## 0. Setup (once)

1. Install the dev client on the phone: open the build page on the phone and
   tap **Install** (build `a6cd4828`, profile `development`, env `preview`):
   https://expo.dev/accounts/jimmy.thorne.10/projects/pingweather/builds/a6cd4828-da3a-44bf-bb15-2cc9e2c4040d
   Allow "install unknown apps" for your browser if Android asks.
   **Uninstall the Play Store WeatherBeacon first.** Same package
   (`com.truthcenteredtech.pingweather`) but a different signing key (Play App
   Signing vs. the EAS keystore), so Android rejects the install with
   "App not installed" / signature conflict while the store app is present.
   Reinstall from Play when the sweep is done.
2. On the laptop, from `~/Code/PingWeather` on branch `feature/design-system-v2`:
   `npx expo start --dev-client`
3. Open the dev client on the phone → pick the laptop's server (or scan the QR).
   If it can't connect: `npx expo start --dev-client --tunnel`.

The app talks to the **live** Supabase project. New sign-ups below create real
rows; delete the test accounts afterwards if you care.

Fresh installs default to look **Aurora**. The look is stored on the device,
not the account, and survives sign-out — that is what makes pass B possible.

## 1. FEAT-007 — Radar (do this first; it is the crash risk)

Sign in with your normal account → open Radar.

| # | Check | Pass |
|---|-------|------|
| R1 | Map tiles draw (not a blank/black rectangle) | ☐ |
| R2 | Radar overlay appears over the map | ☐ |
| R3 | Drag the frame scrubber — overlay changes frame | ☐ |
| R4 | Play / Now buttons respond | ☐ |
| R5 | No red-box error at any point | ☐ |
| R6 | Mapbox logo + attribution visible (Mapbox ToS) | ☐ |

Repeat R1–R5 after switching Settings → Look → **Classic**, then set it back to **Aurora**.

## 2. FEAT-008 pass A — Aurora

Settings → Look = **Aurora**. Sign out → **Sign up** with a throwaway email
(e.g. `jimmy+sweepA@…`). Onboarding starts automatically. On every screen check:
text not clipped/overlapping, every button reachable without hidden controls, not blank, no red box.

| Screen | Aurora |
|--------|--------|
| welcome | ☐ |
| privacy | ☐ |
| eula | ☐ |
| location-setup (type coords, tap Next) | ☐ |
| notification-setup | ☐ |
| battery-setup (Android only) | ☐ |
| complete | ☐ |

Then Settings → **Terms of Use** ☐ and **Privacy Policy** ☐ (the two `app/legal/` screens).

## 3. FEAT-008 pass B — Classic

Settings → Look = **Classic**. Sign out → sign up a second throwaway
(`jimmy+sweepB@…`). Same table, same two legal screens.

| Screen | Classic |
|--------|---------|
| welcome | ☐ |
| privacy | ☐ |
| eula | ☐ |
| location-setup | ☐ |
| notification-setup | ☐ |
| battery-setup | ☐ |
| complete | ☐ |
| legal / Terms of Use | ☐ |
| legal / Privacy Policy | ☐ |

## 4. Report back

Send one line per feature, e.g.
`FEAT-007 pass — Pixel 7, 2026-10-27, tiles+scrub OK both looks, no red box`
`FEAT-008 pass — all 9 screens both looks` (or name the screen + look + what broke, with a screenshot).

Claude records it with `/feature-manifest update` — the manifest is never hand-edited.
Any failure → fix on this branch → new dev build only if a native file changed (JS-only fixes reload from Metro).
