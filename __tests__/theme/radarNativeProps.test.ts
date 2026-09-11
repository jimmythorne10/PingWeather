/**
 * FEAT-006 (automated half) — the radar screen's Mapbox-native props survive
 * the migration untouched.
 *
 * WHAT THIS PROVES: that app/radar.tsx still carries a Mapbox-shaped
 * RasterLayer style prop and an untouched styleURL constant, and that the
 * literal scanner is configured to skip them.
 *
 * WHAT THIS DOES NOT PROVE: that the map actually draws. Only the operator on
 * a physical device can confirm that — see the manifest notes for FEAT-006.
 * __tests__/screens/radar.test.tsx mocks @rnmapbox/maps entirely (lines 28-44)
 * and is deliberately NOT cited as evidence anywhere.
 *
 * Why this guard exists: two broken OTAs shipped on 2026-05-07 through exactly
 * this gap — a native component regression that jsdom could not see.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const RADAR = path.join(ROOT, 'app', 'radar.tsx');
const SCANNER = path.join(ROOT, '__tests__', 'theme', 'noHardcodedLiterals.test.ts');

const source = () => fs.readFileSync(RADAR, 'utf8');

describe('FEAT-006 guard: Mapbox native props are not React Native styles', () => {
  it('radar.tsx still exists at the path the manifest names', () => {
    expect(fs.existsSync(RADAR)).toBe(true);
  });

  it('keeps rasterOpacity on the RasterLayer style prop', () => {
    // Mapbox-native prop shape. If a migration rewrote this into an RN style
    // object, the layer silently stops rendering on device.
    expect(source()).toMatch(/rasterOpacity/);
  });

  it('never assigns a React Native style token to a Mapbox style prop', () => {
    // e.g. `style={styles.something}` on a MapboxGL.* element.
    const offending = source()
      .split(/\r?\n/)
      .map((line, i) => ({ line: line.trim(), n: i + 1 }))
      .filter(({ line }) => /MapboxGL\.\w+[^>]*style=\{styles\./.test(line));
    expect(offending).toEqual([]);
  });

  it('keeps the Mapbox tile styleURL as a Mapbox constant, not a theme token', () => {
    const src = source();
    expect(src).toMatch(/styleURL=\{MapboxGL\.StyleURL\./);
    expect(src).not.toMatch(/styleURL=\{(tokens|colors|t)\./);
  });

  it('keeps setAccessToken eager at module scope', () => {
    // Lazy-loading the module would move these side effects after first render.
    const src = source();
    const tokenLine = src.split(/\r?\n/).findIndex((l) => /setAccessToken/.test(l));
    const firstExport = src.split(/\r?\n/).findIndex((l) => /^export\s+default/.test(l));
    expect(tokenLine).toBeGreaterThan(-1);
    expect(firstExport).toBeGreaterThan(-1);
    expect(tokenLine).toBeLessThan(firstExport);
  });

  it('the literal scanner is configured to skip Mapbox-native props', () => {
    // If this exclusion is ever dropped, FEAT-002 would "fix" a native prop and
    // reintroduce the 2026-05-07 crash class.
    expect(fs.readFileSync(SCANNER, 'utf8')).toMatch(/rasterOpacity\|styleURL/);
  });
});
