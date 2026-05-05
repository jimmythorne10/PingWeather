import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../utils/supabase';

// expo-notifications crashes Expo Go on SDK 53+.
// Lazy-load it so the module only initializes in native builds.
let Notifications: typeof import('expo-notifications') | null = null;
let handlerConfigured = false;

function getNotifications() {
  if (!Notifications) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      Notifications = require('expo-notifications');
      if (!handlerConfigured && Notifications) {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });
        handlerConfigured = true;
      }
    } catch {
      // Not available (Expo Go) — that's fine
      Notifications = null;
    }
  }
  return Notifications;
}

// Ensures all notification channels exist on the device. Safe to call on
// every app launch — setNotificationChannelAsync is idempotent. Must run
// at startup rather than only in registerForPushNotifications() so that
// channels added after a user's initial onboarding are created without
// requiring re-registration.
// Silently re-registers the push token with the server on every launch.
// Called after auth is ready so the Edge Function has a valid JWT. Non-fatal
// — any failure is swallowed so the app always continues loading normally.
// This handles FCM token rotation and the post-new-APK-install case where
// the stored token becomes DeviceNotRegistered.
export async function refreshPushToken(): Promise<void> {
  const N = getNotifications();
  if (!N) return;

  // Only proceed if permissions are already granted — never show a dialog
  // silently in the background.
  const { status } = await N.getPermissionsAsync();
  if (status !== 'granted') return;

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return;

    const tokenData = await N.getExpoPushTokenAsync({ projectId });
    await supabase.functions.invoke('register-push-token', {
      body: { push_token: tokenData.data },
    });
  } catch {
    // Non-fatal
  }
}

export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const N = getNotifications();
  if (!N) return;
  await N.setNotificationChannelAsync('weather-alerts', {
    name: 'Weather Alerts',
    importance: N.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#1E3A5F',
    sound: 'default',
  });
  await N.setNotificationChannelAsync('forecast-digest', {
    name: 'Forecast Digest',
    description: 'Daily or weekly forecast summaries',
    importance: N.AndroidImportance.DEFAULT,
    sound: 'default',
  });
}

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const subscriptions = useRef<Array<{ remove: () => void }>>([]);

  const registerForPushNotifications = useCallback(async (): Promise<{ token: string | null; error: string | null }> => {
    const fail = (msg: string) => { setError(msg); return { token: null, error: msg }; };

    const N = getNotifications();
    if (!N) {
      return fail('Push notifications are not available in Expo Go. Use a development build.');
    }

    try {
      if (Platform.OS === 'android') {
        await N.setNotificationChannelAsync('weather-alerts', {
          name: 'Weather Alerts',
          importance: N.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#1E3A5F',
          sound: 'default',
        });
        await N.setNotificationChannelAsync('forecast-digest', {
          name: 'Forecast Digest',
          description: 'Daily or weekly forecast summaries',
          importance: N.AndroidImportance.DEFAULT,
          sound: 'default',
        });
      }

      const { status: existingStatus } = await N.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await N.requestPermissionsAsync({});
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return fail('Push notification permission denied.');
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        return fail('EAS projectId missing from app config — cannot get push token.');
      }
      const tokenData = await N.getExpoPushTokenAsync({ projectId });
      const token = tokenData.data;
      setExpoPushToken(token);

      // Register token with Supabase via Edge Function.
      // IMPORTANT: we must not return `token` as success if this call fails —
      // the profile row would be left without a push_token and the app would
      // silently behave as if notifications work when they don't.
      const { error: fnError, data: fnData } = await supabase.functions.invoke(
        'register-push-token',
        { body: { push_token: token } }
      );

      if (fnError) {
        let msg = (fnError as { message?: string }).message ?? 'Edge Function error';
        const ctx = (fnError as { context?: Response }).context;
        if (ctx) {
          try {
            const body = await ctx.json() as { error?: string };
            if (body?.error) msg = `${ctx.status}: ${body.error}`;
          } catch { /* ignore body parse failure */ }
        }
        return fail(`Failed to save push token to server: ${msg}`);
      }

      // Belt + suspenders: some Edge Function errors come back as 2xx with
      // an { error: "..." } body rather than as fnError. Surface those too.
      if (fnData && typeof fnData === 'object' && 'error' in fnData && fnData.error) {
        return fail(`Server rejected push token: ${String(fnData.error)}`);
      }

      return { token, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to register for push notifications';
      return fail(message);
    }
  }, []);

  useEffect(() => {
    const N = getNotifications();
    if (!N) return;

    const notifSub = N.addNotificationReceivedListener(() => {
      // Listener intentionally no-ops — expo-notifications shows the
      // banner automatically via the handler configured in
      // getNotifications(). Hook kept for future "track notification
      // open" analytics.
    });

    const responseSub = N.addNotificationResponseReceivedListener(() => {
      // User tapped the notification. Future: navigate to the alert's
      // rule detail via response.notification.request.content.data.rule_id.
    });

    subscriptions.current = [notifSub, responseSub];

    return () => {
      subscriptions.current.forEach((s) => s.remove());
    };
  }, []);

  return { expoPushToken, error, registerForPushNotifications };
}
