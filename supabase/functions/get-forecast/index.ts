// ─────────────────────────────────────────────────────────────────────────────
// get-forecast Edge Function
//
// Proxies Open-Meteo forecast requests from the client app.
//
// SECURITY MODEL:
//   verify_jwt = true (set in config.toml by the migration agent).
//   The Supabase gateway validates the user's JWT before this function runs —
//   unauthenticated callers get a 401 before they reach our code.
//   The commercial Open-Meteo API key is stored as a Supabase function secret
//   (OPEN_METEO_API_KEY) and never leaves the server.
//
// USAGE:
//   Called exclusively from src/services/weatherApi.ts via
//   supabase.functions.invoke('get-forecast', { body: { ... } }).
//
// REQUIRED SECRET:
//   OPEN_METEO_API_KEY — set via: npx supabase secrets set OPEN_METEO_API_KEY=<key>
//   If unset, falls back to the free tier (no key). Acceptable for dev/testing.
// ─────────────────────────────────────────────────────────────────────────────

const OPEN_METEO_API_KEY = Deno.env.get("OPEN_METEO_API_KEY") ?? "";
const OPEN_METEO_URL = OPEN_METEO_API_KEY
  ? "https://customer-api.open-meteo.com/v1/forecast"
  : "https://api.open-meteo.com/v1/forecast";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json() as {
      latitude: unknown;
      longitude: unknown;
      forecast_days?: unknown;
      temperature_unit?: unknown;
      wind_speed_unit?: unknown;
      hourly?: unknown;
      daily?: unknown;
      past_days?: unknown;
      precipitation_unit?: unknown;
    };

    const {
      latitude,
      longitude,
      forecast_days = 7,
      temperature_unit = "fahrenheit",
      wind_speed_unit = "mph",
      hourly = [],
      daily = [],
      past_days,
      precipitation_unit,
    } = body;

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return new Response(
        JSON.stringify({ error: "latitude and longitude are required numbers" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (
      latitude < -90 || latitude > 90 ||
      longitude < -180 || longitude > 180
    ) {
      return new Response(
        JSON.stringify({ error: "latitude or longitude out of range" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      forecast_days: String(forecast_days),
      temperature_unit: String(temperature_unit),
      wind_speed_unit: String(wind_speed_unit),
      timezone: "auto",
      ...(OPEN_METEO_API_KEY ? { apikey: OPEN_METEO_API_KEY } : {}),
    });

    // Default hourly variables to request when the client doesn't specify.
    // Includes all new metrics so the forecast response carries them automatically.
    const defaultHourly = [
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
    ];
    const defaultDaily = [
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "wind_speed_10m_max",
      "wind_direction_10m_dominant",
      "uv_index_max",
      "weather_code",
      "precipitation_sum",
    ];

    const hourlyVars = Array.isArray(hourly) && hourly.length > 0
      ? (hourly as string[])
      : defaultHourly;
    const dailyVars = Array.isArray(daily) && daily.length > 0
      ? (daily as string[])
      : defaultDaily;

    params.set("hourly", hourlyVars.join(","));
    params.set("daily", dailyVars.join(","));
    if (past_days !== undefined) {
      params.set("past_days", String(past_days));
    }
    if (precipitation_unit !== undefined) {
      params.set("precipitation_unit", String(precipitation_unit));
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    let response: Response;
    try {
      response = await fetch(`${OPEN_METEO_URL}?${params}`, {
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`get-forecast: Open-Meteo error ${response.status}:`, errorText);
      throw new Error(`Open-Meteo error: ${response.status}`);
    }

    const forecast = await response.json();

    return new Response(JSON.stringify(forecast), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    // AbortError means the 10s timeout fired — distinct log message for
    // diagnosing slow Open-Meteo responses vs. other runtime errors.
    if (err instanceof Error && err.name === "AbortError") {
      console.error("get-forecast: Open-Meteo request timed out after 10s");
      return new Response(
        JSON.stringify({ error: "Weather service timed out" }),
        { status: 504, headers: { "Content-Type": "application/json" } }
      );
    }

    console.error("get-forecast error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to fetch forecast" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
