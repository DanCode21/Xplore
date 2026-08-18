import { latLngToCell, cellToLatLng } from 'h3-js';
import polygonClipping from 'polygon-clipping';

export const H3_RES = 11;
export const REVEAL_M = 48; // was 55; tightened ~13% (Daniel, July 2026: "discovered a little too much")
export const MARK_M = 12;
export const MAX_ACCURACY_M = 35;
export const MAX_SPEED_MS = 15000 / 3600; // 15 km/h in m/s

export function coordToCell(lat: number, lng: number): string {
  return latLngToCell(lat, lng, H3_RES);
}

export function cellCenter(cellId: string): [number, number] {
  return cellToLatLng(cellId) as [number, number];
}

export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// steps 36: smoother reveal edges (Daniel, Aug 2026) at modest extra union cost
export function circleRing(lat: number, lng: number, radiusM = REVEAL_M, steps = 36): [number, number][] {
  const dLat = radiusM / 111320;
  const dLng = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  const coords: [number, number][] = [];
  for (let i = steps; i >= 0; i--) {
    const angle = (i / steps) * 2 * Math.PI;
    coords.push([lng + dLng * Math.cos(angle), lat + dLat * Math.sin(angle)]);
  }
  return coords;
}

// Fog = world minus the union of all reveal circles, as a MultiPolygon.
// Overlapping circles must be unioned before subtraction: punching them
// individually as polygon holes makes the overlap regions render as fog
// again (earcut winding artifact).
export function buildFogShape(visitedCells: Set<string>): GeoJSON.Feature<GeoJSON.MultiPolygon> {
  const worldRing: [number, number][] = [
    [-180, -85.051129],
    [180, -85.051129],
    [180, 85.051129],
    [-180, 85.051129],
    [-180, -85.051129],
  ];
  const world: [number, number][][] = [worldRing];

  const circles: [number, number][][][] = [];
  for (const cellId of visitedCells) {
    const [lat, lng] = cellCenter(cellId);
    circles.push([circleRing(lat, lng)]);
  }

  const fog = circles.length === 0
    ? [world]
    : polygonClipping.difference(world, ...circles);

  return {
    type: 'Feature',
    geometry: { type: 'MultiPolygon', coordinates: fog },
    properties: {},
  };
}
