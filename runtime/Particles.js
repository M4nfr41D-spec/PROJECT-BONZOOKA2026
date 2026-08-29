// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// PARTICLES.js - Enhanced Particle FX System (v2.5.0)
// ============================================================

import { State } from './State.js';
import { ParticlePool } from './ObjectPool.js'; // v2.16.0 — GC-free particle recycling

export const Particles = {
  screenShake: 0,      // current shake intensity
  _shakeDecay: 8,
  _LOD_THRESHOLD: 300, // above this: skip shadowBlur + reduce spawns
  _LOD_HARD_CAP: 500,  // above this: skip 50% of new spawns

  // ── A41 FX routing (sprite back-door) ──
  // false = rich PROCEDURAL (default). true = use PNG sprite FX for that category.
  spriteExplosions: false,
  spriteImpacts: false,
  spriteBullets: false,
  spritePickups: false,

  _decals: [], // ground scorch marks (drawn under entities, fade over time)

  /** LOD factor: 1.0 = full quality, 0.5 = reduced, 0.0 = minimal */
  get lod() {
    const n = State.particles.length;
    if (n < this._LOD_THRESHOLD) return 1.0;
    if (n >= this._LOD_HARD_CAP) return 0.3;
    return 1.0 - 0.7 * ((n - this._LOD_THRESHOLD) / (this._LOD_HARD_CAP - this._LOD_THRESHOLD));
  },

  /** Check if a new particle should be spawned (LOD gating) */
  _shouldSpawn() {
    if (State.particles.length < this._LOD_THRESHOLD) return true;
    if (State.particles.length >= 600) return false; // hard cap
    return Math.random() < this.lod;
  },

  _playAuthoredEffect(type, x, y) {
    const SM = State.modules?.SpriteManager;
    if (!SM) return false;
    const map = {
      explosion: ['explosion_small', 'explosion'],
      explosionBig: ['explosion_big', 'explosion_elite', 'explosion_small', 'explosion']
    };
    const ids = map[type];
    if (!ids) return false;
    const size = type === 'explosionBig' ? 90 : 54;
    return !!SM.playBestEffect?.(ids, x, y, { category: 'effects', state: 'play', size });
  },

  spawn(x, y, type) {
    switch(type) {
      case 'muzzle':
        this.sparks(x, y, '#00ffff', 5);
        this.flash(x, y, '#00ffff', 6);
        break;
      case 'playerHit':
        this.sparks(x, y, '#ff6666', 8);
        this.flash(x, y, '#ff4444', 10);
        break;
      case 'shieldHit':
        this.ring(x, y, '#00ccff', 25);
        this.sparks(x, y, '#88ddff', 4);
        break;
      case 'explosion': {
        this._playAuthoredEffect('explosion', x, y);
        this.explosion(x, y, '#ff4444', 20, 200);
        this.ring(x, y, '#ff6600', 25);
        this.screenShake = Math.min(this.screenShake + 4, 12);
        break;
      }
      case 'explosionBig': {
        this._playAuthoredEffect('explosionBig', x, y);
        this.explosion(x, y, '#ff6600', 35, 300);
        this.explosion(x, y, '#ffcc00', 15, 150);
        this.ring(x, y, '#ff8800', 40);
        this.ring(x, y, '#ffdd00', 20);
        this.screenShake = Math.min(this.screenShake + 8, 16);
        break;
      }
      case 'heal':
        this.ring(x, y, '#00ff88', 20);
        this.floatUp(x, y, '#00ff88', 6);
        break;
      case 'levelUp':
        this.explosion(x, y, '#ffff00', 30, 250);
        this.ring(x, y, '#ffff00', 40);
        this.ring(x, y, '#ffaa00', 55);
        this.screenShake = Math.min(this.screenShake + 3, 10);
        break;
      case 'loot':
        this.floatUp(x, y, '#ffdd00', 8);
        this.sparks(x, y, '#ffcc00', 3);
        break;
      default: {
        const p = ParticlePool.acquire();
        p.x = x; p.y = y;
        p.vx = (Math.random() - 0.5) * 50;
        p.vy = (Math.random() - 0.5) * 50;
        p.life = 0.3; p.maxLife = 0.3;
        p.color = '#ffffff'; p.size = 3;
        State.particles.push(p);
        break;
      }
    }
  },

  update(dt) {
    // Screen shake decay
    if (this.screenShake > 0) {
      this.screenShake -= this._shakeDecay * dt;
      if (this.screenShake < 0.1) this.screenShake = 0;
    }

    // Age ground decals
    const dec = this._decals;
    for (let i = dec.length - 1; i >= 0; i--) {
      dec[i].life -= dt;
      if (dec[i].life <= 0) dec.splice(i, 1);
    }

    for (let i = State.particles.length - 1; i >= 0; i--) {
      const p = State.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      if (p.gravity) p.vy += 200 * dt;
      if (p.friction) { p.vx *= 0.95; p.vy *= 0.95; }
      if (p.drag) {
        const d = 1 - p.drag * dt;
        p.vx *= d; p.vy *= d;
      }

      if (p.life <= 0) {
        // v2.16.0: return to pool instead of GC
        if (p._poolActive) ParticlePool.release(p);
        State.particles.splice(i, 1);
      }
    }

    // Perf cap — cull oldest particles and return them to pool
    const max = 600;
    if (State.particles.length > max) {
      const excess = State.particles.splice(0, State.particles.length - max);
      for (const p of excess) {
        if (p._poolActive) ParticlePool.release(p);
      }
    }
  },

  draw(ctx) {
    // Apply screen shake offset (gated by settings)
    if (this.screenShake > 0.1 && State.settings?.screenShake !== false) {
      const sx = (Math.random() - 0.5) * this.screenShake;
      const sy = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(sx, sy);
    }

    const useShadow = this.lod > 0.6; // skip expensive shadowBlur at low LOD
    const particles = State.particles;

    // === PASS 0: Smoke puffs (soft, drawn under everything for weight) ===
    ctx.save();
    for (const p of particles) {
      if (!p.smoke) continue;
      const prog = 1 - p.life / p.maxLife;
      const r = p.size * (0.5 + prog * 1.5);
      const a = (p.life / p.maxLife) * 0.32;
      if (a <= 0.01) continue;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, p.color);
      g.addColorStop(0.55, p.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = a;
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // === PASS 1: Text particles (always drawn individually) ===
    for (const p of particles) {
      if (!p.isText) continue;
      const alpha = Math.min(1, (p.life / p.maxLife) * 2);
      ctx.globalAlpha = alpha;
      let scale = 1.0;
      if (p.scale && p.scale > 1) {
        const prog = 1 - (p.life / p.maxLife);
        scale = prog < 0.15
          ? 1 + (p.scale - 1) * (prog / 0.15)
          : p.scale - (p.scale - 1) * ((prog - 0.15) / 0.85);
      }
      const fs = Math.round(p.size * scale);
      ctx.font = `bold ${fs}px 'Orbitron', monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = p.isCrit ? 15 : 5;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillText(p.text, p.x, p.y);
      ctx.shadowBlur = 0;
    }

    // === PASS 2: Flash particles (radial gradient — individual) ===
    for (const p of particles) {
      if (!p.isFlash) continue;
      const alpha = Math.min(1, (p.life / p.maxLife) * 2);
      ctx.globalAlpha = alpha;
      const r = p.size * (1 + (1 - p.life / p.maxLife) * 2);
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      grad.addColorStop(0, p.color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // === PASS 2b: Shockwave (additive bright expanding ring) ===
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      if (!p.isShock) continue;
      const prog = 1 - p.life / p.maxLife;
      const r = p.size * (0.2 + prog * 1.0);
      const a = (p.life / p.maxLife);
      ctx.globalAlpha = a * 0.85;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(1, 5 * (1 - prog));
      if (useShadow) { ctx.shadowColor = p.color; ctx.shadowBlur = 12; }
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    // === PASS 3: Ring particles (stroke — individual) ===
    for (const p of particles) {
      if (!p.isRing) continue;
      const alpha = Math.min(1, (p.life / p.maxLife) * 2);
      ctx.globalAlpha = alpha;
      const progress = 1 - (p.life / p.maxLife);
      const r = p.size * (0.3 + progress * 0.7);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(0.5, 2 * (1 - progress));
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // === PASS 4: Regular dot particles — BATCHED by color ===
    // Group by color to minimize state changes
    const colorBuckets = new Map();
    for (const p of particles) {
      if (p.isText || p.isFlash || p.isRing || p.isShock || p.streak || p.smoke || p.glow) continue;
      const key = p.color;
      if (!colorBuckets.has(key)) colorBuckets.set(key, []);
      colorBuckets.get(key).push(p);
    }

    ctx.shadowBlur = 0;
    for (const [color, bucket] of colorBuckets) {
      ctx.fillStyle = color;
      if (useShadow) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 4; // reduced from per-particle dynamic value
      }
      ctx.beginPath();
      for (const p of bucket) {
        const alpha = Math.min(1, (p.life / p.maxLife) * 2);
        const size = p.size * Math.min(1, p.life / p.maxLife * 2);
        if (size < 0.3) continue;
        // For batched path we can't set per-particle alpha, so use average
        // For correctness with varying alpha, draw individually at high LOD
        if (this.lod > 0.8 && Math.abs(alpha - 1.0) > 0.15) {
          // Draw individually if alpha varies significantly
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.5, size), 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.moveTo(p.x + Math.max(0.5, size), p.y);
          ctx.arc(p.x, p.y, Math.max(0.5, size), 0, Math.PI * 2);
        }
      }
      ctx.globalAlpha = 0.85; // batch alpha compromise
      ctx.fill();
    }

    ctx.shadowBlur = 0;

    // === PASS 5: Glow embers (additive dots) ===
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      if (!p.glow) continue;
      const a = Math.min(1, (p.life / p.maxLife) * 2);
      const size = Math.max(0.5, p.size * Math.min(1, p.life / p.maxLife * 2));
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (useShadow) { ctx.shadowColor = p.color; ctx.shadowBlur = 8; }
      ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    // === PASS 6: Streak shrapnel (additive lines along velocity) ===
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const p of particles) {
      if (!p.streak) continue;
      const a = Math.min(1, (p.life / p.maxLife) * 2);
      if (a <= 0) continue;
      const sp = Math.hypot(p.vx, p.vy);
      const len = Math.min(22, Math.max(4, sp * 0.03));
      const ux = sp > 0 ? p.vx / sp : 1, uy = sp > 0 ? p.vy / sp : 0;
      ctx.globalAlpha = a;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(1, p.size);
      if (useShadow) { ctx.shadowColor = p.color; ctx.shadowBlur = 6; }
      ctx.beginPath();
      ctx.moveTo(p.x - ux * len, p.y - uy * len);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.globalAlpha = 1;
  },

  // ========== SPAWN HELPERS ==========

  // ── Internal: acquire a fully-reset pooled particle (pool only resets base
  // fields on release, so custom flags can otherwise leak between lives) ──
  _emit(props) {
    const p = ParticlePool.acquire();
    p.isText = false; p.isFlash = false; p.isRing = false; p.isShock = false;
    p.streak = false; p.smoke = false; p.glow = false;
    p.friction = false; p.gravity = false; p.drag = 0;
    p.scale = 0; p.text = null; p.vx = 0; p.vy = 0;
    Object.assign(p, props);
    if (props.maxLife == null) p.maxLife = p.life;
    State.particles.push(p);
    return p;
  },

  // Rich multi-layer explosion. Same signature — every existing caller
  // (enemy deaths, obstacle hits) upgrades for free.
  explosion(x, y, color, count = 15, speed = 150) {
    const lod = this.lod;
    const scale = Math.max(0.6, Math.min(2.4, count / 15)); // count → boom size
    const white = '#ffffff';

    // 1) Core flash: white-hot center + colored bloom
    this._emit({ x, y, color: white, size: 7 * scale,  life: 0.09, isFlash: true });
    this._emit({ x, y, color,        size: 13 * scale, life: 0.16, isFlash: true });

    // 2) Shockwave: 1–2 bright expanding rings
    this._emit({ x, y, color, size: 26 * scale, life: 0.32, isShock: true });
    if (scale > 1.1) this._emit({ x, y, color: white, size: 16 * scale, life: 0.22, isShock: true });

    // 3) Shrapnel: fast additive streaks (the punch)
    const shards = Math.max(4, Math.round(count * 0.8 * lod));
    for (let i = 0; i < shards; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.8 + Math.random() * 1.4);
      this._emit({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        color: Math.random() < 0.4 ? white : color,
        size: 1.6 + Math.random() * 2.4 * scale,
        life: 0.16 + Math.random() * 0.22, maxLife: 0.4,
        friction: true, streak: true
      });
    }

    // 4) Glowing embers: slower drift + fade
    const embers = Math.max(3, Math.round(count * 0.5 * lod));
    for (let i = 0; i < embers; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.2 + Math.random() * 0.6);
      this._emit({
        x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 6,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20,
        color, size: 1.5 + Math.random() * 3 * scale,
        life: 0.3 + Math.random() * 0.5, maxLife: 0.8,
        drag: 2.2, glow: true
      });
    }

    // 5) Smoke aftermath: soft expanding puffs for weight
    const puffs = Math.max(2, Math.round(3 * scale * lod));
    for (let i = 0; i < puffs; i++) {
      this._emit({
        x: x + (Math.random() - 0.5) * 10 * scale, y: y + (Math.random() - 0.5) * 10 * scale,
        vx: (Math.random() - 0.5) * 30, vy: -15 - Math.random() * 25,
        color, size: 10 * scale + Math.random() * 8 * scale,
        life: 0.4 + Math.random() * 0.4, maxLife: 0.8,
        drag: 1.5, smoke: true
      });
    }

    // 6) Scorch decal on the ground (aftermath, drawn under entities)
    this.decal(x, y, 18 * scale + Math.random() * 8 * scale, 1.3 + Math.random() * 0.8);
  },

  sparks(x, y, color, count = 8) {
    const lodCount = Math.max(2, Math.round(count * this.lod));
    for (let i = 0; i < lodCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 90 + Math.random() * 160;
      this._emit({
        x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 6,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        color, size: 1.4 + Math.random() * 1.8,
        life: 0.1 + Math.random() * 0.18, maxLife: 0.3,
        friction: true, streak: true
      });
    }
  },

  // Directional bullet impact: bright flash + cone of streaks back along the hit.
  impact(x, y, color, angle = 0, scale = 1) {
    const lod = this.lod;
    this._emit({ x, y, color: '#ffffff', size: 5 * scale, life: 0.07, isFlash: true });
    this._emit({ x, y, color, size: 9 * scale, life: 0.11, isFlash: true });
    const n = Math.max(3, Math.round(7 * scale * lod));
    const back = angle + Math.PI; // spray opposite bullet travel
    for (let i = 0; i < n; i++) {
      const a = back + (Math.random() - 0.5) * 1.4;
      const s = 140 + Math.random() * 220;
      this._emit({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        color: Math.random() < 0.5 ? '#ffffff' : color,
        size: 1.3 + Math.random() * 1.8 * scale,
        life: 0.08 + Math.random() * 0.14, maxLife: 0.22,
        friction: true, streak: true
      });
    }
  },

  // Directional muzzle flash: bright bloom at the barrel + forward spark spit.
  muzzle(x, y, color = '#bfe9ff', angle = 0, scale = 1) {
    this._emit({ x, y, color: '#ffffff', size: 4 * scale, life: 0.05, isFlash: true });
    this._emit({ x, y, color, size: 7 * scale, life: 0.08, isFlash: true });
    const n = Math.max(2, Math.round(4 * scale * this.lod));
    for (let i = 0; i < n; i++) {
      const a = angle + (Math.random() - 0.5) * 0.6;
      const s = 170 + Math.random() * 210;
      this._emit({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        color: Math.random() < 0.5 ? '#ffffff' : color,
        size: 1.2 + Math.random() * 1.4 * scale,
        life: 0.05 + Math.random() * 0.08, maxLife: 0.13,
        friction: true, streak: true
      });
    }
  },

  // Ground scorch decal — long-lived, fades, rendered UNDER entities.
  decal(x, y, radius = 24, life = 1.6) {
    const d = this._decals;
    d.push({ x, y, radius, life, maxLife: life });
    if (d.length > 48) d.splice(0, d.length - 48); // cull oldest
  },

  // Draw scorch decals on the ground (called from render BEFORE entities).
  drawDecals(ctx) {
    const dec = this._decals;
    if (!dec.length) return;
    ctx.save();
    for (const d of dec) {
      const t = d.life / d.maxLife;
      const a = (t > 0.25 ? 1 : t / 0.25) * 0.5; // quick fade-out at the end
      if (a <= 0.02) continue;
      const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.radius);
      g.addColorStop(0, `rgba(6,4,3,${a})`);
      g.addColorStop(0.6, `rgba(16,9,6,${a * 0.55})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  },

  ring(x, y, color, radius = 30) {
    const p = ParticlePool.acquire();
    p.x = x; p.y = y; p.vx = 0; p.vy = 0;
    p.life = 0.35; p.maxLife = 0.35;
    p.color = color; p.size = radius;
    p.isRing = true;
    State.particles.push(p);
  },

  flash(x, y, color, radius = 10) {
    const p = ParticlePool.acquire();
    p.x = x; p.y = y; p.vx = 0; p.vy = 0;
    p.life = 0.08; p.maxLife = 0.08;
    p.color = color; p.size = radius;
    p.isFlash = true;
    State.particles.push(p);
  },

  floatUp(x, y, color, count = 5) {
    const lodCount = Math.max(1, Math.round(count * this.lod));
    for (let i = 0; i < lodCount; i++) {
      const p = ParticlePool.acquire();
      p.x = x + (Math.random() - 0.5) * 12; p.y = y;
      p.vx = (Math.random() - 0.5) * 20;
      p.vy = -40 - Math.random() * 40;
      p.life = 0.5 + Math.random() * 0.3; p.maxLife = 0.8;
      p.color = color; p.size = 2 + Math.random() * 2;
      p.drag = 2;
      State.particles.push(p);
    }
  },

  trail(x, y, color, size = 3) {
    if (!this._shouldSpawn()) return; // LOD gating — trails are highest volume
    const p = ParticlePool.acquire();
    p.x = x; p.y = y;
    p.vx = (Math.random() - 0.5) * 20;
    p.vy = Math.random() * 20 + 10;
    p.life = 0.08 + Math.random() * 0.08; p.maxLife = 0.16;
    p.color = color; p.size = size * (0.5 + Math.random() * 0.5);
    State.particles.push(p);
  },

  text(x, y, text, color, size = 14) {
    // ═══ v2.15.0: Gate damage numbers via settings ═══
    if (State.settings?.damageNumbers === false) return;
    const p = ParticlePool.acquire();
    p.x = x; p.y = y; p.vx = 0; p.vy = -60;
    p.life = 0.8; p.maxLife = 0.8;
    p.text = text; p.isText = true;
    p.color = color; p.size = size;
    State.particles.push(p);
  },

  clear() { State.particles = []; this._decals = []; }
};

export default Particles;
