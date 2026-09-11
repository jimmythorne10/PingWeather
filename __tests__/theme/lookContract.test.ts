/**
 * FEAT-001 — Structural token contract complete for every look.
 *
 * Oracle: for each of the 2 looks, the flattened key set deep-equals
 * REQUIRED_STRUCTURAL_KEYS (length 21) and every resolved value is non-null.
 *
 * Failure mode this catches: a look missing a key, carrying an extra undeclared
 * key, or resolving one to null/undefined — each of which crashes whichever
 * screen reads that token at render time.
 *
 * Imports the real module. No mock of the code under test.
 */
import { LOOKS, REQUIRED_STRUCTURAL_KEYS } from '../../src/theme/looks';

const flattenKeys = (look: Record<string, unknown>): string[] => {
  const out: string[] = [];
  for (const [group, value] of Object.entries(look)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const leaf of Object.keys(value as Record<string, unknown>)) {
        out.push(`${group}.${leaf}`);
      }
    } else {
      out.push(group);
    }
  }
  return out.sort();
};

const resolveAll = (look: Record<string, unknown>): Array<[string, unknown]> => {
  const out: Array<[string, unknown]> = [];
  for (const [group, value] of Object.entries(look)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [leaf, v] of Object.entries(value as Record<string, unknown>)) {
        out.push([`${group}.${leaf}`, v]);
      }
    } else {
      out.push([group, value]);
    }
  }
  return out;
};

describe('FEAT-001: structural token contract', () => {
  it('declares exactly 21 required structural keys', () => {
    expect(REQUIRED_STRUCTURAL_KEYS).toHaveLength(21);
  });

  it('defines exactly the two looks the spec names', () => {
    expect(Object.keys(LOOKS).sort()).toEqual(['aurora', 'classic']);
  });

  it.each(['aurora', 'classic'])('look "%s" exposes the complete key set', (name) => {
    const look = LOOKS[name as keyof typeof LOOKS] as unknown as Record<string, unknown>;
    expect(flattenKeys(look)).toEqual([...REQUIRED_STRUCTURAL_KEYS].sort());
  });

  it.each(['aurora', 'classic'])('look "%s" resolves every key to a non-null value', (name) => {
    const look = LOOKS[name as keyof typeof LOOKS] as unknown as Record<string, unknown>;
    const empty = resolveAll(look).filter(([, v]) => v === null || v === undefined);
    expect(empty).toEqual([]);
  });

  // A type step without leading is not a type scale. Every screen that sets
  // fontSize also sets lineHeight (38 uses measured 2026-09-09), so a contract
  // that cannot express leading forces those back to literals and FEAT-002 can
  // never reach zero. Found by the TASK-005 migration hitting 6 it could not
  // express, and reporting rather than inventing `size * 1.4`.
  //
  // This does NOT change the 21-key contract: flattenKeys walks one level, so
  // `typography.display` is a single key however many fields the step carries.
  it.each(['aurora', 'classic'])('every type step in "%s" carries size, weight, tracking and lineHeight', (name) => {
    const look = LOOKS[name as keyof typeof LOOKS];
    const incomplete = Object.entries(look.typography)
      .filter(([, step]) => {
        // Through `unknown` — TypeStep has no index signature, so a direct
        // cast to Record<string, unknown> is a TS2352 error.
        const s = step as unknown as Record<string, unknown>;
        return (
          typeof s.size !== 'number' ||
          typeof s.weight !== 'string' ||
          typeof s.tracking !== 'number' ||
          typeof s.lineHeight !== 'number'
        );
      })
      .map(([stepName]) => `typography.${stepName}`);
    expect(incomplete).toEqual([]);
  });

  it.each(['aurora', 'classic'])('leading in "%s" is never tighter than its own font size', (name) => {
    const look = LOOKS[name as keyof typeof LOOKS];
    const tooTight = Object.entries(look.typography)
      .filter(([, step]) => {
        const s = step as unknown as { size: number; lineHeight: number };
        return s.lineHeight < s.size;
      })
      .map(([stepName]) => stepName);
    expect(tooTight).toEqual([]);
  });

  it('gives the two looks genuinely different structure, not a copy', () => {
    // A look set where classic === aurora would satisfy every check above while
    // making "Revert to Classic" a no-op.
    expect(LOOKS.classic).not.toEqual(LOOKS.aurora);
  });
});
