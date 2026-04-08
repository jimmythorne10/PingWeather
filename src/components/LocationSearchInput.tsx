/**
 * LocationSearchInput
 * Debounced location search autocomplete component.
 * Calls the Open-Meteo geocoding service and presents a results dropdown.
 *
 * Phase 3 will wire this into locations.tsx and onboarding/location-setup.tsx.
 */

import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { formatLocationLabel, searchPlaces } from '../services/geocoding';
import type { GeocodingResult } from '../services/geocoding';
import { useStyles, useTokens } from '../theme';
import type { ThemeTokens } from '../theme';

// ─── Public API ──────────────────────────────────────────────────────────────

export interface LocationSearchInputProps {
  /** Called when the user taps a result row. */
  onSelect: (result: {
    name: string;
    latitude: number;
    longitude: number;
    timezone?: string;
  }) => void;
  /** Optional placeholder text override. */
  placeholder?: string;
  /** Optional testID — overrides the default 'location-search-input'. */
  testID?: string;
}

// ─── Internal state shape ────────────────────────────────────────────────────

type SearchStatus = 'idle' | 'loading' | 'done' | 'error';

// ─── Component ───────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 5;

export function LocationSearchInput({
  onSelect,
  placeholder = 'Search city, county, or ZIP code',
  testID,
}: LocationSearchInputProps) {
  const styles = useStyles(createStyles);
  const tokens = useTokens();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [status, setStatus] = useState<SearchStatus>('idle');

  // Tracks the query string that was actually sent so we can guard stale responses.
  const activeQueryRef = useRef<string>('');

  // ── Debounced search ───────────────────────────────────────────────────────
  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setStatus('idle');
      return;
    }

    setStatus('loading');

    const timerId = setTimeout(async () => {
      // Record which query we're firing for race-condition guard.
      activeQueryRef.current = trimmed;

      try {
        const found = await searchPlaces(trimmed, MAX_RESULTS);

        // Discard response if a newer query has fired since this one started.
        if (activeQueryRef.current !== trimmed) return;

        setResults(found);
        setStatus('done');
      } catch {
        if (activeQueryRef.current !== trimmed) return;
        setResults([]);
        setStatus('error');
      }
    }, DEBOUNCE_MS);

    // Cancel the debounce timer if the user keeps typing or the component unmounts.
    return () => clearTimeout(timerId);
  }, [query]);

  // ── Select handler ─────────────────────────────────────────────────────────
  const handleSelect = (result: GeocodingResult) => {
    onSelect({
      name: result.name,
      latitude: result.latitude,
      longitude: result.longitude,
      timezone: result.timezone,
    });
    // Keep the selected label visible in the input. Hide the dropdown but don't clear the query.
    // When the user starts typing again, the debounce will trigger a fresh search.
    setQuery(formatLocationLabel(result));
    setResults([]);
    setStatus('idle');
    activeQueryRef.current = '';
  };

  // ── Dropdown visibility guard ──────────────────────────────────────────────
  const trimmedQuery = query.trim();
  const showDropdown = trimmedQuery.length >= MIN_QUERY_LENGTH && status !== 'idle';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.wrapper}>
      {/* ── Input row ── */}
      <View style={styles.inputRow}>
        <TextInput
          testID={testID ?? 'location-search-input'}
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={tokens.textTertiary}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {status === 'loading' && (
          <ActivityIndicator
            testID="location-search-loading"
            size="small"
            color={tokens.primary}
            style={styles.loadingIndicator}
          />
        )}
      </View>

      {/* ── Results dropdown ── */}
      {showDropdown && (
        <View testID="location-search-results" style={styles.dropdown}>
          {status === 'error' ? (
            <View style={styles.messageRow}>
              <Text style={[styles.messageText, { color: tokens.error }]}>
                Search failed — try again
              </Text>
            </View>
          ) : status === 'done' && results.length === 0 ? (
            <View style={styles.messageRow}>
              <Text style={styles.messageText}>No places found</Text>
            </View>
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              bounces={false}
              style={styles.resultsList}
            >
              {results.map((result, index) => (
                <Pressable
                  key={result.id}
                  testID={`location-search-result-${index}`}
                  style={({ pressed }) => [
                    styles.resultRow,
                    index < results.length - 1 && styles.resultRowBorder,
                    pressed && styles.resultRowPressed,
                  ]}
                  onPress={() => handleSelect(result)}
                >
                  <Text style={styles.resultText} numberOfLines={1}>
                    {formatLocationLabel(result)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    wrapper: {
      // Relative positioning so the dropdown can sit directly below the input
      // without needing absolute positioning that would clip inside ScrollView parents.
      zIndex: 10,
    },

    // Input row — matches the `input` style in locations.tsx exactly.
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 8,
      backgroundColor: t.inputBackground,
      // No marginBottom here — callers control spacing via their own container.
    },
    input: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 14,
      fontSize: 15,
      color: t.textPrimary,
    },
    loadingIndicator: {
      paddingHorizontal: 12,
    },

    // Dropdown container — sits directly below the input row.
    dropdown: {
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 8,
      marginTop: 4,
      maxHeight: 220,
      // Android elevation for subtle depth separation.
      elevation: 3,
      // iOS shadow — minimal, just enough to lift from the form card.
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    },
    resultsList: {
      maxHeight: 220,
    },
    resultRow: {
      paddingVertical: 13,
      paddingHorizontal: 14,
    },
    resultRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.divider,
    },
    resultRowPressed: {
      backgroundColor: t.primaryLight,
    },
    resultText: {
      fontSize: 15,
      color: t.textPrimary,
    },

    // Non-tappable message rows (no results / error).
    messageRow: {
      paddingVertical: 13,
      paddingHorizontal: 14,
    },
    messageText: {
      fontSize: 14,
      color: t.textSecondary,
    },
  });
