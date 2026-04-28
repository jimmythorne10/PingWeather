// Tests for WalkthroughModal component
// Covers: FR-WALKTHROUGH-MODAL-001 through FR-WALKTHROUGH-MODAL-007

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { WalkthroughModal } from '../../src/components/WalkthroughModal';

jest.mock('../../src/theme', () => {
  const tokens: any = new Proxy({}, { get: () => '#000' });
  return { useTokens: () => tokens, useStyles: (factory: any) => factory(tokens) };
});

const STEPS_COUNT = 5;

const STEP_1_EMOJI = '🏠';
const STEP_1_TITLE = 'Your Home Dashboard';
const STEP_5_TITLE = "You'll Know When It Counts";

describe('WalkthroughModal', () => {
  // FR-WALKTHROUGH-MODAL-001: renders first step content when visible
  it('renders step 1 emoji, title, and body when visible', () => {
    const onDismiss = jest.fn();
    render(<WalkthroughModal visible={true} onDismiss={onDismiss} />);

    expect(screen.getByText(STEP_1_EMOJI)).toBeTruthy();
    expect(screen.getByText(STEP_1_TITLE)).toBeTruthy();
  });

  // FR-WALKTHROUGH-MODAL-002: Next button advances to next step
  it('Next button shows step 2 title after press', async () => {
    const onDismiss = jest.fn();
    render(<WalkthroughModal visible={true} onDismiss={onDismiss} />);

    fireEvent.press(screen.getByText('Next'));

    expect(screen.getByText('Add a Location First')).toBeTruthy();
  });

  // FR-WALKTHROUGH-MODAL-003: Skip button calls onDismiss
  it('Skip button calls onDismiss', () => {
    const onDismiss = jest.fn();
    render(<WalkthroughModal visible={true} onDismiss={onDismiss} />);

    fireEvent.press(screen.getByText('Skip'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  // FR-WALKTHROUGH-MODAL-004: last step shows Done button not Next
  it('shows Done button on last step', async () => {
    const onDismiss = jest.fn();
    render(<WalkthroughModal visible={true} onDismiss={onDismiss} />);

    // Advance through all steps to reach step 4 (last)
    for (let i = 0; i < STEPS_COUNT - 1; i++) {
      fireEvent.press(screen.getByText('Next'));
    }

    expect(screen.getByText('Done')).toBeTruthy();
    expect(screen.queryByText('Next')).toBeNull();
  });

  // FR-WALKTHROUGH-MODAL-005: Done on last step calls onDismiss
  it('Done button on last step calls onDismiss', async () => {
    const onDismiss = jest.fn();
    render(<WalkthroughModal visible={true} onDismiss={onDismiss} />);

    for (let i = 0; i < STEPS_COUNT - 1; i++) {
      fireEvent.press(screen.getByText('Next'));
    }

    fireEvent.press(screen.getByText('Done'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  // FR-WALKTHROUGH-MODAL-006: step dots count matches steps length
  it('renders correct number of step dots', () => {
    const onDismiss = jest.fn();
    render(<WalkthroughModal visible={true} onDismiss={onDismiss} />);

    // Step dots are rendered as Views with testID 'step-dot'
    const dots = screen.getAllByTestId('step-dot');
    expect(dots).toHaveLength(STEPS_COUNT);
  });

  // FR-WALKTHROUGH-MODAL-007: does not render Skip on last step
  it('does not show Skip on last step', async () => {
    const onDismiss = jest.fn();
    render(<WalkthroughModal visible={true} onDismiss={onDismiss} />);

    for (let i = 0; i < STEPS_COUNT - 1; i++) {
      fireEvent.press(screen.getByText('Next'));
    }

    expect(screen.queryByText('Skip')).toBeNull();
  });
});
