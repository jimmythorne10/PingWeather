# Future Features

## Daily / Weekly Forecast Digest Notification
**Source:** Jimmy, 2026-04-22
**Priority:** Post-MVP (high — also solves Android deep-sleep)

Send users a proactive weather summary on a schedule they choose, even when no alert has fired. Two motivations:

### 1. Android App Keep-Alive
Android aggressively kills background processes for apps that haven't had user activity. Apps with no recent notifications get deprioritized for FCM delivery — which is exactly the pipe we rely on for alert notifications. A scheduled digest keeps the FCM channel warm and signals to Android's battery optimizer that the app is actively engaged, preventing the OS from severing the connection before a real alert fires.

### 2. User Value — Proactive Forecast Digest
Users check the weather anyway. Putting a condensed 24h or 7-day outlook for their primary location into their notification shade (without opening the app) is a daily touchpoint that reinforces the app's value even on quiet days.

### Feature Scope

**New setup screen (`app/digest-settings.tsx` or inside Settings tab):**
- Toggle: Enable daily / weekly digest (off by default)
- Frequency: Daily or Weekly
- Time of day: User picks delivery time (e.g., 7:00 AM)
- Location: Which monitored location to use (default: primary)
- Content preview so users know what to expect

**Server-side (new Edge Function or extend `poll-weather`):**
- New pg_cron job: `digest-notify` running at user-configured times
- Or: store `digest_time` + `digest_frequency` on the `profiles` table and have `poll-weather` evaluate who needs a digest on each hourly run
- Pull today's / this week's forecast summary from Open-Meteo cache (already fetched hourly — no extra API cost)
- Format: high/low temp, precipitation chance, wind summary for the period
- Dispatch via Expo Push (same FCM path as alert notifications)

**DB changes:**
- `profiles` table: add `digest_enabled bool`, `digest_frequency text` (daily/weekly), `digest_hour int`, `digest_location_id uuid` (FK to locations)
- Migration needed

### Implementation Notes
- Zero extra Open-Meteo API cost — data is already cached from the polling pipeline
- Notification should be visually distinct from alert notifications (different icon/channel on Android)
- Free tier can have daily digest; weekly-only could be a Pro differentiator (or both free — it's a retention tool, not a revenue feature)
- This is the lowest-cost feature with the highest retention impact — worth prioritizing over historical tracking

## Historical Weather Accuracy Tracking
**Source:** Market research during initial standup (2026-03-31)
**Priority:** Post-MVP

Track forecast accuracy over time by comparing what was forecasted vs what actually happened. Two angles:

### 1. Alert Accuracy Score
- When an alert fires ("freeze expected tonight"), record the forecast that triggered it
- After the forecast window passes, fetch actual observed conditions from Open-Meteo's historical API
- Compare: did it actually freeze? Was the rain probability justified?
- Show users a per-rule accuracy percentage (e.g., "This rule has been 87% accurate over the last 30 days")
- Builds trust and helps users tune their thresholds (if accuracy is low, maybe raise the probability threshold)

### 2. Location-Specific Forecast Reliability
- Over time, build a picture of how reliable forecasts are for each monitored location
- Some areas have notoriously bad forecasts (mountain valleys, coastal microclimates)
- Surface this to users: "Forecasts for North Pasture are typically 12% less accurate than average beyond 48 hours"
- Could inform smart defaults (suggest shorter lookahead windows for unreliable locations)

### 3. Historical Weather Dashboard (Premium tier candidate)
- Show past weather data for monitored locations
- "What was the weather like at my hunting spot last October?"
- Useful for seasonal planning (livestock prep, planting schedules, hunting season prep)
- Pairs well with alert history to show patterns

### Implementation Notes
- Open-Meteo has a free Historical Weather API (goes back to 1940)
- Storage cost: minimal per data point, but grows with locations x days
- Natural Premium tier feature — free/pro users get current alerts, premium gets the intelligence layer
- Could eventually feed into ML-based alert suggestions ("based on 3 years of data, you typically need freeze prep by Oct 15 at this location")
