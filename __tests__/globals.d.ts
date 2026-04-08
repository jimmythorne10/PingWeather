// Global test helper type declarations
// These functions are injected into globalThis via jest.setup.ts and used
// across test files without explicit imports.

import type { WatchLocation, AlertRule, Profile } from '../src/types';

declare global {
  function mockProfile(overrides?: Partial<Profile>): Profile;
  function mockLocation(overrides?: Partial<WatchLocation>): WatchLocation;
  function mockRule(overrides?: Partial<AlertRule>): AlertRule;
}
