// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// TerrainThemes.js - Surface registry + zone terrain theme profiles
// ============================================================
// Purpose:
// - canonical place for seamless terrain surfaces and biome/theme presets
// - keep visual ground identity separate from world logic and overlays
// - support future land zones without destabilizing current space content

import { SliceLock } from './SliceLock.js';

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function stableUnit(seed = 0, salt = 0) {
  let x = ((seed >>> 0) ^ (salt >>> 0) ^ 0x9E3779B9) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16;
  return x / 0xFFFFFFFF;
}


function isSurfaceAllowedForUsage(surface, usage) {
  if (!surface) return false;
  switch (usage) {
    case 'backdrop':
    case 'accent':
      return surface.kind === 'space' || surface.kind === 'land';
    case 'roomFloor':
      return surface.kind === 'land' || surface.kind === 'space';
    case 'transition':
      return surface.kind === 'transition';
    case 'macro':
      return surface.kind === 'macro';
    default:
      return true;
  }
}

function sanitizeSurfaceId(surfaceId, usage, fallbackId = null) {
  const primary = surfaceId ? SURFACES[surfaceId] : null;
  if (primary && isSurfaceAllowedForUsage(primary, usage)) return primary.id;
  const fallback = fallbackId ? SURFACES[fallbackId] : null;
  if (fallback && isSurfaceAllowedForUsage(fallback, usage)) return fallback.id;
  return null;
}

function canAutoRollTheme(themeId) {
  const theme = themeId ? THEMES[themeId] : null;
  return !!theme && theme.autoRollEnabled !== false;
}

