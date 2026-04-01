import { create } from 'zustand';
import { supabase } from '../utils/supabase';
import type { AlertHistoryEntry } from '../types';

interface AlertHistoryState {
  entries: AlertHistoryEntry[];
  loading: boolean;
  error: string | null;

  loadHistory: () => Promise<void>;
  clearError: () => void;
}

export const useAlertHistoryStore = create<AlertHistoryState>()((set) => ({
  entries: [],
  loading: false,
  error: null,

  loadHistory: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('alert_history')
        .select('*')
        .order('triggered_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      set({ entries: data as AlertHistoryEntry[], loading: false });
    } catch {
      set({ loading: false, error: 'Failed to load alert history' });
    }
  },

  clearError: () => set({ error: null }),
}));
