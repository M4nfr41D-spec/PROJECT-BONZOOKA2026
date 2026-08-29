// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// DepthStack.js - visual depth staging helpers
// ============================================================
// Purpose:
// - add stronger depth readability without touching gameplay logic
// - keep atmospheric underlays / halos / foreground veil isolated
// - prepare a stable foundation for future biome identity passes

import { Camera } from './Camera.js';
import { SeededRandom } from './SeededRandom.js';

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function biomeFogTint(biome) {
  switch (biome) {
    case 'void': return '32,16,68';
    case 'nebula': return '72,22,96';
    case 'blackhole': return '92,12,40';
    case 'derelict': return '84,48,18';
    default: return '24,52,84';
  }
}

function biomeGlowColor(biome) {
  switch (biome) {
    case 'void': return 'rgba(120,90,255,0.22)';
    case 'nebula': return 'rgba(180,90,220,0.24)';
    case 'blackhole': return 'rgba(255,70,120,0.22)';
    case 'derelict': return 'rgba(255,170,90,0.18)';
    default: return 'rgba(70,170,255,0.18)';
  }
}

function ensureZoneFx(zone, profile) {
  if (!zone) return null;
  const cacheKey = `${zone.seed || 0}|${profile?.biome || 'space'}|${profile?.depth || 1}`;
  if (zone._depthFx?.cacheKey === cacheKey) return zone._depthFx;

  const rng = new SeededRandom(((zone.seed || 0) ^ 0x51A7F00D) >>> 0);
  const wisps = [];
  const beamCount = 4 + Math.floor((profile?.depthFactor || 0) * 4);
  const wispCount = 8 + Math.floor((profile?.depthFactor || 0) * 8);

  for (let i = 0; i < wispCount; i++) {
    wisps.push({
      x: rng.range(-300, 2600),
      y: rng.range(-300, 2000),
      r: rng.range(120, 300),
      alpha: rng.range(0.035, 0.09),
      drift: rng.range(0.012, 0.05),
      speed: rng.range(0.16, 0.38),
      phase: rng.range(0, Math.PI * 2)
    });
  }

  const beams = [];
  for (let i = 0; i < beamCount; i++) {
    beams.push({
      x: rng.range(-200, 2400),
      y: rng.range(-200, 1800),
      len: rng.range(300, 700),
      width: rng.range(80, 180),
      rot: rng.range(-0.7, 0.7),
      alpha: rng.range(0.02, 0.06),
      speed: rng.range(0.014, 0.03)
    });
  }

  zone._depthFx = { cacheKey, wisps, beams };
  return zone._depthFx;
}

