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

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const subscriptions = useRef<Array<{ remove: () => void }>>([]);

  const registerForPushNotifications = useCallback(async (): Promise<string | null> => {
    const N = getNotifications();
    if (!N) {
      setError('Push notifications are not available in Expo Go. Use a development build.');
      return null;
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
        setError('Push notification permission denied.');
        return null;
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        setError('EAS projectId missing from app config — cannot get push token.');
        return null;
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
        const msg =
          (fnError as { message?: string }).message ??
          (typeof fnError === 'string' ? fnError : 'Edge Function error');
        setError(`Failed to save push token to server: ${msg}`);
        return null;
      }

      // Belt + suspenders: some Edge Function errors come back as 2xx with
      // an { error: "..." } body rather than as fnError. Surface those too.
      if (fnData && typeof fnData === 'object' && 'error' in fnData && fnData.error) {
        setError(`Server rejected push token: ${String(fnData.error)}`);
        return null;
      }

      return token;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to register for push notifications';
      setError(message);
      return null;
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
