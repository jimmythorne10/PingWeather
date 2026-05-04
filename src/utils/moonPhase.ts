// ─────────────────────────────────────────────────────────────────────────────
// moonPhase.ts — Pure moon illumination calculator.
//
// No API calls. Illumination is computed from UTC date using Julian Date math.
//
// Algorithm:
//   1. Convert the date to a Julian Date (JD)
//   2. Compute days elapsed since the known new moon anchor:
//        Jan 6 2000 at ~18:14 UTC  ≈  JD 2451550.1
//   3. Reduce to position within one synodic cycle via modulo:
//        synodic period = 29.53058867 days
//   4. Convert to phase angle (0° = new moon, 180° = full moon):
//        phaseAngle = (daysSinceNew / synodicPeriod) * 360
//   5. Illumination = (1 - cos(phaseAngle × π/180)) / 2 × 100
//        → 0 at new moon (cos 0° = 1), 100 at full moon (cos 180° = -1)
//
// Zero Deno imports, zero Supabase imports. Safe for Jest (node env).
// ─────────────────────────────────────────────────────────────────────────────

/** Julian Date of the known new moon anchor: Jan 6 2000 ~18:14 UTC */
const KNOWN_NEW_MOON_JD = 2451550.1;

/** Mean synodic period in days */
const SYNODIC_PERIOD = 29.53058867;

/**
 * Convert a JavaScript Date to a Julian Date number.
 * Julian Date is a continuous count of days since Jan 1, 4713 BC at noon UTC.
 * Formula: JD = floor(365.25 * (Y + 4716)) + floor(30.6001 * (M + 1)) + D + B - 1524.5
 */
function toJulianDate(date: Date): number {
  const Y = date.getUTCFullYear();
  const M = date.getUTCMonth() + 1; // 1-based month
  const D =
    date.getUTCDate() +
    date.getUTCHours() / 24 +
    date.getUTCMinutes() / 1440 +
    date.getUTCSeconds() / 86400;

  // For January and February, treat them as months 13 and 14 of the prior year
  const Y2 = M <= 2 ? Y - 1 : Y;
  const M2 = M <= 2 ? M + 12 : M;

  const A = Math.floor(Y2 / 100);
  // Gregorian correction (applied for dates after Oct 15, 1582)
  const B = 2 - A + Math.floor(A / 4);

  return (
    Math.floor(365.25 * (Y2 + 4716)) +
    Math.floor(30.6001 * (M2 + 1)) +
    D +
    B -
    1524.5
  );
}

/**
 * Returns the moon illumination as a percentage (0–100) for the given date.
 *
 *   0   = new moon (fully dark)
 *   50  = first or third quarter
 *   100 = full moon (fully lit)
 */
export function getMoonIllumination(date: Date): number {
  const jd = toJulianDate(date);
  const daysSinceNew = jd - KNOWN_NEW_MOON_JD;

  // Normalise to [0, synodicPeriod) — same as fmod for positive results
  const cyclePosition =
    ((daysSinceNew % SYNODIC_PERIOD) + SYNODIC_PERIOD) % SYNODIC_PERIOD;

  // Phase angle: 0° = new moon, 180° = full moon, 360° = back to new moon
  const phaseAngleDeg = (cyclePosition / SYNODIC_PERIOD) * 360;
  const phaseAngleRad = (phaseAngleDeg * Math.PI) / 180;

  // Illumination fraction: (1 - cos θ) / 2
  // At θ=0:   (1 - 1) / 2 = 0   → new moon
  // At θ=180: (1 - (-1)) / 2 = 1 → full moon
  const illumination = ((1 - Math.cos(phaseAngleRad)) / 2) * 100;

  // Clamp to [0, 100] to absorb any floating-point overshoot
  return Math.max(0, Math.min(100, illumination));
}

/**
 * Parses a YYYY-MM-DD date string (UTC midnight) and returns moon illumination.
 * Returns 0 for any invalid input — safe fallback, new moon is a valid moon state.
 */
export function getMoonIlluminationForDate(isoDate: string): number {
  const parsed = new Date(`${isoDate}T00:00:00.000Z`);
  if (isNaN(parsed.getTime())) {
    return 0;
  }
  return getMoonIllumination(parsed);
}
