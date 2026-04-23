// ────────────────────────────────────────────────────────────
// subscription-webhook Edge Function
//
// Receives RevenueCat webhook events when a user's subscription
// status changes. Updates profiles.subscription_tier accordingly.
//
// Auth: Bearer token matching REVENUECAT_WEBHOOK_SECRET env var.
// JWT verification is OFF (called by RevenueCat servers, not app).
// ────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Product → tier mapping (mirrors src/services/subscriptionLogic.ts) ──
const PRODUCT_TIER_MAP: Record<string, string> = {
  "pro_monthly": "pro",
  "pro_monthly:monthly": "pro",
  "pro_annual": "pro",
  "premium_monthly": "premium",
  "premium_monthly:monthly": "premium",
  "premium_annual": "premium",
};

function mapProductToTier(productId: string): string | null {
  return PRODUCT_TIER_MAP[productId] ?? null;
}

interface ActionResult {
  action: string;
  newTier: string | null;
}

function determineAction(eventType: string, productId: string): ActionResult {
  switch (eventType) {
    case "INITIAL_PURCHASE": {
      const tier = mapProductToTier(productId);
      return { action: "upgrade", newTier: tier };
    }
    case "RENEWAL": {
      const tier = mapProductToTier(productId);
      return { action: "renew", newTier: tier };
    }
    case "CANCELLATION":
      return { action: "cancel_pending", newTier: null };
    case "EXPIRATION":
      return { action: "downgrade", newTier: "free" };
    case "BILLING_ISSUE_DETECTED":
      return { action: "billing_issue", newTier: null };
    default:
      return { action: "ignore", newTier: null };
  }
}

// ── Main handler ────────────────────────────────────────────

Deno.serve(async (req) => {
  // 1. POST only
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } },
    );
  }

  // 2. Authenticate via webhook secret
  const webhookSecret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token || token !== webhookSecret) {
    console.error(
      "subscription-webhook auth failure: invalid or missing webhook secret",
    );
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    // 3. Parse the RevenueCat event payload
    const body = await req.json();
    const event = body?.event;

    if (!event) {
      return new Response(
        JSON.stringify({ received: true, action: "malformed_payload" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const { type, app_user_id, product_id } = event;
    console.log(
      `subscription-webhook: type=${type} user=${app_user_id} product=${product_id}`,
    );

    // 4. Determine what action to take
    const { action, newTier } = determineAction(type, product_id ?? "");

    // 5. Update the database if there's a tier change
    if (newTier !== null) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ subscription_tier: newTier })
        .eq("id", app_user_id);

      if (updateError) {
        console.error(
          `subscription-webhook DB error for user ${app_user_id}:`,
          updateError,
        );
        // Still return 200 so RevenueCat doesn't retry endlessly.
        // The error is logged for investigation.
        return new Response(
          JSON.stringify({ received: true, action, error: "db_update_failed" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    // 6. Acknowledge receipt
    return new Response(
      JSON.stringify({ received: true, action }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("subscription-webhook unexpected error:", error);
    return new Response(
      JSON.stringify({ received: true, action: "error" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
});
