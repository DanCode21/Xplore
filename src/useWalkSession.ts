import { useState, useRef, useCallback, useEffect } from 'react';
import * as Location from 'expo-location';
import {
  startWalk, endWalk, insertGpsPoint, insertVisitedCell,
  updateWalkDistance, getLifetimeDistanceM,
} from './db';
import { coordToCell, haversineM, MARK_M, MAX_ACCURACY_M, MAX_SPEED_MS } from './h3utils';
import { WALK_LOCATION_TASK, setWalkLocationListener } from './locationTask';

export type WalkSession = {
  isRecording: boolean;
  visitedCells: Set<string>;
  distanceM: number;
  lifetimeM: number;
  position: [number, number] | null; // [lat, lng]
  startSession: () => Promise<void>;
  stopSession: () => Promise<void>;
};

export function useWalkSession(initialCells: Set<string>): WalkSession {
  const [isRecording, setIsRecording] = useState(false);
  const [visitedCells, setVisitedCells] = useState<Set<string>>(initialCells);
  const [distanceM, setDistanceM] = useState(0);
  const [lifetimeM, setLifetimeM] = useState(0);
  const [position, setPosition] = useState<[number, number] | null>(null);

  const walkIdRef = useRef<number | null>(null);
  const lastPosRef = useRef<[number, number] | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const lastMarkRef = useRef<[number, number] | null>(null);
  const distRef = useRef(0);

  useEffect(() => {
    getLifetimeDistanceM().then(setLifetimeM).catch(() => {});
  }, []);
  // Synchronous mirror of visitedCells: state updaters run at render time,
  // so deciding "is this cell new?" inside one drops the DB insert.
  const cellsRef = useRef<Set<string>>(initialCells);

  const addCell = useCallback(async (lat: number, lng: number) => {
    const cellId = coordToCell(lat, lng);
    if (cellsRef.current.has(cellId)) return;
    const next = new Set(cellsRef.current);
    next.add(cellId);
    cellsRef.current = next;
    setVisitedCells(next);
    await insertVisitedCell(cellId);
  }, []);

  const handleLocation = useCallback(
    async (loc: Location.LocationObject) => {
      const { latitude: lat, longitude: lng, accuracy, speed } = loc.coords;

      if (accuracy === null || accuracy > MAX_ACCURACY_M) return;
      if (speed !== null && speed > MAX_SPEED_MS) return;

      setPosition([lat, lng]);

      if (walkIdRef.current !== null) {
        insertGpsPoint(walkIdRef.current, lat, lng, accuracy, speed).catch(() => {});
      }

      if (lastPosRef.current && lastTsRef.current !== null) {
        const d = haversineM(lastPosRef.current[0], lastPosRef.current[1], lat, lng);
        const dt = (loc.timestamp - lastTsRef.current) / 1000;
        // GPS-reported speed can read ~0 across a teleport-style jump (signal
        // reacquisition, simulated location changes), so also gate on the
        // speed implied by consecutive fixes. On a jump, restart the segment
        // here without crediting distance or revealing along the way.
        if (dt <= 0 || d / dt > MAX_SPEED_MS) {
          lastPosRef.current = [lat, lng];
          lastTsRef.current = loc.timestamp;
          lastMarkRef.current = null;
          return;
        }
        distRef.current += d;
        setDistanceM(distRef.current);
        // Persist continuously so a killed app never loses walk distance.
        if (walkIdRef.current !== null) {
          updateWalkDistance(walkIdRef.current, distRef.current).catch(() => {});
        }
      }
      lastPosRef.current = [lat, lng];
      lastTsRef.current = loc.timestamp;

      if (
        !lastMarkRef.current ||
        haversineM(lastMarkRef.current[0], lastMarkRef.current[1], lat, lng) >= MARK_M
      ) {
        await addCell(lat, lng);
        lastMarkRef.current = [lat, lng];
      }
    },
    [addCell],
  );

  const startSession = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    // A stale task can survive a crash or force-quit mid-session; clear it.
    if (await Location.hasStartedLocationUpdatesAsync(WALK_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(WALK_LOCATION_TASK);
    }

    walkIdRef.current = await startWalk();
    distRef.current = 0;
    lastPosRef.current = null;
    lastTsRef.current = null;
    lastMarkRef.current = null;
    setDistanceM(0);
    setIsRecording(true);

    setWalkLocationListener((locations) => {
      for (const loc of locations) void handleLocation(loc);
    });
    await Location.startLocationUpdatesAsync(WALK_LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 5000,
      distanceInterval: 5,
      activityType: Location.ActivityType.Fitness,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
    });
  }, [handleLocation]);

  const stopSession = useCallback(async () => {
    setWalkLocationListener(null);
    if (await Location.hasStartedLocationUpdatesAsync(WALK_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(WALK_LOCATION_TASK);
    }
    if (walkIdRef.current !== null) {
      await endWalk(walkIdRef.current, distRef.current);
      walkIdRef.current = null;
    }
    setIsRecording(false);
    getLifetimeDistanceM().then(setLifetimeM).catch(() => {});
  }, []);

  return { isRecording, visitedCells, distanceM, lifetimeM, position, startSession, stopSession };
}
