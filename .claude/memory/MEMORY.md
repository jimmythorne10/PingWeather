# Project Memory

> Persistent learnings maintained across Claude sessions.
> Updated when non-obvious behaviors, gotchas, or platform quirks are discovered.
> Last updated: YYYY-MM-DD

## Architecture Learnings

### Geocoding Service Structure
**Discovered:** 2026-04-08
**Context:** Building location search autocomplete for weather alert configuration
**Learning:** Created a pure, testable geocoding service with zero dependencies that wraps the Open-Meteo Geocoding API. Service uses native fetch (available in React Native + Node test env), handles optional fields gracefully, and validates query length client-side to avoid API spam. All business logic (formatting, validation) is unit-tested with mocked HTTP layer, making it easy to swap API providers in the future without breaking consumers.
**Files:** 
- `src/services/geocoding.ts` — Core service (formatLocationLabel, searchPlaces)
- `__tests__/services/geocoding.test.ts` — 25 comprehensive unit tests
- `package.json` — Jest config updated to include `__tests__/services/**/*.test.ts` in logic project

## Known Bugs & Workarounds

<!-- Format:
### Title
**Status:** open | fixed | by-design
**Description:** What's broken
**Workaround:** How to deal with it
**Files:** Affected file paths
-->

## Environment & Tooling Notes

<!-- Platform-specific gotchas, CLI quirks, build tool issues, etc. -->

## Deployment Notes

<!-- Deployment-specific learnings, pipeline quirks, environment differences -->
