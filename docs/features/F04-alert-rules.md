# F04: Alert Rule Creation & Management

## Overview
Users create conditional weather rules ("if wind goes above 30 mph in the next 24 hours, notify me") via either a preset library or a custom builder. Rules are stored in Supabase, evaluated server-side every polling cycle, and drive the push-notification engine.

## Screens Involved
- `app/(tabs)/alerts.tsx` — master list, preset library, filters (All/Active/Inactive, category, location), per-rule toggle/clone/delete, entry point to custom builder
- `app/create-rule.tsx` — multi-condition builder supporting edit, clone, and create modes (via `?mode=edit|clone&ruleId=…` params)
- `src/data/alert-presets.ts` — 11 preset templates spanning temperature, precipitation, wind, and work-safety categories

## Data Model
Table: `public.alert_rules`
- `id uuid PK`
- `user_id uuid FK → profiles.id ON DELETE CASCADE`
- `location_id uuid FK → locations.id ON DELETE CASCADE`
- `name text`
- `conditions jsonb` — array of `{ metric, operator, value, unit }`
- `logical_operator text` (CHECK: `AND` or `OR`; default `AND`)
- `lookahead_hours integer` (CHECK: 1-168, added migration 00013)
- `polling_interval_hours integer` (CHECK: ≥1, added migration 00013)
- `cooldown_hours integer` (CHECK: ≥1, added migration 00013)
- `is_active boolean default true`
- `last_triggered_at timestamptz`
- `last_polled_at timestamptz` (added migration 00004)
- `created_at`, `updated_at`

Indexes:
- `idx_alert_rules_last_polled_active` (partial, `WHERE is_active`)
- `idx_alert_rules_location_id`, `idx_alert_rules_user_id` (migration 00014)

RLS: SELECT/INSERT/UPDATE/DELETE all gated on `auth.uid() = user_id`. UPDATE has WITH CHECK after migration 00013 (prevents user_id reassignment).

Metrics supported (from `WeatherMetric` type):
`temperature_high`, `temperature_low`, `temperature_current`, `precipitation_probability`, `wind_speed`, `humidity`, `feels_like`, `uv_index`.

Operators: `gt`, `gte`, `lt`, `lte`, `eq`.

## State Management
Store: `src/stores/alertRulesStore.ts` — Zustand + persisted to AsyncStorage (`weatherwatch-alert-rules`). Only `rules` is persisted.

State shape:
```
rules: AlertRule[]
loading: boolean
error: string | null
```

Actions:
- `loadRules()` — SELECT all, order by `created_at desc`.
- `createRule(rule)` — enforces `TIER_LIMITS[tier].maxAlertRules` and `compoundConditions` server of the client-side gate, then INSERT with `is_active: true`.
- `updateRule(id, updates)` — partial update with `updated_at` stamp.
- `deleteRule(id)`
- `toggleRule(id, isActive)`
- `enforceTierLimits(tier)` — deactivates excess when tier shrinks, reactivates up to limit when tier grows. Persists both ways to Supabase.

## Business Rules
- **Tier limits** (from TIER_LIMITS in `src/types/index.ts`):
  - Free: 2 rules, 12h min polling, compound conditions NOT allowed
  - Pro: 5 rules, 4h min polling, compound conditions YES
  - Premium: 999 rules ("unlimited"), 1h min polling, compound conditions YES
- **Polling interval floor**: `pollingHours = Math.max(userSelection, limits.minPollingIntervalHours)` (enforced in `create-rule.tsx` and when instantiating a preset in `alerts.tsx`).
- **Compound conditions**: multiple conditions with AND/OR operator — blocked client-side in `createRule` if `!limits.compoundConditions && conditions.length > 1`. Also gated in `create-rule.tsx` `addCondition()`.
- **Lookahead**: user-selectable from `{6, 12, 24, 48, 72, 120, 168}` hours.
- **Cooldown**: user-selectable from `{4, 6, 12, 24, 48}` hours.
- **Rule is "due"** if `last_polled_at` is null OR `(now - last_polled_at) >= polling_interval_hours * 3600s` — filter applied server-side in `poll-weather`.
- **Cooldown gate**: rule skipped in `evaluate-alerts` if `last_triggered_at + cooldown_hours > now` — prevents re-firing on the same event across consecutive polls.
- **Dedup**: `alert_history` has a unique index on `(rule_id, triggered_at_hour_utc)` (migration 00015). A duplicate insert in the same UTC hour returns `23505` and is treated as "already alerted" — push is skipped.

