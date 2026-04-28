# F16: FCM Keep-Alive

## Overview
A daily silent data-only push to every registered device. Intended to keep the app in Android's Active / Working Set standby bucket so weather-alert notifications are not delayed or dropped on quiet weather days.

## Screens Involved
None — pure server-side.

## Data Model
Reads `profiles.push_token` (all rows with non-null tokens, paginated 500 rows/query).

Cron: `fcm-keepalive-daily` scheduled `0 10 * * *` UTC (migration 00011, fixed by 00016). Timeout 30,000 ms. Auth via vault service-role key.

## State Management
None.

## Business Rules
- **Schedule**: once per day at 10:00 UTC (originally tuned for US daytime hours).
- **Page size**: 500 rows per DB query; loops until a page returns fewer rows.
- **Batch size**: up to 100 tokens per Expo Push request (Expo's per-request ceiling).
- **Message shape**: `{ to, priority: 'normal', _contentAvailable: true, data: { type: 'keepalive' } }`. No title / body → delivered as data-only on Android, background-refresh on iOS. `priority: 'normal'` means Doze batching is acceptable — keepalive doesn't need instant delivery.
- **No side effects** on DB — the function doesn't flip any flags or record receipts.

## API Interactions
| Call | Endpoint | Auth |
|------|----------|------|
| Cron trigger | `POST /functions/v1/fcm-keepalive` | vault service-role |
| Fetch tokens | `profiles.select('push_token').not('push_token', 'is', null).range(...)` | service role |
| Send | `POST https://exp.host/--/api/v2/push/send` (array body) | none |

## Error Handling
- Page fetch error → `break` out of pagination, logs. Continues to send accumulated tokens.
- Per-batch send failure → logs status + response body, continues.
- Generic catch → 500.

## Edge Cases — Handled
- Large user base via pagination.
- Expo batch ceiling via `BATCH_SIZE = 100`.
- No tokens → returns `{ sent: 0 }`.

## Edge Cases — NOT Handled (Gaps)
- **Invalid tokens**: no cleanup. Every day the same dead tokens get retried.
- **iOS silent push quota**: `_contentAvailable` pushes on iOS are rate-limited by Apple (~3/hr per app). Not a problem at current scale but would be at 10k+ users.
- **No per-day retry** if the 10:00 UTC cron fails — next attempt is +24h.
- **No ack / delivery signal** — the function has no way to tell if the keepalive actually prevented app suspension.
- **Same notification channel**: no channel is specified — data-only pushes use FCM default handling, which is fine but opaque.
- **Hourly sync with other pushes**: the alert/digest pushes during the same day serve the same function implicitly. The keepalive is a safety net for days with zero other activity.

## Test Coverage
No tests. Behavior is validated by checking function logs after runs.

**Verdict:** Works in principle. Invalid-token cleanup is the main observable gap.
