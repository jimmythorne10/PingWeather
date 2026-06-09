import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import MapboxGL from '@rnmapbox/maps';
import { useTokens } from '../src/theme';
import { useRadarTiles } from '../src/hooks/useRadarTiles';

const _mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';
if (_mapboxToken) MapboxGL.setAccessToken(_mapboxToken);
MapboxGL.setTelemetryEnabled(false);

const RADAR_OPACITY = 0.75;
const DEFAULT_ZOOM = 7;

export default function RadarScreen() {
  const tokens = useTokens();
  const { lat, lng, locationName } = useLocalSearchParams<{
    lat: string;
    lng: string;
    locationName: string;
  }>();

  const latitude = parseFloat(lat ?? '39.5');
  const longitude = parseFloat(lng ?? '-98.35');

  const { frames, frameIndex, totalFrames, isPlaying,
          setFrameIndex, play, pause, goToNow } = useRadarTiles();

  const nowIndex = frames.findIndex(f => f.isCurrent);
  const styles = createStyles(tokens);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: locationName ? `Radar — ${locationName}` : 'Radar',
          headerBackTitle: 'Forecasts',
          headerStyle: { backgroundColor: tokens.headerBackground },
          headerTintColor: tokens.headerTint,
        }}
      />

      <MapboxGL.MapView
        style={styles.map}
        styleURL={MapboxGL.StyleURL.Dark}
        compassEnabled={false}
        scaleBarEnabled={false}
      >
        <MapboxGL.Camera
          zoomLevel={DEFAULT_ZOOM}
          centerCoordinate={[longitude, latitude]}
          animationMode="none"
          animationDuration={0}
        />

        {frames.map((frame, i) => (
          <MapboxGL.RasterSource
            key={frame.tileUrlTemplate}
            id={`radar-source-${i}`}
            tileUrlTemplates={[frame.tileUrlTemplate]}
            tileSize={256}
          >
            <MapboxGL.RasterLayer
              id={`radar-layer-${i}`}
              style={{ rasterOpacity: i === frameIndex ? RADAR_OPACITY : 0 }}
              aboveLayerID="waterway-label"
            />
          </MapboxGL.RasterSource>
        ))}
      </MapboxGL.MapView>

      <View style={[styles.controls, { backgroundColor: tokens.card }]}>
        <View style={styles.frameInfo}>
          <Text style={[styles.frameLabel, { color: tokens.textPrimary }]}>
            {frames[frameIndex]?.label ?? ''}
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
            onPress={() => setFrameIndex(frameIndex > 0 ? frameIndex - 1 : frameIndex)}
          >
            <Text style={[styles.controlBtnText, { color: tokens.rainBlue }]}>← Hist</Text>
          </Pressable>
        </View>

        <View style={styles.attribution}>
          <Text style={[styles.attributionText, { color: tokens.textTertiary }]}>
            © Mapbox · NOAA/NWS Radar via IEM
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
