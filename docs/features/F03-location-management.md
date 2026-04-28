# F03: Location Management

## Overview
Users name and save geographic points (e.g., "North Pasture", "Home"). Each location is the unit against which alert rules evaluate and for which forecasts are displayed. Supports GPS capture, geocoding search via Open-Meteo, manual lat/lon entry, edit, delete, active/inactive toggle, and "default" location selection.

## Screens Involved
- `app/(tabs)/locations.tsx` — list, add/edit form, delete, toggle, set default
- `app/onboarding/location-setup.tsx` — first-run add location (uses the same store + `LocationSearchInput`)
- `src/components/LocationSearchInput.tsx` — debounced geocoding autocomplete

## Data Model
Table: `public.locations`
- `id uuid PK`
- `user_id uuid FK → profiles.id ON DELETE CASCADE`
- `name text`
- `latitude double precision` (CHECK: -90 to 90, added migration 00013)
- `longitude double precision` (CHECK: -180 to 180, added migration 00013)
- `is_active boolean default true`
- `is_default boolean default false` (partial unique index: one default per user, added migration 00002)
- `timezone text` (IANA tz string, added migration 00002, backfilled by `poll-weather`)
- `created_at timestamptz default now()`

Indexes:
- `idx_locations_one_default_per_user` (partial: `WHERE is_default = true`)
- `idx_locations_user_id` (migration 00014)
- Primary key on `id`

RLS policies:
- SELECT: `auth.uid() = user_id`
- INSERT: `auth.uid() = user_id`
- UPDATE: `auth.uid() = user_id` USING and WITH CHECK (migration 00013 — prevents user_id reassignment)
- DELETE: `auth.uid() = user_id`

## State Management
Store: `src/stores/locationsStore.ts` (Zustand + persisted to AsyncStorage under `weatherwatch-locations`; only `locations` array is persisted — loading/error rehydrate clean).

State shape:
```
locations: WatchLocation[]
loading: boolean
error: string | null
```

Actions used:
- `loadLocations()` — SELECT all, ordered by `created_at desc`.
- `addLocation(name, lat, lon, timezone?): Promise<boolean>` — enforces tier limit (`TIER_LIMITS[tier].maxLocations`), sets `is_default: true` if first. Returns boolean to let callers abort on failure.
- `updateLocation(id, updates: { name, latitude, longitude }): Promise<boolean>` — partial update with `.select().single()` returning the updated row.
- `removeLocation(id)` — DELETE; if the removed row was default and others exist, promotes `remaining[0]` to default (awaited, not fire-and-forget).
- `toggleLocation(id, isActive)` — flips `is_active`.
- `setDefaultLocation(id)` — requires `userId` (guards against null per `FIX 2` comment), unsets all defaults for the user, then sets the target. Both SQL updates run server-side.
- `enforceTierLimits(tier)` — called on subscription downgrade; deactivates the excess locations or reactivates inactive ones up to the new tier limit. Persists to Supabase (not just local state — `FIX 3`).

## Business Rules
- **Tier limits** (from `src/types/index.ts` TIER_LIMITS):
  - Free: 1 location
  - Pro: 3 locations
  - Premium: 10 locations
- **First location becomes default** automatically.
- **Only one default per user** enforced at DB via partial unique index.
- **Default rotation**: deleting the default promotes the next-oldest remaining location (local state sync + server UPDATE).
- **Deactivate, not delete** on downgrade — existing locations are marked inactive so they can be reactivated if the user upgrades again.
- **Coord range** enforced server-side (migration 00013) in addition to client validation.
- **Timezone** is captured from geocoding when available, otherwise from `Intl.DateTimeFormat().resolvedOptions().timeZone` (device zone) for GPS, or null for manual coord entry. `poll-weather.processGrid` backfills null values on first poll using Open-Meteo's response `timezone` field.

## API Interactions
| Action | Endpoint | Auth |
|--------|----------|------|
| Load | `supabase.from('locations').select('*').order('created_at', {ascending: false})` | user JWT (RLS filters) |
| Add | `.insert({ user_id, name, latitude, longitude, is_active: true, is_default, timezone }).select().single()` | user JWT |
| Update | `.update(updates).eq('id', id).select().single()` | user JWT |
| Delete | `.delete().eq('id', id)` | user JWT |
| Toggle | `.update({ is_active }).eq('id', id)` | user JWT |
| Set default (unset) | `.update({ is_default: false }).eq('user_id', userId)` | user JWT |
| Set default (set) | `.update({ is_default: true }).eq('id', id)` | user JWT |
| Geocoding | `https://geocoding-api.open-meteo.com/v1/search?name=...&count=5&language=en&format=json` | none (public API, min 2 chars) |
| Device GPS | `expo-location.getCurrentPositionAsync({ accuracy: Balanced })` | user grant |

## Error Handling
- Every store action catches and sets `error` to `err.message` (with a fallback string). Errors are surfaced via `storeError` banner in `locations.tsx`.
- `addLocation` returns `false` on any failure so the form stays open and the user sees the error inline.
- `setDefaultLocation` guards `null` user — without it, the "unset all" query would run with empty `user_id` and silently touch zero rows, leaving multiple defaults.
- Geocoding errors throw from `searchPlaces`; the component catches and transitions to `status: 'error'`.
- Stale geocoding responses are discarded via `activeQueryRef` race-guard.

## Edge Cases — Handled
- Location list rehydrating from AsyncStorage before `loadLocations()` completes (shows cached data, refreshes on mount).
- Deleting the default location with no remaining locations (no promotion, empty list).
- User deletes all locations (home/forecasts screens show empty-state placeholders).
- Subscription downgrade enforces limit on the server so reloads don't resurrect over-quota locations.

## Edge Cases — NOT Handled (Gaps)
- **Duplicate locations** — no uniqueness constraint on `(user_id, latitude, longitude)`. A user can add "Home" and "House" for the exact same coords.
- **Name length** — no max length enforced client-side or DB-side. Very long names break layout.
- **Invalid coordinates silently accepted** when typed manually (before migration 00013 ran in production). DB now rejects, but the form shows the error only after save.
- **Zero coords** (`0, 0`) pass validation (null island, Atlantic Ocean) — no sanity heuristic to detect.
- **Timezone not backfilled until first poll** — means digests scheduled in between onboarding and the first `poll-weather` run may fire at the wrong hour.
- **No reverse geocoding** for GPS-added locations — the user must type the name themselves, which the first-run flow auto-fills with "My Location".
- **No location re-ordering** — list order is creation-date; the default marker is the only user-controllable priority signal.

## Test Coverage
- `__tests__/stores/locationsStore.test.ts` — exercises add/update/delete/toggle/setDefault/enforceTierLimits against mocked Supabase client. Covers the `setDefaultLocation` null-guard, the default-promotion-on-delete, and the tier-enforcement DB persistence.
- `__tests__/services/geocoding.test.ts` — `searchPlaces` happy path, min-query guard, error handling, and `formatLocationLabel` formatting.
- `__tests__/screens/locations.test.tsx` — jsdom text-presence (not behavioral). Flagged as fraudulent.

**Verdict:** Store tests would catch a logic regression (e.g., forgetting to promote the next default on delete). Text-presence tests would not catch a regression where the form is wired to the wrong store action.
