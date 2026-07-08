# FOGWALK

> **Full handoff doc: `PLAN.md`** — detailed vision, current state, build gotchas,
> roadmap with acceptance criteria. Read it before starting significant work.

A mobile app that shows where you have and haven't walked in your city. GTA 5-style map:
the world starts under near-black fog and streets/places reveal as you physically visit them.
For exploration, not navigation.

## Product decisions (locked in July 2026)

- **Platform:** React Native + Expo. iPhone-first (dev on Mac, dogfooding on Daniel's iPhone), Android later.
- **Tracking model:** hybrid.
  - *Session mode* (core): explicit start/stop walk recording, foreground GPS ~5s interval,
    live fog reveal. "While Using" location permission only.
  - *Scout mode* (phase 2): low-power background monitoring (significant-location-change on iOS);
    when the user enters an unvisited cell while walking (motion API check, not driving),
    fire a local notification prompting them to start recording. Opt-in, needs "Always" permission.
- **Unlock model:** fog reveal first. Street-segment completion (OSM map-matching, "% of city
  walked" stats) comes later as a potential premium feature.
- **Scope:** personal MVP — local-only data, no accounts, no server.

## Architecture

- **Visited-area model:** H3 hex cells (~res 11). A walk = GPS points → set of visited cell IDs
  in SQLite. Fog is rendered from the cell set; "am I somewhere new?" (scout mode) is an O(1)
  cell lookup; stats = visited cells ÷ cells in city boundary.
- **Keep raw GPS traces** as source of truth (cells are a derived index) so street-matching can
  be computed retroactively over historical walks when the premium feature lands.
- **GPS hygiene:** drop points with accuracy worse than ~35 m; ignore movement over ~15 km/h
  (driving shouldn't unlock); simplify traces (Douglas-Peucker) before storing.
- **Map:** MapLibre GL with vector tiles (OpenFreeMap) and a fully custom style — see palette.
  Fog = overlay revealing soft-edged holes (radius ~55 m) around visited cells over the styled map.

## Visual spec (validated via prototype/index.html, approved by Daniel)

Apple-Maps-dark-mode × GTA 5 pause-map. Palette (in the prototype's `STYLE` object):

| Element        | Color     | Note |
|----------------|-----------|------|
| Fog (locked)   | `rgba(5,7,10,0.90)` | near-black, faint street ghosts show through |
| Base/land      | `#141a23` | dark blue-grey |
| Buildings      | `#1c2431` | |
| Water          | `#2a5f7e` | petrol/teal blue — chosen to pair with the olive green |
| Parks/green    | `#1f3d2b` | olive green (landcover grass/wood + landuse parks + park layer) |
| Streets        | `#5f6f88` → `#c9d4e2` | brightness ladder: residential → motorway (GTA white) |
| Road labels    | `#aebfd4` on `#0d1219` halo, zoom 14+ |
| Place labels   | `#8fa1b8` minor / `#e4ebf4` major, uppercase, letter-spaced |

Reveal tunables: cell grid ~24 m (H3 res 11), reveal radius 48 m (tightened from
55 m after real-walk feedback), mark a cell every 12 m of movement. Fog edge is
feathered with a blurred line layer.

## Prototype

`prototype/index.html` (originally `index.html`) — single-file MapLibre GL JS + canvas fog,
click-to-walk simulation, paint mode, localStorage persistence. Serve statically
(`py -m http.server` / `npx serve`); geolocation button needs localhost or https.
Its `STYLE` JSON is the app's map style — port it into the RN MapLibre component as-is.
Known prototype limits (fine to ignore): fog redraws every gradient per frame (real app should
cache fog to tiles), walker moves in straight lines (no street snapping).

## Roadmap

1. **v0.1** — Expo app: MapLibre map with fog style, session recording, live reveal, walks in SQLite.
2. **v0.2** — Stats (km, km² revealed, % of city boundary), walk history.
3. **v0.3** — Scout mode notifications.
4. **Later/premium** — street-segment completion, cloud backup, social.
