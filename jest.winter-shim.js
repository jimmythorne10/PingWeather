// Runs BEFORE jest-expo preset loads expo.
// Stubs expo/src/winter/runtime.native to prevent the lazy polyfill
// installation from trying to require files outside the test scope.
//
// Background: expo's winter runtime installs TextDecoder/URL/etc as lazy
// global getters. In Jest, accessing those globals triggers require() on
// files inside expo/src/winter/ which Jest's sandbox blocks with the error
// "You are trying to import a file outside of the scope of the test code".

jest.mock('expo/src/winter/runtime.native', () => ({}), { virtual: true });
jest.mock('expo/build/winter/runtime.native', () => ({}), { virtual: true });
jest.mock('expo/src/winter/installGlobal', () => ({
  installGlobal: () => {},
}), { virtual: true });
jest.mock('expo/build/winter/installGlobal', () => ({
  installGlobal: () => {},
}), { virtual: true });
jest.mock('expo/src/winter', () => ({}), { virtual: true });
jest.mock('expo/build/winter', () => ({}), { virtual: true });
