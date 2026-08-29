// v2166A30 — normalized direct tile-bound derelict instance module manifest
// Runtime now points at canonical asset-backed PNG+JSON pairs instead of tool-only sample paths.

export const DERELICT_TILE_WORLD_SIZE = 1024;
const ROOT = 'assets/instances/derelict_tiles/zone1';

const DERELICT_TILE_ALIASES = Object.freeze({
  corridor_h_e4w4: 'corridor_h_e4w2'
});

export const DerelictTileManifest = Object.freeze({
  family: 'derelict_station_zone1',
  semantics: Object.freeze({
    transparent: 'walkable_floor',
    blackBackground: 'solid_void',
    opaqueShell: 'solid_structure'
  }),
  floorTexturePath: 'assets/tiles/floor_metal.png',
  modules: Object.freeze([
    {
      id: 'corridor_h_e4w2',
      role: 'corridor',
      shape: 'Corridor H',
      sizeClass: 1,
      worldSize: DERELICT_TILE_WORLD_SIZE,
      exits: { N: false, S: false, E: true, W: true },
      exitWidths: { N: 2, S: 2, E: 4, W: 2 },
      imagePath: `${ROOT}/bonz-Corridor-H-1x-E4W2.png`,
      metadataPath: `${ROOT}/bonz-Corridor-H-1x-E4W2.json`
    },
    {
      id: 'junction_t_north_n2e4w4',
      role: 'junction',
      shape: 'T-North',
      sizeClass: 1,
      worldSize: DERELICT_TILE_WORLD_SIZE,
      exits: { N: true, S: false, E: true, W: true },
      exitWidths: { N: 2, S: 2, E: 4, W: 4 },
      imagePath: `${ROOT}/bonz-Corridor-H-1x-N2E4W4.png`,
      metadataPath: `${ROOT}/bonz-Corridor-H-1x-N2E4W4.json`
    },
    {
      id: 'corridor_v_s2',
      role: 'stub_corridor',
      shape: 'Corridor V',
      sizeClass: 1,
      worldSize: DERELICT_TILE_WORLD_SIZE,
      exits: { N: false, S: true, E: false, W: false },
      exitWidths: { N: 2, S: 2, E: 2, W: 2 },
      imagePath: `${ROOT}/bonz-Corridor-V-1x-S2.png`,
      metadataPath: `${ROOT}/bonz-Corridor-V-1x-S2.json`
    },
    {
      id: 'corridor_v_n4s6e2',
      role: 'special_corridor',
      shape: 'Corridor V',
      sizeClass: 4,
      worldSize: DERELICT_TILE_WORLD_SIZE * 4,
      exits: { N: true, S: true, E: true, W: false },
      exitWidths: { N: 4, S: 6, E: 2, W: 2 },
      imagePath: `${ROOT}/bonz-Corridor-V-4x-N4S6E2.png`,
      metadataPath: `${ROOT}/bonz-Corridor-V-4x-N4S6E2.json`
    },
    {
      id: 'corner_ne_n4e4',
      role: 'corner',
      shape: 'L-NorthEast',
      sizeClass: 1,
      worldSize: DERELICT_TILE_WORLD_SIZE,
      exits: { N: true, S: false, E: true, W: false },
      exitWidths: { N: 4, S: 2, E: 4, W: 2 },
      imagePath: `${ROOT}/bonz-L-NorthEast-1x-N4E4.png`,
      metadataPath: `${ROOT}/bonz-L-NorthEast-1x-N4E4.json`
    },
    {
      id: 'junction_t_north',
      role: 'junction',
      shape: 'T-North',
      sizeClass: 1,
      worldSize: DERELICT_TILE_WORLD_SIZE,
      exits: { N: true, S: false, E: true, W: true },
      exitWidths: { N: 4, S: 2, E: 4, W: 4 },
      imagePath: `${ROOT}/bonz-T-North-1x-N4E4W4.png`,
      metadataPath: `${ROOT}/bonz-T-North-1x-N4E4W4.json`
    },
    {
      id: 'junction_cross',
      role: 'junction_hub',
      shape: 'Cross',
      sizeClass: 1,
      worldSize: DERELICT_TILE_WORLD_SIZE,
      exits: { N: true, S: true, E: true, W: true },
      exitWidths: { N: 4, S: 4, E: 4, W: 4 },
      imagePath: `${ROOT}/bonz-Cross-1x-N4S4E4W4.png`,
      metadataPath: `${ROOT}/bonz-Cross-1x-N4S4E4W4.json`
    },
    {
      id: 'anchor_round_s2',
      role: 'anchor_room',
      shape: 'Round Room',
      sizeClass: 4,
      worldSize: DERELICT_TILE_WORLD_SIZE * 4,
      exits: { N: false, S: true, E: false, W: false },
      exitWidths: { N: 2, S: 2, E: 2, W: 2 },
      imagePath: `${ROOT}/bonz-Round-Room-4x-S2.png`,
      metadataPath: `${ROOT}/bonz-Round-Room-4x-S2.json`
    }
  ])
});

export function getDerelictTileModule(moduleId) {
  const resolvedId = DERELICT_TILE_ALIASES[moduleId] || moduleId;
  return DerelictTileManifest.modules.find(m => m.id === resolvedId) || null;
}

export function validateDerelictTileManifest() {
  const ids = new Set();
  const issues = [];
  for (const mod of DerelictTileManifest.modules) {
    if (ids.has(mod.id)) issues.push(`Duplicate module id: ${mod.id}`);
    ids.add(mod.id);
    if (!mod.imagePath) issues.push(`Missing imagePath: ${mod.id}`);
    if (!mod.metadataPath) issues.push(`Missing metadataPath: ${mod.id}`);
  }
  return issues;
}

export default DerelictTileManifest;
