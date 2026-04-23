// ────────────────────────────────────────────────────────────
// poll-weather Edge Function
//
// Called by pg_cron on a schedule (e.g., every hour).
// 1. Finds all active alert rules that are due for polling
// 2. Groups rules by location (grid-square caching)
// 3. Fetches forecast once per unique location
// 4. Calls evaluate-alerts for each location's rules
// 5. Sends push notifications for triggered alerts
// ────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

const OPEN_METEO_API_KEY = Deno.env.get("OPEN_METEO_API_KEY") ?? "";
const OPEN_METEO_URL = OPEN_METEO_API_KEY
  ? "https://customer-api.open-meteo.com/v1/forecast"
  : "https://api.open-meteo.com/v1/forecast";

// ── Grid-square key ────────────────────────────────────────
// Round to 0.1° (~11km) to cluster nearby locations
function gridKey(lat: number, lon: number): string {
  return `${Math.round(lat * 10) / 10},${Math.round(lon * 10) / 10}`;
}

// ── Fetch forecast from Open-Meteo ─────────────────────────
async function fetchForecast(lat: number, lon: number) {
  const params = new URLSearchParams({
    ...(OPEN_METEO_API_KEY ? { apikey: OPEN_METEO_API_KEY } : {}),
    latitude: lat.toString(),
    longitude: lon.toString(),
    forecast_days: "7",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    hourly: [
      "temperature_2m",
      "relative_humidity_2m",
      "precipitation_probability",
      "wind_speed_10m",
      "apparent_temperature",
      "uv_index",
    ].join(","),
    daily: [
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "wind_speed_10m_max",
      "uv_index_max",
    ].join(","),
    timezone: "auto",
  });

  const response = await fetch(`${OPEN_METEO_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`Open-Meteo error: ${response.status}`);
  }
  return response.json();
}

// ── Send push notification via FCM ─────────────────────────
async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
) {
  // TODO: Implement FCM HTTP v1 API call
  // For MVP, we'll use Expo's push notification service as a simpler alternative
  // since the app uses expo-notifications
  const message = {
    to: pushToken,
    sound: "default",
    title,
    body,
    data: data || {},
  };

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    console.error("Push notification failed:", await response.text());
  }

  return response.ok;
}

// ── Main handler ───────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    // Verify this is a cron call or authorized request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.includes(serviceRoleKey)) {
      // Allow cron calls (they come with the service role key)
      // For manual testing, require the service role key
    }

    // 1. Find all active rules that are due for polling
    //    A rule is "due" if:
    //    - it's active
    //    - its location is active
    //    - enough time has passed since last check based on polling_interval_hours
    //    For simplicity in MVP, we check all active rules every time the cron runs.
    //    The cron runs hourly; rules with longer intervals are filtered here.
    const { data: rules, error: rulesError } = await supabase
      .from("alert_rules")
      .select(`
        *,
        locations!inner(id, name, latitude, longitude, is_active)
      `)
      .eq("is_active", true)
      .eq("locations.is_active", true);

    if (rulesError) throw rulesError;
    if (!rules || rules.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active rules to evaluate", evaluated: 0 }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Filter to rules that are due for polling.
    //
    // A rule is due when:
    //   - it has never been polled (last_polled_at is null), OR
    //   - enough time (polling_interval_hours) has passed since the
    //     previous poll.
    //
    // Historical note: this used to read rule.updated_at, which changes on
    // every edit AND every trigger (because last_triggered_at is an update),
    // so the filter misfired in both directions. `last_polled_at` is now a
    // dedicated column written unconditionally after each processed rule.
    const now = new Date();
    const dueRules = rules.filter((rule: any) => {
      if (!rule.last_polled_at) return true; // never polled
      const lastPoll = new Date(rule.last_polled_at);
      const intervalMs = rule.polling_interval_hours * 60 * 60 * 1000;
      return now.getTime() - lastPoll.getTime() >= intervalMs;
    });

    if (dueRules.length === 0) {
      return new Response(
        JSON.stringify({ message: "No rules due for polling", evaluated: 0 }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Group by location grid square
    const locationGroups = new Map<string, {
      lat: number;
      lon: number;
      rules: any[];
      locationName: string;
    }>();

    for (const rule of dueRules) {
      const loc = rule.locations;
      const key = gridKey(loc.latitude, loc.longitude);

      if (!locationGroups.has(key)) {
        locationGroups.set(key, {
          lat: loc.latitude,
          lon: loc.longitude,
          rules: [],
          locationName: loc.name,
        });
      }
      locationGroups.get(key)!.rules.push(rule);
    }

    // 3. Fetch forecast once per grid square and evaluate
    let totalTriggered = 0;

    for (const [_key, group] of locationGroups) {
      const forecast = await fetchForecast(group.lat, group.lon);

      // Call evaluate-alerts
      const evalResponse = await supabase.functions.invoke("evaluate-alerts", {
        body: {
          rules: group.rules,
          forecast,
          location_name: group.locationName,
        },
      });

      if (evalResponse.error) {
        console.error("evaluate-alerts error:", evalResponse.error);
        continue;
      }

      const evalResult = evalResponse.data;
      totalTriggered += evalResult.triggered;

      // 4. Send push notifications for triggered alerts
      if (evalResult.alerts && evalResult.alerts.length > 0) {
        for (const alert of evalResult.alerts) {
          // Get user's push token
          const { data: profile } = await supabase
            .from("profiles")
            .select("push_token")
            .eq("id", alert.user_id)
            .single();

          if (profile?.push_token) {
            const sent = await sendPushNotification(
              profile.push_token,
              `${alert.rule_name} - ${group.locationName}`,
              alert.summary,
              { rule_id: alert.rule_id }
            );

            // Update the exact alert_history row evaluate-alerts just
            // created for this trigger. evaluate-alerts returns the inserted
            // row id as alert_history_id; updating by primary key is the
            // only way to target exactly one row (the prior .order().limit()
            // chain was silently ignored by supabase-js on UPDATE and
            // would have stamped notification_sent=true on every history
            // row for the same user+rule).
            if (sent && alert.alert_history_id) {
              await supabase
                .from("alert_history")
                .update({ notification_sent: true })
                .eq("id", alert.alert_history_id);
            }
          }
        }
      }

      // 5. Stamp last_polled_at on every rule we just evaluated,
      //    regardless of whether it triggered. This is what the dueRules
      //    filter reads on the next invocation.
      const polledAt = new Date().toISOString();
      await supabase
        .from("alert_rules")
        .update({ last_polled_at: polledAt })
        .in("id", group.rules.map((r: any) => r.id));
    }

    return new Response(
      JSON.stringify({
        message: "Polling complete",
        locationsChecked: locationGroups.size,
        rulesEvaluated: dueRules.length,
        alertsTriggered: totalTriggered,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("poll-weather error:", error);
    return new Response(
      JSON.stringify({ error: "Polling failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
