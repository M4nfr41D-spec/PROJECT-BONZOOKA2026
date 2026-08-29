// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// Background.js - Procedural parallax starfield per biome
// ============================================================
// v2.12.2: Tiles removed (persistent white seam issue).
// Replaced with fast procedural starfield that varies per biome.
// 3 layers: deep stars, mid nebula clouds, close drifting particles.
// Each biome has unique color palette → zones feel visually distinct.

import { State } from '../State.js';
import { Camera } from './Camera.js';
import { SeededRandom } from './SeededRandom.js';
import { DepthStack } from './DepthStack.js';
import { TerrainThemes } from './TerrainThemes.js';

// ── BIOME COLOR PALETTES ──
const BIOME_PALETTES = {
  asteroid: {
    bg: '#050812', 
    stars: ['#ffffff','#aaccff','#ffddaa','#88bbff'],
    nebula: ['rgba(30,20,60,0.12)','rgba(15,25,50,0.08)'],
    particles: ['#446688','#335577','#557799'],
    name: 'Asteroid Belt'
  },
  nebula: {
    bg: '#0a0320',
    stars: ['#ffaaff','#ccbbff','#ffffff','#ffccdd'],
    nebula: ['rgba(80,20,80,0.15)','rgba(40,10,60,0.12)','rgba(100,30,70,0.08)'],
    particles: ['#884488','#aa55aa','#775599'],
    name: 'Nebula Depths'
  },
  void: {
    bg: '#020008',
    stars: ['#8866cc','#aa88ff','#ffffff','#6644aa'],
    nebula: ['rgba(20,0,40,0.20)','rgba(40,0,60,0.10)'],
    particles: ['#443366','#553388','#332255'],
    name: 'The Void'
  },
  derelict: {
    bg: '#080604',
    stars: ['#ffcc88','#ffaa66','#ffffff','#ddbb88'],
    nebula: ['rgba(50,30,10,0.15)','rgba(30,20,5,0.10)'],
    particles: ['#886644','#775533','#997755'],
    name: 'Derelict Fleet'
  },
  blackhole: {
    bg: '#010005',
    stars: ['#ff4466','#cc3355','#ffffff','#ff6688'],
    nebula: ['rgba(40,0,20,0.20)','rgba(60,0,30,0.12)','rgba(80,0,40,0.08)'],
    particles: ['#663344','#552233','#884455'],
    name: 'Event Horizon'
  }
};

function drawTintWash(ctx, screenW, screenH, tint, alpha = 1) {
  if (!tint || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, screenW, screenH);
  ctx.restore();
}

function tintToAlpha(tint, alpha) {
  const match = String(tint || '').match(/rgba?\(([^)]+)\)/i);
  if (!match) return tint;
  const parts = match[1].split(',').map(v => v.trim());
  const [r = '255', g = '255', b = '255'] = parts;
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawSurfaceLayer(ctx, screenW, screenH, camX, camY, surfaceId, alpha, extraScale = 1, offsetTime = 0) {
  if (!surfaceId || alpha <= 0) return false;
  const meta = TerrainThemes.getSurface(surfaceId);
  const img = TerrainThemes.getLoadedImage(surfaceId);
  if (!meta || !img) return false;

  const pattern = TerrainThemes.buildPattern(ctx, img, meta.scale * extraScale, 0, 0, surfaceId);
  if (!pattern) return false;

  const drift = meta.drift || 0;
  const driftX = Math.sin(offsetTime * (drift * 2.1 + 0.004)) * 60;
  const driftY = Math.cos(offsetTime * (drift * 1.7 + 0.003)) * 40;
  const px = -((camX * drift + driftX) % (meta.tile || 1024));
  const py = -((camY * drift + driftY) % (meta.tile || 1024));

  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.globalCompositeOperation = meta.blend || 'source-over';
  ctx.translate(px, py);
  ctx.fillStyle = pattern;
  ctx.fillRect(-meta.tile, -meta.tile, screenW + meta.tile * 3, screenH + meta.tile * 3);
  ctx.restore();
  return true;
}



function isSpaceLikeTheme(terrainTheme) {
  const mode = terrainTheme?.surfaceMode || 'space';
  return mode === 'space';
}

