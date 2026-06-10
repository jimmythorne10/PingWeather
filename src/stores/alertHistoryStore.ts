import { create } from 'zustand';
import { supabase } from '../utils/supabase';
import { useAuthStore } from './authStore';
import { TIER_LIMITS } from '../types';
import type { AlertHistoryEntry } from '../types';

interface AlertHistoryState {
  entries: AlertHistoryEntry[];
  loading: boolean;
  error: string | null;

  loadHistory: () => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useAlertHistoryStore = create<AlertHistoryState>()((set) => ({
  entries: [],
  loading: false,
  error: null,

  loadHistory: async () => {
    set({ loading: true, error: null });
    try {
      const tier = useAuthStore.getState().profile?.subscription_tier ?? 'free';
      const { alertHistoryDays } = TIER_LIMITS[tier];
      const cutoff = new Date(Date.now() - alertHistoryDays * 86400000).toISOString();

      // Premium gets a large limit so old entries aren't silently dropped.
      // Free/pro are capped at their tier window, which is well under 100 rows in practice.
      const rowLimit = tier === 'premium' ? 10000 : 100;

      const { data, error } = await supabase
        .from('alert_history')
        .select('*')
        .gte('triggered_at', cutoff)
        .order('triggered_at', { ascending: false })
        .limit(rowLimit);
      if (error) throw error;
      set({ entries: data as AlertHistoryEntry[], loading: false });
    } catch {
      set({ loading: false, error: 'Failed to load alert history' });
    }
  },

  deleteEntry: async (id: string) => {
    try {
      const { error } = await supabase.from('alert_history').delete().eq('id', id);
      if (error) throw error;
      set((state) => ({ entries: state.entries.filter((e) => e.id !== id) }));
    } catch {
      set({ error: 'Failed to delete alert history entry' });
    }
  },

  clearError: () => set({ error: null }),
}));
