# PingWeather — Architecture Diagrams

All diagrams are Mermaid blocks. They should render as-is in any Mermaid-aware Markdown viewer (GitHub, VS Code with Mermaid extension, Mermaid Live Editor).

---

## 1. Physical deployment diagram

Which components run where, and what talks to what over the network.

```mermaid
graph LR
    subgraph Device["Mobile device (Android / iOS)"]
        APP[PingWeather app<br/>React Native + Expo SDK 54]
    end

    subgraph EAS["EAS (Expo Application Services)"]
        EASUpdate[EAS Update<br/>OTA bundles<br/>channels: dev / preview / production]
        EASPush[Expo Push Service<br/>exp.host/--/api/v2/push/send]
    end

    subgraph Supabase["Supabase Cloud — project ziyxkgbrdliwvztotxli"]
        Auth[Supabase Auth<br/>email/password + PKCE]
        DB[(PostgreSQL 17<br/>profiles, locations,<br/>alert_rules, alert_history,<br/>forecast_cache)]
        Cron[pg_cron + pg_net + vault]
        EdgeFn[Edge Functions<br/>Deno]
    end

    subgraph Third["Third parties"]
        OpenMeteo[Open-Meteo<br/>customer-api.open-meteo.com]
        FCM[Firebase Cloud<br/>Messaging V1]
        APNs[Apple Push<br/>Notification Service]
        RevenueCat[RevenueCat<br/>webhooks]
        PlayBilling[Google Play<br/>Billing]
    end

    APP -->|OTA check on launch| EASUpdate
    APP -->|signup/signin/reset| Auth
    APP -->|CRUD via user JWT + RLS| DB
    APP -->|invoke functions<br/>with user JWT| EdgeFn
    APP -->|in-app purchase flow| RevenueCat
    APP -.->|geocoding public API| OpenMeteo

    Cron -->|hourly / daily| EdgeFn
    EdgeFn -->|service role queries| DB
    EdgeFn -->|server-held API key| OpenMeteo
    EdgeFn -->|push send| EASPush

    EASPush -->|Android route| FCM
    EASPush -->|iOS route, not shipped| APNs
    FCM -->|deliver| APP

    RevenueCat -->|webhook: events| EdgeFn
    RevenueCat <-->|SDK sync| PlayBilling
    PlayBilling -->|receipts| APP
```

---

## 2. Logical layer diagram

The client-side layer stack and what each layer depends on.

```mermaid
graph TD
    UI["UI Screens<br/>app/**/*.tsx<br/>Expo Router"]
    Stores["Zustand Stores<br/>authStore, locationsStore, alertRulesStore,<br/>alertHistoryStore, settingsStore, themeStore"]
    Services["Services<br/>weatherApi, geocoding, purchases,<br/>subscriptionLogic, digestFormatter,<br/>digestScheduler, hourlyForDay, weatherIcon"]
    Utils["Utils<br/>supabase client, weatherEngine,<br/>alertsHelpers, devAccount"]
    Hooks["Hooks<br/>useLocation, usePushNotifications"]
    Client["@supabase/supabase-js<br/>Supabase Client"]

    UI --> Stores
    UI --> Services
    UI --> Hooks
    UI --> Utils

    Stores --> Client
    Stores --> Utils
    Stores -.lazy.-> Stores

    Hooks --> Client
    Hooks --> Utils

    Services --> Client
    Services --> Utils

    Utils --> Client

    subgraph ServerSide["Server-side (Deno)"]
        EdgeFn["Edge Functions<br/>poll-weather, evaluate-alerts,<br/>get-forecast, register-push-token,<br/>send-digest, fcm-keepalive,<br/>delete-account, subscription-webhook"]
        SharedEngine["_shared/weatherEngine.ts<br/>byte-identical to src/utils/weatherEngine.ts"]
        DB2[(PostgreSQL<br/>+ RLS)]
    end

    EdgeFn --> SharedEngine
    EdgeFn --> DB2

    Client -.invoke.-> EdgeFn
    Client -.REST+JWT+RLS.-> DB2
```

Notes:
- The dashed "lazy" arrow between Stores represents `authStore.fetchProfile()` dynamically importing `settingsStore` to avoid circular dependency (documented in code).
- Services have no UI deps — pure modules importable from tests without React.
- The `_shared/weatherEngine.ts` file is duplicated on disk by design so both Deno and Jest can import it via their respective resolvers.

---

## 3. Alert lifecycle flow

End-to-end trace from rule creation to push arriving on the device.

