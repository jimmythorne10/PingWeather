import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useEffect, useRef } from 'react';
import MapboxGL from '@rnmapbox/maps';
import { useTokens } from '../src/theme';
import { useRadarTiles } from '../src/hooks/useRadarTiles';

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '');

const RADAR_OPACITY = 0.75;
const DEFAULT_ZOOM = 7;

export default function RadarScreen() {
  const router = useRouter();
  const tokens = useTokens();
  const { lat, lng, locationName } = useLocalSearchParams<{
    lat: string;
    lng: string;
    locationName: string;
  }>();

  const latitude = parseFloat(lat ?? '39.5');
  const longitude = parseFloat(lng ?? '-98.35');
  const apiKey = process.env.EXPO_PUBLIC_RAINBOW_API_KEY ?? '';

  const { frames, currentFrame, frameIndex, totalFrames, isPlaying, setFrameIndex, play, pause, goToNow } =
    useRadarTiles(apiKey);

  const nowIndex = frames.findIndex(f => f.isCurrent);

  const styles = createStyles(tokens);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: locationName ? `Radar — ${locationName}` : 'Radar',
          headerStyle: { backgroundColor: tokens.headerBackground },
          headerTintColor: tokens.headerTint,
        }}
      />

      <MapboxGL.MapView
        style={styles.map}
        styleURL={MapboxGL.StyleURL.Dark}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
      >
        <MapboxGL.Camera
          zoomLevel={DEFAULT_ZOOM}
          centerCoordinate={[longitude, latitude]}
          animationMode="none"
          animationDuration={0}
        />

        {currentFrame ? (
          <MapboxGL.RasterSource
            id="radar-source"
            tileUrlTemplates={[currentFrame.tileUrlTemplate]}
            tileSize={256}
            minZoomLevel={0}
            maxZoomLevel={12}
          >
            <MapboxGL.RasterLayer
              id="radar-layer"
              style={{ rasterOpacity: RADAR_OPACITY }}
              layerIndex={1}
            />
          </MapboxGL.RasterSource>
        ) : null}
      </MapboxGL.MapView>

      {!apiKey ? (
        <View style={styles.apiWarning}>
          <Text style={styles.apiWarningText}>Radar unavailable — API key not configured</Text>
        </View>
      ) : null}

      <View style={[styles.controls, { backgroundColor: tokens.card }]}>
        <View style={styles.frameInfo}>
          <Text style={[styles.frameLabel, { color: tokens.textPrimary }]}>
            {currentFrame?.label ?? ''}
          </Text>
          <Text style={[styles.frameCount, { color: tokens.textTertiary }]}>
            {frameIndex + 1} / {totalFrames}
          </Text>
        </View>

        <View style={styles.scrubberRow}>
          {frames.map((frame, i) => (
            <Pressable
              key={i}
              onPress={() => setFrameIndex(i)}
              style={[
                styles.scrubTick,
                {
                  backgroundColor: i === frameIndex
                    ? tokens.primary
                    : frame.isForecast
                      ? tokens.info
                      : frame.isCurrent
                        ? tokens.success
                        : tokens.borderLight,
                },
              ]}
            />
          ))}
        </View>

        <View style={styles.scrubberLabels}>
          <Text style={[styles.scrubLabel, { color: tokens.textTertiary }]}>
            {frames[0]?.label}
          </Text>
          <Text style={[styles.scrubLabel, { color: tokens.textTertiary }]}>
            {frames[frames.length - 1]?.label}
          </Text>
        </View>

        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.controlBtn, { borderColor: tokens.borderLight }]}
            onPress={goToNow}
          >
            <Text style={[styles.controlBtnText, { color: tokens.textPrimary }]}>Now</Text>
          </Pressable>

          <Pressable
            style={[styles.playBtn, { backgroundColor: tokens.primary }]}
            onPress={isPlaying ? pause : play}
          >
            <Text style={[styles.playBtnText, { color: tokens.textOnPrimary }]}>
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.controlBtn, { borderColor: tokens.borderLight }]}
            onPress={() => setFrameIndex(nowIndex >= 0 ? nowIndex + 1 : frameIndex + 1 < totalFrames ? frameIndex + 1 : frameIndex)}
          >
            <Text style={[styles.controlBtnText, { color: tokens.rainBlue }]}>Fcst →</Text>
          </Pressable>
        </View>

        <View style={styles.attribution}>
          <Text style={[styles.attributionText, { color: tokens.textTertiary }]}>
            © Mapbox · Powered by Rainbow.ai
          </Text>
        </View>
      </View>
    </View>
  );
}

const createStyles = (t: ReturnType<typeof useTokens>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.background,
    },
    map: {
      flex: 1,
    },
    apiWarning: {
      position: 'absolute',
      top: 16,
      left: 16,
      right: 16,
      backgroundColor: t.errorLight,
      borderRadius: 8,
      padding: 12,
    },
    apiWarningText: {
      color: t.error,
      fontSize: 13,
      textAlign: 'center',
    },
    controls: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 24,
      borderTopWidth: 1,
      borderTopColor: t.borderLight,
    },
    frameInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    frameLabel: {
      fontSize: 16,
      fontWeight: '700',
    },
    frameCount: {
      fontSize: 12,
    },
    scrubberRow: {
      flexDirection: 'row',
      gap: 3,
      alignItems: 'center',
      marginBottom: 4,
    },
    scrubTick: {
      flex: 1,
      height: 8,
      borderRadius: 2,
    },
    scrubberLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    scrubLabel: {
      fontSize: 10,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
      marginBottom: 12,
    },
    controlBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      alignItems: 'center',
    },
    controlBtnText: {
      fontSize: 13,
      fontWeight: '600',
    },
    playBtn: {
      flex: 2,
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: 'center',
    },
    playBtnText: {
      fontSize: 14,
      fontWeight: '700',
    },
    attribution: {
      alignItems: 'center',
    },
    attributionText: {
      fontSize: 10,
    },
  });
