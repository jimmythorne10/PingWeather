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
const BATCH_SIZE = 100; // Expo push accepts up to 100 per request

async function sendBatch(tokens: string[]): Promise<void> {
  const messages = tokens.map((token) => ({
    to: token,
    priority: "normal",
    _contentAvailable: true, // iOS: triggers background app refresh wake without showing a notification
    data: { type: "keepalive" },
    // No title, no body — FCM delivers as data-only on Android, APNs background
    // refresh on iOS. Normal priority respects Doze batching on Android, which
    // is acceptable — keepalive just needs periodic delivery, not instant.
  }));

  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(messages),
  });

  if (!res.ok) {
    console.error(`Expo push batch failed: ${res.status}`, await res.text());
  }
}

Deno.serve(async () => {
  try {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("push_token")
      .not("push_token", "is", null);

    if (error) throw error;
    if (!profiles?.length) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const tokens = profiles.map((p: { push_token: string }) => p.push_token);

    // Send in batches to stay within Expo's per-request limit
    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      await sendBatch(tokens.slice(i, i + BATCH_SIZE));
    }

    return new Response(JSON.stringify({ sent: tokens.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("fcm-keepalive error:", err);
    return new Response(JSON.stringify({ error: "Keepalive failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
