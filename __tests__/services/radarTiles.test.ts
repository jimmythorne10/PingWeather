import {
  roundToTenMinutes,
  getSnapshotTimestamp,
  buildTileUrlTemplate,
  getAnimationFrames,
} from '../../src/services/radarTiles';

describe('roundToTenMinutes', () => {
  it('rounds down from the middle of an interval', () => {
    expect(roundToTenMinutes(new Date('2026-05-06T14:37:00Z')))
      .toEqual(new Date('2026-05-06T14:30:00Z'));
  });

  it('returns unchanged when already on a 10-minute boundary', () => {
    const d = new Date('2026-05-06T14:30:00Z');
    expect(roundToTenMinutes(d)).toEqual(d);
  });

  it('rounds down from 1 second before the next boundary', () => {
    expect(roundToTenMinutes(new Date('2026-05-06T14:39:59Z')))
      .toEqual(new Date('2026-05-06T14:30:00Z'));
  });

  it('rounds down from 1 second after a boundary', () => {
    expect(roundToTenMinutes(new Date('2026-05-06T14:30:01Z')))
      .toEqual(new Date('2026-05-06T14:30:00Z'));
  });
});

describe('getSnapshotTimestamp', () => {
  it('returns Unix seconds for the 10-minute-rounded time', () => {
    const now = new Date('2026-05-06T14:37:00Z');
    const expected = new Date('2026-05-06T14:30:00Z').getTime() / 1000;
    expect(getSnapshotTimestamp(now)).toBe(expected);
  });

  it('returns an integer', () => {
    expect(Number.isInteger(getSnapshotTimestamp(new Date('2026-05-06T14:37:45Z')))).toBe(true);
  });
});

describe('buildTileUrlTemplate', () => {
  const snapshot = 1746538200;
  const apiKey = 'test-key-abc';

  it('builds the exact correct URL', () => {
    expect(buildTileUrlTemplate(1746538200, 600, 'mykey')).toBe(
      'https://api.rainbow.ai/v1/tiles/precip/1746538200/600/{z}/{x}/{y}?apikey=mykey'
    );
  });

  it('embeds forecast offset 0 for current conditions', () => {
    const url = buildTileUrlTemplate(snapshot, 0, apiKey);
    expect(url).toContain('/0/{z}');
  });

  it('embeds the snapshot timestamp in the path', () => {
    expect(buildTileUrlTemplate(snapshot, 0, apiKey)).toContain('1746538200');
  });

  it('appends the API key as a query parameter', () => {
    expect(buildTileUrlTemplate(snapshot, 0, apiKey)).toContain('apikey=test-key-abc');
  });

  it('contains Mapbox tile coordinate placeholders', () => {
    const url = buildTileUrlTemplate(snapshot, 0, apiKey);
    expect(url).toContain('{z}');
    expect(url).toContain('{x}');
    expect(url).toContain('{y}');
  });

  it('targets the Rainbow.ai API domain', () => {
    expect(buildTileUrlTemplate(snapshot, 0, apiKey)).toContain('api.rainbow.ai');
  });
});

describe('getAnimationFrames', () => {
  const now = new Date('2026-05-06T14:37:00Z');

  it('returns 7 frames for 30 past + current + 30 future minutes', () => {
    expect(getAnimationFrames({ now, pastMinutes: 30, futureMinutes: 30 }).length).toBe(7);
  });

  it('returns 1 frame when past and future are both 0', () => {
    const frames = getAnimationFrames({ now, pastMinutes: 0, futureMinutes: 0 });
    expect(frames.length).toBe(1);
    expect(frames[0].isCurrent).toBe(true);
  });

  it('marks exactly one frame as current', () => {
    const frames = getAnimationFrames({ now });
    expect(frames.filter(f => f.isCurrent).length).toBe(1);
  });

  it('labels the current frame "Now"', () => {
    const frames = getAnimationFrames({ now });
    expect(frames.find(f => f.isCurrent)?.label).toBe('Now');
  });

  it('marks past frames with isPast = true', () => {
    const frames = getAnimationFrames({ now, pastMinutes: 30, futureMinutes: 0 });
    frames.filter(f => !f.isCurrent).forEach(f => expect(f.isPast).toBe(true));
  });

  it('marks future frames with isForecast = true', () => {
    const frames = getAnimationFrames({ now, pastMinutes: 0, futureMinutes: 30 });
    frames.filter(f => !f.isCurrent).forEach(f => expect(f.isForecast).toBe(true));
  });

  it('frames are in strict chronological order', () => {
    const frames = getAnimationFrames({ now, pastMinutes: 60, futureMinutes: 60 });
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i].offsetSeconds).toBeGreaterThan(frames[i - 1].offsetSeconds);
    }
  });

  it('current frame has offsetSeconds of 0', () => {
    expect(getAnimationFrames({ now }).find(f => f.isCurrent)?.offsetSeconds).toBe(0);
  });

  it('current frame tile URL has zero forecast offset in the path', () => {
    const frames = getAnimationFrames({ now }, 'key');
    expect(frames.find(f => f.isCurrent)?.tileUrlTemplate).toMatch(/\/0\/\{z\}/);
  });

  it('every frame has a non-empty tileUrlTemplate', () => {
    getAnimationFrames({ now }, 'key').forEach(f =>
      expect(f.tileUrlTemplate.length).toBeGreaterThan(0)
    );
  });

  it('past frame labels start with "-"', () => {
    const frames = getAnimationFrames({ now, pastMinutes: 30, futureMinutes: 0 });
    frames.filter(f => f.isPast).forEach(f => expect(f.label).toMatch(/^-/));
  });

  it('future frame labels start with "+"', () => {
    const frames = getAnimationFrames({ now, pastMinutes: 0, futureMinutes: 30 });
    frames.filter(f => f.isForecast).forEach(f => expect(f.label).toMatch(/^\+/));
  });

  it('uses "min" suffix for intervals under 60 minutes', () => {
    const frames = getAnimationFrames({ now, pastMinutes: 30, futureMinutes: 0 });
    expect(frames[0].label).toBe('-30min');
  });

  it('uses "hr" suffix for exact hour multiples', () => {
    const frames = getAnimationFrames({ now, pastMinutes: 60, futureMinutes: 0 });
    expect(frames[0].label).toBe('-1hr');
  });

  it('uses combined hr+min format for non-exact hours', () => {
    const frames = getAnimationFrames({ now, pastMinutes: 70, futureMinutes: 0 });
    expect(frames[0].label).toBe('-1hr10min');
  });

  it('+2hr label for 120-minute future frame', () => {
    const frames = getAnimationFrames({ now, pastMinutes: 0, futureMinutes: 120 });
    expect(frames[frames.length - 1].label).toBe('+2hr');
  });
});
