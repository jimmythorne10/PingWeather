import React, { useState, useEffect } from 'react';
import { Modal, View, Text, Pressable } from 'react-native';
import { useTokens } from '../theme';

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
    emoji: '📱',
    title: "You'll Know When It Counts",
    body: "When your conditions are met, you get a push notification instantly — no need to check the app. Set it once and let PingWeather watch for you.",
  },
];

interface WalkthroughModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export function WalkthroughModal({ visible, onDismiss }: WalkthroughModalProps) {
  const t = useTokens();
  const [step, setStep] = useState(0);

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
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}
      >
        <View
          style={{
            backgroundColor: t.card,
            borderRadius: 16,
            padding: 28,
            width: '100%',
            maxWidth: 360,
          }}
        >
          <Text style={{ fontSize: 52, textAlign: 'center', marginBottom: 16 }}>
            {current.emoji}
          </Text>

          <Text
            style={{
              fontSize: 22,
              fontWeight: '700',
              color: t.textPrimary,
              textAlign: 'center',
              marginBottom: 12,
            }}
          >
            {current.title}
          </Text>

          <Text
            style={{
              fontSize: 15,
              color: t.textSecondary,
              lineHeight: 22,
              textAlign: 'center',
              marginBottom: 28,
            }}
          >
            {current.body}
          </Text>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 24,
            }}
          >
            {STEPS.map((_, i) => (
              <View
                key={i}
                testID="step-dot"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: i === step ? t.primary : t.borderLight,
                }}
              />
            ))}
          </View>

          <Pressable
            style={{
              backgroundColor: t.primary,
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: 'center',
            }}
            onPress={handleNext}
          >
            <Text style={{ color: t.textOnPrimary, fontSize: 16, fontWeight: '700' }}>
              {isLast ? 'Done' : 'Next'}
            </Text>
          </Pressable>

          {!isLast && (
            <Pressable
              style={{ paddingTop: 14, alignItems: 'center' }}
              onPress={onDismiss}
            >
              <Text style={{ color: t.textTertiary, fontSize: 14 }}>Skip</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}
