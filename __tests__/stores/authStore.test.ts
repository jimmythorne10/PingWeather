/**
 * Tests for authStore — FR-AUTH-001 through FR-AUTH-005
 *
 * These tests validate authentication flows as defined in the PRD:
 * sign up, sign in, session persistence, forgot password, and sign out.
 * Some features (forgot password) are TDD — they don't exist yet and SHOULD fail.
 */

// ── Mocks ──────────────────────────────────────────────────────

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    multiGet: jest.fn(() => Promise.resolve([])),
    multiSet: jest.fn(() => Promise.resolve()),
  },
}));

const mockSignUp = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockSignOut = jest.fn();
const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } }));
const mockResetPasswordForEmail = jest.fn();
const mockFrom = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      signUp: mockSignUp,
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      resetPasswordForEmail: mockResetPasswordForEmail,
    },
    from: mockFrom,
  }),
}));

jest.mock('react-native-url-polyfill/auto', () => ({}));

import { useAuthStore } from '../../src/stores/authStore';

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
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

function mockSupabaseSelect(data: unknown, error: unknown = null) {
  mockFrom.mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data, error }),
      }),
    }),
    update: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data, error }),
        }),
      }),
    }),
  });
}

// ── Tests ──────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  resetStore();
});

describe('authStore', () => {
  // ── FR-AUTH-001: Email/Password Sign Up ────────────────────

  describe('FR-AUTH-001: signUp', () => {
    it('creates session and profile on successful sign up', async () => {
      // FR-AUTH-001: account created, profile auto-generated, session set
      mockSignUp.mockResolvedValue({ data: { session: mockSession, user: mockUser }, error: null });
      mockSupabaseSelect(mockProfile);

      await useAuthStore.getState().signUp('test@example.com', 'password123', 'Test User');

      const state = useAuthStore.getState();
      expect(state.session).toEqual(mockSession);
      expect(state.user).toEqual(mockUser);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('passes display name in sign up options', async () => {
      // FR-AUTH-001: display name is stored in profile
      mockSignUp.mockResolvedValue({ data: { session: mockSession, user: mockUser }, error: null });
      mockSupabaseSelect(mockProfile);

      await useAuthStore.getState().signUp('test@example.com', 'password123', 'Test User');

      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        options: { data: { display_name: 'Test User' } },
      });
    });

    it('fetches profile after successful sign up with session', async () => {
      // FR-AUTH-001: profile record auto-generated and loaded
      mockSignUp.mockResolvedValue({ data: { session: mockSession, user: mockUser }, error: null });
      mockSupabaseSelect(mockProfile);

      await useAuthStore.getState().signUp('test@example.com', 'password123', 'Test User');

      expect(mockFrom).toHaveBeenCalledWith('profiles');
      expect(useAuthStore.getState().profile).toEqual(mockProfile);
    });

    it('sets error on duplicate email or weak password', async () => {
      // FR-AUTH-001: error messages for duplicate email, weak password
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
      // FR-AUTH-001: loading state shown
      let capturedLoading = false;
      mockSignUp.mockImplementation(async () => {
        capturedLoading = useAuthStore.getState().loading;
        return { data: { session: mockSession, user: mockUser }, error: null };
      });
      mockSupabaseSelect(mockProfile);

      await useAuthStore.getState().signUp('test@example.com', 'password123', 'Test User');

      expect(capturedLoading).toBe(true);
      expect(useAuthStore.getState().loading).toBe(false);
    });
  });

  // ── FR-AUTH-002: Email/Password Sign In ────────────────────

  describe('FR-AUTH-002: signIn', () => {
    it('creates session and loads profile on sign in', async () => {
      // FR-AUTH-002: session is created, profile is loaded
      mockSignInWithPassword.mockResolvedValue({ data: { session: mockSession, user: mockUser }, error: null });
      mockSupabaseSelect(mockProfile);

      await useAuthStore.getState().signIn('test@example.com', 'password123');

      const state = useAuthStore.getState();
      expect(state.session).toEqual(mockSession);
      expect(state.user).toEqual(mockUser);
      expect(state.profile).toEqual(mockProfile);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets error for invalid credentials', async () => {
      // FR-AUTH-002: error messages for invalid credentials
      mockSignInWithPassword.mockResolvedValue({
        data: { session: null, user: null },
        error: new Error('Invalid login credentials'),
      });

      await useAuthStore.getState().signIn('wrong@example.com', 'bad');

      expect(useAuthStore.getState().error).toBe('Invalid login credentials');
      expect(useAuthStore.getState().session).toBeNull();
    });

    it('shows loading state during sign in', async () => {
      // FR-AUTH-002: loading state shown during authentication
      let capturedLoading = false;
      mockSignInWithPassword.mockImplementation(async () => {
        capturedLoading = useAuthStore.getState().loading;
        return { data: { session: mockSession, user: mockUser }, error: null };
      });
      mockSupabaseSelect(mockProfile);

      await useAuthStore.getState().signIn('test@example.com', 'password123');

      expect(capturedLoading).toBe(true);
      expect(useAuthStore.getState().loading).toBe(false);
    });

    it('loads profile with onboarding_completed field for routing', async () => {
      // FR-AUTH-002: user routed based on onboarding status
      const profileWithOnboarding = { ...mockProfile, onboarding_completed: false };
      mockSignInWithPassword.mockResolvedValue({ data: { session: mockSession, user: mockUser }, error: null });
      mockSupabaseSelect(profileWithOnboarding);

      await useAuthStore.getState().signIn('test@example.com', 'password123');

      expect(useAuthStore.getState().profile?.onboarding_completed).toBe(false);
    });
  });

  // ── FR-AUTH-003: Session Persistence ───────────────────────

  describe('FR-AUTH-003: session persistence', () => {
    it('restores session on initialize', async () => {
      // FR-AUTH-003: session automatically restored without re-entering credentials
      mockGetSession.mockResolvedValue({ data: { session: mockSession } });
      mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
      mockSupabaseSelect(mockProfile);

      await useAuthStore.getState().initialize();

      const state = useAuthStore.getState();
      expect(state.session).toEqual(mockSession);
      expect(state.user).toEqual(mockUser);
      expect(state.initialized).toBe(true);
    });

    it('sets initialized=true even with no session', async () => {
      // FR-AUTH-003: if session expired/invalid, still initialize (redirect to login handled by UI)
      mockGetSession.mockResolvedValue({ data: { session: null } });
      mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });

      await useAuthStore.getState().initialize();

      const state = useAuthStore.getState();
      expect(state.initialized).toBe(true);
      expect(state.session).toBeNull();
    });

    it('sets up auth state change listener', async () => {
      // FR-AUTH-003: token refresh handled automatically by Supabase client
      mockGetSession.mockResolvedValue({ data: { session: null } });
      mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });

      await useAuthStore.getState().initialize();

      expect(mockOnAuthStateChange).toHaveBeenCalled();
    });

    it('handles initialization error gracefully', async () => {
      // FR-AUTH-003: if session invalid, handle gracefully
      mockGetSession.mockRejectedValue(new Error('Network error'));
      mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });

      await useAuthStore.getState().initialize();

      const state = useAuthStore.getState();
      expect(state.initialized).toBe(true);
      expect(state.error).toBe('Failed to initialize auth');
    });
  });

  // ── FR-AUTH-004: Forgot Password ──────────────────────────
  // TDD: This feature does not exist in the current store yet.
  // These tests define the expected behavior per PRD.

  describe('FR-AUTH-004: forgotPassword', () => {
    it('calls Supabase resetPasswordForEmail', async () => {
      // FR-AUTH-004: password reset link is sent
      mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

      const store = useAuthStore.getState();
      // TDD: forgotPassword method should exist on the store
      expect(typeof (store as any).forgotPassword).toBe('function');

      await (store as any).forgotPassword('test@example.com');

      expect(mockResetPasswordForEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('does not confirm whether email exists (security)', async () => {
      // FR-AUTH-004: does NOT confirm whether email exists (prevents account enumeration)
      mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

      const store = useAuthStore.getState();
      await (store as any).forgotPassword('nonexistent@example.com');

      // Should not set an error for nonexistent email — same success message regardless
      const state = useAuthStore.getState();
      expect(state.error).toBeNull();
    });

    it('handles network failure on forgot password', async () => {
      // FR-AUTH-004: error handling for network failure
      mockResetPasswordForEmail.mockResolvedValue({ data: null, error: new Error('Network error') });

      const store = useAuthStore.getState();
      await (store as any).forgotPassword('test@example.com');

      expect(useAuthStore.getState().error).toBeTruthy();
    });
  });

  // ── FR-AUTH-005: Sign Out ─────────────────────────────────

  describe('FR-AUTH-005: signOut', () => {
    it('clears session, user, and profile on sign out', async () => {
      // FR-AUTH-005: all local session state cleared
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
      // FR-AUTH-005: session is cleared server-side
      mockSignOut.mockResolvedValue({ error: null });

      await useAuthStore.getState().signOut();

      expect(mockSignOut).toHaveBeenCalled();
    });

    it('does NOT clear AsyncStorage cached data', async () => {
      // FR-AUTH-005: cached data in AsyncStorage is NOT cleared (locations/rules cache for fast reload on re-login)
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      mockSignOut.mockResolvedValue({ error: null });

      await useAuthStore.getState().signOut();

      // AsyncStorage.clear should NOT be called — cached locations/rules persist
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
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
      mockSupabaseSelect(mockProfile);

      await useAuthStore.getState().fetchProfile();

      expect(mockFrom).toHaveBeenCalledWith('profiles');
      expect(useAuthStore.getState().profile).toEqual(mockProfile);
    });

    it('does nothing if no user is set', async () => {
      useAuthStore.setState({ user: null });

      await useAuthStore.getState().fetchProfile();

      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  describe('updateProfile', () => {
    it('updates profile in Supabase', async () => {
      useAuthStore.setState({ user: mockUser as any });
      const updatedProfile = { ...mockProfile, display_name: 'New Name' };
      mockSupabaseSelect(updatedProfile);

      await useAuthStore.getState().updateProfile({ display_name: 'New Name' });

      expect(useAuthStore.getState().profile?.display_name).toBe('New Name');
    });
  });
});
