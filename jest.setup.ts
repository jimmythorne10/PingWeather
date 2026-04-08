// Global Jest setup for PingWeather
// Mocks native modules that don't work in the Jest environment.

// AsyncStorage — use the official mock
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Expo SecureStore
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// Expo Constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      eas: { projectId: 'test-project' },
    },
  },
}));

// Expo Notifications (lazy-loaded in app, but still needs a mock if imported)
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ data: 'ExponentPushToken[test]' })),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { MAX: 5, HIGH: 4, DEFAULT: 3, LOW: 2, MIN: 1 },
}), { virtual: true });

// Expo Location
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(() => Promise.resolve({
    coords: { latitude: 30.2672, longitude: -97.7431 },
  })),
  Accuracy: { Balanced: 3, High: 4, Highest: 5 },
}));

// Expo Router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
  }),
  useSegments: () => [],
  useLocalSearchParams: () => ({}),
  useFocusEffect: jest.fn(),
  Stack: ({ children }: { children?: React.ReactNode }) => children,
  Tabs: ({ children }: { children?: React.ReactNode }) => children,
  Slot: () => null,
  Link: ({ children }: { children?: React.ReactNode }) => children,
  Redirect: () => null,
}));

// Expo Status Bar
jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

// Supabase client — provide a chainable mock
jest.mock('@supabase/supabase-js', () => {
  const createChainable = () => {
    const chain: any = {};
    const methods = ['from', 'select', 'insert', 'update', 'delete', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'order', 'limit', 'single', 'maybeSingle'];
    methods.forEach((m) => {
      chain[m] = jest.fn(() => chain);
    });
    // Terminal methods return promises
    chain.single = jest.fn(() => Promise.resolve({ data: null, error: null }));
    chain.maybeSingle = jest.fn(() => Promise.resolve({ data: null, error: null }));
    // Non-terminal returns are also thenable (Supabase returns promise-like chains)
    chain.then = jest.fn((onResolve) => Promise.resolve({ data: [], error: null }).then(onResolve));
    return chain;
  };

  return {
    createClient: jest.fn(() => ({
      from: jest.fn(() => createChainable()),
      auth: {
        getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
        signUp: jest.fn(() => Promise.resolve({ data: { user: null, session: null }, error: null })),
        signInWithPassword: jest.fn(() => Promise.resolve({ data: { user: null, session: null }, error: null })),
        signOut: jest.fn(() => Promise.resolve({ error: null })),
        onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
        resetPasswordForEmail: jest.fn(() => Promise.resolve({ data: {}, error: null })),
      },
      functions: {
        invoke: jest.fn(() => Promise.resolve({ data: null, error: null })),
      },
    })),
  };
});

// react-native-url-polyfill (side-effect import)
jest.mock('react-native-url-polyfill/auto', () => ({}));
