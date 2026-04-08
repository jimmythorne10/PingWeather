# PingWeather — Product Requirements Document

**Version:** 1.0.0-MVP
**Last Updated:** 2026-04-07
**Author:** Truth Centered Tech
**Status:** Draft — MVP Definition

---

## 1. Product Overview

### 1.1 Vision
PingWeather is a mobile weather notification app that alerts users when custom weather conditions are met. Users define what weather matters to them, where they care about it, and how often to check — and the app handles the rest.

### 1.2 Problem Statement
No consumer weather app offers compound conditional alerts with user-defined polling intervals. Livestock owners manually check weather.gov every morning for freeze risk. Construction managers have no way to get proactive rain delay warnings for specific job sites. Outdoor workers and hobbyists waste time checking forecasts repeatedly instead of being notified when conditions actually change.

Enterprise solutions (DTN, WeatherSentry) serve agriculture but cost hundreds per month and are not consumer-friendly.

### 1.3 Target Users (MVP)
- **Livestock owners** — freeze alerts for water troughs, heat stress for animals
- **Outdoor workers** — rain delay risk, high wind safety, UV exposure
- **Property owners** — freeze warnings for pipes, severe weather prep
- **General users** — anyone who wants proactive weather notifications instead of manual checking

### 1.4 Entity
Truth Centered Tech, Delaware, US
- Legal: legal@truthcenteredtech.com
- Privacy: privacy@truthcenteredtech.com

---

## 2. User Flows

### 2.1 Authentication

#### FR-AUTH-001: Email/Password Sign Up
- **Given** a user on the signup screen
- **When** they enter display name, email, and password and tap "Sign Up"
- **Then** an account is created, a profile record is auto-generated, and the user is redirected to onboarding
- **Acceptance Criteria:**
  - Display name is stored in profile
  - Email confirmation is disabled for MVP (auto-confirm)
  - Password minimum requirements enforced by Supabase defaults
  - Error messages displayed for duplicate email, weak password, network failure

#### FR-AUTH-002: Email/Password Sign In
- **Given** a user with an existing account on the login screen
- **When** they enter email and password and tap "Sign In"
- **Then** session is created, profile is loaded, and user is routed based on onboarding status
- **Acceptance Criteria:**
  - If onboarding incomplete → redirect to /onboarding/welcome
  - If onboarding complete → redirect to main app
  - Error messages for invalid credentials, network failure
  - Loading state shown during authentication

#### FR-AUTH-003: Session Persistence
- **Given** a user who has previously signed in
- **When** they reopen the app
- **Then** their session is automatically restored without re-entering credentials
- **Acceptance Criteria:**
  - JWT tokens stored in native OS secure storage (Keychain/Keystore)
  - Token refresh handled automatically by Supabase client
  - If session expired or invalid → redirect to login

#### FR-AUTH-004: Forgot Password
- **Given** a user on the login screen who has forgotten their password
- **When** they tap "Forgot Password?"
- **Then** they are prompted to enter their email and a password reset link is sent
- **Acceptance Criteria:**
  - "Forgot Password?" link visible on login screen below the sign in button
  - Tapping opens a simple screen/modal with email input and "Send Reset Link" button
  - Calls Supabase `resetPasswordForEmail()` 
  - Success message: "If an account exists for that email, we've sent a reset link. Check your inbox."
  - Does NOT confirm whether the email exists (security — prevents account enumeration)
  - Error handling for network failure
  - Password reset is handled by Supabase's built-in email flow — no custom reset screen needed in the app

#### FR-AUTH-005: Sign Out
- **Given** an authenticated user on the settings screen
- **When** they tap "Sign Out"
- **Then** session is cleared and user is redirected to login screen
- **Acceptance Criteria:**
  - All local session state cleared
  - Cached data in AsyncStorage is NOT cleared (locations/rules cache for fast reload on re-login)

### 2.2 Onboarding

#### FR-ONBOARD-001: Onboarding Gate
- **Given** an authenticated user whose profile has `onboarding_completed = false`
- **When** they attempt to access the main app
- **Then** they are redirected to the onboarding welcome screen
- **Acceptance Criteria:**
  - Gate enforced at root layout level
  - Cannot bypass by navigating directly to /(tabs)

#### FR-ONBOARD-002: Welcome Screen
- **Given** a new user entering onboarding
- **When** the welcome screen loads
- **Then** they see the app name "PingWeather", tagline, and 4 key value propositions
- **Acceptance Criteria:**
  - App name displayed as "PingWeather" (not WeatherWatch or any other name)
  - Tagline: "Weather alerts on your terms." (or similar — must be consistent with login screen)
  - "Get Started" button navigates to privacy screen
  - No skip option — must proceed through flow

#### FR-ONBOARD-003: Privacy Explanation
- **Given** a user on the privacy screen
- **When** the screen loads
- **Then** they see 4 privacy commitment cards: location privacy, minimal data, deletion control, transparent policies
- **Acceptance Criteria:**
  - "Continue" button navigates to EULA screen
  - Informational only — no user action required beyond proceeding

#### FR-ONBOARD-004: EULA Acceptance
- **Given** a user on the EULA screen
- **When** they scroll through and tap "I Accept"
- **Then** the EULA version and acceptance timestamp are recorded in their profile
- **Acceptance Criteria:**
  - Full EULA text displayed in scrollable container
  - Version number and effective date shown
  - `eula_accepted_version` and `eula_accepted_at` written to profile
  - Cannot proceed without tapping "I Accept"

#### FR-ONBOARD-005: Location Setup
- **Given** a user on the location setup screen
- **When** they add a location or skip
- **Then** the location is saved to Supabase (if provided) and user proceeds to notification setup
- **Acceptance Criteria:**
  - Three ways to set coordinates (same as FR-LOC-002):
    1. "Use My Current Location" — GPS
    2. Address/place search — Open-Meteo Geocoding API with autocomplete
    3. Manual lat/long entry
  - Location name is required if coordinates are provided (auto-suggested from geocoding)
  - "Skip for now" proceeds without saving
  - Location saved with user_id, automatically set as default (first location)

