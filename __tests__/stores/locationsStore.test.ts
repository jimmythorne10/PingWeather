/**
 * Tests for locationsStore — FR-LOC-001 through FR-LOC-008
 *
 * Validates location CRUD, tier enforcement, default location, and timezone storage.
 * Several features (tier limit enforcement in store, default location, timezone) are
 * TDD — they don't exist in the current store and SHOULD fail.
 */

import { useLocationsStore } from '../../src/stores/locationsStore';
import { useAuthStore } from '../../src/stores/authStore';
import { supabase } from '../../src/utils/supabase';

const mockFrom = supabase.from as jest.Mock;

const mockUser = { id: 'user-123', email: 'test@example.com' };

const sampleLocation = {
  id: 'loc-1',
  user_id: 'user-123',
  name: 'North Pasture',
  latitude: 33.4484,
  longitude: -112.074,
  is_active: true,
  created_at: '2026-04-01',
};

function setLoggedInUser(tier: 'free' | 'pro' | 'premium' = 'free') {
  useAuthStore.setState({
    user: mockUser as any,
    profile: {
      id: 'user-123',
      email: 'test@example.com',
      display_name: 'T',
      subscription_tier: tier,
      onboarding_completed: true,
      eula_accepted_version: '1.0.0',
      eula_accepted_at: '2026-01-01',
      push_token: null,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
  });
}

function resetStore() {
  useLocationsStore.setState({ locations: [], loading: false, error: null });
  useAuthStore.setState({ user: null, profile: null, session: null });
}

// Chain-builder to mock Supabase query builder calls
function mockSupabaseChain(result: { data: unknown; error: unknown }) {
  const chain: any = {
    select: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    delete: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    order: jest.fn(() => Promise.resolve(result)),
    single: jest.fn(() => Promise.resolve(result)),
    then: (cb: any) => Promise.resolve(result).then(cb),
  };
  mockFrom.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
  resetStore();
});

