/**
 * Tests for authStore — FR-AUTH-001 through FR-AUTH-005
 *
 * These tests validate authentication flows as defined in the PRD:
 * sign up, sign in, session persistence, forgot password, and sign out.
 * Some features (forgot password) are TDD — they don't exist yet and SHOULD fail.
 */

import { useAuthStore } from '../../src/stores/authStore';
import { supabase } from '../../src/utils/supabase';

// Access the global mocks from jest.setup.ts via the supabase singleton.
const mockSignUp = supabase.auth.signUp as jest.Mock;
const mockSignInWithPassword = supabase.auth.signInWithPassword as jest.Mock;
const mockSignOut = supabase.auth.signOut as jest.Mock;
const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockOnAuthStateChange = supabase.auth.onAuthStateChange as jest.Mock;
const mockResetPasswordForEmail = supabase.auth.resetPasswordForEmail as jest.Mock;
const mockFrom = supabase.from as jest.Mock;
// Helper exposed by the global Supabase mock
const setFromResponse = (supabase as unknown as { __setFromResponse: (data: unknown, error?: unknown) => void }).__setFromResponse;

// ── Helpers ────────────────────────────────────────────────────

function resetStore() {
  useAuthStore.setState({
    session: null,
    user: null,
    profile: null,
    initialized: false,
    loading: false,
    error: null,
  });
}

const mockUser = { id: 'user-123', email: 'test@example.com' };
const mockSession = { user: mockUser, access_token: 'tok', refresh_token: 'ref' };
const mockProfile = {
  id: 'user-123',
  email: 'test@example.com',
  display_name: 'Test User',
  subscription_tier: 'free' as const,
  onboarding_completed: false,
  eula_accepted_version: null,
  eula_accepted_at: null,
  push_token: null,
  digest_enabled: false,
  digest_frequency: 'daily' as const,
  digest_hour: 7,
  digest_day_of_week: 1,
  digest_location_id: null,
  digest_last_sent_at: null,
  temperature_unit: 'fahrenheit' as const,
  wind_speed_unit: 'mph' as const,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

// ── Tests ──────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  resetStore();
});

