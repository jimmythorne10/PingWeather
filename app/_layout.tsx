import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/stores/authStore';
import { initializePurchases, loginPurchaseUser, logoutPurchaseUser } from '../src/services/purchases';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { session, profile, initialize } = useAuthStore();
  const [ready, setReady] = useState(false);

  // Initialize auth first, then RevenueCat.
  useEffect(() => {
    initialize().then(() => {
      setReady(true);
      // Initialize RevenueCat after auth is ready. Non-blocking — if the
      // API key isn't configured or the SDK fails, purchases simply stay
      // disabled and the app functions normally on the free tier.
      initializePurchases().catch(() => {});
    });
  }, []);

  // Sync RevenueCat identity with Supabase auth state.
  useEffect(() => {
    if (!ready) return;
    if (session?.user?.id) {
      loginPurchaseUser(session.user.id).catch(() => {});
    } else {
      logoutPurchaseUser().catch(() => {});
    }
  }, [ready, session?.user?.id]);

  useEffect(() => {
    if (!ready) return;

    const inAuthGroup =
      segments[0] === 'login' ||
      segments[0] === 'signup' ||
      segments[0] === 'forgot-password' ||
      segments[0] === 'reset-password';
    const inOnboarding = segments[0] === 'onboarding';
    // reset-password is special: the screen activates a recovery session via
    // supabase.auth.setSession, which flips `session` to truthy. Without this
    // guard, the "authed user in auth group → /" branch would redirect the
    // user off the screen before they set a new password.
    const inRecovery = segments[0] === 'reset-password';

    if (!session && !inAuthGroup) {
      router.replace('/login');
    } else if (
      session &&
      profile &&
      profile.onboarding_completed === false &&
      !inOnboarding &&
      !inRecovery
    ) {
      router.replace('/onboarding/welcome');
    } else if (
      session &&
      profile?.onboarding_completed === true &&
      (inAuthGroup || inOnboarding) &&
      !inRecovery
    ) {
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
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="create-rule" options={{ headerShown: true, title: 'Create Alert Rule' }} />
        <Stack.Screen name="day-detail" options={{ headerShown: true, title: 'Day Forecast' }} />
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
