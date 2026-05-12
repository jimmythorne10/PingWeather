import { buildRadarFrames } from '../../src/services/radarTiles';

// Pin "now" to a clean 5-minute UTC boundary so assertions on timestamps are deterministic
const PINNED_NOW = new Date('2026-05-08T18:00:00.000Z').getTime(); // exactly on a 5-min boundary

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(PINNED_NOW);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('buildRadarFrames', () => {
  it('returns 12 frames total (11 past + 1 current)', () => {
    expect(buildRadarFrames().length).toBe(12);
  });

  it('has exactly one frame marked isCurrent=true', () => {
    expect(buildRadarFrames().filter(f => f.isCurrent).length).toBe(1);
  });

  it('current frame is the last frame (most recent)', () => {
    const frames = buildRadarFrames();
    expect(frames[frames.length - 1].isCurrent).toBe(true);
  });

  it('current frame label is "Now"', () => {
    expect(buildRadarFrames().find(f => f.isCurrent)?.label).toBe('Now');
  });

  it('no forecast frames exist (IEM has no forecast radar)', () => {
    expect(buildRadarFrames().every(f => !f.isForecast)).toBe(true);
  });

  it('all non-current frames have isPast=true', () => {
    buildRadarFrames().filter(f => !f.isCurrent).forEach(f => {
      expect(f.isPast).toBe(true);
    });
  });

  it('past frame labels match -Xmin pattern', () => {
    buildRadarFrames().filter(f => f.isPast).forEach(f => {
      expect(f.label).toMatch(/^-\d+min$/);
    });
  });

  it('frames are in strict chronological order 5 minutes apart', () => {
    const frames = buildRadarFrames();
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i].timestamp - frames[i - 1].timestamp).toBe(5 * 60 * 1000);
    }
  });

  it('oldest frame is -55min relative to now', () => {
    const frames = buildRadarFrames();
    expect(frames[0].timestamp).toBe(PINNED_NOW - 55 * 60 * 1000);
    expect(frames[0].label).toBe('-55min');
  });

  it('most recent past frame is -5min', () => {
    const frames = buildRadarFrames();
    const lastPast = frames[frames.length - 2];
    expect(lastPast.isPast).toBe(true);
    expect(lastPast.label).toBe('-5min');
  });

  it('current frame timestamp equals pinned now', () => {
    const current = buildRadarFrames().find(f => f.isCurrent)!;
    expect(current.timestamp).toBe(PINNED_NOW);
  });

  it('tile URLs use IEM NEXRAD CDN', () => {
    buildRadarFrames().forEach(f => {
      expect(f.tileUrlTemplate).toContain('mesonet.agron.iastate.edu');
    });
  });

  it('tile URLs contain Mapbox XYZ placeholders', () => {
    buildRadarFrames().forEach(f => {
      expect(f.tileUrlTemplate).toContain('{z}');
      expect(f.tileUrlTemplate).toContain('{x}');
      expect(f.tileUrlTemplate).toContain('{y}');
    });
  });

  it('current frame uses nexrad-n0q layer (no time suffix)', () => {
    const current = buildRadarFrames().find(f => f.isCurrent)!;
    expect(current.tileUrlTemplate).toContain('/nexrad-n0q/');
    expect(current.tileUrlTemplate).not.toContain('nexrad-n0q-m');
  });

  it('past frames use timed nexrad-n0q-mXXm layer names', () => {
    buildRadarFrames().filter(f => f.isPast).forEach(f => {
      expect(f.tileUrlTemplate).toMatch(/nexrad-n0q-m\d{2}m/);
    });
  });

  it('oldest past frame uses -m55m layer', () => {
    expect(buildRadarFrames()[0].tileUrlTemplate).toContain('nexrad-n0q-m55m');
  });

  it('second oldest past frame uses -m50m layer', () => {
    expect(buildRadarFrames()[1].tileUrlTemplate).toContain('nexrad-n0q-m50m');
  });

  it('-5min frame uses -m05m layer (zero-padded)', () => {
    const frames = buildRadarFrames();
    const fiveMin = frames[frames.length - 2];
    expect(fiveMin.tileUrlTemplate).toContain('nexrad-n0q-m05m');
  });

  it('uses 5-minute cache endpoint', () => {
    buildRadarFrames().forEach(f => {
      expect(f.tileUrlTemplate).toContain('/cache/tile.py/');
    });
  });

  it('timestamps round down to 5-minute boundaries when now is off-boundary', () => {
    jest.spyOn(Date, 'now').mockReturnValue(PINNED_NOW + 2.5 * 60 * 1000); // 2.5 min past boundary
    const frames = buildRadarFrames();
    expect(frames[frames.length - 1].timestamp).toBe(PINNED_NOW); // still pinned to boundary
  });
});
