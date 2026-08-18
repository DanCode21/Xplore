import * as SQLite from 'expo-sqlite';
import { haversineM, MAX_SPEED_MS } from './h3utils';

let db: SQLite.SQLiteDatabase;

export async function initDb(): Promise<void> {
  db = await SQLite.openDatabaseAsync('fogwalk.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS walks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      distance_m REAL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS gps_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      walk_id INTEGER NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      accuracy REAL NOT NULL,
      speed REAL,
      ts INTEGER NOT NULL,
      FOREIGN KEY (walk_id) REFERENCES walks(id)
    );
    CREATE TABLE IF NOT EXISTS visited_cells (
      h3_index TEXT PRIMARY KEY
    );
    CREATE INDEX IF NOT EXISTS idx_gps_walk ON gps_points(walk_id);
  `);
}

export async function startWalk(): Promise<number> {
  const result = await db.runAsync('INSERT INTO walks (started_at) VALUES (?)', Date.now());
  return result.lastInsertRowId;
}

export async function endWalk(walkId: number, distanceM: number): Promise<void> {
  await db.runAsync(
    'UPDATE walks SET ended_at = ?, distance_m = ? WHERE id = ?',
    Date.now(), distanceM, walkId,
  );
}

export async function insertGpsPoint(
  walkId: number, lat: number, lng: number, accuracy: number, speed: number | null,
): Promise<void> {
  await db.runAsync(
    'INSERT INTO gps_points (walk_id, lat, lng, accuracy, speed, ts) VALUES (?, ?, ?, ?, ?, ?)',
    walkId, lat, lng, accuracy, speed ?? null, Date.now(),
  );
}

export async function insertVisitedCell(h3Index: string): Promise<void> {
  await db.runAsync('INSERT OR IGNORE INTO visited_cells (h3_index) VALUES (?)', h3Index);
}

export async function getAllVisitedCells(): Promise<string[]> {
  const rows = await db.getAllAsync<{ h3_index: string }>('SELECT h3_index FROM visited_cells');
  return rows.map(r => r.h3_index);
}

export async function updateWalkDistance(walkId: number, distanceM: number): Promise<void> {
  await db.runAsync('UPDATE walks SET distance_m = ? WHERE id = ?', distanceM, walkId);
}

export async function getLifetimeDistanceM(): Promise<number> {
  const row = await db.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(distance_m), 0) AS total FROM walks',
  );
  return row?.total ?? 0;
}

// Close out walks whose session never ended (app killed mid-recording, or
// recorded by builds that only wrote distance on STOP): rebuild distance from
// the raw points with the same teleport gate the live session uses, and stamp
// ended_at from the last fix. Runs once at app startup, before any session.
export async function recoverUnfinishedWalks(): Promise<void> {
  const open = await db.getAllAsync<{ id: number }>('SELECT id FROM walks WHERE ended_at IS NULL');
  for (const { id } of open) {
    const pts = await db.getAllAsync<{ lat: number; lng: number; ts: number }>(
      'SELECT lat, lng, ts FROM gps_points WHERE walk_id = ? ORDER BY ts', id,
    );
    if (pts.length === 0) {
      await db.runAsync('DELETE FROM walks WHERE id = ?', id);
      continue;
    }
    let dist = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = haversineM(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
      const dt = (pts[i].ts - pts[i - 1].ts) / 1000;
      if (dt > 0 && d / dt <= MAX_SPEED_MS) dist += d;
    }
    await db.runAsync(
      'UPDATE walks SET ended_at = ?, distance_m = ? WHERE id = ?',
      pts[pts.length - 1].ts, dist, id,
    );
  }
}
