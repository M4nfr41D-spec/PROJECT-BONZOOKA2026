// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// ThemeScatter.js - Theme-specific transition and scatter visuals
// ============================================================
// Purpose:
// - add scene identity and ground storytelling without touching gameplay logic
// - keep terrain transitions / micro detail separate from collision/nav systems
// - use deterministic seeded visuals so zones stay stable per seed

import { Camera } from './Camera.js';
import { SeededRandom } from './SeededRandom.js';
import { TerrainThemes } from './TerrainThemes.js';

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function patternFill(ctx, surfaceId, img, alpha, x, y, w, h, scale = 0.28, offsetX = 0, offsetY = 0) {
  if (!img || alpha <= 0) return;
  const pattern = TerrainThemes.buildPattern(ctx, img, scale, offsetX, offsetY, surfaceId);
  if (!pattern) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = pattern;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function drawImageStamp(ctx, img, alpha, x, y, w, h) {
  if (!img || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}

function drawSurfaceArea(ctx, surfaceId, img, alpha, x, y, w, h, scale = 0.28, offsetX = 0, offsetY = 0) {
  const surface = TerrainThemes.getSurface(surfaceId);
  if (!surface || !img || alpha <= 0) return;
  if (surface.kind === 'transition' || surface.kind === 'macro') {
    drawImageStamp(ctx, img, alpha, x, y, w, h);
    return;
  }
  patternFill(ctx, surfaceId, img, alpha, x, y, w, h, scale, offsetX, offsetY);
}

function familyPalette(theme) {
  switch (theme?.scatterFamily) {
    case 'wetland_growth':
    case 'toxic_energy':
      return { primary: 'rgba(110,255,160,0.28)', secondary: 'rgba(35,120,70,0.16)', accent: 'rgba(140,255,200,0.18)' };
    case 'lava_rock':
    case 'ember_faults':
      return { primary: 'rgba(255,120,55,0.3)', secondary: 'rgba(110,20,12,0.18)', accent: 'rgba(255,180,90,0.18)' };
    case 'outpost_debris':
    case 'scrap_field':
    case 'urban_debris':
      return { primary: 'rgba(220,210,190,0.16)', secondary: 'rgba(60,65,78,0.18)', accent: 'rgba(255,180,120,0.12)' };
    case 'void_shards':
    case 'geode_pockets':
      return { primary: 'rgba(155,170,255,0.18)', secondary: 'rgba(60,45,110,0.16)', accent: 'rgba(210,220,255,0.08)' };
    case 'overgrown_industry':
      return { primary: 'rgba(120,230,160,0.18)', secondary: 'rgba(40,90,70,0.16)', accent: 'rgba(190,255,220,0.10)' };
    case 'neon_lanes':
      return { primary: 'rgba(90,200,255,0.18)', secondary: 'rgba(110,70,220,0.14)', accent: 'rgba(220,180,255,0.10)' };
    case 'hive_nest':
    case 'abyss_webs':
      return { primary: 'rgba(120,130,220,0.14)', secondary: 'rgba(40,30,70,0.18)', accent: 'rgba(180,190,255,0.08)' };
    case 'flesh_veins':
      return { primary: 'rgba(255,120,190,0.18)', secondary: 'rgba(90,20,40,0.16)', accent: 'rgba(255,200,230,0.10)' };
    default:
      return { primary: 'rgba(180,200,220,0.12)', secondary: 'rgba(50,60,80,0.12)', accent: 'rgba(255,255,255,0.08)' };
  }
}

function scatterPerfFactor(zone, theme) {
  const derelictSlice = zone?._sliceLock?.biome === 'derelict' || theme?.themeId === 'derelict_plateyard' || theme?.id === 'derelict_plateyard';
  return derelictSlice ? 0.55 : 1;
}

function ensureCache(zone, theme) {
  if (!zone || !theme) return null;
  const cacheKey = `${zone.seed || 0}|${theme.themeId}|${theme.depth || 1}`;
  if (zone._themeScatter?.cacheKey === cacheKey) return zone._themeScatter;

  const rng = new SeededRandom(((zone.seed || 0) ^ 0x73A77E2D ^ (theme.depth || 1)) >>> 0);
  const worldPatches = [];
  const perf = scatterPerfFactor(zone, theme);
  const patchCount = Math.max(4, Math.round((10 + Math.floor((theme.scatterDensity || 0.3) * 16)) * perf));
  for (let i = 0; i < patchCount; i++) {
    worldPatches.push({
      x: rng.range(80, Math.max(120, (zone.width || 2400) - 80)),
      y: rng.range(80, Math.max(120, (zone.height || 1800) - 80)),
      r: rng.range(40, 140),
      rot: rng.range(0, Math.PI * 2),
      alpha: rng.range(0.05, 0.16),
      stretch: rng.range(0.6, 1.6),
      type: rng.pick(['smear', 'cluster', 'stain'])
    });
  }

  const macroPatches = [];
  const macroDefs = Array.isArray(theme.macroOverlaysResolved) ? theme.macroOverlaysResolved : [];
  for (const macro of macroDefs) {
    if (rng.unit() >= macro.rarity) continue;
    const count = (rng.unit() < perf ? 1 : 0) + (rng.unit() < macro.rarity * 0.12 * perf ? 1 : 0);
    for (let i = 0; i < count; i++) {
      macroPatches.push({
        surface: macro.surface,
        x: rng.range(160, Math.max(200, (zone.width || 2400) - 160)),
        y: rng.range(160, Math.max(200, (zone.height || 1800) - 160)),
        rx: rng.range(220, 520),
        ry: rng.range(150, 360),
        rot: rng.range(0, Math.PI * 2),
        alpha: macro.alpha * rng.range(0.82, 1.08),
        scale: macro.scale * rng.range(0.94, 1.06)
      });
    }
  }

  zone._themeScatter = { cacheKey, worldPatches, macroPatches };
  return zone._themeScatter;
}

function drawTechDebris(ctx, rng, bounds, palette, alphaScale) {
  const count = Math.max(2, Math.round((5 + rng.int(0, 6)) * clamp(alphaScale * 5.5, 0.4, 1)));
  for (let i = 0; i < count; i++) {
    const x = rng.range(bounds.x, bounds.x + bounds.w);
    const y = rng.range(bounds.y, bounds.y + bounds.h);
    const w = rng.range(18, 70);
    const h = rng.range(4, 12);
    const rot = rng.range(-Math.PI, Math.PI);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = rng.range(0.08, 0.18) * alphaScale;
    ctx.fillStyle = rng.pick([palette.primary, palette.secondary]);
    ctx.fillRect(-w * 0.5, -h * 0.5, w, h);
    ctx.globalAlpha = rng.range(0.04, 0.1) * alphaScale;
    ctx.strokeStyle = palette.accent;
    ctx.strokeRect(-w * 0.5, -h * 0.5, w, h);
    ctx.restore();
  }
}

function drawChannels(ctx, rng, bounds, palette, alphaScale, hot = false) {
  const channels = Math.max(1, Math.round((2 + rng.int(0, 2)) * clamp(alphaScale * 6.0, 0.5, 1)));
  for (let i = 0; i < channels; i++) {
    const x0 = rng.range(bounds.x, bounds.x + bounds.w);
    const y0 = rng.range(bounds.y, bounds.y + bounds.h);
    const x1 = x0 + rng.range(-bounds.w * 0.3, bounds.w * 0.3);
    const y1 = y0 + rng.range(bounds.h * 0.15, bounds.h * 0.45);
    const x2 = x1 + rng.range(-bounds.w * 0.25, bounds.w * 0.25);
    const y2 = y1 + rng.range(-bounds.h * 0.1, bounds.h * 0.2);
    const x3 = x2 + rng.range(-bounds.w * 0.2, bounds.w * 0.2);
    const y3 = y2 + rng.range(bounds.h * 0.05, bounds.h * 0.18);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = (hot ? 0.16 : 0.12) * alphaScale;
    ctx.strokeStyle = palette.secondary;
    ctx.lineWidth = rng.range(12, 22);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(x1, y1, x2, y2, x3, y3);
    ctx.stroke();

    ctx.globalAlpha = (hot ? 0.28 : 0.2) * alphaScale;
    ctx.strokeStyle = palette.primary;
    ctx.lineWidth = rng.range(4, 9);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(x1, y1, x2, y2, x3, y3);
    ctx.stroke();

    if (hot) {
      ctx.globalAlpha = 0.14 * alphaScale;
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = rng.range(1.5, 3.5);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.bezierCurveTo(x1, y1, x2, y2, x3, y3);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawShardBursts(ctx, rng, bounds, palette, alphaScale) {
  const count = Math.max(3, Math.round((6 + rng.int(0, 8)) * clamp(alphaScale * 5.0, 0.45, 1)));
  for (let i = 0; i < count; i++) {
    const x = rng.range(bounds.x, bounds.x + bounds.w);
    const y = rng.range(bounds.y, bounds.y + bounds.h);
    const len = rng.range(14, 42);
    const rot = rng.range(0, Math.PI * 2);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = rng.range(0.08, 0.14) * alphaScale;
    ctx.fillStyle = palette.primary;
    ctx.beginPath();
    ctx.moveTo(-len * 0.45, 0);
    ctx.lineTo(0, -len * 0.15);
    ctx.lineTo(len * 0.5, 0);
    ctx.lineTo(0, len * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawSoftPatches(ctx, patches, palette, alphaScale, screenW, screenH) {
  for (const p of patches) {
    if (!Camera.isVisible(p.x, p.y, p.r + 60, screenW, screenH)) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    const grad = ctx.createRadialGradient(0, 0, p.r * 0.15, 0, 0, p.r);
    grad.addColorStop(0, palette.primary.replace(/0\.\d+\)/, `${clamp(p.alpha * alphaScale, 0.03, 0.2)})`));
    grad.addColorStop(0.65, palette.secondary.replace(/0\.\d+\)/, `${clamp(p.alpha * alphaScale * 0.6, 0.02, 0.16)})`));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.r * p.stretch, p.r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}


function drawMacroPatches(ctx, macroPatches, screenW, screenH) {
  if (!macroPatches?.length) return;
  for (const patch of macroPatches) {
    if (!Camera.isVisible(patch.x, patch.y, Math.max(patch.rx, patch.ry) + 120, screenW, screenH)) continue;
    const img = TerrainThemes.getLoadedImage(patch.surface);
    if (!img) continue;
    ctx.save();
    ctx.translate(patch.x, patch.y);
    ctx.rotate(patch.rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, patch.rx, patch.ry, 0, 0, Math.PI * 2);
    ctx.clip();
    drawSurfaceArea(ctx, patch.surface, img, patch.alpha, -patch.rx * 1.15, -patch.ry * 1.15, patch.rx * 2.3, patch.ry * 2.3, patch.scale, patch.x * -0.025, patch.y * -0.025);
    const fade = ctx.createRadialGradient(0, 0, Math.min(patch.rx, patch.ry) * 0.25, 0, 0, Math.max(patch.rx, patch.ry));
    fade.addColorStop(0, 'rgba(255,255,255,0)');
    fade.addColorStop(0.75, 'rgba(0,0,0,0.06)');
    fade.addColorStop(1, 'rgba(0,0,0,0.16)');
    ctx.fillStyle = fade;
    ctx.fillRect(-patch.rx * 1.6, -patch.ry * 1.6, patch.rx * 3.2, patch.ry * 3.2);
    ctx.restore();
  }
}

export const ThemeScatter = {
  drawWorldScatter(ctx, zone, theme, screenW, screenH) {
    if (!zone || !theme || (theme.worldScatterAlphaResolved || 0) <= 0) return;
    const cache = ensureCache(zone, theme);
    const palette = familyPalette(theme);
    const perf = scatterPerfFactor(zone, theme);
    ctx.save();
    ctx.globalCompositeOperation = theme.surfaceMode === 'land' ? 'multiply' : 'screen';
    drawMacroPatches(ctx, cache.macroPatches, screenW, screenH);
    drawSoftPatches(ctx, cache.worldPatches, palette, (theme.worldScatterAlphaResolved || 0.1) * perf, screenW, screenH);
    ctx.restore();
  },

  drawLayoutScatter(ctx, zone, theme, screenW, screenH) {
    const layout = zone?.layout;
    if (!zone || !theme || !layout) return;
    const palette = familyPalette(theme);
    const perf = scatterPerfFactor(zone, theme);
    const alphaScale = (theme.roomScatterAlphaResolved || 0.1) * perf;
    const transitionImg = TerrainThemes.getLoadedImage(theme.transitionSurface || null);

    for (let idx = 0; idx < layout.rooms.length; idx++) {
      const room = layout.rooms[idx];
      if (perf < 0.75 && (idx % 2 === 1)) continue;
      if (!Camera.isVisible(room.cx, room.cy, Math.max(room.rx, room.ry) + 90, screenW, screenH)) continue;
      const rng = new SeededRandom(((zone.seed || 0) ^ (idx * 0x45d9f3b)) >>> 0);
      const bounds = { x: room.cx - room.rx, y: room.cy - room.ry, w: room.rx * 2, h: room.ry * 2 };
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(room.cx, room.cy, room.rx + 12, room.ry + 12, 0, 0, Math.PI * 2);
      ctx.clip();

      if (transitionImg && (theme.transitionBandAlphaResolved || 0) > 0) {
        drawSurfaceArea(
          ctx,
          theme.transitionSurface,
          transitionImg,
          theme.transitionBandAlphaResolved * (0.55 + (idx % 3) * 0.08),
          bounds.x - 20,
          bounds.y - 20,
          bounds.w + 40,
          bounds.h + 40,
          0.24,
          bounds.x * -0.04,
          bounds.y * -0.04
        );
      }

      switch (theme.scatterFamily) {
        case 'outpost_debris':
        case 'scrap_field':
        case 'urban_debris':
        case 'overgrown_industry':
        case 'neon_lanes':
          drawTechDebris(ctx, rng, bounds, palette, alphaScale);
          break;
        case 'wetland_growth':
        case 'toxic_energy':
        case 'flesh_veins':
          drawChannels(ctx, rng, bounds, palette, alphaScale, false);
          break;
        case 'lava_rock':
        case 'ember_faults':
          drawChannels(ctx, rng, bounds, palette, alphaScale, true);
          break;
        case 'void_shards':
        case 'geode_pockets':
        case 'hive_nest':
        case 'abyss_webs':
          drawShardBursts(ctx, rng, bounds, palette, alphaScale);
          break;
        default:
          drawTechDebris(ctx, rng, bounds, palette, alphaScale * 0.7);
          break;
      }

      ctx.restore();
    }

    for (let idx = 0; idx < (layout.corridors || []).length; idx++) {
      const cor = layout.corridors[idx];
      if (perf < 0.75 && (idx % 2 === 1)) continue;
      const a = layout.rooms[cor.from];
      const b = layout.rooms[cor.to];
      if (!a || !b) continue;
      const mx = (a.cx + b.cx) * 0.5;
      const my = (a.cy + b.cy) * 0.5;
      const len = Math.hypot(b.cx - a.cx, b.cy - a.cy);
      if (!Camera.isVisible(mx, my, len * 0.55, screenW, screenH)) continue;
      const rng = new SeededRandom(((zone.seed || 0) ^ (idx * 0x27d4eb2d)) >>> 0);
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(Math.atan2(b.cy - a.cy, b.cx - a.cx));
      ctx.beginPath();
      ctx.ellipse(0, 0, len * 0.48, 72 + len * 0.02, 0, 0, Math.PI * 2);
      ctx.clip();

      if (transitionImg && (theme.transitionBandAlphaResolved || 0) > 0) {
        drawSurfaceArea(
          ctx,
          theme.transitionSurface,
          transitionImg,
          theme.transitionBandAlphaResolved * 0.46,
          -len * 0.52,
          -92,
          len * 1.04,
          184,
          0.22,
          mx * -0.03,
          my * -0.03
        );
      }

      if (theme.scatterFamily === 'wetland_growth' || theme.scatterFamily === 'toxic_energy' || theme.scatterFamily === 'flesh_veins') {
        drawChannels(ctx, rng, { x: -len * 0.48, y: -54, w: len * 0.96, h: 108 }, palette, alphaScale * 0.9, false);
      } else if (theme.scatterFamily === 'lava_rock' || theme.scatterFamily === 'ember_faults') {
        drawChannels(ctx, rng, { x: -len * 0.48, y: -50, w: len * 0.96, h: 100 }, palette, alphaScale, true);
      } else if (theme.scatterFamily === 'void_shards' || theme.scatterFamily === 'geode_pockets' || theme.scatterFamily === 'hive_nest' || theme.scatterFamily === 'abyss_webs') {
        drawShardBursts(ctx, rng, { x: -len * 0.42, y: -36, w: len * 0.84, h: 72 }, palette, alphaScale * 0.8);
      } else {
        drawTechDebris(ctx, rng, { x: -len * 0.42, y: -36, w: len * 0.84, h: 72 }, palette, alphaScale * 0.75);
      }

      ctx.restore();
    }
  }
};

export default ThemeScatter;
