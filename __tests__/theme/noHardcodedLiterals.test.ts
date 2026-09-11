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

/**
 * The exact set this scan is responsible for, as of 2026-09-11.
 *
 * Asserting the inventory rather than a count catches two things a
 * `length >= 30` check cannot: a walk that silently stops descending into a
 * subdirectory, and a NEW screen added later that nobody decided about. Adding
 * a screen must be a deliberate act — append it here, or explain why it is
 * exempt.
 *
 * Twenty-eight of these files are already named by some other test. Five are
 * not, and this scan is the ONLY automated check that touches them. tdd-guard
 * supports an explicit annotation for exactly that situation — a test that
 * genuinely covers a file it does not import — so they are declared below.
 *
 * These are real claims, not a lever to unblock writes: this scan does cover
 * them, and the honest alternative (TDD_GUARD_BYPASS for a 33-file migration)
 * would have switched the guard off precisely where the risk is highest.
 */
// covers: app/(tabs)/history.tsx
// covers: app/day-detail.tsx
// covers: app/upgrade.tsx
// covers: src/components/RainfallCard.tsx
// covers: src/components/ScreenContainer.tsx
const COVERED_FILES: readonly string[] = [
  'app/(tabs)/_layout.tsx',
  'app/(tabs)/alerts.tsx',
  'app/(tabs)/forecasts.tsx',
  'app/(tabs)/history.tsx',
  'app/(tabs)/index.tsx',
  'app/(tabs)/locations.tsx',
  'app/(tabs)/settings.tsx',
  'app/_layout.tsx',
  'app/create-rule.tsx',
  'app/day-detail.tsx',
  'app/forgot-password.tsx',
  'app/index.tsx',
  'app/legal/eula.tsx',
  'app/legal/privacy-policy.tsx',
  'app/login.tsx',
  'app/onboarding/_layout.tsx',
  'app/onboarding/battery-setup.tsx',
  'app/onboarding/complete.tsx',
  'app/onboarding/eula.tsx',
  'app/onboarding/location-setup.tsx',
  'app/onboarding/notification-setup.tsx',
  'app/onboarding/privacy.tsx',
  'app/onboarding/welcome.tsx',
  'app/radar.tsx',
  'app/reset-password.tsx',
  'app/signup.tsx',
  'app/upgrade.tsx',
  'src/components/ErrorBoundary.tsx',
  'src/components/LocationSearchInput.tsx',
  'src/components/RainfallCard.tsx',
  'src/components/ScreenContainer.tsx',
  'src/components/UpdateCheckScreen.tsx',
  'src/components/WalkthroughModal.tsx',
];

describe('FEAT-002: no hardcoded style literals', () => {
  it('scans exactly the inventory it claims to cover', () => {
    // A walk that broke, or a screen nobody decided about, both fail here.
    const found = SCAN_DIRS.flatMap((d) => walk(d)).sort();
    expect(found).toEqual([...COVERED_FILES].sort());
  });

  it('finds zero inline numeric style literals in app/ and src/components/', () => {
    const findings = scan();
    // Asserting on the located list rather than the count, so a failure names
    // the exact file and line instead of printing "expected 0, got 901".
    const located = findings.map((f) => `${f.file}:${f.line}  ${f.text}`);
    expect(located).toEqual([]);
  });
});
