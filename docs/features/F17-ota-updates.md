# F17: OTA Updates

## Overview
Expo Updates (EAS Update) lets pure-JavaScript changes reach installed apps without requiring a new store upload. On launch, the root layout checks for an update, downloads it if available, and calls `Updates.reloadAsync()` to swap the JS bundle before first paint.

## Screens Involved
- `app/_layout.tsx` — `checkUpdate()` runs in the initialization `Promise.all`.

## Data Model
Configured in `app.json`:
```
"runtimeVersion": { "policy": "sdkVersion" },
"updates": { "url": "https://u.expo.dev/6456b66e-6e5a-4881-984f-20e2f3b477f4" }
```

EAS config in `eas.json`:
- `development` profile → `channel: "development"`
- `preview` profile → `channel: "preview"`
- `production` profile → `channel: "production"`

`expo-updates` is listed as a dependency (`~29.0.16` per package.json).

## State Management
None persisted. `checkUpdate` is in-flight during the loading spinner.

## Business Rules
- **Runtime version = SDK version** (currently 54). Updates can only target the same SDK version they were built for.
- **Skips in dev** — `if (__DEV__) return;` short-circuits for local dev builds (hot-reload handles JS swaps there).
- **Fire-and-forget error handling** — any error (network, bundle mismatch) results in `continue normally`; the user gets the currently-installed bundle.
- **reloadAsync never returns** — it restarts the JS runtime. The loading spinner stays on screen until the new bundle takes over.
- **Channel separation**: development / preview / production builds pull from separate channels. A preview update won't land on a production install.

## API Interactions
| Call | Endpoint | Auth |
|------|----------|------|
| Check | `Updates.checkForUpdateAsync()` | EAS API via configured URL |
| Fetch | `Updates.fetchUpdateAsync()` | EAS API |
| Reload | `Updates.reloadAsync()` | native |

## Error Handling
- Single try/catch around the trio; errors are silently swallowed. The comment in the code says "network failure or no update available — continue normally".

## Edge Cases — Handled
- Dev mode is skipped.
- Update not available: `result.isAvailable` is false, no-op.
- Partial failure (check succeeds, fetch fails): caught, app launches with existing bundle.

## Edge Cases — NOT Handled (Gaps)
- **No user signal**: no UI ever mentions "app updated". If a bug is introduced via OTA, the user has no way to roll back short of reinstalling.
- **No force-update gate**: if the server decides SDK 54 is retired and pushes an incompatible bundle, the check passes runtime-version match but the bundle may crash on load. No versioned manifest beyond the SDK-policy.
- **Silent error swallow**: "continue normally" means a malformed update URL or expired EAS credential never surfaces. Jimmy would only see it if he ran a specific `eas update:list` command.
- **No staged rollout**: every `eas update --branch preview` hits all preview installs at once.
- **Race with auth init**: `Promise.all([initialize(), checkUpdate()])` — if `checkUpdate` is slow, the auth init is blocked behind it. A cold-start with stale updates server-side delays the app.

## Test Coverage
None. Configuration correctness is only verified by shipping a build and observing updates land.

**Verdict:** Standard Expo OTA setup. Adequate for MVP; would need staged rollout + rollback UI before high-stakes production use.
