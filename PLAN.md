# FOGWALK — Project Plan & Vision (Agent Handoff Document)

> Read this top to bottom before touching code. It contains the product vision, every
> architectural decision already made (and why), the exact current state, the build
> procedure with known gotchas, and a step-by-step roadmap with acceptance criteria.
> Companion file: `CLAUDE.md` (short reference). This file is the deep version.
> Naming: the project is called "Fogwalk" and "Xplore" interchangeably — both are
> placeholders. Code slug is `fogwalk`, repo folder is `Xplore`. Same project.

---

## 1. Vision

Fogwalk is an iPhone app that turns walking your city into exploration. The map starts
covered in near-black fog — like an unexplored GTA 5 pause-map — and permanently reveals
itself only where you have physically walked. Opening the app shows, at a glance, the shape
of everywhere you've ever been on foot, and the fog silently dares you to fill in the gaps.

It is **not** a navigation app, a fitness tracker, or a social network (yet). The core
emotional loop is:

1. Walk somewhere new → watch fog melt away in real time.
2. Come home → see your lifetime "explored" map grow.
3. Notice a dark patch two streets away → go walk it.

Design north star: the reveal must feel *earned* (only real walking unlocks; driving
doesn't count) and *permanent* (never lose revealed area — data loss is the one
unforgivable bug).

**User & constraints:** single user for now — Daniel, dogfooding on his own iPhone,
developing on his Mac. Local-only data, no accounts, no server, no analytics. Free Apple
developer account (this matters — see §6, provisioning expires weekly). Everything should
work offline except map tile loading.

## 2. Product decisions already made — do not relitigate

These were decided in July 2026 after prototyping. Change them only if Daniel explicitly asks.

- **Stack:** React Native + Expo (SDK 57, managed workflow + `prebuild`), TypeScript.
  Local native builds via Xcode — **no EAS cloud builds**, no Expo Go (native modules
  require a dev build).
- **Maps:** MapLibre GL via `@maplibre/maplibre-react-native`, vector tiles from
  OpenFreeMap (`https://tiles.openfreemap.org/planet`, free, no API key). Fully custom
  dark style — see §4.4.
- **Visited-area model:** H3 hexagonal cells, resolution 11 (~24 m across, ~2,150 m²
  each), via `h3-js`. A place is "visited" if its cell ID is in the `visited_cells` table.
- **Raw GPS traces are the source of truth**; cells are a derived index. Never discard
  raw points — future features (street-segment matching) will be computed retroactively
  from them.
- **Tracking model — hybrid:**
  - *Session mode* (v0.1, core): explicit START/STOP walk recording. Foreground GPS,
    ~5 s / 5 m updates, live fog reveal. Needs only "While Using" location permission.
  - *Scout mode* (v0.3): opt-in low-power background monitoring; when the user is walking
    (not driving) in an unvisited cell, a local notification prompts them to record.
    Needs "Always" permission.
- **GPS hygiene:** drop fixes with accuracy worse than 35 m; ignore movement faster than
  15 km/h (driving must not unlock); mark a new cell only after ~12 m of movement.
- **Reveal geometry:** fog is one world-covering polygon with a circular hole
  (radius 55 m, 24-segment ring) punched at each visited cell's center.
