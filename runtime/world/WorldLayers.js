// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// WorldLayers.js - Visual/overlay/grid canonicalization for zones
// ============================================================
// Purpose:
// - split the zone into render-friendly buckets without changing gameplay
// - keep collision/nav/query/debug concerns explicit
// - provide a single place for future depth/atmosphere upgrades

import { TerrainThemes } from './TerrainThemes.js';

const ATMOSPHERE_DECOS = new Set(['dust_cloud', 'nebula_patch']);

const LANDMARK_DECOS = new Set([
  'rock_formation', 'ice_cluster', 'ancient_marker', 'dead_ship', 'mining_rig',
  'station_hull', 'antenna_array', 'cargo_pod', 'solar_panel', 'gas_cloud',
  'comet_trail', 'beacon_ruins'
]);

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function biomeDepthBias(biome) {
  switch (biome) {
    case 'void': return 0.12;
    case 'nebula': return 0.09;
    case 'blackhole': return 0.14;
    case 'derelict': return 0.07;
    default: return 0.04;
  }
}

export const WorldLayers = {
  ensureZone(zone, actConfig = null, depth = 1) {
    if (!zone) return null;
    const cacheKey = [
      zone.seed,
      zone.biome || actConfig?.biome || 'space',
      zone.surfaceTheme || actConfig?.surfaceTheme || '',
      depth,
      zone.obstacles?.length || 0,
      zone.decorations?.length || 0,
      zone.structures?.length || 0,
      zone.pois?.length || 0,
      zone.branchExits?.length || 0,
      zone.resourceNodes?.length || 0,
      zone.layout?.rooms?.length || 0,
      zone.layout?.corridors?.length || 0
    ].join('|');
    if (zone._layerState?.cacheKey === cacheKey) return zone._layerState;

    const profile = this.buildDepthProfile(zone, actConfig, depth);
    const decorations = Array.isArray(zone.decorations) ? zone.decorations : [];
    const obstacles = Array.isArray(zone.obstacles) ? zone.obstacles : [];
    const structures = Array.isArray(zone.structures) ? zone.structures : [];

    const wallObstacles = [];
    const interactiveObstacles = [];
    const hazardFields = [];
    for (const obs of obstacles) {
      if (!obs) continue;
      if (obs.type === 'poison_area') {
        hazardFields.push(obs);
      } else if (obs.type === 'mine' || obs.type === 'resource_node' || obs.type === 'generator') {
        interactiveObstacles.push(obs);
      } else {
        wallObstacles.push(obs);
      }
    }

    const layerState = {
      cacheKey,
      profile,
      layers: {
        atmosphereBack: decorations.filter(d => d && ATMOSPHERE_DECOS.has(d.type)),
        landmarks: decorations.filter(d => d && LANDMARK_DECOS.has(d.type)),
        microDecorations: decorations.filter(d => d && !ATMOSPHERE_DECOS.has(d.type) && !LANDMARK_DECOS.has(d.type)),
        wallObstacles,
        interactiveObstacles,
        hazardFields,
        structuresScene: structures,
        poiOverlay: Array.isArray(zone.pois) ? zone.pois : [],
        exitOverlay: Array.isArray(zone.branchExits) && zone.branchExits.length ? zone.branchExits : (zone.exit ? [zone.exit] : [])
      },
      grids: {
        collision: this.buildCollisionMeta(zone, wallObstacles, interactiveObstacles, structures),
        navigation: this.buildNavigationMeta(zone),
        query: {
          cellSize: 128,
          mode: 'runtime-spatial-hash',
          enemyCount: Array.isArray(zone.enemySpawns) ? zone.enemySpawns.length : 0,
          eliteCount: Array.isArray(zone.eliteSpawns) ? zone.eliteSpawns.length : 0,
          poiCount: Array.isArray(zone.pois) ? zone.pois.length : 0
        },
        debug: {
          seed: zone.seed,
          biome: zone.biome || actConfig?.biome || 'space',
          hasLayout: !!zone.layout,
          hasTileBackdrop: !!zone._bg,
          hasBranchExits: !!(zone.branchExits && zone.branchExits.length),
          isBossZone: !!zone.isBossZone,
          terrainThemeId: profile?.terrainThemeId || null,
          terrainSurfaceMode: profile?.terrainSurfaceMode || 'space'
        }
      },
      terrainTheme: TerrainThemes.resolveTheme(zone, actConfig, depth),
      overlays: {
        poiCount: Array.isArray(zone.pois) ? zone.pois.length : 0,
        hasObjective: !!zone.objective,
        hasBranchExits: !!(zone.branchExits && zone.branchExits.length),
        hasMainExit: !!zone.exit,
        hasPortals: !!(zone.portals && zone.portals.length),
        lockedExit: !!(zone.objective && zone.objective.exitLocked && !zone.objective.complete)
      }
    };

    zone._layerState = layerState;
    return layerState;
  },

  buildDepthProfile(zone, actConfig = null, depth = 1) {
    const biome = zone?.biome || actConfig?.biome || 'space';
    const depthFactor = clamp((depth - 1) / 75, 0, 1);
    const biomeBias = biomeDepthBias(biome);
    const terrainTheme = TerrainThemes.resolveTheme(zone, actConfig, depth);
    return {
      biome,
      depth,
      depthFactor,
      terrainThemeId: terrainTheme?.themeId || null,
      terrainSurfaceMode: terrainTheme?.surfaceMode || 'space',
      terrainBackdropAlpha: terrainTheme?.backdropAlpha || 0,
      terrainRoomFloorAlpha: terrainTheme?.roomFloorAlphaResolved || 0,
      terrainAtmosphereTint: terrainTheme?.atmosphereTint || null,
      terrainFogTint: terrainTheme?.fogTint || null,
      terrainFogProfile: terrainTheme?.fogProfileResolved || null,
      atmosphereAlpha: 1 + depthFactor * 0.28 + biomeBias,
      roomGlowAlpha: 1 + depthFactor * 0.42,
      wallAlpha: 1 + depthFactor * 0.10,
      landmarkAlpha: 1 + depthFactor * 0.16,
      microDecoAlpha: 1 + depthFactor * 0.08,
      foregroundWispAlpha: 1 + depthFactor * 0.18 + biomeBias * 0.35,
      structureGlowAlpha: 1 + depthFactor * 0.24,
      shadowAlpha: 0.16 + depthFactor * 0.10 + biomeBias * 0.25,
      corridorFogAlpha: 0.05 + depthFactor * 0.08 + biomeBias * 0.18,
      roomEdgeShadowAlpha: 0.04 + depthFactor * 0.05 + biomeBias * 0.08,
      landmarkHaloAlpha: 0.10 + depthFactor * 0.08 + biomeBias * 0.18,
      ambientFogAlpha: 0.04 + depthFactor * 0.05 + biomeBias * 0.14,
      vignetteAlpha: 0.14 + depthFactor * 0.10 + biomeBias * 0.10,
      foregroundVeilAlpha: 0.05 + depthFactor * 0.07 + biomeBias * 0.16,
      portalBloomAlpha: 0.12 + depthFactor * 0.06,
      floorContrast: 1 + depthFactor * 0.06
    };
  },

  buildCollisionMeta(zone, wallObstacles = [], interactiveObstacles = [], structures = []) {
    const structureColliders = structures.reduce((sum, s) => sum + ((s?.colliders?.length) || 0), 0);
    return {
      wallCount: wallObstacles.length,
      interactiveCount: interactiveObstacles.length,
      structureCount: structures.length,
      structureColliderCount: structureColliders,
      resourceNodeCount: Array.isArray(zone.resourceNodes) ? zone.resourceNodes.length : 0,
      obstacleCount: Array.isArray(zone.obstacles) ? zone.obstacles.length : 0
    };
  },

  buildNavigationMeta(zone) {
    const layout = zone?.layout;
    return {
      hasLayout: !!layout,
      roomCount: layout?.rooms?.length || 0,
      corridorCount: layout?.corridors?.length || 0,
      branchExitCount: Array.isArray(zone?.branchExits) ? zone.branchExits.length : 0,
      portalCount: Array.isArray(zone?.portals) ? zone.portals.length : 0,
      spawn: zone?.spawn ? { x: zone.spawn.x, y: zone.spawn.y } : null,
      exit: zone?.exit ? { x: zone.exit.x, y: zone.exit.y } : null
    };
  }
};

export default WorldLayers;
