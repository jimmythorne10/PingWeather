import { create } from 'zustand';
import * as Linking from 'expo-linking';
import { supabase } from '../utils/supabase';
import type { Profile } from '../types';
import type { Session, User } from '@supabase/supabase-js';

// Module-level subscription handle. Kept outside the store so it survives
// Zustand re-instantiation and is never leaked across initialize() calls.
let _authSubscription: { unsubscribe: () => void } | null = null;

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  initialized: boolean;
  loading: boolean;
  error: string | null;

  initialize: () => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  session: null,
  user: null,
  profile: null,
  initialized: false,
  loading: false,
  error: null,

  initialize: async () => {
    try {
      // Tear down any existing listener before registering a new one.
      // Without this guard, every hot-reload in dev (or any double-call to
      // initialize()) stacks another listener on the Supabase auth bus.
      _authSubscription?.unsubscribe();

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        set({ session, user: session.user });
        await get().fetchProfile();
      }
      set({ initialized: true });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        set({ session, user: session?.user ?? null });
        if (session) {
          // fetchProfile is async; handle failures so a bad network on cold
          // start doesn't leave profile null and strand the auth guard in a
          // blank-screen limbo (neither onboarding nor tabs branch is true).
          get().fetchProfile().catch((err) => {
            console.error('[authStore] fetchProfile failed:', err);
            set({ error: 'Failed to load profile. Please restart the app.' });
          });
        } else {
          set({ profile: null });
        }
      });

      _authSubscription = subscription;
    } catch {
      set({ initialized: true, error: 'Failed to initialize auth' });
    }
  },

  signUp: async (email, password, displayName) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      });
      if (error) throw error;
      set({ session: data.session, user: data.user, loading: false });
      if (data.session) await get().fetchProfile();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign up failed';
      set({ loading: false, error: message });
    }
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      set({ session: data.session, user: data.user, loading: false });
      await get().fetchProfile();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      set({ loading: false, error: message });
    }
  },

  forgotPassword: async (email) => {
    set({ error: null });
    try {
      // Linking.createURL produces:
      //   - pingweather://reset-password        in a standalone / dev build
      //   - exp://HOST:8081/--/reset-password   in Expo Go / dev client
      // Both must be whitelisted in Supabase Auth → URL Configuration → Redirect URLs.
      const redirectTo = Linking.createURL('/reset-password');
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) {
        // Real DB / network errors surface. "Email not found" is deliberately
        // returned as success by Supabase to avoid leaking which emails exist.
        set({ error: error.message || 'Password reset request failed' });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Password reset failed';
      set({ error: message });
    }
  },

  resetPassword: async (email) => {
    // Alias for forgotPassword
    await get().forgotPassword(email);
  },

  signOut: async () => {
    set({ loading: true });
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[authStore] signOut error:', err);
    } finally {
      set({ session: null, user: null, profile: null, loading: false });
    }
  },

  fetchProfile: async () => {
    const user = get().user;
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      set({ profile: data as Profile });

      // FIX 6: Seed unit preferences from the server profile on every
      // successful fetch. On a new install, AsyncStorage is empty and the
      // settingsStore defaults to fahrenheit/mph regardless of what the
      // user set previously. Seeding here ensures the stored preference
      // wins on first load without a circular import (settings → auth
      // would create a cycle; auth → settings is safe).
      if (data) {
        // Lazy-import to avoid module-level circular dependency.
        const { useSettingsStore } = await import('./settingsStore');
        const { setTemperatureUnit } = useSettingsStore.getState();
        if (data.temperature_unit) {
          setTemperatureUnit(data.temperature_unit as 'fahrenheit' | 'celsius');
        }
      }
    } catch (err) {
      // Re-throw so callers (initialize, onAuthStateChange callback) can
      // catch and set a user-visible error rather than silently swallowing.
      throw err;
    }
  },

  updateProfile: async (updates) => {
    const user = get().user;
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();
      if (error) throw error;
      set({ profile: data as Profile });
    } catch {
      set({ error: 'Failed to update profile' });
    }
  },

  clearError: () => set({ error: null }),
}));
