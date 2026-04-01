import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TemperatureUnit, WindSpeedUnit } from '../types';
import type { ThemeName } from '../theme/tokens';

interface SettingsState {
  temperatureUnit: TemperatureUnit;
  windSpeedUnit: WindSpeedUnit;
  themeName: ThemeName;
  notificationsEnabled: boolean;

  setTemperatureUnit: (unit: TemperatureUnit) => void;
  setWindSpeedUnit: (unit: WindSpeedUnit) => void;
  setThemeName: (name: ThemeName) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      temperatureUnit: 'fahrenheit',
      windSpeedUnit: 'mph',
      themeName: 'classic',
      notificationsEnabled: true,

      setTemperatureUnit: (unit) => set({ temperatureUnit: unit }),
      setWindSpeedUnit: (unit) => set({ windSpeedUnit: unit }),
      setThemeName: (name) => set({ themeName: name }),
      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
    }),
    {
      name: 'weatherwatch-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
