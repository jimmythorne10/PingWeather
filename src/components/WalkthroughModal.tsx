import React, { useState, useEffect } from 'react';
import { Modal, View, Text, Pressable, useWindowDimensions } from 'react-native';
import { useStyles, useTokens } from '../theme';
import { useLook } from '../theme/useStyles';
import type { LookTokens } from '../theme/looks';
import type { ThemeTokens } from '../theme';

const STEPS = [
  {
    emoji: '🏠',
    title: 'Your Home Dashboard',
    body: "Once you've created alert rules, you'll see their status here — active alerts, recent notifications, and a live forecast for your location.",
  },
  {
    emoji: '📍',
    title: 'Add a Location First',
    body: "Before building an alert, you need at least one saved location. Tap the Locations tab to add your home, property, or any place you want to monitor.",
  },
  {
    emoji: '🔔',
    title: 'Your Alert Rules',
    body: "The Alerts tab is where rules live. Presets like 'Freeze Warning' get you started fast — just pick your location and tap confirm.",
  },
  {
    emoji: '⚙️',
    title: 'Build a Custom Alert',
    body: "For anything more specific, tap 'Build Custom Alert Rule.' Pick a weather metric, set your threshold — like rain chance below 20% — and choose how far ahead to look.",
  },
  {
    emoji: '📅',
    title: 'Drill Into Your Forecast',
    body: 'Tap any day in your forecast to see a full 24-hour breakdown — hourly temperature, rain chance, wind, and more.',
  },
  {
    emoji: '📱',
    title: "You'll Know When It Counts",
    body: "When your conditions are met, you get a push notification instantly — no need to check the app. Set it once and let WeatherBeacon watch for you.",
  },
];

interface WalkthroughModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export function WalkthroughModal({ visible, onDismiss }: WalkthroughModalProps) {
  const styles = useStyles(createStyles);
  const t = useTokens();
  const look = useLook();
  const [step, setStep] = useState(0);
  const { width: screenWidth } = useWindowDimensions();
  // 48 is exact under aurora: spacing.xxxl. `maxWidth` isn't a scanned
  // property, but the input to the computation tokenises cleanly, so it does.
  const cardMaxWidth = Math.min(screenWidth - look.spacing.xxxl, 480);

  useEffect(() => {
    if (!visible) {
      setStep(0);
    }
  }, [visible]);

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  const handleNext = () => {
    if (isLast) {
      onDismiss();
    } else {
      setStep((s) => s + 1);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      presentationStyle="overFullScreen"
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: t.card, maxWidth: cardMaxWidth }]}>
          <Text style={styles.emoji}>{current.emoji}</Text>

          <Text style={[styles.title, { color: t.textPrimary }]}>{current.title}</Text>

          <Text style={[styles.body, { color: t.textSecondary }]}>{current.body}</Text>

          <View style={styles.dotsRow}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                testID="step-dot"
                style={[styles.dot, { backgroundColor: i === step ? t.primary : t.borderLight }]}
              />
            ))}
          </View>

          <Pressable style={[styles.nextButton, { backgroundColor: t.primary }]} onPress={handleNext}>
            <Text style={[styles.nextButtonText, { color: t.textOnPrimary }]}>
              {isLast ? 'Done' : 'Next'}
            </Text>
          </Pressable>

          {!isLast && (
            <Pressable style={styles.skipButton} onPress={onDismiss}>
              <Text style={[styles.skipText, { color: t.textTertiary }]}>Skip</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (t: ThemeTokens, look: LookTokens) => ({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: look.spacing.xl,
  },
  card: {
    borderRadius: look.radius.surface,
    // 28 has no single spacing step (xl=24, xxl=32) but composes exactly,
    // same technique as the xxxl+md / xxxl+xxl precedent set in TASK-005/006.
    padding: look.spacing.xl + look.spacing.xs,
    width: '100%' as const,
  },
  emoji: {
    fontSize: look.typography.display.size,
    textAlign: 'center' as const,
    marginBottom: look.spacing.lg,
  },
  title: {
    fontSize: look.typography.heading.size,
    fontWeight: look.typography.heading.weight,
    textAlign: 'center' as const,
    marginBottom: look.spacing.md,
  },
  body: {
    fontSize: look.typography.body.size,
    lineHeight: look.typography.body.lineHeight,
    textAlign: 'center' as const,
    marginBottom: look.spacing.xl + look.spacing.xs,
  },
  dotsRow: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    gap: look.spacing.sm,
    marginBottom: look.spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    // Renders as a full circle at any radius >= half the dimension (RN
    // clamps), so the surface token is visually identical to the old 4.
    borderRadius: look.radius.surface,
  },
  nextButton: {
    // 14 snapped to lg (16) — see ErrorBoundary for the rationale.
    paddingVertical: look.spacing.lg,
    borderRadius: look.radius.surface,
    alignItems: 'center' as const,
  },
  nextButtonText: {
    fontSize: look.typography.heading.size,
    fontWeight: look.typography.heading.weight,
  },
  skipButton: {
    // 14 snapped to lg (16), same rationale as nextButton above.
    paddingTop: look.spacing.lg,
    alignItems: 'center' as const,
  },
  skipText: {
    fontSize: look.typography.body.size,
  },
});
