// ============================================================
// ObjectPool.js — Generic Object Pooling (v2.16.0)
// ============================================================
// Eliminates per-frame allocations in hot paths (bullets, 
// particles, damage numbers). Provides typed pools with
// pre-warming, auto-expansion, and usage telemetry.
//
// Usage:
//   import { ObjectPool } from './ObjectPool.js';
//   const bulletPool = new ObjectPool('bullet', () => ({ x:0, y:0, ... }), 200);
//   const b = bulletPool.acquire();
//   bulletPool.release(b);

// --- Pool Implementation ---

export class ObjectPool {
  /**
   * @param {string} name - Pool identifier for telemetry
   * @param {Function} factory - Creates a new blank object
   * @param {number} initialSize - Pre-warm this many objects
   * @param {Function} [reset] - Optional reset function (obj) => void
   */
  constructor(name, factory, initialSize = 100, reset = null) {
    this.name = name;
    this._factory = factory;
    this._reset = reset;
    this._pool = [];
    this._active = new Set();
    
    // Stats
    this._stats = {
      created: 0,
      acquired: 0,
      released: 0,
      peak: 0,
      expansions: 0
    };
    
    // Pre-warm
    this._expand(initialSize);
  }
  
  // ========== PUBLIC API ==========
  
  /**
   * Get an object from the pool (or create one if empty).
   * @returns {Object} A pool-managed object
   */
  acquire() {
    let obj;
    if (this._pool.length > 0) {
      obj = this._pool.pop();
    } else {
      // Pool exhausted — expand by 25% (min 10)
      const expansion = Math.max(10, Math.ceil(this._stats.created * 0.25));
      this._expand(expansion);
      this._stats.expansions++;
      obj = this._pool.pop();
    }
    
    this._active.add(obj);
    this._stats.acquired++;
    
    if (this._active.size > this._stats.peak) {
      this._stats.peak = this._active.size;
    }
    
    return obj;
  }
  
  /**
   * Return an object to the pool.
   * @param {Object} obj - Must be a pool-managed object
   */
  release(obj) {
    if (!this._active.has(obj)) return; // ignore double-release
    
    this._active.delete(obj);
    
    // Reset object state
    if (this._reset) {
      this._reset(obj);
    }
    
    this._pool.push(obj);
    this._stats.released++;
  }
  
  /**
   * Release all active objects back to pool.
   */
  releaseAll() {
    for (const obj of this._active) {
      if (this._reset) this._reset(obj);
      this._pool.push(obj);
    }
    this._stats.released += this._active.size;
    this._active.clear();
  }
  
  /**
   * Get current pool statistics.
   */
  getStats() {
    return {
      name: this.name,
      active: this._active.size,
      available: this._pool.length,
      total: this._stats.created,
      peak: this._stats.peak,
      expansions: this._stats.expansions,
      acquireCount: this._stats.acquired,
      releaseCount: this._stats.released
    };
  }
  
  /**
   * Iterate over all active objects (for update/draw loops).
   * @param {Function} fn - Called with (obj, index)
   */
  forEachActive(fn) {
    let i = 0;
    for (const obj of this._active) {
      fn(obj, i++);
    }
  }
  
  /**
   * Filter + release: remove active objects matching predicate.
   * @param {Function} predicate - (obj) => boolean; true = release
   * @returns {number} Count released
   */
  releaseWhere(predicate) {
    const toRelease = [];
    for (const obj of this._active) {
      if (predicate(obj)) toRelease.push(obj);
    }
    for (const obj of toRelease) {
      this.release(obj);
    }
    return toRelease.length;
  }
  
  /**
   * Get count of currently active objects.
   */
  get activeCount() {
    return this._active.size;
  }
  
  // ========== INTERNAL ==========
  
  _expand(count) {
    for (let i = 0; i < count; i++) {
      const obj = this._factory();
      obj.__poolName = this.name; // tag for debug
      this._pool.push(obj);
      this._stats.created++;
    }
  }
}

