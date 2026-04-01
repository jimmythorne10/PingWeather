// ────────────────────────────────────────────────────────────
// register-push-token Edge Function
//
// Stores the user's Expo push token in their profile.
// Called from the app after requesting notification permissions.
// ────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  try {
    // Get the user's JWT from the Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create a client with the user's JWT to get their identity
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const { push_token } = await req.json();
    if (!push_token || typeof push_token !== "string") {
      return new Response(
        JSON.stringify({ error: "push_token is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Use service role to update the profile (bypasses RLS for this specific update)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { error: updateError } = await adminClient
      .from("profiles")
      .update({ push_token })
      .eq("id", user.id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("register-push-token error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to register push token" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
