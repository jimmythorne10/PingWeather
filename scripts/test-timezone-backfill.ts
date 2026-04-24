/**
 * Integration test: poll-weather timezone backfill
 *
 * Verifies that poll-weather writes the IANA timezone string back onto any
 * location whose timezone column is null. Runs against the live Supabase
 * project — requires .env.local with EXPO_PUBLIC_SUPABASE_URL and a service
 * role key passed via SUPABASE_SERVICE_ROLE_KEY env var.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> npx ts-node -e "$(cat scripts/test-timezone-backfill.ts)"
 *
 * Or run via npm script:
 *   npm run test:integration:timezone
 *
 * Exit code: 0 = pass, 1 = fail
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// ── Load env ───────────────────────────────────────────────
function loadEnv(): void {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const [key, ...rest] = line.split("=");
    if (key && rest.length > 0 && !process.env[key.trim()]) {
      process.env[key.trim()] = rest.join("=").trim();
    }
  }
}
loadEnv();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/poll-weather`;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("FAIL: EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ── Helpers ────────────────────────────────────────────────
function pass(msg: string): void {
  console.log(`  ✓ ${msg}`);
}

function fail(msg: string, detail?: unknown): never {
  console.error(`  ✗ ${msg}`);
  if (detail !== undefined) console.error("   ", detail);
  process.exit(1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Test ───────────────────────────────────────────────────
async function run(): Promise<void> {
  console.log("\npoll-weather timezone backfill — integration test\n");

  // 1. Find a location that has rules (so poll-weather will process its grid)
  const { data: ruleRows, error: ruleErr } = await supabase
    .from("alert_rules")
    .select("location_id, locations!inner(id, name, timezone)")
    .eq("is_active", true)
    .limit(1)
    .single();

  if (ruleErr || !ruleRows) {
    fail("No active alert rule found — need at least one active rule to trigger poll-weather", ruleErr);
  }

  const loc = (ruleRows as Record<string, unknown>).locations as Record<string, unknown>;
  const locationId = loc.id as string;
  const locationName = loc.name as string;
  const originalTimezone = loc.timezone as string | null;

  console.log(`  Target location: "${locationName}" (${locationId})`);
  console.log(`  Current timezone: ${originalTimezone ?? "null"}`);

  // 2. Set timezone to null so poll-weather has something to backfill
  const { error: nullErr } = await supabase
    .from("locations")
    .update({ timezone: null })
    .eq("id", locationId);

  if (nullErr) fail("Could not set timezone to null", nullErr);
  pass("Set timezone → null");

  // 3. Also reset last_polled_at on the rule so poll-weather considers it due
  const { error: resetErr } = await supabase
    .from("alert_rules")
    .update({ last_polled_at: null })
    .eq("location_id", locationId);

  if (resetErr) fail("Could not reset last_polled_at", resetErr);
  pass("Reset last_polled_at → null (ensures rule is due)");

  // 4. Invoke poll-weather
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const body = await response.text();
    fail(`poll-weather returned ${response.status}`, body);
  }

  const result = await response.json() as Record<string, unknown>;
  pass(`poll-weather responded: ${JSON.stringify(result)}`);

  // 5. Give the best-effort backfill write time to complete
  await sleep(2000);

  // 6. Verify the location now has a timezone
  const { data: updated, error: readErr } = await supabase
    .from("locations")
    .select("timezone")
    .eq("id", locationId)
    .single();

  if (readErr) fail("Could not read updated location", readErr);

  const tz = (updated as Record<string, unknown>).timezone as string | null;

  if (!tz) {
    // Restore before failing so we don't leave a null timezone in prod
    await supabase.from("locations").update({ timezone: originalTimezone }).eq("id", locationId);
    fail(`timezone is still null after poll-weather ran — backfill did not fire`);
  }

  pass(`timezone backfilled: "${tz}"`);

  // 7. Verify it's a plausible IANA timezone (contains a slash or is "UTC")
  if (tz !== "UTC" && !tz.includes("/")) {
    await supabase.from("locations").update({ timezone: originalTimezone }).eq("id", locationId);
    fail(`timezone "${tz}" does not look like a valid IANA identifier`);
  }

  pass("timezone looks like a valid IANA string");

  // 8. Restore original timezone
  const { error: restoreErr } = await supabase
    .from("locations")
    .update({ timezone: originalTimezone })
    .eq("id", locationId);

  if (restoreErr) {
    console.warn(`  ⚠ Could not restore original timezone "${originalTimezone}" — fix manually`);
  } else {
    pass(`Restored timezone → ${originalTimezone ?? "null"}`);
  }

  console.log("\n  PASS — timezone backfill works end-to-end\n");
}

run().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