// ============================================================
// Pre-configured Pool Factories for BONZOOKAA
// ============================================================

/**
 * Create a bullet pool with standard reset.
 */
export function createBulletPool(size = 300) {
  return new ObjectPool(
    'bullet',
    () => ({
      x: 0, y: 0,
      vx: 0, vy: 0,
      damage: 0,
      speed: 0,
      type: 'laser',
      owner: 'player',
      lifetime: 0,
      maxLifetime: 3,
      pierce: 0,
      homing: 0,
      homingTarget: null,
      crit: false,
      alive: false,
      width: 4,
      height: 8,
      color: '#00ffff',
      trail: null
    }),
    size,
    (b) => {
      b.x = 0; b.y = 0;
      b.vx = 0; b.vy = 0;
      b.damage = 0; b.speed = 0;
      b.type = 'laser'; b.owner = 'player';
      b.lifetime = 0; b.maxLifetime = 3;
      b.pierce = 0; b.homing = 0;
      b.homingTarget = null;
      b.crit = false; b.alive = false;
      b.width = 4; b.height = 8;
      b.color = '#00ffff'; b.trail = null;
    }
  );
}

/**
 * Create a particle pool with standard reset.
 */
export function createParticlePool(size = 500) {
  return new ObjectPool(
    'particle',
    () => ({
      x: 0, y: 0,
      vx: 0, vy: 0,
      size: 2,
      color: '#ffffff',
      alpha: 1,
      life: 0,
      maxLife: 1,
      type: 'default',
      gravity: 0,
      drag: 0.98,
      shrink: true,
      alive: false
    }),
    size,
    (p) => {
      p.x = 0; p.y = 0;
      p.vx = 0; p.vy = 0;
      p.size = 2; p.color = '#ffffff';
      p.alpha = 1; p.life = 0;
      p.maxLife = 1; p.type = 'default';
      p.gravity = 0; p.drag = 0.98;
      p.shrink = true; p.alive = false;
    }
  );
}

/**
 * Create a damage number pool.
 */
export function createDmgNumberPool(size = 50) {
  return new ObjectPool(
    'dmgNumber',
    () => ({
      x: 0, y: 0,
      text: '',
      color: '#ffffff',
      alpha: 1,
      life: 0,
      maxLife: 1.2,
      vy: -60,
      size: 14,
      alive: false,
      crit: false
    }),
    size,
    (d) => {
      d.x = 0; d.y = 0;
      d.text = ''; d.color = '#ffffff';
      d.alpha = 1; d.life = 0;
      d.maxLife = 1.2; d.vy = -60;
      d.size = 14; d.alive = false;
      d.crit = false;
    }
  );
}

// ============================================================
// PoolManager — Central registry for all pools
// ============================================================

export const PoolManager = {
  _pools: new Map(),
  
  register(pool) {
    this._pools.set(pool.name, pool);
  },
  
  get(name) {
    return this._pools.get(name);
  },
  
  /**
   * Get diagnostic report of all pools.
   */
  report() {
    const data = [];
    for (const pool of this._pools.values()) {
      data.push(pool.getStats());
    }
    return data;
  },
  
  /**
   * Release all objects in all pools (scene transition).
   */
  releaseAll() {
    for (const pool of this._pools.values()) {
      pool.releaseAll();
    }
  }
};

// ═══ v2.16.0 convenience proxies — used by Bullets.js + Particles.js ═══
// These delegate to PoolManager-registered pools (created in main.js init)
const _lazyPool = (name) => ({
  acquire() { const p = PoolManager.get(name); return p ? p.acquire() : {}; },
  release(obj) { const p = PoolManager.get(name); if (p) p.release(obj); }
});
export const BulletPool = _lazyPool('bullet');
export const ParticlePool = _lazyPool('particle');
