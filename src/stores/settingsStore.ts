import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TemperatureUnit, WindSpeedUnit, PressureUnit } from '../types';

// FIX 5: themeName has been removed from settingsStore. It was a duplicate of
// themeStore.themeName — two stores persisting the same value independently
// caused them to drift whenever one was updated without the other.
// The single source of truth is useThemeStore. All theme changes go through
// useThemeStore.getState().setTheme() or the useThemeStore hook directly.

interface SettingsState {
  temperatureUnit: TemperatureUnit;
  windSpeedUnit: WindSpeedUnit;
  pressureUnit: PressureUnit;
  notificationsEnabled: boolean;

  setTemperatureUnit: (unit: TemperatureUnit) => void;
  setWindSpeedUnit: (unit: WindSpeedUnit) => void;
  setPressureUnit: (unit: PressureUnit) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      temperatureUnit: 'fahrenheit',
      windSpeedUnit: 'mph',
      pressureUnit: 'hPa',
      notificationsEnabled: true,

      setTemperatureUnit: (unit) => set({ temperatureUnit: unit }),
      setWindSpeedUnit: (unit) => set({ windSpeedUnit: unit }),
      setPressureUnit: (unit) => set({ pressureUnit: unit }),
      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
    }),
    {
      name: 'weatherwatch-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
