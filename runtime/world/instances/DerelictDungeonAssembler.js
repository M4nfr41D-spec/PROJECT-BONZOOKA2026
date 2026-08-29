// v2166A29 — isolated derelict instance assembler with direct tile coupling

import { SeededRandom } from '../SeededRandom.js';
import { DerelictTileManifest, getDerelictTileModule } from './DerelictTileManifest.js';
import { buildBoundaryColliders, buildInstanceGrid, connectionPointInside, moduleConnectionAnchor, normalizeRotationDeg } from './DerelictTileGeometry.js';

const MODULE_STEP = 1024;
const WORLD_MARGIN = 900;
const INSTANCE_COLLISION_ENABLED = false;

function makeModulePlacement(spec, idx, originX, originY) {
  const moduleDef = getDerelictTileModule(spec.moduleId);
  if (!moduleDef) throw new Error(`Unknown derelict tile module: ${spec.moduleId}`);
  return {
    id: spec.id || `inst_mod_${idx}`,
    moduleId: moduleDef.id,
    role: spec.role || moduleDef.role || 'room',
    x: originX + spec.gx * MODULE_STEP,
    y: originY + spec.gy * MODULE_STEP,
    gx: spec.gx,
    gy: spec.gy,
    size: moduleDef.worldSize || MODULE_STEP,
    rotationDeg: normalizeRotationDeg(spec.rotationDeg || 0),
    imagePath: moduleDef.imagePath,
    metadataPath: moduleDef.metadataPath || null,
    shape: moduleDef.shape,
    exits: moduleDef.exits,
    exitWidths: moduleDef.exitWidths
  };
}

const TEMPLATE_VARIANTS = [
  [
    { id: 'entry', moduleId: 'corridor_h_e4w2', gx: 0, gy: 0, rotationDeg: 0, role: 'entry' },
    { id: 'hub', moduleId: 'junction_cross', gx: 1, gy: 0, rotationDeg: 0, role: 'hub' },
    { id: 'east_spine', moduleId: 'corridor_h_e4w2', gx: 2, gy: 0, rotationDeg: 0, role: 'corridor' },
    { id: 'objective_room', moduleId: 'junction_t_north', gx: 3, gy: 0, rotationDeg: 180, role: 'objective_room' },
    { id: 'north_branch', moduleId: 'corridor_v_s2', gx: 1, gy: -1, rotationDeg: 0, role: 'north_branch' },
    { id: 'reward_room', moduleId: 'junction_t_north_n2e4w4', gx: 1, gy: -2, rotationDeg: 0, role: 'reward_room' },
    { id: 'south_branch', moduleId: 'corridor_v_s2', gx: 1, gy: 1, rotationDeg: 180, role: 'south_branch' }
  ],
  [
    { id: 'entry', moduleId: 'corridor_h_e4w2', gx: 0, gy: 0, rotationDeg: 0, role: 'entry' },
    { id: 'mid_spine', moduleId: 'corridor_h_e4w2', gx: 1, gy: 0, rotationDeg: 0, role: 'corridor' },
    { id: 'hub', moduleId: 'junction_cross', gx: 2, gy: 0, rotationDeg: 0, role: 'hub' },
    { id: 'east_spine', moduleId: 'corridor_h_e4w2', gx: 3, gy: 0, rotationDeg: 0, role: 'corridor' },
    { id: 'objective_room', moduleId: 'junction_t_north', gx: 4, gy: 0, rotationDeg: 180, role: 'objective_room' },
    { id: 'reward_turn', moduleId: 'corner_ne_n4e4', gx: 2, gy: -1, rotationDeg: 180, role: 'reward_turn' },
    { id: 'reward_room', moduleId: 'junction_t_north', gx: 3, gy: -1, rotationDeg: 90, role: 'reward_room' }
  ]
];

// Single-connected-component check on a template's stamped grid.
function floodFraction(grid) {
  if (!grid) return 0;
  const { cells, cols, rows } = grid;
  let total = 0, start = null;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (cells[y][x] === 1) { total++; if (!start) start = [x, y]; }
  }
  if (!total || !start) return 0;
  const seen = new Set(); const k = (x, y) => x + ',' + y; const q = [start];
  seen.add(k(start[0], start[1]));
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && cells[ny][nx] === 1 && !seen.has(k(nx, ny))) {
        seen.add(k(nx, ny)); q.push([nx, ny]);
      }
    }
  }
  return seen.size / total;
}

function templateIsConnected(template) {
  try {
    const mods = template.map((spec, idx) => makeModulePlacement(spec, idx, 0, 0));
    return floodFraction(buildInstanceGrid(mods)) > 0.999;
  } catch (e) {
    return false;
  }
}

// Never ship a disconnected dungeon: fall back to the first proven layout.
function pickConnectedTemplate(rng) {
  const pick = rng.pick(TEMPLATE_VARIANTS);
  if (templateIsConnected(pick)) return pick;
  const proven = TEMPLATE_VARIANTS.find(templateIsConnected);
  return proven || TEMPLATE_VARIANTS[0];
}

function buildStructures(modules) {
  if (!INSTANCE_COLLISION_ENABLED) return [];
  return modules.map((mod, idx) => ({
    id: `der_struct_${idx}`,
    variant: 'metal',
    material: { primary: '#1a1d24', secondary: '#2d3340', accent: '#55606e', edge: '#8f9daf', glow: 'rgba(140,170,220,0.15)' },
    bounds: { x: mod.x, y: mod.y, radius: mod.size * 0.8 },
    colliders: buildBoundaryColliders(getDerelictTileModule(mod.moduleId), mod, mod.rotationDeg),
    segments: [],
    collision: true
  }));
}

