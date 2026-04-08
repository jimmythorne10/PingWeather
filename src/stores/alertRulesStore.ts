import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';
import { useAuthStore } from './authStore';
import type { AlertRule, AlertCondition, LogicalOperator } from '../types';

interface AlertRulesState {
  rules: AlertRule[];
  loading: boolean;
  error: string | null;

  loadRules: () => Promise<void>;
  createRule: (rule: {
    location_id: string;
    name: string;
    conditions: AlertCondition[];
    logical_operator: LogicalOperator;
    lookahead_hours: number;
    polling_interval_hours: number;
    cooldown_hours: number;
  }) => Promise<void>;
  updateRule: (id: string, updates: Partial<AlertRule>) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  toggleRule: (id: string, isActive: boolean) => Promise<void>;
  clearError: () => void;
}

export const useAlertRulesStore = create<AlertRulesState>()(
  persist(
    (set, get) => ({
      rules: [],
      loading: false,
      error: null,

      loadRules: async () => {
        set({ loading: true, error: null });
        try {
          const { data, error } = await supabase
            .from('alert_rules')
            .select('*')
            .order('created_at', { ascending: false });
          if (error) throw error;
          set({ rules: data as AlertRule[], loading: false });
        } catch {
          set({ loading: false, error: 'Failed to load alert rules' });
        }
      },

      createRule: async (rule) => {
        set({ loading: true, error: null });
        try {
          const userId = useAuthStore.getState().user?.id;
          if (!userId) throw new Error('Not authenticated');
          const { data, error } = await supabase
            .from('alert_rules')
            .insert({ ...rule, user_id: userId, is_active: true })
            .select()
            .single();
          if (error) throw error;
          set({ rules: [data as AlertRule, ...get().rules], loading: false });
        } catch {
          set({ loading: false, error: 'Failed to create alert rule' });
        }
      },

      updateRule: async (id, updates) => {
        try {
          const { data, error } = await supabase
            .from('alert_rules')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
          if (error) throw error;
          set({
            rules: get().rules.map((r) => (r.id === id ? (data as AlertRule) : r)),
          });
        } catch {
          set({ error: 'Failed to update alert rule' });
        }
      },

      deleteRule: async (id) => {
        try {
          const { error } = await supabase.from('alert_rules').delete().eq('id', id);
          if (error) throw error;
          set({ rules: get().rules.filter((r) => r.id !== id) });
        } catch {
          set({ error: 'Failed to delete alert rule' });
        }
      },

      toggleRule: async (id, isActive) => {
        try {
          const { error } = await supabase
            .from('alert_rules')
            .update({ is_active: isActive })
            .eq('id', id);
          if (error) throw error;
          set({
            rules: get().rules.map((r) =>
              r.id === id ? { ...r, is_active: isActive } : r
            ),
          });
        } catch {
          set({ error: 'Failed to toggle alert rule' });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'weatherwatch-alert-rules',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ rules: state.rules }),
    }
  )
);
