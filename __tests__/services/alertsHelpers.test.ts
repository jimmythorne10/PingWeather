// Tests for alerts screen helpers
// ────────────────────────────────────────────────────────────

import { pickDefaultLocation, filterRules, findLocationName } from '../../src/utils/alertsHelpers';
import { mockLocation, mockRule } from '../helpers/mocks';

describe('pickDefaultLocation', () => {
  // Test case 1: Returns location with is_default=true when one exists and is active
  it('returns the location marked as is_default=true when it exists and is active', () => {
    const locations = [
      mockLocation({ id: 'loc-1', name: 'Home', is_active: true, is_default: false }),
      mockLocation({ id: 'loc-2', name: 'Work', is_active: true, is_default: true }),
      mockLocation({ id: 'loc-3', name: 'Farm', is_active: true, is_default: false }),
    ];

    const result = pickDefaultLocation(locations);
    expect(result?.id).toBe('loc-2');
    expect(result?.name).toBe('Work');
  });

  // Test case 2: Returns first active location when none are marked as default
  it('returns the first active location when none are marked as is_default=true', () => {
    const locations = [
      mockLocation({ id: 'loc-1', name: 'Home', is_active: true, is_default: false }),
      mockLocation({ id: 'loc-2', name: 'Work', is_active: true, is_default: false }),
    ];

    const result = pickDefaultLocation(locations);
    expect(result?.id).toBe('loc-1');
  });

  // Test case 3: Skips inactive locations even if marked as default
  it('skips inactive locations even if one is marked as is_default=true', () => {
    const locations = [
      mockLocation({ id: 'loc-1', name: 'Home', is_active: false, is_default: true }),
      mockLocation({ id: 'loc-2', name: 'Work', is_active: true, is_default: false }),
    ];

    const result = pickDefaultLocation(locations);
    expect(result?.id).toBe('loc-2');
    expect(result?.name).toBe('Work');
  });

  // Test case 4: Returns undefined when list is empty
  it('returns undefined when the locations list is empty', () => {
    const result = pickDefaultLocation([]);
    expect(result).toBeUndefined();
  });

  // Test case 5: Returns undefined when all locations are inactive
  it('returns undefined when all locations are inactive', () => {
    const locations = [
      mockLocation({ id: 'loc-1', name: 'Home', is_active: false, is_default: true }),
      mockLocation({ id: 'loc-2', name: 'Work', is_active: false, is_default: false }),
    ];

    const result = pickDefaultLocation(locations);
    expect(result).toBeUndefined();
  });
});

describe('filterRules', () => {
  const baseRules = [
    mockRule({ id: 'r-1', location_id: 'loc-1', is_active: true, name: 'Rule 1' }),
    mockRule({ id: 'r-2', location_id: 'loc-2', is_active: false, name: 'Rule 2' }),
    mockRule({ id: 'r-3', location_id: 'loc-1', is_active: true, name: 'Rule 3' }),
    mockRule({ id: 'r-4', location_id: 'loc-2', is_active: true, name: 'Rule 4' }),
  ];

  // Test case 1: All tab with 'all' location returns all rules
  it('returns all rules when tab is All and locationId is all', () => {
    const result = filterRules(baseRules, 'All', 'all');
    expect(result).toHaveLength(4);
    expect(result.map((r) => r.id)).toEqual(['r-1', 'r-2', 'r-3', 'r-4']);
  });

  // Test case 2: Active tab with 'all' location returns only active rules
  it('returns only active rules when tab is Active and locationId is all', () => {
    const result = filterRules(baseRules, 'Active', 'all');
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.id)).toEqual(['r-1', 'r-3', 'r-4']);
  });

  // Test case 3: Inactive tab with 'all' location returns only inactive rules
  it('returns only inactive rules when tab is Inactive and locationId is all', () => {
    const result = filterRules(baseRules, 'Inactive', 'all');
    expect(result).toHaveLength(1);
    expect(result.map((r) => r.id)).toEqual(['r-2']);
  });

  // Test case 4: All tab with specific location returns rules for that location
  it('returns only rules for a specific location when locationId is provided', () => {
    const result = filterRules(baseRules, 'All', 'loc-1');
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(['r-1', 'r-3']);
  });

  // Test case 5: Active tab with specific location (AND logic)
  it('returns active rules for a specific location (AND logic)', () => {
    const result = filterRules(baseRules, 'Active', 'loc-2');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r-4');
  });

  // Test case 6: Inactive tab with specific location (AND logic)
  it('returns inactive rules for a specific location (AND logic)', () => {
    const result = filterRules(baseRules, 'Inactive', 'loc-2');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r-2');
  });

  // Test case 7: Empty rules list
  it('returns empty array when rules list is empty', () => {
    const result = filterRules([], 'All', 'all');
    expect(result).toHaveLength(0);
  });

  // Test case 8: Location that no rule matches
  it('returns empty array when no rules match the specified location', () => {
    const result = filterRules(baseRules, 'All', 'loc-99');
    expect(result).toHaveLength(0);
  });
});

describe('findLocationName', () => {
  const locations = [
    mockLocation({ id: 'loc-1', name: 'North Pasture' }),
    mockLocation({ id: 'loc-2', name: 'Job Site #2' }),
    mockLocation({ id: 'loc-3', name: 'Home' }),
  ];

  // Test case 1: Match found
  it('returns the location name when a match is found', () => {
    const result = findLocationName(locations, 'loc-2');
    expect(result).toBe('Job Site #2');
  });

  // Test case 2: No match found
  it('returns "Unknown location" when no match is found', () => {
    const result = findLocationName(locations, 'loc-99');
    expect(result).toBe('Unknown location');
  });

  // Test case 3: Empty locations list
  it('returns "Unknown location" when locations list is empty', () => {
    const result = findLocationName([], 'loc-1');
    expect(result).toBe('Unknown location');
  });
});
