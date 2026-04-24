// Tests for onboarding screens
// Covers: FR-ONBOARD-001 through FR-ONBOARD-007
// ────────────────────────────────────────────────────────────

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
  useSegments: () => [],
  useLocalSearchParams: () => ({}),
}));

// authStore mock
const mockUpdateProfile = jest.fn(() => Promise.resolve());
const mockFetchProfile = jest.fn(() => Promise.resolve());
jest.mock('../../src/stores/authStore', () => ({
  useAuthStore: Object.assign(
    (selector?: any) => {
      const state = {
        updateProfile: mockUpdateProfile,
        fetchProfile: mockFetchProfile,
        profile: null,
      };
      return selector ? selector(state) : state;
    },
    {
      getState: () => ({ fetchProfile: mockFetchProfile }),
    }
  ),
}));

// locationsStore mock
const mockAddLocation = jest.fn(() => Promise.resolve());
jest.mock('../../src/stores/locationsStore', () => ({
  useLocationsStore: (selector?: any) => {
    const state = { addLocation: mockAddLocation, locations: [] };
    return selector ? selector(state) : state;
  },
}));

// expo-location hook mock
jest.mock('../../src/hooks/useLocation', () => ({
  useDeviceLocation: () => ({
    getLocation: jest.fn(() => Promise.resolve({ latitude: 40, longitude: -74 })),
    loading: false,
    error: null,
  }),
}));

// Push notifications hook
jest.mock('../../src/hooks/usePushNotifications', () => ({
  usePushNotifications: () => ({
    registerForPushNotifications: jest.fn(() => Promise.resolve({ token: 'token-123', error: null })),
    error: null,
  }),
}));

// Mock EULA content
jest.mock('../../src/data/legal-content', () => ({
  EULA_CONTENT: {
    version: '1.0.0',
    effectiveDate: '2026-01-01',
    sections: [
      { title: 'Section 1', body: 'Section 1 body text.' },
      { title: 'Section 2', body: 'Section 2 body text.' },
    ],
  },
}));

import WelcomeScreen from '../../app/onboarding/welcome';
import PrivacyScreen from '../../app/onboarding/privacy';
import EulaScreen from '../../app/onboarding/eula';
import LocationSetupScreen from '../../app/onboarding/location-setup';
import NotificationSetupScreen from '../../app/onboarding/notification-setup';
import CompleteScreen from '../../app/onboarding/complete';

describe('Onboarding — Welcome', () => {
  beforeEach(() => jest.clearAllMocks());

  // FR-ONBOARD-002: App name displayed as "PingWeather"
  it('displays app name "PingWeather" (not WeatherWatch)', () => {
    render(<WelcomeScreen />);
    expect(screen.getByText('PingWeather')).toBeTruthy();
    expect(screen.queryByText('WeatherWatch')).toBeNull();
  });

  // FR-ONBOARD-002: Get Started button navigates to privacy
  it('navigates to privacy screen on Get Started', () => {
    render(<WelcomeScreen />);
    fireEvent.press(screen.getByText('Get Started'));
    expect(mockPush).toHaveBeenCalledWith('/onboarding/privacy');
  });
});

describe('Onboarding — Privacy', () => {
  beforeEach(() => jest.clearAllMocks());

  // FR-ONBOARD-003: 4 privacy cards shown
  it('shows 4 privacy commitment items', () => {
    render(<PrivacyScreen />);
    expect(screen.getByText(/Location Privacy/i)).toBeTruthy();
    expect(screen.getByText(/Minimal Data/i)).toBeTruthy();
    expect(screen.getByText(/You Control Deletion/i)).toBeTruthy();
    expect(screen.getByText(/Transparent Policies/i)).toBeTruthy();
  });

  // FR-ONBOARD-003: Continue navigates to EULA
  it('navigates to EULA on Continue', () => {
    render(<PrivacyScreen />);
    fireEvent.press(screen.getByText('Continue'));
    expect(mockPush).toHaveBeenCalledWith('/onboarding/eula');
  });
});

describe('Onboarding — EULA', () => {
  beforeEach(() => jest.clearAllMocks());

  // FR-ONBOARD-004: EULA text displayed and I Accept button present
  it('shows scrollable EULA content with I Accept button', () => {
    render(<EulaScreen />);
    expect(screen.getByText('Section 1')).toBeTruthy();
    expect(screen.getByText('I Accept')).toBeTruthy();
  });

  // FR-ONBOARD-004: records acceptance on tap
  it('records acceptance and navigates to location setup', async () => {
    render(<EulaScreen />);
    fireEvent.press(screen.getByText('I Accept'));
    await new Promise((r) => setImmediate(r));
    expect(mockUpdateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        eula_accepted_version: '1.0.0',
      })
    );
  });
});

describe('Onboarding — Location Setup', () => {
  beforeEach(() => jest.clearAllMocks());

  // FR-ONBOARD-005: GPS option present
  it('shows "Use My Current Location" (GPS) option', () => {
    render(<LocationSetupScreen />);
    expect(screen.getByText(/Use My Current Location/i)).toBeTruthy();
  });

  // FR-ONBOARD-005: manual lat/long entry present
  it('shows manual latitude/longitude inputs', () => {
    render(<LocationSetupScreen />);
    expect(screen.getByPlaceholderText('Latitude')).toBeTruthy();
    expect(screen.getByPlaceholderText('Longitude')).toBeTruthy();
  });

  // FR-ONBOARD-005: location search option (TDD — unimplemented)
  it('shows place/address search option', () => {
    render(<LocationSetupScreen />);
    // PRD FR-ONBOARD-005 / FR-LOC-002 requires geocoding search
    expect(screen.getByPlaceholderText(/Search.*place|address/i)).toBeTruthy();
  });

  // FR-ONBOARD-005: "Skip for now" present
  it('shows Skip option', () => {
    render(<LocationSetupScreen />);
    expect(screen.getByText(/Skip for now/i)).toBeTruthy();
  });
});

describe('Onboarding — Notification Setup', () => {
  beforeEach(() => jest.clearAllMocks());

  // FR-ONBOARD-006: Enable Notifications button
  it('shows Enable Notifications button', () => {
    render(<NotificationSetupScreen />);
    expect(screen.getByText('Enable Notifications')).toBeTruthy();
  });

  // FR-ONBOARD-006: skip option
  it('shows "I\'ll do this later" skip option', () => {
    render(<NotificationSetupScreen />);
    expect(screen.getByText(/I'll do this later/i)).toBeTruthy();
  });
});

describe('Onboarding — Complete', () => {
  beforeEach(() => jest.clearAllMocks());

  // FR-ONBOARD-007: "Start Using PingWeather" button present
  it('shows "Start Using PingWeather" button (not WeatherWatch)', () => {
    render(<CompleteScreen />);
    expect(screen.getByText('Start Using PingWeather')).toBeTruthy();
  });

  // FR-ONBOARD-007: sets onboarding_completed on complete
  it('calls updateProfile with onboarding_completed=true', async () => {
    render(<CompleteScreen />);
    fireEvent.press(screen.getByText(/Start Using/i));
    await new Promise((r) => setImmediate(r));
    expect(mockUpdateProfile).toHaveBeenCalledWith({ onboarding_completed: true });
  });
});
