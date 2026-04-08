// Tests for signup screen
// Covers: FR-AUTH-001
// ────────────────────────────────────────────────────────────

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: mockBack }),
  useSegments: () => [],
  useLocalSearchParams: () => ({}),
}));

const mockSignUp = jest.fn();
const mockClearError = jest.fn();
let mockAuthState: any = {
  signUp: mockSignUp,
  loading: false,
  error: null,
  clearError: mockClearError,
};
jest.mock('../../src/stores/authStore', () => ({
  useAuthStore: () => mockAuthState,
}));

import SignupScreen from '../../app/signup';

describe('SignupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState = {
      signUp: mockSignUp,
      loading: false,
      error: null,
      clearError: mockClearError,
    };
  });

  // FR-AUTH-001: renders display name, email, password inputs
  it('renders display name, email, and password inputs', () => {
    render(<SignupScreen />);
    expect(screen.getByPlaceholderText('Display Name')).toBeTruthy();
    expect(screen.getByPlaceholderText('Email')).toBeTruthy();
    expect(screen.getByPlaceholderText('Password')).toBeTruthy();
  });

  // FR-AUTH-001: renders Sign Up button
  it('renders Sign Up button', () => {
    render(<SignupScreen />);
    expect(screen.getByText('Sign Up')).toBeTruthy();
  });

  // FR-AUTH-001: calls signUp with display name, email, password
  it('calls signUp with all fields on submit', () => {
    render(<SignupScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Display Name'), 'Jane');
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'jane@test.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'secret123');
    fireEvent.press(screen.getByText('Sign Up'));
    expect(mockSignUp).toHaveBeenCalledWith('jane@test.com', 'secret123', 'Jane');
  });

  // FR-AUTH-001: shows loading state
  it('shows loading state during signup', () => {
    mockAuthState = { ...mockAuthState, loading: true };
    render(<SignupScreen />);
    expect(screen.getByText('Creating Account...')).toBeTruthy();
  });

  // FR-AUTH-001: displays error
  it('displays error when present', () => {
    mockAuthState = { ...mockAuthState, error: 'Email already in use' };
    render(<SignupScreen />);
    expect(screen.getByText('Email already in use')).toBeTruthy();
  });

  // FR-AUTH-001: link back to login
  it('renders link back to login', () => {
    render(<SignupScreen />);
    expect(screen.getByText(/Already have an account\? Sign In/i)).toBeTruthy();
  });

  // FR-AUTH-001: back link navigates back
  it('navigates back when Sign In link tapped', () => {
    render(<SignupScreen />);
    fireEvent.press(screen.getByText(/Already have an account\? Sign In/i));
    expect(mockBack).toHaveBeenCalled();
  });
});