describe('locationsStore', () => {
  // ── FR-LOC-001: View Locations ─────────────────────────────

  describe('FR-LOC-001: loadLocations', () => {
    it('loads locations from Supabase', async () => {
      // FR-LOC-001: all saved locations displayed
      mockSupabaseChain({ data: [sampleLocation], error: null });

      await useLocationsStore.getState().loadLocations();

      expect(mockFrom).toHaveBeenCalledWith('locations');
      expect(useLocationsStore.getState().locations).toEqual([sampleLocation]);
    });

    it('handles load error', async () => {
      // FR-LOC-001: error state handled — error message surfaces the real DB error
      mockSupabaseChain({ data: null, error: new Error('DB error') });

      await useLocationsStore.getState().loadLocations();

      expect(useLocationsStore.getState().error).toBe('DB error');
    });
  });

  // ── FR-LOC-002: Add Location ───────────────────────────────

  describe('FR-LOC-002: addLocation', () => {
    it('includes user_id from auth state', async () => {
      // FR-LOC-002: user_id automatically set from auth state
      setLoggedInUser('free');
      const chain = mockSupabaseChain({ data: sampleLocation, error: null });

      await useLocationsStore.getState().addLocation('North Pasture', 33.4484, -112.074);

      expect(chain.insert).toHaveBeenCalled();
      const insertArg = chain.insert.mock.calls[0][0];
      expect(insertArg.user_id).toBe('user-123');
      expect(insertArg.name).toBe('North Pasture');
      expect(insertArg.latitude).toBe(33.4484);
      expect(insertArg.longitude).toBe(-112.074);
    });

    it('sets is_active to true by default', async () => {
      setLoggedInUser('free');
      const chain = mockSupabaseChain({ data: sampleLocation, error: null });

      await useLocationsStore.getState().addLocation('Site', 1, 2);

      expect(chain.insert.mock.calls[0][0].is_active).toBe(true);
    });

    it('prepends new location to the list', async () => {
      // FR-LOC-002: New location prepended to list
      // Use pro tier so we can have multiple locations (free is limited to 1 per FR-LOC-006)
      setLoggedInUser('pro');
      useLocationsStore.setState({ locations: [{ ...sampleLocation, id: 'old' } as any] });
      mockSupabaseChain({ data: sampleLocation, error: null });

      await useLocationsStore.getState().addLocation('North Pasture', 33.4484, -112.074);

      expect(useLocationsStore.getState().locations[0].id).toBe('loc-1');
      expect(useLocationsStore.getState().locations).toHaveLength(2);
    });

    it('fails if not authenticated', async () => {
      // user_id is required — error message is the thrown Error's message, not a generic fallback
      useAuthStore.setState({ user: null });
      mockSupabaseChain({ data: null, error: null });

      await useLocationsStore.getState().addLocation('Site', 1, 2);

      expect(useLocationsStore.getState().error).toBe('Not authenticated');
    });

    // FR-LOC-007: Timezone Storage (TDD — not yet implemented)
    it('stores timezone from Open-Meteo on location creation', async () => {
      // FR-LOC-007: Locations table needs a timezone text column populated from Open-Meteo response
      setLoggedInUser('free');
      const chain = mockSupabaseChain({
        data: { ...sampleLocation, timezone: 'America/Phoenix' },
        error: null,
      });

      await useLocationsStore.getState().addLocation('Phoenix Site', 33.4484, -112.074);

      const insertArg = chain.insert.mock.calls[0][0];
      // TDD: timezone should be in insert payload
      expect(insertArg).toHaveProperty('timezone');
    });
  });

  // ── FR-LOC-003: Toggle Location Active/Inactive ────────────

  describe('FR-LOC-003: toggleLocation', () => {
    it('updates is_active in Supabase and local state', async () => {
      // FR-LOC-003: location is_active flag is updated
      useLocationsStore.setState({ locations: [sampleLocation] });
      const chain = mockSupabaseChain({ data: null, error: null });

      await useLocationsStore.getState().toggleLocation('loc-1', false);

      expect(chain.update).toHaveBeenCalledWith({ is_active: false });
      expect(useLocationsStore.getState().locations[0].is_active).toBe(false);
    });
  });

  // ── FR-LOC-004: Remove Location ────────────────────────────

  describe('FR-LOC-004: removeLocation', () => {
    it('deletes the location from Supabase and removes from state', async () => {
      // FR-LOC-004: Location removed from UI list immediately
      useLocationsStore.setState({ locations: [sampleLocation] });
      const chain = mockSupabaseChain({ data: null, error: null });

      await useLocationsStore.getState().removeLocation('loc-1');

      expect(chain.delete).toHaveBeenCalled();
      expect(useLocationsStore.getState().locations).toHaveLength(0);
    });

    it('handles delete errors', async () => {
      useLocationsStore.setState({ locations: [sampleLocation] });
      mockSupabaseChain({ data: null, error: new Error('DB error') });

      await useLocationsStore.getState().removeLocation('loc-1');

      // After the fix, the real error message surfaces instead of a generic fallback
      expect(useLocationsStore.getState().error).toBe('DB error');
    });
  });

  // ── FR-LOC-006: Tier Limit Enforcement ─────────────────────
  // TDD: Store does not currently enforce tier limits. These tests SHOULD fail.

  describe('FR-LOC-006: tier limit enforcement', () => {
    it('blocks adding a 2nd location on Free tier (limit 1)', async () => {
      // FR-LOC-006: Free tier limited to 1 location
      setLoggedInUser('free');
      useLocationsStore.setState({ locations: [sampleLocation] });
      mockSupabaseChain({ data: null, error: null });

      await useLocationsStore.getState().addLocation('Second', 1, 2);

      // Should not have inserted the 2nd location
      expect(useLocationsStore.getState().locations).toHaveLength(1);
      expect(useLocationsStore.getState().error).toBeTruthy();
    });

    it('blocks adding a 4th location on Pro tier (limit 3)', async () => {
      // FR-LOC-006: Pro tier limited to 3 locations
      setLoggedInUser('pro');
      useLocationsStore.setState({
        locations: [
          { ...sampleLocation, id: 'l1' },
          { ...sampleLocation, id: 'l2' },
          { ...sampleLocation, id: 'l3' },
        ],
      });
      mockSupabaseChain({ data: null, error: null });

      await useLocationsStore.getState().addLocation('Fourth', 1, 2);

      expect(useLocationsStore.getState().locations).toHaveLength(3);
    });

    it('allows adding an 11th location only on Premium (limit 10)', async () => {
      // FR-LOC-006: Premium tier limited to 10 locations
      setLoggedInUser('premium');
      const locs = Array.from({ length: 10 }, (_, i) => ({ ...sampleLocation, id: `l${i}` }));
      useLocationsStore.setState({ locations: locs });
      mockSupabaseChain({ data: null, error: null });

      await useLocationsStore.getState().addLocation('Eleventh', 1, 2);

      expect(useLocationsStore.getState().locations).toHaveLength(10);
    });
  });

  // ── FR-LOC-008: Default Location ───────────────────────────
  // TDD: Default location is not yet implemented.

  describe('FR-LOC-008: default location', () => {
    it('sets the first added location as default automatically', async () => {
      // FR-LOC-008: First location added is automatically set as default
      setLoggedInUser('free');
      useLocationsStore.setState({ locations: [] });
      const chain = mockSupabaseChain({
        data: { ...sampleLocation, is_default: true },
        error: null,
      });

      await useLocationsStore.getState().addLocation('First', 1, 2);

      const insertArg = chain.insert.mock.calls[0][0];
      // TDD: is_default should be set to true on first location
      expect(insertArg).toHaveProperty('is_default', true);
    });

    it('exposes a setDefaultLocation action', () => {
      // FR-LOC-008: Only one location can be default at a time
      const store = useLocationsStore.getState();
      // TDD: setDefaultLocation should exist
      expect(typeof (store as any).setDefaultLocation).toBe('function');
    });

    it('promotes next location to default when default is deleted', async () => {
      // FR-LOC-008: If default location deleted, next remaining becomes default
      setLoggedInUser('free');
      useLocationsStore.setState({
        locations: [
          { ...sampleLocation, id: 'l1', is_default: true } as any,
          { ...sampleLocation, id: 'l2', is_default: false } as any,
        ],
      });
      mockSupabaseChain({ data: null, error: null });

      await useLocationsStore.getState().removeLocation('l1');

      const remaining = useLocationsStore.getState().locations;
      expect(remaining).toHaveLength(1);
      // TDD: the next location should become default
      expect((remaining[0] as any).is_default).toBe(true);
    });
  });

  describe('clearError', () => {
    it('clears the error state', () => {
      useLocationsStore.setState({ error: 'oops' });
      useLocationsStore.getState().clearError();
      expect(useLocationsStore.getState().error).toBeNull();
    });
  });

  // ── Error handling & Promise<boolean> return values ────────────

  describe('addLocation return value and error propagation', () => {
    it('returns true on successful add', async () => {
      setLoggedInUser('free');
      mockSupabaseChain({ data: sampleLocation, error: null });

      const result = await useLocationsStore.getState().addLocation('North Pasture', 33.4484, -112.074);

      expect(result).toBe(true);
    });

    it('returns false when Supabase returns an error', async () => {
      setLoggedInUser('free');
      mockSupabaseChain({ data: null, error: new Error('column "is_default" does not exist') });

      const result = await useLocationsStore.getState().addLocation('North Pasture', 33.4484, -112.074);

      expect(result).toBe(false);
    });

    it('sets the actual Supabase error message (not the generic fallback) when column missing', async () => {
      setLoggedInUser('free');
      mockSupabaseChain({ data: null, error: new Error('column "is_default" does not exist') });

      await useLocationsStore.getState().addLocation('North Pasture', 33.4484, -112.074);

      const { error } = useLocationsStore.getState();
      expect(error).toBe('column "is_default" does not exist');
    });

    it('still returns false (not throws) when not authenticated', async () => {
      useAuthStore.setState({ user: null });
      mockSupabaseChain({ data: null, error: null });

      const result = await useLocationsStore.getState().addLocation('Site', 1, 2);

      expect(result).toBe(false);
      expect(useLocationsStore.getState().error).toBe('Not authenticated');
    });
  });

  describe('updateLocation return value and error propagation', () => {
    it('returns true on successful update', async () => {
      useLocationsStore.setState({ locations: [sampleLocation] });
      mockSupabaseChain({ data: { ...sampleLocation, name: 'Updated Name' }, error: null });

      const result = await useLocationsStore.getState().updateLocation('loc-1', { name: 'Updated Name' });

      expect(result).toBe(true);
    });

    it('returns false when Supabase returns an error', async () => {
      useLocationsStore.setState({ locations: [sampleLocation] });
      mockSupabaseChain({ data: null, error: new Error('update failed') });

      const result = await useLocationsStore.getState().updateLocation('loc-1', { name: 'Updated Name' });

      expect(result).toBe(false);
    });

    it('sets the actual Supabase error message on update failure', async () => {
      useLocationsStore.setState({ locations: [sampleLocation] });
      mockSupabaseChain({ data: null, error: new Error('update failed') });

      await useLocationsStore.getState().updateLocation('loc-1', { name: 'Updated Name' });

      expect(useLocationsStore.getState().error).toBe('update failed');
    });
  });

  describe('loadLocations error propagation', () => {
    it('sets the actual DB error message (not a generic one) on load failure', async () => {
      mockSupabaseChain({ data: null, error: new Error('relation "locations" does not exist') });

      await useLocationsStore.getState().loadLocations();

      const { error } = useLocationsStore.getState();
      expect(error).toBe('relation "locations" does not exist');
    });
  });
});
