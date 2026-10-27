/**
 * Guard: any file that uses `Platform.` must import it from 'react-native'.
 *
 * `Platform` is not a global in React Native. A file that references it
 * without importing throws ReferenceError at render — not at build, not at
 * lint, and not in any test that mocks the screen away.
 *
 * Found live in app/(tabs)/settings.tsx lines 132 and 404, introduced by
 * commit 5f8c164 ("OS-agnostic notification messaging"). Line 404 sits in an
 * UNCONDITIONAL block, so the Settings screen throws on every open.
 *
 * This scans source rather than rendering, so it catches the whole class in
 * the pure-logic tier instead of relying on the jsdom suite this project
 * explicitly does not accept as verification.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const SCAN_DIRS = ['app', 'src'];

function walk(dir: string, acc: string[] = []): string[] {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return acc;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) walk(rel, acc);
    else if (/\.tsx?$/.test(entry.name)) acc.push(rel);
  }
  return acc;
}

describe('Platform must be imported where it is used', () => {
  it('scans a non-trivial number of files', () => {
    expect(SCAN_DIRS.flatMap((d) => walk(d)).length).toBeGreaterThanOrEqual(30);
  });

  it('finds no file referencing Platform without importing it', () => {
    const offenders: string[] = [];

    for (const file of SCAN_DIRS.flatMap((d) => walk(d))) {
      const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
      const uses = /\bPlatform\s*\.\s*(select|OS|Version)\b/.test(src);
      if (!uses) continue;

      const imported =
        /import\s*\{[^}]*\bPlatform\b[^}]*\}\s*from\s*['"]react-native['"]/s.test(src) ||
        /\bPlatform\b[^=]*=\s*require\(['"]react-native['"]\)/.test(src);

      if (!imported) offenders.push(file);
    }

    expect(offenders).toEqual([]);
  });
});