function makeCanvas(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

const SURFACES = {
  // Existing in-project backdrop assets
  space_void: {
    id: 'space_void',
    path: 'assets/backgrounds/tile_void.webp',
    kind: 'space',
    tile: 1024,
    scale: 1.0,
    alpha: 0.18,
    drift: 0.032,
    blend: 'screen'
  },
  space_toxic: {
    id: 'space_toxic',
    path: 'assets/backgrounds/tile_toxicity.webp',
    kind: 'space',
    tile: 1024,
    scale: 1.0,
    alpha: 0.16,
    drift: 0.04,
    blend: 'screen'
  },
  space_ruins: {
    id: 'space_ruins',
    path: 'assets/backgrounds/tile_city_ruins.webp',
    kind: 'space',
    tile: 1024,
    scale: 1.0,
    alpha: 0.15,
    drift: 0.038,
    blend: 'multiply'
  },

  // Seamless land-ready tiles provided by the user
  land_industrial_dark: {
    id: 'land_industrial_dark',
    path: 'assets/terrain/land_industrial_dark.jpeg',
    kind: 'land',
    tile: 1024,
    scale: 1.0,
    alpha: 0.34,
    drift: 0.08,
    blend: 'source-over'
  },
  land_sand_dunes: {
    id: 'land_sand_dunes',
    path: 'assets/terrain/land_sand_dunes.jpeg',
    kind: 'land',
    tile: 1024,
    scale: 1.0,
    alpha: 0.36,
    drift: 0.07,
    blend: 'source-over'
  },
  land_steel_plate: {
    id: 'land_steel_plate',
    path: 'assets/terrain/land_steel_plate.jpeg',
    kind: 'land',
    tile: 1024,
    scale: 1.0,
    alpha: 0.30,
    drift: 0.065,
    blend: 'source-over'
  },
  land_sand_to_steel: {
    id: 'land_sand_to_steel',
    path: 'assets/terrain/land_sand_to_steel_transition.jpeg',
    kind: 'transition',
    tile: 1024,
    scale: 1.0,
    alpha: 0.28,
    drift: 0.075,
    blend: 'source-over'
  },
  land_red_rocky: {
    id: 'land_red_rocky',
    path: 'assets/terrain/land_red_rocky.jpeg',
    kind: 'land',
    tile: 1024,
    scale: 1.0,
    alpha: 0.34,
    drift: 0.072,
    blend: 'source-over'
  },
  land_red_gravel: {
    id: 'land_red_gravel',
    path: 'assets/terrain/land_red_gravel.jpeg',
    kind: 'land',
    tile: 1024,
    scale: 1.0,
    alpha: 0.3,
    drift: 0.07,
    blend: 'source-over'
  },
  land_red_smooth: {
    id: 'land_red_smooth',
    path: 'assets/terrain/land_red_smooth.jpeg',
    kind: 'land',
    tile: 1024,
    scale: 1.0,
    alpha: 0.28,
    drift: 0.068,
    blend: 'source-over'
  },
  land_steel_light: {
    id: 'land_steel_light',
    path: 'assets/terrain/land_steel_light.jpeg',
    kind: 'land',
    tile: 1024,
    scale: 1.0,
    alpha: 0.22,
    drift: 0.06,
    blend: 'source-over'
  },
  land_steel_mid: {
    id: 'land_steel_mid',
    path: 'assets/terrain/land_steel_mid.jpeg',
    kind: 'land',
    tile: 1024,
    scale: 1.0,
    alpha: 0.26,
    drift: 0.062,
    blend: 'source-over'
  },
  land_lava_dense: {
    id: 'land_lava_dense',
    path: 'assets/terrain/land_lava_dense.jpeg',
    kind: 'land',
    tile: 1024,
    scale: 1.0,
    alpha: 0.34,
    drift: 0.052,
    blend: 'screen'
  },
  land_lava_open: {
    id: 'land_lava_open',
    path: 'assets/terrain/land_lava_open.jpeg',
    kind: 'land',
    tile: 1024,
    scale: 1.0,
    alpha: 0.32,
    drift: 0.05,
    blend: 'screen'
  },
  macro_ruined_urban_burn: {
    id: 'macro_ruined_urban_burn',
    path: 'assets/terrain/macro_ruined_urban_burn.jpeg',
    kind: 'macro',
    tile: 1024,
    scale: 1.0,
    alpha: 0.12,
    drift: 0.018,
    blend: 'multiply'
  },
  macro_ruined_urban_blocks: {
    id: 'macro_ruined_urban_blocks',
    path: 'assets/terrain/macro_ruined_urban_blocks.jpeg',
    kind: 'macro',
    tile: 1024,
    scale: 1.0,
    alpha: 0.11,
    drift: 0.016,
    blend: 'multiply'
  },
  macro_overgrown_facility_canopy: {
    id: 'macro_overgrown_facility_canopy',
    path: 'assets/terrain/macro_overgrown_facility_canopy.jpeg',
    kind: 'macro',
    tile: 1024,
    scale: 1.0,
    alpha: 0.12,
    drift: 0.02,
    blend: 'screen'
  },
  macro_overgrown_facility_domes: {
    id: 'macro_overgrown_facility_domes',
    path: 'assets/terrain/macro_overgrown_facility_domes.jpeg',
    kind: 'macro',
    tile: 1024,
    scale: 1.0,
    alpha: 0.12,
    drift: 0.02,
    blend: 'screen'
  },
  macro_toxic_wetland_channel: {
    id: 'macro_toxic_wetland_channel',
    path: 'assets/terrain/macro_toxic_wetland_channel.jpeg',
    kind: 'macro',
    tile: 1024,
    scale: 1.0,
    alpha: 0.13,
    drift: 0.018,
    blend: 'screen'
  },
  macro_toxic_wetland_swirl: {
    id: 'macro_toxic_wetland_swirl',
    path: 'assets/terrain/macro_toxic_wetland_swirl.jpeg',
    kind: 'macro',
    tile: 1024,
    scale: 1.0,
    alpha: 0.13,
    drift: 0.018,
    blend: 'screen'
  },
  macro_neon_district_grid: {
    id: 'macro_neon_district_grid',
    path: 'assets/terrain/macro_neon_district_grid.jpeg',
    kind: 'macro',
    tile: 1024,
    scale: 1.0,
    alpha: 0.12,
    drift: 0.014,
    blend: 'screen'
  },
  macro_neon_district_blocks: {
    id: 'macro_neon_district_blocks',
    path: 'assets/terrain/macro_neon_district_blocks.jpeg',
    kind: 'macro',
    tile: 1024,
    scale: 1.0,
    alpha: 0.11,
    drift: 0.014,
    blend: 'screen'
  },
  macro_hive_brood_dark: {
    id: 'macro_hive_brood_dark',
    path: 'assets/terrain/macro_hive_brood_dark.jpeg',
    kind: 'macro',
    tile: 1024,
    scale: 1.0,
    alpha: 0.12,
    drift: 0.016,
    blend: 'multiply'
  },
  macro_flesh_core_hot: {
    id: 'macro_flesh_core_hot',
    path: 'assets/terrain/macro_flesh_core_hot.jpeg',
    kind: 'macro',
    tile: 1024,
    scale: 1.0,
    alpha: 0.12,
    drift: 0.014,
    blend: 'screen'
  },
  macro_void_geode: {
    id: 'macro_void_geode',
    path: 'assets/terrain/macro_void_geode.jpeg',
    kind: 'macro',
    tile: 1024,
    scale: 1.0,
    alpha: 0.12,
    drift: 0.016,
    blend: 'screen'
  },
  macro_abyss_web: {
    id: 'macro_abyss_web',
    path: 'assets/terrain/macro_abyss_web.jpeg',
    kind: 'macro',
    tile: 1024,
    scale: 1.0,
    alpha: 0.1,
    drift: 0.014,
    blend: 'screen'
  }
};

const THEMES = {
  asteroid_belt: {
    id: 'asteroid_belt',
    label: 'Asteroid Belt',
    surfaceMode: 'space',
    backdropSurface: null,
    accentSurface: null,
    transitionSurface: null,
    atmosphereTint: 'rgba(90,120,170,0.06)',
    fogTint: 'rgba(80,100,150,0.04)',
    scatterFamily: 'asteroid_debris',
    landmarkFamily: 'rock_mass',
    roomFloorSurface: null,
    roomFloorAlpha: 0,
    backdropAlphaBoost: 0,
    scatterDensity: 0.2,
    roomScatterAlpha: 0.06,
    worldScatterAlpha: 0.05,
    transitionBandAlpha: 0,
    starfieldAlpha: 1,
    roomEdgeTint: '#5f91d0',
    accentTint: 'rgba(120,170,255,0.14)',
    macroOverlays: [],
    fogProfile: { broadAlpha: 0.04, localAlpha: 0.05, edgeLift: 0.02, tint: 'rgba(110,150,220,0.18)' },
    styleRefs: []
  },
  nebula_depths: {
    id: 'nebula_depths',
    label: 'Nebula Depths',
    surfaceMode: 'space',
    backdropSurface: 'space_toxic',
    accentSurface: 'space_void',
    transitionSurface: null,
    atmosphereTint: 'rgba(70,255,170,0.08)',
    fogTint: 'rgba(120,255,180,0.06)',
    scatterFamily: 'toxic_energy',
    landmarkFamily: 'toxic_rifts',
    roomFloorSurface: null,
    roomFloorAlpha: 0,
    backdropAlphaBoost: 0.02,
    scatterDensity: 0.28,
    roomScatterAlpha: 0.08,
    worldScatterAlpha: 0.06,
    transitionBandAlpha: 0,
    starfieldAlpha: 1,
    roomEdgeTint: '#49ff9f',
    accentTint: 'rgba(90,255,140,0.18)',
    macroOverlays: [
      { surface: 'macro_toxic_wetland_channel', alpha: 0.06, scale: 0.38, rarity: 0.4 }
    ],
    fogProfile: { broadAlpha: 0.06, localAlpha: 0.08, edgeLift: 0.03, tint: 'rgba(110,255,180,0.24)' },
    styleRefs: ['assets/terrain/ref_toxic_wetlands.jpeg']
  },
  void_fracture: {
    id: 'void_fracture',
    label: 'Void Fracture',
    surfaceMode: 'space',
    backdropSurface: 'space_void',
    accentSurface: null,
    transitionSurface: null,
    atmosphereTint: 'rgba(120,170,255,0.06)',
    fogTint: 'rgba(120,160,255,0.05)',
    scatterFamily: 'void_shards',
    landmarkFamily: 'fracture_mass',
    roomFloorSurface: null,
    roomFloorAlpha: 0,
    backdropAlphaBoost: 0.03,
    scatterDensity: 0.24,
    roomScatterAlpha: 0.07,
    worldScatterAlpha: 0.05,
    transitionBandAlpha: 0,
    starfieldAlpha: 1,
    roomEdgeTint: '#9aa8ff',
    accentTint: 'rgba(140,165,255,0.16)',
    macroOverlays: [
      { surface: 'macro_void_geode', alpha: 0.08, scale: 0.42, rarity: 0.36 },
      { surface: 'macro_abyss_web', alpha: 0.05, scale: 0.38, rarity: 0.22 }
    ],
    fogProfile: { broadAlpha: 0.07, localAlpha: 0.09, edgeLift: 0.03, tint: 'rgba(155,180,255,0.20)' },
    styleRefs: ['assets/terrain/ref_cosmic_fracture.jpeg']
  },
  derelict_plateyard: {
    id: 'derelict_plateyard',
    label: 'Derelict Plateyard',
    surfaceMode: 'hybrid',
    backdropSurface: 'space_ruins',
    accentSurface: 'land_steel_plate',
    transitionSurface: 'land_sand_to_steel',
    atmosphereTint: 'rgba(255,190,120,0.05)',
    fogTint: 'rgba(180,200,255,0.04)',
    scatterFamily: 'scrap_field',
    landmarkFamily: 'wreck_blocks',
    roomFloorSurface: 'land_steel_plate',
    roomFloorAlpha: 0.26,
    backdropAlphaBoost: 0.03,
    scatterDensity: 0.18,
    roomScatterAlpha: 0.07,
    worldScatterAlpha: 0.05,
    transitionBandAlpha: 0.12,
    starfieldAlpha: 0.72,
    roomEdgeTint: '#9fb7d2',
    accentTint: 'rgba(255,196,120,0.18)',
    macroOverlays: [
      { surface: 'macro_ruined_urban_blocks', alpha: 0.07, scale: 0.4, rarity: 0.3 },
      { surface: 'macro_overgrown_facility_canopy', alpha: 0.05, scale: 0.36, rarity: 0.22 }
    ],
    fogProfile: { broadAlpha: 0.06, localAlpha: 0.06, edgeLift: 0.04, tint: 'rgba(205,215,230,0.20)' },
    styleRefs: ['assets/terrain/ref_ruined_city.jpeg']
  },
  blackhole_scar: {
    id: 'blackhole_scar',
    label: 'Blackhole Scar',
    surfaceMode: 'space',
    backdropSurface: 'space_void',
    accentSurface: null,
    transitionSurface: null,
    atmosphereTint: 'rgba(255,120,80,0.08)',
    fogTint: 'rgba(255,100,80,0.06)',
    scatterFamily: 'ember_faults',
    landmarkFamily: 'gravity_fissures',
    roomFloorSurface: null,
    roomFloorAlpha: 0,
    backdropAlphaBoost: 0.04,
    scatterDensity: 0.28,
    roomScatterAlpha: 0.08,
    worldScatterAlpha: 0.06,
    transitionBandAlpha: 0,
    starfieldAlpha: 1,
    roomEdgeTint: '#ff8a54',
    accentTint: 'rgba(255,130,80,0.16)',
    macroOverlays: [
      { surface: 'land_lava_dense', alpha: 0.08, scale: 0.4, rarity: 0.3 }
    ],
    fogProfile: { broadAlpha: 0.05, localAlpha: 0.06, edgeLift: 0.02, tint: 'rgba(255,120,90,0.18)' },
    styleRefs: ['assets/terrain/ref_lava_scar.jpeg']
  },

  // Land-zone ready themes
  wasteland_outpost: {
    id: 'wasteland_outpost',
    label: 'Wasteland Outpost',
    surfaceMode: 'land',
    backdropSurface: 'land_sand_dunes',
    accentSurface: 'land_steel_plate',
    transitionSurface: 'land_sand_to_steel',
    atmosphereTint: 'rgba(255,220,160,0.07)',
    fogTint: 'rgba(255,230,180,0.05)',
    scatterFamily: 'outpost_debris',
    landmarkFamily: 'industrial_hulks',
    roomFloorSurface: 'land_sand_dunes',
    roomFloorAlpha: 0.36,
    backdropAlphaBoost: 0.06,
    scatterDensity: 0.52,
    roomScatterAlpha: 0.18,
    worldScatterAlpha: 0.1,
    transitionBandAlpha: 0.22,
    starfieldAlpha: 0.32,
    roomEdgeTint: '#ffd28f',
    accentTint: 'rgba(255,220,160,0.22)',
    macroOverlays: [
      { surface: 'macro_overgrown_facility_domes', alpha: 0.06, scale: 0.42, rarity: 0.25 },
      { surface: 'macro_ruined_urban_blocks', alpha: 0.05, scale: 0.38, rarity: 0.18 }
    ],
    fogProfile: { broadAlpha: 0.07, localAlpha: 0.08, edgeLift: 0.04, tint: 'rgba(255,232,198,0.35)' },
    styleRefs: []
  },
  toxic_wetland: {
    id: 'toxic_wetland',
    label: 'Toxic Wetland',
    surfaceMode: 'land',
    backdropSurface: 'land_red_smooth',
    accentSurface: 'land_red_rocky',
    transitionSurface: null,
    atmosphereTint: 'rgba(90,255,140,0.09)',
    fogTint: 'rgba(120,255,170,0.07)',
    scatterFamily: 'wetland_growth',
    landmarkFamily: 'poison_channels',
    roomFloorSurface: 'land_red_gravel',
    roomFloorAlpha: 0.3,
    backdropAlphaBoost: 0.05,
    scatterDensity: 0.58,
    roomScatterAlpha: 0.2,
    worldScatterAlpha: 0.12,
    transitionBandAlpha: 0.08,
    starfieldAlpha: 0.18,
    roomEdgeTint: '#74ff98',
    accentTint: 'rgba(120,255,170,0.26)',
    macroOverlays: [
      { surface: 'macro_toxic_wetland_channel', alpha: 0.11, scale: 0.46, rarity: 0.7 },
      { surface: 'macro_toxic_wetland_swirl', alpha: 0.09, scale: 0.42, rarity: 0.55 }
    ],
    fogProfile: { broadAlpha: 0.06, localAlpha: 0.11, edgeLift: 0.03, tint: 'rgba(130,255,170,0.30)' },
    styleRefs: ['assets/terrain/ref_toxic_wetlands.jpeg']
  },
  lava_scar: {
    id: 'lava_scar',
    label: 'Lava Scar',
    surfaceMode: 'land',
    backdropSurface: 'land_red_rocky',
    accentSurface: 'land_red_gravel',
    transitionSurface: null,
    atmosphereTint: 'rgba(255,120,60,0.10)',
    fogTint: 'rgba(255,80,40,0.08)',
    scatterFamily: 'lava_rock',
    landmarkFamily: 'magma_crust',
    roomFloorSurface: 'land_red_smooth',
    roomFloorAlpha: 0.24,
    backdropAlphaBoost: 0.06,
    scatterDensity: 0.54,
    roomScatterAlpha: 0.22,
    worldScatterAlpha: 0.14,
    transitionBandAlpha: 0.08,
    starfieldAlpha: 0.16,
    roomEdgeTint: '#ff8356',
    accentTint: 'rgba(255,110,65,0.28)',
    macroOverlays: [
      { surface: 'land_lava_dense', alpha: 0.13, scale: 0.48, rarity: 0.75 },
      { surface: 'land_lava_open', alpha: 0.1, scale: 0.44, rarity: 0.55 }
    ],
    fogProfile: { broadAlpha: 0.05, localAlpha: 0.08, edgeLift: 0.02, tint: 'rgba(255,140,90,0.24)' },
    styleRefs: ['assets/terrain/ref_lava_scar.jpeg']
  },
  ruined_urban: {
    id: 'ruined_urban',
    label: 'Ruined Urban',
    surfaceMode: 'land',
    backdropSurface: 'land_steel_plate',
    accentSurface: 'space_ruins',
    transitionSurface: 'land_sand_to_steel',
    atmosphereTint: 'rgba(255,210,170,0.04)',
    fogTint: 'rgba(190,210,230,0.04)',
    scatterFamily: 'urban_debris',
    landmarkFamily: 'collapsed_blocks',
    roomFloorSurface: 'land_steel_plate',
    roomFloorAlpha: 0.32,
    backdropAlphaBoost: 0.05,
    scatterDensity: 0.48,
    roomScatterAlpha: 0.17,
    worldScatterAlpha: 0.1,
    transitionBandAlpha: 0.18,
    starfieldAlpha: 0.26,
    roomEdgeTint: '#c7d2de',
    accentTint: 'rgba(190,210,230,0.22)',
    macroOverlays: [
      { surface: 'macro_ruined_urban_burn', alpha: 0.1, scale: 0.46, rarity: 0.6 },
      { surface: 'macro_ruined_urban_blocks', alpha: 0.08, scale: 0.42, rarity: 0.52 },
      { surface: 'macro_neon_district_grid', alpha: 0.04, scale: 0.36, rarity: 0.16 }
    ],
    fogProfile: { broadAlpha: 0.08, localAlpha: 0.07, edgeLift: 0.05, tint: 'rgba(190,210,230,0.28)' },
    styleRefs: ['assets/terrain/ref_ruined_city.jpeg']
  },
  overgrown_facility: {
    id: 'overgrown_facility',
    label: 'Overgrown Facility',
    surfaceMode: 'land',
    backdropSurface: 'land_steel_light',
    accentSurface: 'land_steel_mid',
    transitionSurface: 'land_sand_to_steel',
    atmosphereTint: 'rgba(120,255,170,0.08)',
    fogTint: 'rgba(180,255,220,0.07)',
    scatterFamily: 'overgrown_industry',
    landmarkFamily: 'facility_tanks',
    roomFloorSurface: 'land_steel_mid',
    roomFloorAlpha: 0.34,
    backdropAlphaBoost: 0.05,
    scatterDensity: 0.56,
    roomScatterAlpha: 0.2,
    worldScatterAlpha: 0.12,
    transitionBandAlpha: 0.18,
    starfieldAlpha: 0.22,
    roomEdgeTint: '#9ff0cf',
    accentTint: 'rgba(120,255,190,0.22)',
    macroOverlays: [
      { surface: 'macro_overgrown_facility_canopy', alpha: 0.11, scale: 0.46, rarity: 0.65 },
      { surface: 'macro_overgrown_facility_domes', alpha: 0.09, scale: 0.42, rarity: 0.42 }
    ],
    fogProfile: { broadAlpha: 0.08, localAlpha: 0.09, edgeLift: 0.05, tint: 'rgba(170,255,220,0.26)' },
    styleRefs: []
  },
  neon_district: {
    id: 'neon_district',
    autoRollEnabled: false,
    label: 'Neon District',
    surfaceMode: 'hybrid',
    backdropSurface: 'land_industrial_dark',
    accentSurface: 'land_steel_mid',
    transitionSurface: null,
    atmosphereTint: 'rgba(100,180,255,0.07)',
    fogTint: 'rgba(140,120,255,0.08)',
    scatterFamily: 'neon_lanes',
    landmarkFamily: 'transit_spines',
    roomFloorSurface: 'land_steel_mid',
    roomFloorAlpha: 0.28,
    backdropAlphaBoost: 0.04,
    scatterDensity: 0.44,
    roomScatterAlpha: 0.15,
    worldScatterAlpha: 0.1,
    transitionBandAlpha: 0.1,
    starfieldAlpha: 0.3,
    roomEdgeTint: '#8ad0ff',
    accentTint: 'rgba(150,120,255,0.22)',
    macroOverlays: [
      { surface: 'macro_neon_district_grid', alpha: 0.12, scale: 0.5, rarity: 0.72 },
      { surface: 'macro_neon_district_blocks', alpha: 0.09, scale: 0.46, rarity: 0.48 }
    ],
    fogProfile: { broadAlpha: 0.07, localAlpha: 0.1, edgeLift: 0.04, tint: 'rgba(110,180,255,0.24)' },
    styleRefs: []
  },
  hive_brood: {
    id: 'hive_brood',
    autoRollEnabled: false,
    label: 'Hive Brood',
    surfaceMode: 'corruption',
    backdropSurface: 'space_void',
    accentSurface: 'land_industrial_dark',
    transitionSurface: null,
    atmosphereTint: 'rgba(110,80,150,0.08)',
    fogTint: 'rgba(90,70,140,0.08)',
    scatterFamily: 'hive_nest',
    landmarkFamily: 'brood_cavities',
    roomFloorSurface: 'land_industrial_dark',
    roomFloorAlpha: 0.22,
    backdropAlphaBoost: 0.03,
    scatterDensity: 0.5,
    roomScatterAlpha: 0.18,
    worldScatterAlpha: 0.11,
    transitionBandAlpha: 0.06,
    starfieldAlpha: 0.2,
    roomEdgeTint: '#b18cff',
    accentTint: 'rgba(160,120,220,0.18)',
    macroOverlays: [
      { surface: 'macro_hive_brood_dark', alpha: 0.12, scale: 0.48, rarity: 0.7 },
      { surface: 'macro_abyss_web', alpha: 0.07, scale: 0.4, rarity: 0.34 }
    ],
    fogProfile: { broadAlpha: 0.08, localAlpha: 0.1, edgeLift: 0.02, tint: 'rgba(120,90,180,0.20)' },
    styleRefs: []
  },
  flesh_bloom: {
    id: 'flesh_bloom',
    autoRollEnabled: false,
    label: 'Flesh Bloom',
    surfaceMode: 'corruption',
    backdropSurface: 'space_void',
    accentSurface: 'space_toxic',
    transitionSurface: null,
    atmosphereTint: 'rgba(255,120,180,0.08)',
    fogTint: 'rgba(255,150,190,0.08)',
    scatterFamily: 'flesh_veins',
    landmarkFamily: 'bio_cores',
    roomFloorSurface: 'space_void',
    roomFloorAlpha: 0.16,
    backdropAlphaBoost: 0.02,
    scatterDensity: 0.46,
    roomScatterAlpha: 0.16,
    worldScatterAlpha: 0.1,
    transitionBandAlpha: 0.05,
    starfieldAlpha: 0.18,
    roomEdgeTint: '#ff8ecf',
    accentTint: 'rgba(255,120,190,0.22)',
    macroOverlays: [
      { surface: 'macro_flesh_core_hot', alpha: 0.12, scale: 0.44, rarity: 0.65 }
    ],
    fogProfile: { broadAlpha: 0.07, localAlpha: 0.11, edgeLift: 0.02, tint: 'rgba(255,180,210,0.22)' },
    styleRefs: []
  },
  void_geode: {
    id: 'void_geode',
    autoRollEnabled: false,
    label: 'Void Geode',
    surfaceMode: 'rare_chamber',
    backdropSurface: 'space_void',
    accentSurface: 'space_toxic',
    transitionSurface: null,
    atmosphereTint: 'rgba(120,160,255,0.08)',
    fogTint: 'rgba(150,180,255,0.08)',
    scatterFamily: 'geode_pockets',
    landmarkFamily: 'crystal_nodes',
    roomFloorSurface: 'space_void',
    roomFloorAlpha: 0.12,
    backdropAlphaBoost: 0.04,
    scatterDensity: 0.34,
    roomScatterAlpha: 0.14,
    worldScatterAlpha: 0.09,
    transitionBandAlpha: 0.04,
    starfieldAlpha: 0.2,
    roomEdgeTint: '#9ac4ff',
    accentTint: 'rgba(160,180,255,0.22)',
    macroOverlays: [
      { surface: 'macro_void_geode', alpha: 0.12, scale: 0.5, rarity: 0.74 }
    ],
    fogProfile: { broadAlpha: 0.08, localAlpha: 0.1, edgeLift: 0.03, tint: 'rgba(170,190,255,0.22)' },
    styleRefs: []
  },
  abyss_web: {
    id: 'abyss_web',
    autoRollEnabled: false,
    label: 'Abyss Web',
    surfaceMode: 'rare_chamber',
    backdropSurface: 'space_void',
    accentSurface: 'space_toxic',
    transitionSurface: null,
    atmosphereTint: 'rgba(90,140,255,0.08)',
    fogTint: 'rgba(110,160,255,0.08)',
    scatterFamily: 'abyss_webs',
    landmarkFamily: 'spider_cysts',
    roomFloorSurface: 'space_void',
    roomFloorAlpha: 0.14,
    backdropAlphaBoost: 0.04,
    scatterDensity: 0.4,
    roomScatterAlpha: 0.15,
    worldScatterAlpha: 0.1,
    transitionBandAlpha: 0.04,
    starfieldAlpha: 0.18,
    roomEdgeTint: '#8db8ff',
    accentTint: 'rgba(140,170,255,0.20)',
    macroOverlays: [
      { surface: 'macro_abyss_web', alpha: 0.12, scale: 0.5, rarity: 0.74 }
    ],
    fogProfile: { broadAlpha: 0.08, localAlpha: 0.11, edgeLift: 0.03, tint: 'rgba(160,180,255,0.22)' },
    styleRefs: []
  }
};

const BIOME_THEME = {
  asteroid: 'asteroid_belt',
  nebula: 'nebula_depths',
  void: 'void_fracture',
  derelict: 'derelict_plateyard',
  blackhole: 'blackhole_scar'
};

function rolledThemeFor(zone, biome, depth) {
  const roll = stableUnit(zone?.seed || depth || 1, (depth * 131 + biome.length * 17) >>> 0);
  switch (biome) {
    case 'derelict':
      if (depth >= 6 && roll > 0.84 && canAutoRollTheme('neon_district')) return 'neon_district';
      if (depth >= 4 && roll > 0.62) return 'ruined_urban';
      if (depth >= 5 && roll > 0.4 && roll <= 0.62) return 'overgrown_facility';
      if (depth >= 3 && roll > 0.24 && roll <= 0.4) return 'wasteland_outpost';
      return 'derelict_plateyard';
    case 'nebula':
      if (depth >= 7 && roll > 0.82 && canAutoRollTheme('flesh_bloom')) return 'flesh_bloom';
      if (depth >= 4 && roll > 0.56) return 'toxic_wetland';
      return 'nebula_depths';
    case 'blackhole':
      if (depth >= 7 && roll > 0.8 && canAutoRollTheme('flesh_bloom')) return 'flesh_bloom';
      if (depth >= 3 && roll > 0.48) return 'lava_scar';
      return 'blackhole_scar';
    case 'asteroid':
      if (depth >= 8 && roll > 0.9 && canAutoRollTheme('void_geode')) return 'void_geode';
      if (depth >= 5 && roll > 0.76) return 'wasteland_outpost';
      return 'asteroid_belt';
    case 'void':
      if (depth >= 8 && roll > 0.78 && canAutoRollTheme('abyss_web')) return 'abyss_web';
      if (depth >= 6 && roll > 0.52 && canAutoRollTheme('void_geode')) return 'void_geode';
      if (depth >= 5 && roll > 0.28 && canAutoRollTheme('hive_brood')) return 'hive_brood';
      return 'void_fracture';
    default:
      return BIOME_THEME[biome] || 'asteroid_belt';
  }
}

export const TerrainThemes = {
  surfaceRegistry: SURFACES,
  themeRegistry: THEMES,
  _imageCache: Object.create(null),
  _repeatCache: Object.create(null),

  getSurface(id) {
    return id ? (SURFACES[id] || null) : null;
  },

  getTheme(id) {
    return id ? (THEMES[id] || null) : null;
  },

  resolveTheme(zone, actConfig = null, depth = 1) {
    const biome = SliceLock.resolveBiome(zone, actConfig, 'asteroid');
    const explicitId = SliceLock.resolveThemeId(zone, actConfig, zone?.surfaceTheme || actConfig?.surfaceTheme || null);
    const themeId = explicitId || rolledThemeFor(zone, biome, depth);
    const base = THEMES[themeId] || THEMES.asteroid_belt;
    const depthFactor = clamp((depth - 1) / 75, 0, 1);
    const backdropSurface = sanitizeSurfaceId(base.backdropSurface, 'backdrop');
    const accentSurface = sanitizeSurfaceId(base.accentSurface, 'accent');
    const transitionSurface = sanitizeSurfaceId(base.transitionSurface, 'transition');
    const roomFloorSurface = sanitizeSurfaceId(
      base.roomFloorSurface,
      'roomFloor',
      base.surfaceMode === 'land' ? backdropSurface : null
    );
    const macroOverlaysResolved = (base.macroOverlays || [])
      .map(entry => {
        const surface = sanitizeSurfaceId(entry?.surface, 'macro');
        if (!surface) return null;
        return {
          ...entry,
          surface,
          alpha: clamp((entry.alpha || 0.08) + depthFactor * 0.02, 0.02, 0.18),
          scale: clamp(entry.scale || 0.44, 0.22, 0.8),
          rarity: clamp(entry.rarity || 0.5, 0.05, 0.85)
        };
      })
      .filter(Boolean);
    return {
      ...base,
      themeId: base.id,
      biome,
      depth,
      depthFactor,
      backdropSurface,
      accentSurface,
      transitionSurface,
      roomFloorSurface,
      backdropAlpha: clamp((this.getSurface(backdropSurface)?.alpha || 0) + (base.backdropAlphaBoost || 0) + depthFactor * 0.04, 0, 0.56),
      accentAlpha: clamp((this.getSurface(accentSurface)?.alpha || 0) * 0.62 + depthFactor * 0.02, 0, 0.34),
      transitionAlpha: clamp((this.getSurface(transitionSurface)?.alpha || 0) * 0.55, 0, 0.2),
      roomFloorAlphaResolved: clamp((base.roomFloorAlpha || 0) + depthFactor * (base.surfaceMode === 'land' ? 0.02 : 0.008), 0, 0.46),
      roomScatterAlphaResolved: clamp((base.roomScatterAlpha || 0) + depthFactor * 0.03, 0, 0.28),
      worldScatterAlphaResolved: clamp((base.worldScatterAlpha || 0) + depthFactor * 0.02, 0, 0.18),
      transitionBandAlphaResolved: clamp((base.transitionBandAlpha || 0) + depthFactor * 0.015, 0, 0.18),
      starfieldAlphaResolved: base.surfaceMode === 'space' ? clamp(base.starfieldAlpha ?? 1, 0.12, 1) : 0,
      macroOverlaysResolved,
      fogProfileResolved: {
        broadAlpha: clamp((base.fogProfile?.broadAlpha || 0.04) + depthFactor * 0.01, 0.015, 0.11),
        localAlpha: clamp((base.fogProfile?.localAlpha || 0.05) + depthFactor * 0.012, 0.02, 0.13),
        edgeLift: clamp(base.fogProfile?.edgeLift || 0.02, 0.01, 0.06),
        tint: base.fogProfile?.tint || base.fogTint || 'rgba(160,180,220,0.18)'
      }
    };
  },

  ensureAssets(theme) {
    if (!theme) return;
    const macroIds = [
      ...(Array.isArray(theme.macroOverlays) ? theme.macroOverlays.map(m => m?.surface).filter(Boolean) : []),
      ...(Array.isArray(theme.macroOverlaysResolved) ? theme.macroOverlaysResolved.map(m => m?.surface).filter(Boolean) : [])
    ];
    for (const surfaceId of [theme.backdropSurface, theme.accentSurface, theme.transitionSurface, theme.roomFloorSurface, ...macroIds]) {
      const surface = this.getSurface(surfaceId);
      if (!surface?.path) continue;
      if (!this._imageCache[surface.id]) {
        const img = new Image();
        img.src = surface.path;
        this._imageCache[surface.id] = img;
      }
    }
  },

  getLoadedImage(surfaceId) {
    const img = surfaceId ? this._imageCache[surfaceId] : null;
    return img?.complete && img.naturalWidth > 0 ? img : null;
  },

  getRepeatSource(surfaceId, img) {
    if (!img) return null;
    if (!this._repeatCache) this._repeatCache = Object.create(null);
    const surface = surfaceId ? this.getSurface(surfaceId) : null;
    const trim = Math.max(0, surface?.repeatTrim ?? 2);
    if (trim <= 0 || !img.naturalWidth || !img.naturalHeight) return img;
    const sw = img.naturalWidth;
    const sh = img.naturalHeight;
    if (sw <= trim * 2 + 4 || sh <= trim * 2 + 4) return img;
    const key = `${surfaceId || 'default'}|${sw}x${sh}|${trim}`;
    if (this._repeatCache[key]) return this._repeatCache[key];

    const canvas = makeCanvas(sw, sh);
    const cctx = canvas.getContext('2d');
    cctx.imageSmoothingEnabled = true;
    cctx.clearRect(0, 0, sw, sh);
    cctx.drawImage(img, trim, trim, sw - trim * 2, sh - trim * 2, 0, 0, sw, sh);
    this._repeatCache[key] = canvas;
    return canvas;
  },

  buildPattern(ctx, img, scale = 1, offsetX = 0, offsetY = 0, surfaceId = null) {
    if (!ctx || !img) return null;
    const repeatSource = this.getRepeatSource(surfaceId, img) || img;
    const pattern = ctx.createPattern(repeatSource, 'repeat');
    if (!pattern) return null;
    if (pattern.setTransform) {
      const matrix = new DOMMatrix();
      matrix.translateSelf(offsetX, offsetY);
      matrix.scaleSelf(scale, scale);
      pattern.setTransform(matrix);
    }
    return pattern;
  }
};

export default TerrainThemes;
