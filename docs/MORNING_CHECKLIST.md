# Jimmy's Morning Checklist

> Generated 2026-04-09 during the overnight autonomous push.
> Every item here is something I couldn't do because it requires your credentials,
> your physical device, or an external account action.

## TL;DR

The PingWeather code is ready for Google Play Store submission. Every line of
code, every test, every Edge Function, every static asset is written and
committed. The remaining work is **account setup + credential pasting + one
production build + store submission**. Expected time: ~3-4 hours of your
active work, plus wait times for Apple Developer approval (if you want iOS
parallel-track later) and Play Store review.

**Repo:** https://github.com/jimmythorne10/PingWeather
**Final commit you're looking at:** `66f2b15` and anything after it.

---

## Part 1 — Accounts (start these first, they have wait times)

### 1a. Google Play Console ($25, 10 minutes)
1. Open https://play.google.com/console
2. Sign in with a Google account (use a business account, not personal)
3. Pay $25 one-time developer fee
4. Fill out developer profile — use "Truth Centered Tech" as the developer name
5. Accept the Play Console developer distribution agreement
6. Verification can take a day or two, but you can start creating products immediately

### 1b. RevenueCat account (free, 15 minutes)
1. Open https://app.revenuecat.com
2. Sign up
3. Create a new project called "PingWeather"
4. Add an Android app:
   - Package name: `com.truthcenteredtech.pingweather`
   - Link to your Play Console project (you'll need the Google Play Service
     Account JSON — RevenueCat walks you through creating one in Play Console)
5. Copy the **Android public SDK key** (starts with `goog_`). You'll paste
   this into `app.json` in step 3.
6. **Save the webhook secret** — in the RevenueCat dashboard go to Project
   Settings → Integrations → Webhooks. Create a webhook (we'll set the URL
   in step 5) and save the auth secret it generates.

### 1c. Apple Developer Program ($99/yr, 10 minutes to start, 1-7 days to approve)
**Only do this if you want iOS later.** Start it now even if you're
Android-first, because Apple's identity verification takes up to a week and
the clock doesn't run in parallel with anything else.
1. Open https://developer.apple.com/programs/enroll/
2. Enroll as "Truth Centered Tech" (requires a D-U-N-S number — if you don't
   have one, the D-U-N-S application adds another 1-5 business days)
3. Pay $99
4. Wait for Apple to verify your identity (1-7 days typically)

### 1d. Open-Meteo Commercial License ($29/mo, 5 minutes)
Research (in MEMORY.md) confirms Open-Meteo is the right API for PingWeather.
Stay on it. Get the commercial license before launch since paid subscriptions
= commercial use.
1. Open https://open-meteo.com/en/pricing
2. Subscribe to the **Standard** plan ($29/mo, 1M calls/mo — handles ~100
   active users with hourly polling)
3. Upgrade to **Professional** ($99/mo, 5M calls/mo) when you hit ~500 users
4. Copy the API key they give you and save it for later (we'll need it if we
   add auth'd requests; current code doesn't require it for the free tier,
   but paid tiers do)

---

## Part 2 — Code Wiring (30 minutes)

### 2a. Paste RevenueCat API key into `app.json`
Open `app.json` and change:
```json
"extra": {
  ...
  "revenueCatApiKey": ""
}
```
to:
```json
"extra": {
  ...
  "revenueCatApiKey": "goog_YOUR_KEY_FROM_REVENUECAT"
}
```

### 2b. Add Supabase secret for the webhook
```bash
cd C:/Users/jimmy/Code/PingWeather
npx supabase secrets set REVENUECAT_WEBHOOK_SECRET=<the secret from step 1b.6>
```
This makes the secret available to the `subscription-webhook` Edge Function
via `Deno.env.get('REVENUECAT_WEBHOOK_SECRET')`.

### 2c. Configure the webhook URL in RevenueCat
In the RevenueCat dashboard → Project Settings → Integrations → Webhooks →
Edit webhook:
- URL: `https://ziyxkgbrdliwvztotxli.supabase.co/functions/v1/subscription-webhook`
- Auth header: `Authorization: Bearer <the same secret>`
- Events to send: All subscription events (INITIAL_PURCHASE, RENEWAL,
  CANCELLATION, EXPIRATION, BILLING_ISSUE_DETECTED)

Click "Send test webhook" to verify the function responds with 200.
Check the function logs at:
https://supabase.com/dashboard/project/ziyxkgbrdliwvztotxli/functions/subscription-webhook/logs

### 2d. Create products in Play Console
Google Play Console → Your app → Monetization → Products → Subscriptions →
Create subscription. Create four:

| Product ID | Base Plan | Price | Billing Period |
|---|---|---|---|
| `pro_monthly` | monthly | $3.99 | Monthly |
| `pro_annual` | annual | $39.99 (~16% discount) | Yearly |
| `premium_monthly` | monthly | $7.99 | Monthly |
| `premium_annual` | annual | $79.99 (~17% discount) | Yearly |

