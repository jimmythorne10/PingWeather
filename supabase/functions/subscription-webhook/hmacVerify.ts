// supabase/functions/subscription-webhook/hmacVerify.ts
//
// Constant-time HMAC-SHA256 verification helper for the subscription-webhook
// Edge Function.  Uses crypto.subtle.verify() — which is constant-time — instead
// of JS string equality, eliminating the timing side-channel that existed when
// comparing hex strings directly (SEC-001).
//
// Also implements the REQUIRE_HMAC_SIGNATURE flag: when true, a request that
// arrives with no X-RevenueCat-Signature header is immediately rejected rather
// than being allowed to fall through to the plain Bearer-token path.
//
// Importable in both Deno (Edge Function) and Node 18+ (Jest logic tests).

/** The three outcomes the caller must handle. */
export type VerifyResult =
  | "PASS"    // Signature present and verified — allow the request
  | "FAIL"    // Signature present but invalid, OR absent and requireHmac=true — reject 401
  | "NO_SIG"; // Signature absent and requireHmac=false — caller decides (Bearer fallback)

export interface VerifyOptions {
  secret: string;
  rawBody: string;
  /** Value of the X-RevenueCat-Signature header; empty string means absent. */
  receivedSig: string;
  /** When true, an absent signature is treated as FAIL rather than NO_SIG. */
  requireHmac: boolean;
}

/** Convert a lowercase hex string to a Uint8Array backed by an ArrayBuffer. */
function hexToUint8Array(hex: string): Uint8Array<ArrayBuffer> {
  if (hex.length % 2 !== 0) return new Uint8Array(new ArrayBuffer(0));
  const buffer = new ArrayBuffer(hex.length / 2);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Verify a RevenueCat HMAC-SHA256 signature using constant-time comparison.
 *
 * Returns:
 *   "PASS"   — signature present and cryptographically valid
 *   "FAIL"   — signature present but invalid, OR absent + requireHmac=true
 *   "NO_SIG" — signature absent and requireHmac=false (caller may try Bearer fallback)
 */
export async function verifyHmacSignature(opts: VerifyOptions): Promise<VerifyResult> {
  const { secret, rawBody, receivedSig, requireHmac } = opts;

  // ── 1. Handle absent signature ───────────────────────────────────────────
  if (receivedSig === "") {
    return requireHmac ? "FAIL" : "NO_SIG";
  }

  // ── 2. Import the key with ['verify'] usage (not ['sign']) ───────────────
  //    Using 'verify' usage is both semantically correct and enforced by
  //    crypto.subtle — you cannot accidentally sign with a verify-only key.
  const encoder = new TextEncoder();
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
  } catch {
    // Should only happen if the runtime is broken — treat as auth failure.
    return "FAIL";
  }

  // ── 3. Decode the received hex signature ────────────────────────────────
  const receivedBytes = hexToUint8Array(receivedSig.toLowerCase());
  if (receivedBytes.length === 0) {
    // Malformed hex string (odd length or empty after trim)
    return "FAIL";
  }

  // ── 4. Constant-time comparison via crypto.subtle.verify ────────────────
  //    crypto.subtle.verify() returns true only when the MAC is valid.
  //    The WebCrypto spec requires implementations to be constant-time.
  let valid: boolean;
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      key,
      receivedBytes,
      encoder.encode(rawBody),
    );
  } catch {
    return "FAIL";
  }

  return valid ? "PASS" : "FAIL";
}
