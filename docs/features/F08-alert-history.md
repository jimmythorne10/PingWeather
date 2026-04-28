# F08: Alert History

## Overview
A read-only log of every triggered alert rule. Each entry shows rule name, location, human-readable condition-met summary, trigger timestamp, and whether a push notification was successfully dispatched. Retention is tier-gated; cleanup happens server-side.

## Screens Involved
- `app/(tabs)/history.tsx` — list (not a tab — `href: null` in tab layout; reached via direct link from Home, Forecasts, Settings)

Home also displays the latest 5 entries as "Recent Notifications" (`entries.slice(0, 5)`) — same data source.

## Data Model
Table: `public.alert_history`
- `id uuid PK`
- `user_id uuid FK → profiles.id ON DELETE CASCADE`
- `rule_id uuid FK → alert_rules.id ON DELETE SET NULL` (history survives rule deletion)
- `rule_name text` (snapshot — doesn't change if the rule is later renamed)
- `location_name text` (snapshot)
- `conditions_met text` — human-readable summary from `formatConditionSummary`
- `forecast_data jsonb` — `{ matchDetails, evaluatedAt }`
- `triggered_at timestamptz default now()`
- `notification_sent boolean default false` — flipped true after successful Expo Push dispatch

Indexes:
- `idx_alert_history_user_triggered (user_id, triggered_at DESC)` — supports the default query
- `idx_alert_history_dedup` unique on `(rule_id, triggered_at_hour_utc(triggered_at))` partial `WHERE rule_id IS NOT NULL` (migration 00015)

RLS:
- SELECT: `auth.uid() = user_id`
- DELETE: `auth.uid() = user_id` (added migration 00015 for GDPR/CCPA self-deletion)
- No user INSERT policy — only service_role can insert.

Cleanup cron: `alert-history-cleanup` runs daily at 03:00 UTC, deletes rows older than 90 days (covers Premium's maximum retention window).

## State Management
Store: `src/stores/alertHistoryStore.ts` (NOT persisted — history is always server-fetched fresh).

State shape:
```
entries: AlertHistoryEntry[]
loading: boolean
error: string | null
```

Actions:
- `loadHistory()` — SELECT `*` ordered by `triggered_at DESC`, limit 100.

## Business Rules
- **Retention by tier** (advisory to the user; actual filter is not in the client query):
  - Free: 7 days
  - Pro: 30 days
  - Premium: 90 days
- Actual DB cleanup removes rows > 90 days regardless of tier. Client-side display does NOT filter by tier — a free user with history written when they were Premium would still see 90-day data.
- **Limit 100** on the client query — history is capped client-side; no pagination.
- **Dedup**: a rule that would fire twice in the same UTC hour produces only one history row (23505 on INSERT in `evaluate-alerts`).
- **`notification_sent = false` after trigger**, flipped to `true` only after Expo Push returns 2xx. Failures leave the row at `false` → UI shows "Not sent" (warning color).

## API Interactions
| Call | Endpoint | Auth |
|------|----------|------|
| Load | `from('alert_history').select('*').order('triggered_at', {ascending: false}).limit(100)` | user JWT (RLS filters) |

## Error Handling
- `loadHistory` catches and sets `error: 'Failed to load alert history'` (generic string, not the underlying message).
- No retry / refresh on error except manual pull-to-refresh.

## Edge Cases — Handled
- Rule deletion: `rule_id` becomes null but history rows persist with snapshot `rule_name` + `location_name`.
- Dedup across a slow/retrying poll cycle prevents duplicate rows.
- Empty state shows a polite "No alerts yet" card with emoji.

## Edge Cases — NOT Handled (Gaps)
- **Retention not enforced on display** — a user who downgrades from Premium to Free still sees rows beyond 7 days until cleanup runs (90-day horizon).
- **Tier-aware server-side filter missing** — the `limits.alertHistoryDays` value is shown in the header ("Free tier: 7-day history") but not applied to the query.
- **Generic error message** — replaces the real error, so users and Jimmy both lose diagnostic info.
- **No pagination** — a Premium user with a busy rule could have >100 entries per 90 days. The 101st+ is invisible.
- **No per-rule filter** — can't filter history to "only show Freeze Warning triggers".
- **No manual delete UI** — RLS allows it, but no UI exposes per-row delete or "clear all".
- **`notification_sent: false` ambiguity** — means "push failed" OR "alert_history existed before the push attempt and update hasn't landed yet" OR "dedup-prevented push" (history row with `alert_history_id: null` — push skipped but the earlier row shows `false` because the second attempt didn't update anything).
- **Snapshot staleness** — `rule_name` reflects the name at trigger time. Renaming the rule does NOT update past history (by design, but possibly confusing).

## Test Coverage
- No dedicated test file for `alertHistoryStore`. Store action is trivial (single fetch).
- Dedup index behavior is validated by migration SQL but has no automated test.
- `__tests__/screens/*.tsx` for history is absent from the listing.

**Verdict:** Minimal coverage; the feature is thin enough that the main risk is a change to the DB schema or RLS policy that would be invisible to tests.