For each product:
- Benefits: write 3-5 one-liners (what this tier includes)
- Activate the base plan
- Set the price for every country you want (use Google's auto-conversion for simplicity)

### 2e. Link the products in RevenueCat
RevenueCat dashboard → Products → "Import from Google Play". All four
products should appear. Then create an **Offering** called "default" with
four packages:
- `$rc_monthly` → `pro_monthly`
- `$rc_annual` → `pro_annual`
- `premium_monthly` → `premium_monthly`
- `premium_annual` → `premium_annual`

The code in `app/upgrade.tsx` uses `$rc_monthly` as the default package
identifier. If you name things differently in RevenueCat, update the
`TIER_PACKAGE_MAP` in that file accordingly.

---

## Part 3 — Legal + Assets (1-2 hours)

### 3a. Host the legal pages
`docs/legal/privacy-policy.html` and `docs/legal/terms-of-use.html` are
self-contained HTML files ready to host. Options:
- **GitHub Pages** (free, easiest): create a `docs/` branch or use the
  main branch's `/docs/legal/` path, enable Pages, get a URL like
  `https://jimmythorne10.github.io/PingWeather/legal/privacy-policy.html`
- **Vercel/Netlify** (free, prettier domain): drag the docs/legal folder
  into a Vercel drop zone, get a random URL, set truthcenteredtech.com as
  custom domain if you want
- **Your own site** (truthcenteredtech.com): upload the files directly

You need **public URLs** for both, because the Play Console listing
form requires them.

### 3b. Take screenshots on device
Google Play Store requires at least 2 screenshots (up to 8). They must be:
- PNG or JPEG
- Minimum 320px shortest side, max 3840px longest side
- 16:9 or 9:16 aspect ratio (portrait is fine for a phone app)

Recommended screens to capture on your phone:
1. **Home screen** with the 14-day forecast card populated
2. **Alerts tab** with 2-3 rules visible
3. **Rule editor** (`/create-rule`) with a freeze warning being built
4. **Forecasts tab** with an expanded location showing hourly + daily
5. **Day detail** screen with hourly breakdown
6. **Notification actually delivered** (screenshot your notification tray
   when one fires — this is the money shot)
7. **Settings → Upgrade** paywall

Save them somewhere and upload to Play Console listing during submission.

### 3c. Create a feature graphic (required by Play Store)
- 1024×500 PNG, no alpha
- Shows the app name + tagline + a visual hint of the app's purpose
- Tools: Canva (free, has templates), Figma, or just Paint if you're in a hurry
- Tagline suggestion: "Weather alerts that actually help." or "Know before it freezes."

### 3d. Icon
You already have `assets/icon.png` and `assets/adaptive-icon.png`. The
adaptive icon is what the Play Store uses. Verify it looks good on the
"adaptive icon preview" page in Android Studio or online at
https://adapticon.tooo.io/.

---

## Part 4 — Production Build (30 minutes + 20 min wait)

```bash
cd C:/Users/jimmy/Code/PingWeather
eas build --platform android --profile production
```

This will:
- Auto-increment `android.versionCode` in `app.json` (because `autoIncrement: true` in `eas.json`)
- Build a signed Android App Bundle (AAB) ready for Play Store upload
- Take ~15-25 minutes in the Free tier queue
- Output a download URL

Download the AAB file. Don't install it on your phone — it's not an APK,
it's the upload artifact for Play Console.

---

## Part 5 — Store Submission (1 hour)

### 5a. Create the Play Console listing
Play Console → Your app → Dashboard → Set up your app:
1. **App details** — use the copy from `docs/store-listing/google-play-listing.md`
2. **Category** — Weather
3. **Content rating** — Complete the questionnaire (PingWeather is Everyone)
4. **Target audience** — Over 13
5. **Privacy policy URL** — from step 3a
6. **App access** — "All functionality is available without restrictions"
   (beta users can sign up in-app)
7. **Ads** — No ads
8. **Data safety** — Declare that you collect:
   - Personal info: Name (display name), Email (auth)
   - Location: Approximate location (for weather forecasts at configured locations)
   - Device or other IDs: FCM push token
   All for "App functionality." None sold to third parties.

### 5b. Create a release
Play Console → Release → Testing → Internal testing → Create new release:
1. Upload the AAB from step 4
2. Release name: `1.0.0 (1)`
3. Release notes: "Initial release of PingWeather."
4. Save and review
5. Roll out to internal testing

### 5c. Add yourself as an internal tester
Play Console → Release → Testing → Internal testing → Testers → Create
email list → add your Gmail → save. Copy the opt-in link and open it on
your phone. Once you opt in, the app will be downloadable from the Play
Store within ~1 hour.

### 5d. Test the full purchase flow on device
1. Install PingWeather via the Play Store internal testing link
2. Sign in
3. Settings → Manage Plan → Subscribe to Pro
4. Google's sandbox purchase flow should appear (it says "You won't be
   charged — this is a test purchase")
5. Confirm
6. Verify:
   - App updates to show "Pro" tier in Settings
   - RevenueCat dashboard shows the test purchase
   - Supabase `profiles.subscription_tier` for your user = 'pro'
7. Try restore purchases on a fresh install
8. Try downgrading (should direct you to Play Store subscription
   management)

If ALL of that works, move to closed testing, then production.

### 5e. Promote to production
Only after internal testing works end-to-end, promote the release through:
Internal testing → Closed testing (optional but recommended — invite 5-10
real testers) → Open testing (optional) → Production.

Google's review typically takes 1-3 days for first-time submissions.

---

## What I already did for you

Code:
- `src/services/purchases.ts` — RevenueCat wrapper with typed functions
- `src/services/subscriptionLogic.ts` — pure logic for webhook event handling
- `app/upgrade.tsx` — real purchase/restore flow wired in
- `app/_layout.tsx` — RevenueCat initialized on app boot, identity synced with auth
- `supabase/functions/subscription-webhook/index.ts` — receives RevenueCat events, updates profiles
- `supabase/config.toml` — verify_jwt=false for the webhook
- `jest.setup.ts` — react-native-purchases mock
- `eas.json` — production profile configured
- `app.json` — revenueCatApiKey placeholder, versionCode initialized

Tests:
- `__tests__/services/purchases.test.ts` — 8 tests for product-to-tier mapping
- `__tests__/services/subscriptionLogic.test.ts` — 14 tests for webhook event handling
- Full suite: 400 logic + 85 component = 485 tests, 0 failures
- `tsc --noEmit` clean

Docs:
- `docs/legal/privacy-policy.html` — self-contained static HTML, ready to host
- `docs/legal/terms-of-use.html` — same
- `docs/store-listing/google-play-listing.md` — listing copy ready to paste
- `docs/MORNING_CHECKLIST.md` — this file
- `CLAUDE.md`, `docs/PRD.md`, `docs/KNOWN_ISSUES.md`, `docs/TEST_STATUS.md`,
  `docs/JIMMY_HANDOFF.md`, `.claude/memory/MEMORY.md` all synced to current
  reality

Deployed:
- `subscription-webhook` Edge Function deployed to Supabase live project

---

## What I couldn't do and why

| Item | Why not |
|---|---|
| Create Play Console developer account | Requires your credit card and Google identity verification |
| Create RevenueCat account + API keys | Same — requires your email/credentials |
| Create products in Play Console | Can't do this until you have a Play Console account linked to the app |
| Set `REVENUECAT_WEBHOOK_SECRET` in Supabase | Requires Supabase dashboard access + the secret from RevenueCat |
| Run `eas build --platform android --profile production` | Requires you to be logged into your `eas-cli` session, and burns a build credit. I have the code ready but won't trigger a paid operation autonomously. |
| Take device screenshots | Physical device required |
| Create the feature graphic | Visual design that needs your judgment on branding |
| Host legal pages | Requires your GitHub/Vercel/domain account |
| Submit to Play Store | Requires your Play Console account |
| Apple Developer enrollment | $99 + your identity |

---

## If something goes wrong

**RevenueCat purchase flow fails at "No offerings available":**
- Products aren't linked correctly in RevenueCat. Re-check step 2e.
- The Play Store needs a few hours after product creation before they're
  purchasable via the SDK. Wait 2-4 hours after creating products.

**Webhook doesn't fire:**
- Check function logs at the URL in step 2c
- Common cause: `REVENUECAT_WEBHOOK_SECRET` not set, or webhook Authorization
  header in RevenueCat dashboard doesn't match
- Run `npx supabase secrets list` to confirm the secret is set

**Purchase succeeds but `profiles.subscription_tier` doesn't update:**
- The webhook path is broken but the client-side sync in
  `src/services/purchases.ts` `syncTierToSupabase` should still work as a
  fallback. Check the Supabase Edge Function logs.

**Build fails:**
- If it's ERESOLVE: npm install issue, re-run `rm -rf node_modules && npm ci`
- If it's a native compile error: send me the error output, we debug
- If it's a credit issue: you've used too many builds this month

---

## Post-launch

Once you're in production, the deferred work from `docs/KNOWN_ISSUES.md` is
still open:
- INFRA-005: real SMTP provider (Resend — 30 minutes)
- INFRA-001: Maestro E2E suite (6 hours, needed before scaling past first 10 users)
- iOS parallel track (waits on Apple Developer Program approval)

And the business side (from an earlier agent's feedback):
- Grassroots posting in 3-4 niche communities (livestock owners, hunters,
  outdoor workers subreddits + Facebook groups)
- Don't spend on ads until you have 100+ organic users giving you feedback
- Annual pricing is already set up in the products list — push users to
  annual via a "save 16%" banner on the paywall after they've tried monthly
  for a week

Good luck.
