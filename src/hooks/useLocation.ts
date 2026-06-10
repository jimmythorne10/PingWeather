import { useState } from 'react';
import * as Location from 'expo-location';

interface LocationResult {
  latitude: number;
  longitude: number;
}

export function useDeviceLocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getLocation = async (): Promise<LocationResult | null> => {
    setLoading(true);
    setError(null);

    try {
      // Check existing status before requesting to avoid repeated dialogs.
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        ({ status } = await Location.requestForegroundPermissionsAsync());
      }
      if (status !== 'granted') {
        setError('Location permission denied. Please enable it in your device settings.');
        setLoading(false);
        return null;
      }

      // Prefer a cached fix — instant, no GPS required (works on Wi-Fi-only iPads).
      const lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: 5 * 60 * 1000,   // accept up to 5-minute-old fix
        requiredAccuracy: 5000,   // 5 km is plenty for weather grid lookup
      });
      if (lastKnown) {
        setLoading(false);
        return {
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
        };
      }

      // Fresh fix — use lowest accuracy so it works on Wi-Fi-only devices.
      // Lowest = 3 km accuracy, sufficient for weather grid lookup.
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Lowest,
      });

      setLoading(false);
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch {
      setError(
        'Could not determine your location. Try searching for your address above or enter coordinates manually below.'
      );
      setLoading(false);
      return null;
    }
  };

  return { getLocation, loading, error };
}
