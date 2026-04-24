// ────────────────────────────────────────────────────────────
// poll-weather Edge Function
//
// Called by pg_cron on a schedule (e.g., every hour).
// 1. Finds all active alert rules that are due for polling
// 2. Groups rules by location (grid-square caching)
// 3. Fetches forecast once per unique location  ← parallel (CONCURRENCY_LIMIT at a time)
// 4. Calls evaluate-alerts for each location's rules  ← parallel
// 5. Batch-fetches push tokens for all triggered users  ← one query, was N+1
// 6. Sends push notifications for triggered alerts  ← parallel
// ────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

const OPEN_METEO_API_KEY = Deno.env.get("OPEN_METEO_API_KEY") ?? "";
const OPEN_METEO_URL = OPEN_METEO_API_KEY
  ? "https://customer-api.open-meteo.com/v1/forecast"
  : "https://api.open-meteo.com/v1/forecast";

// Max grids processed simultaneously. Conservative — Supabase edge function
// concurrency and Open-Meteo commercial rate limits are both factors.
const CONCURRENCY_LIMIT = 10;

// ── Grid-square key ────────────────────────────────────────
// Round to 0.1° (~11km) to cluster nearby locations into one API call.
function gridKey(lat: number, lon: number): string {
  return `${Math.round(lat * 10) / 10},${Math.round(lon * 10) / 10}`;
}

// ── Timezone extraction ─────────────────────────────────────
// Open-Meteo returns a "timezone" field (IANA string, e.g. "America/New_York")
// in every forecast response when timezone=auto is requested. Used to backfill
// locations that have timezone: null (e.g., added via manual coordinate entry).
export function extractTimezone(forecast: Record<string, unknown> | null): string | null {
  if (!forecast) return null;
  const tz = forecast.timezone;
  if (typeof tz !== "string" || !tz) return null;
  return tz;
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

// ── Send push notification via Expo Push Service ───────────
// Expo Push Service routes to FCM V1 on Android.
async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
) {
  const message = {
    to: pushToken,
    sound: "default",
    title,
    body,
    data: data ?? {},
  };

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    console.error("Push notification failed:", await response.text());
  }

  return response.ok;
}

// ── Batch concurrency helper ────────────────────────────────
// Processes items in fixed-size batches. All items within a batch run
// concurrently; the next batch starts only after all items in the current
// batch settle. A failure in one item never prevents others from running.
export async function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

// ── Process one grid square ─────────────────────────────────
// Fetches forecast, evaluates all rules for this grid, and returns the
// triggered alerts enriched with location_name (needed for notification
// title — this context is lost once grids are processed in parallel).
interface GridGroup {
  lat: number;
  lon: number;
  locationId: string;
  locationName: string;
  locationTimezone: string | null;
  rules: Record<string, unknown>[];
}

interface GridResult {
  triggeredAlerts: Record<string, unknown>[];
  ruleIds: string[];
}

async function processGrid(group: GridGroup): Promise<GridResult> {
  if (group.lat < -90 || group.lat > 90 || group.lon < -180 || group.lon > 180) {
    throw new Error(
      `Invalid coordinates for "${group.locationName}": lat=${group.lat}, lon=${group.lon}. ` +
      `Location must be deleted and re-added through the app.`
    );
  }

  const forecast = await fetchForecast(group.lat, group.lon);
  const cacheKey = `${group.lat},${group.lon}`;

  // Write to forecast_cache and backfill timezone in parallel — both are
  // best-effort and must not abort grid processing if they fail.
  const tz = extractTimezone(forecast);
  const cacheWrite = supabase
    .from("forecast_cache")
    .upsert({ grid_key: cacheKey, latitude: group.lat, longitude: group.lon, forecast_json: forecast, fetched_at: new Date().toISOString() })
    .then(() => {})
    .catch((err: unknown) => console.error("forecast cache write failed:", err));

  const tzBackfill = group.locationTimezone === null && tz
    ? supabase.from("locations").update({ timezone: tz }).eq("id", group.locationId)
        .then(() => {}).catch((err: unknown) => console.error("timezone backfill failed:", err))
    : Promise.resolve();

  await Promise.all([cacheWrite, tzBackfill]);

  const evalResponse = await supabase.functions.invoke("evaluate-alerts", {
    body: {
      rules: group.rules,
      forecast,
      location_name: group.locationName,
    },
  });

  if (evalResponse.error) {
    throw new Error(`evaluate-alerts failed: ${JSON.stringify(evalResponse.error)}`);
  }

  const evalResult = evalResponse.data;

  // Enrich each triggered alert with location_name so the notification
  // title can be built as "rule_name - location_name" after parallelization
  // (group context is not available at notification dispatch time).
  const triggeredAlerts = (evalResult.alerts ?? []).map(
    (alert: Record<string, unknown>) => ({ ...alert, location_name: group.locationName })
  );

  return {
    triggeredAlerts,
    ruleIds: group.rules.map((r) => r.id as string),
  };
}

