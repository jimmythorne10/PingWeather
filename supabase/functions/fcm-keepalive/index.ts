// ────────────────────────────────────────────────────────────
// fcm-keepalive Edge Function
//
// Runs once daily via pg_cron. Sends a silent data-only push to
// every user with a registered push token. No notification is shown;
// the FCM delivery keeps the app in Android's Active/Working Set
// standby bucket so alert notifications are not delayed or dropped.
//
// Users who receive a digest or alert notification on a given day
// already get this benefit implicitly — the keepalive is a safety
// net for quiet days when no other notification fires.
// ────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100; // Expo push accepts up to 100 messages per request
const PAGE_SIZE = 500;  // DB rows fetched per page to handle large user bases

// Returns the subset of tokens that Expo has marked DeviceNotRegistered.
// Callers are responsible for nulling these out in the DB.
async function sendBatch(tokens: string[]): Promise<string[]> {
  const messages = tokens.map((token) => ({
    to: token,
    priority: "normal",
    _contentAvailable: true, // iOS: triggers background app refresh without showing notification
    data: { type: "keepalive" },
    // No title, no body — FCM delivers as data-only on Android, APNs background
    // refresh on iOS. Normal priority respects Doze batching on Android, which
    // is acceptable — keepalive just needs periodic delivery, not instant.
  }));

  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(messages),
  });

  if (!res.ok) {
    console.error(`Expo push batch failed: ${res.status}`, await res.text());
    return [];
  }

  let body: { data?: Array<{ status?: string; details?: { error?: string } }> };
  try {
    body = await res.json();
  } catch {
    return [];
  }

  const results = body?.data ?? [];
  const invalidTokens: string[] = [];
  results.forEach((result, idx) => {
    if (result?.status === "error" && result?.details?.error === "DeviceNotRegistered") {
      invalidTokens.push(tokens[idx]);
    }
  });
  return invalidTokens;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // Paginate profiles with push tokens. Fetching all at once is fine for
    // small user bases but would OOM on large ones. PAGE_SIZE = 500 keeps
    // each query snappy and well within Supabase row limits.
    let page = 0;
    const allTokens: string[] = [];

    while (true) {
      const { data, error } = await supabase
        .from("profiles")
        .select("push_token")
        .not("push_token", "is", null)
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) {
        console.error(`fcm-keepalive: page ${page} fetch error:`, error);
        break;
      }

      if (!data?.length) break;

      allTokens.push(...data.map((p: { push_token: string }) => p.push_token));

      // If we got fewer rows than PAGE_SIZE, we've reached the last page.
      if (data.length < PAGE_SIZE) break;

      page++;
    }

    if (allTokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Send in batches of 100 to stay within Expo's per-request limit.
    // Collect DeviceNotRegistered tokens across all batches for a single prune query.
    const invalidTokens: string[] = [];
    for (let i = 0; i < allTokens.length; i += BATCH_SIZE) {
      const batchInvalid = await sendBatch(allTokens.slice(i, i + BATCH_SIZE));
      invalidTokens.push(...batchInvalid);
    }

    if (invalidTokens.length > 0) {
      const { error: pruneError } = await supabase
        .from("profiles")
        .update({ push_token: null })
        .in("push_token", invalidTokens);
      if (pruneError) {
        console.error("Failed to prune invalid push tokens:", pruneError);
      } else {
        console.log(`Pruned ${invalidTokens.length} stale push token(s)`);
      }
    }

    return new Response(JSON.stringify({ sent: allTokens.length, pruned: invalidTokens.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("fcm-keepalive error:", err);
    return new Response(
      JSON.stringify({ error: "Keepalive failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
