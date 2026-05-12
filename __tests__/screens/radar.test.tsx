// Tests for RadarScreen
// covers: radar

import React from 'react';
import { render, screen } from '@testing-library/react-native';

// ── expo-router mock ──────────────────────────────────────────────────────────
jest.mock('expo-router', () => {
  const noop = () => null;
  const Screen = () => null;
  const Stack = () => null;
  (Stack as any).Screen = Screen;
  return {
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() }),
    useSegments: () => [],
    useLocalSearchParams: () => ({ lat: '39.5', lng: '-98.35', locationName: 'Kansas' }),
    useFocusEffect: jest.fn(),
    Stack,
    Tabs: noop,
    Slot: noop,
    Link: ({ children }: any) => children ?? null,
    Redirect: noop,
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  };
});

// ── rnmapbox mock ─────────────────────────────────────────────────────────────
jest.mock('@rnmapbox/maps', () => {
  const MapView = ({ children }: any) => children ?? null;
  const Camera = () => null;
  const RasterSource = ({ children }: any) => children ?? null;
  const RasterLayer = () => null;
  return {
    __esModule: true,
    default: {
      setAccessToken: jest.fn(),
      StyleURL: { Dark: 'mapbox://styles/mapbox/dark-v11' },
      MapView,
      Camera,
      RasterSource,
      RasterLayer,
    },
  };
});

// ── useRadarTiles mock ────────────────────────────────────────────────────────
const IEM = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0';
const MOCK_FRAMES = [
  { label: '-10min', tileUrlTemplate: `${IEM}/nexrad-n0q-m10m/{z}/{x}/{y}.png`, isPast: true,  isCurrent: false, isForecast: false, timestamp: 1778209800 },
  { label: 'Now',   tileUrlTemplate: `${IEM}/nexrad-n0q/{z}/{x}/{y}.png`,      isPast: false, isCurrent: true,  isForecast: false, timestamp: 1778210400 },
];
jest.mock('../../src/hooks/useRadarTiles', () => ({
  useRadarTiles: () => ({
    frames: MOCK_FRAMES,
    currentFrame: MOCK_FRAMES[1],
    frameIndex: 1,
    totalFrames: 2,
    isPlaying: false,
    loading: false,
    error: null,
    setFrameIndex: jest.fn(),
    play: jest.fn(),
    pause: jest.fn(),
    goToNow: jest.fn(),
  }),
}));

// ── theme mock ────────────────────────────────────────────────────────────────
jest.mock('../../src/theme', () => {
  const tokens: any = new Proxy({}, { get: () => '#000000' });
  return { useTokens: () => tokens };
});

import RadarScreen from '../../app/radar';

beforeEach(() => {
  jest.clearAllMocks();
  process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN = 'pk.test';
});

describe('RadarScreen controls', () => {
  it('renders frame count', () => {
    render(<RadarScreen />);
    expect(screen.getByText('2 / 2')).toBeTruthy();
  });

  it('renders current frame label', () => {
    render(<RadarScreen />);
    expect(screen.getAllByText('Now').length).toBeGreaterThanOrEqual(1);
  });

  it('renders play button', () => {
    render(<RadarScreen />);
    expect(screen.getByText('▶ Play')).toBeTruthy();
  });

  it('renders NOAA attribution', () => {
    render(<RadarScreen />);
    expect(screen.getByText(/NOAA/)).toBeTruthy();
  });
});

describe('RadarScreen idle state', () => {
  it('does not show loading indicator (frames are synchronous)', () => {
    render(<RadarScreen />);
    expect(screen.queryByText(/Loading radar/)).toBeNull();
  });

  it('does not show error banner (IEM has no error path)', () => {
    render(<RadarScreen />);
    expect(screen.queryByText(/Radar unavailable/)).toBeNull();
  });
});
