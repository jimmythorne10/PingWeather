import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEMES, type ThemeName, type ThemeTokens } from '../theme/tokens';

interface ThemeState {
  themeName: ThemeName;
  tokens: ThemeTokens;
  setTheme: (name: ThemeName) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themeName: 'classic',
      tokens: THEMES.classic,
      setTheme: (name) => set({ themeName: name, tokens: THEMES[name] }),
    }),
    {
      name: 'weatherwatch-theme',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ themeName: state.themeName }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.tokens = THEMES[state.themeName];
        }
      },
    }
  )
);