// ── Main handler ───────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const { data: rules, error: rulesError } = await supabase
      .from("alert_rules")
      .select(`
        *,
        locations!inner(id, name, latitude, longitude, timezone, is_active)
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

    const now = new Date();
    const dueRules = rules.filter((rule: Record<string, unknown>) => {
      if (!rule.last_polled_at) return true;
      const lastPoll = new Date(rule.last_polled_at as string);
      const intervalMs = (rule.polling_interval_hours as number) * 60 * 60 * 1000;
      return now.getTime() - lastPoll.getTime() >= intervalMs;
    });

    if (dueRules.length === 0) {
      return new Response(
        JSON.stringify({ message: "No rules due for polling", evaluated: 0 }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const locationGroups = new Map<string, GridGroup>();

    for (const rule of dueRules) {
      const loc = rule.locations as Record<string, unknown>;
      const key = gridKey(loc.latitude as number, loc.longitude as number);

      if (!locationGroups.has(key)) {
        locationGroups.set(key, {
          lat: loc.latitude as number,
          lon: loc.longitude as number,
          locationId: loc.id as string,
          locationName: loc.name as string,
          locationTimezone: loc.timezone as string | null,
          rules: [],
        });
      }
      locationGroups.get(key)!.rules.push(rule);
    }

    // processInBatches uses Promise.allSettled — a failed grid never blocks others.
    const groups = [...locationGroups.values()];
    const gridResults = await processInBatches(groups, CONCURRENCY_LIMIT, processGrid);

    // Failed grids are logged. Their rules are NOT stamped last_polled_at
    // so they retry on the next cron cycle.
    const allTriggeredAlerts: Record<string, unknown>[] = [];
    const allRuleIds: string[] = [];
    let failedGrids = 0;

    for (const result of gridResults) {
      if (result.status === "fulfilled") {
        allTriggeredAlerts.push(...result.value.triggeredAlerts);
        allRuleIds.push(...result.value.ruleIds);
      } else {
        console.error("Grid processing failed:", result.reason);
        failedGrids++;
      }
    }

    if (allRuleIds.length > 0) {
      const polledAt = new Date().toISOString();
      await supabase
        .from("alert_rules")
        .update({ last_polled_at: polledAt })
        .in("id", allRuleIds);
    }

    if (allTriggeredAlerts.length > 0) {
      const uniqueUserIds = [
        ...new Set(allTriggeredAlerts.map((a) => a.user_id as string)),
      ];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, push_token")
        .in("id", uniqueUserIds);

      const pushTokenByUserId = new Map<string, string>(
        (profiles ?? [])
          .filter((p: Record<string, unknown>) => p.push_token)
          .map((p: Record<string, unknown>) => [p.id as string, p.push_token as string])
      );

      await Promise.allSettled(
        allTriggeredAlerts.map(async (alert) => {
          const pushToken = pushTokenByUserId.get(alert.user_id as string);
          if (!pushToken) return;

          const sent = await sendPushNotification(
            pushToken,
            `${alert.rule_name} - ${alert.location_name}`,
            alert.summary as string,
            { rule_id: alert.rule_id as string }
          );

          if (sent && alert.alert_history_id) {
            await supabase
              .from("alert_history")
              .update({ notification_sent: true })
              .eq("id", alert.alert_history_id as string);
          }
        })
      );
    }

    return new Response(
      JSON.stringify({
        message: "Polling complete",
        locationsChecked: locationGroups.size,
        rulesEvaluated: dueRules.length,
        alertsTriggered: allTriggeredAlerts.length,
        failedGrids,
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
