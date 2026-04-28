# F05: Weather Engine (Server-Side Polling & Condition Evaluation)

## Overview
The server-side scheduler that fetches weather data from Open-Meteo on a fixed cadence, groups nearby users into grid squares to minimize API calls, evaluates every active alert rule against the forecast window, writes alert history, and dispatches push notifications. This is the core IP of PingWeather.

## Screens Involved
None directly — this is a pure backend feature running in Supabase Edge Functions + `pg_cron`. The client observes its effects via alert history, push notifications, and the forecast cache.

## Data Model
Reads from:
- `public.alert_rules` — joined with `locations` to get coords. Filters `is_active` on both.
- `public.profiles.push_token` — batch-fetched by user_id for the triggered set.

Writes to:
- `public.forecast_cache` — upsert per `grid_key` (lat/lon rounded to 0.1°). Stores raw Open-Meteo response.
- `public.alert_history` — INSERT per triggered rule. Includes `user_id`, `rule_id`, `rule_name`, `location_name`, `conditions_met` (human-readable summary), `forecast_data` (matchDetails + evaluatedAt), `notification_sent: false` initially.
- `public.alert_rules.last_polled_at` — batch UPDATE for every rule that was evaluated (triggered or not).
- `public.alert_rules.last_triggered_at` — batch UPDATE for rules that fired.
- `public.alert_history.notification_sent` — surgical UPDATE per row after successful Expo Push dispatch.
- `public.locations.timezone` — backfill IANA zone when null and Open-Meteo returns it.

Cron schedule (from migration 00003, refined by 00007):
- `poll-weather-hourly` — `0 * * * *` (top of every hour, UTC), via `pg_net.http_post` with `timeout_milliseconds := 30000`, auth via `vault.decrypted_secrets.poll_weather_service_role_key`.

## State Management
No client-side state. Server-side state lives in the four affected tables.

Edge Function files:
- `supabase/functions/poll-weather/index.ts` — scheduler + grid grouping + forecast fetch + push dispatch
- `supabase/functions/evaluate-alerts/index.ts` — pure condition evaluation + history writes + last_triggered_at updates
- `supabase/functions/_shared/weatherEngine.ts` — shared pure logic (identical to `src/utils/weatherEngine.ts`): `gridKey`, `extractTimezone`, `getMetricValues`, `compare`, `evaluateCondition`, `evaluateRule`, `isInCooldown`, `formatConditionSummary`, `processInBatches`

## Business Rules
- **Grid-square caching**: `gridKey(lat, lon) = "${round(lat*10)/10},${round(lon*10)/10}"` — clusters users within ~11 km into a single Open-Meteo call.
- **Due-rule filter**: `now - last_polled_at >= polling_interval_hours * 3600s` OR `last_polled_at IS NULL`.
- **Concurrency limit**: `CONCURRENCY_LIMIT = 10` grids processed in parallel per batch (see `processInBatches`).
- **Per-request timeout**: `AbortController` fires at 10s inside `fetchForecast`.
- **Cooldown filter** (in `evaluate-alerts`): `isInCooldown(rule, evalNow)` — skips rule if `last_triggered_at + cooldown_hours * 3600s > now`.
- **Rule-evaluation semantics**:
  - Each condition's metric value is pulled from `hourly` or `daily` data depending on the metric (see `getMetricValues` switch).
  - For `temperature_high/low` and `uv_index` (daily-only metrics), the lookahead window is snapped to UTC midnight (`todayUtc`) — critical fix documented in `weatherEngine.ts` to prevent "today" being dropped when UTC time has already passed UTC midnight but the forecast record is at UTC midnight.
  - `precipitation_probability` and `wind_speed` use hourly for windows ≤ 24h, daily-max otherwise.
  - Condition matches if ANY value in the window satisfies the comparison.
  - Rule triggers if `AND`: all conditions met; or `OR`: at least one.
- **Dedup**: DB unique index on `alert_history (rule_id, triggered_at_hour_utc(triggered_at))` means a second poll within the same UTC hour that triggers the same rule returns error 23505 — treated as "already alerted, skip push".
- **Timezone backfill**: if `locations.timezone` is null and Open-Meteo returns `timezone` (because `timezone=auto` is sent), the Edge Function writes the IANA zone back to the row. Best-effort; failure doesn't block polling.
- **Failed-grid retry**: grids that throw are NOT stamped with `last_polled_at`, so they re-try on the next cron cycle. Failures are logged via `console.error` but don't abort other grids (Promise.allSettled).
- **Internal auth**: `poll-weather` accepts two bearer tokens — `SUPABASE_SERVICE_ROLE_KEY` (internal service-to-service) and `POLL_WEATHER_SECRET` (cron path, currently unused since vault stores the service role key). `evaluate-alerts` accepts only the service role key. Neither verifies JWT at the gateway (`verify_jwt = false` in `config.toml`) because both are internal callers.

