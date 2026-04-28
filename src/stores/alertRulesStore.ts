import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';
import { useAuthStore } from './authStore';
import { TIER_LIMITS } from '../types';
import type { AlertRule, AlertCondition, LogicalOperator, SubscriptionTier } from '../types';

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
  enforceTierLimits: (tier: SubscriptionTier) => Promise<void>;
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
        } catch (err) {
          // FIX 4: Surface the real error message, not a generic fallback.
          const message = err instanceof Error ? err.message : 'Failed to load alert rules';
          set({ loading: false, error: message });
        }
      },

      createRule: async (rule) => {
        set({ loading: true, error: null });
        try {
          const userId = useAuthStore.getState().user?.id;
          if (!userId) throw new Error('Not authenticated');

          const tier = useAuthStore.getState().profile?.subscription_tier ?? 'free';
          const limits = TIER_LIMITS[tier];

          // Tier limit enforcement
          const current = get().rules.length;
          if (current >= limits.maxAlertRules) {
            set({ loading: false, error: `Alert rule limit reached for your plan (${limits.maxAlertRules} max)` });
            return;
          }

          // Compound condition gating
          if (!limits.compoundConditions && rule.conditions.length > 1) {
            set({ loading: false, error: 'Compound conditions require a Pro or Premium subscription' });
            return;
          }

          const { data, error } = await supabase
            .from('alert_rules')
            .insert({ ...rule, user_id: userId, is_active: true })
            .select()
            .single();
          if (error) throw error;
          set({ rules: [data as AlertRule, ...get().rules], loading: false });
        } catch (err) {
          // FIX 4: Real error message instead of hardcoded string.
          const message = err instanceof Error ? err.message : 'Failed to create alert rule';
          set({ loading: false, error: message });
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
        } catch (err) {
          // FIX 4: Real error message instead of hardcoded string.
          const message = err instanceof Error ? err.message : 'Failed to update alert rule';
          set({ error: message });
        }
      },

      deleteRule: async (id) => {
        try {
          const { error } = await supabase.from('alert_rules').delete().eq('id', id);
          if (error) throw error;
          set({ rules: get().rules.filter((r) => r.id !== id) });
        } catch (err) {
          // FIX 4: Real error message instead of hardcoded string.
          const message = err instanceof Error ? err.message : 'Failed to delete alert rule';
          set({ error: message });
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
        } catch (err) {
          // FIX 4: Real error message instead of hardcoded string.
          const message = err instanceof Error ? err.message : 'Failed to toggle alert rule';
          set({ error: message });
        }
      },

      enforceTierLimits: async (tier) => {
        const limit = TIER_LIMITS[tier].maxAlertRules;
        const rules = get().rules;

        const active = rules.filter((r) => r.is_active);
        const inactive = rules.filter((r) => !r.is_active);

        if (active.length <= limit) {
          // Under limit — re-enable inactive rules up to the limit
          const canActivate = limit - active.length;
          const toActivate = inactive.slice(0, canActivate);
          if (toActivate.length === 0) return;

          const activateIds = new Set(toActivate.map((r) => r.id));

          // FIX 3: Persist activation to Supabase so the next loadRules()
          // doesn't overwrite local state with stale server data.
          const { error } = await supabase
            .from('alert_rules')
            .update({ is_active: true })
            .in('id', [...activateIds]);
          if (error) {
            console.error('[alertRulesStore] enforceTierLimits activate error:', error);
          }

          set({
            rules: rules.map((r) =>
              activateIds.has(r.id) ? { ...r, is_active: true } : r
            ),
          });
        } else {
          // Over limit — deactivate excess (keep first `limit` active ones)
          const toKeep = new Set(active.slice(0, limit).map((r) => r.id));
          const toDeactivateIds = active
            .filter((r) => !toKeep.has(r.id))
            .map((r) => r.id);

          // FIX 3: Batch-deactivate on the server so enforcement survives reload.
          if (toDeactivateIds.length > 0) {
            const { error } = await supabase
              .from('alert_rules')
              .update({ is_active: false })
              .in('id', toDeactivateIds);
            if (error) {
              console.error('[alertRulesStore] enforceTierLimits deactivate error:', error);
            }
          }

          set({
            rules: rules.map((r) =>
              toKeep.has(r.id) ? r : { ...r, is_active: false }
            ),
          });
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
