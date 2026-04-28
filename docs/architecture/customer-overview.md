# PingWeather — Customer Overview

This is a plain-English tour of what PingWeather does and how you use it. For the short version: PingWeather is a mobile app that sends you a push notification when the weather forecast hits conditions you care about — and otherwise stays silent.

## The user journey, end to end

**1. Install.** Download PingWeather from Google Play. (iOS is coming.)

**2. Create your account.** Sign up with an email and password. No phone number, no social login gates. You'll see a brief privacy-highlights screen and a Terms of Use that you read and accept.

**3. Add your first location.** This is a geographic point — an address, a GPS coordinate, a city. "Home", "North Pasture", "Job Site #3" — anything meaningful to you. Three ways to set it:
- Tap "Use My Current Location" — uses your phone's GPS right now.
- Type a place name — the app autocompletes as you type. Pick from the dropdown.
- Enter latitude and longitude manually.

**4. Enable push notifications.** PingWeather asks for permission to send you notifications. This is how alerts reach you — so if you skip this step, the app becomes an expensive weather viewer. Android also prompts you to turn off battery restrictions so alerts arrive reliably.

**5. Create your first alert.** Open the Alerts tab. You'll see a library of presets — "Freeze Warning", "Rain Likely", "High Wind", "Dangerous Wind", "Rain Delay Risk", "High UV Index", etc. Tap one. Pick the location it applies to. Confirm. That's it — the alert is active.

**6. Get your first notification.** When the next forecast check finds that your conditions are met, your phone buzzes with something like *"Freeze Warning — North Pasture. Low temp at or below 32 (forecast: 29)."* You tap it and see the details. That was the point.

## Every feature you can use

### Locations
A list of the geographic points you monitor. Each has a name, latitude/longitude, a "default" marker (the one the Home screen shows first), and an active/inactive toggle. Free users get 1 location; Pro users get 3; Premium users get 10. Delete a location and any alerts attached to it go with it.

### Alert rules
These are the "if this, then notify me" statements. Each rule has:
- **A name** ("Freeze Warning").
- **A location** it watches.
- **One or more conditions** — metric (temperature, rain chance, wind speed, humidity, feels-like, UV index), operator (above, below, at-or-above, etc.), and threshold value (e.g., `wind speed > 30 mph`).
- **A lookahead window** — how far into the future to check. Options from 6 hours to 7 days.
- **A polling interval** — how often PingWeather checks the forecast for this rule. Free: minimum 12 hours; Pro: 4 hours; Premium: 1 hour.
- **A cooldown** — after the rule fires, how long before it can fire again. Prevents spamming you when conditions stay bad for a while.

Pro and Premium can combine conditions — "rain chance above 60% **AND** wind speed above 20 mph" (both must be true) or "temperature above 95°F **OR** UV index above 9" (either triggers). Free-tier rules allow one condition at a time.

### Preset alerts
Ten pre-built templates for common use cases, grouped by category:
- **Temperature:** Freeze Warning (<32°F), Hard Freeze (<20°F), Extreme Heat (>100°F), Cold Front Incoming.
- **Precipitation:** Rain Likely (>70% chance in 24h), Rain Possible (>50% chance in 3 days).
- **Wind:** High Wind (>25 mph), Dangerous Wind (>40 mph).
- **Work & Safety:** Rain Delay Risk, High UV Index.

Tap any preset, pick a location, and it becomes a rule you can edit or delete later.

### Custom alert builder
If none of the presets match, the custom builder lets you construct any rule from scratch. Pick metric, pick operator, enter a threshold, set lookahead and polling and cooldown, add more conditions if you're on Pro or Premium, save. A plain-English summary at the bottom of the screen explains in words what the rule will do.

### Forecast view
Three places to see the weather:
- **Home tab** — the default location's 14-day horizontal-scrolling forecast, plus your active alerts and the last few alerts that fired.
- **Forecasts tab** — every active location as an expandable card. Tap to reveal a 24-hour hourly row, a 14-day outlook table (weather icon, high/low, rain chance, wind direction + speed), and a "Rule Status" preview that shows which of your alerts would fire based on current forecasts.
- **Day Detail screen** — tap any day in the 14-day outlook to drill into hourly details for that day, plus high/low, rain chance, and wind range.

