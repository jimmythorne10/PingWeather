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
      const tokenData = await N.getExpoPushTokenAsync({ projectId });
      const token = tokenData.data;
      setExpoPushToken(token);

      // Register token with Supabase via Edge Function
      const { error: fnError } = await supabase.functions.invoke('register-push-token', {
        body: { push_token: token },
      });

      if (fnError) {
        console.error('Failed to register push token:', fnError);
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

    const notifSub = N.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification.request.content.title);
    });

    const responseSub = N.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      console.log('Notification tapped:', data);
    });

    subscriptions.current = [notifSub, responseSub];

    return () => {
      subscriptions.current.forEach((s) => s.remove());
    };
  }, []);

  return { expoPushToken, error, registerForPushNotifications };
}
