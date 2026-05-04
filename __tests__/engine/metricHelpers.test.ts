import { getUnitForMetric, getUnitLabel, nearestMoonPhasePreset, MOON_PHASE_PRESETS } from '../../src/utils/metricHelpers';

describe('getUnitForMetric', () => {
  test('barometric_pressure always returns hPa regardless of temperatureUnit', () => {
    expect(getUnitForMetric('barometric_pressure')).toBe('hPa');
    expect(getUnitForMetric('barometric_pressure', 'celsius')).toBe('hPa');
  });

  test('soil_temperature follows temperatureUnit param', () => {
    expect(getUnitForMetric('soil_temperature', 'fahrenheit')).toBe('fahrenheit');
    expect(getUnitForMetric('soil_temperature', 'celsius')).toBe('celsius');
  });

  test('soil_temperature defaults to fahrenheit (Open-Meteo fetches with temperature_unit=fahrenheit)', () => {
    expect(getUnitForMetric('soil_temperature')).toBe('fahrenheit');
  });

  test('temperature_high follows temperatureUnit param', () => {
    expect(getUnitForMetric('temperature_high', 'fahrenheit')).toBe('fahrenheit');
    expect(getUnitForMetric('temperature_high', 'celsius')).toBe('celsius');
  });

  test('temperature_low defaults to fahrenheit', () => {
    expect(getUnitForMetric('temperature_low')).toBe('fahrenheit');
  });

  test('temperature_current follows temperatureUnit param', () => {
    expect(getUnitForMetric('temperature_current', 'celsius')).toBe('celsius');
  });

  test('feels_like follows temperatureUnit param', () => {
    expect(getUnitForMetric('feels_like', 'celsius')).toBe('celsius');
    expect(getUnitForMetric('feels_like', 'fahrenheit')).toBe('fahrenheit');
  });

  test('snow_depth returns cm (not celsius)', () => {
    expect(getUnitForMetric('snow_depth')).toBe('cm');
    expect(getUnitForMetric('snow_depth', 'celsius')).toBe('cm');
  });

  test('snowfall returns cm', () => {
    expect(getUnitForMetric('snowfall')).toBe('cm');
  });

  test('precipitation_amount returns mm', () => {
    expect(getUnitForMetric('precipitation_amount')).toBe('mm');
  });

  test('moon_phase returns %illumination', () => {
    expect(getUnitForMetric('moon_phase')).toBe('%illumination');
  });

  test('weather_code returns undefined (unitless WMO integer)', () => {
    expect(getUnitForMetric('weather_code')).toBeUndefined();
  });

  test('wind_speed returns mph', () => {
    expect(getUnitForMetric('wind_speed')).toBe('mph');
  });

  test('humidity returns percent', () => {
    expect(getUnitForMetric('humidity')).toBe('percent');
  });

  test('precipitation_probability returns percent', () => {
    expect(getUnitForMetric('precipitation_probability')).toBe('percent');
  });

  test('uv_index returns index', () => {
    expect(getUnitForMetric('uv_index')).toBe('index');
  });
});

describe('getUnitLabel', () => {
  test('fahrenheit → °F', () => {
    expect(getUnitLabel('fahrenheit')).toBe('°F');
  });

  test('celsius → °C', () => {
    expect(getUnitLabel('celsius')).toBe('°C');
  });

  test('%illumination → %', () => {
    expect(getUnitLabel('%illumination')).toBe('%');
  });

  test('hPa → hPa', () => {
    expect(getUnitLabel('hPa')).toBe('hPa');
  });

  test('cm → cm', () => {
    expect(getUnitLabel('cm')).toBe('cm');
  });

  test('mm → mm', () => {
    expect(getUnitLabel('mm')).toBe('mm');
  });

  test('percent → %', () => {
    expect(getUnitLabel('percent')).toBe('%');
  });

  test('mph → mph', () => {
    expect(getUnitLabel('mph')).toBe('mph');
  });

  test('index → empty string', () => {
    expect(getUnitLabel('index')).toBe('');
  });

  test('undefined → empty string', () => {
    expect(getUnitLabel(undefined)).toBe('');
  });
});

describe('nearestMoonPhasePreset', () => {
  test('0 snaps to New Moon (5)', () => {
    expect(nearestMoonPhasePreset(0).value).toBe(5);
    expect(nearestMoonPhasePreset(0).label).toMatch(/New Moon/);
  });

  test('100 snaps to Full Moon (95)', () => {
    expect(nearestMoonPhasePreset(100).value).toBe(95);
    expect(nearestMoonPhasePreset(100).label).toMatch(/Full Moon/);
  });

  test('50 returns Quarter exactly', () => {
    expect(nearestMoonPhasePreset(50).value).toBe(50);
  });

  test('32 snaps to Crescent (25) not Quarter (50)', () => {
    expect(nearestMoonPhasePreset(32).value).toBe(25);
  });

  test('65 snaps to Gibbous (75) not Quarter (50)', () => {
    expect(nearestMoonPhasePreset(65).value).toBe(75);
  });

  test('every value in 0-100 returns a known preset value', () => {
    const presetValues = MOON_PHASE_PRESETS.map((p) => p.value);
    for (let i = 0; i <= 100; i += 5) {
      expect(presetValues).toContain(nearestMoonPhasePreset(i).value);
    }
  });
});
