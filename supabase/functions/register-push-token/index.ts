// ────────────────────────────────────────────────────────────
// register-push-token Edge Function
//
// Stores the user's Expo push token in their profile.
// Called from the app after requesting notification permissions.
// ────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Single admin client — used for both user validation and profile update.
const adminClient = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Extract JWT and validate it via the admin client.
    // adminClient.auth.getUser(jwt) is the documented Edge Function pattern —
    // it validates the token against the Supabase auth server and returns the
    // user identity. This is NOT the same as createClient(anonKey, { global:
    // { headers: { Authorization } } }).auth.getUser() — the latter creates a
    // sessionless client and getUser() without args returns null because there
    // is no session object to read from, even with a valid JWT in the header.
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await adminClient.auth.getUser(jwt);
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
