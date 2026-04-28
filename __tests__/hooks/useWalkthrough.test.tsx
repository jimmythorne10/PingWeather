// Tests for useWalkthrough hook
// Covers: FR-WALKTHROUGH-HOOK-001 through FR-WALKTHROUGH-HOOK-005

import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWalkthrough } from '../../src/hooks/useWalkthrough';

const SEEN_KEY = 'pingweather-walkthrough-seen';

beforeEach(() => {
  jest.clearAllMocks();
  (AsyncStorage.clear as jest.Mock).mockClear();
  // Reset storage state between tests
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
});

// FR-WALKTHROUGH-HOOK-001: auto-show when key not set
it('auto-shows when AsyncStorage key is not set', async () => {
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

  const { result } = renderHook(() => useWalkthrough({ autoShow: true }));

  // Initially false before the async effect resolves
  expect(result.current.visible).toBe(false);

  await act(async () => {
    await Promise.resolve();
  });

  expect(AsyncStorage.getItem).toHaveBeenCalledWith(SEEN_KEY);
  expect(result.current.visible).toBe(true);
});

// FR-WALKTHROUGH-HOOK-002: does NOT auto-show when key is already set
it('does not auto-show when AsyncStorage key is already set', async () => {
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue('true');

  const { result } = renderHook(() => useWalkthrough({ autoShow: true }));

  await act(async () => {
    await Promise.resolve();
  });

  expect(AsyncStorage.getItem).toHaveBeenCalledWith(SEEN_KEY);
  expect(result.current.visible).toBe(false);
});

// FR-WALKTHROUGH-HOOK-003: show() sets visible true regardless of AsyncStorage
it('show() makes visible true', () => {
  const { result } = renderHook(() => useWalkthrough());

  expect(result.current.visible).toBe(false);

  act(() => {
    result.current.show();
  });

  expect(result.current.visible).toBe(true);
});

// FR-WALKTHROUGH-HOOK-004: dismiss() sets visible false and writes AsyncStorage
it('dismiss() hides modal and writes seen key', async () => {
  const { result } = renderHook(() => useWalkthrough());

  act(() => {
    result.current.show();
  });
  expect(result.current.visible).toBe(true);

  await act(async () => {
    await result.current.dismiss();
  });

  expect(result.current.visible).toBe(false);
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(SEEN_KEY, 'true');
});

// FR-WALKTHROUGH-HOOK-005: auto-show is false by default
it('does not auto-show by default (autoShow not passed)', async () => {
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

  const { result } = renderHook(() => useWalkthrough());

  await act(async () => {
    await Promise.resolve();
  });

  // getItem should NOT have been called (autoShow=false by default)
  expect(AsyncStorage.getItem).not.toHaveBeenCalled();
  expect(result.current.visible).toBe(false);
});
