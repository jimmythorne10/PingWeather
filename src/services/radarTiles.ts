const IEM_CACHE = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0';
const TILE_PATH = '{z}/{x}/{y}.png';
const BUCKET_MS = 5 * 60 * 1000;
const PAST_FRAMES = 11; // -55min through -5min, 5-min steps

export interface AnimationFrame {
  label: string;
  tileUrlTemplate: string;
  isPast: boolean;
  isCurrent: boolean;
  isForecast: boolean;
  timestamp: number;
}

export function buildRadarFrames(): AnimationFrame[] {
  const currentMs = Math.floor(Date.now() / BUCKET_MS) * BUCKET_MS;
  const frames: AnimationFrame[] = [];

  for (let i = PAST_FRAMES; i >= 1; i--) {
    const minAgo = i * 5;
    const mm = String(minAgo).padStart(2, '0');
    frames.push({
      label: `-${minAgo}min`,
      tileUrlTemplate: `${IEM_CACHE}/nexrad-n0q-m${mm}m/${TILE_PATH}`,
      isPast: true,
      isCurrent: false,
      isForecast: false,
      timestamp: currentMs - minAgo * 60 * 1000,
    });
  }

  frames.push({
    label: 'Now',
    tileUrlTemplate: `${IEM_CACHE}/nexrad-n0q/${TILE_PATH}`,
    isPast: false,
    isCurrent: true,
    isForecast: false,
    timestamp: currentMs,
  });

  return frames;
}
