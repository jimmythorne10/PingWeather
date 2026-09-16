import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import MapboxGL from '@rnmapbox/maps';
import { useTokens } from '../src/theme';
import { useLook } from '../src/theme/useStyles';
import type { LookTokens } from '../src/theme/looks';
import { useRadarTiles } from '../src/hooks/useRadarTiles';

const _mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';
if (_mapboxToken) MapboxGL.setAccessToken(_mapboxToken);
MapboxGL.setTelemetryEnabled(false);

const RADAR_OPACITY = 0.75;
const DEFAULT_ZOOM = 7;

export default function RadarScreen() {
  const tokens = useTokens();
  const look = useLook();
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
  const styles = createStyles(tokens, look);

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

// NOTE FOR ANYONE MIGRATING THIS FILE LATER: nothing here touches the Mapbox
// layer. `styleURL` and `RasterLayer`'s `style` prop are Mapbox-native values,
// NOT React Native styles — rewriting either as an RN style object is the
// regression that shipped two broken OTAs on 2026-05-07, and
// __tests__/theme/radarNativeProps.test.ts exists to catch it.
const createStyles = (t: ReturnType<typeof useTokens>, look: LookTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.background,
    },
    map: {
      flex: 1,
    },
    controls: {
      paddingHorizontal: look.spacing.lg,
      paddingTop: look.spacing.md,
      paddingBottom: look.spacing.xl,
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
      fontSize: look.typography.heading.size,
      fontWeight: look.typography.heading.weight,
      letterSpacing: look.typography.heading.tracking,
    },
    frameCount: {
      fontSize: look.typography.label.size,
    },
    scrubberRow: {
      flexDirection: 'row',
      gap: look.spacing.xs,
      alignItems: 'center',
      marginBottom: 4,
    },
    scrubTick: {
      flex: 1,
      height: 8,
      // radius.surface exceeds this element's 8pt height, so RN clamps it to a
      // pill. That is the intended Aurora reading of a scrub tick, and under
      // classic (12) it clamps identically — the tick is never square either way.
      borderRadius: look.radius.surface,
    },
    scrubberLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    scrubLabel: {
      fontSize: look.typography.label.size,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: look.spacing.md,
      alignItems: 'center',
      marginBottom: 12,
    },
    controlBtn: {
      flex: 1,
      paddingVertical: look.spacing.md,
      borderRadius: look.radius.surface,
      borderWidth: 1,
      alignItems: 'center',
    },
    controlBtnText: {
      fontSize: look.typography.caption.size,
      fontWeight: look.typography.caption.weight,
      letterSpacing: look.typography.caption.tracking,
    },
    playBtn: {
      flex: 2,
      paddingVertical: look.spacing.md,
      borderRadius: look.radius.surface,
      alignItems: 'center',
    },
    playBtnText: {
      fontSize: look.typography.bodyStrong.size,
      fontWeight: look.typography.bodyStrong.weight,
      letterSpacing: look.typography.bodyStrong.tracking,
    },
    attribution: {
      alignItems: 'center',
    },
    attributionText: {
      fontSize: look.typography.label.size,
    },
  });
