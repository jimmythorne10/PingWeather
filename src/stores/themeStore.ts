import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  LOOKS,
  defaultPaletteForLook,
  lookOwningPalette,
  palettesForLook,
  type LookName,
  type LookTokens,
} from '../theme/looks';
import { PALETTES, isPaletteName, type PaletteName, type PaletteTokens } from '../theme/palettes';
import type { ThemeName } from '../theme/tokens';

// ────────────────────────────────────────────────────────────
// Two axes, not one.
//   look    → structure (type scale, spacing, radius, surface, motion)
//   palette → colour
// A palette belongs to a look; see palettesForLook. Selecting Classic
// restores BOTH, which is what a user means by "revert".
//
// NOTE ON NAMING: `tokens` is STRUCTURE and `colors` is COLOUR. Before this
// change `tokens` meant colour, so `useTokens()` is kept below as a colour
// alias — 26 files still call it, and swapping its meaning underneath them
// would repaint every screen with structural numbers.
// ────────────────────────────────────────────────────────────

interface ThemeState {
  look: LookName;
  palette: PaletteName;
  tokens: LookTokens;
  colors: PaletteTokens;
  /** @deprecated mirrors `palette`; retained so existing callers compile. */
  themeName: ThemeName;
  setLook: (name: LookName) => void;
  setPalette: (name: PaletteName) => void;
  /** @deprecated use setPalette. */
  setTheme: (name: ThemeName) => void;
}

const DEFAULT_LOOK: LookName = 'aurora';
const DEFAULT_PALETTE: PaletteName = 'timber';

/** Keeps palette inside the chosen look's family — see FEAT-003. */
function reconcile(look: LookName, palette: PaletteName): PaletteName {
  return palettesForLook(look).includes(palette)
    ? palette
    : (defaultPaletteForLook(look) as PaletteName);
}

function resolve(look: LookName, palette: PaletteName) {
  const settled = reconcile(look, palette);
  return {
    look,
    palette: settled,
    themeName: settled as ThemeName,
    tokens: LOOKS[look],
    colors: PALETTES[settled],
  };
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      ...resolve(DEFAULT_LOOK, DEFAULT_PALETTE),

      setLook: (name) => set(resolve(name, get().palette)),

      // Naming a palette implies naming its look. Without this, asking for
      // `dark` while on Aurora would reconcile silently back to `timber`:
      // the caller names one palette and gets another, with no error.
      setPalette: (name) => set(resolve(lookOwningPalette(name) ?? get().look, name)),

      setTheme: (name) =>
        set(resolve(lookOwningPalette(name) ?? get().look, name as PaletteName)),
    }),
    {
      name: 'pingweather-theme',
      storage: createJSONStorage(() => AsyncStorage),

      // Only the two NAMES are persisted. Storing the resolved objects would
      // freeze a copy of the design system into every user's device, so a
      // later token change would never reach anyone who had already launched.
      partialize: (state) => ({ look: state.look, palette: state.palette }),

      onRehydrateStorage: () => (state) => {
        if (!state) return;

        const raw = state as unknown as Record<string, unknown>;

        // Legacy migration. Installs before this change persisted only
        // { themeName }. Those users are mid-flight on the old design, so they
        // land on look `classic` with their existing colour choice intact —
        // the spec's rollout decision that nobody wakes up to a dark app they
        // did not ask for.
        if (raw.look === undefined) {
          const legacy = typeof raw.themeName === 'string' ? raw.themeName : 'classic';
          raw.look = 'classic';
          raw.palette = isPaletteName(legacy) ? legacy : 'classic';
        }

        const look: LookName = raw.look === 'aurora' ? 'aurora' : 'classic';
        const palette =
          typeof raw.palette === 'string' && isPaletteName(raw.palette)
            ? raw.palette
            : (defaultPaletteForLook(look) as PaletteName);

        // Re-resolve BOTH. Restoring the names without rebuilding the objects
        // is the defect FEAT-005 exists to catch.
        Object.assign(state, resolve(look, palette));
      },
    }
  )
);