function getLandParticleProfile(terrainTheme) {
  const id = terrainTheme?.themeId || '';
  if (id === 'wasteland_outpost') {
    return { colors: ['rgba(220,190,130,0.18)','rgba(180,150,100,0.14)','rgba(245,220,170,0.12)'], minR: 1.6, maxR: 4.2, count: [28, 46], parallax: [0.12, 0.26] };
  }
  if (id === 'toxic_wetland') {
    return { colors: ['rgba(130,255,170,0.16)','rgba(90,220,130,0.13)','rgba(180,255,210,0.10)'], minR: 2.2, maxR: 5.5, count: [20, 36], parallax: [0.1, 0.2] };
  }
  if (id === 'lava_scar') {
    return { colors: ['rgba(255,140,90,0.16)','rgba(255,190,120,0.11)','rgba(90,40,20,0.10)'], minR: 1.8, maxR: 4.8, count: [22, 40], parallax: [0.1, 0.22] };
  }
  if (id === 'ruined_urban') {
    return { colors: ['rgba(210,220,235,0.12)','rgba(170,180,200,0.10)','rgba(120,130,150,0.08)'], minR: 1.2, maxR: 3.8, count: [18, 32], parallax: [0.1, 0.18] };
  }
  if (id === 'overgrown_facility') {
    return { colors: ['rgba(170,255,220,0.12)','rgba(120,220,180,0.10)','rgba(210,255,235,0.08)'], minR: 1.6, maxR: 4.0, count: [18, 32], parallax: [0.08, 0.18] };
  }
  return { colors: ['rgba(190,205,220,0.10)','rgba(130,145,160,0.08)'], minR: 1.4, maxR: 3.6, count: [16, 28], parallax: [0.1, 0.18] };
}

function drawReadabilityFog(ctx, screenW, screenH, zone, terrainTheme, profile) {
  const fog = terrainTheme?.fogProfileResolved || profile?.terrainFogProfile;
  if (!fog) return;
  const now = performance.now() * 0.001;
  const tint = fog.tint || 'rgba(180,200,220,0.18)';
  const camX = Camera.getX();
  const camY = Camera.getY();
  const banks = zone?._bg?.fogBanks || [];

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = Math.min(0.14, fog.broadAlpha || 0.04);
  const wash = ctx.createLinearGradient(0, 0, screenW, screenH);
  wash.addColorStop(0, tint);
  wash.addColorStop(0.35, 'rgba(255,255,255,0)');
  wash.addColorStop(0.7, 'rgba(255,255,255,0)');
  wash.addColorStop(1, tint);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, screenW, screenH);
  ctx.restore();

  for (const bank of banks) {
    const bx = bank.x - camX * bank.parallax + Math.sin(now * bank.driftX + bank.phase) * bank.swingX;
    const by = bank.y - camY * bank.parallax + Math.cos(now * bank.driftY + bank.phase * 0.7) * bank.swingY;
    if (bx < -bank.rx * 1.4 || by < -bank.ry * 1.4 || bx > screenW + bank.rx * 1.4 || by > screenH + bank.ry * 1.4) continue;
    const grad = ctx.createRadialGradient(bx, by, Math.min(bank.rx, bank.ry) * 0.12, bx, by, Math.max(bank.rx, bank.ry));
    grad.addColorStop(0, bank.innerTint);
    grad.addColorStop(0.72, 'rgba(255,255,255,0)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(bx, by, bank.rx, bank.ry, bank.rot + now * bank.rotDrift, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if ((fog.edgeLift || 0) > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = Math.min(0.05, fog.edgeLift * 0.7);
    const edge = ctx.createRadialGradient(screenW * 0.5, screenH * 0.5, screenW * 0.18, screenW * 0.5, screenH * 0.5, screenW * 0.72);
    edge.addColorStop(0, 'rgba(255,255,255,0)');
    edge.addColorStop(0.84, tint);
    edge.addColorStop(1, tint);
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, screenW, screenH);
    ctx.restore();
  }
}

