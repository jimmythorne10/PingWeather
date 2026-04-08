// Alert screen helpers
// ────────────────────────────────────────────────────────────

import type { AlertRule, WatchLocation } from '../types';

export type AlertsTabFilter = 'All' | 'Active' | 'Inactive';

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

/**
 * Filters alert rules by active/inactive status and location.
 * Applies both filters with AND logic.
 *
 * @param rules - Array of alert rules to filter
 * @param tab - Filter by active status: 'All', 'Active', or 'Inactive'
 * @param locationId - Filter by location ID, or 'all' to show all locations
 * @returns Filtered array of rules matching both criteria
 */
export function filterRules(
  rules: AlertRule[],
  tab: AlertsTabFilter,
  locationId: string | 'all'
): AlertRule[] {
  return rules.filter((rule) => {
    if (tab === 'Active' && !rule.is_active) return false;
    if (tab === 'Inactive' && rule.is_active) return false;
    if (locationId !== 'all' && rule.location_id !== locationId) return false;
    return true;
  });
}

/**
 * Finds the name of a location by its ID.
 * Returns "Unknown location" if the location is not found.
 *
 * @param locations - Array of locations to search
 * @param locationId - ID of location to find
 * @returns Location name or "Unknown location"
 */
export function findLocationName(
  locations: WatchLocation[],
  locationId: string
): string {
  const loc = locations.find((l) => l.id === locationId);
  return loc ? loc.name : 'Unknown location';
}
