/**
 * Pure subscription logic for RevenueCat webhook event handling.
 *
 * Extracted so the Edge Function (Deno) can mirror the same decision
 * table and the Node-side Jest suite can test it without Deno imports.
 */

// ── Product → tier mapping ─────────────────────────────────
const PRODUCT_TIER_MAP: Record<string, string> = {
  pro_monthly: 'pro',
  pro_annual: 'pro',
  premium_monthly: 'premium',
  premium_annual: 'premium',
};

/**
 * Map a RevenueCat product_id to a PingWeather subscription tier.
 * Returns `null` for unknown products (caller decides what to do).
 */
export function mapProductToTier(productId: string): string | null {
  return PRODUCT_TIER_MAP[productId] ?? null;
}

export interface ActionResult {
  /** Human-readable label for the action taken */
  action: string;
  /** The new subscription_tier to write, or null if no DB change needed */
  newTier: string | null;
}

/**
 * Decide what to do for a given RevenueCat event type + product.
 *
 * Rules:
 * - INITIAL_PURCHASE / RENEWAL → upgrade/renew to the tier the product maps to
 * - CANCELLATION → no immediate change (entitlement runs until expiration)
 * - EXPIRATION → downgrade to free
 * - BILLING_ISSUE_DETECTED → log only, store handles grace period
 * - Anything else → ignore
 */
export function determineAction(
  eventType: string,
  productId: string,
): ActionResult {
  switch (eventType) {
    case 'INITIAL_PURCHASE': {
      const tier = mapProductToTier(productId);
      return { action: 'upgrade', newTier: tier };
    }
    case 'RENEWAL': {
      const tier = mapProductToTier(productId);
      return { action: 'renew', newTier: tier };
    }
    case 'CANCELLATION':
      return { action: 'cancel_pending', newTier: null };
    case 'EXPIRATION':
      return { action: 'downgrade', newTier: 'free' };
    case 'BILLING_ISSUE_DETECTED':
      return { action: 'billing_issue', newTier: null };
    default:
      return { action: 'ignore', newTier: null };
  }
}
