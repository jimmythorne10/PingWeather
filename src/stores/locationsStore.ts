import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';
import { useAuthStore } from './authStore';
import type { WatchLocation } from '../types';

interface LocationsState {
  locations: WatchLocation[];
  loading: boolean;
  error: string | null;

  loadLocations: () => Promise<void>;
  addLocation: (name: string, latitude: number, longitude: number) => Promise<void>;
  removeLocation: (id: string) => Promise<void>;
  toggleLocation: (id: string, isActive: boolean) => Promise<void>;
  clearError: () => void;
}

export const useLocationsStore = create<LocationsState>()(
  persist(
    (set, get) => ({
      locations: [],
      loading: false,
      error: null,

      loadLocations: async () => {
        set({ loading: true, error: null });
        try {
          const { data, error } = await supabase
            .from('locations')
            .select('*')
            .order('created_at', { ascending: false });
          if (error) throw error;
          set({ locations: data as WatchLocation[], loading: false });
        } catch {
          set({ loading: false, error: 'Failed to load locations' });
        }
      },

      addLocation: async (name, latitude, longitude) => {
        set({ loading: true, error: null });
        try {
          const userId = useAuthStore.getState().user?.id;
          if (!userId) throw new Error('Not authenticated');
          const { data, error } = await supabase
            .from('locations')
            .insert({ user_id: userId, name, latitude, longitude, is_active: true })
            .select()
            .single();
          if (error) throw error;
          set({ locations: [data as WatchLocation, ...get().locations], loading: false });
        } catch {
          set({ loading: false, error: 'Failed to add location' });
        }
      },

      removeLocation: async (id) => {
        try {
          const { error } = await supabase.from('locations').delete().eq('id', id);
          if (error) throw error;
          set({ locations: get().locations.filter((l) => l.id !== id) });
        } catch {
          set({ error: 'Failed to remove location' });
        }
      },

      toggleLocation: async (id, isActive) => {
        try {
          const { error } = await supabase
            .from('locations')
            .update({ is_active: isActive })
            .eq('id', id);
          if (error) throw error;
          set({
            locations: get().locations.map((l) =>
              l.id === id ? { ...l, is_active: isActive } : l
            ),
          });
        } catch {
          set({ error: 'Failed to update location' });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'weatherwatch-locations',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ locations: state.locations }),
    }
  )
);
