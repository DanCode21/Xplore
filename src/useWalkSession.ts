import { useState, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import { startWalk, endWalk, insertGpsPoint, insertVisitedCell } from './db';
import { coordToCell, haversineM, MARK_M, MAX_ACCURACY_M, MAX_SPEED_MS } from './h3utils';

export type WalkSession = {
  isRecording: boolean;
  visitedCells: Set<string>;
  distanceM: number;
  position: [number, number] | null; // [lat, lng]
  startSession: () => Promise<void>;
  stopSession: () => Promise<void>;
};

export function useWalkSession(initialCells: Set<string>): WalkSession {
  const [isRecording, setIsRecording] = useState(false);
  const [visitedCells, setVisitedCells] = useState<Set<string>>(initialCells);
  const [distanceM, setDistanceM] = useState(0);
  const [position, setPosition] = useState<[number, number] | null>(null);

  const walkIdRef = useRef<number | null>(null);
  const lastPosRef = useRef<[number, number] | null>(null);
  const lastMarkRef = useRef<[number, number] | null>(null);
  const distRef = useRef(0);
  const subRef = useRef<Location.LocationSubscription | null>(null);

  const addCell = useCallback(async (lat: number, lng: number) => {
    const cellId = coordToCell(lat, lng);
    let isNew = false;
    setVisitedCells(prev => {
      if (prev.has(cellId)) return prev;
      isNew = true;
      return new Set([...prev, cellId]);
    });
    if (isNew) {
      await insertVisitedCell(cellId);
    }
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

      if (lastPosRef.current) {
        const d = haversineM(lastPosRef.current[0], lastPosRef.current[1], lat, lng);
        distRef.current += d;
        setDistanceM(distRef.current);
      }
      lastPosRef.current = [lat, lng];

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

    walkIdRef.current = await startWalk();
    distRef.current = 0;
    lastPosRef.current = null;
    lastMarkRef.current = null;
    setDistanceM(0);
    setIsRecording(true);

    subRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 5000,
        distanceInterval: 5,
      },
      handleLocation,
    );
  }, [handleLocation]);

  const stopSession = useCallback(async () => {
    subRef.current?.remove();
    subRef.current = null;
    if (walkIdRef.current !== null) {
      await endWalk(walkIdRef.current, distRef.current);
      walkIdRef.current = null;
    }
    setIsRecording(false);
  }, []);

  return { isRecording, visitedCells, distanceM, position, startSession, stopSession };
}