#### FR-ONBOARD-006: Notification Permission
- **Given** a user on the notification setup screen
- **When** they tap "Enable Notifications"
- **Then** OS push notification permission is requested and push token is registered
- **Acceptance Criteria:**
  - Android notification channel "weather-alerts" created with high importance
  - Expo push token obtained and sent to register-push-token Edge Function
  - Graceful failure in Expo Go (shows informative error, not crash)
  - "I'll do this later" skips to completion screen

#### FR-ONBOARD-007: Onboarding Completion
- **Given** a user on the completion screen
- **When** they tap "Start Using PingWeather"
- **Then** `onboarding_completed` is set to true and they are redirected to the main app
- **Acceptance Criteria:**
  - Profile updated in Supabase
  - Profile refetched to ensure auth gate sees the update
  - Redirects to / which renders the tabs layout

### 2.3 Locations

#### FR-LOC-001: View Locations
- **Given** an authenticated user on the Locations tab
- **When** the screen loads
- **Then** all saved locations are displayed with name, coordinates, active/inactive status
- **Acceptance Criteria:**
  - Shows location count vs. tier limit (e.g., "1/1 locations (free tier)")
  - Each location card shows name, lat/long (4 decimal places), toggle switch, delete option
  - Empty state shown when no locations exist

#### FR-LOC-002: Add Location
- **Given** a user who has not reached their tier's location limit
- **When** they tap "+ Add" and provide a location
- **Then** the location is saved to Supabase and appears in the list
- **Acceptance Criteria:**
  - Three ways to set coordinates:
    1. **"Use My Current Location"** — requests GPS permission, populates coordinates and suggests a name
    2. **Address/place search** — text input with autocomplete using Open-Meteo Geocoding API (free, no key). User types a place name or address, selects from results, coordinates auto-populated
    3. **Manual lat/long entry** — direct coordinate input as fallback
  - Name is required (auto-suggested from geocoding result but editable)
  - user_id automatically set from auth state
  - New location prepended to list
  - If this is the user's first location, it is automatically set as default (FR-LOC-006)
  - "Save Location" button disabled when required fields are empty

#### FR-LOC-003: Toggle Location Active/Inactive
- **Given** a user with a saved location
- **When** they toggle the switch
- **Then** the location's `is_active` flag is updated in Supabase
- **Acceptance Criteria:**
  - Inactive locations are not evaluated during weather polling
  - Toggle state persists across app restarts

#### FR-LOC-004: Remove Location
- **Given** a user with a saved location
- **When** they tap the trash can icon and confirm
- **Then** the location and all associated alert rules are deleted
- **Acceptance Criteria:**
  - Delete action represented by a trash can icon (consistent with alert rule deletion)
  - Confirmation dialog warns that associated alert rules will also be deleted
  - Cascading delete removes alert rules for that location (database-level)
  - Location removed from UI list immediately
  - If the deleted location was the default, the next remaining location becomes the default

#### FR-LOC-005: Tier Downgrade Handling
- **Given** a user downgrades their subscription tier (e.g., Pro → Free)
- **When** they now have more locations than their new tier allows
- **Then** excess locations are automatically deactivated, not deleted
- **Acceptance Criteria:**
  - Excess locations set to `is_active = false` (keeps data, stops evaluation)
  - Default location remains active; excess deactivated by most-recently-created-first
  - Alert rules on deactivated locations also stop evaluating (location is_active = false cascades to polling logic)
  - User sees a banner: "You have [N] inactive locations. Upgrade to reactivate them."
  - User can manually choose which locations to keep active (swap one active for one inactive) as long as they stay within the new tier limit
  - Same logic applies to alert rules exceeding the new tier limit — excess rules deactivated, not deleted
  - Deactivated items remain visible in the UI (dimmed/greyed) as an upsell touchpoint
  - No data is destroyed on downgrade

#### FR-LOC-006: Tier Limit Enforcement
- **Given** a user at their location limit
- **When** they try to add another location
- **Then** the "+ Add" button is hidden and a tier limit warning is shown
- **Acceptance Criteria:**
  - Free: 1, Pro: 3, Premium: 10
  - Warning text indicates current tier and suggests upgrade

#### FR-LOC-007: Timezone Display
- **Given** a user viewing forecast data for a location in a different timezone than their device
- **When** the forecast renders times (hourly forecast, alert trigger times, etc.)
- **Then** times are shown in the location's timezone with a visible timezone label
- **Acceptance Criteria:**
  - All forecast times rendered in the location's local timezone (not device timezone)
  - Timezone abbreviation shown wherever times appear (e.g., "6:00 AM MST", "Tuesday 2 PM CST")
  - If the location's timezone differs from the device timezone, a subtle indicator is shown (e.g., "Times shown in MST" on the forecast detail header)
  - Open-Meteo returns timezone via `timezone=auto` based on coordinates — store this on the location record
  - Alert history timestamps also show the location's timezone for context
  - Locations table needs a `timezone` text column (populated from Open-Meteo response on location creation)

#### FR-LOC-008: Default Location
- **Given** a user with one or more locations
- **When** they view the Locations tab
- **Then** one location is marked as the default, used by the Home forecast card
- **Acceptance Criteria:**
  - Each location card has a "Set as default" option (or star/pin icon)
  - Default location visually indicated (e.g., star icon, "Default" badge)
  - Only one location can be default at a time
  - First location added is automatically set as default
  - Default location is used by FR-HOME-001 forecast card on initial load
  - Default status stored in Supabase (new `is_default` boolean on locations table)
  - If the default location is deleted, the next remaining location becomes default

### 2.4 Alert Rules

