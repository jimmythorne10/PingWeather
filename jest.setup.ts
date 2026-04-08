// Global Jest setup for PingWeather
// Mocks native modules that don't work in the Jest environment.
//
// IMPORTANT: This file runs before each test file loads. Mocks declared here
// apply to all tests. Individual tests can override specific mock methods via
// `(mockedMethod as jest.Mock).mockResolvedValue(...)`.

// ── AsyncStorage ────────────────────────────────────────────────
jest.mock('@react-native-async-storage/async-storage', () => {
  const storage = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key: string) => Promise.resolve(storage.get(key) ?? null)),
      setItem: jest.fn((key: string, value: string) => {
        storage.set(key, value);
        return Promise.resolve();
      }),
      removeItem: jest.fn((key: string) => {
        storage.delete(key);
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        storage.clear();
        return Promise.resolve();
      }),
      multiGet: jest.fn(() => Promise.resolve([])),
      multiSet: jest.fn(() => Promise.resolve()),
      getAllKeys: jest.fn(() => Promise.resolve(Array.from(storage.keys()))),
    },
  };
});

// ── Expo SecureStore ────────────────────────────────────────────
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// ── Expo Constants ──────────────────────────────────────────────
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: { eas: { projectId: 'test-project' } } },
  },
  expoConfig: { extra: { eas: { projectId: 'test-project' } } },
}));

// ── Expo Location ───────────────────────────────────────────────
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(() =>
    Promise.resolve({ coords: { latitude: 30.2672, longitude: -97.7431 } })
  ),
  Accuracy: { Balanced: 3, High: 4, Highest: 5 },
}));

// ── Expo Notifications ──────────────────────────────────────────
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(() =>
    Promise.resolve({ data: 'ExponentPushToken[test]' })
  ),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { MAX: 5, HIGH: 4, DEFAULT: 3, LOW: 2, MIN: 1 },
}));

// ── Expo Router ─────────────────────────────────────────────────
jest.mock('expo-router', () => {
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
  };
  return {
    useRouter: () => router,
    useSegments: () => [],
    useLocalSearchParams: () => ({}),
    useFocusEffect: jest.fn(),
    router,
    Stack: ({ children }: { children?: unknown }) => children ?? null,
    Tabs: ({ children }: { children?: unknown }) => children ?? null,
    Slot: () => null,
    Link: ({ children }: { children?: unknown }) => children ?? null,
    Redirect: () => null,
  };
});

// ── Expo Status Bar ─────────────────────────────────────────────
jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

// ── react-native-url-polyfill ───────────────────────────────────
jest.mock('react-native-url-polyfill/auto', () => ({}), { virtual: true });

// ── Supabase ────────────────────────────────────────────────────
// Uses a singleton client — all tests share the same mock instance.
// Access via: `import { supabase } from 'src/utils/supabase'` then
// `(supabase.auth.signUp as jest.Mock).mockResolvedValue(...)`.
jest.mock('@supabase/supabase-js', () => {
  // Chainable query builder — each call returns `this` so `.from().select().eq().single()` works
  const createQueryBuilder = () => {
    const builder: any = {};
    const chainMethods = [
      'select', 'insert', 'update', 'upsert', 'delete',
      'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike',
      'in', 'is', 'or', 'and', 'not', 'filter',
      'order', 'limit', 'range', 'abortSignal',
    ];
    chainMethods.forEach((m) => {
      builder[m] = jest.fn(() => builder);
    });
    // Terminal methods return promises (default: empty success)
    builder.single = jest.fn(() => Promise.resolve({ data: null, error: null }));
    builder.maybeSingle = jest.fn(() => Promise.resolve({ data: null, error: null }));
    // Make the builder thenable so `await supabase.from(...).select(...)` works
    builder.then = jest.fn((onResolve: any) =>
      Promise.resolve({ data: [], error: null }).then(onResolve)
    );
    return builder;
  };

  // Singleton client — createClient always returns the same object
  const client = {
    from: jest.fn(() => createQueryBuilder()),
    auth: {
      getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      getUser: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      signUp: jest.fn(() =>
        Promise.resolve({ data: { user: null, session: null }, error: null })
      ),
      signInWithPassword: jest.fn(() =>
        Promise.resolve({ data: { user: null, session: null }, error: null })
      ),
      signOut: jest.fn(() => Promise.resolve({ error: null })),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      resetPasswordForEmail: jest.fn(() => Promise.resolve({ data: {}, error: null })),
    },
    functions: {
      invoke: jest.fn(() => Promise.resolve({ data: null, error: null })),
    },
    // Expose helper for tests to install `.from()` chain responses
    __setFromResponse: (data: unknown, error: unknown = null) => {
      client.from.mockReturnValue({
        ...createQueryBuilder(),
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data, error }),
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data, error }),
            }),
          }),
          order: jest.fn().mockResolvedValue({ data, error }),
          limit: jest.fn().mockResolvedValue({ data, error }),
        }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data, error }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data, error }),
            }),
          }),
        }),
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data, error }),
        }),
      });
    },
  };

  return {
    createClient: jest.fn(() => client),
  };
});
