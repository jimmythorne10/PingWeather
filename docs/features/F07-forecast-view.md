# F07: Forecast View

## Overview
Three screens surface weather data from Open-Meteo (proxied via the `get-forecast` Edge Function): Home shows a compact 14-day scroll for the default location, Forecasts shows per-location expandable cards with hourly + daily tables and rule-status previews, and Day Detail drills into a single day's hour-by-hour breakdown with summary metrics.

## Screens Involved
- `app/(tabs)/index.tsx` — Home screen: horizontal-scroll forecast card, location picker modal when multiple locations exist, active-rules card, recent-notifications card
- `app/(tabs)/forecasts.tsx` — Forecasts screen: one expandable card per active location with Next-24-Hours row, 14-Day Outlook table (weather emoji, high/low, rain %, wind direction+speed), and Rule Status previews
- `app/day-detail.tsx` — Day Detail screen: summary card (emoji + high/low + rain/wind), hourly list (time, emoji, temp, rain, wind)
- `src/services/weatherApi.ts` — client wrapper calling `supabase.functions.invoke('get-forecast', { body: {...} })`
- `src/services/weatherIcon.ts` — `weatherCodeToEmoji` + `degreesToCardinal`
- `src/services/hourlyForDay.ts` — `getHourlyForDay` filter (prefix-match on YYYY-MM-DD; intentionally avoids `new Date()` because Open-Meteo returns local-timezone ISO strings)

## Data Model
No direct DB reads for forecast data on the client. All reads go through `get-forecast` Edge Function → Open-Meteo.

Reads from stores:
- `locationsStore` for list of active locations
- `alertRulesStore` for rule-status preview on Forecasts
- `settingsStore` for temperatureUnit and windSpeedUnit

## State Management
- `useLocationsStore`, `useAlertRulesStore`, `useAlertHistoryStore`, `useSettingsStore`
- Local component state: `forecasts` (Record keyed by location id), `expandedId`, `loadingIds` (Set), `refreshing` (RefreshControl), `weather` on Home

## Business Rules
- **14-day window** by default (`FORECAST_DAYS = 14` on Home and Forecasts). Open-Meteo free tier supports up to 16 days but the function caps at 7 for server-side polls.
- **"Today" / "Tomorrow"** labels for i=0, i=1; subsequent days show `{weekday, month/day}`.
- **Day-label date parsing** intentionally uses `new Date(y, m-1, d)` (local-date constructor) rather than `new Date("YYYY-MM-DD")` — the latter is UTC midnight and drifts to the previous day in western timezones (documented in inline code comments and in the project's CLAUDE.md critical rules).
- **`getHourlyForDay`** uses `str.startsWith("YYYY-MM-DD")` — see rule above.
- **Rule-status preview** (`ruleWouldTrigger`) on Forecasts is a SIMPLIFIED client-side evaluator that only covers `temperature_high`, `temperature_low`, `precipitation_probability`, `wind_speed`. Other metrics (humidity, feels_like, UV, current temp) are silently ignored in the preview. The authoritative evaluation is server-side.
- **Unit symbols**: `°F`/`°C` from `temperatureUnit`; `mph`/`kmh`/`knots` from `windSpeedUnit`.
- **Weather code → emoji** mapping uses the WMO code table from Open-Meteo.

## API Interactions
| Call | Endpoint | Auth |
|------|----------|------|
| Fetch forecast | `supabase.functions.invoke('get-forecast', { body: { latitude, longitude, forecast_days, temperature_unit, wind_speed_unit, hourly: [...], daily: [...] } })` | user JWT (Edge Function has `verify_jwt = true`) |

The Edge Function itself calls Open-Meteo with the server-held `OPEN_METEO_API_KEY` secret (commercial endpoint when set, free fallback otherwise).

## Error Handling
- `fetchForecast` throws; callers catch and either log + silent-fail (Home, Forecasts) or set local `error` state (Day Detail — shows a proper error card).
- "Unable to load weather data" placeholder when state is null after load attempt.
- Day Detail has a specific "Date not in forecast window" state when the requested date is past the 14-day horizon.
- Component cleanup via `cancelled` flag in Day Detail guards against setting state after unmount.

## Edge Cases — Handled
- No active locations → empty-state card on Forecasts with "Add Location" CTA; Home shows "Add a location to see weather conditions."
- Single location vs multiple — Home shows location name directly when single, picker when > 1.
- `RefreshControl` pull-to-refresh clears the `forecasts` record on Forecasts to force a re-fetch.
- Expansion is lazy — forecast is only loaded when the user taps to expand, not on mount.
- Stale-forecast prevention on Day Detail via `cancelled` flag.
- Wind direction rendered as compass cardinal (`degreesToCardinal`) for human readability.

## Edge Cases — NOT Handled (Gaps)
- **Silent fetch failures** on Home and Forecasts — "fail silently" is the literal comment in the catch block. The UI degrades to "Unable to load weather data." but doesn't explain why or offer retry.
- **Rate-limit storms**: expanding 10 locations on Forecasts fans out 10 sequential Open-Meteo calls via the proxy (one per expansion). No client-side throttle or coalescing.
- **Stale cache**: `forecasts` record is never invalidated within the session; pulling to refresh clears it, but a rule with a short polling interval could see server-evaluated forecasts that differ from what the client showed seconds earlier.
- **Unit preference races**: `useEffect` depends on `temperatureUnit` and `windSpeedUnit`, but changing them re-fetches for every visible card simultaneously — no debounce.
- **Rule-status preview incompleteness**: humidity/UV/feels-like/current-temp rules always show "Clear" in the preview, even if server evaluation would trigger. Misleading.
- **No "last updated" timestamp** on forecast cards — users can't tell how fresh the data is.
- **No offline handling** — if Open-Meteo is down, all three screens show either a spinner indefinitely or the silent-fail placeholder.
- **Day Detail `weather_code` usage** assumes the field is present; Open-Meteo returns it when requested, but a missing field would throw on `hoursForDay.weather_code[i]`.

## Test Coverage
- `__tests__/data/weatherApi.test.ts` — validates `fetchForecast` shape and error path (assumes mocked `supabase.functions.invoke`).
- `__tests__/services/weatherIcon.test.ts` — covers the WMO code mapping and cardinal conversion for all boundary values.
- `__tests__/services/hourlyForDay.test.ts` — validates prefix-match semantics and index alignment across multi-day arrays.
- `__tests__/screens/home.test.tsx`, `forecasts.test.tsx` — jsdom text-presence only.

**Verdict:** Pure-logic helpers (weatherIcon, hourlyForDay) have strong coverage. The screen-level interaction with the store + Edge Function proxy is not validated — a regression where `fetchForecast` silently returns undefined would produce the "Unable to load" state in dev-build testing but nothing catches it automatically.
