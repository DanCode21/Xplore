import * as SQLite from 'expo-sqlite';

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
