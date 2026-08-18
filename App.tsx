import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { initDb, getAllVisitedCells, recoverUnfinishedWalks } from './src/db';
import MapScreen from './src/MapScreen';

export default function App() {
  const [ready, setReady] = useState(false);
  const [initialCells, setInitialCells] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      await initDb();
      await recoverUnfinishedWalks();
      const cells = await getAllVisitedCells();
      setInitialCells(new Set(cells));
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#7fd4ff" />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <>
      <MapScreen initialCells={initialCells} />
      <StatusBar style="light" />
    </>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#0a0c10', alignItems: 'center', justifyContent: 'center' },
});
