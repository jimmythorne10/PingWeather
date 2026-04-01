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
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied. Please enable it in your device settings.');
        setLoading(false);
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLoading(false);
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch {
      setError('Failed to get your location. Please try again.');
      setLoading(false);
      return null;
    }
  };

  return { getLocation, loading, error };
}
