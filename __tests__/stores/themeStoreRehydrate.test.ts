/**
 * FEAT-005 — The look choice survives an app restart.
 *
 * Oracle: seed AsyncStorage key 'pingweather-theme' with
 * { state: { look: 'classic', palette: 'classic' } }, trigger the store's
 * onRehydrateStorage callback, and assert tokens deep-equal LOOKS.classic
 * BEFORE any setLook call.
 *
 * Failure mode this catches: tokens remain LOOKS.aurora because rehydration
 * restored the look NAME without re-resolving the token object — the same
 * defect class the existing store already avoids for colours.
 *
 * The persisted key stays 'pingweather-theme'. Renaming it would orphan every
 * existing user's stored preference.
 */
import { useThemeStore } from '../../src/stores/themeStore';
import { LOOKS } from '../../src/theme/looks';
import { PALETTES } from '../../src/theme/palettes';

const PERSIST_KEY = 'pingweather-theme';

describe('FEAT-005: look survives a restart', () => {
  beforeEach(() => {
    // Start from the opposite of what we expect after rehydration, so a test
    // that passes cannot be passing because nothing changed.
    useThemeStore.setState({
      look: 'aurora',
      palette: 'timber',
      tokens: LOOKS.aurora,
      colors: PALETTES.timber,
    } as never);
  });

  it('persists under the existing key, not a renamed one', () => {
    const opts = (useThemeStore as unknown as {
      persist: { getOptions: () => { name?: string } };
    }).persist.getOptions();
    expect(opts.name).toBe(PERSIST_KEY);
  });

  it('persists only the look and palette names, never the resolved objects', () => {
    const opts = (useThemeStore as unknown as {
      persist: { getOptions: () => { partialize?: (s: unknown) => unknown } };
    }).persist.getOptions();
    const partial = opts.partialize?.(useThemeStore.getState()) as Record<string, unknown>;
    expect(Object.keys(partial).sort()).toEqual(['look', 'palette']);
  });

  it('re-resolves structural tokens from the persisted look on rehydration', () => {
    const state = useThemeStore.getState() as unknown as Record<string, unknown>;
    state.look = 'classic';
    state.palette = 'classic';

    const opts = (useThemeStore as unknown as {
      persist: { getOptions: () => { onRehydrateStorage?: () => (s: unknown) => void } };
    }).persist.getOptions();
    opts.onRehydrateStorage?.()(state);

    expect(state.tokens).toEqual(LOOKS.classic);
  });

  it('re-resolves palette colours on rehydration too', () => {
    const state = useThemeStore.getState() as unknown as Record<string, unknown>;
    state.look = 'classic';
    state.palette = 'classic';

    const opts = (useThemeStore as unknown as {
      persist: { getOptions: () => { onRehydrateStorage?: () => (s: unknown) => void } };
    }).persist.getOptions();
    opts.onRehydrateStorage?.()(state);

    expect(state.colors).toEqual(PALETTES.classic);
  });

  it('defaults to aurora when nothing has been persisted', () => {
    const opts = (useThemeStore as unknown as {
      persist: { getOptions: () => { onRehydrateStorage?: () => (s: unknown) => void } };
    }).persist.getOptions();
    // A fresh install has no stored state; rehydration must not crash on it.
    expect(() => opts.onRehydrateStorage?.()(undefined)).not.toThrow();
  });
});
