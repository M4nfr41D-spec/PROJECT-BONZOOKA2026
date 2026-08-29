// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// World.js - Zone & Enemy Spawn Management
// ============================================================
// Manages current zone, spawns enemies when player approaches

import { State } from '../State.js';
import { MapGenerator } from './MapGenerator.js';
import { Camera } from './Camera.js';
import { SeededRandom } from './SeededRandom.js';
import { DepthRules } from './DepthRules.js';
import { SpatialHash } from '../SpatialHash.js';
import { Background } from './Background.js';
import { WorldBoundary } from './WorldBoundary.js';
import { WorldLayers } from './WorldLayers.js';
import { DepthStack } from './DepthStack.js';
import { TerrainThemes } from './TerrainThemes.js';
import { ThemeScatter } from './ThemeScatter.js';
import { SliceLock } from './SliceLock.js';
import { DerelictDungeonAssembler } from './instances/DerelictDungeonAssembler.js';
import { resolveCircleInGrid } from './instances/DerelictTileGeometry.js';

function fillSurfaceRect(ctx, surfaceId, img, alpha, x, y, w, h, scale = 0.24) {
  if (!img || alpha <= 0) return false;
  const surface = TerrainThemes.getSurface(surfaceId);
  if (!surface) return false;
  const pattern = TerrainThemes.buildPattern(
    ctx,
    img,
    (surface.scale || 1) * scale,
    -x * 0.04,
    -y * 0.04,
    surfaceId
  );
  if (!pattern) return false;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = pattern;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  return true;
}

function fillSurfaceEllipse(ctx, surfaceId, img, alpha, x, y, rx, ry, scale = 0.24, pad = 18) {
  if (!img || alpha <= 0) return false;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, rx + pad, ry + pad, 0, 0, Math.PI * 2);
  ctx.clip();
  const ok = fillSurfaceRect(ctx, surfaceId, img, alpha, x - rx - pad, y - ry - pad, rx * 2 + pad * 2, ry * 2 + pad * 2, scale);
  ctx.restore();
  return ok;
}

function isSpaceCombatTheme(theme) {
  const mode = theme?.surfaceMode || 'space';
  return mode === 'space' || mode === 'corruption' || mode === 'rare_chamber';
}

function hexToRgb(hex, fallback = [80, 120, 180]) {
  if (!hex || typeof hex !== 'string') return fallback;
  const match = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!match) return fallback;
  const value = match[1];
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16)
  ];
}