#### FR-ALERT-001: View Alert Rules
- **Given** an authenticated user on the Alerts tab
- **When** the screen loads
- **Then** alert rules are displayed as a filterable list with compact cards
- **Acceptance Criteria:**
  - Filter toggle at top: All / Active / Inactive (default: All)
  - Shows rule count vs. tier limit (e.g., "2/2 rules (free tier)")
  - Rule cards are compact — single row per rule where possible:
    - Left: rule name + condensed condition summary (e.g., "Low < 32°F, every 4h")
    - Right: active/inactive toggle + trash can icon
  - Tapping a rule card navigates to the rule editor pre-populated with that rule's values
  - Trash can icon triggers confirmation dialog before delete
  - Cards should maximize screen real estate — minimal padding, no excessive whitespace
  - Last triggered date shown as subtle secondary text only if rule has fired before

#### FR-ALERT-002: Create Rule from Preset
- **Given** a user with at least one location who hasn't reached their rule limit
- **When** they select a category from the preset dropdown and tap a preset card
- **Then** a confirmation dialog shows the preset details and creates the rule on confirm
- **Acceptance Criteria:**
  - Preset categories presented in a combobox/dropdown selector (not grouped sections requiring scroll)
  - Dropdown options: Temperature, Precipitation, Wind, Work & Safety
  - Selecting a category filters the preset list to show only that category's presets
  - Default selection: show all presets or first category
  - Dialog shows preset name, description, conditions, and configuration
  - Polling interval adjusted to tier minimum if preset default is lower
  - If user has one location, it is used automatically
  - If user has multiple locations, the confirmation dialog includes a location picker to select which location to monitor
  - Rule saved to Supabase with user_id and location_id
  - New rule appears in active rules list

#### FR-ALERT-003: Create Custom Rule
- **Given** a user who taps "+ Build Custom Alert Rule"
- **When** the create-rule screen loads
- **Then** they can configure all aspects of an alert rule via a visual builder
- **Acceptance Criteria:**
  - Rule name input (required)
  - Location selector (chip-style, highlights selected)
  - Condition builder with:
    - Metric selector (8 options: daily high/low temp, hourly temp, rain chance, wind speed, humidity, feels like, UV index)
    - Operator selector (5 options: above, at or above, below, at or below, exactly)
    - Value input (numeric, with unit label)
  - Add/remove conditions (compound requires Pro+ tier)
  - AND/OR logical operator toggle (when multiple conditions)
  - Lookahead window selector (6h, 12h, 1d, 2d, 3d, 5d, 7d)
  - Polling interval selector (filtered by tier minimum)
  - Cooldown selector (4h, 6h, 12h, 24h, 48h)
  - Plain-English summary preview
  - Save/Cancel buttons

#### FR-ALERT-004: Plain-English Rule Summary
- **Given** a user configuring a custom rule
- **When** they change any parameter
- **Then** a summary card updates in real-time showing what the rule will do in natural language
- **Acceptance Criteria:**
  - Format: "We'll check the forecast for [location] [frequency]. If [conditions] anytime in the next [lookahead], you'll get a notification. After alerting you, we'll wait at least [cooldown] before notifying you again for this rule."
  - All technical values translated to human-readable text (e.g., "every 4 hours" not "4h", "half a day" not "12h")
  - Updates reactively as user changes any field

#### FR-ALERT-005: Toggle Alert Rule
- **Given** a user with an active alert rule
- **When** they toggle the switch
- **Then** the rule's `is_active` flag is updated
- **Acceptance Criteria:**
  - Inactive rules are not evaluated during weather polling
  - Toggle state persists

#### FR-ALERT-006: Delete Alert Rule
- **Given** a user with a saved alert rule
- **When** they tap the trash can icon and confirm
- **Then** the rule is deleted from Supabase
- **Acceptance Criteria:**
  - Delete action represented by a trash can icon (not text)
  - Confirmation dialog before deletion
  - Rule removed from UI immediately
  - Associated alert history entries retain rule_name (rule_id set to null on delete)

#### FR-ALERT-007: Tier Limit Enforcement (Rules)
- **Given** a user at their alert rule limit
- **When** they try to create another rule
- **Then** preset cards are disabled, custom builder shows limit warning
- **Acceptance Criteria:**
  - Free: 2 rules, Pro: 5, Premium: unlimited
  - Presets visually dimmed at 50% opacity
  - Custom builder button hidden
  - Warning shows current tier and limit

#### FR-ALERT-008: Edit Existing Rule
- **Given** a user taps an existing rule card on the Alerts tab (or from the Home active alerts summary)
- **When** the create-rule screen loads
- **Then** the form is pre-populated with the rule's current values and saves as an update (not a new rule)
- **Acceptance Criteria:**
  - All fields pre-populated: name, location, conditions, logical operator, lookahead, polling, cooldown
  - Location can be changed during edit (not locked after creation)
  - Screen title shows "Edit Alert Rule" (not "Custom Alert Rule")
  - Save button shows "Save Changes" (not "Create Alert Rule")
  - On save, updates the existing rule via alertRulesStore.updateRule()
  - Cancel returns to previous screen without saving
  - Plain-English summary updates reactively as user edits

#### FR-ALERT-009: Clone Rule
- **Given** a user with an existing alert rule
- **When** they tap the clone icon on a rule card
- **Then** the rule editor opens pre-populated with the cloned rule's values, ready to save as a new rule
- **Acceptance Criteria:**
  - Clone icon on each rule card (next to trash icon)
  - Opens create-rule screen with all fields pre-populated from the source rule
  - Name pre-filled as "[Original Name] (copy)" — editable
  - Location defaults to the source rule's location but can be changed (primary use case: same rule, different location)
  - Screen title: "Clone Alert Rule"
  - Save button: "Create Alert Rule" (not "Save Changes" — this creates a new rule, not an edit)
  - Respects tier limits — if user is at their rule limit, clone is disabled with tier warning
  - Source rule is not modified

