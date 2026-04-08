/**
 * Parse a Supabase password-recovery deep link.
 *
 * Supabase delivers recovery tokens via URL hash fragment in the implicit flow:
 *   pingweather://reset-password#access_token=xxx&refresh_token=yyy&type=recovery&expires_in=3600
 *
 * Some flows use a query string instead (PKCE):
 *   pingweather://reset-password?access_token=xxx&refresh_token=yyy&type=recovery
 *
 * The React Native Supabase client does NOT auto-detect recovery tokens (no
 * window.location sniffing). We must parse the URL manually and then call
 * supabase.auth.setSession({ access_token, refresh_token }) to activate the
 * recovery session before letting the user submit a new password.
 *
 * Returns null for any input that does not represent a valid recovery URL,
 * so callers can early-return and render an "invalid link" state without
 * try/catch plumbing.
 */

export interface RecoveryTokens {
  accessToken: string;
  refreshToken: string;
  type: 'recovery';
}

function splitKVs(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!source) return out;
  for (const pair of source.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const key = pair.slice(0, eq);
    const value = pair.slice(eq + 1);
    if (!key) continue;
    try {
      out[decodeURIComponent(key)] = decodeURIComponent(value);
    } catch {
      // Malformed percent encoding — skip the pair rather than throwing.
      out[key] = value;
    }
  }
  return out;
}

export function parseRecoveryUrl(
  url: string | null | undefined
): RecoveryTokens | null {
  if (!url) return null;

  // Prefer the hash fragment (implicit flow). Supabase puts tokens in the hash
  // to keep them out of server logs; the query-string form only shows up in
  // PKCE-style flows.
  const hashIdx = url.indexOf('#');
  const hash = hashIdx === -1 ? '' : url.slice(hashIdx + 1);
  const hashParams = splitKVs(hash);

  let params = hashParams;

  // If hash didn't yield an access_token, fall back to query string.
  if (!params.access_token) {
    const questionIdx = url.indexOf('?');
    if (questionIdx !== -1) {
      // Query ends at the hash boundary (or end of string).
      const queryEnd = hashIdx === -1 ? url.length : hashIdx;
      const query = url.slice(questionIdx + 1, queryEnd);
      params = splitKVs(query);
    }
  }

  if (params.type !== 'recovery') return null;
  if (!params.access_token || !params.refresh_token) return null;

  return {
    accessToken: params.access_token,
    refreshToken: params.refresh_token,
    type: 'recovery',
  };
}
