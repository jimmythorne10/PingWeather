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
//
// Auth: Bearer ${SUPABASE_SERVICE_ROLE_KEY} — called by pg_cron via pg_net.
// verify_jwt = false in config.toml (service_role key is not a user JWT).
// ────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  gridKey,
  extractTimezone,
  processInBatches,
  formatMatchedDate,
  weatherCodeToEmoji,
} from "../_shared/weatherEngine.ts";

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

// ── Fetch forecast from Open-Meteo ─────────────────────────
// 10-second AbortController timeout prevents a slow Open-Meteo response from
// hanging the function until Deno's default network timeout (~30s).
async function fetchForecast(lat: number, lon: number): Promise<Record<string, unknown>> {
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
      "weather_code",
      "precipitation",
      "surface_pressure",
      "snowfall",
      "snow_depth",
      "soil_temperature_0cm",
      "wind_gusts_10m",
      "dew_point_2m",
      "visibility",
      "cloud_cover",
    ].join(","),
    daily: [
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "wind_speed_10m_max",
      "uv_index_max",
      "weather_code",
      "precipitation_sum",
    ].join(","),
    timezone: "auto",
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`${OPEN_METEO_URL}?${params}`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Open-Meteo error: ${response.status}`);
    }
    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Send push notification via Expo Push Service ───────────
// Expo Push Service routes to FCM V1 on Android.
// Returns both delivery status and whether the token is permanently invalid.
// The HTTP response is always 200 for per-message errors — the actual status
// lives in the JSON body (data.status / data.details.error).
async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ sent: boolean; isInvalidToken: boolean }> {
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
    console.error(
      `sendPushNotification HTTP error for token ${pushToken.slice(0, 20)}…: ${response.status}`
    );
    return { sent: false, isInvalidToken: false };
  }

  let result: { data?: { status?: string; details?: { error?: string } } };
  try {
    result = await response.json();
  } catch {
    return { sent: false, isInvalidToken: false };
  }

  const msgData = result?.data;
  if (msgData?.status === "error") {
    const isInvalidToken = msgData?.details?.error === "DeviceNotRegistered";
    if (!isInvalidToken) {
      console.error(
        `sendPushNotification error for token ${pushToken.slice(0, 20)}…:`,
        msgData
      );
    }
    return { sent: false, isInvalidToken };
  }

  return { sent: true, isInvalidToken: false };
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
  if (
    group.lat < -90 || group.lat > 90 ||
    group.lon < -180 || group.lon > 180
  ) {
    throw new Error(
      `Invalid coordinates for "${group.locationName}": lat=${group.lat}, lon=${group.lon}. ` +
      `Location must be deleted and re-added through the app.`
    );
  }

  const forecast = await fetchForecast(group.lat, group.lon);

  // Cache key uses gridKey (shared with send-digest) so the cache lookup
  // always hits. Using `${group.lat},${group.lon}` directly would miss whenever
  // the raw lat/lon differs from the rounded key send-digest uses for lookup.
  const cacheKey = gridKey(group.lat, group.lon);

  // Write to forecast_cache and backfill timezone in parallel — both are
  // best-effort and must not abort grid processing if they fail.
  const tz = extractTimezone(forecast);
  const cacheWrite = supabase
    .from("forecast_cache")
    .upsert({
      grid_key: cacheKey,
      latitude: group.lat,
      longitude: group.lon,
      forecast_json: forecast,
      fetched_at: new Date().toISOString(),
    })
    .then(() => {})
    .catch((err: unknown) => console.error("forecast cache write failed:", err));

  const tzBackfill =
    group.locationTimezone === null && tz
      ? supabase
          .from("locations")
          .update({ timezone: tz })
          .eq("id", group.locationId)
          .then(() => {})
          .catch((err: unknown) =>
            console.error("timezone backfill failed:", err)
          )
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
    throw new Error(
      `evaluate-alerts failed: ${JSON.stringify(evalResponse.error)}`
    );
  }

  const evalResult = evalResponse.data;

  // Enrich each triggered alert with location_name so the notification
  // title can be built as "rule_name - location_name" after parallelization.
  const triggeredAlerts = (evalResult.alerts ?? []).map(
    (alert: Record<string, unknown>) => ({
      ...alert,
      location_name: group.locationName,
    })
  );

  return {
    triggeredAlerts,
    ruleIds: group.rules.map((r) => r.id as string),
  };
}

// ── Main handler ───────────────────────────────────────────

Deno.serve(async (req) => {
  // Bearer auth — accepts POLL_WEATHER_SECRET (cron path, stored in vault)
  // or SUPABASE_SERVICE_ROLE_KEY (internal service-to-service calls).
  const authHeader = req.headers.get("Authorization") ?? "";
  const pollSecret = Deno.env.get("POLL_WEATHER_SECRET") ?? "";
  const validTokens = [
    `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    ...(pollSecret ? [`Bearer ${pollSecret}`] : []),
  ];
  if (!validTokens.includes(authHeader)) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

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
      const intervalMs =
        (rule.polling_interval_hours as number) * 60 * 60 * 1000;
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
      const key = gridKey(
        loc.latitude as number,
        loc.longitude as number
      );

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
    const gridResults = await processInBatches(
      groups,
      CONCURRENCY_LIMIT,
      processGrid
    );

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
      const { error: polledAtErr } = await supabase
        .from("alert_rules")
        .update({ last_polled_at: polledAt })
        .in("id", allRuleIds);
      // Non-fatal: rules will re-evaluate on the next cycle. Log for ops.
      if (polledAtErr) {
        console.error("last_polled_at batch update failed:", polledAtErr);
      }
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
          .map((p: Record<string, unknown>) => [
            p.id as string,
            p.push_token as string,
          ])
      );

      const pushResults = await Promise.allSettled(
        allTriggeredAlerts.map(async (alert) => {
          const pushToken = pushTokenByUserId.get(alert.user_id as string);
          if (!pushToken) return;

          const details = (alert.details ?? []) as Array<{ matchedTime?: string | null; met?: boolean }>;
          const firstMatchedTime = details.find(d => d.met && d.matchedTime)?.matchedTime ?? null;
          const dayLabel = formatMatchedDate(firstMatchedTime);

          // Prepend WMO emoji from the daily weather_code for the triggered day.
          // The forecast is carried on the alert as alert.forecast (set by evaluate-alerts),
          // or we fall back to no emoji if unavailable.
          const forecastRaw = alert.forecast as Record<string, unknown> | undefined;
          const dailyWeatherCodes = (forecastRaw?.daily as Record<string, unknown> | undefined)
            ?.weather_code as number[] | undefined;
          const dailyTimes = (forecastRaw?.daily as Record<string, unknown> | undefined)
            ?.time as string[] | undefined;
          let wmoEmoji = '';
          if (dailyWeatherCodes && dailyTimes && firstMatchedTime) {
            // Match the triggered day — compare date prefix of the matched time
            const matchedDateStr = firstMatchedTime.slice(0, 10);
            const dayIndex = dailyTimes.findIndex((t) => t.startsWith(matchedDateStr));
            if (dayIndex >= 0 && dailyWeatherCodes[dayIndex] !== undefined) {
              wmoEmoji = weatherCodeToEmoji(dailyWeatherCodes[dayIndex]) + ' ';
            }
          }

          const summaryText = alert.summary as string;
          const notifBody = dayLabel
            ? `${wmoEmoji}${dayLabel}: ${summaryText}`
            : `${wmoEmoji}${summaryText}`;


          const { sent, isInvalidToken } = await sendPushNotification(
            pushToken,
            `${alert.rule_name as string} — ${alert.location_name as string}`,
            notifBody,
            {
              rule_id: alert.rule_id as string,
              alert_date: firstMatchedTime ?? '',
            }
          );

          if (sent && alert.alert_history_id) {
            await supabase
              .from("alert_history")
              .update({ notification_sent: true })
              .eq("id", alert.alert_history_id as string);
          }

          // Prune stale tokens immediately so future cron cycles don't retry
          // and waste cooldown windows on a device that will never receive them.
          if (isInvalidToken) {
            await supabase
              .from("profiles")
              .update({ push_token: null })
              .eq("id", alert.user_id as string);
            console.log(`Pruned stale push token for user ${alert.user_id as string}`);
          }
        })
      );

      // Log any push dispatch failures so they appear in function logs.
      for (const result of pushResults) {
        if (result.status === "rejected") {
          console.error("Push dispatch rejected:", result.reason);
        }
      }
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
