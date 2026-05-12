import { useState, useEffect } from 'react';
import { buildRadarFrames, type AnimationFrame } from '../services/radarTiles';

const FRAME_INTERVAL_MS = 600;
const REFRESH_MS = 5 * 60 * 1000;

export interface UseRadarTilesResult {
  frames: AnimationFrame[];
  currentFrame: AnimationFrame | null;
  frameIndex: number;
  totalFrames: number;
  isPlaying: boolean;
  loading: false;
  error: null;
  setFrameIndex: (index: number) => void;
  play: () => void;
  pause: () => void;
  goToNow: () => void;
}

function nowIndex(frames: AnimationFrame[]): number {
  const idx = frames.findIndex(f => f.isCurrent);
  return idx >= 0 ? idx : frames.length - 1;
}

export function useRadarTiles(): UseRadarTilesResult {
  const [frames, setFrames] = useState<AnimationFrame[]>(buildRadarFrames);
  const [frameIndex, setFrameIndex] = useState(() => nowIndex(buildRadarFrames()));
  const [isPlaying, setIsPlaying] = useState(false);

  // Refresh frame list every 5 min so "Now" stays current
  useEffect(() => {
    const timer = setInterval(() => {
      const next = buildRadarFrames();
      setFrames(next);
      setFrameIndex(nowIndex(next));
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  // Animation playback
  useEffect(() => {
    if (!isPlaying || frames.length === 0) return;
    const id = setInterval(() => {
      setFrameIndex(i => (i + 1) % frames.length);
    }, FRAME_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isPlaying, frames.length]);

  return {
    frames,
    currentFrame: frames[frameIndex] ?? null,
    frameIndex,
    totalFrames: frames.length,
    isPlaying,
    loading: false,
    error: null,
    setFrameIndex,
    play: () => setIsPlaying(true),
    pause: () => setIsPlaying(false),
    goToNow: () => setFrameIndex(nowIndex(frames)),
  };
}
