// ────────────────────────────────────────────────────────────
// send-digest Edge Function
//
// Called by pg_cron hourly. For each profile with digest_enabled:
// 1. Checks if it's the right local hour (using digest location's timezone)
// 2. Fetches a fresh forecast for the digest location
// 3. Formats a 3-day summary push notification
// 4. Sends via Expo Push and stamps digest_last_sent_at
// ────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { gridKey } from "../_shared/weatherEngine.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

const OPEN_METEO_API_KEY = Deno.env.get("OPEN_METEO_API_KEY") ?? "";
const OPEN_METEO_URL = OPEN_METEO_API_KEY
  ? "https://customer-api.open-meteo.com/v1/forecast"
  : "https://api.open-meteo.com/v1/forecast";

const MIN_RESEND_HOURS = 23;
// Accept cached forecast if poll-weather wrote it within the last 2 hours.
// poll-weather runs hourly, so this gives a one-cycle grace window.
const CACHE_MAX_AGE_MS = 2 * 60 * 60 * 1000;

// ── Scheduling check ───────────────────────────────────────

function shouldSendNow(
  digestHour: number,
  digestFrequency: string,
  digestDayOfWeek: number,
  lastSentAt: string | null,
  timezone: string,
  nowUtc: Date
): boolean {
  if (!timezone) return false;

  let localHour: number;
  let localIsoWeekday: number;

  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
      weekday: "short",
    });
    const parts = formatter.formatToParts(nowUtc);
    const hourPart = parts.find((p) => p.type === "hour");
    const weekdayPart = parts.find((p) => p.type === "weekday");
    if (!hourPart || !weekdayPart) return false;

    localHour = parseInt(hourPart.value, 10);
    const weekdayMap: Record<string, number> = {
      Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
    };
    localIsoWeekday = weekdayMap[weekdayPart.value] ?? -1;
  } catch {
    return false;
  }

  if (localHour !== digestHour) return false;
  if (digestFrequency === "weekly" && localIsoWeekday !== digestDayOfWeek) {
    return false;
  }

  if (lastSentAt) {
    const hoursSince =
      (nowUtc.getTime() - new Date(lastSentAt).getTime()) / (1000 * 60 * 60);
    if (hoursSince < MIN_RESEND_HOURS) return false;
  }

  return true;
}

// ── Forecast retrieval ─────────────────────────────────────
// Checks the forecast_cache table first (written by poll-weather hourly).
// gridKey is imported from weatherEngine.ts — identical rounding logic to
// poll-weather ensures cache hits. Falls back to direct Open-Meteo only if
// cache is missing or stale.

