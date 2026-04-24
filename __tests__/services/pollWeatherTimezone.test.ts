// Tests for extractTimezone pure helper extracted from poll-weather Edge Function.
//
// Convention (see processInBatches.test.ts): the logic is copied verbatim from
// the source in supabase/functions/poll-weather/index.ts. If the two diverge,
// these tests stop being meaningful regression coverage.

function extractTimezone(forecast: Record<string, unknown> | null): string | null {
  if (!forecast) return null;
  const tz = forecast.timezone;
  if (typeof tz !== "string" || !tz) return null;
  return tz;
}

describe("extractTimezone", () => {
  it("returns the IANA timezone string from a valid Open-Meteo response", () => {
    const forecast = { timezone: "America/New_York", latitude: 37.7, longitude: -77.3 };
    expect(extractTimezone(forecast)).toBe("America/New_York");
  });

  it("returns null when timezone field is absent", () => {
    const forecast = { latitude: 37.7, longitude: -77.3 };
    expect(extractTimezone(forecast)).toBeNull();
  });

  it("returns null when timezone is not a string", () => {
    const forecast = { timezone: 42, latitude: 37.7 };
    expect(extractTimezone(forecast)).toBeNull();
  });

  it("returns null when timezone is an empty string", () => {
    const forecast = { timezone: "", latitude: 37.7 };
    expect(extractTimezone(forecast)).toBeNull();
  });

  it("returns null when forecast is null", () => {
    expect(extractTimezone(null)).toBeNull();
  });

  it("handles UTC timezone", () => {
    const forecast = { timezone: "UTC" };
    expect(extractTimezone(forecast)).toBe("UTC");
  });

  it("handles timezone with slash (standard IANA format)", () => {
    const forecast = { timezone: "America/Chicago" };
    expect(extractTimezone(forecast)).toBe("America/Chicago");
  });
});