export const DepthStack = {
  drawBackdrop(ctx, screenW, screenH, zone) {
    const profile = zone?._layerState?.profile;
    if (!zone || !profile) return;
    const now = performance.now() * 0.001;
    const fx = ensureZoneFx(zone, profile);
    const tint = biomeFogTint(profile.biome);
    const vignetteAlpha = clamp(profile.vignetteAlpha || 0.18, 0, 0.45);
    const ambientFogAlpha = clamp(profile.ambientFogAlpha || 0.08, 0, 0.25);

    // Screen-space atmospheric wash
    const wash = ctx.createLinearGradient(0, 0, 0, screenH);
    wash.addColorStop(0, `rgba(${tint},${ambientFogAlpha * 0.9})`);
    wash.addColorStop(0.45, `rgba(${tint},${ambientFogAlpha * 0.35})`);
    wash.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, screenW, screenH);

    // Deep shafts / beams to create scene volume
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const beam of fx.beams) {
      const bx = ((beam.x - Camera.getX() * 0.035 + Math.sin(now * beam.speed) * 70) % (screenW + 500) + screenW + 500) % (screenW + 500) - 250;
      const by = ((beam.y - Camera.getY() * 0.025 + Math.cos(now * beam.speed * 0.85) * 60) % (screenH + 500) + screenH + 500) % (screenH + 500) - 250;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(beam.rot + Math.sin(now * beam.speed * 0.7) * 0.12);
      const grad = ctx.createLinearGradient(0, -beam.len * 0.5, 0, beam.len * 0.5);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5, `rgba(${tint},${beam.alpha * (profile.atmosphereAlpha || 1)})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, beam.width, beam.len, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // Edge vignette to push focus into play space
    const vignette = ctx.createRadialGradient(
      screenW * 0.5,
      screenH * 0.5,
      Math.min(screenW, screenH) * 0.2,
      screenW * 0.5,
      screenH * 0.5,
      Math.max(screenW, screenH) * 0.75
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(0.72, `rgba(0,0,0,${vignetteAlpha * 0.35})`);
    vignette.addColorStop(1, `rgba(0,0,0,${vignetteAlpha})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, screenW, screenH);
  },

  drawRoomUnderlays(ctx, zone, layout, profile, screenW, screenH) {
    if (!layout?.rooms?.length) return;
    const glowColor = biomeGlowColor(profile?.biome);
    const roomGlowAlpha = clamp((profile?.roomGlowAlpha || 1) - 1, 0, 0.8);
    const corridorFogAlpha = clamp(profile?.corridorFogAlpha || 0.08, 0, 0.22);

    ctx.save();
    for (const room of layout.rooms) {
      if (!Camera.isVisible(room.cx, room.cy, Math.max(room.rx, room.ry) + 140, screenW, screenH)) continue;
      const halo = ctx.createRadialGradient(room.cx, room.cy, 12, room.cx, room.cy, Math.max(room.rx, room.ry) * 1.2);
      halo.addColorStop(0, glowColor.replace(/0\.\d+\)/, `${0.12 + roomGlowAlpha * 0.14})`));
      halo.addColorStop(0.55, glowColor.replace(/0\.\d+\)/, `${0.05 + roomGlowAlpha * 0.07})`));
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.ellipse(room.cx, room.cy, room.rx * 1.08, room.ry * 1.08, 0, 0, Math.PI * 2);
      ctx.fill();

      // soft floor falloff adds depth separation towards walls
      const shadow = ctx.createRadialGradient(room.cx, room.cy, Math.min(room.rx, room.ry) * 0.25, room.cx, room.cy, Math.max(room.rx, room.ry) * 1.1);
      shadow.addColorStop(0, 'rgba(0,0,0,0)');
      shadow.addColorStop(0.8, `rgba(0,0,0,${profile?.roomEdgeShadowAlpha || 0.06})`);
      shadow.addColorStop(1, `rgba(0,0,0,${profile?.roomEdgeShadowAlpha || 0.06})`);
      ctx.fillStyle = shadow;
      ctx.beginPath();
      ctx.ellipse(room.cx, room.cy, room.rx * 1.03, room.ry * 1.03, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const cor of (layout.corridors || [])) {
      const a = layout.rooms[cor.from];
      const b = layout.rooms[cor.to];
      if (!a || !b) continue;
      const mx = (a.cx + b.cx) * 0.5;
      const my = (a.cy + b.cy) * 0.5;
      const len = Math.hypot(b.cx - a.cx, b.cy - a.cy);
      if (!Camera.isVisible(mx, my, len * 0.55, screenW, screenH)) continue;
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(Math.atan2(b.cy - a.cy, b.cx - a.cx));
      const grad = ctx.createLinearGradient(-len * 0.5, 0, len * 0.5, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5, `rgba(${biomeFogTint(profile?.biome)},${corridorFogAlpha})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, len * 0.48, 70 + len * 0.02, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  },

  drawLandmarkHalos(ctx, landmarks, profile, screenW, screenH) {
    if (!landmarks?.length) return;
    const haloColor = biomeGlowColor(profile?.biome);
    const alphaScale = clamp(profile?.landmarkHaloAlpha || 0.14, 0, 0.35);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const dec of landmarks) {
      if (!dec || !Camera.isVisible(dec.x, dec.y, 260, screenW, screenH)) continue;
      const scale = (dec.scale || 1) * 48;
      const grad = ctx.createRadialGradient(dec.x, dec.y, scale * 0.2, dec.x, dec.y, scale * 2.4);
      grad.addColorStop(0, haloColor.replace(/0\.\d+\)/, `${alphaScale})`));
      grad.addColorStop(0.55, haloColor.replace(/0\.\d+\)/, `${alphaScale * 0.35})`));
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(dec.x, dec.y, scale * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  drawObstacleShadows(ctx, obstacles, profile, screenW, screenH) {
    if (!obstacles?.length) return;
    const shadowAlpha = clamp(profile?.shadowAlpha || 0.18, 0.04, 0.45);
    const offset = 14 + (profile?.depthFactor || 0) * 12;
    ctx.save();
    for (const obs of obstacles) {
      if (!obs || obs.destroyed) continue;
      // W4P2: only grounded geometry should cast floor shadows.
      // Floating crates / debris in open space create a fake "glass floor" look and waste fill cost.
      const grounded = obs.grounded !== false;
      const castsShadow = obs.castsShadow !== false;
      const shadowClass = obs.shadowClass || obs.type || 'generic';
      if (!grounded || !castsShadow) continue;
      if (shadowClass === 'debris' || shadowClass === 'crate' || shadowClass === 'mine') continue;
      const r = obs.radius || 30;
      if (!Camera.isVisible(obs.x + offset, obs.y + offset * 0.7, r + 80, screenW, screenH)) continue;
      ctx.save();
      ctx.translate(obs.x + offset, obs.y + offset * 0.7);
      ctx.rotate(obs.rotation || 0);
      const grad = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.8);
      grad.addColorStop(0, `rgba(0,0,0,${shadowAlpha})`);
      grad.addColorStop(0.75, `rgba(0,0,0,${shadowAlpha * 0.28})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.2, r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  },

  drawForegroundVeil(ctx, screenW, screenH, zone) {
    const profile = zone?._layerState?.profile;
    if (!zone || !profile) return;
    const fx = ensureZoneFx(zone, profile);
    const now = performance.now() * 0.001;
    const tint = biomeFogTint(profile.biome);
    const alphaScale = clamp(profile.foregroundVeilAlpha || 0.08, 0, 0.24);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const w of fx.wisps) {
      const wx = ((w.x - Camera.getX() * w.speed + Math.cos(now * w.drift + w.phase) * 50) % (screenW + 600) + screenW + 600) % (screenW + 600) - 300;
      const wy = ((w.y - Camera.getY() * w.speed * 0.7 + Math.sin(now * w.drift * 0.85 + w.phase) * 40) % (screenH + 600) + screenH + 600) % (screenH + 600) - 300;
      const grad = ctx.createRadialGradient(wx, wy, w.r * 0.12, wx, wy, w.r);
      grad.addColorStop(0, `rgba(${tint},${w.alpha * alphaScale * 1.2})`);
      grad.addColorStop(0.6, `rgba(${tint},${w.alpha * alphaScale * 0.55})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(wx, wy, w.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // subtle upper/lower veil to create depth framing without obscuring gameplay
    const veil = ctx.createLinearGradient(0, 0, 0, screenH);
    veil.addColorStop(0, `rgba(${tint},${alphaScale * 0.7})`);
    veil.addColorStop(0.18, 'rgba(255,255,255,0)');
    veil.addColorStop(0.78, 'rgba(255,255,255,0)');
    veil.addColorStop(1, `rgba(${tint},${alphaScale * 0.85})`);
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, screenW, screenH);
  }
};

export default DepthStack;
