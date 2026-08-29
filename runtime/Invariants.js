// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// Invariants.js - Runtime Guardrails (NaN/Infinity + Entity Caps)
// ============================================================
// Purpose: prevent "silent corruption" and runaway entity floods from collapsing the game.
// Strategy:
//  - Fail-fast on non-finite core numbers (player, dt)
//  - Soft-fuse on entity caps (trim oldest entries) to keep FPS + stability
//  - Capture a minimal debug dump to console + localStorage on invariant failures

import { State } from './State.js';

const DEFAULT_CAPS = Object.freeze({
  bullets: 2000,
  enemyBullets: 2000,
  enemies: 900,
  pickups: 700,
  particles: 6500
});

function nowISO() {
  try { return new Date().toISOString(); } catch { return '' + Date.now(); }
}

function safeJson(obj) {
  try { return JSON.stringify(obj); } catch { return '"<unserializable>"'; }
}

function sliceSample(arr, head = 3, tail = 2) {
  if (!Array.isArray(arr)) return [];
  if (arr.length <= head + tail) return arr;
  return arr.slice(0, head).concat([{ __omitted__: arr.length - (head + tail) }], arr.slice(-tail));
}

export const Invariants = {
  enabled: true,
  hardThrowOnNonFinite: true,
  softFuseOnCaps: true,

  // Sampling cost control (keep small!)
  sampleEntitiesPerFrame: 12,

  caps: { ...DEFAULT_CAPS },

  // ---- core asserts ----
  assertFiniteNumber(value, label, ctx = null) {
    if (Number.isFinite(value)) return;
    const msg = `InvariantFail: ${label} is not finite (value=${value})`;
    const err = new Error(msg);
    err.code = 'INV_NON_FINITE';
    err.ctx = ctx || null;
    if (this.hardThrowOnNonFinite) throw err;
    console.error(err);
  },

  assertFiniteVec2(obj, xKey, yKey, label, ctx = null) {
    if (!obj) {
      const err = new Error(`InvariantFail: ${label} is null/undefined`);
      err.code = 'INV_NULL';
      err.ctx = ctx || null;
      if (this.hardThrowOnNonFinite) throw err;
      console.error(err);
      return;
    }
    this.assertFiniteNumber(obj[xKey], `${label}.${xKey}`, ctx);
    this.assertFiniteNumber(obj[yKey], `${label}.${yKey}`, ctx);
  },

  // ---- caps / soft fuse ----
  capArray(arr, max, label) {
    if (!Array.isArray(arr)) return;
    if (arr.length <= max) return;

    const overflow = arr.length - max;
    // Remove oldest entries (arrays are appended via push)
    arr.splice(0, overflow);

    if (this.softFuseOnCaps) {
      console.warn(`\u26A0\uFE0F SoftFuse: ${label} capped at ${max} (trimmed ${overflow})`);
    } else {
      const err = new Error(`InvariantFail: ${label} exceeded cap ${max} (len=${arr.length + overflow})`);
      err.code = 'INV_CAP_EXCEEDED';
      err.ctx = { label, max, len: arr.length + overflow };
      throw err;
    }
  },

  // ---- frame hooks ----
  preFrame(dt, extra = null) {
    if (!this.enabled) return;
    this.assertFiniteNumber(dt, 'dt', extra);
    // dt should never be negative
    if (dt < 0) this.assertFiniteNumber(NaN, 'dt_negative', { dt, ...(extra || {}) });
  },

  postFrame(extra = null) {
    if (!this.enabled) return;

    // Caps (hard stability guardrails)
    this.capArray(State.bullets, this.caps.bullets, 'State.bullets');
    this.capArray(State.enemyBullets, this.caps.enemyBullets, 'State.enemyBullets');
    this.capArray(State.enemies, this.caps.enemies, 'State.enemies');
    this.capArray(State.pickups, this.caps.pickups, 'State.pickups');
    this.capArray(State.particles, this.caps.particles, 'State.particles');

    // Core player sanity (cheap, high value)
    this.assertFiniteNumber(State.player.hp, 'State.player.hp', extra);
    this.assertFiniteNumber(State.player.shield, 'State.player.shield', extra);
    this.assertFiniteVec2(State.player, 'x', 'y', 'State.player.pos', extra);
    this.assertFiniteVec2(State.player, 'vx', 'vy', 'State.player.vel', extra);

    // Sample a few entities per frame (bounded cost)
    this.sampleEntityArrays(extra);
  },

  sampleEntityArrays(extra = null) {
    const budget = Math.max(0, this.sampleEntitiesPerFrame | 0);
    if (budget === 0) return;

    const sources = [
      { arr: State.bullets, label: 'bullet' },
      { arr: State.enemyBullets, label: 'enemyBullet' },
      { arr: State.enemies, label: 'enemy' },
      { arr: State.pickups, label: 'pickup' }
    ];

    let remaining = budget;

    for (const src of sources) {
      if (remaining <= 0) break;
      const arr = src.arr;
      if (!Array.isArray(arr) || arr.length === 0) continue;

      // Deterministic sampling: head + tail + sparse mid
      const indices = new Set();
      indices.add(0);
      indices.add(arr.length - 1);
      if (arr.length > 3) indices.add(2);

      // Add sparse mid samples (no RNG dependency)
      const step = Math.max(1, Math.floor(arr.length / 4));
      for (let i = step; i < arr.length && indices.size < 6; i += step) indices.add(i);

      for (const idx of indices) {
        if (remaining <= 0) break;
        const e = arr[idx];
        if (!e) continue;

        // Expect x/y for all these systems
        this.assertFiniteNumber(e.x, `${src.label}[${idx}].x`, extra);
        this.assertFiniteNumber(e.y, `${src.label}[${idx}].y`, extra);

        // Common optional fields
        if ('vx' in e) this.assertFiniteNumber(e.vx, `${src.label}[${idx}].vx`, extra);
        if ('vy' in e) this.assertFiniteNumber(e.vy, `${src.label}[${idx}].vy`, extra);
        if ('hp' in e) this.assertFiniteNumber(e.hp, `${src.label}[${idx}].hp`, extra);

        remaining--;
      }
    }
  },

  // ---- diagnostics ----
  captureDump(error, extra = null) {
    const dump = {
      at: nowISO(),
      message: error?.message || String(error),
      code: error?.code || null,
      stack: error?.stack || null,
      extra: extra || null,
      state: {
        world: State.world,
        run: State.run,
        player: {
          x: State.player.x, y: State.player.y,
          vx: State.player.vx, vy: State.player.vy,
          hp: State.player.hp, shield: State.player.shield,
          angle: State.player.angle
        },
        counts: {
          bullets: State.bullets?.length || 0,
          enemyBullets: State.enemyBullets?.length || 0,
          enemies: State.enemies?.length || 0,
          pickups: State.pickups?.length || 0,
          particles: State.particles?.length || 0
        },
        samples: {
          bullets: sliceSample(State.bullets),
          enemyBullets: sliceSample(State.enemyBullets),
          enemies: sliceSample(State.enemies),
          pickups: sliceSample(State.pickups)
        }
      }
    };

    // Store for later retrieval
    try { window.__BONZ_LAST_DUMP__ = dump; } catch {}
    try { localStorage.setItem('bonz_last_dump', safeJson(dump)); } catch {}

    // Always log a compact version
    console.error('\u00F0\u0178\u00A7\u00AF BONZ Dump captured:', dump);
    return dump;
  }
};
