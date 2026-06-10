// ────────────────────────────────────────────────────────────
// subscription-webhook Edge Function
//
// Receives RevenueCat webhook events when a user's subscription
// status changes. Updates profiles.subscription_tier accordingly.
//
// Auth: HMAC-SHA256 of raw request body, verified against the
// X-RevenueCat-Signature header using REVENUECAT_WEBHOOK_SECRET.
// Uses constant-time crypto.subtle.verify() — no timing side-channel.
//
// REQUIRE_HMAC_SIGNATURE env flag (default: false for backward compat):
//   false — if X-RevenueCat-Signature is absent, fall back to Bearer
//           token comparison (transition period for existing webhook config).
//   true  — if X-RevenueCat-Signature is absent, reject 401 immediately.
//           Flip this once HMAC delivery is confirmed in production logs.
//
// JWT verification is OFF (called by RevenueCat servers, not app).
// ────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyHmacSignature } from "./hmacVerify.ts";

// ── Product → tier mapping (mirrors src/services/subscriptionLogic.ts) ──
const PRODUCT_TIER_MAP: Record<string, string> = {
  // Android (short form)
  "pro_monthly": "pro",
  "pro_monthly:monthly": "pro",
  "pro_annual": "pro",
  "premium_monthly": "premium",
  "premium_monthly:monthly": "premium",
  "premium_annual": "premium",
  // iOS (fully qualified bundle ID prefix)
  "com.truthcenteredtech.pingweather.pro_monthly": "pro",
  "com.truthcenteredtech.pingweather.pro_monthly:monthly": "pro",
  "com.truthcenteredtech.pingweather.premium_monthly": "premium",
  "com.truthcenteredtech.pingweather.premium_monthly:monthly": "premium",
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

  // 2. Read raw body FIRST before any parsing — required for HMAC verification
  const rawBody = await req.text();

  // 3. Authenticate via HMAC-SHA256 or bearer token fallback
  const webhookSecret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("subscription-webhook: REVENUECAT_WEBHOOK_SECRET not configured");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  // REQUIRE_HMAC_SIGNATURE=true → reject any request lacking the header.
  // Leave false during transition; flip to true once HMAC delivery is
  // confirmed in RevenueCat production webhook logs.
  const requireHmac = Deno.env.get("REQUIRE_HMAC_SIGNATURE") === "true";

  const receivedSig = req.headers.get("X-RevenueCat-Signature") ?? "";

  const hmacResult = await verifyHmacSignature({
    secret: webhookSecret,
    rawBody,
    receivedSig,
    requireHmac,
  });

  if (hmacResult === "PASS") {
    // Signature present and cryptographically valid — proceed.
  } else if (hmacResult === "FAIL") {
    console.error("subscription-webhook auth failure: HMAC signature invalid or required but absent");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  } else {
    // NO_SIG — requireHmac is false; fall back to plain Bearer token comparison
    // (transition period: RevenueCat may not send the signature on all webhooks yet)
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
  }

  try {
    // 4. Parse the RevenueCat event payload (already read as text above)
    let body: { event?: { type?: unknown; app_user_id?: unknown; product_id?: unknown } };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ received: true, action: "malformed_payload" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const event = body?.event;

    if (!event) {
      return new Response(
        JSON.stringify({ received: true, action: "malformed_payload" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const { type, app_user_id, product_id } = event;

    // Validate types before using them — a poisoned payload with a non-UUID
    // app_user_id would silently match zero rows; catch it explicitly.
    const isValidUuid = (s: unknown): s is string =>
      typeof s === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

    if (!isValidUuid(app_user_id)) {
      console.error(
        `subscription-webhook: invalid app_user_id format: ${app_user_id}`,
      );
      // ACK to prevent retry storms on a structurally malformed event.
      return new Response(
        JSON.stringify({ received: true, action: "invalid_user_id" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (typeof type !== "string" || typeof product_id !== "string") {
      console.error(
        `subscription-webhook: malformed event fields type=${type} product=${product_id}`,
      );
      return new Response(
        JSON.stringify({ received: true, action: "malformed_event" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    console.log(
      `subscription-webhook: type=${type} user=${app_user_id} product=${product_id}`,
    );

    // 5. Determine what action to take
    const { action, newTier } = determineAction(type, product_id ?? "");

    // 6. Update the database if there's a tier change
    if (newTier !== null) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      // Verify the profile exists before updating — if app_user_id doesn't
      // match a Supabase UUID, the UPDATE silently touches zero rows.
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("id", app_user_id);

      if (!count) {
        console.error(
          `subscription-webhook: no profile found for app_user_id ${app_user_id} — RC user ID may not match Supabase UUID`,
        );
        return new Response(
          JSON.stringify({ received: true, action: "user_not_found" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

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

    // 7. Acknowledge receipt
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