describe('authStore', () => {
  // ── FR-AUTH-001: Email/Password Sign Up ────────────────────

  describe('FR-AUTH-001: signUp', () => {
    it('creates session and profile on successful sign up', async () => {
      mockSignUp.mockResolvedValue({ data: { session: mockSession, user: mockUser }, error: null });
      setFromResponse(mockProfile);

      await useAuthStore.getState().signUp('test@example.com', 'password123', 'Test User');

      const state = useAuthStore.getState();
      expect(state.session).toEqual(mockSession);
      expect(state.user).toEqual(mockUser);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('passes display name in sign up options', async () => {
      mockSignUp.mockResolvedValue({ data: { session: mockSession, user: mockUser }, error: null });
      setFromResponse(mockProfile);

      await useAuthStore.getState().signUp('test@example.com', 'password123', 'Test User');

      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        options: { data: { display_name: 'Test User' } },
      });
    });

    it('fetches profile after successful sign up with session', async () => {
      mockSignUp.mockResolvedValue({ data: { session: mockSession, user: mockUser }, error: null });
      setFromResponse(mockProfile);

      await useAuthStore.getState().signUp('test@example.com', 'password123', 'Test User');

      expect(mockFrom).toHaveBeenCalledWith('profiles');
      expect(useAuthStore.getState().profile).toEqual(mockProfile);
    });

    it('sets error on duplicate email or weak password', async () => {
      mockSignUp.mockResolvedValue({
        data: { session: null, user: null },
        error: new Error('User already registered'),
      });

      await useAuthStore.getState().signUp('dup@example.com', 'pw', 'Dup');

      const state = useAuthStore.getState();
      expect(state.error).toBe('User already registered');
      expect(state.loading).toBe(false);
      expect(state.session).toBeNull();
    });

    it('shows loading state during sign up', async () => {
      let capturedLoading = false;
      mockSignUp.mockImplementation(async () => {
        capturedLoading = useAuthStore.getState().loading;
        return { data: { session: mockSession, user: mockUser }, error: null };
      });
      setFromResponse(mockProfile);

      await useAuthStore.getState().signUp('test@example.com', 'password123', 'Test User');

      expect(capturedLoading).toBe(true);
      expect(useAuthStore.getState().loading).toBe(false);
    });
  });

  // ── FR-AUTH-002: Email/Password Sign In ────────────────────

  describe('FR-AUTH-002: signIn', () => {
    it('creates session and loads profile on sign in', async () => {
      mockSignInWithPassword.mockResolvedValue({ data: { session: mockSession, user: mockUser }, error: null });
      setFromResponse(mockProfile);

      await useAuthStore.getState().signIn('test@example.com', 'password123');

      const state = useAuthStore.getState();
      expect(state.session).toEqual(mockSession);
      expect(state.user).toEqual(mockUser);
      expect(state.profile).toEqual(mockProfile);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets error for invalid credentials', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { session: null, user: null },
        error: new Error('Invalid login credentials'),
      });

      await useAuthStore.getState().signIn('wrong@example.com', 'bad');

      expect(useAuthStore.getState().error).toBe('Invalid login credentials');
      expect(useAuthStore.getState().session).toBeNull();
    });

    it('shows loading state during sign in', async () => {
      let capturedLoading = false;
      mockSignInWithPassword.mockImplementation(async () => {
        capturedLoading = useAuthStore.getState().loading;
        return { data: { session: mockSession, user: mockUser }, error: null };
      });
      setFromResponse(mockProfile);

      await useAuthStore.getState().signIn('test@example.com', 'password123');

      expect(capturedLoading).toBe(true);
      expect(useAuthStore.getState().loading).toBe(false);
    });

    it('loads profile with onboarding_completed field for routing', async () => {
      const profileWithOnboarding = { ...mockProfile, onboarding_completed: false };
      mockSignInWithPassword.mockResolvedValue({ data: { session: mockSession, user: mockUser }, error: null });
      setFromResponse(profileWithOnboarding);

      await useAuthStore.getState().signIn('test@example.com', 'password123');

      expect(useAuthStore.getState().profile?.onboarding_completed).toBe(false);
    });
  });

  // ── FR-AUTH-003: Session Persistence ───────────────────────

  describe('FR-AUTH-003: session persistence', () => {
    it('restores session on initialize', async () => {
      mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });
      setFromResponse(mockProfile);

      await useAuthStore.getState().initialize();

      const state = useAuthStore.getState();
      expect(state.session).toEqual(mockSession);
      expect(state.user).toEqual(mockUser);
      expect(state.initialized).toBe(true);
    });

    it('sets initialized=true even with no session', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

      await useAuthStore.getState().initialize();

      const state = useAuthStore.getState();
      expect(state.initialized).toBe(true);
      expect(state.session).toBeNull();
    });

    it('sets up auth state change listener', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

      await useAuthStore.getState().initialize();

      expect(mockOnAuthStateChange).toHaveBeenCalled();
    });

    it('handles initialization error gracefully', async () => {
      mockGetSession.mockRejectedValue(new Error('Network error'));

      await useAuthStore.getState().initialize();

      const state = useAuthStore.getState();
      expect(state.initialized).toBe(true);
      expect(state.error).toBe('Failed to initialize auth');
    });
  });

  // ── FR-AUTH-004: Forgot Password ──────────────────────────
  // TDD: This feature does not exist in the current store yet.

  describe('FR-AUTH-004: forgotPassword', () => {
    it('calls Supabase resetPasswordForEmail with a redirectTo pointing at /reset-password', async () => {
      // FR-AUTH-004: the reset email must deep-link back into the app's
      // reset-password screen, not a web page. Without redirectTo, Supabase
      // falls back to the project's Site URL, which is wrong for a mobile app.
      mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

      const store = useAuthStore.getState();
      expect(typeof (store as any).forgotPassword).toBe('function');

      await (store as any).forgotPassword('test@example.com');

      expect(mockResetPasswordForEmail).toHaveBeenCalledTimes(1);
      const [emailArg, optionsArg] = mockResetPasswordForEmail.mock.calls[0];
      expect(emailArg).toBe('test@example.com');
      expect(optionsArg).toBeDefined();
      // The mock for expo-linking in jest.setup.ts returns
      // `pingweather://reset-password` for createURL('/reset-password').
      expect(optionsArg.redirectTo).toBe('pingweather://reset-password');
    });

    it('does not confirm whether email exists (security)', async () => {
      mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

      const store = useAuthStore.getState();
      await (store as any).forgotPassword('nonexistent@example.com');

      const state = useAuthStore.getState();
      expect(state.error).toBeNull();
    });

    it('handles network failure on forgot password', async () => {
      mockResetPasswordForEmail.mockResolvedValue({ data: null, error: new Error('Network error') });

      const store = useAuthStore.getState();
      await (store as any).forgotPassword('test@example.com');

      expect(useAuthStore.getState().error).toBeTruthy();
    });
  });

  // ── FR-AUTH-005: Sign Out ─────────────────────────────────

  describe('FR-AUTH-005: signOut', () => {
    it('clears session, user, and profile on sign out', async () => {
      useAuthStore.setState({
        session: mockSession as any,
        user: mockUser as any,
        profile: mockProfile,
      });
      mockSignOut.mockResolvedValue({ error: null });

      await useAuthStore.getState().signOut();

      const state = useAuthStore.getState();
      expect(state.session).toBeNull();
      expect(state.user).toBeNull();
      expect(state.profile).toBeNull();
    });

    it('calls supabase.auth.signOut', async () => {
      mockSignOut.mockResolvedValue({ error: null });

      await useAuthStore.getState().signOut();

      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  // ── clearError ────────────────────────────────────────────

  describe('clearError', () => {
    it('clears the error state', () => {
      useAuthStore.setState({ error: 'Some error' });

      useAuthStore.getState().clearError();

      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  // ── Profile operations ────────────────────────────────────

  describe('fetchProfile', () => {
    it('fetches profile by user id', async () => {
      useAuthStore.setState({ user: mockUser as any });
      setFromResponse(mockProfile);

      await useAuthStore.getState().fetchProfile();

      expect(mockFrom).toHaveBeenCalledWith('profiles');
      expect(useAuthStore.getState().profile).toEqual(mockProfile);
    });

    it('does nothing if no user is set', async () => {
      useAuthStore.setState({ user: null });
      mockFrom.mockClear();

      await useAuthStore.getState().fetchProfile();

      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  describe('updateProfile', () => {
    it('updates profile in Supabase', async () => {
      useAuthStore.setState({ user: mockUser as any });
      const updatedProfile = { ...mockProfile, display_name: 'New Name' };
      setFromResponse(updatedProfile);

      await useAuthStore.getState().updateProfile({ display_name: 'New Name' });

      expect(useAuthStore.getState().profile?.display_name).toBe('New Name');
    });
  });
});
