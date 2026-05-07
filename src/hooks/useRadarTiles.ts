import { useState, useEffect, useMemo } from 'react';
import { getAnimationFrames, type AnimationFrame } from '../services/radarTiles';

const FRAME_INTERVAL_MS = 600;
const DEFAULT_PAST_MINUTES = 60;
const DEFAULT_FUTURE_MINUTES = 120;

export interface UseRadarTilesResult {
  frames: AnimationFrame[];
  currentFrame: AnimationFrame;
  frameIndex: number;
  totalFrames: number;
  isPlaying: boolean;
  setFrameIndex: (index: number) => void;
  play: () => void;
  pause: () => void;
  goToNow: () => void;
}

export function useRadarTiles(apiKey: string): UseRadarTilesResult {
  const frames = useMemo(
    () =>
      getAnimationFrames(
        { pastMinutes: DEFAULT_PAST_MINUTES, futureMinutes: DEFAULT_FUTURE_MINUTES },
        apiKey
      ),
    [apiKey]
  );

  const nowIndex = frames.findIndex(f => f.isCurrent);
  const [frameIndex, setFrameIndex] = useState(nowIndex >= 0 ? nowIndex : 0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      setFrameIndex(i => (i + 1) % frames.length);
    }, FRAME_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isPlaying, frames.length]);

  return {
    frames,
    currentFrame: frames[frameIndex] ?? frames[0],
    frameIndex,
    totalFrames: frames.length,
    isPlaying,
    setFrameIndex,
    play: () => setIsPlaying(true),
    pause: () => setIsPlaying(false),
    goToNow: () => setFrameIndex(nowIndex >= 0 ? nowIndex : 0),
  };
}
