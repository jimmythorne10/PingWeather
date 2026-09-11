/**
 * FEAT-002 — Zero hardcoded style literals outside the documented exceptions.
 *
 * Oracle: walking app/** and src/components/**, the collected match array has
 * length 0, down from the 901 measured on 2026-09-09.
 *
 * Failure mode this catches: a file still carrying an inline numeric style
 * value, meaning that screen does not respond to a look change and renders
 * Aurora proportions while the user has selected Classic.
 *
 * This test reads the real source tree. It cannot be satisfied by a mock.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');

/** Deliberately hardcoded — see spec "Out of scope". */
const EXCLUDED_FILES = [
  'app/_layout.tsx', // pins brand navy to match the native splash (lines 156, 192)
  'src/components/UpdateCheckScreen.tsx', // same splash-continuity rationale
];

const SCAN_DIRS = ['app', 'src/components'];

const STYLE_PROP = new RegExp(
  '\\b(fontSize|fontWeight|borderRadius|padding[A-Za-z]*|gap|lineHeight|letterSpacing)' +
    ':\\s*[\'"]?[0-9]',
  'g'
);

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

type Finding = { file: string; line: number; text: string };

function scan(): Finding[] {
  const findings: Finding[] = [];
  const files = SCAN_DIRS.flatMap((d) => walk(d)).filter(
    (f) => !EXCLUDED_FILES.includes(f)
  );

  for (const file of files) {
    const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      // Mapbox-native props are not React Native styles — see spec out-of-scope.
      if (file === 'app/radar.tsx' && /rasterOpacity|styleURL/.test(line)) return;
      STYLE_PROP.lastIndex = 0;
      if (STYLE_PROP.test(line)) {
        findings.push({ file, line: i + 1, text: line.trim().slice(0, 90) });
      }
    });
  }
  return findings;
}

describe('FEAT-002: no hardcoded style literals', () => {
  it('scans a non-trivial number of files, so a passing result means something', () => {
    // Guards against the scan silently matching nothing because the walk broke.
    const files = SCAN_DIRS.flatMap((d) => walk(d));
    expect(files.length).toBeGreaterThanOrEqual(30);
  });

  it('finds zero inline numeric style literals in app/ and src/components/', () => {
    const findings = scan();
    // Asserting on the located list rather than the count, so a failure names
    // the exact file and line instead of printing "expected 0, got 901".
    const located = findings.map((f) => `${f.file}:${f.line}  ${f.text}`);
    expect(located).toEqual([]);
  });
});