## API Interactions
| Action | Endpoint | Auth |
|--------|----------|------|
| Load | `from('alert_rules').select('*').order('created_at', {ascending: false})` | user JWT (RLS) |
| Create | `.insert({ ...rule, user_id, is_active: true }).select().single()` | user JWT |
| Update | `.update({ ...updates, updated_at }).eq('id', id).select().single()` | user JWT |
| Delete | `.delete().eq('id', id)` | user JWT |
| Toggle | `.update({ is_active }).eq('id', id)` | user JWT |
| Batch activate/deactivate (tier enforcement) | `.update(...).in('id', [...])` | user JWT |

## Error Handling
- All actions catch and set `state.error` to the real error message (`FIX 4` replaced hardcoded fallbacks).
- Tier-limit denial is surfaced as `state.error` rather than a thrown exception — UI checks this before closing modals.
- `alerts.tsx` preset-create flow reads `useAlertRulesStore.getState().error` after `addRule` and keeps the confirmation modal open if set (`FIX 10`).

## Edge Cases — Handled
- Preset creation with no locations — shows Alert dialog directing user to Locations tab.
- Preset creation with no active locations — different alert message, prompts activation.
- Preset creation at tier limit — blocks with Alert dialog suggesting upgrade.
- Compound condition in free tier — blocks with "Compound conditions require a Pro or Premium subscription".
- Tap-to-edit vs tap-toggle on rule card — toggle Switch is wrapped in a Pressable with `stopPropagation` (`FIX 9`) so tapping the Switch doesn't bubble up to the card-tap-to-edit.
- Cold-start deep link into `create-rule?mode=edit&ruleId=X` — `loadRules()` is called in a useEffect to populate `sourceRule` (`FIX 12`).

## Edge Cases — NOT Handled (Gaps)
- **Orphaned rules on location delete**: DB ON DELETE CASCADE covers this, but the local Zustand store is not notified — it holds stale rules until the next `loadRules()`. Could show nonexistent rules briefly.
- **Client-side enforcement is advisory** — the store checks tier limits before insert, but the DB has no corresponding constraint. A manual REST call with elevated anon keys isn't prevented (still subject to RLS).
- **No duplicate-rule detection** — the user can create two identical rules on the same location with the same conditions.
- **Rule name uniqueness** not enforced.
- **`eq` operator on float values**: comparing `temperature == 32` against hourly Open-Meteo data will almost never match exactly. No UI warning or rounding.
- **Negative threshold values** for wind/humidity/UV are not blocked.
- **Polling interval of 1h × 999 rules** is theoretically allowed on Premium — no rate-limit caps on per-user Open-Meteo fan-out (though grid-caching mitigates server cost).
- **No preview / test-fire** — no "send me a test notification" to validate the rule works end-to-end.
- **Lookahead > forecast horizon** — Open-Meteo maxes out at 7 days forecast, but lookahead allows 168h (exactly 7 days). If Open-Meteo shortens its free-tier horizon, overage isn't detected.

## Test Coverage
- `__tests__/stores/alertRulesStore.test.ts` — create/update/delete/toggle/enforceTierLimits with mocked Supabase. Checks tier enforcement correctness, error-message propagation.
- `__tests__/engine/evaluateConditions.test.ts` — validates the pure weather-engine `evaluateRule` / `evaluateCondition` / `getMetricValues` logic across AND/OR combinations, cooldown, empty conditions, the daily-date UTC-boundary fix.
- `__tests__/data/alertPresets.test.ts` — validates every preset has required fields and each condition references a known metric.
- `__tests__/flows/tierEnforcement.test.ts` — store-level test simulating downgrade then upgrade.
- `__tests__/screens/alerts.test.tsx`, `createRule.test.tsx` — jsdom text-presence only. Fraudulent-flagged.

**Verdict:** Store and engine tests catch evaluation logic regressions and tier-enforcement regressions. UI integration (e.g., "does tapping preset actually hit `addRule`?") is not verified by the text-presence screen tests. Maestro E2E deferred.
