// Tests for login screen
// Covers: FR-AUTH-001, FR-AUTH-002, FR-AUTH-004
// ────────────────────────────────────────────────────────────

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';

// Mock expo-router
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
  useSegments: () => [],
  useLocalSearchParams: () => ({}),
}));

// Mock authStore
const mockSignIn = jest.fn();
const mockClearError = jest.fn();
let mockAuthState: any = {
  signIn: mockSignIn,
  loading: false,
  error: null,
  clearError: mockClearError,
};
jest.mock('../../src/stores/authStore', () => ({
  useAuthStore: () => mockAuthState,
}));

import LoginScreen from '../../app/login';

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState = {
      signIn: mockSignIn,
      loading: false,
      error: null,
      clearError: mockClearError,
    };
  });

  // FR-AUTH-002: renders email and password inputs
  it('renders email and password inputs', () => {
    render(<LoginScreen />);
    expect(screen.getByPlaceholderText('Email')).toBeTruthy();
    expect(screen.getByPlaceholderText('Password')).toBeTruthy();
  });

  // FR-AUTH-002: renders Sign In button
  it('renders Sign In button', () => {
    render(<LoginScreen />);
    expect(screen.getByText('Sign In')).toBeTruthy();
  });

  // FR-AUTH-004: Forgot Password link is visible on login screen
  it('renders "Forgot Password?" link', () => {
    render(<LoginScreen />);
    // TDD: this feature is unimplemented and expected to fail
    expect(screen.getByText(/Forgot Password/i)).toBeTruthy();
  });

  // FR-AUTH-001: link to signup screen exists
  it('renders "Don\'t have an account?" link to signup', () => {
    render(<LoginScreen />);
    expect(screen.getByText(/Don't have an account\? Sign Up/i)).toBeTruthy();
  });

  // FR-AUTH-001: navigates to signup when link tapped
  it('navigates to /signup when Sign Up link is tapped', () => {
    render(<LoginScreen />);
    fireEvent.press(screen.getByText(/Don't have an account\? Sign Up/i));
    expect(mockPush).toHaveBeenCalledWith('/signup');
  });

  // FR-AUTH-002: calls signIn with email and password on submit
  it('calls signIn on Sign In press', () => {
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'user@test.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'password123');
    fireEvent.press(screen.getByText('Sign In'));
    expect(mockSignIn).toHaveBeenCalledWith('user@test.com', 'password123');
  });

  // FR-AUTH-002: shows loading state during authentication
  it('shows loading state during sign in', () => {
    mockAuthState = { ...mockAuthState, loading: true };
    render(<LoginScreen />);
    expect(screen.getByText('Signing in...')).toBeTruthy();
  });

  // FR-AUTH-002: displays error message
  it('displays error message when error is set', () => {
    mockAuthState = { ...mockAuthState, error: 'Invalid credentials' };
    render(<LoginScreen />);
    expect(screen.getByText('Invalid credentials')).toBeTruthy();
  });
});
