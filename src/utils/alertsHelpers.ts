// Alert screen helpers
// ────────────────────────────────────────────────────────────

import type { WatchLocation } from '../types';

/**
 * Selects the default location from an array of locations.
 * Returns the location marked as is_default=true if it exists and is active,
 * otherwise returns the first active location.
 * Returns undefined if no active locations exist.
 */
export function pickDefaultLocation(
  locations: WatchLocation[]
): WatchLocation | undefined {
  const active = locations.filter((l) => l.is_active);
  return active.find((l) => l.is_default) ?? active[0];
}