```mermaid
sequenceDiagram
    participant U as User / App
    participant DB as Postgres
    participant CR as pg_cron
    participant PW as poll-weather<br/>Edge Function
    participant OM as Open-Meteo
    participant EA as evaluate-alerts<br/>Edge Function
    participant EXP as Expo Push
    participant FC as FCM / Device

    U->>DB: INSERT alert_rules<br/>(is_active, last_polled_at=NULL)
    Note over U,DB: Rule exists but has never polled

    loop Every hour at :00 UTC
        CR->>PW: net.http_post<br/>Bearer service_role
        PW->>DB: SELECT * FROM alert_rules<br/>JOIN locations WHERE both active
        PW->>PW: Filter rules where<br/>last_polled_at old enough

        PW->>PW: Group by gridKey(lat, lon)<br/>round to 0.1°

        loop Each grid (up to 10 in parallel)
            PW->>OM: GET forecast<br/>apikey=OPEN_METEO_API_KEY
            OM-->>PW: hourly + daily arrays
            par Write cache
                PW->>DB: UPSERT forecast_cache<br/>(grid_key, forecast_json, fetched_at)
            and Backfill timezone
                PW->>DB: UPDATE locations SET timezone=tz<br/>WHERE timezone IS NULL
            end
            PW->>EA: invoke evaluate-alerts<br/>{rules, forecast, location_name}<br/>Bearer service_role
            EA->>EA: Skip rules in cooldown<br/>evaluateRule(rule, forecast)<br/>per AND / OR semantics

            loop Each triggered rule
                EA->>DB: INSERT alert_history<br/>(rule_id, user_id, summary,<br/>matchDetails, notification_sent=false)
                Note right of DB: Unique index on<br/>(rule_id, hour_utc)<br/>returns 23505 on dup
            end
            EA->>DB: UPDATE alert_rules<br/>SET last_triggered_at=now<br/>WHERE id IN (...)
            EA-->>PW: {triggered, alerts: [...]}
        end

        PW->>DB: UPDATE alert_rules<br/>SET last_polled_at=now<br/>WHERE id IN (all evaluated)

        PW->>DB: SELECT push_token<br/>FROM profiles<br/>WHERE id IN (triggered user_ids)

        loop Each triggered alert (in parallel)
            PW->>EXP: POST exp.host push send<br/>{to, title, body, data}
            EXP->>FC: route to FCM / APNs
            FC-->>U: notification arrives
            alt push ok
                PW->>DB: UPDATE alert_history<br/>SET notification_sent=true<br/>WHERE id = alert_history_id
            else push failed
                PW->>PW: log error, do NOT<br/>flip notification_sent
            end
        end
    end
```

---

## 4. Database ERD

Tables, columns, and foreign keys.

```mermaid
erDiagram
    AUTH_USERS ||--|| PROFILES : "1:1 via id FK"
    PROFILES ||--o{ LOCATIONS : "user_id FK"
    PROFILES ||--o{ ALERT_RULES : "user_id FK"
    PROFILES ||--o{ ALERT_HISTORY : "user_id FK"
    PROFILES }o--|| LOCATIONS : "digest_location_id FK<br/>ON DELETE SET NULL"
    LOCATIONS ||--o{ ALERT_RULES : "location_id FK"
    ALERT_RULES ||--o{ ALERT_HISTORY : "rule_id FK<br/>ON DELETE SET NULL"
    FORECAST_CACHE {
        text grid_key PK
        double precision latitude
        double precision longitude
        jsonb forecast_json
        timestamptz fetched_at
    }

    AUTH_USERS {
        uuid id PK
        text email
        text encrypted_password
    }

    PROFILES {
        uuid id PK_FK
        text email
        text display_name
        text subscription_tier "free | pro | premium"
        boolean onboarding_completed
        text eula_accepted_version
        timestamptz eula_accepted_at
        text push_token
        boolean digest_enabled
        text digest_frequency "daily | weekly"
        integer digest_hour "0-23"
        integer digest_day_of_week "1-7 ISO"
        uuid digest_location_id FK
        timestamptz digest_last_sent_at
        text temperature_unit "fahrenheit | celsius"
        timestamptz created_at
        timestamptz updated_at
    }

    LOCATIONS {
        uuid id PK
        uuid user_id FK
        text name
        double latitude "-90..90"
        double longitude "-180..180"
        boolean is_active
        boolean is_default
        text timezone "IANA or NULL"
        timestamptz created_at
    }

    ALERT_RULES {
        uuid id PK
        uuid user_id FK
        uuid location_id FK
        text name
        jsonb conditions
        text logical_operator "AND | OR"
        integer lookahead_hours "1..168"
        integer polling_interval_hours "min 1"
        integer cooldown_hours "min 1"
        boolean is_active
        timestamptz last_triggered_at
        timestamptz last_polled_at
        timestamptz created_at
        timestamptz updated_at
    }

    ALERT_HISTORY {
        uuid id PK
        uuid user_id FK
        uuid rule_id FK "nullable"
        text rule_name "snapshot"
        text location_name "snapshot"
        text conditions_met
        jsonb forecast_data
        timestamptz triggered_at
        boolean notification_sent
    }
```

