// Tests for extractTimezone pure helper — imported from the shared weatherEngine
// module so that changes to the real function are caught by these tests.

import { extractTimezone } from '../../src/utils/weatherEngine';

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
