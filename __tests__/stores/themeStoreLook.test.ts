/**
 * FEAT-004 — Revert to Classic restores proportions and colours together.
 *
 * Oracle: from { look:'aurora', palette:'timber' }, setLook('classic') leaves
 * tokens deep-equal to LOOKS.classic AND colors deep-equal to PALETTES.classic,
 * whose values match src/theme/tokens.ts THEMES.classic byte-for-byte.
 *
 * Failure mode this catches: a PARTIAL revert — structure reverts but colours
 * stay dark, or colours revert but radii stay at 18 — leaving the user in a
 * state neither look defines.
 */
import { useThemeStore } from '../../src/stores/themeStore';
import { LOOKS } from '../../src/theme/looks';
import { PALETTES } from '../../src/theme/palettes';
import { THEMES } from '../../src/theme/tokens';

describe('FEAT-004: revert to Classic', () => {
  beforeEach(() => {
    useThemeStore.setState({
      look: 'aurora',
      palette: 'timber',
      tokens: LOOKS.aurora,
      colors: PALETTES.timber,
    } as never);
  });

  it('restores the classic structural tokens', () => {
    useThemeStore.getState().setLook('classic');
    expect(useThemeStore.getState().tokens).toEqual(LOOKS.classic);
  });

  it('restores the classic palette alongside the structure', () => {
    useThemeStore.getState().setLook('classic');
    expect(useThemeStore.getState().palette).toBe('classic');
    expect(useThemeStore.getState().colors).toEqual(PALETTES.classic);
  });

  it('restores the exact colour values shipping today', () => {
    useThemeStore.getState().setLook('classic');
    const colors = useThemeStore.getState().colors as typeof THEMES.classic;
    expect(colors.background).toBe('#F0F4F8');
    expect(colors.primary).toBe('#1E3A5F');
    expect(colors.textPrimary).toBe('#1A202C');
    expect(colors.freezeBlue).toBe('#63B3ED');
  });

  it('does not leave a half-reverted state', () => {
    useThemeStore.getState().setLook('classic');
    const { tokens, colors } = useThemeStore.getState();
    // Both halves, asserted together: passing one while failing the other is
    // precisely the defect this criterion exists to prevent.
    expect({ tokens, colors }).toEqual({
      tokens: LOOKS.classic,
      colors: PALETTES.classic,
    });
  });

  it('switching back to aurora selects an aurora-scoped palette', () => {
    useThemeStore.getState().setLook('classic');
    useThemeStore.getState().setLook('aurora');
    expect(useThemeStore.getState().tokens).toEqual(LOOKS.aurora);
    expect(['blaze', 'timber']).toContain(useThemeStore.getState().palette);
  });
});
