import { View, Text, Pressable, StyleSheet, TextInput } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTokens } from '../../src/theme';

export default function LocationSetupScreen() {
  const router = useRouter();
  const t = useTokens();
  const [locationName, setLocationName] = useState('');

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <View style={styles.content}>
        <Text style={styles.icon}>📍</Text>
        <Text style={[styles.title, { color: t.textPrimary }]}>Add Your First Location</Text>
        <Text style={[styles.subtitle, { color: t.textSecondary }]}>
          Give it a name (e.g., "Home", "North Pasture", "Job Site") and we'll
          find its coordinates.
        </Text>

        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: t.inputBackground,
              borderColor: t.border,
              color: t.textPrimary,
            },
          ]}
          placeholder="Location name"
          placeholderTextColor={t.textTertiary}
          value={locationName}
          onChangeText={setLocationName}
        />

        <Pressable
          style={[styles.locationButton, { borderColor: t.primary }]}
          onPress={() => {
            // TODO: Use expo-location to get current device coordinates
            // or open a map picker / address search
          }}
        >
          <Text style={[styles.locationButtonText, { color: t.primary }]}>
            Use My Current Location
          </Text>
        </Pressable>

        <Text style={[styles.orText, { color: t.textTertiary }]}>
          — or search by address (coming soon) —
        </Text>
      </View>

      <View style={styles.buttons}>
        <Pressable
          style={[styles.skipButton]}
          onPress={() => router.push('/onboarding/notification-setup')}
        >
          <Text style={[styles.skipText, { color: t.textTertiary }]}>Skip for now</Text>
        </Pressable>

        <Pressable
          style={[
            styles.nextButton,
            { backgroundColor: locationName ? t.primary : t.primaryDisabled },
          ]}
          onPress={() => router.push('/onboarding/notification-setup')}
          disabled={!locationName}
        >
          <Text style={[styles.nextButtonText, { color: t.textOnPrimary }]}>Next</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
    paddingTop: 60,
    paddingBottom: 48,
  },
  content: {
    alignItems: 'center',
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  locationButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
  },
  locationButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  orText: {
    fontSize: 13,
    marginTop: 8,
  },
  buttons: {
    gap: 12,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 15,
  },
  nextButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
});