async function getForecast(
  lat: number,
  lon: number,
  nowUtc: Date
): Promise<ForecastResponse> {
  const key = gridKey(lat, lon);
  const { data: cached } = await supabase
    .from("forecast_cache")
    .select("forecast_json, fetched_at")
    .eq("grid_key", key)
    .single();

  if (cached) {
    const ageMs = nowUtc.getTime() - new Date(cached.fetched_at).getTime();
    if (ageMs < CACHE_MAX_AGE_MS) {
      return cached.forecast_json as ForecastResponse;
    }
  }

  const params = new URLSearchParams({
    ...(OPEN_METEO_API_KEY ? { apikey: OPEN_METEO_API_KEY } : {}),
    latitude: lat.toString(),
    longitude: lon.toString(),
    forecast_days: "7",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    daily: [
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "wind_speed_10m_max",
      "weather_code",
    ].join(","),
    timezone: "auto",
  });

  const res = await fetch(`${OPEN_METEO_URL}?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  return res.json();
}

// ── Notification formatting ────────────────────────────────

function fToC(f: number): number {
  return Math.round((f - 32) * 5 / 9);
}

function formatTemp(fahrenheit: number, unit: string): string {
  return unit === "celsius"
    ? `${fToC(fahrenheit)}°C`
    : `${Math.round(fahrenheit)}°F`;
}

interface ForecastResponse {
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
    wind_speed_10m_max: number[];
    weather_code?: number[];
  };
}

// ── WMO weather code → emoji ────────────────────────────────
// Local copy — avoids importing from weatherEngine which would pull in
// evaluate/gridKey exports and bloat the bundle. Kept in sync manually.

function weatherCodeToEmoji(code: number): string {
  if (code <= 1) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 49) return "🌫️";
  if (code <= 69) return "🌧️";
  if (code <= 79) return "❄️";
  if (code <= 84) return "🌦️";
  if (code <= 94) return "🌨️";
  if (code <= 99) return "⛈️";
  return "🌡️";
}

// ── Day label (relative to today UTC) ──────────────────────
// isoDate: "YYYY-MM-DD" from the Open-Meteo daily.time array.
// todayIso: today's date in "YYYY-MM-DD" (UTC), pre-computed by the caller
//           so all days in the loop share the same reference instant.

function getDayLabel(isoDate: string, todayIso: string): string {
  if (isoDate === todayIso) return "Today";

  const tomorrowDate = new Date(todayIso + "T00:00:00Z");
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const tomorrowIso = tomorrowDate.toISOString().slice(0, 10);

  if (isoDate === tomorrowIso) return "Tomorrow";

  // Any other day: short weekday name, forced UTC so the label matches the
  // forecast date regardless of the Edge Function server's local timezone.
  const d = new Date(isoDate + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}

// ── 3-day digest body builder ───────────────────────────────
// Iterates up to maxDays forecast days and formats each as:
//   "Label: [emoji] Hi X° Lo Y° [🌧 Z%]"
// Joined with " | " to fit in a single push notification body line.
//
// temperatureUnit: "fahrenheit" | "celsius" — respects per-user preference.
// weather_code is optional — if the array is missing or a slot is undefined,
// the emoji segment is simply omitted (forecast_cache from poll-weather may
// have been written before weather_code was added to the fetch params).

function buildDigestBody(
  daily: ForecastResponse["daily"],
  temperatureUnit: string,
  maxDays = 3
): string {
  if (!daily?.time?.length) throw new Error("Empty forecast data");

  // Anchor to UTC "today" once so all day labels are consistent within the call.
  const todayIso = new Date().toISOString().slice(0, 10);

  const dayCount = Math.min(daily.time.length, maxDays);
  const parts: string[] = [];

  for (let i = 0; i < dayCount; i++) {
    const label = getDayLabel(daily.time[i], todayIso);
    const hi = formatTemp(daily.temperature_2m_max[i], temperatureUnit);
    const lo = formatTemp(daily.temperature_2m_min[i], temperatureUnit);

    // Emoji: only include when weather_code is present AND has a value at index i.
    const code = daily.weather_code?.[i];
    const emoji = code !== undefined ? `${weatherCodeToEmoji(code)} ` : "";

    // Precipitation: only show when > 0% to keep the string compact.
    const rainPct = daily.precipitation_probability_max[i];
    const rainStr = rainPct > 0 ? ` 🌧 ${rainPct}%` : "";

    parts.push(`${label}: ${emoji}Hi ${hi} Lo ${lo}${rainStr}`);
  }

  return parts.join(" | ");
}

function formatDigest(
  forecast: ForecastResponse,
  locationName: string,
  temperatureUnit: string
): { title: string; body: string } {
  const body = buildDigestBody(forecast.daily, temperatureUnit, 3);
  return {
    title: `PingWeather Forecast — ${locationName}`,
    body,
  };
}

// ── Push send ──────────────────────────────────────────────

async function sendPush(
  pushToken: string,
  title: string,
  body: string
): Promise<boolean> {
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: pushToken,
      sound: "default",
      title,
      body,
      channelId: "forecast-digest",
    }),
  });

  if (!res.ok) {
    console.error(
      `sendPush failed for token ${pushToken.slice(0, 20)}…: ${res.status}`,
      await res.text()
    );
  }

  return res.ok;
}

// ── Main handler ───────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const digestSecret = Deno.env.get("SEND_DIGEST_SECRET") ?? "";
  const validTokens = [
    `Bearer ${serviceRoleKey}`,
    ...(digestSecret ? [`Bearer ${digestSecret}`] : []),
  ];
  if (!validTokens.includes(authHeader)) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    // notifyNow: bypass the shouldSendNow time gate — sends immediately
    // userId: scope to a single profile (omit to run for all digest users)
    const notifyNow: boolean = body?.notifyNow === true;
    const filterUserId: string | null = body?.userId ?? null;

    const nowUtc = new Date();

    // Fetch all profiles with digest enabled + their digest location
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select(`
        id,
        push_token,
        digest_enabled,
        digest_frequency,
        digest_hour,
        digest_day_of_week,
        digest_last_sent_at,
        digest_location_id,
        temperature_unit,
        wind_speed_unit,
        locations!digest_location_id (
          id,
          name,
          latitude,
          longitude,
          timezone
        )
      `)
      .eq("digest_enabled", true)
      .not("push_token", "is", null)
      .not("digest_location_id", "is", null);

    if (error) throw error;
    if (!profiles?.length) {
      return new Response(JSON.stringify({ sent: 0, skipped: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    let skipped = 0;

    for (const profile of profiles) {
      if (filterUserId && profile.id !== filterUserId) continue;

      const loc = Array.isArray(profile.locations)
        ? profile.locations[0]
        : profile.locations;
      if (!loc?.timezone) {
        skipped++;
        continue;
      }

      const due = notifyNow || shouldSendNow(
        profile.digest_hour,
        profile.digest_frequency,
        profile.digest_day_of_week,
        profile.digest_last_sent_at,
        loc.timezone,
        nowUtc
      );

      if (!due) {
        skipped++;
        continue;
      }

      try {
        const forecast = await getForecast(loc.latitude, loc.longitude, nowUtc);
        const { title, body } = formatDigest(
          forecast,
          loc.name,
          profile.temperature_unit ?? "fahrenheit"
        );
        const ok = await sendPush(profile.push_token!, title, body);

        if (ok) {
          await supabase
            .from("profiles")
            .update({ digest_last_sent_at: nowUtc.toISOString() })
            .eq("id", profile.id);
          sent++;
        } else {
          skipped++;
        }
      } catch (err) {
        console.error(`Digest failed for profile ${profile.id}:`, err);
        skipped++;
      }
    }

    return new Response(JSON.stringify({ sent, skipped }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-digest error:", err);
    return new Response(
      JSON.stringify({ error: "Digest send failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
