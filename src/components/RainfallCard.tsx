import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { useStyles, useTokens } from '../theme';
import { useSettingsStore } from '../stores/settingsStore';
import { fetchRainfallHistory } from '../services/rainfallApi';
import type { ThemeTokens } from '../theme';
import type { RainfallWindow, RainfallData } from '../services/rainfallApi';

interface RainfallCardProps {
  locationId: string;
  latitude: number;
  longitude: number;
}

const WINDOWS: RainfallWindow[] = ['24h', '7d', '30d'];

// Max daily rows shown in the 7d/30d breakdown to keep the card compact.
const MAX_DAY_ROWS = 7;

export function RainfallCard({ locationId, latitude, longitude }: RainfallCardProps) {
  const styles = useStyles(createStyles);
  const tokens = useTokens();
  const temperatureUnit = useSettingsStore((s) => s.temperatureUnit);

  // fahrenheit users are in the US → inches; celsius → mm (international convention)
  const precipitationUnit = temperatureUnit === 'fahrenheit' ? 'inch' : 'mm' as const;

  const [window, setWindow] = useState<RainfallWindow>('24h');
  const [data, setData] = useState<RainfallData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchRainfallHistory(latitude, longitude, window, precipitationUnit);
        if (!cancelled) setData(result);
      } catch {
        if (!cancelled) setError('Could not load rainfall data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    // Prevent stale state updates if location or window changes before the
    // current fetch resolves.
    return () => { cancelled = true; };
  }, [locationId, latitude, longitude, window, precipitationUnit]);

  const nonZeroDays = (data?.days ?? [])
    .filter((d) => d.amount > 0)
    .slice(0, MAX_DAY_ROWS);

  return (
    <View>
      <Text style={styles.sectionLabel}>RAINFALL HISTORY</Text>

      {/* Window selector */}
      <View style={styles.segmentRow}>
        {WINDOWS.map((w) => (
          <Pressable
            key={w}
            style={[styles.segmentButton, window === w && styles.segmentActive]}
            onPress={() => setWindow(w)}
            accessibilityRole="button"
            accessibilityState={{ selected: window === w }}
          >
            <Text style={[styles.segmentText, window === w && styles.segmentTextActive]}>
              {w}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading && (
        <ActivityIndicator
          color={tokens.rainBlue}
          style={styles.spinner}
          accessibilityLabel="Loading rainfall data"
        />
      )}

      {!loading && error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      {!loading && !error && data && (
        <View style={styles.resultContainer}>
          <Text style={styles.totalAmount}>{data.totalFormatted}</Text>

          {/* Day-by-day breakdown for multi-day windows */}
          {data.days.length > 0 && nonZeroDays.length > 0 && (
            <View style={styles.dayList}>
              {nonZeroDays.map((day) => (
                <View key={day.date} style={styles.dayRow}>
                  <Text style={styles.dayLabel}>{day.label}</Text>
                  <Text style={styles.dayAmount}>
                    {day.amount} {data.unit}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {data.days.length > 0 && nonZeroDays.length === 0 && (
            <Text style={styles.noDataNote}>No rainfall on individual days</Text>
          )}
        </View>
      )}
    </View>
  );
}

const createStyles = (t: ThemeTokens) => ({
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: t.textTertiary,
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },

  segmentRow: {
    flexDirection: 'row' as const,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: t.border,
    overflow: 'hidden' as const,
    alignSelf: 'flex-start' as const,
    marginBottom: 12,
  },
  segmentButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: t.card,
  },
  segmentActive: {
    backgroundColor: t.rainBlue,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: t.textSecondary,
  },
  segmentTextActive: {
    color: t.textOnPrimary,
    fontWeight: '600' as const,
  },

  spinner: {
    marginVertical: 12,
  },

  errorText: {
    fontSize: 13,
    color: t.error,
    marginBottom: 8,
  },

  resultContainer: {
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: t.rainBlue,
    marginBottom: 8,
  },

  dayList: {
    borderTopWidth: 1,
    borderTopColor: t.divider,
    paddingTop: 4,
  },
  dayRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: t.divider,
  },
  dayLabel: {
    fontSize: 13,
    color: t.textPrimary,
  },
  dayAmount: {
    fontSize: 13,
    color: t.rainBlue,
    fontWeight: '500' as const,
  },

  noDataNote: {
    fontSize: 12,
    color: t.textTertiary,
    fontStyle: 'italic' as const,
  },
});