Notes:
- `forecast_cache` has no FK relationships (standalone lookup table keyed by gridded coords).
- ON DELETE CASCADE: profiles → locations/alert_rules/alert_history, auth.users → profiles.
- ON DELETE SET NULL: alert_rules.id → alert_history.rule_id, locations.id → profiles.digest_location_id.
- Unique partial index `idx_locations_one_default_per_user` on `(user_id) WHERE is_default`.
- Unique partial index `idx_alert_history_dedup` on `(rule_id, triggered_at_hour_utc) WHERE rule_id IS NOT NULL`.

---

## 5. Onboarding state machine

```mermaid
stateDiagram-v2
    [*] --> Welcome

    Welcome --> Privacy: Get Started
    Privacy --> EULA: Continue
    EULA --> LocationSetup: I Accept<br/>(writes eula_accepted_version +<br/>eula_accepted_at)
    LocationSetup --> NotificationSetup: Next<br/>(addLocation succeeded)
    LocationSetup --> NotificationSetup: Skip for now
    LocationSetup --> LocationSetup: addLocation failed<br/>stay on screen, show error

    NotificationSetup --> BatterySetup: permission granted<br/>(Android only)
    NotificationSetup --> Complete: permission granted<br/>(iOS)
    NotificationSetup --> BatterySetup: Skip<br/>(Android)
    NotificationSetup --> Complete: Skip<br/>(iOS)

    BatterySetup --> Complete: Skip for now (not recommended)
    BatterySetup --> Complete: Open Battery Settings<br/>(user returns via back)

    Complete --> [*]: Start Using PingWeather<br/>(writes onboarding_completed=true,<br/>fetchProfile, replace to /)

    note right of Complete
        Auth gate in _layout.tsx
        routes based on profile
        onboarding_completed flag.
        No direct back from Complete.
    end note
```

---

## 6. Subscription tier state machine

Tier transitions driven by RevenueCat webhook events.

```mermaid
stateDiagram-v2
    [*] --> Free: account created<br/>(default tier)

    Free --> Pro: INITIAL_PURCHASE<br/>pro_monthly / pro_annual
    Free --> Premium: INITIAL_PURCHASE<br/>premium_monthly / premium_annual

    Pro --> Pro: RENEWAL<br/>pro_*
    Pro --> Premium: INITIAL_PURCHASE<br/>premium_*

    Premium --> Premium: RENEWAL<br/>premium_*
    Premium --> Pro: (external downgrade)<br/>not modeled

    Pro --> Free: EXPIRATION
    Premium --> Free: EXPIRATION

    Pro --> PendingCancel: CANCELLATION
    Premium --> PendingCancel: CANCELLATION
    PendingCancel --> Pro: within billing period
    PendingCancel --> Premium: within billing period
    PendingCancel --> Free: EXPIRATION<br/>(billing period end)

    note right of PendingCancel
        CANCELLATION does NOT
        update subscription_tier.
        Entitlement runs through
        EXPIRATION event.
    end note

    note left of Free
        BILLING_ISSUE_DETECTED
        logs only; tier unchanged.
        No state transition from
        any state.
    end note
```

---

## 7. Store dependency graph

Which Zustand stores depend on which, and which depend on auth state.

```mermaid
graph TD
    Auth[authStore<br/>session, user, profile<br/>NOT persisted]
    Locations[locationsStore<br/>locations[]<br/>persisted: locations]
    Rules[alertRulesStore<br/>rules[]<br/>persisted: rules]
    History[alertHistoryStore<br/>entries[]<br/>NOT persisted]
    Settings[settingsStore<br/>temperatureUnit, windSpeedUnit,<br/>notificationsEnabled<br/>persisted]
    Theme[themeStore<br/>themeName, tokens<br/>persisted: themeName]

    Auth -. lazy import in fetchProfile<br/>to seed unit pref .-> Settings

    Locations --> Auth
    Locations --> Types["TIER_LIMITS<br/>(src/types)"]

    Rules --> Auth
    Rules --> Types

    History --> Auth

    Settings -.independent.-> NoDeps1[ ]
    Theme -.independent.-> NoDeps2[ ]

    style Auth fill:#1E3A5F,color:#fff
    style Theme fill:#5B7A99,color:#fff
    style Settings fill:#5B7A99,color:#fff
    style NoDeps1 fill:#fff,stroke-width:0px
    style NoDeps2 fill:#fff,stroke-width:0px

    classDef depAuth fill:#e8eef4
    class Locations,Rules,History depAuth
```

Notes:
- Three stores (`locationsStore`, `alertRulesStore`, `alertHistoryStore`) read `authStore.user.id` or `authStore.profile.subscription_tier` to scope / gate their operations.
- `settingsStore` and `themeStore` are independent of auth — they're device-level preferences. `authStore.fetchProfile` writes into `settingsStore` as a one-way seed, which is why the arrow is dashed and unidirectional.
- No store imports any other store at module load time — the auth-to-settings link uses a dynamic `import()` inside `fetchProfile` to break the circular graph.