### Alert history
Every time an alert fires, PingWeather logs it. The History screen shows the rule name, the location, the plain-English condition that was met ("Wind speed at or above 25 (forecast: 32)"), the timestamp, and whether the push notification was actually sent. History retention is tier-based:
- Free: 7 days
- Pro: 30 days
- Premium: 90 days

### Forecast digest
An opt-in daily or weekly push with a quick forecast summary for your chosen location. Enabled in Settings. Two reasons to turn it on:
1. You like a quick weather heads-up every morning at 7 AM (or whatever hour you pick).
2. Android is aggressive about silencing apps that don't do anything for a while. A daily digest keeps PingWeather in Android's active bucket so your *real* alerts arrive reliably.

You pick:
- Frequency: daily or weekly.
- Day of week (weekly only).
- Hour of day (local time at your digest location).
- Which location to digest.

### Settings
Everything configurable in one place:
- Account info and current plan.
- Upgrade / manage plan.
- Temperature unit (Fahrenheit or Celsius). The app and your notifications respect your choice.
- Wind speed unit (mph, km/h, or knots).
- Theme: Classic (bright), Dark, or Storm (moody blue-gray).
- Push notifications toggle.
- Forecast digest configuration.
- Jump to alert history.
- Terms of Use and Privacy Policy.
- Delete account.
- Sign out.

### Subscription & billing
Subscriptions are processed by Google Play (Billing by Google) and managed by a third-party subscription platform. In the app, tap "Upgrade" (or the plan CTA in Settings) to see the tier cards. Tap Subscribe → go through Google's normal purchase sheet → confirm. The app updates your plan in a few seconds (sometimes a minute) after a successful purchase.

Moved to a new phone? Tap "Restore Purchases" on the Upgrade screen; PingWeather asks Google what you've bought and updates your plan accordingly.

Cancel or change your plan? Open Google Play → Subscriptions — that's where Google keeps renewal and cancellation controls. Your plan stays active through the end of the billing period.

## How alerts actually work (in one paragraph)
Every hour, a backend service fetches the latest forecast from a weather data provider for each location your rules cover. For every rule, the service looks ahead (your lookahead window — 6 hours to 7 days), checks whether your condition is met at *any* point in that window, and if yes, sends you a push notification. A cooldown prevents the same rule from firing again too soon — so if it's going to be below freezing for three nights in a row, you get one warning, not three. All of this happens on our servers, not on your phone, so it works even when your phone is asleep.

## When an alert fires
- **Timing:** alerts land within minutes of the scheduled polling check. For hourly Premium rules, the maximum delay between "condition becomes forecast-true" and "your phone buzzes" is about one hour.
- **Format:** the notification title shows the rule name and location ("Freeze Warning - South Pasture"). The body shows what triggered it ("Low temp at or below 32 (forecast: 28)"). Android shows it with vibration and sound; iOS will do the same once iOS launches.

## Privacy
We collect the minimum needed to deliver alerts:
- **Email and display name** for account login.
- **Location coordinates** you explicitly save. We do NOT continuously track your device. Adding a location by GPS uses your phone's location once, then stores only the resulting latitude and longitude.
- **Push notification token** so we can deliver alerts to your device.
- **Your alert rules** so we can evaluate them server-side.
- **Alert history** so we can show you what fired and when.

We do not sell data. We do not show ads. We do not share location data with third parties. The privacy policy is in-app (Settings → Privacy Policy) and publicly hosted at truthcenteredtech.com/pingweather-privacy.

Account deletion is one button in Settings. Tap it, confirm, and your account + all locations + all rules + all history are permanently removed from our database.

## Known limitations / where to get support
- **Weather data accuracy** — PingWeather supplements but never replaces official weather warnings (NWS in the US). Forecasts are inherently uncertain, especially beyond 48 hours.
- **Notification delivery depends on your device settings.** Android battery-optimization whitelisting is critical; the app guides you through it during onboarding. If notifications aren't arriving, check Settings → Apps → PingWeather → Battery → Unrestricted.
- **Single device per account.** Signing in on a second device replaces the first device's notification registration — only the most recently registered device gets pushes.
- **iOS not yet shipped.**
- **SMS alerts for Premium** — listed on the pricing page with a "coming soon" note.

Support: email support@truthcenteredtech.com (or legal@ / privacy@ for the specific thing) and we'll get back to you.

---

**Truth Centered Tech**, Virginia, US.