#### FR-ALERT-010: Compound Conditions (Pro+)
- **Given** a Free tier user building a custom rule
- **When** they tap "+ Add Condition"
- **Then** they see an upgrade alert explaining compound conditions require Pro
- **Acceptance Criteria:**
  - Free users limited to single-condition rules
  - Pro/Premium users can add multiple conditions with AND/OR logic
  - AND: all conditions must be met simultaneously
  - OR: any condition can trigger the alert

### 2.5 Home (formerly Dashboard)

> **Note:** The bottom tab is labeled "Home" (not "Dashboard"). This is the app's landing screen.

#### FR-HOME-001: Forecast Card (Collapsed)
- **Given** a user with at least one active location
- **When** the Home screen loads
- **Then** a "Forecast" card shows a compact 3-day forecast for the selected location
- **Acceptance Criteria:**
  - Card title is "Forecast" with a location picker dropdown showing the current location name
  - Location picker allows switching between all active locations (for Pro/Premium users with multiple)
  - Defaults to the user's default location (see FR-LOC-006)
  - Shows day label (Today, Tomorrow, day name), high temp, low temp, rain percentage
  - Temperature displayed in user's chosen unit (°F or °C)
  - Weather condition icons displayed for each day (sunny, partly cloudy, cloudy, rainy, stormy, snowy, etc.) derived from forecast data
  - Loading spinner while fetching
  - Error state if API call fails
  - Data sourced from Open-Meteo API
  - Card is tappable — see FR-HOME-002

#### FR-HOME-002: Forecast Card (Expanded — 14-Day View)
- **Given** a user viewing the Forecast card on the Home screen
- **When** they tap the Forecast card
- **Then** the card expands to show a 14-day forecast in a horizontally scrollable view
- **Acceptance Criteria:**
  - Fetches 14-day forecast from Open-Meteo (max supported: 16 days)
  - Horizontal scroll for days that overflow the screen width
  - Each day shows: weather condition icon, day name, date, high temp, low temp, rain probability, wind speed
  - Weather icons map to WMO weather codes from Open-Meteo (clear, partly cloudy, overcast, fog, drizzle, rain, snow, thunderstorm, etc.)
  - Tapping again or a collapse control returns to the compact 3-day view
  - Smooth transition between collapsed and expanded states
  - Location picker persists — user can switch locations in expanded view too

#### FR-HOME-003: Active Alerts Summary
- **Given** a user with alert rules configured
- **When** the Home screen loads
- **Then** a summary card shows count and list of active rules
- **Acceptance Criteria:**
  - Count badge showing number of active rules
  - Up to 3 rules shown with name and polling interval
  - Each individual rule row is tappable — navigates to that rule's detail/edit view
  - Tapping the "Active Alerts" card header or "+N more..." navigates to the Alerts tab
  - "Create Alert" button if no rules exist

#### FR-HOME-004: Recent Notifications
- **Given** a user with alert history
- **When** the Home screen loads
- **Then** the 5 most recent triggered alerts are displayed
- **Acceptance Criteria:**
  - Each entry shows rule name, conditions summary, and date
  - "View all history" link navigates to the full alert history screen (sub-screen, not a tab)
  - Empty state when no notifications exist

#### FR-HOME-005: First-Run Empty States
- **Given** a new user who has just completed onboarding (possibly with no location or rules)
- **When** the Home screen loads
- **Then** guided prompts replace empty cards to drive first actions
- **Acceptance Criteria:**
  - No locations: Forecast card shows "Add your first location to see the forecast" with an "Add Location" button that navigates to Locations tab
  - No alert rules: Active Alerts card shows "Set up your first alert so we can ping you when weather changes" with a "Create Alert" button that navigates to Alerts tab
  - No history: Recent Notifications card shows "No notifications yet — we'll show them here when your alerts trigger"
  - Each empty state has a clear single call-to-action, not just placeholder text
  - Once the user has locations and rules, empty states are replaced with real data

### 2.6 Forecasts

> **Note:** Forecasts replaces the History tab. The Forecasts tab shows detailed weather for all monitored locations. Alert history is accessible as a sub-screen from Home's "View all history" link or from Settings.

#### FR-FORECAST-001: All Locations Overview
- **Given** a user with one or more active locations
- **When** they open the Forecasts tab
- **Then** all locations are displayed with current conditions at a glance
- **Acceptance Criteria:**
  - Each location shown as a card with: location name, current temperature, weather condition icon, today's high/low, rain probability
  - Cards ordered by default location first, then alphabetically
  - Tapping a location card opens the detailed forecast view (FR-FORECAST-002)
  - Pull-to-refresh reloads all location forecasts
  - Loading spinner on initial fetch
  - Empty state if no locations: "Add a location to see forecasts" with button to Locations tab

#### FR-FORECAST-002: Location Detail Forecast
- **Given** a user taps a location card on the Forecasts tab
- **When** the detail view loads
- **Then** a full hourly and daily forecast is displayed for that location
- **Acceptance Criteria:**
  - Location name as screen title
  - **Hourly forecast** (next 24-48 hours): horizontally scrollable, each hour shows time, temp, weather icon, rain %, wind speed
  - **Daily forecast** (14 days): vertically scrollable list, each day shows day name, date, weather icon, high/low temp, rain probability, wind speed
  - All values respect user's unit preferences (°F/°C, mph/kmh/knots)
  - Weather icons mapped from Open-Meteo WMO weather codes
  - Back navigation to Forecasts overview

#### FR-FORECAST-003: Rule Trigger Preview
- **Given** a user viewing a location's detailed forecast
- **When** active alert rules exist for that location
- **Then** a "Rule Status" section shows which rules would or would not trigger based on the current forecast
- **Acceptance Criteria:**
  - Each rule for this location listed with its name and a status indicator:
    - Green checkmark + "Clear" — current forecast does not trigger this rule
    - Orange warning + "Would trigger" — current forecast WOULD trigger this rule, with the specific condition and value that matches (e.g., "Low of 28°F tomorrow — below your 32°F threshold")
  - Tapping a rule navigates to the rule editor
  - This is a preview only — it does not fire alerts or create history entries
  - Gives users confidence the system is configured correctly without waiting for a real trigger

