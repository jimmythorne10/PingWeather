# F10: Forecast Digest

## Overview
An opt-in daily or weekly forecast summary push notification for the user's chosen location. Doubles as an Android reliability measure — keeping the app in the Active/Working Set standby bucket so alert notifications don't get deprioritized on quiet weather days.

## Screens Involved
- `app/(tabs)/settings.tsx` — "Forecast Digest" section: on/off toggle, frequency toggle (daily/weekly), day-of-week picker (weekly), hour picker, location picker

## Data Model
Writes to `public.profiles`:
- `digest_enabled boolean default false`
- `digest_frequency text` CHECK `in ('daily', 'weekly')` default `'daily'`
- `digest_hour integer` CHECK 0-23, default 7
- `digest_day_of_week integer` CHECK 1-7 (ISO weekday, Mon=1), default 1
- `digest_location_id uuid FK → locations.id ON DELETE SET NULL`
- `digest_last_sent_at timestamptz`

Reads (server-side):
- `profiles` WHERE `digest_enabled` + `push_token IS NOT NULL` + `digest_location_id IS NOT NULL`, joined with `locations!digest_location_id (name, latitude, longitude, timezone)`
- `forecast_cache` by `grid_key` — if fresh (< 2h), used; else direct Open-Meteo call as fallback.

Cron: `send-digest-hourly` scheduled `0 * * * *` UTC, fires against `/functions/v1/send-digest` via `pg_net.http_post` with `timeout_milliseconds := 30000`. Migration 00016 corrected the vault secret references that were previously silently failing.

## State Management
- Settings screen reads `profile.digest_*` fields directly.
- `handleDigestUpdate` wraps `updateProfile` with a confirmation Alert when turning the digest OFF (warns about Android deep-sleep risk).
- No dedicated store — profile-level Zustand is sufficient.

`src/services/digestScheduler.ts` (pure logic, shared with Edge Function):
- `shouldSendDigest(profile, locationTimezone, nowUtc): boolean`

`src/services/digestFormatter.ts` (pure logic, paired with server-side mirror):
- `formatDigestNotification(forecast, locationName, temperatureUnit, frequency, windSpeedUnit): { title, body }`

## Business Rules
- **Digest OFF prompt**: turning it off triggers an Alert dialog that explains the Android-reliability cost. `handleDigestUpdate` returns early if user cancels.
- **Hourly cron, local-time gate**: `send-digest` runs hourly UTC but inside the function, `shouldSendNow` computes the local hour for the user's digest location via `Intl.DateTimeFormat({ timeZone, hour12: false })`. Only users whose local hour == `digest_hour` (and, for weekly, local weekday == `digest_day_of_week`) are due.
- **Minimum resend window**: 23 hours since `digest_last_sent_at` — prevents double-fires if the user changes their digest_hour just after being sent.
- **Cache preference**: `get_forecast` helper first reads `forecast_cache` by `grid_key` and returns if age < 2h (one poll-weather cycle grace). Falls back to Open-Meteo direct fetch.
- **Format**:
  - Daily: `"Today's forecast — ${location}"` / `"High ${H}, Low ${L} · ${rain}% rain · ${wind} mph wind"`
  - Weekly: `"7-day forecast — ${location}"` / `"H/L, H/L, …, 7 entries · Up to ${maxRain}% rain chance"`
- **Server formatter** (`send-digest/index.ts`) currently hardcodes wind unit as `mph` in the text body, while the client-side `digestFormatter.ts` respects the user's `windSpeedUnit`. Inconsistency: server sends mph regardless of user preference.
- **Temperature unit** respected via `profile.temperature_unit` column (migration 00010).
- **Send-only when `push_token` + `digest_location_id` present** — profiles without either are filtered out in the SELECT.
- **Notification channel**: Android delivery uses `channelId: "forecast-digest"` (importance DEFAULT), so it doesn't vibrate like alerts.
- **notifyNow / userId override**: the function accepts `{ notifyNow: true, userId: '...' }` to bypass the scheduling gate for debugging.
- **MIN_RESEND_HOURS = 23**: intentionally shorter than 24 so daylight-saving time transitions don't block a send.

## API Interactions
| Call | Endpoint | Auth |
|------|----------|------|
| Toggle / configure | `profiles.update(digest_*)` | user JWT |
| Cron fire | `POST /functions/v1/send-digest` | Bearer vault service_role |
| Forecast (cached) | `forecast_cache.select(grid_key)` | service_role |
| Forecast (fallback) | Open-Meteo forecast endpoint | `OPEN_METEO_API_KEY` secret |
| Push | `POST https://exp.host/--/api/v2/push/send` | none (Expo token) |
| Mark sent | `profiles.update({ digest_last_sent_at }).eq('id', profileId)` | service_role |

## Error Handling
- Missing `locations.timezone` → skip this profile (the server-side formatter needs a zone to compute local hour).
- `formatDateTime` throw → `shouldSendNow` returns false (skip).
- Open-Meteo fallback throw → per-profile try/catch, logs and continues.
- Push failure → skip the `digest_last_sent_at` update so the user will retry next cycle.
- Unauthorized bearer → 401; handled at gateway or function entry.

## Edge Cases — Handled
- Daylight saving time via Intl.DateTimeFormat with `timeZone` — avoids naive-UTC errors.
- Duplicate send within 23h window — prevented by MIN_RESEND_HOURS.
- Weekly gate — compares `localIsoWeekday` against `digest_day_of_week`.
- Forecast cache miss → fallback to direct Open-Meteo.
- Digest location deleted: `digest_location_id` goes null via `ON DELETE SET NULL` → filtered out of the eligible profiles SELECT.

## Edge Cases — NOT Handled (Gaps)
- **Server-side wind unit mismatch**: the server's `formatDigest` always writes "mph" in the body, ignoring the user's preference. The client-side `digestFormatter.ts` has the correct multi-unit logic — but that client function isn't used server-side. Bug: clients who use °C + km/h see a °C/mph mixed digest.
- **Timezone missing**: if `poll-weather` hasn't backfilled the timezone yet and the user doesn't have one from geocoding, they can't receive a digest until the first poll lands.
- **No retry** on push failure — the `digest_last_sent_at` not being updated is the retry mechanism, but this relies on the next cron fire happening before the user's hour rolls over. If the cron fails at 7am, there's no 7:30am retry; the user gets nothing that day.
- **No delivery check** — same Expo-push-token caveat as F06. `response.ok` means "Expo accepted", not "device received".
- **Cache staleness**: 2 hours is acceptable for a daily digest, but if `poll-weather` has been down for 3+ hours, the fallback fires — and each digest user triggers a separate Open-Meteo call (no cross-user coalescing here).
- **`notifyNow` without auth scope**: the bearer check accepts service_role OR `SEND_DIGEST_SECRET`. If `SEND_DIGEST_SECRET` leaks, any caller can trigger a digest send for any user (via `{ userId }`).
- **Hour conflict between alerts and digest**: no debouncing if an alert fires at the same minute as the digest — user gets both.

## Test Coverage
- `__tests__/services/digestScheduler.test.ts` — `shouldSendDigest` across daily/weekly, hour match/mismatch, weekday match, resend window, missing timezone, malformed timezone.
- `__tests__/services/digestFormatter.test.ts` — formatting for daily/weekly × °F/°C × mph/kmh/knots.

No tests for the Edge Function `send-digest` itself — its DB filtering and notifyNow flow have no automated coverage.

**Verdict:** Pure scheduler + formatter have strong coverage (client-side). The server's divergent wind-unit bug is invisible because server code isn't exercised by Jest.
