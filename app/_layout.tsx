import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/stores/authStore';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { session, profile, initialize } = useAuthStore();
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
    } else if (session && profile && profile.onboarding_completed === false && !inOnboarding) {
      router.replace('/onboarding/welcome');
    } else if (session && profile?.onboarding_completed === true && (inAuthGroup || inOnboarding)) {
      router.replace('/');
    }
  }, [ready, session, profile, segments]);

  if (!ready) {
    return (
      <SafeAreaProvider>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#1E3A5F" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="create-rule" options={{ headerShown: true, title: 'Create Alert Rule' }} />
        <Stack.Screen name="upgrade" options={{ headerShown: true, title: 'Upgrade', presentation: 'modal' }} />
        <Stack.Screen name="legal/eula" options={{ headerShown: true, title: 'Terms of Use' }} />
        <Stack.Screen name="legal/privacy-policy" options={{ headerShown: true, title: 'Privacy Policy' }} />
      </Stack>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F4F8',
  },
});
