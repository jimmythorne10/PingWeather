// supabase/functions/evaluate-alerts/validation.ts
//
// Runtime body guard for the evaluate-alerts Edge Function.
//
// Importable in both Deno (Edge Function) and Node 18+ (Jest logic tests).
// No Deno-specific globals — pure TypeScript.

export interface EvaluateAlertsBodyValidation {
  valid: boolean;
  error?: string;
}

/**
 * Guard the parsed request body for evaluate-alerts.
 *
 * Validates that:
 *   - `rules` is an Array (may be empty — zero active rules is valid)
 *   - `forecast` is a non-null object with both `hourly` and `daily` keys
 *
 * Without this guard, malformed bodies from a poll-weather bug surface as
 * misleading 500s (e.g., "Cannot read properties of undefined (reading
 * 'filter')") instead of clear 400s that pinpoint the caller bug.
 */
export function validateEvaluateAlertsBody(body: {
  rules: unknown;
  forecast: unknown;
  location_name?: unknown;
}): EvaluateAlertsBodyValidation {
  const { rules, forecast } = body;

  // ── rules must be an array ────────────────────────────────────────────────
  if (!Array.isArray(rules)) {
    return {
      valid: false,
      error: `"rules" must be an array; got ${rules === null ? "null" : typeof rules}`,
    };
  }

  // ── forecast must be a non-null object ────────────────────────────────────
  if (forecast === null || forecast === undefined || typeof forecast !== "object") {
    return {
      valid: false,
      error: `"forecast" must be an object; got ${forecast === null ? "null" : typeof forecast}`,
    };
  }

  const f = forecast as Record<string, unknown>;

  // ── forecast.hourly must exist ────────────────────────────────────────────
  if (!f["hourly"] || typeof f["hourly"] !== "object") {
    return {
      valid: false,
      error: '"forecast.hourly" is missing or not an object',
    };
  }

  // ── forecast.daily must exist ─────────────────────────────────────────────
  if (!f["daily"] || typeof f["daily"] !== "object") {
    return {
      valid: false,
      error: '"forecast.daily" is missing or not an object',
    };
  }

  return { valid: true };
}