function drawSolidCorridorBase(ctx, a, b, width, theme, profile, alpha = 0.94) {
  const cdx = b.cx - a.cx;
  const cdy = b.cy - a.cy;
  const len = Math.hypot(cdx, cdy);
  if (len < 1) return;
  const [r, g, bch] = hexToRgb(theme?.roomEdgeTint || '#6f95c8');
  ctx.save();
  ctx.translate((a.cx + b.cx) * 0.5, (a.cy + b.cy) * 0.5);
  ctx.rotate(Math.atan2(cdy, cdx));
  const halfW = width + 10;
  const grad = ctx.createLinearGradient(0, -halfW, 0, halfW);
  grad.addColorStop(0, `rgba(8, 12, 22, ${alpha * 0.88})`);
  grad.addColorStop(0.5, `rgba(16, 22, 38, ${alpha})`);
  grad.addColorStop(1, `rgba(8, 12, 22, ${alpha * 0.88})`);
  ctx.fillStyle = grad;
  ctx.fillRect(-len * 0.5 - 8, -halfW, len + 16, halfW * 2);
  ctx.strokeStyle = `rgba(${r},${g},${bch}, ${0.12 * Math.min(1.2, profile?.roomGlowAlpha || 1)})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(-len * 0.5 - 6, -halfW + 1, len + 12, halfW * 2 - 2);
  ctx.restore();
}

function drawSolidRoomBase(ctx, room, theme, profile, alpha = 0.96) {
  const [r, g, b] = hexToRgb(theme?.roomEdgeTint || '#6f95c8');
  const rx = room.rx + 16;
  const ry = room.ry + 16;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(room.cx, room.cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  const grad = ctx.createRadialGradient(room.cx, room.cy, Math.min(rx, ry) * 0.1, room.cx, room.cy, Math.max(rx, ry));
  grad.addColorStop(0, `rgba(18, 24, 38, ${alpha})`);
  grad.addColorStop(0.58, `rgba(12, 16, 28, ${alpha * 0.98})`);
  grad.addColorStop(1, `rgba(6, 8, 16, ${alpha * 0.96})`);
  ctx.fillStyle = grad;
  ctx.fillRect(room.cx - rx - 4, room.cy - ry - 4, rx * 2 + 8, ry * 2 + 8);
  const edge = ctx.createRadialGradient(room.cx, room.cy, Math.max(4, Math.min(rx, ry) * 0.7), room.cx, room.cy, Math.max(rx, ry));
  edge.addColorStop(0, 'rgba(0,0,0,0)');
  edge.addColorStop(1, `rgba(${r},${g},${b}, ${0.10 * Math.min(1.2, profile?.roomGlowAlpha || 1)})`);
  ctx.fillStyle = edge;
  ctx.fillRect(room.cx - rx - 6, room.cy - ry - 6, rx * 2 + 12, ry * 2 + 12);
  ctx.restore();
}

function createWorldCanvas(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  if (typeof document !== 'undefined' && document?.createElement) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  return null;
}

function drawSeamSafeImage(ctx, img, dx, dy, dw, dh, inset = 2) {
  if (!img) return;
  if (inset <= 0) {
    ctx.drawImage(img, dx, dy, dw, dh);
    return;
  }
  const sx = inset;
  const sy = inset;
  const sw = Math.max(1, img.naturalWidth - inset * 2);
  const sh = Math.max(1, img.naturalHeight - inset * 2);
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function getGroundedShadowObstacles(obstacles = []) {
  return (obstacles || []).filter(obs => {
    if (!obs || obs.destroyed) return false;
    if (obs.grounded === false) return false;
    if (obs.castsShadow === false) return false;
    return !(obs.shadowClass === 'debris' || obs.shadowClass === 'crate' || obs.shadowClass === 'mine');
  });
}

function roomBounds(room, pad = 24) {
  return {
    x: room.cx - room.rx - pad,
    y: room.cy - room.ry - pad,
    w: room.rx * 2 + pad * 2,
    h: room.ry * 2 + pad * 2
  };
}

function corridorBounds(a, b, width, pad = 24) {
  const minX = Math.min(a.cx, b.cx) - width - pad;
  const minY = Math.min(a.cy, b.cy) - width - pad;
  const maxX = Math.max(a.cx, b.cx) + width + pad;
  const maxY = Math.max(a.cy, b.cy) + width + pad;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}


function rectsIntersect(a, b) {
  if (!a || !b) return false;
  return !(
    a.x + a.w <= b.x ||
    b.x + b.w <= a.x ||
    a.y + a.h <= b.y ||
    b.y + b.h <= a.y
  );
}


function ensureLayoutRenderCache(world, zone, layout, terrainTheme, profile, floorTile, roomSurfaceImg, roomSurfaceId, roomSurfaceAlpha, spaceCombatTheme) {
  if (!zone || !layout) return null;
  const cacheKey = [
    zone.seed || 0,
    terrainTheme?.themeId || 'none',
    roomSurfaceId || 'none',
    spaceCombatTheme ? 1 : 0,
    floorTile ? 1 : 0,
    roomSurfaceImg ? 1 : 0,
    Math.round((roomSurfaceAlpha || 0) * 1000),
    layout.rooms?.length || 0,
    layout.corridors?.length || 0,
    zone.obstacles?.length || 0
  ].join('|');

  if (world._layoutRenderCache?.key === cacheKey) return world._layoutRenderCache;

  world._layoutRenderCache = {
    key: cacheKey,
    chunkSize: 1024,
    floorChunks: new Map(),
    shadowChunks: new Map(),
    rooms: layout.rooms || [],
    corridors: layout.corridors || [],
    roomBounds: (layout.rooms || []).map(r => roomBounds(r, 28)),
    corridorBounds: (layout.corridors || []).map(c => {
      const a = layout.rooms[c.from];
      const b = layout.rooms[c.to];
      return (a && b) ? corridorBounds(a, b, 108, 36) : { x: 0, y: 0, w: 0, h: 0 };
    }),
    themeId: terrainTheme?.themeId || 'none',
    roomSurfaceId,
    roomSurfaceAlpha,
    floorTile,
    roomSurfaceImg,
    profile,
    terrainTheme,
    spaceCombatTheme
  };
  return world._layoutRenderCache;
}

function buildFloorChunk(world, cache, chunkX, chunkY) {
  const key = `${chunkX},${chunkY}`;
  if (cache.floorChunks.has(key)) return cache.floorChunks.get(key);
  const chunkSize = cache.chunkSize;
  const canvas = createWorldCanvas(chunkSize, chunkSize);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.translate(-chunkX, -chunkY);

  const TILE = 256;
  const DANGER_ROOMS = { boss: true, ambush: true, gauntlet: true };
  const floorTile = cache.floorTile;
  const roomSurfaceImg = cache.roomSurfaceImg;
  const roomSurfaceId = cache.roomSurfaceId;
  const roomSurfaceAlpha = cache.roomSurfaceAlpha;
  const terrainTheme = cache.terrainTheme;
  const profile = cache.profile;
  const spaceCombatTheme = cache.spaceCombatTheme;
  const chunkRect = { x: chunkX, y: chunkY, w: chunkSize, h: chunkSize };

  for (let i = 0; i < cache.corridors.length; i++) {
    const cor = cache.corridors[i];
    if (!rectsIntersect(cache.corridorBounds[i], chunkRect)) continue;
    const a = cache.rooms[cor.from];
    const b = cache.rooms[cor.to];
    if (!a || !b) continue;
    const cdx = b.cx - a.cx;
    const cdy = b.cy - a.cy;
    const len = Math.hypot(cdx, cdy);
    if (len < 1) continue;
    const corWidth = 100;

    if (spaceCombatTheme) {
      drawSolidCorridorBase(ctx, a, b, corWidth, terrainTheme, profile, 0.95);
    }
    if (floorTile || roomSurfaceImg) {
      const steps = Math.ceil(len / TILE);
      for (let s = 0; s < steps; s++) {
        const t = (s + 0.5) / steps;
        const tx = a.cx + cdx * t;
        const ty = a.cy + cdy * t;
        if (tx < chunkX - TILE || tx > chunkX + chunkSize + TILE || ty < chunkY - TILE || ty > chunkY + chunkSize + TILE) continue;
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(Math.atan2(cdy, cdx));
        if (floorTile) {
          ctx.globalAlpha = spaceCombatTheme ? 0.62 : 0.78;
          drawSeamSafeImage(ctx, floorTile, -TILE / 2 - 1, -corWidth - 1, TILE + 2, corWidth * 2 + 2, 2);
        }
        if (roomSurfaceImg && roomSurfaceAlpha > 0) {
          fillSurfaceRect(
            ctx,
            roomSurfaceId,
            roomSurfaceImg,
            Math.min(spaceCombatTheme ? 0.16 : 0.42, roomSurfaceAlpha * (spaceCombatTheme ? 0.38 : 0.96)),
            -TILE / 2,
            -corWidth,
            TILE,
            corWidth * 2,
            0.18
          );
        }
        ctx.restore();
      }
    }
  }

  DepthStack.drawRoomUnderlays(ctx, { _layerState: { profile } }, { rooms: cache.rooms, corridors: cache.corridors }, profile, chunkSize, chunkSize);

  for (let i = 0; i < cache.rooms.length; i++) {
    const room = cache.rooms[i];
    if (!rectsIntersect(cache.roomBounds[i], chunkRect)) continue;
    const isDanger = DANGER_ROOMS[room.type];
    const tile = isDanger ? (world._floorCache?.floor_cracked?.complete && world._floorCache.floor_cracked.naturalWidth > 0 ? world._floorCache.floor_cracked : floorTile) : floorTile;
    if (spaceCombatTheme) {
      drawSolidRoomBase(ctx, room, terrainTheme, profile, isDanger ? 0.98 : 0.95);
    }
    if (tile || roomSurfaceImg) {
      const tilesX = Math.ceil(room.rx * 2 / TILE);
      const tilesY = Math.ceil(room.ry * 2 / TILE);
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(room.cx, room.cy, room.rx + 15, room.ry + 15, 0, 0, Math.PI * 2);
      ctx.clip();
      const left = room.cx - room.rx;
      const top = room.cy - room.ry;
      if (tile) {
        ctx.globalAlpha = spaceCombatTheme ? (isDanger ? 0.68 : 0.62) : (isDanger ? 0.88 : 0.82);
        for (let tx = 0; tx < tilesX; tx++) {
          const dx = left + tx * TILE - 1;
          if (dx > chunkX + chunkSize + TILE || dx + TILE + 2 < chunkX - TILE) continue;
          for (let ty = 0; ty < tilesY; ty++) {
            const dy = top + ty * TILE - 1;
            if (dy > chunkY + chunkSize + TILE || dy + TILE + 2 < chunkY - TILE) continue;
            drawSeamSafeImage(ctx, tile, dx, dy, TILE + 2, TILE + 2, 2);
          }
        }
      }
      if (roomSurfaceImg && roomSurfaceAlpha > 0) {
        fillSurfaceEllipse(
          ctx,
          roomSurfaceId,
          roomSurfaceImg,
          Math.min(spaceCombatTheme ? 0.18 : 0.44, roomSurfaceAlpha * (spaceCombatTheme ? 0.42 : (isDanger ? 0.95 : 1.0))),
          room.cx,
          room.cy,
          room.rx,
          room.ry,
          0.2,
          16
        );
      }
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = (isDanger ? 0.1 : 0.06) * (profile?.roomGlowAlpha || 1);
    ctx.strokeStyle = isDanger ? '#ff4444' : (terrainTheme?.roomEdgeTint || '#00aacc');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(room.cx, room.cy, room.rx, room.ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  cache.floorChunks.set(key, canvas);
  return canvas;
}

function drawCachedLayoutFloors(world, ctx, cache, screenW, screenH) {
  const chunkSize = cache.chunkSize;
  const camX = Camera.getX();
  const camY = Camera.getY();
  const pad = 256;
  const startX = Math.floor((camX - pad) / chunkSize) * chunkSize;
  const endX = Math.floor((camX + screenW + pad) / chunkSize) * chunkSize;
  const startY = Math.floor((camY - pad) / chunkSize) * chunkSize;
  const endY = Math.floor((camY + screenH + pad) / chunkSize) * chunkSize;
  for (let x = startX; x <= endX; x += chunkSize) {
    for (let y = startY; y <= endY; y += chunkSize) {
      const canvas = buildFloorChunk(world, cache, x, y);
      if (!canvas) continue;
      ctx.drawImage(canvas, x, y);
    }
  }
}

// Shared spatial grid – rebuilt every frame in update()
let _grid = null;

export const World = {
  currentZone: null,
  currentAct: null,
  instanceState: { active: false, returnZone: null, returnPlayer: null, returnZoneIndex: 0, returnAct: null, sourcePoiId: null },
  zoneIndex: 0,
  
  // Spatial hash for O(1) collision queries
  get grid() { return _grid; },

  getLayerState() {
    if (!this.currentZone) return null;
    return WorldLayers.ensureZone(this.currentZone, this.currentAct, this.currentZone.depth || (this.zoneIndex + 1));
  },
  
  // Spawning config
  spawnRadius: 1200,     // Distance to trigger spawn (was 600 — now full screen coverage)
  despawnRadius: 2200,   // Distance to despawn (performance)
  activeEnemies: [],     // Currently active enemies from spawns
  
  // Initialize world with act config
  async init(actId, seed = null) {
    // ── NEW: Tier-based infinite zones ──
    // actId can be a tierId, a legacy actId, or a portal startZone number
    const acts = State.data.acts;
    let startZone = 0;
    let tierConfig = null;

    // Check if called with a portal startZone (number)
    if (typeof actId === 'number') {
      startZone = actId - 1; // convert 1-based depth to 0-based index
      tierConfig = this.getTierForDepth(actId);
    }
    // Check for new tier-based format
    else if (acts?.tiers) {
      const portal = acts.portals?.find(p => p.id === actId || p.tierId === actId);
      if (portal) {
        startZone = (portal.startZone || 1) - 1;
        tierConfig = acts.tiers.find(t => t.id === portal.tierId);
      }
      // Fallback: try legacy act lookup
      if (!tierConfig && acts[actId]) {
        tierConfig = acts[actId];
      }
      // Fallback: first tier
      if (!tierConfig && acts.tiers.length > 0) {
        tierConfig = acts.tiers[0];
      }
    }
    // Legacy: old act-based format
    else if (acts?.[actId]) {
      tierConfig = acts[actId];
    }

    if (!tierConfig) {
      console.error(`No tier/act config found for: ${actId}`);
      return false;
    }

    this.currentAct = SliceLock.applyActConfig({ ...tierConfig });
    this.currentAct.id = tierConfig.id || actId;

    // Use provided seed or generate from tier + timestamp
    const actSeed = seed || SeededRandom.fromString(this.currentAct.id + '_' + Date.now());
    this.currentAct.seed = actSeed;

    // Start at the specified zone
    this.zoneIndex = startZone;
    this.loadZone(startZone);
    
    return true;
  },

  /**
   * Get the tier config for a given depth (1-based zone number).
   * Tiers define zone ranges; the last tier extends to infinity.
   */
  getTierForDepth(depth) {
    const tiers = State.data.acts?.tiers;
    if (!tiers || !tiers.length) return this.currentAct; // fallback

    for (let i = tiers.length - 1; i >= 0; i--) {
      if (depth >= tiers[i].zoneStart) return tiers[i];
    }
    return tiers[0];
  },
  
  loadPreparedZone(zone, options = {}) {
    if (!zone) return false;

    const depth = options.depth || this.zoneIndex + 1 || 1;
    State.run.currentDepth = depth;
    State.run._zoneDamageTaken = 0;
    try { State.modules?.Bullets?.flushForZoneTransition?.(); } catch (_) {}

    this.currentZone = zone;
    this.currentZone.depth = depth;
    this.currentZone.mods = options.mods || [];
    this.currentZone.difficulty = State.run.difficulty || 'normal';
    this.zoneIndex = options.zoneIndex ?? this.zoneIndex;
    State.world.zoneIndex = this.zoneIndex;
    State.world.currentZone = this.currentZone;
    State.world.currentAct = this.currentAct;
    State.run.objective = this.currentZone.objective || null;

    State.enemies = [];
    State.enemyBullets = [];
    State.pickups = [];
    this.activeEnemies = [];
    this.spawnedEnemyCount = 0;
    this.spawnedEliteCount = 0;
    this.bossSpawned = false;

    State.player.x = this.currentZone.spawn.x;
    State.player.y = this.currentZone.spawn.y;
    State.player.vx = 0;
    State.player.vy = 0;

    try { Background.prepareZone(this.currentZone, this.currentZone.seed || 0, this.currentAct); } catch (e) { console.warn('[BG] prepareZone failed:', e); }

    const layerState = WorldLayers.ensureZone(this.currentZone, this.currentAct, depth);
    WorldBoundary.exposeCollisionMeta(layerState?.grids?.collision || null);
    WorldBoundary.exposeNavigationMeta(layerState?.grids?.navigation || null);
    WorldBoundary.exposeOverlayMeta(layerState?.overlays || null);
    WorldBoundary.exposeLayerProfile(layerState?.profile || null);

    const canvas = document.getElementById('gameCanvas');
    const screenW = canvas?.width || 800;
    const screenH = canvas?.height || 600;
    Camera.snapTo(State.player.x - screenW / 2, State.player.y - screenH / 2);
    return true;
  },

  enterDerelictInstance(sourcePoi) {
    const sourceId = sourcePoi?.id || null;
    // ── Risk tier: instance is never safer than the overworld (max of POI tier & current difficulty) ──
    const RANK = { normal: 0, risk: 1, chaos: 2 };
    const prevDiff = State.run.difficulty || 'normal';
    const poiTier = sourcePoi?.tier || 'normal';
    const tier = (RANK[poiTier] || 0) >= (RANK[prevDiff] || 0) ? poiTier : prevDiff;
    // Apply BEFORE building so enemy spawns + loot rolls scale via the global diff-mod pipeline
    State.run.difficulty = tier;
    const currentSeed = this.currentZone?.seed || this.currentAct?.seed || Date.now();
    const instSeed = SeededRandom.fromString(`der_inst_${sourceId}_${currentSeed}_${this.zoneIndex}`);
    const zone = DerelictDungeonAssembler.buildFromPoi(sourcePoi || {}, instSeed);
    this.instanceState = {
      active: true,
      returnZone: this.currentZone,
      returnPlayer: { x: State.player.x, y: State.player.y },
      returnZoneIndex: this.zoneIndex,
      returnAct: this.currentAct,
      returnDifficulty: prevDiff,
      tier,
      sourcePoiId: sourceId
    };
    this.loadPreparedZone(zone, { depth: this.zoneIndex + 1, zoneIndex: this.zoneIndex });
    const TIER_TAG = { normal: '', risk: ' \u00B7 RISK', chaos: ' \u00B7 CHAOS' };
    WorldBoundary.announce('🏚️ DERELICT' + (TIER_TAG[tier] || '') + ' ENTERED', 2.2);
    WorldBoundary.playAudio('portalEnter');
    return true;
  },

  exitActiveInstance() {
    if (!this.instanceState?.active || !this.instanceState.returnZone) return false;
    const returnZone = this.instanceState.returnZone;
    const returnPlayer = this.instanceState.returnPlayer || returnZone.spawn || { x: 0, y: 0 };
    const returnZoneIndex = this.instanceState.returnZoneIndex || 0;
    const returnAct = this.instanceState.returnAct || this.currentAct;
    // Restore overworld difficulty (instance tier was temporary)
    State.run.difficulty = this.instanceState.returnDifficulty || 'normal';
    this.currentAct = returnAct;
    this.instanceState = { active: false, returnZone: null, returnPlayer: null, returnZoneIndex: 0, returnAct: null, returnDifficulty: null, tier: null, sourcePoiId: null };
    this.loadPreparedZone(returnZone, { depth: returnZone.depth || returnZoneIndex + 1, zoneIndex: returnZoneIndex });
    State.player.x = returnPlayer.x;
    State.player.y = returnPlayer.y;
    WorldBoundary.announce('↩ RETURNED TO OVERWORLD', 2.0);
    return true;
  },

  // Load/generate a zone (endless via depth)
  loadZone(index) {
    // Depth is 1-based
    const depth = index + 1;
    
    // ══ CRITICAL: Store depth for ALL systems (items, enemies, loot) ══
    State.run.currentDepth = depth;
    
    // Reset zone-specific damage counter for flawless tracking
    State.run._zoneDamageTaken = 0;

    // Portal/zone transition SFX
    WorldBoundary.playAudio('portalEnter');
    try { State.modules?.Bullets?.flushForZoneTransition?.(); } catch (_) { /* keep zone loads resilient */ }

    // ── Auto-switch tier based on depth ──
    const newTier = this.getTierForDepth(depth);
    if (newTier && newTier.id !== this.currentAct?.id) {
      // console.log(`[WORLD] Tier transition: ${this.currentAct?.name} -> ${newTier.name} at depth ${depth}`);
      const prevSeed = this.currentAct?.seed;
      this.currentAct = SliceLock.applyActConfig({ ...newTier });
      this.currentAct.seed = prevSeed; // Keep seed chain continuous

      // Unlock next portal if entering its tier
      const portals = State.data.acts?.portals;
      if (portals) {
        const portal = portals.find(p => p.tierId === newTier.id);
        if (portal && !portal.unlocked) {
          portal.unlocked = true;
          if (!State.meta.portalsUnlocked) State.meta.portalsUnlocked = {};
          State.meta.portalsUnlocked[portal.id] = true;
          WorldBoundary.announce('NEW PORTAL UNLOCKED: ' + portal.name, 2.5);
        }
      }
    }

    const zoneSeed = MapGenerator.createZoneSeed(this.currentAct.seed, index);

    // Hybrid milestone unlocks (weighted randomness)
    DepthRules.maybeUnlock(depth, this.currentAct);
    DepthRules.recordDepth(depth);

    // Boss interval: configurable per tier (default 5)
    const bossInterval = this.currentAct.bossEvery || this.currentAct.zones || 5;
    const isBossZone = (depth % bossInterval) === 0;

    // Sample active modifiers for this zone
    const activeMods = DepthRules.sampleActive(depth, this.currentAct);
    
    // ═══ DIFFICULTY LANE MODIFIERS ═══
    const diff = State.run.difficulty || 'normal';
    const diffMods = this._getDifficultyMods(diff);
    
    // Inject difficulty-specific map mods
    if (diffMods.mapMods) {
      for (const m of diffMods.mapMods) {
        if (!activeMods.includes(m)) activeMods.push(m);
      }
    }

    if (isBossZone) {
      this.currentZone = SliceLock.applyZone(MapGenerator.generateBossZone(this.currentAct, zoneSeed, { depth, mods: activeMods, difficulty: diff }));
    } else {
      this.currentZone = SliceLock.applyZone(MapGenerator.generate(this.currentAct, zoneSeed, { depth, mods: activeMods, difficulty: diff }));
    }

    this.currentZone.depth = depth;
    this.currentZone.mods = activeMods;
    this.currentZone.difficulty = diff;
    
    // ═══ Store mod metadata for HUD ═══
    State.run.zoneMods = DepthRules.getModsWithData(activeMods);
    State.run.corruption = State.meta.corruption || 0;

    this.zoneIndex = index;
    this.activeEnemies = [];
    State.world.zoneIndex = index;
    State.world.currentZone = this.currentZone;
    
    // W4A: Init room tracking for new zone
    this.initRoomState();
    
    // ═══ ZONE OBJECTIVE → State.run ═══
    State.run.objective = this.currentZone.objective || null;
    if (State.run.objective) {
      const obj = State.run.objective;
      // console.log(`[OBJECTIVE] ${obj.label}: ${obj.desc}`);
      // Announce to player after a short delay (let zone render first)
      setTimeout(() => {
        if (State.ui) {
          State.ui.announcement = { 
            text: `${obj.icon} ${obj.label}: ${obj.desc}`, 
            timer: 3.5 
          };
        }
        const Particles = State.modules?.Particles;
        const p = State.player;
        if (Particles && p) {
          Particles.text(p.x, p.y - 50, `${obj.icon} ${obj.label}`, '#ffcc00', 16);
        }
      }, 500);
    }

    const guaranteedDerelictPoi = this.currentZone?.pois?.find?.(p => p.guaranteedInstanceEntry);
    if (guaranteedDerelictPoi && !this.instanceState?.active) {
      setTimeout(() => {
        WorldBoundary.announce('🏚️ DERELICT BREACH DETECTED NEAR SPAWN — PRESS E', 3.0);
      }, 900);
    }
    // Apply route choice from previous zone (branch exits)
    if (State.run._nextRoute) {
      const route = State.run._nextRoute;
      // Extra modifiers from risky routes
      if (route.modifiers > 0 && this.currentZone.mods) {
        for (let i = 0; i < route.modifiers; i++) {
          const extraMod = DepthRules.sampleOne?.(depth) || 'swift';
          if (!this.currentZone.mods.includes(extraMod)) this.currentZone.mods.push(extraMod);
        }
      }
      // Vault zones are smaller and guaranteed rare+ reward
      if (route.isVault) {
        this.currentZone._isVault = true;
        this.currentZone._vaultLootMult = route.lootMult || 2.0;
      }
      this.currentZone._lootMult = route.lootMult || 1.0;
      State.run._nextRoute = null;
    }

    // Position player at spawn
    State.player.x = this.currentZone.spawn.x;
    State.player.y = this.currentZone.spawn.y;
    State.player.vx = 0;
    State.player.vy = 0;

    // Prepare tiled background (terrain tiles + fog + deco asteroids)
    try {
      Background.prepareZone(this.currentZone, zoneSeed, this.currentAct);
    } catch (e) { console.warn('[BG] prepareZone failed:', e); }

    const layerState = WorldLayers.ensureZone(this.currentZone, this.currentAct, depth);
    WorldBoundary.exposeCollisionMeta(layerState?.grids?.collision || null);
    WorldBoundary.exposeNavigationMeta(layerState?.grids?.navigation || null);
    WorldBoundary.exposeOverlayMeta(layerState?.overlays || null);
    WorldBoundary.exposeLayerProfile(layerState?.profile || null);

    // Snap camera to player
    const canvas = document.getElementById('gameCanvas');
    const screenW = canvas?.width || 800;
    const screenH = canvas?.height || 600;
    Camera.snapTo(
      State.player.x - screenW / 2,
      State.player.y - screenH / 2
    );

    // Reset zone-combat counters
    this.spawnedEnemyCount = 0;
    this.spawnedEliteCount = 0;
    this.bossSpawned = false;
    
    // ═══ v2.13.0: ZONE MOD BANNER ═══
    const modData = State.run.zoneMods || [];
    if (modData.length > 0 && depth > 1) {
      const modList = modData.map(m => `${m.icon} ${m.name}`).join('  ');
      setTimeout(() => {
        if (State.ui) {
          WorldBoundary.announce(modList, 3.0);
        }
      }, 800);
    }
    
    // ═══ v2.13.0 / v2.14.0: Mission + achievement zone tracking ═══
    WorldBoundary.emitZoneReached(depth);

    // ── AntiExploit: track seed usage for farming detection ──
    try { State.modules?.AntiExploit?.onZoneEnter?.(zoneSeed); } catch (e) { /* AntiExploit not loaded */ }
    WorldBoundary.antiExploitSnapshot();
  },
  
  // Update - handle proximity spawning
  update(dt) {
    if (!this.currentZone) return;
    
    const player = State.player;
    
    // ═══ W4A ROOM TRACKING + EVENTS ═══
    this._trackPlayerRoom(player);
    
    // Check enemy spawns
    const MAX_ACTIVE_ENEMIES = 35; // v2.16.3: Performance cap
    for (const spawn of this.currentZone.enemySpawns) {
      if (spawn.killed) continue;
      
      const dist = Math.hypot(player.x - spawn.x, player.y - spawn.y);
      
      // Spawn if player close AND below cap
      if (!spawn.active && dist < this._getDynamicSpawnRadius()) {
        if (State.enemies.length < MAX_ACTIVE_ENEMIES) {
          this.spawnEnemy(spawn, false);
        }
      }
      
      // Despawn if too far (and not engaged)
      if (spawn.active && dist > this.despawnRadius) {
        // Only despawn when the enemy is effectively "idle" at home.
        // If it was engaged, force a return so it doesn't vanish mid-behavior.
        const enemy = State.enemies.find(e => e.id === spawn.enemyId);
        if (enemy) {
          if (enemy.aiState === 'aggro') enemy.aiState = 'return';

          const distHome = Math.hypot(enemy.x - spawn.x, enemy.y - spawn.y);
          const homeThreshold = enemy.returnThreshold || 60;
          if (enemy.aiState !== 'aggro' && distHome <= homeThreshold) {
            this.despawnEnemy(spawn);
          }
        } else {
          this.despawnEnemy(spawn);
        }
      }
    }
    
    // Check elite spawns
    for (const spawn of this.currentZone.eliteSpawns) {
      if (spawn.killed) continue;
      
      const dist = Math.hypot(player.x - spawn.x, player.y - spawn.y);
      
      if (!spawn.active && dist < this._getDynamicSpawnRadius()) {
        this.spawnEnemy(spawn, true);
      }
    }
    
    // Check boss spawn
    if (this.currentZone.bossSpawn && !this.currentZone.bossSpawn.killed) {
      const spawn = this.currentZone.bossSpawn;
      const dist = Math.hypot(player.x - spawn.x, player.y - spawn.y);
      
      if (!spawn.active && dist < this._getDynamicBossRadius()) {
        this.spawnBoss(spawn);
      }
    }
    
    // Check exit collision
    if (this.currentZone.exit) {
      const exit = this.currentZone.exit;
      const obj = State.run.objective;
      const exitLocked = obj && obj.exitLocked && !obj.complete;
      
      // Branch exits (route choice portals)
      const branches = this.currentZone.branchExits;
      if (branches && !exitLocked) {
        for (const b of branches) {
          const bd = Math.hypot(player.x - b.x, player.y - b.y);
          if (bd < b.radius + 15) {
            // Store route choice for next zone
            State.run._nextRoute = { modifiers: b.modifiers, lootMult: b.lootMult, isVault: b.isVault };
            this.onExitReached();
            return; // prevent double trigger
          }
        }
      } else if (!exitLocked) {
        const dist = Math.hypot(player.x - exit.x, player.y - exit.y);
        if (dist < 50) {
          this.onExitReached();
        }
      }
    }
    
    // Check portal collision
    for (const portal of this.currentZone.portals) {
      const dist = Math.hypot(player.x - portal.x, player.y - portal.y);
      if (dist < 60) {
        this.onPortalEnter(portal);
      }
    }

    // ── Director reinforcement / pacing ──
    this._directorReinforce(dt, player);

    // ── POI System Update ──
    this._updatePOIs(dt);
    
    // ── Zone Objective Update ──
    this._updateObjective(dt);
    
    // ── Difficulty: Chaos Effects ──
    this._updateChaosEffects(dt);
    
    // ── Player vs Obstacle collision (pushback + mine detonation) ──
    const pRadius = player.radius || 15;
    const obstacles = this.currentZone.obstacles;
    if (obstacles) {
      for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        if (!obs || obs.destroyed) continue;
        if (obs.type === 'poison_area') continue; // DOT only, no collision

        const dx = player.x - obs.x;
        const dy = player.y - obs.y;
        const dist = Math.hypot(dx, dy);
        const minDist = pRadius + (obs.radius || 30);

        if (dist < minDist && dist > 0.1) {
          if (obs.type === 'mine') {
            // MINE DETONATION
            const { Player: PlayerMod, Particles: ParticlesMod } = State.modules;
            const dmg = obs.damage || 15;
            if (PlayerMod) PlayerMod.takeDamage(dmg);
            if (ParticlesMod) {
              // Big multi-stage explosion
              ParticlesMod.explosion(obs.x, obs.y, '#ff4400', 30, 280);
              ParticlesMod.explosion(obs.x, obs.y, '#ffcc00', 15, 180);
              ParticlesMod.ring(obs.x, obs.y, '#ff6600', 60);
              ParticlesMod.ring(obs.x, obs.y, '#ffcc00', 35);
              ParticlesMod.flash(obs.x, obs.y, '#ffffff', 20);
              ParticlesMod.screenShake = Math.max(ParticlesMod.screenShake || 0, 8);
            }
            const AudioMod = State.modules?.Audio;
            if (AudioMod) AudioMod.mineExplosion();
            obs.destroyed = true;
            // Splash damage to nearby enemies
            for (const e of State.enemies) {
              if (e.dead) continue;
              const eDist = Math.hypot(e.x - obs.x, e.y - obs.y);
              if (eDist < 100) {
                const { Enemies: EnemiesMod } = State.modules;
                if (EnemiesMod) EnemiesMod.damage(e, dmg * 0.6, false);
              }
            }
          } else {
            // SOLID OBSTACLE: push player out
            const overlap = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;
            player.x += nx * overlap;
            player.y += ny * overlap;
            // Dampen velocity into the obstacle
            const dot = player.vx * nx + player.vy * ny;
            if (dot < 0) {
              player.vx -= nx * dot * 0.8;
              player.vy -= ny * dot * 0.8;
            }
          }
        }
      }
    }
    
    // ── Player vs Structure collision (v2.16.3) ──
    const structures = this.currentZone?.instanceInfo?.disableStructureCollision ? null : this.currentZone?.structures;
    if (structures) {
      for (const struct of structures) {
        // Quick bounds check
        const b = struct.bounds;
        if (b && Math.hypot(player.x - b.x, player.y - b.y) > b.radius + pRadius + 50) continue;

        // Collider-level check
        for (const col of struct.colliders) {
          const dx = player.x - col.x;
          const dy = player.y - col.y;
          const dist = Math.hypot(dx, dy);
          const minDist = pRadius + col.radius;
          if (dist < minDist && dist > 0.1) {
            const overlap = minDist - dist;
            const nx = dx / dist, ny = dy / dist;
            player.x += nx * overlap;
            player.y += ny * overlap;
            const dot = player.vx * nx + player.vy * ny;
            if (dot < 0) { player.vx -= nx * dot * 0.8; player.vy -= ny * dot * 0.8; }
          }
        }

        // Hazard DOT (rifts, gravity walls)
        if (struct.isHazard && struct.hazardDPS) {
          for (const seg of struct.segments) {
            if (Math.hypot(player.x - seg.x, player.y - seg.y) < (seg.r || 40) * 1.3 + pRadius) {
              const dmg = struct.hazardDPS * dt;
              player.hp = Math.max(0, player.hp - dmg);
              if (!this._structHazardFlash || this._structHazardFlash <= 0) {
                const PM = State.modules?.Particles;
                if (PM) PM.sparks(player.x, player.y, struct.variant === 'gravity' ? '#aa66ff' : '#ff4466', 3);
                this._structHazardFlash = 0.3;
              }
              break;
            }
          }
        }
      }
      if (this._structHazardFlash > 0) this._structHazardFlash -= dt;
    }

    // ── Player + enemies vs unified instance grid (v2166A38) ──
    // Exact tilemap collision: solid cells (and out-of-grid) block movement.
    // Replaces the old circle-approximation colliders that produced phantom
    // walls / corner leaks, so instance collision is correct and re-enabled.
    const iGrid = this.currentZone?.instanceGrid;
    if (iGrid) {
      resolveCircleInGrid(player, pRadius, iGrid);
      const enemies = State.enemies || [];
      for (const e of enemies) {
        if (e.dead) continue;
        resolveCircleInGrid(e, (e.size || 22) * 0.5, iGrid);
      }
    }

    // Enemy AI (patrol/aggro/return) is handled in Enemies.update() for exploration mode.
    
    // ── Biome Hazards ──
    this._updateHazards(dt);
    
    // ── Rebuild spatial hash for this frame ──
    // Enemies, asteroids, and player are indexed so Bullets.js
    // can do O(1) proximity queries instead of brute-force O(n²).
    if (!_grid) _grid = SpatialHash.create(128);
    SpatialHash.clear(_grid);
    for (const e of State.enemies) {
      if (!e.dead) SpatialHash.insert(_grid, e);
    }
    const zoneAst = this.currentZone?.obstacles;
    if (Array.isArray(zoneAst)) {
      for (const a of zoneAst) {
        if (a && !a.destroyed) SpatialHash.insert(_grid, a);
      }
    }
    // Expose grid for cross-module queries (Bullets.js)
    WorldBoundary.exposeSpatialGrid(_grid);
  },
  
  // ============================================================
  // POI System - Update + Draw
  // ============================================================
  
  _updatePOIs(dt) {
    const zone = this.currentZone;
    if (!zone || !zone.pois) return;
    
    const player = State.player;
    
    for (const poi of zone.pois) {
      if (poi.collected) continue;
      
      const dist = Math.hypot(player.x - poi.x, player.y - poi.y);
      
      // ── TRIGGER: player enters POI radius ──
      if (!poi.triggered && dist < poi.radius) {
        poi.triggered = true;
        
        // Ambush zones: spawn enemies with stagger
        if (poi.type === 'ambush_zone' && !poi._ambushStarted) {
          poi._ambushStarted = true;
          poi._ambushTimer = 0;
          WorldBoundary.announce('⚠️ AMBUSH!', 1.5);
          WorldBoundary.playAudio('alert');
        }
        
        // Show POI label
        if (!poi._announced && poi.label) {
          WorldBoundary.announce(`${poi.icon || '📍'} ${poi.label}`, 2);
          poi._announced = true;
          if (!poi._ambushStarted) {
            WorldBoundary.playAudio('poiTrigger');
          }
        }
      }
      
      // ── CHECK CLEARED: all POI enemies dead ──
      if (poi.triggered && !poi.cleared && poi.enemies && poi.enemies.length > 0) {
        const allDead = poi.enemies.every(e => {
          // Find matching spawn in zone
          const spawn = zone.enemySpawns.find(s => s.poiId === poi.id && 
            Math.abs(s.x - e.x) < 5 && Math.abs(s.y - e.y) < 5);
          return spawn ? spawn.killed : true;
        });
        if (allDead) {
          poi.cleared = true;
          if (poi.label) {
            WorldBoundary.announce(`✅ ${poi.label} CLEARED!`, 2);
          }
          const AudioClr = State.modules?.Audio;
          if (AudioClr?.poiCleared) AudioClr.poiCleared();
          
          // v2.13.0: Mission tracking
          WorldBoundary.emitPOICleared();
          
          // If no collectible reward, mark as collected so marker disappears
          if (!poi.reward) {
            poi.collected = true;
          }
        }
      }
      
      // ── COLLECT REWARD: walk into cleared POI ──
      if (poi.cleared && !poi.collected && poi.reward && dist < 80) {
        this._collectPOIReward(poi);
      }
      // Auto-collect reward 2s after clearing (so player doesn't need exact position)
      if (poi.cleared && !poi.collected && poi.reward) {
        poi._clearTimer = (poi._clearTimer || 0) + dt;
        if (poi._clearTimer > 2.0 && dist < poi.radius + 50) {
          this._collectPOIReward(poi);
        }
      }
      
      // ── DEFENSE BEACON: interactable ──
      if (poi.type === 'defense_beacon' && poi.interactable && !poi.cleared && dist < poi.radius) {
        poi._showPrompt = true;
        if (State.input?.interact) {
          State.input.interact = false;
          this._startBeaconDefense(poi);
        }
      } else if ((poi.type === 'salvage_wreck' || poi.type === 'instance_exit') && poi.interactable && dist < poi.radius) {
        poi._showPrompt = true;
        if (State.input?.interact) {
          State.input.interact = false;
          if (poi.type === 'salvage_wreck') {
            this.enterDerelictInstance(poi);
            return;
          }
          if (poi.type === 'instance_exit') {
            this.exitActiveInstance();
            return;
          }
        }
      } else if (poi._showPrompt) {
        poi._showPrompt = false;
      }
      
      // ── BEACON WAVE LOGIC ──
      if (poi._beaconActive) {
        poi._beaconTimer = (poi._beaconTimer || 0) + dt;
        
        // Spawn waves
        if (poi._beaconWave < poi.waveConfig.count) {
          const waveInterval = 8; // seconds between waves
          if (poi._beaconTimer >= waveInterval * (poi._beaconWave + 1)) {
            this._spawnBeaconWave(poi);
            poi._beaconWave++;
            if (State.ui) State.ui.announcement = { 
              text: `📡 WAVE ${poi._beaconWave}/${poi.waveConfig.count}`, timer: 1.5 
            };
          }
        }
        
        // Check if all beacon enemies are dead after final wave
        if (poi._beaconWave >= poi.waveConfig.count) {
          const allBeaconDead = (poi._beaconEnemyIds || []).every(eid => {
            const e = State.enemies.find(en => en.id === eid);
            return !e || e.dead;
          });
          if (allBeaconDead) {
            poi._beaconActive = false;
            poi.cleared = true;
            if (!poi.reward) poi.collected = true;
            WorldBoundary.announce('📡 BEACON DEFENDED! Rewards unlocked!', 2.5);
            WorldBoundary.playAudio('beaconActivate');
          }
        }
      }
    }
  },
  
  _collectPOIReward(poi) {
    poi.collected = true;
    WorldBoundary.playAudio('poiReward');
    const reward = poi.reward;
    
    if (reward.scrap) {
      State.meta.scrap = (State.meta.scrap || 0) + reward.scrap;
      State.pickups.push({
        type: 'scrap', x: poi.x, y: poi.y,
        vx: 0, vy: -20, life: 0.5, value: reward.scrap, _visual: true
      });
    }
    if (reward.cells) {
      State.run.cells = (State.run.cells || 0) + reward.cells;
    }
    if (reward.voidShards) {
      State.meta.voidShards = (State.meta.voidShards || 0) + reward.voidShards;
    }
    
    // Loot cache → spawn item pickup
    if (reward.type === 'loot_cache') {
      const ilvl = State.run.currentDepth || State.meta.level || 1;
      State.pickups.push({
        type: 'item', x: poi.x, y: poi.y + 10,
        vx: (Math.random() - 0.5) * 50, vy: -40 + Math.random() * 20,
        life: 20, rarity: reward.rarity || 'rare', ilvl
      });
      // Second item for epic+ POIs
      if (['epic', 'legendary', 'mythic'].includes(reward.rarity)) {
        State.pickups.push({
          type: 'item', x: poi.x + 15, y: poi.y - 10,
          vx: (Math.random() - 0.5) * 60, vy: -30 + Math.random() * 20,
          life: 20, rarity: reward.rarity === 'legendary' ? 'epic' : 'rare', ilvl
        });
      }
    }
    
    // Cells reward
    if (reward.type === 'cells') {
      State.run.cells = (State.run.cells || 0) + (reward.value || 0);
    }
    
    // VFX
    const Particles = State.modules?.Particles;
    if (Particles) {
      Particles.explosion(poi.x, poi.y, '#ffdd00', 20, 200);
      Particles.ring(poi.x, poi.y, '#ffaa00', 80);
    }
    
    // Announcement
    const parts = [];
    if (reward.scrap) parts.push(`+${reward.scrap} ⚙`);
    if (reward.cells) parts.push(`+${reward.cells} ⚡`);
    if (reward.voidShards) parts.push(`+${reward.voidShards} 💠`);
    if (reward.type === 'loot_cache') parts.push(`${reward.rarity} item!`);
    if (State.ui) State.ui.announcement = { text: `🎁 ${parts.join(' ')}`, timer: 2.5 };
    
    const Audio = State.modules?.Audio;
    if (Audio?.pickup) Audio.pickup();
  },
  
  _startBeaconDefense(poi) {
    poi._beaconActive = true;
    poi._beaconTimer = 0;
    poi._beaconWave = 0;
    poi._beaconEnemyIds = [];
    poi.interactable = false;
    WorldBoundary.announce('📡 BEACON ACTIVATED! Defend!', 2);
    // Spawn first wave immediately
    this._spawnBeaconWave(poi);
    poi._beaconWave = 1;
  },
  
  _spawnBeaconWave(poi) {
    const { Enemies } = State.modules;
    if (!Enemies) return;
    
    const pool = poi.waveConfig.pool || ['grunt'];
    const count = poi.waveConfig.enemiesPerWave || 5;
    
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const dist = 300 + Math.random() * 150;
      const ex = poi.x + Math.cos(angle) * dist;
      const ey = poi.y + Math.sin(angle) * dist;
      
      const type = pool[Math.floor(Math.random() * pool.length)];
      const enemy = Enemies.spawn(type, ex, ey, false, false);
      if (enemy) {
        enemy.aiState = 'aggro'; // immediately aggressive
        poi._beaconEnemyIds.push(enemy.id);
      }
    }
  },
  
  _drawInstanceTileModules(ctx, screenW, screenH) {
    // Grid-bound instances render floor + walls from the unified spec grid,
    // so what you see is exactly what you collide with (no art/collider drift).
    if (this.currentZone?.instanceGrid) {
      this._drawInstanceGrid(ctx, screenW, screenH);
      return;
    }
    const modules = this.currentZone?.instanceTiles;
    if (!modules || !modules.length) return;
    if (!this._instanceTileImageCache) this._instanceTileImageCache = {};

    const orderedModules = modules.slice().sort((a, b) => {
      const ay = (a.gy ?? 0) - (b.gy ?? 0);
      return ay !== 0 ? ay : ((a.gx ?? 0) - (b.gx ?? 0));
    });

    for (const mod of orderedModules) {
      const visR = (mod.size || 1024) * 0.75;
      if (!Camera.isVisible(mod.x, mod.y, visR, screenW, screenH)) continue;
      if (!this._instanceTileImageCache[mod.imagePath]) {
        const img = new Image();
        img.src = mod.imagePath;
        this._instanceTileImageCache[mod.imagePath] = img;
      }
      const tileImg = this._instanceTileImageCache[mod.imagePath];
      if (!(tileImg?.complete && tileImg.naturalWidth > 0)) continue;

      const size = mod.size || 1024;
      const half = size / 2;
      ctx.save();
      ctx.translate(mod.x, mod.y);
      ctx.rotate((mod.rotationDeg || 0) * Math.PI / 180);
      ctx.globalAlpha = 1;
      drawSeamSafeImage(ctx, tileImg, -half, -half, size, size, 0);
      if (State?.debug?.instanceTiles) {
        ctx.strokeStyle = 'rgba(0,220,255,0.28)';
        ctx.lineWidth = 4;
        ctx.strokeRect(-half, -half, size, size);
      }
      ctx.restore();
    }
  },

  _drawInstanceGrid(ctx, screenW, screenH) {
    const grid = this.currentZone?.instanceGrid;
    if (!grid) return;
    const { cells, cols, rows, cellSize, originX, originY } = grid;
    const cs = cellSize;
    const FLOOR = '#2b313d', FLOOR_ALT = '#252a34', WALL = '#0d1117', EDGE = '#586a82';
    const isFloor = (gx, gy) => gx >= 0 && gy >= 0 && gx < cols && gy < rows && cells[gy][gx] === 1;
    const vis = (wx, wy) => Camera.isVisible(wx + cs / 2, wy + cs / 2, cs, screenW, screenH);

    // Floor cells (checker tint for readability)
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        if (cells[gy][gx] !== 1) continue;
        const wx = originX + gx * cs, wy = originY + gy * cs;
        if (!vis(wx, wy)) continue;
        ctx.fillStyle = ((gx + gy) & 1) ? FLOOR : FLOOR_ALT;
        ctx.fillRect(wx, wy, cs + 0.6, cs + 0.6);
      }
    }
    // Wall cells = solid cells bordering floor. The floor/wall boundary is
    // exactly where collision stops the player, so visuals == collision.
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        if (cells[gy][gx] === 1) continue;
        if (!(isFloor(gx + 1, gy) || isFloor(gx - 1, gy) || isFloor(gx, gy + 1) || isFloor(gx, gy - 1))) continue;
        const wx = originX + gx * cs, wy = originY + gy * cs;
        if (!vis(wx, wy)) continue;
        ctx.fillStyle = WALL;
        ctx.fillRect(wx, wy, cs + 0.6, cs + 0.6);
        ctx.strokeStyle = EDGE; ctx.lineWidth = 2;
        ctx.beginPath();
        if (isFloor(gx, gy + 1)) { ctx.moveTo(wx, wy + cs); ctx.lineTo(wx + cs, wy + cs); }
        if (isFloor(gx, gy - 1)) { ctx.moveTo(wx, wy); ctx.lineTo(wx + cs, wy); }
        if (isFloor(gx - 1, gy)) { ctx.moveTo(wx, wy); ctx.lineTo(wx, wy + cs); }
        if (isFloor(gx + 1, gy)) { ctx.moveTo(wx + cs, wy); ctx.lineTo(wx + cs, wy + cs); }
        ctx.stroke();
      }
    }
  },

  _drawPOIs(ctx, screenW, screenH) {
    const zone = this.currentZone;
    if (!zone || !zone.pois) return;
    
    const t = Date.now() * 0.001;
    
    for (const poi of zone.pois) {
      if (poi.collected) continue;
      if (poi.hidden && !poi.triggered) continue;
      
      if (!Camera.isVisible(poi.x, poi.y, poi.radius + 100, screenW, screenH)) continue;
      
      // ── POI RADIUS INDICATOR ──
      // Subtle dashed circle showing POI area
      if (!poi.cleared) {
        ctx.save();
        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = poi.cleared ? 'rgba(0,255,100,0.15)' : 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(poi.x, poi.y, poi.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
      
      // ── FLOATING ICON ──
      const bobY = Math.sin(t * 2 + poi.x * 0.01) * 5;
      const iconY = poi.y - 40 + bobY;
      
      // Background circle
      const bgAlpha = poi.cleared ? 0.6 : 0.4;
      const bgColor = poi.cleared ? 'rgba(0,200,100,' + bgAlpha + ')' : 'rgba(40,40,60,' + bgAlpha + ')';
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      ctx.arc(poi.x, iconY, 18, 0, Math.PI * 2);
      ctx.fill();
      
      // Border
      const borderColor = poi.cleared ? '#00ff88' : 
                           poi.triggered ? '#ffaa00' : '#888888';
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(poi.x, iconY, 18, 0, Math.PI * 2);
      ctx.stroke();
      
      // Icon text
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(poi.icon || '?', poi.x, iconY);
      
      // Label (only when close)
      const playerDist = Math.hypot(State.player.x - poi.x, State.player.y - poi.y);
      if (playerDist < poi.radius + 200) {
        const tierCol = poi.tier === 'chaos' ? '#ff2e63' : (poi.tier === 'risk' ? '#ff9933' : null);
        ctx.fillStyle = tierCol || borderColor;
        ctx.font = 'bold 10px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(poi.label || '', poi.x, iconY - 24);
        
        // Status text
        if (poi.cleared && !poi.collected && poi.reward) {
          ctx.fillStyle = '#00ff88';
          ctx.font = '9px Orbitron, sans-serif';
          const pulse = 0.7 + Math.sin(t * 4) * 0.3;
          ctx.globalAlpha = pulse;
          ctx.fillText('[ COLLECT ]', poi.x, iconY + 26);
          ctx.globalAlpha = 1;
        } else if (poi._showPrompt) {
          ctx.fillStyle = tierCol || '#ffdd00';
          ctx.font = '9px Orbitron, sans-serif';
          ctx.fillText('[ PRESS E ]', poi.x, iconY + 26);
        } else if (poi.triggered && !poi.cleared) {
          ctx.fillStyle = '#ff6644';
          ctx.font = '9px Orbitron, sans-serif';
          ctx.fillText('[ CLEAR ENEMIES ]', poi.x, iconY + 26);
        }
      }
    }
  },
  
  // ============================================================
  // CHAOS MODE EFFECTS
  // ============================================================
  
  _updateChaosEffects(dt) {
    const diff = State.run.difficulty;
    if (diff !== 'chaos') return;
    
    const player = State.player;
    const zone = this.currentZone;
    if (!zone) return;
    
    // ── POISON AREAS: DOT when player stands in them ──
    for (const obs of zone.obstacles) {
      if (obs.type !== 'poison_area' || obs.destroyed) continue;
      const dist = Math.hypot(player.x - obs.x, player.y - obs.y);
      if (dist < obs.radius) {
        // Apply DOT
        const dotDmg = (obs.dotDamage || 3) * dt;
        const PlayerMod = State.modules?.Player;
        if (PlayerMod) PlayerMod.takeDamage(dotDmg);
        
        // Poison SFX (throttled)
        if (!this._lastPoisonSfx || Date.now() - this._lastPoisonSfx > 800) {
          const AudioMod = State.modules?.Audio;
          if (AudioMod?.poisonDot) AudioMod.poisonDot();
          this._lastPoisonSfx = Date.now();
        }
        
        // Green particles while in zone
        if (Math.random() < 0.3) {
          State.particles.push({
            x: player.x + (Math.random() - 0.5) * 30,
            y: player.y + (Math.random() - 0.5) * 30,
            vx: (Math.random() - 0.5) * 40,
            vy: -20 - Math.random() * 30,
            life: 0.5, maxLife: 0.6,
            color: '#44ff00', size: 3
          });
        }
      }
    }
    
    // ── HUNTING MINES: slowly track player ──
    for (const obs of zone.obstacles) {
      if (!obs.hunting || obs.destroyed || obs.type !== 'mine') continue;
      const dx = player.x - obs.x;
      const dy = player.y - obs.y;
      const dist = Math.hypot(dx, dy);
      
      // Only hunt within 1200px
      if (dist < 1200 && dist > 5) {
        const speed = (obs.huntSpeed || 40) * dt;
        obs.x += (dx / dist) * speed;
        obs.y += (dy / dist) * speed;
        
        // Alert beep when close (throttled)
        if (dist < 200 && (!obs._lastBeep || Date.now() - obs._lastBeep > 1500)) {
          const AudioMod = State.modules?.Audio;
          if (AudioMod?.huntingMineAlert) AudioMod.huntingMineAlert();
          obs._lastBeep = Date.now();
        }
      }
    }
  },

  // ============================================================
  // DIFFICULTY LANE SYSTEM
  // ============================================================
  // Normal: standard gameplay
  // Risk: high elite density, better loot and cells
  // Chaos: corrupted enemies, all elites, DOTs, hunting mines, poison, extreme loot
  
  _getDifficultyMods(difficulty) {
    switch (difficulty) {
      case 'risk':
        return {
          mapMods: ['ELITE_PACKS', 'FAST_ENEMIES'],
          enemyHPMult: 1.3,
          enemyDamageMult: 1.2,
          eliteDensityMult: 3.0,    // 3× elites
          lootRarityBoost: 1,       // +1 rarity tier on drops
          cellsMult: 1.8,           // +80% cells
          scrapMult: 1.5,           // +50% scrap
          xpMult: 1.5,             // +50% XP
          asteroidHPMult: 1.0,
          promotionChance: 0.0,     // no auto-elite promotion
          dotDamage: 0,
          huntingMines: false,
          poisonAreas: false,
          corruptVisual: false
        };
      case 'chaos':
        return {
          mapMods: ['ELITE_PACKS', 'BULLET_HELL', 'FAST_ENEMIES', 'MINEFIELD', 'DENSE_OBSTACLES'],
          enemyHPMult: 3.0,          // 3× HP (was 1.8 — barely noticeable)
          enemyDamageMult: 2.5,      // 2.5× damage (was 1.6 — not threatening)
          enemySpeedMult: 1.4,       // 40% faster movement
          eliteDensityMult: 4.0,     // 4× elites (was 5 — slightly less spam)
          lootRarityBoost: 1,        // +1 tier only (was +2 = instant legendary)
          cellsMult: 2.5,            // 2.5× cells
          scrapMult: 2.0,            // 2× scrap (was 2.5)
          xpMult: 2.0,              // 2× XP (was 2.5)
          asteroidHPMult: 2.0,       // tougher asteroids
          promotionChance: 0.3,      // 30% elite promo (was 60% — too many)
          dotDamage: 5,              // 5 env DOT/s (was 3)
          huntingMines: true,
          poisonAreas: true,
          corruptVisual: true,       // subtle ring glow (no more purple blob)
          voidShardMult: 2.0,        // 2× void shards (was 3×)
          cosmicDustMult: 3.0        // 3× cosmic dust (was 5×)
        };
      default: // 'normal'
        return {
          mapMods: [],
          enemyHPMult: 1.0,
          enemyDamageMult: 1.0,
          eliteDensityMult: 1.0,
          lootRarityBoost: 0,
          cellsMult: 1.0,
          scrapMult: 1.0,
          xpMult: 1.0,
          asteroidHPMult: 1.0,
          promotionChance: 0.0,
          dotDamage: 0,
          huntingMines: false,
          poisonAreas: false,
          corruptVisual: false
        };
    }
  },
  
  // Get current difficulty modifiers (accessible from other modules)
  getDiffMods() {
    return this._getDifficultyMods(State.run.difficulty || 'normal');
  },

  getDirectorMods() {
    return State.modules?.Director?.getModifiers?.() || {
      spawnRateMult: 1,
      elitePromotionChance: 0,
      hazardRateMult: 1,
      lootDropMult: 1,
      xpMult: 1,
      cellBonusChance: 0
    };
  },

  _getDynamicSpawnRadius() {
    const mult = this.getDirectorMods().spawnRateMult || 1;
    return this.spawnRadius * Math.max(0.6, Math.min(1.65, mult));
  },

  _getDynamicBossRadius() {
    return this._getDynamicSpawnRadius() * 1.35;
  },

  _directorReinforce(dt, player) {
    const director = State.modules?.Director;
    if (!director || !this.currentZone) return;
    const phase = director.getPhase?.();
    if (!(phase === 'build' || phase === 'peak' || phase === 'ambush')) return;

    this._directorSpawnCooldown = (this._directorSpawnCooldown || 0) - dt;
    if (this._directorSpawnCooldown > 0) return;

    const mods = this.getDirectorMods();
    
    // Try existing spawn points first
    const candidates = (this.currentZone.enemySpawns || []).filter(spawn => {
      if (!spawn || spawn.killed || spawn.active) return false;
      const dist = Math.hypot(player.x - spawn.x, player.y - spawn.y);
      return dist < this._getDynamicSpawnRadius() * 1.15;
    });

    if (candidates.length > 0) {
      const spawn = candidates[Math.floor(Math.random() * candidates.length)];
      const isElite = phase === 'peak' && Math.random() < (mods.elitePromotionChance || 0.1);
      this.spawnEnemy(spawn, isElite, true);
    } else if (phase === 'peak' || phase === 'ambush') {
      // v2.16.3: Spawn FRESH enemies at screen edge during peak/ambush
      const angle = Math.random() * Math.PI * 2;
      const dist = 800 + Math.random() * 400; // just outside screen
      const sx = player.x + Math.cos(angle) * dist;
      const sy = player.y + Math.sin(angle) * dist;
      // Clamp to zone
      const zone = this.currentZone;
      const x = Math.max(50, Math.min(zone.width - 50, sx));
      const y = Math.max(50, Math.min(zone.height - 50, sy));
      // Pick random enemy from zone pool
      const pool = zone.enemySpawns?.map(s => s.type).filter(Boolean) || ['grunt'];
      const type = pool[Math.floor(Math.random() * pool.length)];
      const isElite = phase === 'ambush' || Math.random() < (mods.elitePromotionChance || 0.15);
      const Enemies = State.modules?.Enemies;
      if (Enemies) {
        const enemy = Enemies.spawn(type, x, y, isElite, false);
        if (enemy) {
          enemy.aiState = 'aggro'; // immediately aggressive
          enemy.aggroTarget = player;
        }
      }
    }
    
    // Spawn rate: faster during peak/ambush
    const rate = Math.max(0.5, mods.spawnRateMult || 1);
    const baseCD = phase === 'ambush' ? 1.2 : phase === 'peak' ? 1.8 : 2.6;
    this._directorSpawnCooldown = Math.max(0.4, baseCD / rate);
  },

  // ============================================================
  // MINIMAP POI MARKERS
  // ============================================================
  
  drawMinimapPOIs(ctx, mmX, mmY, mmW, mmH, zoneW, zoneH) {
    const zone = this.currentZone;
    if (!zone || !zone.pois) return;
    
    const scaleX = mmW / zoneW;
    const scaleY = mmH / zoneH;
    
    for (const poi of zone.pois) {
      if (poi.collected) continue;
      if (poi.hidden && !poi.triggered) continue;
      
      const px = mmX + poi.x * scaleX;
      const py = mmY + poi.y * scaleY;
      
      // Color by state
      if (poi.cleared) {
        ctx.fillStyle = '#00ff88';
      } else if (poi.triggered) {
        ctx.fillStyle = '#ffaa00';
      } else {
        ctx.fillStyle = '#888888';
      }
      
      // Diamond marker
      const s = 3;
      ctx.beginPath();
      ctx.moveTo(px, py - s);
      ctx.lineTo(px + s, py);
      ctx.lineTo(px, py + s);
      ctx.lineTo(px - s, py);
      ctx.closePath();
      ctx.fill();
    }
    
    // Resource node markers (smaller dots)
    if (zone.resourceNodes) {
      for (const node of zone.resourceNodes) {
        if (node.destroyed) continue;
        const nx = mmX + node.x * scaleX;
        const ny = mmY + node.y * scaleY;
        ctx.fillStyle = node.glow || '#ffaa00';
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(nx, ny, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  },

  // ── Biome Hazard System ──
  _updateHazards(dt) {
    const zone = this.currentZone;
    if (!zone) return;
    const hazards = this.currentAct?.hazards || [];
    if (hazards.length === 0) return;
    
    const player = State.player;
    const PlayerMod = State.modules?.Player;
    const Particles = State.modules?.Particles;
    const hazardRateMult = this.getDirectorMods().hazardRateMult || 1;
    
    // Lazy-init hazard zones (placed during zone generation, stored on zone)
    if (!zone._hazardZones) {
      zone._hazardZones = [];
      const rng = { range: (a,b) => a + Math.random() * (b-a) };
      for (const h of hazards) {
        const count = h === 'gravity_wells' ? 2 : (h === 'void_rifts' ? 3 : 4);
        for (let i = 0; i < count; i++) {
          zone._hazardZones.push({
            type: h,
            x: rng.range(100, zone.width - 100),
            y: rng.range(100, zone.height - 100),
            radius: h === 'gravity_wells' ? 200 : (h === 'void_rifts' ? 150 : 120),
            strength: 1.0
          });
        }
      }
      zone._hazardTimer = 0;
    }
    
    zone._hazardTimer = (zone._hazardTimer || 0) + dt;
    
    for (const hz of zone._hazardZones) {
      const dx = player.x - hz.x;
      const dy = player.y - hz.y;
      const dist = Math.hypot(dx, dy);
      if (dist > hz.radius * 1.5) continue; // out of range
      
      const inZone = dist < hz.radius;
      const falloff = inZone ? 1.0 : Math.max(0, 1 - (dist - hz.radius) / (hz.radius * 0.5));
      
      switch (hz.type) {
        case 'toxic_clouds':
          // Periodic damage inside cloud (1% maxHP/s)
          if (inZone && PlayerMod) {
            hz._dmgTimer = (hz._dmgTimer || 0) + dt * hazardRateMult;
            if (hz._dmgTimer >= 0.5) {
              hz._dmgTimer = 0;
              PlayerMod.takeDamage(Math.max(1, Math.floor(player.maxHP * 0.005)));
            }
          }
          break;
          
        case 'gravity_wells':
          // Pull player toward center
          if (dist > 10 && dist < hz.radius * 1.3) {
            const pull = 80 * falloff * dt * Math.max(0.75, hazardRateMult);
            player.x -= (dx / dist) * pull;
            player.y -= (dy / dist) * pull;
          }
          break;
          
        case 'void_rifts':
          // Intermittent damage pulse every 2s
          if (inZone && PlayerMod) {
            hz._pulseTimer = (hz._pulseTimer || 0) + dt * hazardRateMult;
            if (hz._pulseTimer >= 2.0) {
              hz._pulseTimer = 0;
              PlayerMod.takeDamage(Math.max(2, Math.floor(player.maxHP * 0.02)));
              if (Particles) {
                Particles.ring(hz.x, hz.y, '#8800ff', hz.radius * 0.6);
                Particles.flash(player.x, player.y, '#aa44ff', 8);
              }
            }
          }
          break;
          
        case 'radiation_pockets':
          // Slow + damage over time
          if (inZone) {
            player.vx *= (1 - 0.3 * dt); // slight slow
            player.vy *= (1 - 0.3 * dt);
            hz._dmgTimer = (hz._dmgTimer || 0) + dt * hazardRateMult;
            if (hz._dmgTimer >= 1.0 && PlayerMod) {
              hz._dmgTimer = 0;
              PlayerMod.takeDamage(Math.max(1, Math.floor(player.maxHP * 0.008)));
            }
          }
          break;
          
        case 'debris_storm':
          // Random projectile-like hits
          if (inZone) {
            hz._stormTimer = (hz._stormTimer || 0) + dt * hazardRateMult;
            if (hz._stormTimer >= 1.5) {
              hz._stormTimer = 0;
              if (Math.random() < 0.4 && PlayerMod) {
                PlayerMod.takeDamage(Math.max(2, Math.floor(player.maxHP * 0.015)));
                if (Particles) {
                  Particles.explosion(player.x, player.y, '#887766', 6, 80);
                }
              }
            }
          }
          break;
      }
    }
  },
  
  // Draw hazard zones (called from draw)
  _drawHazards(ctx) {
    const zone = this.currentZone;
    if (!zone?._hazardZones) return;
    const t = performance.now() * 0.001;
    const screenW = ctx.canvas?.width || 1920;
    const screenH = ctx.canvas?.height || 1080;
    
    for (const hz of zone._hazardZones) {
      if (!Camera.isVisible(hz.x, hz.y, hz.radius * 2, screenW, screenH)) continue;
      
      ctx.save();
      const pulse = 0.4 + Math.sin(t * 2 + hz.x * 0.01) * 0.15;
      
      switch (hz.type) {
        case 'toxic_clouds': {
          const grad = ctx.createRadialGradient(hz.x, hz.y, 0, hz.x, hz.y, hz.radius);
          grad.addColorStop(0, `rgba(0,180,0,${pulse * 0.25})`);
          grad.addColorStop(0.6, `rgba(0,120,0,${pulse * 0.15})`);
          grad.addColorStop(1, 'rgba(0,80,0,0)');
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(hz.x, hz.y, hz.radius, 0, Math.PI * 2); ctx.fill();
          // Swirl particles
          ctx.strokeStyle = `rgba(0,255,0,${pulse * 0.2})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(hz.x, hz.y, hz.radius * 0.5 + Math.sin(t * 3) * 15, t * 0.5, t * 0.5 + 2);
          ctx.stroke();
          break;
        }
        case 'gravity_wells': {
          // Dark vortex
          const grad = ctx.createRadialGradient(hz.x, hz.y, 0, hz.x, hz.y, hz.radius);
          grad.addColorStop(0, `rgba(20,0,40,${pulse * 0.6})`);
          grad.addColorStop(0.5, `rgba(40,0,80,${pulse * 0.3})`);
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(hz.x, hz.y, hz.radius, 0, Math.PI * 2); ctx.fill();
          // Spiral arms
          ctx.strokeStyle = `rgba(100,50,200,${pulse * 0.35})`;
          ctx.lineWidth = 2;
          for (let arm = 0; arm < 3; arm++) {
            ctx.beginPath();
            const offset = (arm / 3) * Math.PI * 2;
            for (let s = 0; s < 30; s++) {
              const angle = offset + t * 1.5 + s * 0.2;
              const r = 10 + s * (hz.radius * 0.03);
              const px = hz.x + Math.cos(angle) * r;
              const py = hz.y + Math.sin(angle) * r;
              s === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
            }
            ctx.stroke();
          }
          break;
        }
        case 'void_rifts': {
          const grad = ctx.createRadialGradient(hz.x, hz.y, 0, hz.x, hz.y, hz.radius);
          grad.addColorStop(0, `rgba(100,0,180,${pulse * 0.4})`);
          grad.addColorStop(0.7, `rgba(60,0,120,${pulse * 0.2})`);
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(hz.x, hz.y, hz.radius, 0, Math.PI * 2); ctx.fill();
          // Crackling edge
          ctx.strokeStyle = `rgba(180,80,255,${0.3 + Math.sin(t * 8 + hz.y) * 0.2})`;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 8]);
          ctx.beginPath(); ctx.arc(hz.x, hz.y, hz.radius * 0.8, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
          break;
        }
        case 'radiation_pockets': {
          const grad = ctx.createRadialGradient(hz.x, hz.y, 0, hz.x, hz.y, hz.radius);
          grad.addColorStop(0, `rgba(200,200,0,${pulse * 0.2})`);
          grad.addColorStop(0.5, `rgba(180,120,0,${pulse * 0.12})`);
          grad.addColorStop(1, 'rgba(100,80,0,0)');
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(hz.x, hz.y, hz.radius, 0, Math.PI * 2); ctx.fill();
          // Warning symbol
          ctx.strokeStyle = `rgba(255,200,0,${pulse * 0.4})`;
          ctx.lineWidth = 2;
          const sz = 12;
          ctx.beginPath();
          ctx.moveTo(hz.x, hz.y - sz);
          ctx.lineTo(hz.x - sz * 0.87, hz.y + sz * 0.5);
          ctx.lineTo(hz.x + sz * 0.87, hz.y + sz * 0.5);
          ctx.closePath();
          ctx.stroke();
          break;
        }
        case 'debris_storm': {
          ctx.globalAlpha = pulse * 0.3;
          ctx.fillStyle = '#665544';
          // Floating debris chunks
          for (let i = 0; i < 6; i++) {
            const angle = t * 0.4 + i * 1.05;
            const r = hz.radius * (0.3 + (i % 3) * 0.2);
            const cx = hz.x + Math.cos(angle) * r;
            const cy = hz.y + Math.sin(angle) * r;
            ctx.fillRect(cx - 3, cy - 2, 6, 4);
          }
          // Dust haze
          const grad = ctx.createRadialGradient(hz.x, hz.y, 0, hz.x, hz.y, hz.radius);
          grad.addColorStop(0, `rgba(80,60,40,${pulse * 0.15})`);
          grad.addColorStop(1, 'rgba(40,30,20,0)');
          ctx.globalAlpha = 1;
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(hz.x, hz.y, hz.radius, 0, Math.PI * 2); ctx.fill();
          break;
        }
      }
      ctx.restore();
    }
  },
  
  // Spawn regular enemy
  spawnEnemy(spawn, isElite = false, fromDirector = false) {
    const { Enemies } = State.modules;
    
    // Calculate level based on DEPTH (zone), not just player level
    const depth = State.run.currentDepth || 1;
    const playerLvl = State.meta.level || 1;
    let enemyLvl;
    
    if (isElite) {
      enemyLvl = Math.max(playerLvl, depth); // Elite = zone level or player level
    } else {
      enemyLvl = Math.max(playerLvl - 1, depth - Math.floor(Math.random() * 2));
    }
    enemyLvl = Math.max(1, enemyLvl);
    
    // Create enemy
    const enemy = Enemies.spawn(spawn.type, spawn.x, spawn.y, isElite, false);
    enemy.spawnRef = spawn;
    enemy.level = enemyLvl;

    // World AI baseline (patrol -> aggro -> return)
    const patrolType = spawn.patrol || (isElite ? 'circle' : 'wander');
    const patrolRadius = spawn.patrolRadius || (isElite ? 140 : 110);

    enemy.homeX = spawn.x;
    enemy.homeY = spawn.y;
    enemy.aiState = 'patrol';
    enemy.patrol = patrolType;
    enemy.patrolRadius = patrolRadius;
    enemy.patrolAngle = Math.random() * Math.PI * 2;
    enemy.patrolDir = Math.random() < 0.5 ? -1 : 1;
    enemy.patrolTimer = 0;
    enemy.wanderTarget = null;
    enemy.wanderTimer = 0;

    // Engagement envelope (tuned for exploration)
    enemy.aggroRange = spawn.aggroRange || (isElite ? 520 : 420);
    enemy.attackRange = spawn.attackRange || enemy.aggroRange;
    enemy.disengageRange = spawn.disengageRange || enemy.aggroRange * 1.65;
    enemy.leashRange = spawn.leashRange || Math.max(enemy.aggroRange * 2.2, patrolRadius * 5);
    enemy.returnThreshold = Math.max(40, enemy.size * 1.2);
    
    // ══ DEPTH-BASED SCALING ══
    // Linear curve: +12% HP and +8% damage per zone level
    // z1=1×, z50=6.88×, z100=12.88×, z250=30.88×, z600=72.88×
    const depthHPScale = 1 + (enemyLvl - 1) * 0.12;
    const depthDmgScale = 1 + (enemyLvl - 1) * 0.08;
    const depthXPScale = 1 + (enemyLvl - 1) * 0.10;
    enemy.hp *= depthHPScale;
    enemy.maxHP *= depthHPScale;
    enemy.damage *= depthDmgScale;
    enemy.xp = Math.floor(enemy.xp * depthXPScale);
    
    // ══ TIER MULTIPLIER (from acts.json per-tier config) ══
    const tierHPMult = this.currentAct?.enemyHPMult || 1;
    const tierDmgMult = this.currentAct?.enemyDmgMult || 1;
    const tierXPMult = this.currentAct?.xpMult || 1;
    enemy.hp *= tierHPMult;
    enemy.maxHP *= tierHPMult;
    enemy.damage *= tierDmgMult;
    enemy.xp = Math.floor(enemy.xp * tierXPMult);
    
    // ═══ DIFFICULTY SCALING ═══
    const diffMods = this.getDiffMods();
    enemy.hp *= diffMods.enemyHPMult;
    enemy.maxHP *= diffMods.enemyHPMult;
    enemy.damage *= diffMods.enemyDamageMult;
    enemy.xp = Math.floor(enemy.xp * diffMods.xpMult);
    if (diffMods.enemySpeedMult) {
      enemy.speed = (enemy.speed || 80) * diffMods.enemySpeedMult;
    }
    
    // ═══ ZONE MOD EFFECTS ═══
    const zoneMods = new Set(this.currentZone?.mods || []);
    if (zoneMods.has('ARMORED'))     { enemy.hp *= 1.4; enemy.maxHP *= 1.4; }
    if (zoneMods.has('ENRAGED'))     { enemy.damage *= 1.35; }
    if (zoneMods.has('FAST_ENEMIES')){ enemy.speed = (enemy.speed || 80) * 1.3; }
    if (zoneMods.has('OVERCHARGED')) { enemy.shootInterval = (enemy.shootInterval || 2) * 0.67; }
    if (zoneMods.has('REGEN'))       { enemy._regenRate = enemy.maxHP * 0.01; } // 1%/sec
    if (zoneMods.has('VOLATILE'))    { enemy._volatile = true; }
    if (zoneMods.has('CLOAKED'))     { enemy._cloaked = true; enemy._cloakAlpha = 0.15; }
    if (zoneMods.has('FRENZIED'))    { 
      enemy.aggroRange = (enemy.aggroRange || 420) * 2;
      enemy.attackRange = (enemy.attackRange || 420) * 2;
    }
    if (zoneMods.has('REFLECT'))     { enemy._reflectPct = 0.08; }
    
    // ═══ CORRUPTION SCALING ═══
    const corruption = State.run.corruption || 0;
    if (corruption > 0) {
      const cMults = DepthRules.getCorruptionMults(corruption);
      enemy.hp *= cMults.enemyHP;
      enemy.maxHP *= cMults.enemyHP;
      enemy.damage *= cMults.enemyDmg;
      enemy.speed = (enemy.speed || 80) * cMults.enemySpeed;
    }
    
    // Chaos + Director: promote regular enemies to elite with chance
    const directorEliteChance = this.getDirectorMods().elitePromotionChance || 0;
    const totalPromotionChance = Math.min(0.95, (diffMods.promotionChance || 0) + directorEliteChance);
    if (!isElite && totalPromotionChance > 0 && Math.random() < totalPromotionChance) {
      enemy.isElite = true;
      enemy.hp *= 1.5;
      enemy.maxHP *= 1.5;
      enemy.damage *= 1.3;
      enemy.xp = Math.floor(enemy.xp * 1.5);
      enemy.size = (enemy.size || 20) * 1.2;
    }
    
    // Chaos: corrupt visual tint
    if (diffMods.corruptVisual) {
      enemy._corrupt = true;
      enemy._corruptColor = '#aa22ff';
    }
    
    if (fromDirector) enemy._directorSpawned = true;

    spawn.active = true;
    spawn.enemyId = enemy.id;
    
    this.activeEnemies.push(enemy);
  },
  
  // Spawn boss
  spawnBoss(spawn) {
    const { Enemies } = State.modules;
    
    const depth = State.run.currentDepth || 1;
    const playerLvl = State.meta.level || 1;
    const bossLvl = Math.max(playerLvl, depth) + Math.floor(Math.random() * 3);
    
    const enemy = Enemies.spawn(spawn.type, spawn.x, spawn.y, false, true);
    enemy.spawnRef = spawn;
    enemy.level = bossLvl;

    // Boss AI baseline
    enemy.homeX = spawn.x;
    enemy.homeY = spawn.y;
    enemy.aiState = 'patrol';
    enemy.patrol = spawn.patrol || 'circle';
    enemy.patrolRadius = spawn.patrolRadius || 220;
    enemy.patrolAngle = Math.random() * Math.PI * 2;
    enemy.patrolDir = 1;
    enemy.patrolTimer = 0;

    enemy.aggroRange = spawn.aggroRange || 750;
    enemy.attackRange = spawn.attackRange || enemy.aggroRange;
    enemy.disengageRange = spawn.disengageRange || enemy.aggroRange * 1.5;
    enemy.leashRange = spawn.leashRange || Math.max(enemy.aggroRange * 2.0, enemy.patrolRadius * 6);
    enemy.returnThreshold = Math.max(60, enemy.size * 1.2);

    // ══ DEPTH-BASED BOSS SCALING ══
    // Boss gets +15% HP/lvl and +10% dmg/lvl (tougher than regular)
    const depthHPScale = 1 + (bossLvl - 1) * 0.15;
    const depthDmgScale = 1 + (bossLvl - 1) * 0.10;
    enemy.hp *= depthHPScale;
    enemy.maxHP *= depthHPScale;
    enemy.damage *= depthDmgScale;
    
    spawn.active = true;
    spawn.enemyId = enemy.id;
    
    // Announce boss
    State.ui?.showAnnouncement?.(`[!] ${enemy.name || 'BOSS'} APPEARS!`);
    const Audio = State.modules?.Audio;
    if (Audio) Audio.bossSpawn();
  },
  
  // Despawn enemy (too far)
  despawnEnemy(spawn) {
    // Remove from State.enemies
    const idx = State.enemies.findIndex(e => e.id === spawn.enemyId);
    if (idx !== -1) {
      State.enemies.splice(idx, 1);
    }
    
    spawn.active = false;
    spawn.enemyId = null;
    
    // Remove from active list
    this.activeEnemies = this.activeEnemies.filter(e => e.spawnRef !== spawn);
  },
  
  // Called when enemy dies
  onEnemyKilled(enemy) {
    if (enemy.spawnRef) {
      enemy.spawnRef.killed = true;
      enemy.spawnRef.active = false;
    }
    
    // Check if boss
    if (enemy.isBoss && this.currentZone.bossSpawn) {
      this.onBossKilled();
    }
  },
  
  // Boss killed - spawn portal to NEXT ZONE (not hub!)
  onBossKilled() {
    const nextDepth = this.zoneIndex + 2; // current index + 1 = current depth, +1 = next
    State.ui?.showAnnouncement?.('BOSS DEFEATED! Portal to Zone ' + nextDepth);
    
    // Spawn portal that advances to next zone
    this.currentZone.portals.push({
      x: this.currentZone.width / 2,
      y: this.currentZone.height / 2,
      destination: 'nextZone',
      type: 'victory'
    });

    // Also grant option to return to hub (small side portal)
    this.currentZone.portals.push({
      x: this.currentZone.width / 2 - 120,
      y: this.currentZone.height / 2 + 80,
      destination: 'hub',
      type: 'hub'
    });
  },
  
  // Player reached zone exit
  onExitReached() {
    this._checkZoneMastery();
    
    // ═══ v2.14.0: FLAWLESS ZONE CHECK ═══
    if ((State.run._zoneDamageTaken || 0) === 0) {
      try {
        const { Achievements } = State.modules || {};
        if (Achievements) Achievements.onFlawlessZone();
      } catch (e) { /* not loaded */ }
    }
    
    // ═══ OBJECTIVE REWARDS ON EXIT ═══
    const obj = State.run.objective;
    if (obj) {
      const Particles = State.modules?.Particles;
      const p = State.player;
      
      // Time trial: check if completed in time
      if (obj.type === 'timetrial' && !obj.failed && !obj.complete) {
        obj.complete = true;
        if (Particles) Particles.text(p.x, p.y - 40, '⚡ SPEED BONUS!', '#ffcc00', 16);
        if (State.ui) State.ui.announcement = { text: '⚡ TIME TRIAL COMPLETE', timer: 2.0 };
      }
      
      // Award bonus loot for completed objectives
      if (obj.complete && obj.bonusLoot) {
        const bl = obj.bonusLoot;
        if (bl.scrap) { State.run.scrapEarned += bl.scrap; }
        if (bl.cells) { State.run.cells += bl.cells; }
        if (Particles && p) {
          Particles.text(p.x, p.y - 20, `+${bl.scrap || 0}💰 +${bl.cells || 0}⚡`, '#ffcc00', 12);
        }
      }
      
      // Corruption: bonus scales with how long player stayed
      if (obj.type === 'corruption' && obj.progress > 20) {
        const corruptionBonus = Math.floor(obj.progress * 2);
        State.run.scrapEarned += corruptionBonus;
        if (Particles && p) {
          Particles.text(p.x, p.y - 55, `☠️ CORRUPTION BONUS +${corruptionBonus}`, '#ff6644', 12);
        }
      }
    }
    
    const nextZone = this.zoneIndex + 1;
    this._updateHighestZone(nextZone + 1);
    this.loadZone(nextZone);
  },
  
  // Player entered portal
  onPortalEnter(portal) {
    if (portal.destination === 'hub') {
      // Delegate to Game.returnToHub for proper save/scrap/leaderboard flow
      this._checkZoneMastery();
      this._updateHighestZone(this.zoneIndex + 1);
      if (window.Game?.returnToHub) {
        window.Game.returnToHub();
      } else {
        // Fallback: direct scene switch
        State.scene = 'hub';
      }
    } else if (portal.destination === 'nextZone') {
      // Advance to next zone (endless progression!)
      this._checkZoneMastery();
      const nextIndex = this.zoneIndex + 1;
      // console.log(`[WORLD] Portal -> Zone ${nextIndex + 1}`);
      this.loadZone(nextIndex);
    } else if (portal.destination === 'return_instance') {
      this.exitActiveInstance();
    } else if (typeof portal.destination === 'number') {
      // Jump to specific zone depth
      this.loadZone(portal.destination - 1);
    } else if (portal.destination) {
      // Load specific act/zone (legacy)
      this.init(portal.destination);
    }
  },
  
  // ═══ ZONE OBJECTIVE UPDATE ═══
  _updateObjective(dt) {
    const obj = State.run.objective;
    if (!obj || obj.complete) return;
    
    switch (obj.type) {
      case 'survival': {
        // Timer counts up, complete when target reached
        obj.progress += dt;
        if (obj.progress >= obj.target) {
          obj.complete = true;
          // Award bonus
          const Particles = State.modules?.Particles;
          const p = State.player;
          if (Particles) {
            Particles.text(p.x, p.y - 40, '✓ SURVIVED — EXIT OPEN', '#00ff88', 18);
            Particles.ring(p.x, p.y, '#00ff88', 80);
          }
          if (State.ui) State.ui.announcement = { text: '✓ SURVIVAL COMPLETE', timer: 2.5 };
          const Audio = State.modules?.Audio;
          if (Audio?.levelUp) Audio.levelUp();
        }
        break;
      }
      case 'timetrial': {
        // Timer counts up, fail if exceeds target
        if (!obj.failed) {
          obj.progress += dt;
          if (obj.progress >= obj.target) {
            obj.failed = true;
            if (State.ui) State.ui.announcement = { text: '⚡ TIME EXPIRED — No bonus', timer: 2.0 };
          }
        }
        break;
      }
      case 'corruption': {
        // Zone gets harder over time
        obj.progress += obj.corruptionRate * dt;
        obj.currentMult = 1.0 + (obj.progress / 100) * 2.0; // up to 3× at 100%
        // Tint screen increasingly red (handled in draw)
        break;
      }
      // exterminate + lockdown: progress tracked in Bullets.onEnemyKilled
    }
  },
  
  // ═══ ZONE MASTERY BONUS ═══
  // If player cleared 80%+ of POIs → bonus scrap/cells/XP burst
  _checkZoneMastery() {
    const zone = this.currentZone;
    if (!zone || !zone.pois || zone.pois.length === 0) return;
    if (zone._masteryChecked) return; // only once per zone
    zone._masteryChecked = true;
    
    const total = zone.pois.length;
    const cleared = zone.pois.filter(p => p.cleared || p.collected).length;
    const ratio = cleared / total;
    
    if (ratio < 0.8) return; // need 80%+ to trigger
    
    // Calculate bonus based on zone depth and difficulty
    const depth = this.zoneIndex + 1;
    const diffMods = this.getDiffMods();
    const bonusScrap = Math.floor((50 + depth * 10) * (diffMods.scrapMult || 1));
    const bonusCells = Math.floor((20 + depth * 5) * (diffMods.cellsMult || 1));
    const bonusXP = Math.floor((100 + depth * 25) * (diffMods.xpMult || 1));
    
    // Apply rewards
    State.run.scrapEarned += bonusScrap;
    State.run.cells += bonusCells;
    import('../Leveling.js').then(module => {
      module.Leveling.addXP(bonusXP);
    });
    
    // Announcement
    const pct = Math.floor(ratio * 100);
    if (State.ui) {
      State.ui.announcement = { 
        text: `⭐ ZONE MASTERED (${pct}%) — +${bonusScrap}💰 +${bonusCells}⚡ +${bonusXP}XP`, 
        timer: 3 
      };
    }
    
    // Audio + VFX
    const AudioZM = State.modules?.Audio;
    if (AudioZM?.zoneMastered) AudioZM.zoneMastered();
    const Particles = State.modules?.Particles;
    if (Particles) {
      Particles.explosion(State.player.x, State.player.y, '#ffcc00', 30, 300);
      Particles.ring(State.player.x, State.player.y, '#ffcc00', 200);
      Particles.ring(State.player.x, State.player.y, '#ffffff', 120);
      Particles.screenShake = Math.max(Particles.screenShake || 0, 6);
    }
    
    // console.log(`[WORLD] Zone Mastery! ${cleared}/${total} POIs (${pct}%) → +${bonusScrap} scrap, +${bonusCells} cells, +${bonusXP} XP`);
  },
  
  // Track highest zone per difficulty lane
  _updateHighestZone(zone) {
    const diff = State.run.difficulty || 'normal';
    if (!State.meta.highestZones) State.meta.highestZones = { normal: 0, risk: 0, chaos: 0 };
    State.meta.highestZones[diff] = Math.max(State.meta.highestZones[diff] || 0, zone);
    // Also keep legacy field for backwards compat
    State.meta.highestZone = Math.max(
      State.meta.highestZones.normal || 0,
      State.meta.highestZones.risk || 0,
      State.meta.highestZones.chaos || 0
    );
  },
  
  // Update enemy patrol behavior
  updateEnemyPatrols(dt) {
    for (const enemy of this.activeEnemies) {
      if (!enemy.patrol || enemy.dead) continue;
      
      switch (enemy.patrol) {
        case 'circle':
          enemy.patrolAngle += dt * 0.5;
          enemy.x = enemy.patrolOrigin.x + Math.cos(enemy.patrolAngle) * enemy.patrolRadius;
          enemy.y = enemy.patrolOrigin.y + Math.sin(enemy.patrolAngle) * enemy.patrolRadius;
          break;
          
        case 'line':
          enemy.patrolAngle += dt * 0.8;
          enemy.x = enemy.patrolOrigin.x + Math.sin(enemy.patrolAngle) * enemy.patrolRadius;
          break;
          
        case 'wander':
          // Random direction changes
          if (Math.random() < dt * 0.5) {
            enemy.vx = (Math.random() - 0.5) * enemy.speed;
            enemy.vy = (Math.random() - 0.5) * enemy.speed;
          }
          // Stay near origin
          const dist = Math.hypot(
            enemy.x - enemy.patrolOrigin.x,
            enemy.y - enemy.patrolOrigin.y
          );
          if (dist > enemy.patrolRadius) {
            const angle = Math.atan2(
              enemy.patrolOrigin.y - enemy.y,
              enemy.patrolOrigin.x - enemy.x
            );
            enemy.vx = Math.cos(angle) * enemy.speed * 0.5;
            enemy.vy = Math.sin(angle) * enemy.speed * 0.5;
          }
          break;
      }
    }
  },
  
  // Draw zone elements (obstacles, decorations)
  draw(ctx, screenW, screenH) {
    if (!this.currentZone) return;
    const layerState = this.getLayerState();
    const profile = layerState?.profile || null;
    const layers = layerState?.layers || {};
    const terrainTheme = this.currentZone?._terrainTheme || null;
    const roomSurfaceId = terrainTheme?.roomFloorSurface || null;
    const roomSurfaceImg = TerrainThemes.getLoadedImage(roomSurfaceId);
    const roomSurfaceAlpha = terrainTheme?.roomFloorAlphaResolved || profile?.terrainRoomFloorAlpha || 0;
    const spaceCombatTheme = isSpaceCombatTheme(terrainTheme);

    ThemeScatter.drawWorldScatter(ctx, this.currentZone, terrainTheme, screenW, screenH);
    this._drawInstanceTileModules(ctx, screenW, screenH);

    // ── LAYER 0: Room Floors + Walls (v2164) ──
    const layout = this.currentZone.layout;
    if (layout) {
      // Lazy-load tiles
      if (!this._floorCache) {
        this._floorCache = {};
        for (const name of ['floor_metal', 'floor_intact', 'floor_cracked', 'wall_solid', 'wall_cracked']) {
          const img = new Image();
          img.src = `assets/tiles/${name}.png`;
          this._floorCache[name] = img;
        }
      }
      const tileReady = (name) => { const i = this._floorCache[name]; return i?.complete && i.naturalWidth > 0 ? i : null; };
      const TILE = 256;
      const DANGER_ROOMS = { boss: true, ambush: true, gauntlet: true };
      
      // ── Corridor/room floors are chunk-baked on demand for performance ──
      const floorTile = tileReady('floor_metal') || tileReady('floor_intact');
      const layoutCache = ensureLayoutRenderCache(this, this.currentZone, layout, terrainTheme, profile, floorTile, roomSurfaceImg, roomSurfaceId, roomSurfaceAlpha, spaceCombatTheme);
      if (layoutCache) {
        drawCachedLayoutFloors(this, ctx, layoutCache, screenW, screenH);
      }

      ThemeScatter.drawLayoutScatter(ctx, this.currentZone, terrainTheme, screenW, screenH);
    }
    
    // ── LAYER 0.5: Wall tile rendering (replaces asteroid circles) ──
    const wallSolid = this._floorCache ? ((() => { const i = this._floorCache.wall_solid; return i?.complete && i.naturalWidth > 0 ? i : null; })()) : null;
    const wallCracked = this._floorCache ? ((() => { const i = this._floorCache.wall_cracked; return i?.complete && i.naturalWidth > 0 ? i : null; })()) : null;
    
    const groundedShadowObstacles = getGroundedShadowObstacles(layers.wallObstacles || this.currentZone.obstacles || []);
    DepthStack.drawObstacleShadows(ctx, groundedShadowObstacles, profile, screenW, screenH);

    for (const obs of (layers.wallObstacles || this.currentZone.obstacles || [])) {
      if (obs.destroyed) continue;
      if (!Camera.isVisible(obs.x, obs.y, (obs.radius || 40) + 50, screenW, screenH)) continue;
      
      const r = obs.radius || 30;
      const tileSize = r * 2.2; // slightly larger than collision radius
      const isDestructible = obs.destructible !== false && obs.hp < 900;
      const shadowClass = obs.shadowClass || obs.type || 'generic';
      const wallTile = isDestructible ? (wallCracked || wallSolid) : wallSolid;
      
      if (wallTile && obs.type !== 'mine') {
        // Render as tile
        ctx.save();
        ctx.translate(obs.x, obs.y);
        ctx.rotate(obs.rotation || 0);
        ctx.globalAlpha = (isDestructible ? 0.75 : 0.85) * Math.min(1.1, profile?.wallAlpha || 1);
        drawSeamSafeImage(ctx, wallTile, -tileSize / 2, -tileSize / 2, tileSize, tileSize, 2);
        
        // HP indicator for destructible walls
        if (isDestructible && obs.hp < (obs.maxHP || obs.hp) * 0.5) {
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = '#ff4400';
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        continue; // skip canvas fallback below
      }
      
      // Mine rendering (keep as-is)
      if (obs.type === 'mine') {
        ctx.save();
        ctx.translate(obs.x, obs.y);
        ctx.fillStyle = '#ff2200';
        ctx.shadowColor = '#ff4400';
        ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffaa00';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('⚠', 0, 0);
        ctx.restore();
        continue;
      }
      
      // Canvas fallback (no tile loaded)
      ctx.save();
      ctx.translate(obs.x, obs.y);
      ctx.rotate(obs.rotation || 0);
      ctx.fillStyle = isDestructible ? '#3a3530' : '#2a2a30';
      ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = isDestructible ? '#554840' : '#444450';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
    
    // ── LAYER 1: Dust clouds + Nebula patches (behind everything) ──
    // Reduce alpha when tiled background is active (tiles already provide atmosphere)
    const hasTiles = !!this.currentZone._bg;
    const decoAlphaScale = (hasTiles ? 0.3 : 1.0) * (profile?.atmosphereAlpha || 1);
    
    for (const dec of (layers.atmosphereBack || this.currentZone.decorations || [])) {
      if (dec.type !== 'dust_cloud' && dec.type !== 'nebula_patch') continue;
      if (!Camera.isVisible(dec.x, dec.y, (dec.width || dec.radius || 400) + 200, screenW, screenH)) continue;
      
      ctx.save();
      ctx.translate(dec.x, dec.y);
      ctx.rotate(dec.rotation || 0);
      ctx.globalAlpha = (dec.alpha || 0.1) * decoAlphaScale;
      
      if (dec.type === 'dust_cloud') {
        // Large soft ellipse
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, dec.width * 0.5);
        grad.addColorStop(0, dec.color || '#221144');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, 0, dec.width * 0.5, dec.height * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (dec.type === 'nebula_patch') {
        // Circular nebula glow
        const r = dec.radius || 200;
        const grad = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
        grad.addColorStop(0, dec.color || '#4400aa');
        grad.addColorStop(0.6, dec.color ? dec.color + '44' : '#4400aa44');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    
    // ── LAYER 1.5: Environmental Structures (v2.16.3) ──
    const structures = layers.structuresScene || this.currentZone.structures;
    if (structures) {
      for (const struct of structures) {
        const b = struct.bounds;
        if (b && !Camera.isVisible(b.x, b.y, b.radius + 100, screenW, screenH)) continue;

        const mat = struct.material;
        const t = performance.now() * 0.001;
        
        // v2.16.3: Try tile PNG rendering first
        const tilePath = struct.tileReady?.tileset;
        let tileImg = null;
        if (tilePath) {
          if (!this._tileCache) this._tileCache = {};
          if (!this._tileCache[tilePath]) {
            const img = new Image();
            img.src = tilePath;
            this._tileCache[tilePath] = img;
          }
          const cached = this._tileCache[tilePath];
          if (cached.complete && cached.naturalWidth > 0) tileImg = cached;
        }

        for (const seg of struct.segments) {
          if (!Camera.isVisible(seg.x, seg.y, (seg.r || 60) + 50, screenW, screenH)) continue;
          ctx.save();
          ctx.translate(seg.x, seg.y);

          const r = seg.r || 40;
          
          // TILE PNG RENDERER: stamp tile image at segment position
          if (tileImg) {
            ctx.globalAlpha = 0.9;
            if (seg.a !== undefined) ctx.rotate(seg.a);
            const size = r * 2;
            ctx.drawImage(tileImg, -size/2, -size/2, size, size);
            // Collision indicator
            if (struct.collision !== false && seg.collision !== false) {
              ctx.strokeStyle = 'rgba(255,68,85,0.15)';
              ctx.lineWidth = 1;
              ctx.setLineDash([4, 4]);
              ctx.beginPath(); ctx.arc(0, 0, r + 2, 0, Math.PI * 2); ctx.stroke();
              ctx.setLineDash([]);
            }
            ctx.restore();
            continue; // skip canvas fallback
          }

          if (struct.variant === 'gas' || struct.variant === 'gravity') {
            // Soft volumetric cloud / energy (no hard edge)
            const grad = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 1.5);
            const pulse = 0.6 + Math.sin(t * 0.8 + seg.x * 0.01) * 0.15;
            grad.addColorStop(0, mat.accent + (struct.variant === 'gravity' ? '55' : '44'));
            grad.addColorStop(0.5, mat.secondary + '33');
            grad.addColorStop(1, 'transparent');
            ctx.globalAlpha = pulse;
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
            ctx.fill();
            // Shimmer core for rifts
            if (seg.wave) {
              ctx.globalAlpha = 0.3 + Math.sin(t * 2 + seg.y * 0.02) * 0.15;
              ctx.fillStyle = mat.glow || 'rgba(255,255,255,0.1)';
              ctx.beginPath();
              ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
              ctx.fill();
            }
          } else if (struct.variant === 'crystal') {
            // Faceted crystal shapes
            ctx.globalAlpha = 0.7;
            const grad = ctx.createLinearGradient(-r, -r, r, r);
            grad.addColorStop(0, mat.accent);
            grad.addColorStop(0.5, mat.secondary);
            grad.addColorStop(1, mat.primary);
            ctx.fillStyle = grad;
            // Diamond shape
            ctx.beginPath();
            ctx.moveTo(0, -r); ctx.lineTo(r * 0.6, 0);
            ctx.lineTo(0, r); ctx.lineTo(-r * 0.6, 0);
            ctx.closePath();
            ctx.fill();
            // Edge highlight
            ctx.strokeStyle = mat.accent + '88';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            // Inner glow
            if (mat.glow) {
              ctx.fillStyle = mat.glow;
              ctx.beginPath();
              ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
              ctx.fill();
            }
          } else if (struct.variant === 'alien') {
            // Monolith: tall rectangle with glyphs
            const w = seg.w || r, h = seg.h || r * 2;
            ctx.rotate(seg.angle || 0);
            const grad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
            grad.addColorStop(0, mat.accent);
            grad.addColorStop(0.5, mat.secondary);
            grad.addColorStop(1, mat.primary);
            ctx.fillStyle = grad;
            ctx.fillRect(-w / 2, -h / 2, w, h);
            // Edge bevel
            ctx.strokeStyle = mat.edge;
            ctx.lineWidth = 2;
            ctx.strokeRect(-w / 2, -h / 2, w, h);
            // Glyph lines
            if (seg.hasGlyph) {
              ctx.strokeStyle = seg.glyphColor || 'rgba(120,80,255,0.3)';
              ctx.lineWidth = 1;
              const pulse2 = 0.4 + Math.sin(t * 1.5) * 0.3;
              ctx.globalAlpha = pulse2;
              for (let g = 0; g < 4; g++) {
                const gy = -h * 0.3 + g * h * 0.2;
                ctx.beginPath();
                ctx.moveTo(-w * 0.3, gy); ctx.lineTo(w * 0.3, gy + h * 0.05);
                ctx.stroke();
              }
              // Center eye
              ctx.fillStyle = seg.glyphColor;
              ctx.beginPath();
              ctx.arc(0, 0, w * 0.15, 0, Math.PI * 2);
              ctx.fill();
            }
          } else {
            // Rock / Metal / Debris: solid circles with gradient + detail
            ctx.globalAlpha = 0.85;
            const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
            grad.addColorStop(0, mat.accent);
            grad.addColorStop(0.6, mat.secondary);
            grad.addColorStop(1, mat.primary);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
            // Edge
            ctx.strokeStyle = mat.edge;
            ctx.lineWidth = 2;
            ctx.stroke();
            // Detail: panel lines (metal), cracks (rock)
            if (struct.variant === 'metal') {
              ctx.strokeStyle = mat.accent + '44';
              ctx.lineWidth = 1;
              // Panel line
              ctx.beginPath();
              ctx.moveTo(-r * 0.6, -r * 0.2);
              ctx.lineTo(r * 0.6, -r * 0.2);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(-r * 0.4, r * 0.3);
              ctx.lineTo(r * 0.5, r * 0.3);
              ctx.stroke();
              // Window
              if (seg.hasWindow) {
                const wPulse = 0.3 + Math.sin(t * 2 + seg.x * 0.1) * 0.2;
                ctx.fillStyle = `rgba(255,180,80,${wPulse})`;
                ctx.beginPath();
                ctx.arc(r * 0.1, -r * 0.1, 3, 0, Math.PI * 2);
                ctx.fill();
              }
              // Damage scar
              if (seg.hasDamage) {
                ctx.strokeStyle = '#222';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(-r * 0.3, r * 0.1);
                ctx.lineTo(r * 0.1, -r * 0.2);
                ctx.lineTo(r * 0.4, r * 0.05);
                ctx.stroke();
              }
            } else {
              // Rock cracks
              ctx.strokeStyle = mat.edge + '88';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(-r * 0.5, -r * 0.3);
              ctx.lineTo(r * 0.2, r * 0.1);
              ctx.moveTo(r * 0.1, -r * 0.4);
              ctx.lineTo(-r * 0.1, r * 0.4);
              ctx.stroke();
            }
            // Ambient glow halo
            if (mat.glow) {
              ctx.globalAlpha = 0.15;
              const halo = ctx.createRadialGradient(0, 0, r * 0.8, 0, 0, r * 1.6);
              halo.addColorStop(0, mat.glow);
              halo.addColorStop(1, 'transparent');
              ctx.fillStyle = halo;
              ctx.beginPath();
              ctx.arc(0, 0, r * 1.6, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.restore();
        }
      }
    }

    // ── LAYER 2: Landmarks (large background structures) ──
    DepthStack.drawLandmarkHalos(ctx, (layers.landmarks || this.currentZone.decorations || []), profile, screenW, screenH);
    for (const dec of (layers.landmarks || this.currentZone.decorations || [])) {
      if (!Camera.isVisible(dec.x, dec.y, 200, screenW, screenH)) continue;
      
      ctx.save();
      ctx.translate(dec.x, dec.y);
      ctx.rotate(dec.rotation || 0);
      ctx.globalAlpha = Math.min(1, (dec.alpha || 0.6) * (profile?.landmarkAlpha || 1));
      const s = (dec.scale || 1) * 40;
      
      switch (dec.type) {
        case 'rock_formation': {
          // Cluster of overlapping dark rocks
          ctx.fillStyle = '#334455';
          for (let i = 0; i < 4; i++) {
            const ox = (i - 1.5) * s * 0.4;
            const oy = (i % 2 - 0.5) * s * 0.3;
            ctx.beginPath();
            ctx.arc(ox, oy, s * (0.3 + (i % 3) * 0.15), 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = '#223344';
          ctx.beginPath(); ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'ice_cluster': {
          ctx.fillStyle = 'rgba(100,180,255,0.3)';
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            const d = s * 0.3;
            ctx.beginPath();
            // Diamond shapes
            const cx = Math.cos(a) * d, cy = Math.sin(a) * d;
            const r = s * (0.15 + (i % 3) * 0.08);
            ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r * 0.6, cy);
            ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r * 0.6, cy);
            ctx.closePath(); ctx.fill();
          }
          break;
        }
        case 'dead_ship': {
          // Hull silhouette
          ctx.fillStyle = '#2a3040';
          ctx.beginPath();
          ctx.moveTo(-s, -s * 0.15);
          ctx.lineTo(-s * 0.3, -s * 0.4);
          ctx.lineTo(s * 0.8, -s * 0.15);
          ctx.lineTo(s, s * 0.1);
          ctx.lineTo(s * 0.3, s * 0.35);
          ctx.lineTo(-s * 0.7, s * 0.2);
          ctx.closePath(); ctx.fill();
          // Window lights (flickering)
          const flicker = dec.variant;
          if (flicker !== 2) {
            ctx.fillStyle = 'rgba(255,100,50,0.4)';
            ctx.beginPath(); ctx.arc(-s * 0.2, -s * 0.1, 3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(s * 0.1, 0, 2, 0, Math.PI * 2); ctx.fill();
          }
          // Broken antenna
          ctx.strokeStyle = '#445566';
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.3); ctx.lineTo(-s * 0.6, -s * 0.6); ctx.stroke();
          break;
        }
        case 'ancient_marker': {
          // Alien obelisk
          const grad = ctx.createLinearGradient(0, -s * 0.6, 0, s * 0.6);
          grad.addColorStop(0, '#556688');
          grad.addColorStop(1, '#223344');
          ctx.fillStyle = grad;
          ctx.fillRect(-s * 0.08, -s * 0.5, s * 0.16, s);
          // Glow rune
          ctx.fillStyle = 'rgba(0,200,255,0.3)';
          ctx.beginPath(); ctx.arc(0, -s * 0.15, s * 0.07, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(0, s * 0.15, s * 0.05, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'mining_rig': {
          // Industrial structure
          ctx.fillStyle = '#3a3a40';
          ctx.fillRect(-s * 0.3, -s * 0.5, s * 0.6, s);
          ctx.fillStyle = '#555560';
          ctx.fillRect(-s * 0.5, -s * 0.15, s, s * 0.3);
          // Arm
          ctx.strokeStyle = '#666670';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(s * 0.5, 0); ctx.lineTo(s * 0.9, -s * 0.3); ctx.stroke();
          // Warning light
          ctx.fillStyle = 'rgba(255,200,0,0.3)';
          ctx.beginPath(); ctx.arc(-s * 0.2, -s * 0.4, 4, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'station_hull': {
          // Large curved hull section
          ctx.strokeStyle = '#445566';
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(0, s * 0.8, s * 1.2, -Math.PI * 0.7, -Math.PI * 0.3);
          ctx.stroke();
          // Panel detail
          ctx.strokeStyle = '#334455';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, s * 0.8, s * 1.1, -Math.PI * 0.65, -Math.PI * 0.35);
          ctx.stroke();
          break;
        }
        case 'gas_cloud': {
          const colors = ['#442266', '#224466', '#226644', '#664422'];
          const col = colors[dec.variant] || colors[0];
          for (let i = 0; i < 3; i++) {
            const r = s * (0.6 - i * 0.15);
            const grad = ctx.createRadialGradient(i * 10, i * 5, 0, i * 10, i * 5, r);
            grad.addColorStop(0, col);
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(i * 10, i * 5, r, 0, Math.PI * 2); ctx.fill();
          }
          break;
        }
        case 'comet_trail': {
          ctx.strokeStyle = 'rgba(150,200,255,0.25)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-s, -s * 0.2);
          ctx.quadraticCurveTo(0, 0, s * 1.5, s * 0.1);
          ctx.stroke();
          // Head
          ctx.fillStyle = 'rgba(200,230,255,0.4)';
          ctx.beginPath(); ctx.arc(-s, -s * 0.2, 6, 0, Math.PI * 2); ctx.fill();
          break;
        }
        default: {
          // Fallback: simple shape
          ctx.fillStyle = '#334455';
          ctx.beginPath(); ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2); ctx.fill();
          break;
        }
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // ── LAYER 3: Small decorations (stars, rocks, sparkles) ──
    for (const dec of (layers.microDecorations || this.currentZone.decorations || [])) {
      if (!Camera.isVisible(dec.x, dec.y, 50, screenW, screenH)) continue;
      
      ctx.globalAlpha = Math.min(1, (dec.alpha || 0.5) * (profile?.microDecoAlpha || 1));
      const color = dec.color || '#888888';
      const sz = (dec.size || 2) * (dec.scale || 1);
      
      switch (dec.type) {
        case 'star_bright':
          ctx.fillStyle = color;
          ctx.beginPath(); ctx.arc(dec.x, dec.y, sz, 0, Math.PI * 2); ctx.fill();
          // Cross flare
          ctx.strokeStyle = color;
          ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.moveTo(dec.x - sz * 2, dec.y); ctx.lineTo(dec.x + sz * 2, dec.y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(dec.x, dec.y - sz * 2); ctx.lineTo(dec.x, dec.y + sz * 2); ctx.stroke();
          break;
        case 'star_colored':
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 4;
          ctx.beginPath(); ctx.arc(dec.x, dec.y, sz * 0.8, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
          break;
        case 'sparkle': {
          const t = Date.now() * 0.003 + dec.x;
          ctx.globalAlpha = (dec.alpha || 0.5) * (0.5 + Math.sin(t) * 0.5);
          ctx.fillStyle = color;
          ctx.beginPath(); ctx.arc(dec.x, dec.y, sz * 0.6, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'light_flicker': {
          const t2 = Date.now() * 0.005 + dec.y;
          ctx.globalAlpha = Math.sin(t2) > 0.3 ? (dec.alpha || 0.5) : 0;
          ctx.fillStyle = color;
          ctx.beginPath(); ctx.arc(dec.x, dec.y, sz, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'ice_shard':
          ctx.fillStyle = color;
          ctx.save();
          ctx.translate(dec.x, dec.y);
          ctx.rotate(dec.rotation || 0);
          ctx.beginPath();
          ctx.moveTo(0, -sz * 1.5); ctx.lineTo(sz * 0.5, 0);
          ctx.lineTo(0, sz); ctx.lineTo(-sz * 0.5, 0);
          ctx.closePath(); ctx.fill();
          ctx.restore();
          break;
        default:
          // Generic small dot
          ctx.fillStyle = color;
          ctx.beginPath(); ctx.arc(dec.x, dec.y, sz * 0.7, 0, Math.PI * 2); ctx.fill();
          break;
      }
    }
    ctx.globalAlpha = 1;
    
    // Draw biome hazards (behind obstacles, above background)
    this._drawHazards(ctx);
    
    // Draw obstacles (resource nodes + mines only — walls rendered in LAYER 0.5)
    for (const obs of (layers.wallObstacles || this.currentZone.obstacles || [])) {
      if (obs.destroyed) continue;
      if (!Camera.isVisible(obs.x, obs.y, 100, screenW, screenH)) continue;
      // v2164: Skip asteroid/debris — rendered as tiles in LAYER 0.5
      if (obs.type === 'asteroid' || obs.type === 'debris') continue;
      
      ctx.save();
      ctx.translate(obs.x, obs.y);
      ctx.rotate(obs.rotation || 0);
      
      // Draw based on type
      switch (obs.type) {
        case 'asteroid': {
          // Multi-layer asteroid with craters
          const r = obs.radius;
          // Base shape (irregular circle via noise)
          const grad = ctx.createRadialGradient(r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
          grad.addColorStop(0, '#8899aa');
          grad.addColorStop(0.6, '#556677');
          grad.addColorStop(1, '#334455');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
          // Crater marks
          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          ctx.beginPath(); ctx.arc(r * 0.3, r * 0.2, r * 0.25, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.3, r * 0.15, 0, Math.PI * 2); ctx.fill();
          // Edge highlight
          ctx.strokeStyle = 'rgba(150,170,190,0.3)';
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(0, 0, r, -0.5, 1.2); ctx.stroke();
          break;
        }
        case 'debris': {
          // Tumbling metal shard
          const r = obs.radius;
          ctx.fillStyle = '#556677';
          ctx.beginPath();
          ctx.moveTo(-r, -r * 0.3);
          ctx.lineTo(-r * 0.3, -r * 0.6);
          ctx.lineTo(r * 0.8, -r * 0.2);
          ctx.lineTo(r, r * 0.5);
          ctx.lineTo(-r * 0.5, r * 0.4);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#778899';
          ctx.lineWidth = 1;
          ctx.stroke();
          break;
        }
        case 'mine': {
          // Pulsing danger mine
          const pulse = 0.8 + Math.sin(Date.now() * 0.005) * 0.2;
          const r = obs.radius;
          ctx.fillStyle = '#cc2222';
          ctx.shadowColor = '#ff4444';
          ctx.shadowBlur = 12 * pulse;
          ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
          // Danger symbol - inner ring
          ctx.strokeStyle = '#ffcc00';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2); ctx.stroke();
          // Core
          ctx.fillStyle = '#ffdd00';
          ctx.beginPath(); ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
          break;
        }
        case 'pillar': {
          // Ancient pillar / space station ruin
          const r = obs.radius;
          const grad = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
          grad.addColorStop(0, '#99aabb');
          grad.addColorStop(1, '#556677');
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
          // Ring detail
          ctx.strokeStyle = '#aabbcc';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2); ctx.stroke();
          ctx.strokeStyle = 'rgba(0,200,255,0.15)';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2); ctx.stroke();
          break;
        }
        case 'bulkhead': {
          const r = obs.radius || 30;
          const w = r * 1.8;
          const h = r * 0.9;
          ctx.fillStyle = '#495364';
          ctx.fillRect(-w / 2, -h / 2, w, h);
          ctx.strokeStyle = '#93a6bf';
          ctx.lineWidth = 2;
          ctx.strokeRect(-w / 2, -h / 2, w, h);
          ctx.strokeStyle = 'rgba(255,180,80,0.35)';
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(-w * 0.28, -h * 0.2); ctx.lineTo(w * 0.28, -h * 0.2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-w * 0.2, h * 0.18); ctx.lineTo(w * 0.2, h * 0.18); ctx.stroke();
          break;
        }
        case 'cargo_stack': {
          const r = obs.radius || 24;
          const w = r * 1.6;
          const h = r * 1.1;
          ctx.fillStyle = '#4d5966';
          ctx.fillRect(-w / 2, -h / 2, w, h);
          ctx.strokeStyle = '#9eb2c8';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(-w / 2, -h / 2, w, h);
          ctx.strokeStyle = '#ffcc66';
          ctx.beginPath(); ctx.moveTo(-w * 0.35, -h * 0.22); ctx.lineTo(w * 0.35, -h * 0.22); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-w * 0.18, h * 0.16); ctx.lineTo(w * 0.18, h * 0.16); ctx.stroke();
          break;
        }
        case 'console_bank': {
          const r = obs.radius || 20;
          const w = r * 1.5;
          const h = r * 0.8;
          ctx.fillStyle = '#253244';
          ctx.fillRect(-w / 2, -h / 2, w, h);
          ctx.strokeStyle = '#5d7388';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(-w / 2, -h / 2, w, h);
          ctx.fillStyle = 'rgba(0,220,255,0.45)';
          ctx.fillRect(-w * 0.28, -h * 0.18, w * 0.56, h * 0.36);
          break;
        }
        case 'gate_pylon': {
          const r = obs.radius || 26;
          ctx.fillStyle = '#384352';
          ctx.fillRect(-r * 0.45, -r * 1.2, r * 0.9, r * 2.4);
          ctx.strokeStyle = '#a0b5cd';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(-r * 0.45, -r * 1.2, r * 0.9, r * 2.4);
          ctx.fillStyle = 'rgba(255,70,70,0.28)';
          ctx.fillRect(-r * 0.18, -r * 0.7, r * 0.36, r * 1.4);
          break;
        }
        // ── RESOURCE NODES ──
        case 'ore_rich': {
          const r = obs.radius;
          const glow = obs.glow || '#ffaa00';
          // Glowing asteroid with veins
          const grad = ctx.createRadialGradient(r * 0.2, -r * 0.2, r * 0.1, 0, 0, r);
          grad.addColorStop(0, '#aa8844');
          grad.addColorStop(0.5, '#665533');
          grad.addColorStop(1, '#443322');
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
          // Gold veins
          ctx.strokeStyle = glow;
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.6 + Math.sin(Date.now() * 0.003) * 0.3;
          ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.3); ctx.lineTo(r * 0.2, r * 0.4); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(r * 0.1, -r * 0.6); ctx.lineTo(r * 0.5, r * 0.1); ctx.stroke();
          ctx.globalAlpha = 1;
          // Outer glow
          ctx.shadowColor = glow;
          ctx.shadowBlur = 15 + Math.sin(Date.now() * 0.004) * 5;
          ctx.strokeStyle = glow;
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(0, 0, r + 3, 0, Math.PI * 2); ctx.stroke();
          ctx.shadowBlur = 0;
          break;
        }
        case 'crystal_node': {
          const r = obs.radius;
          const glow = obs.glow || '#00aaff';
          // Crystal shape (hexagonal)
          ctx.fillStyle = glow;
          ctx.globalAlpha = 0.4 + Math.sin(Date.now() * 0.004) * 0.2;
          ctx.beginPath();
          for (let v = 0; v < 6; v++) {
            const a = (v / 6) * Math.PI * 2 - Math.PI / 6;
            const px = Math.cos(a) * r;
            const py = Math.sin(a) * r;
            v === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.closePath(); ctx.fill();
          ctx.globalAlpha = 1;
          // Inner crystal
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = 0.3;
          ctx.beginPath();
          for (let v = 0; v < 6; v++) {
            const a = (v / 6) * Math.PI * 2;
            const px = Math.cos(a) * r * 0.5;
            const py = Math.sin(a) * r * 0.5;
            v === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.closePath(); ctx.fill();
          ctx.globalAlpha = 1;
          // Glow
          ctx.shadowColor = glow;
          ctx.shadowBlur = 20 + Math.sin(Date.now() * 0.005) * 8;
          ctx.strokeStyle = glow;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(0, 0, r + 5, 0, Math.PI * 2); ctx.stroke();
          ctx.shadowBlur = 0;
          break;
        }
        case 'void_crystal': {
          const r = obs.radius;
          const glow = obs.glow || '#aa55ff';
          const t = Date.now() * 0.002;
          // Dark crystal with purple glow
          ctx.fillStyle = '#1a0033';
          ctx.beginPath();
          for (let v = 0; v < 5; v++) {
            const a = (v / 5) * Math.PI * 2 + t * 0.3;
            const px = Math.cos(a) * r * (0.8 + Math.sin(t + v) * 0.2);
            const py = Math.sin(a) * r * (0.8 + Math.cos(t + v) * 0.2);
            v === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.closePath(); ctx.fill();
          // Pulsing void glow
          ctx.shadowColor = glow;
          ctx.shadowBlur = 25 + Math.sin(t * 2) * 10;
          ctx.strokeStyle = glow;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(0, 0, r + 4, 0, Math.PI * 2); ctx.stroke();
          // Inner void
          ctx.fillStyle = glow;
          ctx.globalAlpha = 0.3 + Math.sin(t * 3) * 0.15;
          ctx.beginPath(); ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          ctx.shadowBlur = 0;
          break;
        }
        case 'salvage_wreck': {
          const r = obs.radius;
          const glow = obs.glow || '#88ff44';
          // Ship hull fragment
          ctx.fillStyle = '#445566';
          ctx.beginPath();
          ctx.moveTo(-r * 0.8, -r * 0.4);
          ctx.lineTo(r * 0.9, -r * 0.2);
          ctx.lineTo(r * 0.7, r * 0.5);
          ctx.lineTo(-r * 0.3, r * 0.6);
          ctx.lineTo(-r, r * 0.1);
          ctx.closePath(); ctx.fill();
          // Panel lines
          ctx.strokeStyle = '#667788';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.3); ctx.lineTo(-r * 0.5, r * 0.4); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(r * 0.2, -r * 0.2); ctx.lineTo(r * 0.2, r * 0.5); ctx.stroke();
          // Salvage indicator glow
          ctx.shadowColor = glow;
          ctx.shadowBlur = 12 + Math.sin(Date.now() * 0.003) * 4;
          ctx.fillStyle = glow;
          ctx.globalAlpha = 0.4;
          ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          ctx.shadowBlur = 0;
          break;
        }
        case 'poison_area': {
          // Toxic green zone (no collision, just visual)
          const r = obs.radius;
          const t = Date.now() * 0.001;
          const pulse = 0.15 + Math.sin(t * 1.5) * 0.05;
          ctx.fillStyle = `rgba(40,255,0,${pulse})`;
          ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
          // Toxic border
          ctx.strokeStyle = `rgba(80,255,20,${pulse + 0.1})`;
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
          // Inner toxic bubbles
          for (let i = 0; i < 3; i++) {
            const bx = Math.sin(t * 2 + i * 2.1) * r * 0.4;
            const by = Math.cos(t * 1.7 + i * 1.8) * r * 0.4;
            ctx.fillStyle = `rgba(100,255,50,${0.2 + Math.sin(t * 3 + i) * 0.1})`;
            ctx.beginPath(); ctx.arc(bx, by, 8 + Math.sin(t * 4 + i) * 3, 0, Math.PI * 2); ctx.fill();
          }
          // Skull icon center
          ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.sin(t * 2) * 0.1})`;
          ctx.font = '16px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('☠', 0, 0);
          break;
        }
        case 'generator': {
          // Lockdown objective: pulsing red generator
          const r = obs.radius || 30;
          const t = Date.now() * 0.001;
          const pulse = 0.7 + Math.sin(t * 4) * 0.3;
          // Base structure
          ctx.fillStyle = '#442222';
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            const mx = i === 0 ? 'moveTo' : 'lineTo';
            ctx[mx](Math.cos(a) * r, Math.sin(a) * r);
          }
          ctx.closePath();
          ctx.fill();
          // Red glow core
          ctx.shadowColor = '#ff4444';
          ctx.shadowBlur = 20 * pulse;
          ctx.fillStyle = `rgba(255,60,60,${0.5 + pulse * 0.3})`;
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          // Label
          ctx.fillStyle = '#ff6666';
          ctx.font = 'bold 10px Orbitron';
          ctx.textAlign = 'center';
          ctx.fillText('GEN', 0, r + 16);
          break;
        }
      }
      
      ctx.restore();
    }
    
    // Draw POI indicators (above obstacles, below exit/portals)
    this._drawPOIs(ctx, screenW, screenH);
    
    // Draw exit marker (objective-aware)
    if (this.currentZone.exit) {
      const exit = this.currentZone.exit;
      const t = Date.now() * 0.001;
      const pulse = 0.7 + Math.sin(t * 3) * 0.3;
      const obj = State.run.objective;
      const locked = obj && obj.exitLocked && !obj.complete;
      const branches = this.currentZone.branchExits;
      
      if (branches && !locked) {
        // ── BRANCH EXITS: draw route choice portals ──
        for (const b of branches) {
          ctx.save();
          // Outer ring
          ctx.strokeStyle = b.color + '66';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.radius + 5 + Math.sin(t * 2) * 3, 0, Math.PI * 2);
          ctx.stroke();
          // Portal glow
          const grad = ctx.createRadialGradient(b.x, b.y, 5, b.x, b.y, b.radius);
          grad.addColorStop(0, b.color + 'cc');
          grad.addColorStop(0.6, b.color + '44');
          grad.addColorStop(1, b.color + '00');
          ctx.fillStyle = grad;
          ctx.shadowColor = b.color;
          ctx.shadowBlur = 20 * pulse;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          // Icon
          ctx.font = '16px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#fff';
          ctx.fillText(b.icon, b.x, b.y + 2);
          // Label
          ctx.font = 'bold 9px Orbitron';
          ctx.fillStyle = b.color;
          ctx.fillText(b.label, b.x, b.y - b.radius - 8);
          // Desc
          ctx.font = '8px sans-serif';
          ctx.fillStyle = '#aaa';
          ctx.fillText(b.desc, b.x, b.y + b.radius + 14);
          ctx.restore();
        }
      } else {
        // ── SINGLE EXIT (locked or normal) ──
        const exitColor = locked ? '#ff4444' : '#00ff88';
        const exitLabel = locked ? '🔒 LOCKED' : 'EXIT';
        // Outer glow ring
        ctx.strokeStyle = locked ? 'rgba(255,60,60,0.3)' : 'rgba(0,255,136,0.3)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(exit.x, exit.y, 38 + Math.sin(t * 2) * 4, 0, Math.PI * 2);
        ctx.stroke();
        // Main circle
        const exitGrad = ctx.createRadialGradient(exit.x, exit.y, 5, exit.x, exit.y, 30);
        if (locked) {
          exitGrad.addColorStop(0, 'rgba(255,80,80,0.6)');
          exitGrad.addColorStop(0.7, 'rgba(180,40,40,0.3)');
          exitGrad.addColorStop(1, 'rgba(100,20,20,0)');
        } else {
          exitGrad.addColorStop(0, 'rgba(0,255,180,0.8)');
          exitGrad.addColorStop(0.7, 'rgba(0,200,100,0.4)');
          exitGrad.addColorStop(1, 'rgba(0,100,50,0)');
        }
        ctx.fillStyle = exitGrad;
        ctx.shadowColor = exitColor;
        ctx.shadowBlur = 25 * pulse;
        ctx.beginPath();
        ctx.arc(exit.x, exit.y, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        // Label
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText(exitLabel, exit.x, exit.y + 4);
      }
    }
    
    DepthStack.drawForegroundVeil(ctx, screenW, screenH, this.currentZone);

    // Draw portals
    for (const portal of this.currentZone.portals) {
      const t = Date.now() * 0.001;
      const pulse = Math.sin(t * 2.5) * 0.3 + 0.7;
      const isHub = portal.type === 'hub' || portal.destination === 'hub';
      const isVictory = portal.type === 'victory';
      const baseR = isHub ? 22 : 36;
      const r = baseR * (0.9 + pulse * 0.1);

      const color = isVictory ? '#ffdd00' : (isHub ? '#4488cc' : '#8800ff');
      const colorDim = isVictory ? 'rgba(255,200,0,0)' : (isHub ? 'rgba(60,120,200,0)' : 'rgba(100,0,200,0)');

      // Swirl rings (rotating)
      ctx.save();
      ctx.translate(portal.x, portal.y);
      for (let ring = 0; ring < 3; ring++) {
        const ringR = r + ring * 6;
        const ringAlpha = 0.15 - ring * 0.04;
        ctx.globalAlpha = ringAlpha * pulse;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, ringR, t * (1 + ring * 0.5), t * (1 + ring * 0.5) + Math.PI * 1.3);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Core gradient
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, color);
      grad.addColorStop(1, colorDim);
      ctx.fillStyle = grad;
      ctx.shadowColor = color;
      ctx.shadowBlur = 30 * pulse;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold ' + (isHub ? '9' : '11') + 'px Orbitron';
      ctx.textAlign = 'center';
      const label = isHub ? 'HUB' : ('ZONE ' + (this.zoneIndex + 2));
      ctx.fillText(label, 0, 4);
      ctx.restore();
    }
  },
  
  // Draw parallax background layers
  drawParallaxBackground(ctx, screenW, screenH) {
    if (this.currentZone?.instanceInfo?.directTileBound) {
      const grad = ctx.createLinearGradient(0, 0, screenW, screenH);
      grad.addColorStop(0, '#06080d');
      grad.addColorStop(0.45, '#0b0f16');
      grad.addColorStop(1, '#05070a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, screenW, screenH);
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#8aa0b8';
      const stride = 96;
      for (let x = -stride; x < screenW + stride; x += stride) ctx.fillRect(x, 0, 2, screenH);
      ctx.globalAlpha = 1;
      return;
    }

    // Try tiled terrain background first (tile_void, tile_toxicity, etc.)
    if (this.currentZone?._bg) {
      const drawn = Background.draw(ctx, screenW, screenH, this.currentZone);
      if (drawn) return; // Tiled BG handled everything
    }
    
    // Fallback: procedural starfield
    if (!this.currentZone?.parallax) return;
    
    const parallax = this.currentZone.parallax;
    const camX = Camera.getX();
    const camY = Camera.getY();
    
    // Layer 0: Background color
    ctx.fillStyle = parallax.background.color;
    ctx.fillRect(0, 0, screenW, screenH);
    
    // Layer 0: Deep stars
    const bgOffsetX = camX * parallax.background.scrollSpeed;
    const bgOffsetY = camY * parallax.background.scrollSpeed;
    
    ctx.fillStyle = '#ffffff';
    for (const star of parallax.background.stars) {
      const x = ((star.x - bgOffsetX) % screenW + screenW) % screenW;
      const y = ((star.y - bgOffsetY) % screenH + screenH) % screenH;
      
      let brightness = star.brightness;
      if (star.twinkle) {
        brightness *= 0.5 + Math.sin(Date.now() / 500 + star.x) * 0.5;
      }
      
      ctx.globalAlpha = brightness;
      ctx.beginPath();
      ctx.arc(x, y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Layer 1: Mid stars
    const midOffsetX = camX * parallax.midground.scrollSpeed;
    const midOffsetY = camY * parallax.midground.scrollSpeed;
    
    for (const star of parallax.midground.stars) {
      const x = ((star.x - midOffsetX) % screenW + screenW) % screenW;
      const y = ((star.y - midOffsetY) % screenH + screenH) % screenH;
      
      ctx.globalAlpha = star.brightness;
      ctx.beginPath();
      ctx.arc(x, y, star.size * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.globalAlpha = 1;
  },

  drawParallaxForeground(ctx, screenW, screenH) {
    if (this.currentZone?.instanceInfo?.directTileBound) return;
    // Skip foreground overlays when tiled background is active
    // (wisps + tiles = visual mud; tiles already provide atmosphere)
    if (this.currentZone?._bg) return;
    
    if (!this.currentZone?.parallax) return;
    
    const parallax = this.currentZone.parallax;
    const layerState = this.getLayerState();
    const profile = layerState?.profile || null;
    const camX = Camera.getX();
    const camY = Camera.getY();
    
        // Layer 2: Nebula wisps
    if (parallax.foreground.objects) {
      const fgOffsetX = camX * parallax.foreground.scrollSpeed;
      const fgOffsetY = camY * parallax.foreground.scrollSpeed;
      
      for (const wisp of parallax.foreground.objects) {
        const x = wisp.x - fgOffsetX;
        const y = wisp.y - fgOffsetY;
        
        ctx.globalAlpha = Math.min(1, (wisp.alpha || 0) * (profile?.foregroundWispAlpha || 1));
        ctx.fillStyle = wisp.color;
        ctx.beginPath();
        ctx.ellipse(x, y, wisp.width / 2, wisp.height / 2, wisp.rotation, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.globalAlpha = 1;
    }
  },

  drawParallax(ctx, screenW, screenH) {
    // Back-compat: some callers still use drawParallax()
    this.drawParallaxBackground(ctx, screenW, screenH);
    this.drawParallaxForeground(ctx, screenW, screenH);
  },

  // ════════════════════════════════════════════════════════════
  // W4A ROOM TRACKING + DISCOVERY + EVENTS + COMBAT GATING
  // ════════════════════════════════════════════════════════════

  // Runtime room state (reset per zone)
  _roomState: null,

  initRoomState() {
    this._roomState = {
      currentRoomIdx: -1,
      previousRoomIdx: -1,
      discoveredRooms: new Set(),
      clearedRooms: new Set(),
      lockedRooms: new Set(),    // rooms where exit is blocked until cleared
      roomEnterTime: 0,
      announceQueue: [],
      combatGateActive: false
    };
  },

  _trackPlayerRoom(player) {
    const layout = this.currentZone?.layout;
    if (!layout?.rooms) return;
    if (!this._roomState) this.initRoomState();
    const rs = this._roomState;
    const px = player.x, py = player.y;

    // Find which room the player is in (ellipse check)
    let foundIdx = -1;
    for (let i = 0; i < layout.rooms.length; i++) {
      const r = layout.rooms[i];
      const nx = (px - r.cx) / (r.rx + 30);
      const ny = (py - r.cy) / (r.ry + 30);
      if (nx * nx + ny * ny <= 1) {
        foundIdx = i;
        break;
      }
    }

    // Room change detection
    if (foundIdx !== rs.currentRoomIdx) {
      rs.previousRoomIdx = rs.currentRoomIdx;
      rs.currentRoomIdx = foundIdx;

      if (foundIdx >= 0) {
        const room = layout.rooms[foundIdx];
        const isNew = !rs.discoveredRooms.has(foundIdx);
        rs.discoveredRooms.add(foundIdx);

        // Discover adjacent rooms on minimap (1-hop neighbors)
        for (const cor of layout.corridors) {
          if (cor.from === foundIdx) rs.discoveredRooms.add(cor.to);
          if (cor.to === foundIdx) rs.discoveredRooms.add(cor.from);
        }

        rs.roomEnterTime = performance.now();

        // ── ROOM ENTER EVENT ──
        if (isNew) {
          this._onRoomFirstEnter(foundIdx, room);
        }
        this._onRoomEnter(foundIdx, room);
      }
    }

    // ── COMBAT GATE CHECK ──
    if (rs.combatGateActive && foundIdx >= 0) {
      this._checkCombatGateClear(foundIdx, layout.rooms[foundIdx]);
    }
  },

  _onRoomFirstEnter(idx, room) {
    const rs = this._roomState;
    const purpose = room.primaryPurpose || room.type;

    // Announce room type
    const labels = {
      combat: '⚔️ COMBAT ZONE',
      ambush: '⚠️ AMBUSH!',
      boss: '💀 BOSS ARENA',
      arena: '🏟️ ARENA — CLEAR ALL',
      treasure: '💎 SALVAGE CACHE',
      hidden: '🔍 SECRET FOUND',
      gauntlet: '🔥 GAUNTLET',
      junction: '🔀 JUNCTION',
      spawn: null,
      traversal: null
    };
    const label = labels[purpose] || labels[room.type];
    if (label) {
      rs.announceQueue.push({ text: label, time: performance.now(), duration: 2000, color: this._roomAnnounceColor(room) });
    }

    // Combat gating: lock room if it has encounter capacity
    const cap = room.encounterCapacity ?? room.encounterCap ?? 0;
    const gateTypes = { combat: true, ambush: true, arena: true, boss: true, trap: true };
    if (cap > 2 && (gateTypes[purpose] || gateTypes[room.type])) {
      rs.lockedRooms.add(idx);
      rs.combatGateActive = true;
    }
  },

  _onRoomEnter(idx, room) {
    // PostFX room ambience (optional, non-crashing)
    try {
      const PostFX = State.modules?.PostFX;
      if (PostFX?.setAmbient) {
        const ambients = {
          combat: { r: 0.02, g: 0, b: 0, a: 0.08 },
          ambush: { r: 0.04, g: 0.01, b: 0, a: 0.12 },
          boss: { r: 0.05, g: 0, b: 0, a: 0.15 },
          arena: { r: 0.03, g: 0, b: 0.01, a: 0.10 },
          treasure: { r: 0, g: 0.02, b: 0, a: 0.06 },
          hidden: { r: 0.01, g: 0, b: 0.03, a: 0.08 },
          spawn: { r: 0, g: 0.01, b: 0.02, a: 0.04 },
          junction: null, gauntlet: null
        };
        const amb = ambients[room.primaryPurpose] || ambients[room.type];
        if (amb) PostFX.setAmbient(amb.r, amb.g, amb.b, amb.a);
      }
    } catch (e) { /* safe */ }
  },

  _checkCombatGateClear(idx, room) {
    const rs = this._roomState;
    if (!rs.lockedRooms.has(idx)) return;

    // Count alive enemies in this room
    let alive = 0;
    const zone = this.currentZone;
    for (const spawn of zone.enemySpawns) {
      if (spawn.killed) continue;
      const nx = (spawn.x - room.cx) / (room.rx + 50);
      const ny = (spawn.y - room.cy) / (room.ry + 50);
      if (nx * nx + ny * ny <= 1) alive++;
    }
    for (const spawn of zone.eliteSpawns) {
      if (spawn.killed) continue;
      const nx = (spawn.x - room.cx) / (room.rx + 50);
      const ny = (spawn.y - room.cy) / (room.ry + 50);
      if (nx * nx + ny * ny <= 1) alive++;
    }

    if (alive === 0) {
      rs.lockedRooms.delete(idx);
      rs.clearedRooms.add(idx);
      rs.combatGateActive = rs.lockedRooms.size > 0;

      // Clear reward announce
      rs.announceQueue.push({ text: '✅ ROOM CLEARED', time: performance.now(), duration: 1800, color: '#00ff88' });
    }
  },

  _roomAnnounceColor(room) {
    const p = room.primaryPurpose || room.type;
    const colors = {
      combat: '#ff6644', ambush: '#ff4400', boss: '#ff2255', arena: '#ff3366',
      treasure: '#ffcc00', hidden: '#aa66ff', gauntlet: '#ff8800', spawn: '#00ff88',
      junction: '#00ccff', trap: '#ff4400'
    };
    return colors[p] || '#ffffff';
  },

  // Get current room state for minimap / UI
  getRoomState() {
    return this._roomState;
  },

  getCurrentRoom() {
    const rs = this._roomState;
    const layout = this.currentZone?.layout;
    if (!rs || rs.currentRoomIdx < 0 || !layout) return null;
    return layout.rooms[rs.currentRoomIdx];
  },

  isRoomDiscovered(idx) {
    return this._roomState?.discoveredRooms?.has(idx) ?? false;
  },

  isRoomCleared(idx) {
    return this._roomState?.clearedRooms?.has(idx) ?? false;
  },

  isRoomLocked(idx) {
    return this._roomState?.lockedRooms?.has(idx) ?? false;
  }
};

export default World;