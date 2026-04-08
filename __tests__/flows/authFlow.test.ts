// Auth flow integration tests
// Covers: FR-AUTH-001 through FR-AUTH-005
// ────────────────────────────────────────────────────────────

import { makeSupabaseMock, mockProfile } from '../helpers/mocks';

const supabaseMock = makeSupabaseMock();

jest.mock('../../src/utils/supabase', () => ({
  supabase: supabaseMock,
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

import { useAuthStore } from '../../src/stores/authStore';

describe('Auth Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      session: null,
      user: null,
      profile: null,
      initialized: false,
      loading: false,
      error: null,
    });
  });

  // FR-AUTH-001: signup creates account and loads session
  it('signUp: calls supabase.auth.signUp with email, password, and display_name', async () => {
    supabaseMock.auth.signUp = jest.fn(() =>
      Promise.resolve({
        data: { session: { user: { id: 'u1' } } as any, user: { id: 'u1' } as any },
        error: null,
      })
    );
    await useAuthStore.getState().signUp('a@b.co', 'pass123', 'Alice');
    expect(supabaseMock.auth.signUp).toHaveBeenCalledWith({
      email: 'a@b.co',
      password: 'pass123',
      options: { data: { display_name: 'Alice' } },
    });
  });

  // FR-AUTH-002: signin stores session
  it('signIn: stores session on successful sign in', async () => {
    const fakeSession = { user: { id: 'u1' } } as any;
    supabaseMock.auth.signInWithPassword = jest.fn(() =>
      Promise.resolve({ data: { session: fakeSession, user: fakeSession.user }, error: null })
    );
    await useAuthStore.getState().signIn('a@b.co', 'pass');
    expect(useAuthStore.getState().session).toBe(fakeSession);
  });

  // FR-AUTH-002: signin error sets error state
  it('signIn: sets error state on failure', async () => {
    supabaseMock.auth.signInWithPassword = jest.fn(() =>
      Promise.resolve({ data: { session: null, user: null }, error: new Error('Invalid') })
    );
    await useAuthStore.getState().signIn('a@b.co', 'bad');
    expect(useAuthStore.getState().error).toBeTruthy();
  });

  // FR-AUTH-005: sign out clears session
  it('signOut: clears session, user, and profile', async () => {
    useAuthStore.setState({
      session: { user: { id: 'u1' } } as any,
      user: { id: 'u1' } as any,
      profile: mockProfile(),
    });
    await useAuthStore.getState().signOut();
    const state = useAuthStore.getState();
    expect(state.session).toBeNull();
    expect(state.user).toBeNull();
    expect(state.profile).toBeNull();
  });

  // FR-AUTH-004: forgot password calls resetPasswordForEmail (TDD — method not implemented)
  it('forgotPassword: calls supabase.auth.resetPasswordForEmail', async () => {
    const store: any = useAuthStore.getState();
    // TDD: this method does not exist yet on the store
    expect(typeof store.resetPassword).toBe('function');
    await store.resetPassword('a@b.co');
    expect(supabaseMock.auth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.co');
  });

  // FR-AUTH-003: session persistence via initialize
  it('initialize: restores session if one exists', async () => {
    const fakeSession = { user: { id: 'u1' } } as any;
    supabaseMock.auth.getSession = jest.fn(() =>
      Promise.resolve({ data: { session: fakeSession } })
    );
    await useAuthStore.getState().initialize();
    expect(useAuthStore.getState().session).toBe(fakeSession);
    expect(useAuthStore.getState().initialized).toBe(true);
  });
});
