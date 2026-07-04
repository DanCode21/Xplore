import React, { useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Platform,
} from 'react-native';
import {
  Map,
  Camera,
  GeoJSONSource,
  Layer,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import MAP_STYLE from './mapStyle';
import { buildFogShape } from './h3utils';
import { useWalkSession } from './useWalkSession';

type Props = { initialCells: Set<string> };

export default function MapScreen({ initialCells }: Props) {
  const session = useWalkSession(initialCells);
  const cameraRef = useRef<CameraRef>(null);

  const fogShape = useMemo(
    () => buildFogShape(session.visitedCells),
    [session.visitedCells],
  );

  const userShape = useMemo(() => {
    if (!session.position) return null;
    const [lat, lng] = session.position;
    return {
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [lng, lat] },
      properties: {},
    };
  }, [session.position]);

  const centerOnUser = () => {
    if (!session.position) return;
    const [lat, lng] = session.position;
    cameraRef.current?.flyTo({ center: [lng, lat], duration: 800 });
  };

  return (
    <View style={styles.root}>
      <Map
        style={styles.map}
        mapStyle={MAP_STYLE}
        touchPitch={false}
        touchRotate={false}
        attribution={false}
        logo={false}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{ center: [4.8952, 52.3702], zoom: 14 }}
        />

        {/* Fog: world polygon with holes punched at each visited cell */}
        <GeoJSONSource id="fog-src" data={fogShape}>
          <Layer
            id="fog-fill"
            type="fill"
            paint={{ 'fill-color': 'rgba(5,7,10,0.90)', 'fill-antialias': true }}
          />
        </GeoJSONSource>

        {/* User position dot */}
        {userShape && (
          <GeoJSONSource id="user-src" data={userShape}>
            <Layer
              id="user-halo"
              type="circle"
              paint={{ 'circle-radius': 16, 'circle-color': 'rgba(127,212,255,0.20)' }}
            />
            <Layer
              id="user-dot"
              type="circle"
              paint={{
                'circle-radius': 6,
                'circle-color': '#ffffff',
                'circle-stroke-color': '#0a0c10',
                'circle-stroke-width': 2,
              }}
            />
          </GeoJSONSource>
        )}
      </Map>

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.title} pointerEvents="none">
          <Text style={styles.titleText}>FOGWALK</Text>
        </View>

        <View style={styles.stats} pointerEvents="none">
          <Text style={styles.statLine}>
            <Text style={styles.statValue}>{(session.distanceM / 1000).toFixed(2)}</Text>
            <Text style={styles.statLabel}> km walked</Text>
          </Text>
          <Text style={styles.statLine}>
            <Text style={styles.statValue}>{session.visitedCells.size}</Text>
            <Text style={styles.statLabel}> cells revealed</Text>
          </Text>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity style={styles.iconBtn} onPress={centerOnUser}>
            <Text style={styles.iconBtnText}>⊙</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.recordBtn, session.isRecording && styles.recordBtnActive]}
            onPress={session.isRecording ? session.stopSession : session.startSession}
          >
            <Text style={[styles.recordBtnText, session.isRecording && styles.recordBtnTextActive]}>
              {session.isRecording ? '⏹  STOP WALK' : '▶  START WALK'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0c10' },
  map: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },

  title: {
    marginTop: Platform.OS === 'android' ? 48 : 0,
    marginLeft: 16,
  },
  titleText: {
    fontFamily: Platform.OS === 'ios' ? 'AvenirNext-Heavy' : undefined,
    fontWeight: '900',
    fontSize: 26,
    letterSpacing: 2,
    color: '#e4ebf4',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },

  stats: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 90 : 72,
    left: 16,
    backgroundColor: 'rgba(10,12,16,0.82)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  statLine: { lineHeight: 22 },
  statValue: { color: '#7fd4ff', fontSize: 14 },
  statLabel: { color: '#8fa1b8', fontSize: 13 },

  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  iconBtn: {
    backgroundColor: 'rgba(10,12,16,0.85)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    padding: 12,
  },
  iconBtnText: { fontSize: 18, color: '#c8d4e2' },
  recordBtn: {
    flex: 1,
    backgroundColor: 'rgba(10,12,16,0.85)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingVertical: 14,
    alignItems: 'center',
  },
  recordBtnActive: {
    borderColor: 'rgba(127,212,255,0.6)',
    backgroundColor: 'rgba(20,30,46,0.92)',
  },
  recordBtnText: { fontSize: 15, fontWeight: '700', letterSpacing: 1, color: '#c8d4e2' },
  recordBtnTextActive: { color: '#7fd4ff' },
});
