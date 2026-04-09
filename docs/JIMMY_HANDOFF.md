# Jimmy-only handoff steps

These are the steps I (Claude) cannot run for you because they require secrets
or actions on accounts I don't have access to. Work through them in order.
Each step ends with a verification check you can actually run.

Last updated: 2026-04-08

---

## 1. Fix Supabase URL Configuration (30 seconds)

**Why:** the reset-password email currently sends users to
`http://localhost:3000`, which lands on the OutfitterHUB web app and makes
password reset impossible. The app is now wired to handle a
`pingweather://reset-password` deep link instead.

1. Open https://supabase.com/dashboard/project/ziyxkgbrdliwvztotxli/auth/url-configuration
2. **Site URL** — replace whatever is there with:
   ```
   pingweather://reset-password
   ```
3. **Redirect URLs — Allow list** — add each of these as separate entries
   (leave any existing entries you recognize; don't nuke the list):
   ```
   pingweather://reset-password
   pingweather://*
   exp://127.0.0.1:8081/--/reset-password
   exp://localhost:8081/--/reset-password
   exp://192.168.*.*:8081/--/reset-password
   ```
   The `exp://` entries are for Expo Go / dev client. The wildcard
   `pingweather://*` covers any future deep links without re-editing.
4. Click **Save**.

**Verify:** refresh the page and confirm the new Site URL is persisted.

---

## 2. Rebuild the Android APK (~20 minutes, burns 1 EAS credit)

**Why:** adding `"scheme": "pingweather"` to `app.json` is a native config
change. The current APK installed on your phone has no knowledge of the
scheme, so the OS won't open it when you tap a `pingweather://` link. One
more build bakes the scheme into `AndroidManifest.xml`.

**You only have to do this once.** After this build, any further JS changes
hot-reload over the dev server — no more builds until the next time we touch
native config (plugins, permissions, SDK upgrades).

```bash
cd C:/Users/jimmy/Code/WeatherWatch
eas build --platform android --profile development
```

Wait for it to finish. When done, the build URL will have an APK link.
Download, install (you'll need to uninstall the old PingWeather APK first
because the package signature is the same but it's a new build).

**Verify:** after install, on your phone open a browser and paste
`pingweather://reset-password` into the address bar. The OS should prompt
to open PingWeather. Tapping OK should land you on the reset-password screen
with a "This reset link is invalid or has expired" message (correct — there
was no token in the URL).

---

## 3. Set up pg_cron scheduled polling (5 minutes)

**Why:** the `poll-weather` Edge Function exists but nothing calls it on a
schedule. Without this step, no notifications will ever fire, because the
evaluator never runs.

### 3a. Enable required Postgres extensions

Open https://supabase.com/dashboard/project/ziyxkgbrdliwvztotxli/database/extensions
and enable these two if they aren't already green:
- `pg_cron`
- `pg_net`

Vault is NOT an extension — it's a built-in Supabase feature in the `vault`
schema, available on every project by default. Verify with:

```sql
select count(*) from vault.secrets;
```

If that query runs without error, vault is ready.

### 3b. Grab the service role key

Open https://supabase.com/dashboard/project/ziyxkgbrdliwvztotxli/settings/api
and copy the **`service_role` secret** value (starts with `eyJ...`).

**⚠️ DO NOT paste the service role key into this repo, into a chat message,
into a commit, or into the `.env` file.** It bypasses RLS and can do
anything. It only ever goes into Supabase Vault.

### 3c. Seed the vault secrets

Open https://supabase.com/dashboard/project/ziyxkgbrdliwvztotxli/sql/new
and run these two statements one at a time. **Replace the placeholder
with your actual service role key** before running the first one:

```sql
-- Service role key — paste YOUR value, do NOT commit
select vault.create_secret(
  'PASTE_SERVICE_ROLE_KEY_HERE',
  'poll_weather_service_role_key',
  'Service role JWT used by pg_cron to call the poll-weather Edge Function'
);
```

```sql
-- Edge Function URL — this literal is fine to commit, it's not a secret
select vault.create_secret(
  'https://ziyxkgbrdliwvztotxli.supabase.co/functions/v1/poll-weather',
  'poll_weather_function_url',
  'Full URL of the poll-weather Edge Function'
);
```

Each one should print a `uuid` result row. That's the vault secret id.

### 3d. Apply the cron migration

From your terminal:

```bash
cd C:/Users/jimmy/Code/WeatherWatch
npx supabase db push
```

This applies `supabase/migrations/00003_schedule_poll_weather.sql`, which
registers the hourly cron job.

**Verify:** back in the SQL editor, run:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'poll-weather-hourly';
```

You should see exactly one row with `active = true` and schedule `0 * * * *`.

### 3e. Wait for the first run (or force one)

The job fires at the top of every hour UTC. If you don't want to wait, you
can manually trigger the Edge Function from the terminal to prove the pipe:

```bash
curl -X POST "https://ziyxkgbrdliwvztotxli.supabase.co/functions/v1/poll-weather" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"source":"manual"}'
```

Then immediately check the logs at
https://supabase.com/dashboard/project/ziyxkgbrdliwvztotxli/functions/poll-weather/logs
and look for recent invocations.

After an hour has elapsed, verify cron itself ran:

```sql
select jobid, status, return_message, start_time, end_time
from cron.job_run_details
where jobid in (select jobid from cron.job where jobname = 'poll-weather-hourly')
order by start_time desc
limit 10;
```

Status should be `succeeded` on the most recent row.

---

## 4. Swap Supabase built-in SMTP for real email (pre-launch only, not urgent)

**Why:** Supabase's default mailer is rate-limited to ~4 emails/hour and
lands in spam. Fine for dev, unacceptable for production. Swap to Resend,
SendGrid, or Mailgun before public launch.

Defer this until after MVP device testing is complete. Opening a ticket
here so it doesn't get lost:

- Pick provider: Resend is the easiest (free tier covers dev, $20/mo covers
  small launch).
- In Supabase dashboard → Auth → SMTP Settings, set:
  - Enable Custom SMTP: on
  - Host / Port / Username / Password from provider
  - Sender email: `noreply@pingweather.app` or similar (requires a domain)
- Send a test email to yourself and confirm delivery under 30 seconds.

---

## 5. Device verification backlog

Things I've written code for but you need to verify on actual hardware
before they can be marked complete:

| Feature | How to verify |
|---|---|
| Forgot-password screen opens | Tap "Forgot Password?" on login screen → screen loads |
| Forgot-password email sends | Enter email, tap send, check inbox (will be slow/spam) |
| Email link opens app (requires step 2 rebuild) | Tap link on phone → PingWeather opens to reset-password |
| Reset-password screen accepts new password | Enter + confirm, tap update, get kicked to /login |
| New password actually works | Sign in with the new password |
| Premium → Free downgrade path | Settings → Manage Plan → tap Downgrade on Free card |
| Full tab sweep | Alerts, Forecasts, Settings, History — poke around, look for crashes |
| Dev tier override visible | Settings shows yellow "Developer Options" for jimmy@truthcenteredtech.com |
| Rule creation round-trip | Create a rule, verify it shows on Alerts tab and Home active rules |
| Push notification delivery end-to-end | Requires steps 1-3 done, plus a rule whose conditions match current weather |

---

## Summary of "do these in order"

1. Supabase URL Configuration (30 sec) → unblocks email testing
2. Rebuild APK (20 min) → unblocks deep link handling
3. pg_cron setup (5 min) → unblocks scheduled notification delivery
4. (deferred) Real SMTP
5. Device testing sweep → closes out verification backlog

Once 1-3 are done, we can finally do a full push notification round-trip
verification: create a rule → wait for cron → get a notification on phone.
That's the MVP completion signal.
