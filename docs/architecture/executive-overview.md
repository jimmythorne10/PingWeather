# PingWeather — Executive Overview

PingWeather is a mobile weather app that sends you a notification only when the weather meets conditions you care about — and stays quiet the rest of the time.

Most weather apps make you pull the app out of your pocket to see whether it's going to rain. PingWeather flips that model. You tell it once: "If wind exceeds 30 mph at the farm in the next 24 hours, let me know." From then on, you don't think about it. If the wind is calm, nothing happens. If the forecast says the wind is coming, you get a push notification.

## Who it's for and the problem it solves
The customers are people whose day-to-day decisions depend on upcoming weather:
- **Livestock owners** who need to protect animals, water troughs, and pipes from freezes.
- **Hunters** who track cold fronts, rain, and wind for scouting and hunt-day planning.
- **Outdoor workers and contractors** who lose a day when rain arrives unannounced.
- **Anyone** tired of checking their phone all day for weather that matters.

Generic weather apps solve the "what's the weather" question. PingWeather solves the "tell me when the weather *changes for the worse*" question. No consumer weather app on the market combines compound conditions, per-user polling, and preset templates for outdoor-life use cases.

## What makes it different
Three things:
1. **Conditional alerts**, not a weather feed. Weather conditions are set once and forgotten — you only hear from PingWeather when something actionable is coming.
2. **Compound rules**. Pro and Premium subscribers can combine conditions (e.g., "alert me if it's above 90°F *and* UV index is above 8") to filter for the moments that actually matter.
3. **Preset templates** for real-world use cases: freeze warning, hard freeze, rain delay, dangerous wind, high UV. Tap a preset and you have an alert without configuring anything.

## Subscription tiers
| Tier | Price | Locations | Alert rules | How often it checks | Conditions per alert | History |
|------|-------|-----------|-------------|--------------------|---------------------|---------|
| Free | $0 | 1 | 2 | Every 12 hours | One at a time | 7 days |
| Pro | $3.99 / month | 3 | 5 | Every 4 hours | Multiple (AND/OR) | 30 days |
| Premium | $7.99 / month | 10 | Unlimited | Every hour | Multiple (AND/OR) | 90 days |

A seventh column, SMS alerts, is reserved for Premium and planned for a future release.

## Platform and technology
PingWeather is a native Android app built with modern cross-platform tooling. A lightweight cloud backend does the heavy lifting — checking weather forecasts, evaluating every customer's alert rules, and dispatching push notifications. The customer's phone is a configuration interface and a notification receiver; nothing runs in the background to drain the battery.

## Current status
- **Live on Google Play** (internal testing track). Paying customers can install today via the testing invite.
- **Paid subscriptions** process through Google Play Billing and are managed by a third-party subscription service. First customers have successfully paid and been upgraded.
- **iOS is on the roadmap**, not yet shipped. The codebase is cross-platform; only store listing and platform-specific payment wiring remain.
- **Marketing site** hosts the privacy policy and a download link.

## What "conditional weather alert" means, concretely
Consider a cattle rancher in East Texas. They add one location ("South Pasture") in the app, then tap the "Freeze Warning" preset. That's it. Every four hours the backend fetches the weather forecast for their pasture, looks 24 hours ahead, and checks whether any hour's low temperature is below 32°F. On a typical summer day the answer is no — the app stays silent. On a November night when a cold front is coming, the forecast drops below 32°F at 3 AM two days out; the rancher's phone buzzes at 8 PM: *"Freeze Warning - South Pasture. Low temp at or below 32 (forecast: 29)."* They check troughs, wrap pipes, and sleep easy. No other weather app on their phone did that for them.

That is the entire product.

---

**Truth Centered Tech** — Virginia, US
Contact: legal@truthcenteredtech.com
