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
import { gridKey, weatherCodeToEmoji, processInBatches } from "../_shared/weatherEngine.ts";

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
      "sunrise",
      "sunset",
    ].join(","),
    timezone: "auto",
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  let res: Response;
  try {
    res = await fetch(`${OPEN_METEO_URL}?${params}`, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
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
    sunrise?: string[];
    sunset?: string[];
    moonrise?: string[];
    moonset?: string[];
  };
}

function formatSunTime(isoDateTime: string | undefined | null): string {
  if (!isoDateTime || isoDateTime.length < 16) return "";
  const timePart = isoDateTime.slice(11, 16);
  const [hhStr, mm] = timePart.split(":");
  const hh = parseInt(hhStr, 10);
  if (isNaN(hh)) return "";
  const period = hh >= 12 ? "pm" : "am";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${mm}${period}`;
}

// ── Day label ───────────────────────────────────────────────
// Returns "Weekday M/D" (e.g. "Mon 5/4") for every day — uniform length
// so the temperature columns align visually in the notification body.

function getDayLabel(isoDate: string): string {
  const [, m, d] = isoDate.split("-").map(Number);
  const weekday = new Date(isoDate + "T00:00:00Z")
    .toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  return `${weekday} ${m}/${d}`;
}

// ── 3-day digest body builder ───────────────────────────────
// Iterates up to maxDays forecast days and formats each as:
//   "[emoji] Label — Hi / Lo[ · Z%]"
// One line per day, joined with "\n" for an expanded multi-line notification.
//
// temperatureUnit: "fahrenheit" | "celsius" — respects per-user preference.
// weather_code is optional — if the array is missing or a slot is undefined,
// the emoji segment is simply omitted (forecast_cache from poll-weather may
// have been written before weather_code was added to the fetch params).
// Rain probability is shown only when >= 20% to avoid cluttering clear-day lines.

function buildDigestBody(
  daily: ForecastResponse["daily"],
  temperatureUnit: string,
  maxDays = 3
): string {
  if (!daily?.time?.length) throw new Error("Empty forecast data");

  const dayCount = Math.min(daily.time.length, maxDays);
  const parts: string[] = [];

  for (let i = 0; i < dayCount; i++) {
    const label = getDayLabel(daily.time[i]);
    const hi = formatTemp(daily.temperature_2m_max[i], temperatureUnit);
    const lo = formatTemp(daily.temperature_2m_min[i], temperatureUnit);

    // Emoji: only include when weather_code is present AND has a value at index i.
    const code = daily.weather_code?.[i];
    const emoji = code !== undefined ? `${weatherCodeToEmoji(code)} ` : "";

    // Precipitation: only show when >= 20% to avoid cluttering clear-day lines.
    const rainPct = daily.precipitation_probability_max[i];
    const rainStr = rainPct >= 20 ? ` · ${rainPct}%` : "";

    // Sun/moon times: append on a second line when available.
    const sunParts: string[] = [];
    const sunriseStr = daily.sunrise?.[i];
    const sunsetStr = daily.sunset?.[i];
    const moonriseStr = daily.moonrise?.[i];
    const moonsetStr = daily.moonset?.[i];
    if (sunriseStr) sunParts.push(`☀ ${formatSunTime(sunriseStr)}`);
    if (sunsetStr) sunParts.push(`🌇 ${formatSunTime(sunsetStr)}`);
    if (moonriseStr) sunParts.push(`🌙 ${formatSunTime(moonriseStr)}`);
    if (moonsetStr) sunParts.push(`🌑 ${formatSunTime(moonsetStr)}`);
    const sunLine = sunParts.length > 0 ? `\n  ${sunParts.join("  ")}` : "";

    parts.push(`${emoji}${label} — ${hi} / ${lo}${rainStr}${sunLine}`);
  }

  return parts.join("\n");
}

function formatDigest(
  forecast: ForecastResponse,
  locationName: string,
  temperatureUnit: string
): { title: string; body: string } {
  const body = buildDigestBody(forecast.daily, temperatureUnit, 3);
  return {
    title: `WeatherBeacon Forecast — ${locationName}`,
    body,
  };
}

// ── Push send ──────────────────────────────────────────────

async function sendPush(
  pushToken: string,
  title: string,
  body: string
): Promise<{ sent: boolean; isInvalidToken: boolean }> {
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
      `sendPush HTTP error for token ${pushToken.slice(0, 20)}…: ${res.status}`,
      await res.text()
    );
    return { sent: false, isInvalidToken: false };
  }

  let result: { data?: { status?: string; details?: { error?: string } } };
  try {
    result = await res.json();
  } catch {
    return { sent: false, isInvalidToken: false };
  }

  const msgData = result?.data;
  if (msgData?.status === "error") {
    const isInvalidToken = msgData?.details?.error === "DeviceNotRegistered";
    console.error(
      `sendPush Expo error for token ${pushToken.slice(0, 20)}…:`,
      msgData
    );
    return { sent: false, isInvalidToken };
  }

  return { sent: true, isInvalidToken: false };
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

    // Filter to only profiles that are due (or overridden by notifyNow / filterUserId)
    // before batching so skipped count is tallied correctly.
    const candidates = profiles.filter((profile) => {
      if (filterUserId && profile.id !== filterUserId) return false;
      const loc = Array.isArray(profile.locations)
        ? profile.locations[0]
        : profile.locations;
      if (!loc?.timezone) {
        skipped++;
        return false;
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
        return false;
      }
      return true;
    });

    await processInBatches(candidates, 10, async (profile) => {
      const loc = Array.isArray(profile.locations)
        ? profile.locations[0]
        : profile.locations;

      try {
        const forecast = await getForecast(loc.latitude, loc.longitude, nowUtc);
        const { title, body } = formatDigest(
          forecast,
          loc.name,
          profile.temperature_unit ?? "fahrenheit"
        );
        const { sent: ok, isInvalidToken } = await sendPush(profile.push_token!, title, body);

        if (ok) {
          await supabase
            .from("profiles")
            .update({ digest_last_sent_at: nowUtc.toISOString() })
            .eq("id", profile.id);
          sent++;
        } else {
          skipped++;
        }

        if (isInvalidToken) {
          await supabase
            .from("profiles")
            .update({ push_token: null })
            .eq("id", profile.id);
          console.log(`Pruned stale digest push token for user ${profile.id}`);
        }
      } catch (err) {
        console.error(`Digest failed for profile ${profile.id}:`, err);
        skipped++;
      }
    });

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
