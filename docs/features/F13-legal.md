# F13: Legal & Compliance

## Overview
EULA (Terms of Use) and Privacy Policy surfaced inside the app. Users accept the EULA during onboarding; acceptance version and timestamp are recorded on the profile. Privacy policy is also hosted publicly at `truthcenteredtech.com/pingweather-privacy`.

## Screens Involved
- `app/onboarding/privacy.tsx` — first-run "Your Privacy Matters" highlights (not the full policy)
- `app/onboarding/eula.tsx` — full scrollable EULA with "I Accept" button
- `app/legal/eula.tsx` — post-onboarding view of the EULA (read-only)
- `app/legal/privacy-policy.tsx` — post-onboarding view of the Privacy Policy
- Source of truth text in `src/data/legal-content.ts` (`EULA_CONTENT`, `PRIVACY_POLICY_CONTENT`)

## Data Model
Writes to `public.profiles`:
- `eula_accepted_version text`
- `eula_accepted_at timestamptz`

No server storage of the policy text — it ships in the app bundle.

## State Management
Uses `authStore.updateProfile` to record acceptance. Content is a module constant.

## Business Rules
- **EULA version** is `'1.0.0'`, effective date April 1, 2026 (per `legal-content.ts`).
- **Acceptance stored immediately on "I Accept"** — version string and ISO timestamp.
- **No re-prompt logic** for future versions: if EULA_CONTENT.version changes to `1.1.0`, existing users with `eula_accepted_version: '1.0.0'` are not re-prompted. This is a gap.
- **Legal contact**: `legal@truthcenteredtech.com` (shown in policy body and project CLAUDE.md).
- **Privacy contact**: `privacy@truthcenteredtech.com`.
- **Governing law**: Virginia, US.

## API Interactions
- `profiles.update({ eula_accepted_version, eula_accepted_at })` on "I Accept".

## Error Handling
- `updateProfile` errors are silently absorbed into `authStore.error` — onboarding advances regardless, which is a gap.

## Edge Cases — Handled
- Content is versioned so future re-prompting logic is possible (just not implemented).
- Policy rendering is purely text — no external dependencies, works offline.

## Edge Cases — NOT Handled (Gaps)
- **No re-accept workflow** when policy version changes.
- **No "do not accept" path** — if the user declines the EULA, there's no rejection UI; the only options are Accept or navigate-back. Navigating back hangs them on the previous screen with no progression.
- **Acceptance not transactional** — if the network fails mid-update, the screen still navigates forward; the profile simply doesn't record acceptance.
- **No privacy-diff notification** — a user is not informed when the policy changes substantively.
- **External privacy-policy URL** in the hosted site and in-app text must be kept in sync manually.

## Test Coverage
- `__tests__/data/legalContent.test.ts` — validates that `EULA_CONTENT` and `PRIVACY_POLICY_CONTENT` have required fields (version, effectiveDate, title, sections), non-empty bodies, expected section count.

No tests for the screens themselves — the gap above (accepting without network) is undetected.

**Verdict:** Content integrity is checked. Acceptance flow has no tests; failure-mode is invisible.