function buildEnemySpawns(modules, rng) {
  const spawns = [];
  const spawnIn = (moduleId, count, pool = ['grunt']) => {
    const mod = modules.find(m => m.id === moduleId);
    if (!mod) return;
    for (let i = 0; i < count; i++) {
      spawns.push({
        x: mod.x + rng.range(-160, 160),
        y: mod.y + rng.range(-160, 160),
        type: rng.pick(pool),
        active: false,
        killed: false
      });
    }
  };
  spawnIn('hub', 4, ['grunt', 'shielder']);
  spawnIn('reward_room', 3, ['grunt', 'repair_drone']);
  spawnIn('objective_room', 5, ['grunt', 'commander']);
  return spawns;
}

function buildPois(modules) {
  const rewardRoom = modules.find(m => m.id === 'reward_room');
  const objectiveRoom = modules.find(m => m.id === 'objective_room' || m.role === 'objective_room');
  const entry = modules.find(m => m.id === 'entry');
  const pois = [];
  if (rewardRoom) {
    pois.push({
      id: 'inst_reward_cache',
      type: 'treasure_cache',
      x: rewardRoom.x,
      y: rewardRoom.y,
      radius: 160,
      icon: '💠',
      label: 'Derelict Cache',
      reward: { type: 'loot_cache', rarity: 'rare', scrap: 140, cells: 25 },
      enemies: [],
      obstacles: [],
      triggered: false,
      cleared: true,
      collected: false
    });
  }
  if (objectiveRoom) {
    pois.push({
      id: 'inst_control_node',
      type: 'guard_post',
      x: objectiveRoom.x,
      y: objectiveRoom.y,
      radius: 190,
      icon: '🖥️',
      label: 'Control Node',
      reward: { type: 'loot_cache', rarity: 'epic', scrap: 220, cells: 40 },
      enemies: [],
      obstacles: [],
      triggered: false,
      cleared: true,
      collected: false
    });
  }
  if (entry) {
    const exitPoint = connectionPointInside(entry, 'W', 180);
    pois.push({
      id: 'inst_return_console',
      type: 'instance_exit',
      x: exitPoint.x,
      y: exitPoint.y,
      radius: 120,
      icon: '↩',
      label: 'Return Airlock',
      interactable: true,
      triggered: true,
      cleared: true,
      collected: false,
      reward: null
    });
  }
  return pois;
}

function computeZoneBounds(modules) {
  const xs = modules.flatMap(m => [m.x - m.size / 2, m.x + m.size / 2]);
  const ys = modules.flatMap(m => [m.y - m.size / 2, m.y + m.size / 2]);
  const minX = Math.min(...xs) - WORLD_MARGIN;
  const maxX = Math.max(...xs) + WORLD_MARGIN;
  const minY = Math.min(...ys) - WORLD_MARGIN;
  const maxY = Math.max(...ys) + WORLD_MARGIN;
  return { width: maxX - minX, height: maxY - minY, minX, minY };
}

function rebaseModules(modules, minX, minY) {
  return modules.map(m => ({ ...m, x: m.x - minX, y: m.y - minY }));
}

export const DerelictDungeonAssembler = {
  buildFromPoi(poi, seed = null) {
    const rng = new SeededRandom(seed || SeededRandom.fromString(`derelict_inst_${poi?.id || 'seed'}`));
    const template = pickConnectedTemplate(rng);
    const rawModules = template.map((spec, idx) => makeModulePlacement(spec, idx, 0, 0));
    const bounds = computeZoneBounds(rawModules);
    const modules = rebaseModules(rawModules, bounds.minX, bounds.minY);

    const structures = buildStructures(modules);
    const enemySpawns = buildEnemySpawns(modules, rng);
    const pois = buildPois(modules);

    // Unified walk grid: single source of truth for collision + rendering.
    const instanceGrid = buildInstanceGrid(modules);

    const entry = modules.find(m => m.id === 'entry') || modules[0];
    const spawn = connectionPointInside(entry, 'W', 220);
    const returnPortalPoint = connectionPointInside(entry, 'W', 120);
    const objectiveRoom = modules.find(m => m.id === 'objective_room') || modules.find(m => m.role === 'objective_room') || modules[modules.length - 1];

    const zone = {
      seed: rng.seed || seed || 0,
      biome: 'derelict',
      width: bounds.width,
      height: bounds.height,
      spawn,
      exit: { x: objectiveRoom.x, y: objectiveRoom.y, radius: 90 },
      objective: {
        type: 'instance_explore',
        label: 'Clear the derelict interior',
        desc: 'Push through the station spine, loot the cache, then return through the airlock.',
        icon: '🏚️',
        progress: 0,
        target: 1,
        complete: false,
        exitLocked: false
      },
      instanceInfo: {
        type: 'derelict_tile_instance',
        family: DerelictTileManifest.family,
        sourcePoiId: poi?.id || null,
        sourcePoiType: poi?.type || null,
        floorTexturePath: DerelictTileManifest.floorTexturePath,
        directTileBound: true,
        disableStructureCollision: !INSTANCE_COLLISION_ENABLED,
        renderBackdrop: 'derelict_sanity'
      },
      instanceTiles: modules,
      instanceGrid,
      enemySpawns,
      eliteSpawns: [],
      bossSpawn: null,
      obstacles: [],
      structures,
      decorations: [],
      pois,
      portals: [
        { x: returnPortalPoint.x, y: returnPortalPoint.y, radius: 48, destination: 'return_instance', color: '#66ddff', label: 'AIRLOCK', icon: '↩' }
      ],
      branchExits: [],
      isBossZone: false,
      layout: null,
      modules: [],
      parallax: null,
      resourceNodes: []
    };
    return zone;
  }
};

export default DerelictDungeonAssembler;
