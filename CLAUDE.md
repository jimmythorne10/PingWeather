# WeatherWatch

## Project Overview

WeatherWatch is a mobile weather notification app (Android-first, iOS planned) that allows users to configure custom conditional weather alerts. Users set locations, define alert criteria (temperature thresholds, precipitation probability, wind speed, etc.), and receive push notifications when conditions are met.

### Target Users (MVP)
- **Livestock owners** — Freeze alerts for water troughs and animal welfare
- **Hunters** — Cold front tracking, rain alerts, wind conditions
- **Outdoor workers** — Rain delay risk, high wind safety
- **Anyone** who needs proactive weather alerts instead of manually checking forecasts

### Core Value Proposition
"If-this-then-alert" weather monitoring with compound conditions, user-defined polling intervals, and preset templates for common use cases. No consumer app currently offers this combination.

## Tech Stack

### Frontend
- **Framework**: React Native with Expo SDK 54 (managed workflow)
- **Language**: TypeScript (strict mode)
- **State Management**: Zustand 5
- **Navigation**: Expo Router (file-based routing)
- **UI**: React Native built-in components (no external UI library)

### Backend
- **Platform**: Supabase
  - **Database**: PostgreSQL with RLS
  - **Auth**: Supabase Auth (email/password)
  - **API**: Edge Functions (Deno/TypeScript)
  - **Scheduling**: pg_cron for polling weather APIs
- **Migration path**: AWS (Lambda + EventBridge) or Firebase if Supabase Edge Functions hit scaling limits

### Weather Data
- **Primary**: Open-Meteo API (free, no key required, ECMWF/GFS models)
- **Supplementary**: NWS API (free, US-only, authoritative)
- **Architecture**: Server-side polling with grid-square caching. Don't make one API call per user — cluster by location, fetch once per grid, evaluate all users' conditions against cached data.

### Push Notifications
- **Android**: Firebase Cloud Messaging (FCM)
- **iOS**: Apple Push Notification Service (APNs)
- **Client**: expo-notifications
- **Critical**: All polling and notification sending happens server-side. On-device background tasks are unreliable.

## Subscription Tiers

| Feature | Free | Pro ($3.99/mo) | Premium ($7.99/mo) |
|---|---|---|---|
| Locations | 1 | 3 | 10 |
| Alert Rules | 2 | 5 | Unlimited |
| Polling Interval | 12hr min | 4hr min | 1hr min |
| Compound Conditions | No | Yes | Yes |
| Alert History | 7 days | 30 days | 90 days |
| SMS Alerts | No | No | Yes (future) |

## Project Structure

```
WeatherWatch/
├── app/                    # Expo Router screens
│   ├── (tabs)/             # Main tab navigator
│   │   ├── index.tsx       # Dashboard — current conditions + alert summary
│   │   ├── alerts.tsx      # Alert rules — presets + custom builder
│   │   ├── locations.tsx   # Monitored locations management
│   │   ├── history.tsx     # Alert notification history
│   │   └── settings.tsx    # User settings (hidden tab)
│   ├── onboarding/         # Onboarding wizard
│   │   ├── welcome.tsx     # App intro
│   │   ├── privacy.tsx     # Privacy explanation
│   │   ├── eula.tsx        # Terms acceptance
│   │   ├── location-setup.tsx    # Add first location
│   │   ├── notification-setup.tsx # Push notification permission
│   │   └── complete.tsx    # Setup summary
│   ├── legal/              # Legal document screens
│   ├── login.tsx           # Email/password login
│   ├── signup.tsx          # Account creation
│   └── _layout.tsx         # Root layout (auth gate)
├── src/
│   ├── stores/             # Zustand state stores
│   │   ├── authStore.ts
│   │   ├── locationsStore.ts
│   │   ├── alertRulesStore.ts
│   │   ├── alertHistoryStore.ts
│   │   ├── settingsStore.ts
│   │   └── themeStore.ts
│   ├── theme/              # Token-based theme system
│   ├── types/              # TypeScript type definitions
│   ├── data/               # Static data (legal docs, presets)
│   ├── services/           # API clients
│   │   └── weatherApi.ts   # Open-Meteo client
│   ├── utils/              # Helpers
│   │   └── supabase.ts     # Supabase client
│   ├── components/         # Reusable UI components
│   └── hooks/              # Custom React hooks
├── supabase/               # Supabase backend
│   └── functions/          # Edge Functions
├── __tests__/              # Test files
├── assets/                 # Images, icons
├── app.json                # Expo config
├── eas.json                # EAS Build config
├── tsconfig.json           # TypeScript config
└── CLAUDE.md               # This file
```

## Architecture Principles

1. **Server-side polling**: All weather API polling and condition evaluation happens in Supabase Edge Functions triggered by pg_cron. The app is a configuration interface + notification receiver.
2. **Grid-square caching**: Cluster users by approximate location. One API call per grid square per polling interval, then evaluate all matching users' rules against cached data.
3. **Notification reliability**: Use FCM/APNs for push delivery. Never rely on on-device background tasks for critical alerts.
4. **Tier enforcement**: All tier limits enforced server-side. Client shows limits for UX but server is the authority.
5. **Weather disclaimer**: Always surface that forecasts are inherently uncertain. WeatherWatch supplements, not replaces, official weather warnings.

## Development Commands

```bash
npm install                  # Install dependencies
npx expo start               # Start dev server
npx expo start --android     # Start on Android
npx expo start --ios         # Start on iOS
npx tsc --noEmit             # Type check
npm test                     # Run tests
```

## Environment Variables

Required in `.env.local` (never committed):
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

## Coding Standards

- TypeScript strict mode
- Functional components with hooks
- Named exports preferred
- Keep components under 200 lines
- No `any` types — use proper typing or `unknown` with type guards
- Error handling on all external API calls with user-friendly messages
- Never log sensitive data

## Entity: Truth Centered Tech
- Legal contact: legal@truthcenteredtech.com
- Privacy contact: privacy@truthcenteredtech.com
- Governing law: Delaware, US
