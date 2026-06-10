/**
 * BUG-008: Barometric Pressure unit must be persisted to the profiles table
 *
 * Symptom: settings.tsx pressure unit toggle called settings.setPressureUnit(unit)
 * but did NOT call updateProfile({ pressure_unit: unit }), so the selection lived
 * only in AsyncStorage and reset on logout / reinstall.
 *
 * This test verifies that authStore.updateProfile accepts pressure_unit and
 * persists it to the database — the same pattern used for temperature_unit
 * (migration 00010) and wind_speed_unit (migration 00017).
 *
 * The test is intentionally written BEFORE the implementation:
 *   - Before fix: Profile type has no pressure_unit -> TypeScript error
 *   - After fix:  pressure_unit on Profile + migration 00021 + settings.tsx wiring
 */

import { useAuthStore } from '../../src/stores/authStore';
import { supabase } from '../../src/utils/supabase';

const mockFrom = supabase.from as jest.Mock;

// ── helpers ─────────────────────────────────────────────────────────────────

const mockUser = { id: 'user-123', email: 'test@example.com' };

const baseProfile = {
  id: 'user-123',
  email: 'test@example.com',
  display_name: 'Test User',
  subscription_tier: 'free' as const,
  onboarding_completed: true,
  eula_accepted_version: '1.0.0',
  eula_accepted_at: '2026-01-01',
  push_token: null,
  digest_enabled: false,
  digest_frequency: 'daily' as const,
  digest_hour: 7,
  digest_day_of_week: 1,
  digest_location_id: null,
  digest_last_sent_at: null,
  temperature_unit: 'fahrenheit' as const,
  wind_speed_unit: 'mph' as const,
  pressure_unit: 'hPa' as const,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

function resetAuthStore() {
  useAuthStore.setState({
    session: null,
    user: mockUser as any,
    profile: baseProfile as any,
    initialized: true,
    loading: false,
    error: null,
  });
}

/** Build a Supabase chain mock that resolves its terminal call with `result`. */
function mockChainResolving(result: { data: unknown; error: unknown }) {
  const chain: any = {
    select: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    delete: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    in: jest.fn(() => chain),
    order: jest.fn(() => Promise.resolve(result)),
    single: jest.fn(() => Promise.resolve(result)),
    then: (cb: any) => Promise.resolve(result).then(cb),
  };
  mockFrom.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
  resetAuthStore();
});

// ── BUG-008: pressure_unit persisted via updateProfile ───────────────────────

describe('BUG-008: pressure_unit persisted to profiles table', () => {
  it('Profile type includes pressure_unit field', () => {
    // If Profile is missing pressure_unit, TypeScript will error at import time.
    // At runtime we verify the field is present on the profile in state.
    const profile = useAuthStore.getState().profile;
    expect(profile).not.toBeNull();
    expect(Object.prototype.hasOwnProperty.call(profile, 'pressure_unit')).toBe(true);
  });

  it('updateProfile accepts pressure_unit: hPa and returns true', async () => {
    const updatedProfile = { ...baseProfile, pressure_unit: 'hPa' as const };
    mockChainResolving({ data: updatedProfile, error: null });

    const result = await useAuthStore.getState().updateProfile({ pressure_unit: 'hPa' });

    expect(result).toBe(true);
  });

  it('updateProfile accepts pressure_unit: inHg and returns true', async () => {
    const updatedProfile = { ...baseProfile, pressure_unit: 'inHg' as const };
    mockChainResolving({ data: updatedProfile, error: null });

    const result = await useAuthStore.getState().updateProfile({ pressure_unit: 'inHg' });

    expect(result).toBe(true);
  });

  it('updateProfile writes pressure_unit to the database (verifies supabase.from called)', async () => {
    const updatedProfile = { ...baseProfile, pressure_unit: 'inHg' as const };
    const chain = mockChainResolving({ data: updatedProfile, error: null });

    await useAuthStore.getState().updateProfile({ pressure_unit: 'inHg' });

    // Verify that a DB write was attempted (from() -> update() -> eq() -> select() -> single())
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(chain.update).toHaveBeenCalledWith({ pressure_unit: 'inHg' });
  });

  it('updateProfile reflects new pressure_unit in store state after success', async () => {
    const updatedProfile = { ...baseProfile, pressure_unit: 'inHg' as const };
    mockChainResolving({ data: updatedProfile, error: null });

    await useAuthStore.getState().updateProfile({ pressure_unit: 'inHg' });

    const profile = useAuthStore.getState().profile;
    expect(profile?.pressure_unit).toBe('inHg');
  });

  it('returns false and sets error when DB write fails', async () => {
    mockChainResolving({ data: null, error: new Error('column does not exist') });

    const result = await useAuthStore.getState().updateProfile({ pressure_unit: 'hPa' });

    expect(result).toBe(false);
    expect(useAuthStore.getState().error).toBeTruthy();
  });
});
