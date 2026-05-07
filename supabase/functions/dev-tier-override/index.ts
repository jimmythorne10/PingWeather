// ────────────────────────────────────────────────────────────
// dev-tier-override Edge Function
//
// Allows the developer account to switch subscription tiers for
// testing without going through RevenueCat. Uses service role to
// bypass the RLS WITH CHECK policy that blocks user-JWT tier writes.
//
// Restricted to jimmy@truthcenteredtech.com only. Returns 403 for
// any other authenticated user.
//
// Auth: user's JWT in Authorization header — validated server-side.
// verify_jwt = false (we validate the JWT manually to inspect the email).
// ────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DEV_ACCOUNT_EMAIL = 'jimmy@truthcenteredtech.com'
const VALID_TIERS = ['free', 'pro', 'premium']

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  // Validate the user's JWT using the correct pattern (adminClient.auth.getUser(jwt))
  const jwt = authHeader.replace('Bearer ', '')
  const { data: { user }, error: userError } = await adminClient.auth.getUser(jwt)

  if (userError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (user.email !== DEV_ACCOUNT_EMAIL) {
    return new Response('Forbidden', { status: 403 })
  }

  let body: { tier?: string }
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { tier } = body
  if (!tier || !VALID_TIERS.includes(tier)) {
    return new Response(`Invalid tier. Must be one of: ${VALID_TIERS.join(', ')}`, { status: 400 })
  }

  // Service role bypasses RLS
  const { error } = await adminClient
    .from('profiles')
    .update({ subscription_tier: tier })
    .eq('id', user.id)

  if (error) {
    console.error('Tier update failed:', error)
    return new Response('Update failed', { status: 500 })
  }

  return new Response(JSON.stringify({ success: true, tier }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
