// __tests__/services/hmacVerify.test.ts
//
// TDD for SEC-001: constant-time HMAC verification + REQUIRE_HMAC_SIGNATURE flag.
// The helper under test lives at supabase/functions/subscription-webhook/hmacVerify.ts
// and must be importable in Node (crypto.subtle available in Node 18+).

import {
  verifyHmacSignature,
  VerifyResult,
} from "../../supabase/functions/subscription-webhook/hmacVerify";

const SECRET = "test-webhook-secret-xyz";
const BODY = '{"event":{"type":"INITIAL_PURCHASE","app_user_id":"aaa","product_id":"pro_monthly"}}';

/** Produce a real HMAC-SHA256 hex string using Node's crypto.subtle */
async function computeHmac(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── HMAC present + correct ────────────────────────────────────────────────────

test("valid HMAC signature returns PASS", async () => {
  const sig = await computeHmac(SECRET, BODY);
  const result = await verifyHmacSignature({ secret: SECRET, rawBody: BODY, receivedSig: sig, requireHmac: false });
  expect(result).toBe<VerifyResult>("PASS");
});

// ── HMAC present + tampered body ─────────────────────────────────────────────

test("tampered body with original signature returns FAIL", async () => {
  const sig = await computeHmac(SECRET, BODY);
  const tamperedBody = BODY.replace("INITIAL_PURCHASE", "EXPIRATION");
  const result = await verifyHmacSignature({ secret: SECRET, rawBody: tamperedBody, receivedSig: sig, requireHmac: false });
  expect(result).toBe<VerifyResult>("FAIL");
});

// ── HMAC present + tampered signature ────────────────────────────────────────

test("tampered signature with valid body returns FAIL", async () => {
  const validSig = await computeHmac(SECRET, BODY);
  // Flip the last two hex chars to corrupt the signature
  const tamperedSig = validSig.slice(0, -2) + (validSig.endsWith("ff") ? "00" : "ff");
  const result = await verifyHmacSignature({ secret: SECRET, rawBody: BODY, receivedSig: tamperedSig, requireHmac: false });
  expect(result).toBe<VerifyResult>("FAIL");
});

// ── Signature absent, requireHmac = false ────────────────────────────────────

test("absent signature with requireHmac=false returns NO_SIG (caller decides)", async () => {
  const result = await verifyHmacSignature({ secret: SECRET, rawBody: BODY, receivedSig: "", requireHmac: false });
  expect(result).toBe<VerifyResult>("NO_SIG");
});

// ── Signature absent, requireHmac = true ─────────────────────────────────────

test("absent signature with requireHmac=true returns FAIL", async () => {
  const result = await verifyHmacSignature({ secret: SECRET, rawBody: BODY, receivedSig: "", requireHmac: true });
  expect(result).toBe<VerifyResult>("FAIL");
});

// ── Wrong secret ──────────────────────────────────────────────────────────────

test("correct signature but wrong secret returns FAIL", async () => {
  const sig = await computeHmac(SECRET, BODY);
  const result = await verifyHmacSignature({ secret: "different-secret", rawBody: BODY, receivedSig: sig, requireHmac: false });
  expect(result).toBe<VerifyResult>("FAIL");
});