## API Interactions
Outbound:
- Open-Meteo forecast: `https://customer-api.open-meteo.com/v1/forecast?...&apikey=...` (commercial endpoint when `OPEN_METEO_API_KEY` secret is set) or `https://api.open-meteo.com/v1/forecast` (free tier, fallback). Requests temperature in °F, wind in mph, `timezone=auto`, 7 days forecast, specific hourly and daily variables.
- Expo Push: `https://exp.host/--/api/v2/push/send` — POST with `{ to, sound, title, body, data: { rule_id } }`. No auth header required by Expo Push service when using Expo push tokens.
- Internal: `supabase.functions.invoke('evaluate-alerts', { body: { rules, forecast, location_name } })` — routed via service_role client.

## Error Handling
- Forecast fetch: AbortController at 10s prevents hang; non-2xx throws; `processInBatches` catches per-grid failures via Promise.allSettled.
- Forecast cache write: fire-and-forget with `.catch()` — never blocks polling.
- Timezone backfill: same pattern.
- `alert_history` insert: 23505 (unique violation) is silent-skip; other errors log via console.error.
- `last_polled_at` batch update: error is logged, not fatal — rules will re-evaluate next cycle.
- `last_triggered_at` batch update: not wrapped in error handler; if it fails, cooldown won't hold and the rule could fire twice. Logged only via the call error implicit in Supabase response.
- Push dispatch: Promise.allSettled on the fan-out, per-token failure is console.error'd but doesn't halt the batch.

## Edge Cases — Handled
- Grid-key rounding matches between `poll-weather` write and `send-digest` read (both use the shared `gridKey` function — critical for cache-hit rate).
- Manual coordinate entry without timezone → backfilled on first poll from Open-Meteo response.
- Invalid coords (outside -90..90 / -180..180) — throws per-grid, logs, doesn't stamp `last_polled_at` so the bad rule will keep trying until deleted.
- Open-Meteo commercial key unset → falls back to free endpoint (intended for dev).
- Empty triggered set short-circuits the push-dispatch block (no unnecessary profile fetch).
- Duplicate triggers same UTC hour → no duplicate push thanks to dedup index.
- JWT verification OFF on internal functions is documented in `config.toml` with rationale (pg_cron + service_role can't produce a user JWT).

## Edge Cases — NOT Handled (Gaps)
- **Expo push token invalidation** — if a token returns `DeviceNotRegistered` from Expo, we don't clear it from the profile. Stale tokens keep getting attempted every cycle.
- **Push send failure doesn't update `alert_history.notification_sent`** — the row stays `false`, which is correct, but the UI doesn't indicate "we tried and failed" distinctly.
- **Open-Meteo rate limit / 429** — the function logs the status but doesn't back off or pause subsequent grids.
- **`evaluate-alerts` cooldown** is measured against `now()` in UTC; combined with the `last_triggered_at` timestamp, this is fine. But the "same UTC hour" dedup means a rule whose cooldown is longer than 1 hour can still have its *push* skipped in the first hour even though the history row was written once. Acceptable by design but subtle.
- **No monitoring** — function failures are only visible in Supabase logs. No Sentry, no alert pipeline for the alert-pipeline.
- **No retry queue** for failed Expo push sends beyond per-request timeout.
- **Race between `evaluate-alerts` write and `poll-weather` update of `last_triggered_at`** — `evaluate-alerts` already set `last_triggered_at` (via its own batch UPDATE) before returning. `poll-weather` doesn't re-set it, so there's no race, but the timestamp is "when evaluate-alerts finished" not "when push succeeded." A push failure leaves a row with `last_triggered_at` set, meaning the cooldown starts even though the user never got notified.
- **No per-user rate limiting** — a malicious user with 999 rules on Premium would fan out 999 evaluations per cycle against their single location. Grid caching mitigates outbound API cost but not internal compute.
- **`notifications_sent` marker on success** is not in a transaction with the push call — if the push succeeds but the UPDATE fails, the row stays marked `notification_sent: false`. User sees the push, UI shows "Not sent". Minor UX inconsistency.

## Test Coverage
- `__tests__/engine/evaluateConditions.test.ts` — pure engine coverage: AND/OR, cooldown, empty conditions, invalid metric/operator, daily-date UTC-boundary fix.
- `__tests__/services/pollWeatherTimezone.test.ts` — `extractTimezone()` tests (null safety, type guards).
- `__tests__/services/processInBatches.test.ts` — batch concurrency helper: settles on mixed success/fail, preserves ordering, respects batch size, doesn't throw on rejection.
- No Edge Function integration tests — the Edge Functions are validated by Jimmy via `net.http_post` from the SQL editor, inspecting `net._http_response` and function logs. This is the project's accepted backend verification method per the Testing Contract.

**Verdict:** Pure logic layer has strong unit coverage. The Edge Function wrappers (DB reads, function-invokes, push dispatches) have NO automated coverage. A regression in `poll-weather`'s due-rule filter or grid grouping would go undetected by tests.