export const Background = {
  // Cached star layers per zone (regenerated on zone change)
  _zoneId: null,
  _layers: null,

  prepareZone(zone, zoneSeed, act) {
    const biome = act?.biome || 'asteroid';
    const palette = BIOME_PALETTES[biome] || BIOME_PALETTES.asteroid;
    const rng = new SeededRandom((zoneSeed ^ 0xBACE) >>> 0);
    const depth = zone?.depth || State.run?.currentDepth || 1;
    const terrainTheme = TerrainThemes.resolveTheme(zone, act, depth);
    TerrainThemes.ensureAssets(terrainTheme);

    const spaceLike = isSpaceLikeTheme(terrainTheme);

    // ── LAYER 0: Deep stars (space-only) ──
    const deepStars = [];
    const deepCount = spaceLike ? (350 + rng.int(0, 200)) : 0;
    for (let i = 0; i < deepCount; i++) {
      deepStars.push({
        x: rng.range(-500, 3000),
        y: rng.range(-500, 3000),
        r: rng.range(0.3, 1.2),
        c: rng.pick(palette.stars),
        a: rng.range(0.3, 0.9),
        twinkleSpeed: rng.range(1.5, 4.0),
        twinklePhase: rng.range(0, Math.PI * 2)
      });
    }

    // ── LAYER 1: Mid nebula blobs (space-only) ──
    const nebula = [];
    const nebulaCount = spaceLike ? (6 + rng.int(0, 6)) : 0;
    for (let i = 0; i < nebulaCount; i++) {
      nebula.push({
        x: rng.range(-200, 2400),
        y: rng.range(-200, 2400),
        rx: rng.range(100, 350),
        ry: rng.range(80, 280),
        rot: rng.range(0, Math.PI * 2),
        c: rng.pick(palette.nebula),
        drift: rng.range(0.02, 0.06)
      });
    }

    // ── LAYER 2: Particles / dust / spores ──
    const particles = [];
    const landParticleProfile = getLandParticleProfile(terrainTheme);
    const [minCount, maxCount] = spaceLike ? [30, 60] : landParticleProfile.count;
    const partCount = minCount + rng.int(0, Math.max(0, maxCount - minCount));
    for (let i = 0; i < partCount; i++) {
      particles.push({
        x: rng.range(-300, 2800),
        y: rng.range(-300, 2800),
        r: spaceLike ? rng.range(1, 3) : rng.range(landParticleProfile.minR, landParticleProfile.maxR),
        c: spaceLike ? rng.pick(palette.particles) : rng.pick(landParticleProfile.colors),
        a: spaceLike ? rng.range(0.15, 0.4) : rng.range(0.06, 0.18),
        speed: spaceLike ? rng.range(0.3, 0.6) : rng.range(landParticleProfile.parallax[0], landParticleProfile.parallax[1]),
        blur: !spaceLike && rng.unit() < 0.35
      });
    }

    const fogBanks = [];
    const fogProfile = terrainTheme?.fogProfileResolved || terrainTheme?.fogProfile || null;
    const fogCount = fogProfile ? 4 + rng.int(0, 3) : 0;
    for (let i = 0; i < fogCount; i++) {
      const localAlpha = Math.min(0.14, (fogProfile?.localAlpha || 0.05) * rng.range(0.75, 1.2));
      fogBanks.push({
        x: rng.range(-240, 2640),
        y: rng.range(-220, 2460),
        rx: rng.range(180, 420),
        ry: rng.range(90, 220),
        parallax: rng.range(0.06, 0.18),
        rot: rng.range(-0.8, 0.8),
        rotDrift: rng.range(-0.01, 0.01),
        driftX: rng.range(0.012, 0.04),
        driftY: rng.range(0.01, 0.032),
        swingX: rng.range(18, 70),
        swingY: rng.range(12, 46),
        phase: rng.range(0, Math.PI * 2),
        innerTint: tintToAlpha(fogProfile?.tint || terrainTheme?.fogTint || 'rgba(180,200,220,0.18)', localAlpha)
      });
    }

    zone._terrainTheme = terrainTheme;
    zone._bg = { palette, deepStars, nebula, particles, fogBanks, biome, terrainTheme };
    this._zoneId = zoneSeed;
    this._layers = zone._bg;
  },

  draw(ctx, screenW, screenH, zone) {
    if (!zone?._bg) return false;
    const bg = zone._bg;
    const profile = zone?._layerState?.profile || null;
    const terrainTheme = zone?._terrainTheme || bg.terrainTheme || null;
    const camX = Camera.getX();
    const camY = Camera.getY();
    const now = performance.now() * 0.001;
    const terrainStarScale = terrainTheme?.starfieldAlphaResolved ?? 1;
    const starAlphaMult = (1 + ((profile?.depthFactor || 0) * 0.08)) * terrainStarScale;
    const atmosphereAlphaMult = (profile?.atmosphereAlpha || 1) * (terrainTheme?.surfaceMode === 'land' ? 0.72 : 1);
    const spaceNebulaAlphaMult = terrainTheme?.surfaceMode === 'space' ? atmosphereAlphaMult : atmosphereAlphaMult * 0.12;
    const particleAlphaMult = (profile?.microDecoAlpha || 1) * (terrainTheme?.surfaceMode === 'land' ? 0.42 : 1);

    // ── BACKGROUND FILL ──
    ctx.fillStyle = bg.palette.bg;
    ctx.fillRect(0, 0, screenW, screenH);
    DepthStack.drawBackdrop(ctx, screenW, screenH, zone);

    // ── LAYER 0A: Terrain/theme surfaces (foundation for land themes) ──
    if (terrainTheme) {
      const surfaceMode = terrainTheme.surfaceMode || 'space';
      const allowRepeatedSurfaceLayers = surfaceMode !== 'space';
      if (allowRepeatedSurfaceLayers) {
        drawSurfaceLayer(
          ctx,
          screenW,
          screenH,
          camX,
          camY,
          terrainTheme.backdropSurface,
          terrainTheme.backdropAlpha || profile?.terrainBackdropAlpha || 0,
          1,
          now
        );
        drawSurfaceLayer(
          ctx,
          screenW,
          screenH,
          camX,
          camY,
          terrainTheme.accentSurface,
          terrainTheme.accentAlpha || 0,
          1.08,
          now * 0.7
        );
        drawSurfaceLayer(
          ctx,
          screenW,
          screenH,
          camX,
          camY,
          terrainTheme.transitionSurface,
          terrainTheme.transitionAlpha || 0,
          1,
          now * 0.55
        );
      }
      drawTintWash(ctx, screenW, screenH, terrainTheme.atmosphereTint, terrainTheme.surfaceMode === 'land' ? 0.58 : 0.44);
      drawReadabilityFog(ctx, screenW, screenH, zone, terrainTheme, profile);
    }

    // ── LAYER 0B: Deep stars (0.05 parallax — almost static) ──
    const deepSpeed = 0.05;
    for (const s of bg.deepStars) {
      const sx = s.x - camX * deepSpeed;
      const sy = s.y - camY * deepSpeed;
      
      // Wrap around screen for infinite feel
      const wx = ((sx % (screenW + 200)) + screenW + 200) % (screenW + 200) - 100;
      const wy = ((sy % (screenH + 200)) + screenH + 200) % (screenH + 200) - 100;
      
      if (wx < -10 || wy < -10 || wx > screenW + 10 || wy > screenH + 10) continue;
      
      // Twinkle
      const twinkle = 0.5 + Math.sin(now * s.twinkleSpeed + s.twinklePhase) * 0.5;
      ctx.globalAlpha = Math.min(1, s.a * twinkle * starAlphaMult);
      ctx.fillStyle = s.c;
      ctx.beginPath();
      ctx.arc(wx, wy, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ── LAYER 1: Nebula clouds (0.08 parallax + slow drift) ──
    for (const n of bg.nebula) {
      const nx = n.x - camX * 0.08 + Math.sin(now * n.drift) * 30;
      const ny = n.y - camY * 0.08 + Math.cos(now * n.drift * 0.7) * 20;
      
      if (nx < -400 || ny < -400 || nx > screenW + 400 || ny > screenH + 400) continue;
      
      ctx.save();
      ctx.translate(nx, ny);
      ctx.rotate(n.rot + now * 0.003);
      
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(n.rx, n.ry));
      grad.addColorStop(0, n.c);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.globalAlpha = Math.min(1, spaceNebulaAlphaMult);
      ctx.scale(1, n.ry / n.rx);
      ctx.beginPath();
      ctx.arc(0, 0, n.rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (profile?.terrainFogTint) {
      drawTintWash(ctx, screenW, screenH, profile.terrainFogTint, Math.min(0.55, profile.ambientFogAlpha || 0.08));
    }

    // ── LAYER 2: Close particles (variable parallax) ──
    for (const p of bg.particles) {
      const px = p.x - camX * p.speed;
      const py = p.y - camY * p.speed;
      
      const wx = ((px % (screenW + 200)) + screenW + 200) % (screenW + 200) - 100;
      const wy = ((py % (screenH + 200)) + screenH + 200) % (screenH + 200) - 100;
      
      if (wx < -5 || wy < -5 || wx > screenW + 5 || wy > screenH + 5) continue;
      
      ctx.globalAlpha = Math.min(1, p.a * particleAlphaMult);
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(wx, wy, p.r, 0, Math.PI * 2);
      ctx.fill();
      if (p.blur) {
        ctx.globalAlpha = Math.min(0.16, p.a * particleAlphaMult * 0.55);
        ctx.beginPath();
        ctx.arc(wx, wy, p.r * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    return true;
  }
};

export default Background;
