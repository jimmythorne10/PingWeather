const noop = () => null;
const router = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  navigate: jest.fn(),
};
module.exports = {
  useRouter: () => router,
  useSegments: () => [],
  useLocalSearchParams: () => ({}),
  useFocusEffect: jest.fn(),
  Stack: noop,
  Tabs: noop,
  Slot: noop,
  Link: noop,
  Redirect: noop,
  router,
};
