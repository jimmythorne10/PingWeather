// ────────────────────────────────────────────────────────────
// Developer account check
//
// The tier override feature (used for testing paid-tier functionality
// without going through the store purchase flow) is restricted to a
// single developer email. All other accounts hit the real paywall.
// ────────────────────────────────────────────────────────────

const DEV_ACCOUNT_EMAIL = 'jimmy@truthcenteredtech.com';

/**
 * Returns true if the given email is the developer account that can
 * override their subscription tier without going through the paywall.
 *
 * Case-insensitive match to handle email normalization differences.
 */
export function isDevAccount(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === DEV_ACCOUNT_EMAIL;
}
