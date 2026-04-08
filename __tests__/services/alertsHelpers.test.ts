// Tests for alerts screen helpers
// ────────────────────────────────────────────────────────────

import { pickDefaultLocation } from '../../src/utils/alertsHelpers';
import { mockLocation } from '../helpers/mocks';

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
