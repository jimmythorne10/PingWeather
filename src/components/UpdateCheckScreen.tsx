import { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, StyleSheet } from 'react-native';

// ─────────────────────────────────────────────────────────────
// UpdateCheckScreen
//
// Shown while expo-updates checks for / downloads an OTA bundle.
// Replaces the generic ActivityIndicator with a branded screen
// that matches the splash screen (same #1E3A5F background) so
// there's visual continuity from app open → first interactive
// screen. Uses only React Native Animated — no third-party libs.
// ─────────────────────────────────────────────────────────────

export type UpdateStatus = 'checking' | 'downloading' | 'upToDate';

interface UpdateCheckScreenProps {
  status: UpdateStatus;
}

const STATUS_LABELS: Record<UpdateStatus, string> = {
  checking: 'Checking for updates...',
  downloading: 'Downloading update...',
  upToDate: 'Up to date',
};

export function UpdateCheckScreen({ status }: UpdateCheckScreenProps) {
  // Pulse ring: opacity oscillates 0.25 → 0.7 → 0.25 on a 1.4-second loop.
  // During 'downloading' the animation speeds up slightly to signal activity.
  const pulseAnim = useRef(new Animated.Value(0.25)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const duration = status === 'downloading' ? 900 : 1400;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 0.7,
            duration: duration / 2,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1.12,
            duration: duration / 2,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 0.25,
            duration: duration / 2,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: duration / 2,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [pulseAnim, scaleAnim, status]);

  return (
    <View style={styles.container}>
      {/* Animated pulse ring sits behind the icon */}
      <View style={styles.iconWrapper}>
        <Animated.View
          style={[
            styles.pulseRing,
            {
              opacity: pulseAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        />
        <Image
          // Path is relative to where this component lives: src/components/
          // Two levels up reaches the project root where assets/ lives.
          source={require('../../assets/icon.png')}
          style={styles.icon}
          resizeMode="contain"
        />
      </View>

      <Text style={styles.appName}>PingWeather</Text>
      <Text style={styles.statusText}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Brand navy — matches splash screen backgroundColor so there's no
    // jarring color flash between the native splash and this JS screen.
    backgroundColor: '#1E3A5F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapper: {
    // Position: relative so the pulse ring can be absolutely stacked
    // behind the icon using negative margin trick (simpler than zIndex
    // games and works cleanly with useNativeDriver: true).
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  pulseRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    // Semi-transparent white ring — subtle, doesn't fight the icon
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  icon: {
    width: 80,
    height: 80,
    borderRadius: 18,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '400',
    // Slightly dimmed so it reads as secondary info, not competing with appName
    color: 'rgba(255, 255, 255, 0.75)',
    letterSpacing: 0.2,
  },
});
