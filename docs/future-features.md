# Future Features

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