#### FR-FORECAST-004: Alert History (Sub-Screen)
- **Given** a user taps "View all history" from Home, or navigates to history from Settings
- **When** the alert history screen loads
- **Then** up to 100 alert history entries are displayed, newest first
- **Acceptance Criteria:**
  - Each entry shows: rule name, location name, conditions met summary, timestamp, notification sent status
  - Shows tier-based retention period (7d free, 30d pro, 90d premium)
  - Empty state when no history exists
  - Loading spinner during fetch
  - This is a stack screen (not a tab) — back button returns to previous screen

### 2.7 Settings

> **Note:** Settings is a visible bottom tab (not hidden behind a gear icon on Home). It has its own tab with a gear icon.

#### FR-SET-001: Account Info
- **Given** an authenticated user on the Settings tab
- **When** the screen loads
- **Then** email and subscription tier are displayed
- **Acceptance Criteria:**
  - Email shown (read-only)
  - Tier shown with first letter capitalized
  - Current tier's limits summarized (locations, rules, polling, history retention)

#### FR-SET-002: Unit Preferences
- **Given** a user on the Settings tab
- **When** they tap a unit toggle
- **Then** the preference is saved and applied throughout the app
- **Acceptance Criteria:**
  - Temperature: Fahrenheit or Celsius (default: °F)
  - Wind Speed: mph, km/h, or knots (default: mph)
  - Persisted to AsyncStorage
  - Home forecast and alert conditions use selected units

#### FR-SET-003: Theme Selection
- **Given** a user on the Settings tab
- **When** they select a theme
- **Then** the entire app UI updates to the selected theme
- **Acceptance Criteria:**
  - Three options: Classic (navy), Dark, Storm (electric blue)
  - Theme applied immediately across all screens
  - Persisted to AsyncStorage

#### FR-SET-004: Notification Toggle
- **Given** a user on the Settings tab
- **When** they toggle notifications off
- **Then** the preference is saved locally
- **Acceptance Criteria:**
  - Toggle persisted to AsyncStorage
  - Note: this is a local preference; server-side push delivery is controlled by push_token presence

#### FR-SET-005: Legal Document Access
- **Given** a user on the Settings tab
- **When** they tap "Terms of Use" or "Privacy Policy"
- **Then** the full legal document is displayed in a scrollable screen
- **Acceptance Criteria:**
  - Version and effective date shown
  - All sections rendered with title and body
  - Back navigation to settings

#### FR-SET-006: Alert History Access
- **Given** a user on the Settings tab
- **When** they tap "Alert History"
- **Then** the full alert history screen (FR-FORECAST-004) is displayed
- **Acceptance Criteria:**
  - Navigation link in Settings under a "Data" or "History" section
  - Opens the same alert history sub-screen accessible from Home's "View all history"

#### FR-SET-007: App Version & About
- **Given** a user on the Settings tab
- **When** they scroll to the bottom
- **Then** the app version, build number, and entity info are displayed
- **Acceptance Criteria:**
  - Shows "PingWeather v{version}" (from app.json)
  - Shows "by Truth Centered Tech"
  - Version text is the tap target for developer mode activation (FR-SET-008)

