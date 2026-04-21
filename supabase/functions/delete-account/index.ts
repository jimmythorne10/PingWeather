// ────────────────────────────────────────────────────────────
// delete-account Edge Function
//
// Permanently deletes the authenticated user's account and all
// associated data. Called from the app's Settings screen.
//
// Cascade chain (all automatic via ON DELETE CASCADE in schema):
//   auth.users → profiles → locations, alert_rules, alert_history
//
// A single auth.admin.deleteUser() call is sufficient — no manual
// row cleanup needed.
// ────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    // Verify the JWT and extract the user identity
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    // Delete the auth user — cascades to profiles, locations, alert_rules, alert_history
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error("[delete-account] deleteUser error:", deleteError);
      throw deleteError;
    }

    console.log(`[delete-account] Deleted user ${user.id}`);
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[delete-account] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to delete account" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
