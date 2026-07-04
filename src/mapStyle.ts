import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';

// Ported 1:1 from prototype/index.html STYLE constant.
// Apple-Maps-dark × GTA 5 pause-map palette — approved by Daniel, July 2026.
const MAP_STYLE: StyleSpecification = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#141a23' } },
    {
      id: 'landcover-green', type: 'fill', source: 'omt', 'source-layer': 'landcover',
      filter: ['in', ['get', 'class'], ['literal', ['grass', 'wood', 'scrub', 'farmland']]],
      paint: { 'fill-color': '#1f3d2b' },
    },
    {
      id: 'landuse-green', type: 'fill', source: 'omt', 'source-layer': 'landuse',
      filter: ['in', ['get', 'class'], ['literal', ['park', 'garden', 'grass', 'pitch', 'playground', 'recreation_ground', 'cemetery', 'allotments', 'village_green']]],
      paint: { 'fill-color': '#1f3d2b' },
    },
    { id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park', paint: { 'fill-color': '#1f3d2b' } },
    { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': '#2a5f7e' } },
    {
      id: 'waterway', type: 'line', source: 'omt', 'source-layer': 'waterway',
      paint: { 'line-color': '#2a5f7e', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 16, 3] },
    },
    {
      id: 'buildings', type: 'fill', source: 'omt', 'source-layer': 'building',
      minzoom: 13,
      paint: { 'fill-color': '#1c2431' },
    },
    {
      id: 'aeroway', type: 'line', source: 'omt', 'source-layer': 'aeroway',
      paint: { 'line-color': '#3d4655', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 16, 6] },
    },
    {
      id: 'road-path', type: 'line', source: 'omt', 'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['path', 'track']]],
      minzoom: 13,
      paint: { 'line-color': '#404b5c', 'line-dasharray': [2, 1.5], 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.5, 18, 2] },
    },
    {
      id: 'road-service', type: 'line', source: 'omt', 'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['service', 'raceway']]],
      minzoom: 13,
      paint: { 'line-color': '#48546a', 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.6, 18, 4] },
    },
    {
      id: 'road-minor', type: 'line', source: 'omt', 'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['minor', 'unclassified', 'residential', 'living_street', 'pedestrian']]],
      paint: { 'line-color': '#5f6f88', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 13, 1.4, 16, 4, 18, 10] },
    },
    {
      id: 'road-tertiary', type: 'line', source: 'omt', 'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['tertiary']]],
      paint: { 'line-color': '#75879f', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 13, 2, 16, 5, 18, 12] },
    },
    {
      id: 'road-secondary', type: 'line', source: 'omt', 'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['secondary']]],
      paint: { 'line-color': '#8b9cb4', 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1, 13, 2.5, 16, 6, 18, 14] },
    },
    {
      id: 'road-primary', type: 'line', source: 'omt', 'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['primary']]],
      paint: { 'line-color': '#a7b7cc', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 13, 3, 16, 7, 18, 16] },
    },
    {
      id: 'road-major', type: 'line', source: 'omt', 'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk']]],
      paint: { 'line-color': '#c9d4e2', 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 1.2, 13, 3.5, 16, 8, 18, 18] },
    },
    {
      id: 'rail', type: 'line', source: 'omt', 'source-layer': 'transportation',
      filter: ['==', ['get', 'class'], 'rail'],
      minzoom: 12,
      paint: { 'line-color': '#333e4e', 'line-dasharray': [3, 3], 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.8, 18, 2.5] },
    },
    {
      id: 'boundary', type: 'line', source: 'omt', 'source-layer': 'boundary',
      filter: ['<=', ['get', 'admin_level'], 6],
      paint: { 'line-color': '#2e3c50', 'line-dasharray': [3, 2], 'line-width': 1 },
    },
    {
      id: 'road-label', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name',
      minzoom: 14,
      layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 11 },
      paint: { 'text-color': '#aebfd4', 'text-halo-color': '#0d1219', 'text-halo-width': 1.4 },
    },
    {
      id: 'place-minor', type: 'symbol', source: 'omt', 'source-layer': 'place',
      filter: ['in', ['get', 'class'], ['literal', ['suburb', 'neighbourhood', 'quarter', 'village']]],
      minzoom: 11,
      layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-transform': 'uppercase', 'text-letter-spacing': 0.1 },
      paint: { 'text-color': '#8fa1b8', 'text-halo-color': '#0d1219', 'text-halo-width': 1.4 },
    },
    {
      id: 'place-major', type: 'symbol', source: 'omt', 'source-layer': 'place',
      filter: ['in', ['get', 'class'], ['literal', ['city', 'town']]],
      layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 16, 'text-transform': 'uppercase', 'text-letter-spacing': 0.15 },
      paint: { 'text-color': '#e4ebf4', 'text-halo-color': '#0d1219', 'text-halo-width': 1.6 },
    },
  ],
};

export default MAP_STYLE;
