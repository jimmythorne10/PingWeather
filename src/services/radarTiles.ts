const RAINBOW_TILE_BASE = 'https://api.rainbow.ai/v1/tiles/precip';
const TEN_MINUTES_MS = 10 * 60 * 1000;
const TEN_MINUTES_S = 600;

export interface AnimationFrame {
  label: string;
  tileUrlTemplate: string;
  isPast: boolean;
  isCurrent: boolean;
  isForecast: boolean;
  offsetSeconds: number;
}

export function roundToTenMinutes(date: Date): Date {
  return new Date(Math.floor(date.getTime() / TEN_MINUTES_MS) * TEN_MINUTES_MS);
}

export function getSnapshotTimestamp(now: Date = new Date()): number {
  return roundToTenMinutes(now).getTime() / 1000;
}

export function buildTileUrlTemplate(
  snapshot: number,
  forecastOffset: number,
  apiKey: string
): string {
  return `${RAINBOW_TILE_BASE}/${snapshot}/${forecastOffset}/{z}/{x}/{y}?apikey=${apiKey}`;
}

function formatDuration(minutes: number, prefix: string): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${prefix}${minutes}min`;
  if (mins === 0) return `${prefix}${hours}hr`;
  return `${prefix}${hours}hr${mins}min`;
}

export function getAnimationFrames(
  opts: { now?: Date; pastMinutes?: number; futureMinutes?: number } = {},
  apiKey: string = ''
): AnimationFrame[] {
  const { now = new Date(), pastMinutes = 60, futureMinutes = 120 } = opts;
  const snapshot = getSnapshotTimestamp(now);
  const frames: AnimationFrame[] = [];

  const pastSteps = Math.floor(pastMinutes / 10);
  for (let i = pastSteps; i > 0; i--) {
    const pastSnapshot = snapshot - i * TEN_MINUTES_S;
    const minsAgo = i * 10;
    frames.push({
      label: formatDuration(minsAgo, '-'),
      tileUrlTemplate: buildTileUrlTemplate(pastSnapshot, 0, apiKey),
      isPast: true,
      isCurrent: false,
      isForecast: false,
      offsetSeconds: -i * TEN_MINUTES_S,
    });
  }

  frames.push({
    label: 'Now',
    tileUrlTemplate: buildTileUrlTemplate(snapshot, 0, apiKey),
    isPast: false,
    isCurrent: true,
    isForecast: false,
    offsetSeconds: 0,
  });

  const futureSteps = Math.floor(futureMinutes / 10);
  for (let i = 1; i <= futureSteps; i++) {
    const forecastOffset = i * TEN_MINUTES_S;
    const minsAhead = i * 10;
    frames.push({
      label: formatDuration(minsAhead, '+'),
      tileUrlTemplate: buildTileUrlTemplate(snapshot, forecastOffset, apiKey),
      isPast: false,
      isCurrent: false,
      isForecast: true,
      offsetSeconds: forecastOffset,
    });
  }

  return frames;
}
