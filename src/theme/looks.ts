// ────────────────────────────────────────────────────────────
// WeatherBeacon — LOOK tokens (structure).
//
// A "look" owns everything that is NOT colour: type scale, spacing grid,
// radius, surface treatment and motion. Colour lives in ./palettes.ts.
//
// Two looks, and each owns its own palette family (see palettesForLook).
// Holding the two axes fully independent broke the moment the new look went
// dark: a dark structure on the light `classic` palette is incoherent. So a
// palette is only ever offered under the look it was designed against.
// ────────────────────────────────────────────────────────────

export type LookName = 'aurora' | 'classic';

export interface TypeStep {
  /** px */
  size: number;
  /** React Native fontWeight string */
  weight: '200' | '300' | '400' | '500' | '600' | '700' | '800';
  /** px, negative tightens */
  tracking: number;
  /** px. Leading. Never below `size`. */
  lineHeight: number;
}

export interface LookTokens {
  typography: {
    display: TypeStep;
    title: TypeStep;
    heading: TypeStep;
    body: TypeStep;
    bodyStrong: TypeStep;
    caption: TypeStep;
    label: TypeStep;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
    xxxl: number;
  };
  radius: {
    /** cards, tiles, rows, hero */
    surface: number;
    /** the floating tab bar */
    nav: number;
  };
  surface: {
    /** expo-blur intensity. 0 means an opaque surface, no BlurView. */
    blur: number;
  };
  motion: {
    /** ms */
    fast: number;
    base: number;
    slow: number;
    easing: string;
  };
}

/**
 * The 21 structural keys every look must supply, in dotted form.
 * FEAT-001 asserts each look's flattened key set deep-equals this exactly —
 * a missing key crashes whichever screen reads it at render time, and an
 * extra undeclared key means one look has drifted from the contract.
 */
export const REQUIRED_STRUCTURAL_KEYS: readonly string[] = [
  'typography.display',
  'typography.title',
  'typography.heading',
  'typography.body',
  'typography.bodyStrong',
  'typography.caption',
  'typography.label',
  'spacing.xs',
  'spacing.sm',
  'spacing.md',
  'spacing.lg',
  'spacing.xl',
  'spacing.xxl',
  'spacing.xxxl',
  'radius.surface',
  'radius.nav',
  'surface.blur',
  'motion.fast',
  'motion.base',
  'motion.slow',
  'motion.easing',
];

const EASING_STANDARD = 'cubic-bezier(0.2, 0, 0, 1)';

export const LOOKS: Record<LookName, LookTokens> = {
  // Aurora — the new look. Frosted surfaces, generous radius, a real type
  // scale collapsing the 21 shipped font sizes down to 7 steps.
  aurora: {
    typography: {
      display: { size: 66, weight: '600', tracking: -2.6, lineHeight: 68 },
      title: { size: 40, weight: '700', tracking: -1.4, lineHeight: 44 },
      heading: { size: 19, weight: '600', tracking: -0.3, lineHeight: 24 },
      body: { size: 15, weight: '400', tracking: 0, lineHeight: 22 },
      bodyStrong: { size: 15, weight: '600', tracking: 0, lineHeight: 22 },
      caption: { size: 13, weight: '500', tracking: 0, lineHeight: 18 },
      label: { size: 10.5, weight: '700', tracking: 1.6, lineHeight: 14 },
    },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
    radius: { surface: 18, nav: 26 },
    surface: { blur: 18 },
    motion: { fast: 120, base: 180, slow: 280, easing: EASING_STANDARD },
  },

  // Classic — the app exactly as it ships today. These are not invented
  // values: they are the literals measured in the live screens on 2026-09-11
  // (display 48/700, radius 12, flat cards, no motion). FEAT-004 asserts a
  // revert lands back on this object, so changing a number here changes what
  // "Revert to Classic" restores.
  classic: {
    typography: {
      display: { size: 48, weight: '700', tracking: 0, lineHeight: 52 },
      title: { size: 28, weight: '700', tracking: 0, lineHeight: 34 },
      heading: { size: 16, weight: '600', tracking: 0, lineHeight: 22 },
      body: { size: 14, weight: '400', tracking: 0, lineHeight: 20 },
      bodyStrong: { size: 14, weight: '600', tracking: 0, lineHeight: 20 },
      caption: { size: 13, weight: '600', tracking: 0, lineHeight: 18 },
      label: { size: 12, weight: '600', tracking: 0.5, lineHeight: 16 },
    },
    spacing: { xs: 4, sm: 8, md: 10, lg: 16, xl: 20, xxl: 24, xxxl: 40 },
    radius: { surface: 12, nav: 0 },
    surface: { blur: 0 },
    // Today's app animates nothing. Zero durations preserve that exactly
    // rather than quietly introducing motion into the "unchanged" look.
    motion: { fast: 0, base: 0, slow: 0, easing: 'linear' },
  },
};

/**
 * Palettes are scoped to their look — see FEAT-003.
 * Returning a fresh array each call so a caller cannot mutate the table.
 */
export function palettesForLook(look: LookName): string[] {
  switch (look) {
    case 'aurora':
      return ['blaze', 'timber'];
    case 'classic':
      return ['classic', 'dark', 'storm'];
    default: {
      // Exhaustiveness guard: a new look added without a palette family is a
      // compile error here rather than an empty Settings list at runtime.
      const never: never = look;
      throw new Error(`palettesForLook: unknown look ${String(never)}`);
    }
  }
}

/** The palette a look falls back to when the current one is out of family. */
export function defaultPaletteForLook(look: LookName): string {
  return look === 'aurora' ? 'timber' : 'classic';
}

/**
 * The look that owns a given palette, or null if no look does.
 *
 * Needed because asking for a palette implies asking for its look. Without
 * this, `setTheme('dark')` from the Aurora default would reconcile straight
 * back to `timber` — the caller names a palette, gets a different one, and
 * nothing errors. Selecting a colour scheme must be able to carry its
 * structure along with it.
 */
export function lookOwningPalette(palette: string): LookName | null {
  const looks: LookName[] = ['aurora', 'classic'];
  return looks.find((look) => palettesForLook(look).includes(palette)) ?? null;
}