#### FR-SET-008: Developer Tier Override (Dev/Debug Only)
- **Given** a developer testing the app
- **When** they access the developer options section in Settings
- **Then** they can override their subscription tier to test Pro/Premium features
- **Acceptance Criteria:**
  - Hidden behind a "developer mode" activation (e.g., tap version number 7 times, similar to Android developer options pattern)
  - Once activated, a "Developer Options" section appears at the bottom of Settings
  - Tier override selector: Free / Pro / Premium
  - Override writes directly to the user's profile.subscription_tier in Supabase
  - All tier-gated features immediately reflect the new tier (locations limit, rules limit, polling intervals, compound conditions)
  - Visual indicator when a tier override is active (e.g., colored banner "DEV: Pro tier override active")
  - Override persists across sessions (it's a real database write, not local-only)
  - This section is only available in development builds (__DEV__ flag) — stripped from production builds
  - Alternative: Supabase dashboard manual edit of profiles.subscription_tier (no UI needed, but slower for testing)

#### FR-SET-009: Delete Account
- **Given** an authenticated user on the Settings tab
- **When** they tap "Delete Account"
- **Then** a confirmation flow ensures intent, then permanently deletes all user data
- **Acceptance Criteria:**
  - "Delete Account" button in Settings, visually distinct (red/destructive styling)
  - Confirmation dialog: "This will permanently delete your account and all data including locations, alert rules, and alert history. This cannot be undone."
  - User must type "DELETE" to confirm (prevents accidental taps)
  - On confirm: calls Supabase to delete the user's auth account (cascading deletes remove profile, locations, rules, history via foreign key constraints)
  - Session cleared, redirect to login screen
  - Required for Apple App Store and Google Play compliance

#### FR-SET-010: Sign Out
- **Given** an authenticated user on the Settings tab
- **When** they tap "Sign Out"
- **Then** session is cleared and user is redirected to login
- **Acceptance Criteria:**
  - Confirmation dialog before signing out
  - All session state cleared
  - Redirects to login screen

### 2.8 Server-Side Alert Processing

#### FR-POLL-001: Scheduled Weather Polling
- **Given** active alert rules exist in the database
- **When** the pg_cron job fires (hourly)
- **Then** the poll-weather Edge Function fetches forecasts and evaluates all due rules
- **Acceptance Criteria:**
  - Only evaluates rules where polling interval has elapsed since last check
  - Groups rules by location grid square (0.1° = ~11km) to minimize API calls
  - Fetches 7-day forecast from Open-Meteo for each unique grid square
  - Calls evaluate-alerts for each location group

#### FR-POLL-002: Alert Condition Evaluation
- **Given** forecast data and a set of alert rules for a location
- **When** evaluate-alerts processes the rules
- **Then** each condition is checked against the forecast within the rule's lookahead window
- **Acceptance Criteria:**
  - Metric values extracted from hourly or daily forecast based on metric type and lookahead
  - Each condition checked with the specified comparison operator
  - AND rules: all conditions must be met
  - OR rules: any condition triggers
  - Cooldown respected: skip rules triggered within cooldown_hours
  - On trigger: insert enriched alert_history entry (see FR-POLL-004), update rule.last_triggered_at

#### FR-POLL-003: Push Notification Delivery
- **Given** an alert rule has triggered
- **When** the user has a valid push_token in their profile
- **Then** a push notification is sent with the rule name and condition summary
- **Acceptance Criteria:**
  - Notification title: "[Rule Name] - [Location Name]"
  - Notification body: human-readable condition summary
  - Notification payload includes `alert_history_id` for deep linking to FR-POLL-005 Alert Detail screen
  - Sent via Expo push service (MVP) or FCM (production)
  - alert_history.notification_sent updated to true on successful delivery

#### FR-POLL-004: Enriched Alert History Data
- **Given** an alert rule has triggered
- **When** the alert_history entry is created
- **Then** a rich forecast snapshot is stored alongside the match details
- **Acceptance Criteria:**
  - `alert_history.forecast_data` jsonb stores:
    - `matchDetails`: which conditions matched and the actual forecast values (existing)
    - `dailySnapshot`: the full daily forecast array (high, low, rain %, wind, weather code) for the lookahead window at the time of trigger
    - `hourlySnapshot`: the next 24-48 hours of hourly data (temp, rain %, wind, weather code) at the time of trigger
    - `evaluatedAt`: ISO timestamp of when the evaluation ran
    - `locationCoords`: lat/lon of the monitored location (for refetching current forecast)
  - This data is immutable — represents the forecast state when the alert fired
  - Used by FR-POLL-005 to show "forecast then vs now" comparison

#### FR-POLL-005: Alert Detail Screen (Notification Deep Link)
- **Given** a user taps a push notification, or taps an entry in alert history, or taps a recent notification on Home
- **When** the Alert Detail screen loads
- **Then** a rich breakdown shows WHY the alert fired, what the forecast said then, and what it says now
- **Acceptance Criteria:**
  - **Section 1 — Why It Fired:**
    - Rule name and location name as header
    - Each condition that matched displayed with visual emphasis:
      - The threshold the user set (e.g., "Your threshold: 32°F")
      - The forecast value that triggered it (e.g., "Forecast: 28°F")
      - The margin/delta highlighted (e.g., "4°F below your threshold")
      - Color-coded severity indicator (how far past the threshold — green for barely, red for significantly)
    - Timestamp of when the alert was evaluated
  - **Section 2 — Forecast When Alerted:**
    - Rendered from the stored `forecast_data.dailySnapshot`
    - Shows the daily forecast that was current at trigger time
    - The specific day/hour that violated the condition is visually highlighted (e.g., highlighted row, colored background)
    - Label: "Forecast as of [evaluatedAt time]"
  - **Section 3 — Current Forecast:**
    - Live forecast fetched from Open-Meteo for the same location
    - Same format as Section 2 for easy visual comparison
    - Label: "Current forecast (updated just now)"
  - **Section 4 — Delta Callout (if forecast changed):**
    - If the triggering metric value has changed since the alert:
      - "Updated: low now forecast at **31°F** (was **28°F** when alerted)" 
      - Visual indicator: arrow up/down with color (green = improving, red = worsening relative to the user's threshold)
    - If unchanged: "Forecast unchanged since alert"
  - **Section 5 — Rule Summary:**
    - Compact display of the rule that triggered (name, conditions, polling, cooldown)
    - "Edit Rule" link navigates to the rule editor (FR-ALERT-008)
  - **Navigation:**
    - Accessible via: push notification tap, alert history entry tap, Home recent notification tap
    - Back button returns to previous context (Home, History sub-screen, or Forecasts)
    - If opened from a push notification cold-start: auth gate runs first, then deep links to this screen with the `alert_history_id` from the notification payload

### 2.9 Subscriptions & In-App Purchases

#### FR-IAP-001: Paywall Screen
- **Given** a free-tier user encounters a tier-gated feature (compound conditions, polling < 12h, 2+ locations, etc.)
- **When** they tap the upgrade prompt or navigate to upgrade from Settings
- **Then** a paywall screen displays available tiers with pricing and feature comparison
- **Acceptance Criteria:**
  - Shows current tier highlighted
  - Side-by-side comparison of Free / Pro ($3.99/mo) / Premium ($7.99/mo) features
  - Each tier lists: locations, rules, polling interval, compound conditions, history retention, SMS alerts
  - "Subscribe" button per tier triggers the native store purchase flow
  - "Restore Purchases" link for users who reinstall or switch devices
  - Accessible from: Settings (explicit), tier limit warnings (contextual), upgrade prompts throughout app

#### FR-IAP-002: Purchase Flow
- **Given** a user taps "Subscribe" on a tier
- **When** the native store purchase dialog appears
- **Then** the purchase is handled entirely by Google Play / Apple App Store
- **Acceptance Criteria:**
  - Uses RevenueCat SDK (`react-native-purchases`) to wrap Google Play Billing and Apple StoreKit
  - App never handles credit cards, payment details, or PCI-sensitive data
  - On successful purchase: update `profiles.subscription_tier` in Supabase
  - On failed/cancelled purchase: return to paywall, no state change
  - Loading state while purchase is processing

#### FR-IAP-003: Subscription Lifecycle Management
- **Given** a user has an active subscription
- **When** their subscription renews, cancels, expires, or is refunded
- **Then** their tier is updated accordingly in real-time
- **Acceptance Criteria:**
  - RevenueCat webhook calls a Supabase Edge Function to update `profiles.subscription_tier`
  - On renewal: no action needed (tier stays the same)
  - On cancellation: tier remains active until end of billing period, then downgrades to Free (FR-LOC-005 downgrade handling applies)
  - On refund: immediate downgrade to Free
  - On expiration (failed payment): grace period per store policy, then downgrade
  - Subscription status synced on app launch via RevenueCat SDK (handles offline/webhook failures)

#### FR-IAP-004: Restore Purchases
- **Given** a user who previously subscribed but reinstalled the app or switched devices
- **When** they tap "Restore Purchases" on the paywall
- **Then** their subscription is verified with the store and tier is restored
- **Acceptance Criteria:**
  - Calls RevenueCat `restorePurchases()`
  - If active subscription found: update `profiles.subscription_tier` and dismiss paywall
  - If no subscription found: show "No active subscription found" message
  - Also triggered automatically on app launch (silent restore)

#### FR-IAP-005: Subscription Info in Settings
- **Given** a subscribed user on the Settings tab
- **When** they view their account info
- **Then** subscription details are shown with management options
- **Acceptance Criteria:**
  - Shows: current tier, renewal date, price
  - "Manage Subscription" link opens the native store subscription management (Google Play Subscriptions or Apple Settings → Subscriptions)
  - App does not build its own cancellation flow — stores handle this
  - If on Free tier: shows "Upgrade" button linking to paywall

> **Future Consideration (Stub):** Free tier may become ad-supported using Google AdMob. This would require Privacy Policy updates (ad SDK data disclosure), GDPR ad consent flow, and a "Pro removes ads" upsell. Not in MVP scope.

---

## 3. Non-Functional Requirements

### NFR-001: Performance
- Home forecast loads within 3 seconds on 4G connection
- Alert rule creation saves within 2 seconds
- App startup to interactive screen within 2 seconds (cached state)

### NFR-002: Offline Resilience
- Locations and alert rules cached in AsyncStorage
- App displays cached data when offline
- Graceful error messages for network-dependent operations
- Theme and unit preferences work fully offline

### NFR-003: Security
- Auth tokens stored in native OS secure storage (Keychain/Keystore)
- All API communication over TLS
- Row Level Security on all database tables
- Service role key never exposed to client
- No sensitive data logged

### NFR-004: Data Privacy
- Location coordinates stored only when user explicitly adds them
- No continuous location tracking
- No advertising, marketing, or data brokerage
- GDPR and CCPA rights supported
- Data deletion within 30 days of request
- Alert history auto-purged per tier retention policy

### NFR-005: Accessibility
- Touch targets minimum 44x44 points
- Text contrast meets WCAG AA
- Loading states for all async operations
- Error messages are user-facing and actionable

### NFR-006: Branding Consistency
- App name is "PingWeather" everywhere: login screen, welcome screen, splash screen, app title bar, app store listing
- No references to "WeatherWatch" in any user-facing text or UI
- Legal documents reference "PingWeather" as the product name and "Truth Centered Tech" as the entity
- Notification channel display name: "Weather Alerts" (generic, not branded)

### NFR-007: Error States
- **Network offline:** App displays cached data with a subtle banner "You're offline — showing cached data." All write operations (save location, create rule) show "No internet connection" error and do not silently fail.
- **Supabase unreachable:** Auth operations show "Unable to connect to server. Check your connection and try again." Data screens fall back to AsyncStorage cache.
- **Open-Meteo unreachable:** Forecast cards show "Unable to load forecast" with a retry button. Previously loaded forecast data shown if available with a "Last updated: [time]" label.
- **Supabase RLS violation / 403:** Show "Something went wrong. Please try again." Log the error for debugging but do not expose technical details to the user.
- **All errors:** Toast or inline error message — never a blank screen or crash. User always has a path forward (retry, go back, or use cached data).

### NFR-008: Pull-to-Refresh
- Home, Alerts, Locations, Forecasts, and Settings tabs all support pull-to-refresh where applicable
- Pull-to-refresh reloads data from Supabase (not just local cache)
- Home and Forecasts pull-to-refresh also refetch weather forecasts from Open-Meteo
- Visual refresh indicator shown during reload

### NFR-009: Platform Support
- Android: primary platform (SDK 54, React Native 0.81)
- iOS: secondary (same codebase, untested in MVP)
- Expo Go: development testing (push notifications require native build)
- EAS Build: required for push notification functionality

---

## 4. Subscription Tiers

| Feature | Free | Pro ($3.99/mo) | Premium ($7.99/mo) |
|---|---|---|---|
| Locations | 1 | 3 | 10 |
| Alert Rules | 2 | 5 | Unlimited |
| Polling Interval | 12h min | 4h min | 1h min |
| Compound Conditions | No | Yes | Yes |
| Alert History | 7 days | 30 days | 90 days |
| SMS Alerts | No | No | Yes (future) |

---

## 5. Technical Architecture

### 5.1 Frontend
- React Native + Expo SDK 54 (managed workflow)
- TypeScript (strict mode)
- Expo Router v6 (file-based navigation)
- Zustand v5 (state management, 6 stores)
- Token-based theme system (3 themes, 30+ color tokens)

### 5.2 Backend
- Supabase (PostgreSQL, Auth, Edge Functions)
- 4 database tables with Row Level Security
- 3 Edge Functions (Deno/TypeScript)
- pg_cron for scheduled polling

### 5.3 External APIs
- Open-Meteo (weather forecasts, free, no API key)
- Expo Push Service (notifications, MVP)
- Firebase Cloud Messaging (notifications, production)

### 5.4 Data Flow
```
User configures rule → Supabase DB
pg_cron (hourly) → poll-weather Edge Function
  → Open-Meteo API (forecast)
  → evaluate-alerts Edge Function (condition matching)
  → alert_history insert
  → Expo Push / FCM → User's device
```

---

## 6. Alert Presets (10 templates)

### Temperature (4)
| Preset | Condition | Lookahead | Polling | Cooldown |
|---|---|---|---|---|
| Freeze Warning | Low < 32°F | 24h | 4h | 12h |
| Hard Freeze | Low < 20°F | 48h | 4h | 12h |
| Extreme Heat | High > 100°F | 48h | 4h | 12h |
| Cold Front Incoming | High drops 15°F+ | 72h | 4h | 24h |

### Precipitation (2)
| Preset | Condition | Lookahead | Polling | Cooldown |
|---|---|---|---|---|
| Rain Likely | Rain > 70% | 24h | 12h | 12h |
| Rain Possible | Rain > 50% | 72h | 4h | 12h |

### Wind (2)
| Preset | Condition | Lookahead | Polling | Cooldown |
|---|---|---|---|---|
| High Wind | Wind > 25 mph | 24h | 4h | 8h |
| Dangerous Wind | Wind > 40 mph | 24h | 4h | 8h |

### Work & Safety (2)
| Preset | Condition | Lookahead | Polling | Cooldown |
|---|---|---|---|---|
| Rain Delay Risk | Rain > 60% | 8h | 4h | 6h |
| High UV Index | UV > 8 | 24h | 12h | 24h |

---

## 7. Legal Coverage

### EULA v1.0.0 (14 sections)
Key clauses: Weather Data Disclaimer (no liability for forecast accuracy), Notification Delivery (no guarantee of timeliness), Limitation of Liability (capped at $100 or 12-month fees), Arbitration (AAA, individual basis), Delaware governing law.

### Privacy Policy v1.0.0 (15 sections)
Key clauses: Data Collection (account, location, device, usage only), COPPA compliance (no under-13), GDPR rights (access, erasure, portability, etc.), CCPA rights (know, delete, opt-out), 30-day deletion SLA, TLS encryption in transit, RLS database security.

---

## 8. Forecast Accuracy Tracking (Post-MVP, Planned)

> **Priority:** Post-MVP but architecturally planned now. The alert history enrichment (FR-POLL-004) lays the groundwork — we're already storing forecast snapshots at trigger time. This feature closes the loop by comparing those predictions against what actually happened.

#### FR-ACCURACY-001: Actual Weather Collection
- **Given** an alert has been triggered and a forecast snapshot was stored
- **When** the forecasted time window passes (e.g., the "tomorrow" that was predicted has now happened)
- **Then** the system fetches actual observed weather data and stores it alongside the forecast snapshot
- **Acceptance Criteria:**
  - Scheduled Edge Function runs daily, looks back at alert_history entries whose forecast windows have elapsed
  - Fetches actual observed data from Open-Meteo Historical Weather API for the location and date
  - Stores actual values in a new `actual_data` jsonb column on alert_history (or a separate `forecast_accuracy` table)
  - Captures: actual high, actual low, actual precipitation, actual wind for the relevant date(s)

#### FR-ACCURACY-002: Per-Alert Accuracy Display
- **Given** a user views an Alert Detail screen (FR-POLL-005) for a past alert where actual data is available
- **When** the screen loads
- **Then** a "How Accurate Was This?" section shows the forecast vs actual comparison
- **Acceptance Criteria:**
  - Side-by-side display: "Forecast said: Low 28°F" vs "What actually happened: Low 30°F"
  - Accuracy indicator: "Forecast was off by 2°F" with color coding (green = close, yellow = moderate, red = significantly off)
  - For precipitation: "Forecast said 80% chance of rain" vs "It did rain" or "It did not rain"
  - Only shown when actual data has been collected (not for recent/future alerts)

#### FR-ACCURACY-003: Per-Rule Accuracy Score
- **Given** a user views a rule in the rule editor or on the Alerts tab
- **When** the rule has been triggered multiple times and actual data is available
- **Then** an accuracy percentage is displayed
- **Acceptance Criteria:**
  - Accuracy = % of times the alert was "correct" (the condition was actually met in observed weather)
  - Example: "This rule has fired 12 times. 10 were accurate. **83% accuracy.**"
  - Displayed as a subtle badge or line on the rule card and rule editor
  - Minimum 3 triggers required before showing a score (avoid misleading single-sample stats)
  - Helps users tune thresholds — if accuracy is low, maybe the threshold is too sensitive

#### FR-ACCURACY-004: Per-Location Forecast Reliability
- **Given** a user has a location with accumulated forecast vs actual data over time
- **When** they view the location on the Forecasts tab
- **Then** a reliability indicator shows how trustworthy forecasts are for that location
- **Acceptance Criteria:**
  - Aggregate metric: average forecast error for temperature, precipitation accuracy rate
  - Displayed on the location card or location detail: "Forecasts for this location are typically within ±3°F for temperature"
  - Optionally: "Forecasts beyond 3 days are less reliable here" based on error-by-lookahead analysis
  - Requires sufficient data history (30+ days of data before showing)
  - Natural Premium tier feature — free/pro users see alerts, premium users see the intelligence layer

---

## 9. Known Limitations & Future Considerations

### Current Limitations
- Push notifications require EAS native build (not available in Expo Go)
- Cold Front preset uses differential detection that requires special evaluator handling (not fully implemented)
- No in-app subscription management or payment processing
- Alert history cleanup is tier-limited in UI but not database-enforced
- SMS alerts listed in tiers but not implemented
- Weather condition icons require mapping from Open-Meteo WMO codes (implementation pending)

### Future Features (documented in docs/future-features.md)
- Forecast accuracy tracking (Section 8 — architecturally planned, post-MVP)
- NLP/AI rule creation ("alert me if it's going to freeze at the barn")
- Sportsman extension pack (hunting/fishing-specific presets)
- In-app subscription management / payment processing
- Weather radar / map overlay on Forecasts tab
- Historical weather dashboard for seasonal planning (Premium tier)
