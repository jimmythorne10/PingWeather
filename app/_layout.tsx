import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';
import { useThemeStore } from '../src/stores/themeStore';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { session, profile, initialized, initialize } = useAuthStore();
  const tokens = useThemeStore((s) => s.tokens);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initialize().then(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'signup';
    const inOnboarding = segments[0] === 'onboarding';

    if (!session && !inAuthGroup) {
      router.replace('/login');
    } else if (session && profile && !profile.onboarding_completed && !inOnboarding) {
      router.replace('/onboarding/welcome');
    } else if (session && profile?.onboarding_completed && (inAuthGroup || inOnboarding)) {
      router.replace('/(tabs)');
    }
  }, [ready, session, profile, segments]);

  if (!ready) {
    return (
      <View style={[styles.loading, { backgroundColor: tokens.background }]}>
        <ActivityIndicator size="large" color={tokens.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={tokens.statusBarStyle} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: tokens.headerBackground },
          headerTintColor: tokens.headerTint,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: tokens.background },
        }}
      >
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="legal/eula" options={{ title: 'Terms of Use' }} />
        <Stack.Screen name="legal/privacy-policy" options={{ title: 'Privacy Policy' }} />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
