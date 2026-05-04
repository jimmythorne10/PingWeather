import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import { useAuthStore } from '../src/stores/authStore';
import { initializePurchases, loginPurchaseUser, logoutPurchaseUser } from '../src/services/purchases';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { UpdateCheckScreen, type UpdateStatus } from '../src/components/UpdateCheckScreen';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { session, profile, initialize } = useAuthStore();
  const [ready, setReady] = useState(false);

  // 'idle'      — update check not started or already complete (render children)
  // 'checking'  — awaiting checkForUpdateAsync response
  // 'downloading' — update found, fetchUpdateAsync in progress
  // 'upToDate'  — no update available, brief pause before dismissing
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | 'idle'>('idle');

  // ─── OTA update check ────────────────────────────────────────────────────
  // Runs first on mount, before auth, so the branded screen appears
  // immediately and there is no generic-spinner flash.
  //
  // Why NOT inside Promise.all with initialize():
  //   Putting it alongside auth hid the branded UI behind the generic
  //   ActivityIndicator and offered no way to distinguish "checking for
  //   update" from "loading auth state".
  //
  // Why checkAutomatically = "NEVER" in app.json:
  //   With automatic checking enabled, Expo's own update poller could race
  //   this manual check and either duplicate the work or reload mid-session.
  //   Manual-only gives us full control over when and how the user is informed.
  useEffect(() => {
    async function checkForOTAUpdate() {
      // expo-updates throws in dev mode because there is no update server.
      // Guard here so the app doesn't error out during local development.
      if (__DEV__) return;

      try {
        setUpdateStatus('checking');

        // 5-second timeout: on low signal checkForUpdateAsync can hang.
        // We race it against a rejection so the user isn't stuck on this
        // screen if the network is slow or offline.
        const checkPromise = Updates.checkForUpdateAsync();
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 5000),
        );
        const update = await Promise.race([checkPromise, timeoutPromise]);

        if (update.isAvailable) {
          setUpdateStatus('downloading');
          await Updates.fetchUpdateAsync();
          // reloadAsync() restarts the JS runtime entirely — nothing after
          // this line will ever execute in this session.
          await Updates.reloadAsync();
        } else {
          setUpdateStatus('upToDate');
          // Brief pause so the screen doesn't flash — gives users a moment
          // to read "Up to date" before the app continues loading.
          await new Promise<void>((resolve) => setTimeout(resolve, 800));
          setUpdateStatus('idle');
        }
      } catch {
        // Network error, timeout, no server in __DEV__ (shouldn't reach here),
        // or any other unexpected failure — always fall through so the app
        // loads normally. Never block the user over an update check.
        setUpdateStatus('idle');
      }
    }

    checkForOTAUpdate();
  }, []);

  // ─── Auth + purchases initialization ─────────────────────────────────────
  useEffect(() => {
    initialize().then(() => {
      setReady(true);
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

  // Show branded update screen while checking / downloading. This renders
  // before the SafeAreaProvider/Stack tree so there is zero overhead and
  // no stale navigator state during a potential reloadAsync().
  if (updateStatus === 'checking' || updateStatus === 'downloading' || updateStatus === 'upToDate') {
    return <UpdateCheckScreen status={updateStatus} />;
  }

  // Auth is still initializing (but update check is done). Show a branded
  // spinner that matches the splash screen color instead of the old gray.
  if (!ready) {
    return (
      <SafeAreaProvider>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <ErrorBoundary>
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
          <Stack.Screen name="day-detail" options={{ headerShown: false }} />
          <Stack.Screen name="upgrade" options={{ headerShown: true, title: 'Upgrade', presentation: 'modal' }} />
          <Stack.Screen name="legal/eula" options={{ headerShown: true, title: 'Terms of Use' }} />
          <Stack.Screen name="legal/privacy-policy" options={{ headerShown: true, title: 'Privacy Policy' }} />
        </Stack>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    // Brand navy — matches splash screen and UpdateCheckScreen so there
    // is no color flash during the auth-initialization phase either.
    backgroundColor: '#1E3A5F',
  },
});