- **Monetization (distant future, don't build):** street-segment completion / "% of every
  street walked" as a potential premium tier. Only relevance today: it's the reason we
  keep raw GPS traces.

## 3. Current state — v0.1 scaffold, July 2026

### What exists and is believed working

| File | Lines | Role |
|---|---|---|
| `App.tsx` | 39 | Entry: `initDb()` → load visited cells from SQLite → render `MapScreen` with them (fog persists across launches). Loading spinner meanwhile. |
| `src/mapStyle.ts` | 108 | Complete MapLibre `StyleSpecification`, ported 1:1 from the approved prototype. Do not tweak colors without Daniel's sign-off. |
| `src/db.ts` | 60 | `expo-sqlite` (async API, WAL). Tables: `walks(id, started_at, ended_at, distance_m)`, `gps_points(id, walk_id, lat, lng, accuracy, speed, ts)`, `visited_cells(h3_index PK)`. |
| `src/h3utils.ts` | 62 | Constants (`H3_RES=11`, `REVEAL_M=55`, `MARK_M=12`, `MAX_ACCURACY_M=35`, `MAX_SPEED_MS≈4.17`), `coordToCell`, `haversineM`, `circleRing` (clockwise = hole winding), `buildFogShape` (world polygon + holes). |
| `src/useWalkSession.ts` | 103 | The recording hook. `startSession`: request permission → insert `walks` row → `watchPositionAsync(BestForNavigation, 5000ms, 5m)`. Each fix: hygiene filters → store raw point → accumulate haversine distance → mark cell if ≥12 m since last mark. `stopSession`: unsubscribe + finalize walk row. Exposes `{isRecording, visitedCells, distanceM, position, startSession, stopSession}`. |
| `src/MapScreen.tsx` | 201 | Map + `Camera` (initial center Amsterdam `[4.8952, 52.3702]`, zoom 14) + fog GeoJSON fill layer + user-position dot (white, cyan halo) + HUD (title, km walked, cells revealed, ⊙ center-on-me button, START/STOP WALK button). |
| `prototype/index.html` | — | The original single-file browser prototype (MapLibre GL JS + canvas fog, click-to-walk simulation). Reference only — the approved look lives here. Don't port more from it; the style is already ported. |
| `ios/` | — | Generated July 2026 by `expo prebuild` + `pod install` on Daniel's Mac. `Fogwalk.xcworkspace` is the thing Xcode opens. Regenerable at any time (see §5) — never hand-edit; put config in `app.json`. |

### What has NOT been done yet (the immediate frontier)

1. **The app has never been run.** TypeScript compiles (`npx tsc --noEmit` passes) but no
   simulator or device build has succeeded yet. Expect first-run issues.
2. **⚠️ Highest-risk item — MapLibre RN component API.** `MapScreen.tsx` imports
   `{ Map, Camera, GeoJSONSource, Layer }` and passes `initialViewState` to `Camera`.
   Verify against the actually-installed `@maplibre/maplibre-react-native` v11 API
   (check `node_modules/@maplibre/maplibre-react-native/lib/typescript/` or its README).
   Historically this library exported `MapView`, `ShapeSource`, `FillLayer`,
   `CircleLayer`, and `Camera` with `defaultSettings={{centerCoordinate, zoomLevel}}`.
   If the current imports don't exist, rewrite `MapScreen.tsx` to the real API,
   preserving behavior: one fill layer for fog, two circle layers for the user dot,
   camera `flyTo`/`setCamera` on the ⊙ button.
3. **Signing:** Daniel must select his Personal Team in Xcode once
   (Fogwalk target → Signing & Capabilities → Automatically manage signing). An agent
   cannot do this; ask him.
4. Nothing from v0.2+ exists: no stats screen, no walk history, no scout mode, no
   Android testing, no app icon artwork (placeholder assets in `assets/`).

## 4. Architecture — how it works and why

### 4.1 Data flow (session recording)

```
GPS fix (expo-location, ~5s/5m)
  → hygiene gate: accuracy ≤ 35 m AND speed ≤ 15 km/h, else drop
  → setPosition (drives user dot)
  → INSERT raw point into gps_points (never skipped — source of truth)
  → distance += haversine(prev, cur)
  → if moved ≥ 12 m since last mark:
       cellId = latLngToCell(lat, lng, 11)
       if new: add to in-memory Set + INSERT OR IGNORE into visited_cells
  → visitedCells Set identity change → useMemo rebuilds fog GeoJSON → map re-renders
```

### 4.2 Why H3 cells (res 11)

- "Have I been here?" is an O(1) Set lookup — essential for scout mode later.
- Stats are trivial: revealed km² ≈ cells × 2,149.6 m²; "% of city" = visited ÷
  `polygonToCells(cityBoundary, 11)`.
- ~24 m cell ≈ GPS accuracy on a phone; finer would create swiss-cheese noise,
  coarser would reveal streets the user never walked.
- Cells are an index, not truth — if we ever change resolution, rebuild the table
  by replaying `gps_points`.

### 4.3 Fog rendering

One GeoJSON `Feature<Polygon>`: outer ring covers the world (±180, ±85.05), each visited
cell contributes a clockwise 24-point circle (r = 55 m) as an interior hole. Rendered as
a MapLibre `fill` layer, `rgba(5,7,10,0.90)` — 90% opacity so faint street "ghosts" tease
through the fog. Holes overlap (55 m radius ≫ 12 m mark spacing) so a walked path is a
continuous corridor, not beads.

**Known scaling wall:** rebuilding one polygon with N holes on every new cell is fine for
hundreds of cells, sluggish by ~2–5k, unusable by tens of thousands. When it hurts (likely
v0.2), options in order of preference:
1. Split fog into two sources: static (all cells at session start, built once) + live
   (only this session's new cells); merge into static on session stop.
2. Only include holes within the current viewport bounds (rebuild on camera idle).
3. Pre-merge holes into a MultiPolygon with turf `union` incrementally.
Don't optimize before it's actually slow on Daniel's phone.

### 4.4 Map style (approved — treat as design-frozen)

Apple-Maps-dark-mode × GTA 5 pause-map. `src/mapStyle.ts` is the single source of truth;
the table below is for orientation:

| Element | Color |
|---|---|
| Fog | `rgba(5,7,10,0.90)` |
| Land | `#141a23` · Buildings `#1c2431` · Water `#2a5f7e` · Parks `#1f3d2b` |
| Roads | brightness ladder `#5f6f88` (residential) → `#c9d4e2` (motorway, "GTA white") |
| Labels | roads `#aebfd4`, minor places `#8fa1b8`, major `#e4ebf4`, all on `#0d1219` halo |
| Accent (HUD/user halo) | `#7fd4ff` cyan |

### 4.5 Database rules

- `visited_cells` has no per-walk info by design (global exploration state).
- `gps_points.walk_id` → `walks.id`; points arrive only while recording.
- Additive schema changes only; if a migration is ever needed, write it in `initDb`
  guarded by `PRAGMA user_version`. **Never** drop `gps_points` or `visited_cells`.

## 5. Build & run — exact procedure (Mac)

```bash
cd /Users/user/Xplore
npm install                                   # if node_modules missing
npx tsc --noEmit                              # typecheck — keep this green

# Regenerate native project (only when app.json/plugins/deps change, or ios/ is missing):
npx expo prebuild --platform ios

# CocoaPods — BOTH env vars are required on this machine (see gotchas):
cd ios && LANG=en_US.UTF-8 SSL_CERT_FILE=/etc/ssl/cert.pem pod install && cd ..

# Run on iOS Simulator (no signing needed; good first target):
npx expo run:ios
# Run on Daniel's iPhone (plugged in, Developer Mode on, signing configured):
npx expo run:ios --device
```

**Environment gotchas discovered the hard way (July 2026):**
- `pod install` crashes with `Unicode Normalization not appropriate for ASCII-8BIT`
  unless `LANG=en_US.UTF-8` is set (Homebrew Ruby, non-interactive shells).
- CocoaPods CDN fails TLS (`certificate verify failed`) unless
  `SSL_CERT_FILE=/etc/ssl/cert.pem` is set.
- CocoaPods installed via Homebrew (`brew install cocoapods`), Xcode 26.6 with iOS 26.5
  platform support, Node v24.
- Open `ios/Fogwalk.xcworkspace` in Xcode, never `Fogwalk.xcodeproj`.

**Testing GPS without walking:** Simulator → *Features → Location → City Run / Freeway
Drive* (Freeway Drive should reveal nothing — speed filter; City Run should paint a
corridor). On device, real walks are the ultimate test.

**Free Apple account limits:** app provisioning expires after **7 days** — the app stops
launching until rebuilt from Xcode/`run:ios`. Annoying but fine for dogfooding. A paid
account ($99/yr) or TestFlight fixes it later; don't push Daniel about it.

## 6. Roadmap with acceptance criteria

### v0.1 — "It runs and reveals" (current milestone, almost there)

Tasks, in order:
1. Fix `MapScreen.tsx` against the real MapLibre RN v11 API (§3 risk item).
2. Build to Simulator; verify: dark styled map renders, fog covers it, City Run
   simulation punches a growing corridor, HUD stats tick up.
3. Daniel does signing; build to his iPhone; he takes a real walk.
4. Fix whatever the real walk reveals (GPS noise, battery, fog perf).

**Done when:** Daniel walks a 15-minute loop; fog reveals live along the route; app
relaunch shows the same revealed area; a drive reveals nothing; typecheck green.

### v0.2 — "It's a habit" (stats + history)

- Stats panel: lifetime km (SUM over `walks`), revealed area in km²
  (`cells × 2149.6 / 1e6`), % of home city — fetch city boundary polygon once
  (OSM/Nominatim), `polygonToCells(boundary, 11)`, store the count, compute ratio.
- Walk history list: per-walk date, duration, distance, cells gained (needs a
  `cells_gained` column or per-walk cell count — additive migration).
- Tapping a walk shows its trace (polyline from `gps_points`) on the map.
- Likely forced here: the fog-performance fix from §4.3.

**Done when:** Daniel can answer "how much of Amsterdam have I uncovered?" from the app.

### v0.3 — "It taps you on the shoulder" (scout mode)

- Opt-in toggle. Upgrade to "Always" location + notification permissions (new
  `app.json` strings → `prebuild` again).
- iOS significant-location-change / geofencing via `expo-location` +
  `expo-task-manager` background task: on wake, if current cell unvisited AND motion
  ≈ walking → local notification ("Unexplored territory — record this walk?") → tap
  opens app, auto-starts session. Cooldown (e.g., ≥30 min between prompts).
- Battery drain must be imperceptible; measure over a normal day before calling done.

### Later / parked (do not start unprompted)

Street-segment completion (OSM map-matching, "100% of Jordaan walked") as premium ·
cloud backup / device migration (raw-trace export first — cheap insurance, could land
earlier as a JSON export button) · Android pass · social/sharing · App Store release.

## 7. Working agreements for any agent on this repo

1. `npx tsc --noEmit` green before claiming anything done. No test framework yet;
   verification = running the app (Simulator location simulation counts).
2. Don't churn the approved visual style or the locked decisions (§2).
3. Protect user data above all: no schema change may orphan `gps_points` or
   `visited_cells`.
4. Native config lives in `app.json` (then `prebuild`), never hand-edits under `ios/`.
5. Keep `CLAUDE.md` (quick reference) and this file updated as facts change —
   especially "Current state" (§3) after each milestone.
6. Prefer boring code: this is a small personal app, not a framework. No state
   libraries, no navigation library until a second screen actually exists (v0.2 —
   `@react-navigation` or `expo-router` then, not before).
7. When something needs Daniel (signing, Apple ID, design taste, real-walk testing),
   ask — don't fake it or work around it.
