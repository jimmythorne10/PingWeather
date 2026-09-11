/**
 * FEAT-003 — Each look offers only the palettes that belong to it.
 *
 * Oracle: palettesForLook('aurora') deep-equals ['blaze','timber'] and
 * palettesForLook('classic') deep-equals ['classic','dark','storm'].
 *
 * Failure mode this catches: a palette returned under the wrong look — blaze
 * offered under classic — which renders a near-black ground against 12px radii
 * and light-palette text colours.
 *
 * This entry exists because holding look and palette fully independent broke
 * the moment every Aurora candidate became dark. This test is what stops the
 * pairing being silently undone later.
 */
import { palettesForLook } from '../../src/theme/looks';
import { PALETTES } from '../../src/theme/palettes';
import { THEMES } from '../../src/theme/tokens';

describe('FEAT-003: palettes are scoped to their look', () => {
  it('aurora offers exactly blaze and timber', () => {
    expect([...palettesForLook('aurora')].sort()).toEqual(['blaze', 'timber']);
  });

  it('classic offers exactly the three palettes shipping today', () => {
    expect([...palettesForLook('classic')].sort()).toEqual(['classic', 'dark', 'storm']);
  });

  it('never offers an aurora palette under classic', () => {
    const classicSet = palettesForLook('classic');
    expect(classicSet).not.toContain('blaze');
    expect(classicSet).not.toContain('timber');
  });

  it('every offered palette actually exists in PALETTES', () => {
    const offered = [...palettesForLook('aurora'), ...palettesForLook('classic')];
    const missing = offered.filter((name) => !(name in PALETTES));
    expect(missing).toEqual([]);
  });

  it('carries the three legacy palettes forward byte-for-byte from tokens.ts', () => {
    // The spec puts editing these out of scope: they are carried, never changed.
    for (const name of ['classic', 'dark', 'storm'] as const) {
      expect(PALETTES[name]).toEqual(THEMES[name]);
    }
  });
});
