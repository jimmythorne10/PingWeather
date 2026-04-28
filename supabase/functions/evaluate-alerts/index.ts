// ────────────────────────────────────────────────────────────
// evaluate-alerts Edge Function
//
// Core alert engine. Called by poll-weather after fetching forecast data.
// Evaluates all active alert rules for a given location against forecast data.
// Returns which rules triggered and the human-readable summary.
//
// Auth: Bearer ${SUPABASE_SERVICE_ROLE_KEY} — called only by poll-weather
// (which uses a service_role supabase client). verify_jwt = false in
// config.toml; the bearer check below is the access control.
//
// This is the core IP of PingWeather.
// ────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  isInCooldown,
  evaluateRule,
} from "../_shared/weatherEngine.ts";
import type {
  AlertRule,
  ForecastData,
} from "../_shared/weatherEngine.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

// ── Main handler ───────────────────────────────────────────

Deno.serve(async (req) => {
  // Bearer auth — only poll-weather (service_role client) should call this.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const { rules, forecast, location_name } = (await req.json()) as {
      rules: AlertRule[];
      forecast: ForecastData;
      location_name: string;
    };

    const evalNow = new Date();

    // Evaluate all rules (pure computation — no DB calls yet).
    // evaluateRule is imported from weatherEngine.ts so Jest can test it
    // without running Deno.
    const results = rules
      .filter((rule) => rule.is_active && !isInCooldown(rule, evalNow))
      .map((rule) => evaluateRule(rule, forecast));

    const triggered = results.filter((r) => r.triggered);

    // Parallel-insert alert_history for all triggered rules, then batch-update
    // last_triggered_at in one query. N+1 DB round trips → N parallel + 1 batch.
    //
    // Dedup: migration 00015 adds a unique index on (rule_id, date_trunc('hour',
    // triggered_at)). If two poll cycles fire within the same UTC hour (e.g.,
    // manual trigger + scheduled), the second insert returns error code 23505
    // (unique_violation). We treat that as "already fired this hour" — skip
    // adding to historyIdByRule so no duplicate push notification is sent.
    const historyIdByRule = new Map<string, string>();

    await Promise.all(
      triggered.map(async (result) => {
        const { data: historyRow, error: historyErr } = await supabase
          .from("alert_history")
          .insert({
            user_id: result.rule.user_id,
            rule_id: result.rule.id,
            rule_name: result.rule.name,
            location_name,
            conditions_met: result.summary,
            forecast_data: {
              matchDetails: result.matchDetails,
              evaluatedAt: evalNow.toISOString(),
            },
            notification_sent: false,
          })
          .select("id")
          .single();

        if (historyErr) {
          // 23505 = unique_violation — dedup index fired, already alerted
          // this hour. Not an error — just skip the push for this cycle.
          if ((historyErr as { code?: string }).code === "23505") {
            console.log(
              `alert_history dedup: rule ${result.rule.id} already fired this hour — skipping`
            );
          } else {
            console.error("alert_history insert error:", historyErr);
          }
        } else if (historyRow?.id) {
          historyIdByRule.set(result.rule.id, historyRow.id);
        }
      })
    );

    if (triggered.length > 0) {
      await supabase
        .from("alert_rules")
        .update({ last_triggered_at: evalNow.toISOString() })
        .in(
          "id",
          triggered.map((r) => r.rule.id)
        );
    }

    return new Response(
      JSON.stringify({
        evaluated: results.length,
        triggered: triggered.length,
        alerts: triggered.map((r) => ({
          rule_id: r.rule.id,
          rule_name: r.rule.name,
          user_id: r.rule.user_id,
          summary: r.summary,
          details: r.matchDetails,
          // Dedicated id so poll-weather can surgically UPDATE one row.
          // Null when dedup prevented the insert (already alerted this hour).
          alert_history_id: historyIdByRule.get(r.rule.id) ?? null,
        })),
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("evaluate-alerts error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to evaluate alerts" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
