// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// BULLETS.js - Projectile System
// ============================================================

import { State } from './State.js';
import { Enemies } from './Enemies.js';
import { Player } from './Player.js';
import { SpatialHash } from './SpatialHash.js';
import { BulletPool, ParticlePool } from './ObjectPool.js'; // v2.16.0 — GC-free bullet/particle recycling

export const Bullets = {
  _resolveBulletSpriteType(type) {
    const SM = State.modules?.SpriteManager;
    if (!SM || !type) return null;
    const aliases = {
      standard_cannon: ['standard_cannon', 'laser', 'gatling'],
      dual_cannon: ['dual_cannon', 'gatling', 'laser'],
      laser_desintegrator: ['laser_desintegrator', 'laser', 'plasma'],
      enemy: ['enemy', 'plasma', 'plasma_basic'],
    };
    const candidates = [
      ...(aliases[type] || [type]),
      type === 'enemy' ? 'plasma' : null,
      type === 'enemy' ? 'plasma_basic' : null,
      'laser'
    ];
    for (const c of candidates) {
      if (!c) continue;
      if (SM.getStateDef?.('bullets', c, 'travel') || SM.getStateDef?.('bullets', c, 'impact')) return c;
    }
    return null;
  },

  _getBulletRenderProfile(type, isEnemy = false) {
    const key = isEnemy && (!type || type === 'enemy') ? 'enemy' : (type || 'laser');
    const map = {
      laser:   { scale: 3.4, min: 26 },
      standard_cannon: { scale: 3.2, min: 22 },
      dual_cannon: { scale: 3.0, min: 20 },
      laser_desintegrator: { scale: 3.6, min: 28 },
      plasma:  { scale: 3.8, min: 30 },
      plasma_basic: { scale: 3.8, min: 30 },
      railgun: { scale: 4.1, min: 28 },
      missile: { scale: 4.8, min: 36 },
      gatling: { scale: 3.0, min: 18 },
      nova:    { scale: 4.6, min: 34 },
      enemy:   { scale: 3.8, min: 26 }
    };
    return map[key] || map.laser;
  },

  _playBulletImpactSprite(type, x, y, size = 18, angle = 0) {
    // A41: procedural impacts by default. Flip Particles.spriteImpacts to use PNGs.
    if (!State.modules?.Particles?.spriteImpacts) return false;
    const SM = State.modules?.SpriteManager;
    if (!SM) return false;
    const spriteType = this._resolveBulletSpriteType(type);
    if (!spriteType) return false;
    const effectId = SM.chooseEffect?.([spriteType], 'impact', 'bullets');
    if (!effectId) return false;
    SM.playEffect(effectId, x, y, { category: 'bullets', state: 'impact', size: Math.max(18, size * 3), angle, alpha: 1 });
    return true;
  },


  _getZoneKey() {
    const zone = State.world?.currentZone;
    if (!zone) return 'screen';
    return `${zone.seed || 'noseed'}:${zone.depth || State.run?.currentDepth || 0}`;
  },

  _getScreenMetrics(canvas) {
    const w = Math.max(800, canvas?.width || document.getElementById('gameCanvas')?.width || 1600);
    const h = Math.max(600, canvas?.height || document.getElementById('gameCanvas')?.height || 900);
    const screenRadius = Math.max(320, w * 0.5);
    const playerLength = Math.max(24, (State.player?.radius || 18) * 2);
    return { w, h, screenRadius, playerLength };
  },

  _getProjectileProfile(type, canvas, opts = {}) {
    const { screenRadius, playerLength, w } = this._getScreenMetrics(canvas);
    const enemy = !!opts.enemy;
    if (enemy) {
      const maxRange = Math.max(260, screenRadius * 1.1);
      return {
        maxRange,
        maxLifetime: Math.max(0.45, maxRange / Math.max(180, opts.speed || 220)) + 0.25,
        damageAtDistance: () => 1
      };
    }

    switch (type || 'laser') {
      case 'laser':
        return {
          maxRange: screenRadius,
          maxLifetime: Math.max(0.32, screenRadius / Math.max(320, opts.speed || 780)) + 0.18,
          damageAtDistance: () => 1
        };
      case 'missile': {
        const maxRange = screenRadius;
        const half = maxRange * 0.5;
        return {
          maxRange,
          maxLifetime: Math.max(0.8, maxRange / Math.max(150, opts.speed || 420)) + 0.45,
          homing: true,
          turnRate: 4.8,
          splashRadius: Math.max(28, playerLength * 1.05),
          damageAtDistance: (d) => {
            if (d >= half) return 1;
            const t = Math.max(0, Math.min(1, d / Math.max(1, half)));
            return 0.5 + 0.5 * t;
          }
        };
      }
      case 'gatling': {
        const maxRange = screenRadius;
        const falloffStart = maxRange * 0.5;
        return {
          maxRange,
          maxLifetime: Math.max(0.28, maxRange / Math.max(280, opts.speed || 660)) + 0.14,
          damageAtDistance: (d) => {
            if (d <= falloffStart) return 1;
            const t = Math.max(0, Math.min(1, (d - falloffStart) / Math.max(1, maxRange - falloffStart)));
            return 1 - (0.75 * t);
          }
        };
      }
      case 'plasma': {
        const maxRange = playerLength * 4;
        const strong = playerLength * 2;
        return {
          maxRange,
          maxLifetime: Math.max(0.14, maxRange / Math.max(260, opts.speed || 700)) + 0.1,
          damageAtDistance: (d) => {
            if (d <= strong) return 1.25;
            const t = Math.max(0, Math.min(1, (d - strong) / Math.max(1, maxRange - strong)));
            return Math.max(0, 1.25 * (1 - t));
          }
        };
      }
      case 'railgun': {
        const maxRange = w;
        const half = screenRadius * 0.5;
        const full = screenRadius;
        return {
          maxRange,
          maxLifetime: Math.max(0.32, maxRange / Math.max(520, opts.speed || 1350)) + 0.2,
          damageAtDistance: (d, bullet) => {
            let mult;
            if (d <= half) {
              const t = Math.max(0, Math.min(1, d / Math.max(1, half)));
              mult = 0.25 + (0.75 * t);
            } else if (d <= full) {
              const t = Math.max(0, Math.min(1, (d - half) / Math.max(1, full - half)));
              mult = 1.0 + (0.35 * t);
            } else {
              mult = 1.35;
            }
            if (bullet?.stationaryShot) {
              if (d >= full) mult = Math.max(mult, 1.5);
              else if (d > half) {
                const t = Math.max(0, Math.min(1, (d - half) / Math.max(1, full - half)));
                mult += 0.15 * t;
              }
            }
            return Math.min(1.5, mult);
          }
        };
      }
      case 'nova': {
        const maxRange = playerLength * 3;
        return {
          maxRange,
          maxLifetime: 0.12,
          damageAtDistance: (d) => Math.max(0, 1 - (d / Math.max(1, maxRange)))
        };
      }
      default:
        return {
          maxRange: screenRadius,
          maxLifetime: Math.max(0.35, screenRadius / Math.max(220, opts.speed || 600)) + 0.2,
          damageAtDistance: () => 1
        };
    }
  },

  _getTravelDistance(b) {
    if (!b) return 0;
    if (typeof b.distanceTraveled === 'number') return b.distanceTraveled;
    const dx = (b.x || 0) - (b.spawnX || b.x || 0);
    const dy = (b.y || 0) - (b.spawnY || b.y || 0);
    return Math.hypot(dx, dy);
  },

  _getBulletDamageMultiplier(b, canvas) {
    const profile = b?.profile || this._getProjectileProfile(b?.bulletType, canvas, { speed: Math.hypot(b?.vx || 0, b?.vy || 0) });
    const dist = this._getTravelDistance(b);
    return Math.max(0, profile.damageAtDistance ? profile.damageAtDistance(dist, b) : 1);
  },

  _findNearestEnemyTarget(x, y, maxDistance = 9999) {
    let best = null;
    let bestDist = maxDistance;
    for (const e of State.enemies) {
      if (!e || e.dead || e.destroyed) continue;
      const d = Math.hypot((e.x || 0) - x, (e.y || 0) - y);
      if (d < bestDist) {
        best = e;
        bestDist = d;
      }
    }
    return best;
  },

  _steerMissile(b, dt) {
    if (!b || !b.homing || !b.isPlayer) return;
    const target = this._findNearestEnemyTarget(b.x, b.y, 720);
    if (!target) return;
    const speed = Math.max(1, Math.hypot(b.vx || 0, b.vy || 0));
    const current = Math.atan2(b.vy || 0, b.vx || 0);
    const desired = Math.atan2((target.y || 0) - b.y, (target.x || 0) - b.x);
    let diff = desired - current;
    diff = ((diff + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    const turn = Math.max(-1, Math.min(1, diff)) * Math.min(Math.abs(diff), (b.turnRate || 4.8) * dt);
    const next = current + turn;
    b.vx = Math.cos(next) * speed;
    b.vy = Math.sin(next) * speed;
  },

  // ═══ A51 DRONE ELEMENT AXIS — drone carries ONE element (build-defining) ═══
  // Each element maps to a bounded A49-status payoff. Frost = first concrete instance;
  // fire/lightning drop in here as new entries in step 4. Element is applied ONLY in the
  // bullet-hit path (never on derived damage) → respects the no-cascade rule.
  DRONE_ELEMENTS: {
    none: { color: '#88ccff' },
    frost: {
      color: '#88ddff',
      freezeDuration: 0.8,
      shatter: true,
      onHit(e) {
        // Bosses get a slow instead of full freeze (no perma-freeze cheese)
        if (e.isBoss) { e._slowTimer = Math.max(e._slowTimer || 0, 0.5); e._slowFactor = 0.5; return; }
        const wasFrozen = (e._freezeTimer || 0) > 0;
        e._freezeTimer = Math.max(e._freezeTimer || 0, this.freezeDuration);
        if (!wasFrozen) State.modules?.Audio?.freeze?.(); // A52: sound only on fresh freeze
      }
    }
    // fire:      { onHit(e){ e._burnTimer = 2; e._burnDPS = ...; } },   // step 4
    // lightning: { onHit(e){ e._shockTimer = Enemies.STATUS.SHOCK_MARK_DURATION; } } // step 4
  },
  _applyDroneElement(e, element) {
    const def = this.DRONE_ELEMENTS[element];
    if (def && def.onHit) def.onHit(e);
  },
  // Frost shatter: a frozen enemy bursts on death. Bounded — one layer deep (its own kills
  // run through _resolveCollateralKill → marked collateral → cannot re-shatter).
  _spawnShatter(x, y, src) {
    const p = State.player;
    const radius = 80;
    State.modules?.Audio?.shatter?.(); // A52: icy glass-break payoff
    const dmg = Math.max(1, Math.floor((p.damage || 10) * 2)); // flat 2× base, scales but never ×-stacks
    const Particles = State.modules?.Particles;
    if (Particles) {
      Particles.explosion(x, y, '#aaddff', 10, radius);
      Particles.ring(x, y, '#cceeff', Math.floor(radius * 0.6));
    }
    for (const en of State.enemies) {
      if (!en || en.dead || en.destroyed || en === src) continue;
      const d = Math.hypot((en.x || 0) - x, (en.y || 0) - y);
      if (d > radius) continue;
      const k = Enemies.damage(en, dmg, false);
      if (k) this._resolveCollateralKill(k, { cause: 'frost_shatter' });
    }
  },

  _applyMissileSplash(x, y, baseDamage, primary = null, radius = 40, meta = {}) {
    const splash = Math.max(18, radius || 40);
    const Particles = State.modules?.Particles;
    if (Particles) {
      Particles.explosion(x, y, '#ff8800', 8, splash * 2.2);
      Particles.flash(x, y, '#ffaa55', 6);
    }
    for (const en of State.enemies) {
      if (!en || en.dead || en.destroyed) continue;
      if (primary && en === primary) continue;
      const d = Math.hypot((en.x || 0) - x, (en.y || 0) - y);
      if (d > splash) continue;
      const falloff = 1 - (d / Math.max(1, splash));
      const splashDmg = Math.max(1, Math.floor(baseDamage * 0.45 * Math.max(0.2, falloff)));
      const splashKill = Enemies.damage(en, splashDmg, false);
      if (splashKill) this._resolveCollateralKill(splashKill, { ...meta, cause: 'missile_splash' });
    }
    // ═══ A50: CLUSTER payload — gravity pull (positioning ONLY, zero damage multiplier) ═══
    if (meta.payload === 'cluster') {
      const pullRadius = splash * 2.2;
      State.modules?.Audio?.clusterPull?.(); // A52: gravity implosion whoosh
      for (const en of State.enemies) {
        if (!en || en.dead || en.destroyed) continue;
        const d = Math.hypot((en.x || 0) - x, (en.y || 0) - y);
        if (d > pullRadius || d < 4) continue;
        en._pullX = x; en._pullY = y;
        en._pullTimer = 0.35;
        en._pullSpeed = Math.max(380, d / 0.32); // reach center within the window
      }
      // Implosion visual: particles converging inward, then the existing blast reads as the "snap"
      if (Particles) {
        for (let i = 0; i < 22; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = pullRadius * (0.5 + Math.random() * 0.5);
          State.particles.push({
            x: x + Math.cos(a) * r, y: y + Math.sin(a) * r,
            vx: -Math.cos(a) * (r / 0.3), vy: -Math.sin(a) * (r / 0.3),
            life: 0.3, maxLife: 0.3, color: '#cc66ff', size: 3
          });
        }
        Particles.ring(x, y, '#aa66ff', 18);
      }
    }
  },

  _resolveCollateralKill(killData, meta = {}) {
    if (!killData || killData._bulletsResolved) return;
    killData._bulletsResolved = true;
    killData._collateral = true;
    killData._collateralCause = meta.cause || 'aux';
    this.onEnemyKilled(killData, { collateral: true, cause: killData._collateralCause });
  },

  _removePlayerBulletAt(i) {
    const b = State.bullets[i];
    if (!b) return;
    BulletPool.release(b);
    State.bullets.splice(i, 1);
  },

  _removeEnemyBulletAt(i) {
    const b = State.enemyBullets[i];
    if (!b) return;
    State.enemyBullets.splice(i, 1);
  },

  flushForZoneTransition() {
    for (let i = State.bullets.length - 1; i >= 0; i--) this._removePlayerBulletAt(i);
    for (let i = State.enemyBullets.length - 1; i >= 0; i--) this._removeEnemyBulletAt(i);
  },

  triggerNovaPulse(config = {}) {
    const p = State.player;
    const radius = config.radius || Math.max(72, (p?.radius || 18) * 6);
    const damage = Math.max(1, config.damage || 10);
    const isCrit = !!config.crit;
    const centerX = config.x ?? p.x;
    const centerY = config.y ?? p.y;
    const Particles = State.modules?.Particles;
    if (Particles) {
      Particles.ring(centerX, centerY, config.color || '#aa66ff', radius);
      Particles.flash(centerX, centerY, '#ffffff', Math.max(10, radius * 0.18));
      for (let k = 0; k < 18; k++) {
        const a = (k / 18) * Math.PI * 2;
        Particles.trail(centerX + Math.cos(a) * radius * 0.55, centerY + Math.sin(a) * radius * 0.55, config.color || '#aa66ff', 3);
      }
    }
    let hitAny = false;
    for (const e of State.enemies) {
      if (!e || e.dead || e.destroyed !== undefined) continue;
      const dist = Math.hypot(e.x - centerX, e.y - centerY);
      if (dist > radius + (e.size || 0)) continue;
      hitAny = true;
      const distMult = Math.max(0.4, 1 - (dist / Math.max(1, radius)));
      const killData = Enemies.damage(e, damage * distMult, isCrit);
      if (killData) this.onEnemyKilled(killData);
      this.spawnDamageNumber(e.x, e.y - 10, Math.max(1, Math.floor(damage * distMult)), isCrit);
    }
    if (hitAny) {
      const Audio = State.modules?.Audio;
      if (Audio?.weaponNova) Audio.weaponNova();
    }
  },

  // Spawn a new bullet
  spawn(config) {
    // v2.16.0: pool-acquire instead of allocating new object each fire
    const b = BulletPool.acquire();
    b.x          = config.x;
    b.y          = config.y;
    b.spawnX     = config.x;
    b.spawnY     = config.y;
    b.vx         = config.vx  || 0;
    b.vy         = config.vy  || -500;
    b.damage     = config.damage || 10;
    b.baseDamage = b.damage;
    b.size       = config.size || 4;
    b.pierce     = config.piercing || 0;
    b.hits       = 0;
    b.isCrit     = config.crit || false;
    b.isPlayer   = config.isPlayer !== false;
    b.bulletType = config.bulletType || 'laser';
    b.weaponType = config.weaponType || b.bulletType;
    b.source = config.source || 'player';
    b.payload = config.payload || null; // A50: secondary-weapon payload (e.g. 'cluster' = gravity pull)
    b.element = config.element || null; // A51: drone-element status applied on hit (frost/fire/lightning)
    b.allowOnKillEffects = config.allowOnKillEffects !== false;
    b.stationaryShot = !!config.stationaryShot;
    b.distanceTraveled = 0;
    b.lifetime = 0;
    b.ownerZoneKey = this._getZoneKey();
    const speed = Math.hypot(b.vx, b.vy);
    b.profile = this._getProjectileProfile(b.bulletType, config.canvas || null, { speed, enemy: false });
    b.maxRange = config.maxRange || b.profile.maxRange;
    b.maxLifetime = config.maxLifetime || b.profile.maxLifetime;
    b.homing = config.homing ?? !!b.profile.homing;
    b.turnRate = config.turnRate || b.profile.turnRate || 0;
    b.splashRadius = config.splashRadius || b.profile.splashRadius || 0;
    State.bullets.push(b);
  },
  
  // Spawn enemy bullet
  spawnEnemy(config) {
    const vx = config.vx || 0;
    const vy = config.vy || 200;
    const speed = Math.hypot(vx, vy);
    const profile = this._getProjectileProfile(config.bulletType || 'enemy', config.canvas || null, { speed, enemy: true });
    State.enemyBullets.push({
      x: config.x,
      y: config.y,
      spawnX: config.x,
      spawnY: config.y,
      vx,
      vy,
      damage: config.damage || 10,
      size: config.size || 6,
      bulletType: config.bulletType || 'enemy',
      ownerZoneKey: this._getZoneKey(),
      distanceTraveled: 0,
      lifetime: 0,
      maxRange: config.maxRange || profile.maxRange,
      maxLifetime: config.maxLifetime || profile.maxLifetime,
      profile
    });
  },
  
  // Update all bullets
  update(dt, canvas) {
    // Player bullets
    for (let i = State.bullets.length - 1; i >= 0; i--) {
      const b = State.bullets[i];
      const activeZoneKey = this._getZoneKey();
      if (b.ownerZoneKey && b.ownerZoneKey !== activeZoneKey) {
        this._removePlayerBulletAt(i);
        continue;
      }

      if (b.bulletType === 'missile') this._steerMissile(b, dt);

      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.lifetime = (b.lifetime || 0) + dt;
      b.distanceTraveled = (b.distanceTraveled || 0) + Math.hypot(b.vx * dt, b.vy * dt);
      if ((b.maxLifetime && b.lifetime > b.maxLifetime) || (b.maxRange && b.distanceTraveled > b.maxRange)) {
        this._removePlayerBulletAt(i);
        continue;
      }
      const zone = State.world?.currentZone;
      if (zone) {
        const margin = 200;
        if (b.y < -margin || b.y > zone.height + margin || b.x < -margin || b.x > zone.width + margin) {
          this._removePlayerBulletAt(i);
          continue;
        }
      } else {
        if (b.y < -20 || b.y > canvas.height + 20 || b.x < -20 || b.x > canvas.width + 20) {
          this._removePlayerBulletAt(i);
          continue;
        }
      }
      // ── Spatial hash accelerated collision (falls back to brute-force if grid unavailable) ──
      const grid = State._spatialGrid;
      const queryR = Math.max(b.size, 10) + 80; // covers largest asteroid/enemy radius

      // Check collision with asteroid props (player bullets only)
      if (b.isPlayer) {
        let hitAsteroid = false;
        const nearby = grid
          ? SpatialHash.query(grid, b.x, b.y, queryR)
          : (zone?.obstacles || []);
        for (const a of nearby) {
          if (!a || a.destroyed || a.dead !== undefined) continue; // skip enemies (they have .dead)
          const distA = Math.hypot(b.x - a.x, b.y - a.y);
          if (distA < (b.size + (a.radius || 50))) {
            // Mine: detonate on bullet hit
            if (a.type === 'mine') {
              a.destroyed = true;
              const Particles = State.modules?.Particles;
              const PlayerMod = State.modules?.Player;
              if (Particles) {
                Particles.explosion(a.x, a.y, '#ff4400', 30, 280);
                Particles.explosion(a.x, a.y, '#ffcc00', 15, 180);
                Particles.ring(a.x, a.y, '#ff6600', 60);
                Particles.ring(a.x, a.y, '#ffcc00', 35);
                Particles.flash(a.x, a.y, '#ffffff', 20);
                Particles.screenShake = Math.max(Particles.screenShake || 0, 8);
              }
              const SM1 = State.modules?.SpriteManager;
              if (SM1 && Particles?.spriteExplosions) {
                if (!this._playBulletImpactSprite(b.bulletType, a.x, a.y, Math.max(20, (b.size || 4) * 4), Math.atan2(b.vy, b.vx))) {
                  SM1.playEffect('explosion_small', a.x, a.y, { size: 60 });
                }
              }
              const AudioB = State.modules?.Audio;
              if (AudioB) AudioB.mineExplosion();
              // Splash damage to player if close
              const pDist = Math.hypot(State.player.x - a.x, State.player.y - a.y);
              if (pDist < 100 && PlayerMod) PlayerMod.takeDamage(a.damage || 15);
              // Splash damage to enemies
              for (const en of State.enemies) {
                if (en.dead) continue;
                if (Math.hypot(en.x - a.x, en.y - a.y) < 100) {
                  const EnemiesMod = State.modules?.Enemies;
                  if (EnemiesMod) EnemiesMod.damage(en, (a.damage || 15) * 0.6, false);
                }
              }
              this._removePlayerBulletAt(i);
              hitAsteroid = true;
              break;
            }

            // Non-destructible obstacles (pillars): just stop bullet
            if (a.destructible === false) {
              const ParticlesM = State.modules?.Particles;
              if (ParticlesM) { ParticlesM.sparks(b.x, b.y, '#aabbcc', 4); }
              this._playBulletImpactSprite(b.bulletType, b.x, b.y, Math.max(18, (b.size || 4) * 4), Math.atan2(b.vy, b.vx));
              if (b.bulletType === 'missile') this._applyMissileSplash(b.x, b.y, b.baseDamage || b.damage, null, b.splashRadius || 40, { source: b.source, payload: b.payload });
              this._removePlayerBulletAt(i);
              hitAsteroid = true;
              break;
            }

            // Damage destructible obstacle
            a.hp = (typeof a.hp === 'number') ? a.hp - b.damage : 0;

            // Impact sparks (via Particles module — pool-safe)
            { const ParticlesM = State.modules?.Particles;
              if (ParticlesM) ParticlesM.sparks(b.x, b.y, '#aabbcc', 5); }

            // Destroyed -> explosion + drop resources
            if (a.hp <= 0) {
              a.destroyed = true;
              
              // Generator destroyed → objective progress
              if (a.isGenerator) {
                const obj = State.run.objective;
                if (obj && obj.type === 'lockdown' && !obj.complete) {
                  obj.progress++;
                  const Particles = State.modules?.Particles;
                  if (Particles) {
                    Particles.text(a.x, a.y - 30, `GENERATOR ${obj.progress}/${obj.target}`, '#ff4444', 14);
                    Particles.explosion(a.x, a.y, '#ff4444', 10, 60);
                  }
                  if (obj.progress >= obj.target) {
                    obj.complete = true;
                    this._announceObjectiveComplete();
                  }
                }
              }

              // Destruction explosion
              const Particles = State.modules?.Particles;
              if (Particles) {
                const r = a.radius || 30;
                // Resource nodes get colored explosions
                const expColor = a.glow || '#889aab';
                Particles.explosion(a.x, a.y, expColor, Math.floor(r * 0.5), r * 2.5);
                Particles.ring(a.x, a.y, expColor, r * 1.2);
                if (r > 40) Particles.flash(a.x, a.y, '#ffffff', r * 0.3);
                Particles.screenShake = Math.max(Particles.screenShake || 0, Math.min(3, r * 0.04));
              }
              const SM2 = State.modules?.SpriteManager;
              if (SM2 && Particles?.spriteExplosions) {
                if (!SM2.playBestEffect?.(['explosion_small','explosion'], a.x, a.y, { size: (a.radius || 30) * 0.8, category: 'effects', state: 'play' })) {
                  SM2.playEffect('explosion_small', a.x, a.y, { size: (a.radius || 30) * 0.8 });
                }
              }

              // ── RESOURCE NODE DROPS ──
              if (a.resourceType) {
                const mult = a.resourceMult || 1;
                const acfg = State.data.config?.asteroids || {};
                const sMin = (typeof acfg.scrapMin === 'number') ? acfg.scrapMin : 2;
                const sMax = (typeof acfg.scrapMax === 'number') ? acfg.scrapMax : 6;
                const sizeFactor = Math.max(0.7, Math.min(1.6, (a.radius || 50) / 50));
                
                switch (a.resourceType) {
                  case 'scrap':
                    State.pickups.push({
                      type: 'scrap', x: a.x, y: a.y,
                      vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60,
                      life: 15, value: Math.max(1, Math.floor((sMin + Math.random() * (sMax - sMin + 1)) * sizeFactor * mult))
                    });
                    break;
                  case 'cells':
                    State.pickups.push({
                      type: 'cells', x: a.x, y: a.y,
                      vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60,
                      life: 15, value: Math.max(1, Math.floor((sMin * 0.7 + Math.random() * sMax * 0.5) * mult))
                    });
                    // Chance for void shard
                    if (a.voidShardChance && Math.random() < a.voidShardChance) {
                      State.meta.voidShards = (State.meta.voidShards || 0) + 1;
                      if (State.ui) State.ui.announcement = { text: '💠 VOID SHARD found!', timer: 2 };
                      const AudioR = State.modules?.Audio;
                      if (AudioR?.voidShardDrop) AudioR.voidShardDrop();
                    }
                    break;
                  case 'voidShard':
                    State.meta.voidShards = (State.meta.voidShards || 0) + 1;
                    if (State.ui) State.ui.announcement = { text: '💠 VOID SHARD found!', timer: 2 };
                    { const AudioV = State.modules?.Audio; if (AudioV?.voidShardDrop) AudioV.voidShardDrop(); }
                    // Chance for cosmic dust
                    if (a.cosmicDustChance && Math.random() < a.cosmicDustChance) {
                      State.meta.cosmicDust = (State.meta.cosmicDust || 0) + 1;
                      if (State.ui) State.ui.announcement = { text: '✨ COSMIC DUST found!', timer: 2.5 };
                      const AudioC = State.modules?.Audio;
                      if (AudioC?.cosmicDustDrop) AudioC.cosmicDustDrop();
                    }
                    // Also drop some scrap
                    State.pickups.push({
                      type: 'scrap', x: a.x, y: a.y,
                      vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60,
                      life: 15, value: Math.max(3, Math.floor(sMax * sizeFactor))
                    });
                    break;
                  case 'mixed':
                    // Mixed: scrap + cells + chance of item
                    State.pickups.push({
                      type: 'scrap', x: a.x + 10, y: a.y,
                      vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.5) * 80,
                      life: 15, value: Math.floor((sMax + Math.random() * sMax) * mult)
                    });
                    State.pickups.push({
                      type: 'cells', x: a.x - 10, y: a.y,
                      vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.5) * 80,
                      life: 15, value: Math.floor((sMin + Math.random() * sMax * 0.5) * mult)
                    });
                    if (a.itemChance && Math.random() < a.itemChance) {
                      State.pickups.push({
                        type: 'item', x: a.x, y: a.y + 15,
                        vx: (Math.random() - 0.5) * 40, vy: -30 + Math.random() * 20,
                        life: 15, rarity: Math.random() < 0.2 ? 'epic' : 'rare',
                        ilvl: State.run.currentDepth || State.meta.level || 1
                      });
                    }
                    break;
                }
              } else {
                // Standard asteroid: drop scrap (original behavior)
                const acfg = State.data.config?.asteroids || {};
                const sMin = (typeof acfg.scrapMin === 'number') ? acfg.scrapMin : 2;
                const sMax = (typeof acfg.scrapMax === 'number') ? acfg.scrapMax : 6;
                const sizeFactor = Math.max(0.7, Math.min(1.6, (a.radius || 50) / 50));
                const value = Math.floor((sMin + Math.random() * (sMax - sMin + 1)) * sizeFactor);
                State.pickups.push({
                  type: 'scrap',
                  x: a.x, y: a.y,
                  vx: (Math.random() - 0.5) * 60,
                  vy: (Math.random() - 0.5) * 60,
                  life: 12,
                  value: Math.max(1, value)
                });
              }
            }

            // Bullet consumed
            this._removePlayerBulletAt(i);
            hitAsteroid = true;
            break;
          }
        }
        if (hitAsteroid) continue;
      }

      // Check collision with enemies (spatial hash query or fallback)
      const nearbyEnemies = grid
        ? SpatialHash.query(grid, b.x, b.y, queryR)
        : State.enemies;

      // ── Shielder barrier: block player bullets in arc ──
      if (b.isPlayer) {
        let blocked = false;
        for (const e of nearbyEnemies) {
          if (e.dead || !e.abilities || !e.abilities.includes('projectBarrier')) continue;
          if (e._barrierHP <= 0) continue;
          const dx = b.x - e.x;
          const dy = b.y - e.y;
          const dist = Math.hypot(dx, dy);
          if (dist > (e._barrierRadius || 100) || dist < e.size) continue;
          // Check if bullet is within barrier arc
          const bulletAngle = Math.atan2(dy, dx);
          let diff = bulletAngle - (e._barrierAngle || 0);
          diff = ((diff + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          if (Math.abs(diff) < (e._barrierArc || 1.2) / 2) {
            e._barrierHP -= b.damage;
            e._barrierRegenTimer = 0;
            // Deflect spark — via Particles module (pool-safe)
            { const PM = State.modules?.Particles; if (PM) PM.sparks(b.x, b.y, '#33aacc', 3); }
            this._removePlayerBulletAt(i);
            blocked = true;
            break;
          }
        }
        if (blocked) continue;
      }

      for (const e of nearbyEnemies) {
        if (e.dead || e.destroyed !== undefined) continue;
        
        const dist = Math.hypot(b.x - e.x, b.y - e.y);
        if (dist < b.size + e.size) {
          // ═══ v2.16.3: CALCULATE FINAL DAMAGE WITH BUILD MECHANICS ═══
          const p = State.player;
          let finalDmg = b.baseDamage || b.damage;
          const rangeMult = this._getBulletDamageMultiplier(b, canvas);
          if (rangeMult <= 0) {
            this._removePlayerBulletAt(i);
            continue;
          }
          finalDmg *= rangeMult;
          
          // Elite damage bonus
          if (e.isElite && p.eliteDamage) finalDmg *= (1 + p.eliteDamage / 100);
          if (e.isBoss && p.eliteDamage) finalDmg *= (1 + p.eliteDamage / 200); // half effect on bosses
          
          // Low HP bonus (damageAtLowHP)
          if (p.damageAtLowHP && p.hp < p.maxHP * 0.3) finalDmg *= (1 + p.damageAtLowHP / 100);
          
          // Elemental damage adds to base
          const elemDmg = (p.fireDamage || 0) + (p.coldDamage || 0) + (p.lightningDamage || 0) + (p.voidDamage || 0);
          finalDmg += elemDmg;
          
          const killData = Enemies.damage(e, finalDmg, b.isCrit);

          // A51: drone-element status on surviving enemies (bullet-hit path only → no cascade)
          if (!killData && b.element) this._applyDroneElement(e, b.element);

          // Store last attacker ref for thorns
          if (!killData) Player._lastAttacker = e;
          
          // ═══ LIFESTEAL ═══
          if (p.lifesteal && p.lifesteal > 0) {
            const healed = finalDmg * p.lifesteal / 100;
            if (healed > 0.5) {
              p.hp = Math.min(p.maxHP, p.hp + healed);
            }
          }
          
          // ═══ STATUS EFFECTS (on hit) ═══
          const Particles = State.modules?.Particles;
          // Burn
          if (p.burnChance && Math.random() * 100 < p.burnChance && !e.dead) {
            e._burnTimer = Math.min((e._burnTimer || 0) + 2, 6); // max 6s, +2 per hit
            e._burnDPS = Math.max(e._burnDPS || 0, (p.fireDamage || 3) * 0.3);
            if (Particles) Particles.trail(e.x, e.y, '#ff6600', 4);
          }
          // Slow
          if (p.slowChance && Math.random() * 100 < p.slowChance && !e.dead) {
            e._slowTimer = Math.min(Math.max(e._slowTimer || 0, 2), 4); // max 4s
            e._slowFactor = 0.4;
            if (Particles) Particles.sparks(e.x, e.y, '#88ccff', 2);
          }
          // Freeze (full stop) — much rarer
          if (p.freezeChance && Math.random() * 100 < p.freezeChance && !e.dead && !e.isBoss) {
            e._freezeTimer = Math.min(Math.max(e._freezeTimer || 0, 1), 2); // max 2s, bosses immune
            if (Particles) Particles.ring(e.x, e.y, '#66ddff', 15);
          }
          // Shock (damage spread) — only triggers once per enemy
          if (p.shockChance && Math.random() * 100 < p.shockChance && !e.dead && !e._shockCooldown) {
            e._shockCooldown = 1.5; // 1.5s cooldown per enemy
            e._shockTimer = Enemies.STATUS.SHOCK_MARK_DURATION; // A49: conductive window → SHOCK_VULN
            let shockCount = 0;
            for (const ne of State.enemies) {
              if (ne.dead || ne === e || shockCount >= 3) continue;
              if (Math.hypot(ne.x - e.x, ne.y - e.y) < 80) {
                ne._shockTimer = Enemies.STATUS.SHOCK_MARK_DURATION; // chained targets become conductive too
                const shockKill = Enemies.damage(ne, (p.lightningDamage || 3) * 0.3, false);
                if (shockKill) this._resolveCollateralKill(shockKill, { cause: 'shock' });
                if (Particles) Particles.sparks(ne.x, ne.y, '#aa88ff', 2);
                shockCount++;
              }
            }
          }
          // Tick shock cooldown
          if (e._shockCooldown > 0) e._shockCooldown -= 0.016;
          
          // ═══ ZONE MOD: Reflect ═══
          if (e._reflectPct && e._reflectPct > 0) {
            const reflectDmg = b.damage * e._reflectPct;
            if (PlayerMod) PlayerMod.takeDamage(reflectDmg);
          }
          
          // Spawn damage number
          this.spawnDamageNumber(b.x, b.y, Math.round(finalDmg), b.isCrit);

          // ── Feel (A40): micro-hitstop on the hits that matter (A47: cooldown-gated, no force) ──
          // Rapid weapons (plasma/laser) fire many kills/crits per second; forcing past the
          // cooldown chained freezes into stutter/"self-freeze". Gated = one crunch per window.
          const G = window.Game;
          if (G?.requestHitstop) {
            if (killData) G.requestHitstop(2);                // kill pop (gated)
            else if (b.isCrit) G.requestHitstop(3);           // crit pop (gated)
            else if (G.hitstopEveryHit) G.requestHitstop(2);  // optional: all hits (gated)
          }
          if (e.isBoss && Particles && !killData) {
            // Subtle shake while chipping a boss (boss DEATH shake handled in Enemies.kill)
            Particles.screenShake = Math.max(Particles.screenShake || 0, b.isCrit ? 3 : 2);
          }
          
          // Per-weapon impact VFX
          if (Particles) {
            const bType = b.bulletType || 'laser';
            switch (bType) {
              case 'laser':
                Particles.sparks(b.x, b.y, '#00ffff', b.isCrit ? 6 : 3);
                break;
              case 'plasma':
                Particles.sparks(b.x, b.y, '#88ff44', 4);
                Particles.trail(b.x + (Math.random()-0.5)*8, b.y + (Math.random()-0.5)*8, '#aaff66', 3);
                break;
              case 'railgun':
                Particles.sparks(b.x, b.y, '#cc88ff', 5);
                Particles.flash(b.x, b.y, '#ddaaff', 4);
                break;
              case 'missile':
                Particles.explosion(b.x, b.y, '#ff8800', 8, 80);
                Particles.flash(b.x, b.y, '#ffaa00', 6);
                break;
              case 'gatling':
                Particles.sparks(b.x, b.y, '#ffee44', 2);
                break;
              case 'nova':
                Particles.ring(b.x, b.y, '#aa66ff', 20);
                Particles.sparks(b.x, b.y, '#cc88ff', 3);
                break;
              default:
                Particles.sparks(b.x, b.y, '#00ffff', 3);
            }
          }
          // Impact FX: procedural by default (directional), PNG only if enabled
          const SM3 = State.modules?.SpriteManager;
          const ang = Math.atan2(b.vy, b.vx);
          if (Particles?.spriteImpacts && SM3) {
            this._playBulletImpactSprite(b.bulletType, b.x, b.y, Math.max(18, (b.size || 4) * 4), ang);
            if (b.isCrit) SM3.playEffect('hit_spark', b.x, b.y, { size: 20 });
          } else if (Particles) {
            // Directional spark burst back along the hit; crits pop bigger + bright ring
            Particles.impact(b.x, b.y, b.isCrit ? '#ffffff' : (b.color || '#bfe9ff'), ang, b.isCrit ? 1.6 : 1);
            if (b.isCrit) Particles.ring(b.x, b.y, '#ffffff', 16);
          }
          
          // Audio
          if (!killData) {
            const Audio = State.modules?.Audio;
            if (Audio) Audio.hitEnemy();
          }
          
          // ═══ ON KILL: Chain Lightning, AoE on Kill, Scrap on Kill ═══
          if (killData) {
            const p2 = State.player;
            const allowOnKillEffects = b.allowOnKillEffects !== false && b.source !== 'drone';
            
            // Chain Lightning
            if (allowOnKillEffects && p2.chainCount && p2.chainCount > 0) {
              let chains = p2.chainCount;
              let lastX = e.x, lastY = e.y;
              const chained = new Set([e.id]);
              while (chains > 0) {
                let nearest = null, nearDist = 200;
                for (const ne of State.enemies) {
                  if (ne.dead || chained.has(ne.id)) continue;
                  const cd = Math.hypot(ne.x - lastX, ne.y - lastY);
                  if (cd < nearDist) { nearDist = cd; nearest = ne; }
                }
                if (!nearest) break;
                chained.add(nearest.id);
                const chainDmg = (p2.lightningDamage || 5) + finalDmg * 0.2;
                const chainKill = Enemies.damage(nearest, chainDmg, false);
                if (chainKill) this._resolveCollateralKill(chainKill, { cause: 'chain_lightning' });
                if (Particles) {
                  Particles.sparks(nearest.x, nearest.y, '#88aaff', 4);
                  // Draw chain line (as trail particles)
                  for (let t = 0; t < 5; t++) {
                    const lx = lastX + (nearest.x - lastX) * t / 5;
                    const ly = lastY + (nearest.y - lastY) * t / 5;
                    Particles.trail(lx, ly, '#88ccff', 2);
                  }
                }
                lastX = nearest.x;
                lastY = nearest.y;
                chains--;
              }
            }
            
            // AoE on Kill
            if (allowOnKillEffects && p2.aoeOnKill && p2.aoeOnKill > 0) {
              const aoeR = p2.aoeOnKill;
              for (const ne of State.enemies) {
                if (ne.dead || ne === e) continue;
                if (Math.hypot(ne.x - e.x, ne.y - e.y) < aoeR) {
                  const aoeKill = Enemies.damage(ne, finalDmg * 0.3, false);
                  if (aoeKill) this._resolveCollateralKill(aoeKill, { cause: 'aoe_on_kill' });
                }
              }
              if (Particles) {
                Particles.explosion(e.x, e.y, '#ff8844', 10, aoeR);
                Particles.ring(e.x, e.y, '#ffaa44', aoeR * 0.8);
              }
            }
            
            // Scrap on Kill
            if (p2.scrapOnKill) {
              State.run.scrapEarned += p2.scrapOnKill;
            }
            
            this.onEnemyKilled(killData);
          }

          if (b.bulletType === 'missile') {
            this._applyMissileSplash(b.x, b.y, finalDmg, e, b.splashRadius || 40, { source: b.source || 'player', payload: b.payload });
          }
          
          b.hits++;
          if (b.hits > b.pierce) {
            this._removePlayerBulletAt(i);
          }
          break;
        }
      }
    }
    
    // Enemy bullets
    for (let i = State.enemyBullets.length - 1; i >= 0; i--) {
      const b = State.enemyBullets[i];
      const activeZoneKey = this._getZoneKey();
      if (b.ownerZoneKey && b.ownerZoneKey !== activeZoneKey) {
        this._removeEnemyBulletAt(i);
        continue;
      }

      if (b.bulletType === 'missile') this._steerMissile(b, dt);

      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.lifetime = (b.lifetime || 0) + dt;
      b.distanceTraveled = (b.distanceTraveled || 0) + Math.hypot(b.vx * dt, b.vy * dt);
      if ((b.maxLifetime && b.lifetime > b.maxLifetime) || (b.maxRange && b.distanceTraveled > b.maxRange)) {
        this._removeEnemyBulletAt(i);
        continue;
      }

      const zone = State.world?.currentZone;
      if (zone) {
        const margin = 200;
        if (b.y < -margin || b.y > zone.height + margin || b.x < -margin || b.x > zone.width + margin) {
          this._removeEnemyBulletAt(i);
          continue;
        }
      } else {
        if (b.y < -20 || b.y > canvas.height + 20 || b.x < -20 || b.x > canvas.width + 20) {
          this._removeEnemyBulletAt(i);
          continue;
        }
      }
      // Check collision with player
      const p = State.player;
      const dist = Math.hypot(b.x - p.x, b.y - p.y);
      if (dist < b.size + 15) {
        this._playBulletImpactSprite(b.bulletType, b.x, b.y, Math.max(18, (b.size || 6) * 4), Math.atan2(b.vy, b.vx));
        Player.takeDamage(b.damage);
        if (b.dot) Player.applyDot(b.dot);
        this._removeEnemyBulletAt(i);
      }
    }
  },
  
  // Spawn floating damage number
  spawnDamageNumber(x, y, damage, isCrit) {
    const cfg = State.data.config?.effects?.damageNumbers || {};
    
    // Config values with Diablo-style defaults
    const baseSize = cfg.baseSize || 16;
    const critSize = cfg.critSize || 28;
    const normalColor = cfg.normalColor || '#ffffff';
    const critColor = cfg.critColor || '#ffcc00';
    const bigHitColor = cfg.bigHitColor || '#ff6600';
    const floatSpeed = cfg.floatSpeed || 120;
    const duration = cfg.duration || 0.9;
    const spread = cfg.spread || 30;
    
    // Big hit threshold (relative to player damage)
    const bigHitThreshold = State.player.damage * 3;
    const isBigHit = damage >= bigHitThreshold;
    
    let color = normalColor;
    let size = baseSize;
    
    if (isCrit) {
      color = critColor;
      size = critSize;
    }
    if (isBigHit) {
      color = bigHitColor;
      size = critSize + 4;
    }
    
    // v2.16.0: pool-acquire for damage number particle
    if (State.settings?.damageNumbers === false) return;
    const dp = ParticlePool.acquire();
    dp.x = x + (Math.random() - 0.5) * spread;
    dp.y = y;
    dp.vx = (Math.random() - 0.5) * 50;
    dp.vy = -floatSpeed;
    dp.life = duration; dp.maxLife = duration;
    dp.text = Math.round(damage).toString();
    dp.isText = true;
    dp.color = color; dp.size = size;
    dp.isCrit = isCrit;
    dp.scale = isCrit ? 1.5 : 1.0;
    State.particles.push(dp);
  },
  
  // Handle enemy kill rewards
  onEnemyKilled(killData) {
    // A51: frost shatter — a frozen enemy bursts on death. Guarded so the shatter's own
    // collateral kills (marked _collateral) cannot re-trigger it → bounded one layer deep.
    if (killData && killData._wasFrozen && !killData._collateral && !killData._shattered) {
      killData._shattered = true;
      this._spawnShatter(killData.x, killData.y, killData);
    }

    // Kill streak system
    const streak = State.run.streak;
    if (streak) {
      streak.count++;
      streak.timer = 0;
      streak.best = Math.max(streak.best, streak.count);
      streak.xpMult = Math.min(3.0, 1 + (streak.count - 1) * 0.1);
      streak.lootMult = Math.min(2.0, 1 + (streak.count - 1) * 0.05);

      // A54: escalating streak announcer (recorded voice callouts)
      const _ann = State.modules?.Audio;
      if (_ann?.announce) {
        const c = streak.count;
        const tier = c === 3 ? 'doubleKill' : c === 5 ? 'tripleKill' : c === 8 ? 'multiKill'
          : c === 12 ? 'megaKill' : c === 16 ? 'killingSpree' : c === 20 ? 'ultraKill'
          : c === 25 ? 'rampage' : c === 30 ? 'unstoppable' : c === 40 ? 'massacre' : null;
        if (tier) _ann.announce(tier);
      }

      const AudioS = State.modules?.Audio;
      const Particles = State.modules?.Particles;
      if (streak.count === 5 || streak.count === 10 || streak.count === 15 || streak.count === 20) {
        if (AudioS?.comboUp) AudioS.comboUp(streak.count);
        if (Particles) {
          Particles.ring(State.player.x, State.player.y, '#ffcc00', 60 + streak.count * 3);
          Particles.flash(State.player.x, State.player.y, '#ffcc00', 8);
        }
        if (State.ui) {
          const mult = streak.xpMult.toFixed(1);
          State.ui.announcement = { text: `${streak.count}x STREAK! (${mult}x XP)`, timer: 1.5 };
        }
      }
    }

    // Reward resolution (economy / loot delegated)
    const streakXP = streak?.xpMult || 1;
    const streakLoot = streak?.lootMult || 1;
    const Rewards = State.modules?.Rewards;

    if (Rewards?.applyEnemyKill) {
      Rewards.applyEnemyKill(killData, {
        streakXP,
        streakLoot,
        rollLoot: (diffMods, streakLootMult) => this.checkLootDrop(killData, diffMods, streakLootMult)
      });
    } else {
      console.warn('[REWARDS] module missing during enemy kill resolution');
      State.pushDebugTrace?.('loot', 'reward_module_missing', {
        enemyId: killData.id || null,
        stage: 'enemy_kill'
      });
    }

    // Zone mod: Volatile (enemy explodes on death)
    if (killData._volatile) {
      const Particles = State.modules?.Particles;
      if (Particles) {
        Particles.spawn(killData.x, killData.y, 'explosion');
      }
      for (const en of State.enemies) {
        if (en.dead || en.id === killData.id) continue;
        const d = Math.hypot(en.x - killData.x, en.y - killData.y);
        if (d < 80) {
          const { Enemies } = State.modules || {};
          if (Enemies) {
            const volatileKill = Enemies.damage(en, killData.damage * 0.3, false);
            if (volatileKill) this._resolveCollateralKill(volatileKill, { cause: 'volatile' });
          }
        }
      }
      const pd = Math.hypot(State.player.x - killData.x, State.player.y - killData.y);
      if (pd < 60) {
        const PlayerMod = State.modules?.Player;
        if (PlayerMod) PlayerMod.takeDamage(killData.damage * 0.4);
      }
    }

    // Zone objective progress
    const obj = State.run.objective;
    if (obj && !obj.complete) {
      if (obj.type === 'exterminate') {
        obj.progress++;
        if (obj.progress >= obj.target) {
          obj.complete = true;
          this._announceObjectiveComplete();
        }
      } else if (obj.type === 'lockdown' && killData.isGenerator) {
        obj.progress++;
        if (obj.progress >= obj.target) {
          obj.complete = true;
          this._announceObjectiveComplete();
        }
      }
    }
  },

  _announceObjectiveComplete() {
    const Particles = State.modules?.Particles;
    const Audio = State.modules?.Audio;
    const p = State.player;
    if (Particles) {
      Particles.text(p.x, p.y - 40, '✓ OBJECTIVE COMPLETE — EXIT OPEN', '#00ff88', 18);
      Particles.ring(p.x, p.y, '#00ff88', 80);
    }
    if (Audio?.levelUp) Audio.levelUp();
    if (State.ui) State.ui.announcement = { text: '✓ OBJECTIVE COMPLETE', timer: 2.5 };
  },
  
  // Check for item drop (with pity + anti-exploit integration)
  checkLootDrop(killData, diffMods = {}, streakLootMult = 1) {
    const directorMods = State.modules?.Director?.getModifiers?.() || { lootDropMult: 1 };
    const cfg = State.data.config?.loot;
    if (!cfg) return;

    const depth = State.run.currentDepth || 1;
    const depthCfg = cfg.depthScaling || {};
    const explosionCfg = cfg.lootExplosion || {};

    // === BASE DROP CHANCE (depth-scaled) ===
    let dropChance = cfg.baseDropChance || 0.05;
    if (killData.isElite) dropChance = cfg.eliteDropChance || 0.3;
    if (killData.isBoss) dropChance = cfg.bossDropChance || 1.0;

    // Depth scaling: deeper zones = slightly higher base drop chance
    if (depthCfg.enabled && !killData.isBoss) {
      const depthBonus = Math.min(
        depthCfg.dropChanceCap || 0.18,
        (depth - 1) * (depthCfg.dropChancePerDepth || 0.0003)
      );
      dropChance += depthBonus;
    }

    // Apply luck
    dropChance *= (1 + (State.player.luck || 0) * 0.02);
    
    // Apply streak loot multiplier to drop chance
    dropChance *= streakLootMult;
    dropChance *= (directorMods.lootDropMult || 1);
    
    // Apply route loot multiplier (from branch exit choice)
    const World = State.modules?.World;
    const zoneLootMult = World?.currentZone?._lootMult || 1.0;
    dropChance *= zoneLootMult;
    
    // Apply tier loot bonus (from acts.json per-tier config)
    const tierLootBonus = World?.currentAct?.lootBonus || 1.0;
    dropChance *= tierLootBonus;
    
    // ═══ v2.13.0: Zone mod loot bonus ═══
    const { DepthRules: DRRef } = State.modules || {};
    if (DRRef) {
      const modLoot = DRRef.getLootBonus(State.world?.currentZone?.mods || []);
      dropChance *= (1 + modLoot);
    }
    
    // ═══ v2.13.0: Corruption loot bonus ═══
    const corruption = State.run.corruption || 0;
    if (corruption > 0 && DRRef) {
      const cMults = DRRef.getCorruptionMults(corruption);
      dropChance *= (1 + cMults.dropBonus);
    }

    // Anti-exploit: seed farming nerf (if module loaded)
    if (State.meta.antiExploit) {
      const currentSeed = State.run.currentSeed;
      if (currentSeed) {
        const hist = State.meta.antiExploit.seedHistory || [];
        const maxReuse = State.data.config?.antiExploit?.maxSeedReuse || 3;
        const reuseCount = hist.filter(s => s.seed === currentSeed).length;
        if (reuseCount > maxReuse) {
          dropChance *= Math.max(0.1, 1 / reuseCount);
        }
      }
    }

    // Pity: increment kill counter even if no drop
    if (State.meta.pity) {
      State.meta.pity.killsSinceRare++;
      State.meta.pity.killsSinceLegendary++;
      State.meta.pity.killsSinceUnique++;
    }

    // === LOOT EXPLOSION: calculate number of drops ===
    let numDrops = 0;

    if (killData.isBoss && explosionCfg.enabled) {
      // Boss: guaranteed base drops + chance for extras
      numDrops = explosionCfg.bossBaseDrops || 2;
      const maxExtra = (explosionCfg.bossMaxDrops || 5) - numDrops;
      const extraChance = (explosionCfg.bossExtraDropChance || 0.35)
        + (Math.floor(depth / 100) * (explosionCfg.depthBonusDropPer100 || 0.10));
      for (let e = 0; e < maxExtra; e++) {
        if (Math.random() < Math.min(0.85, extraChance)) numDrops++;
      }
    } else if (killData.isElite && explosionCfg.enabled) {
      // Elite: 1 guaranteed if drop check passes, + chance for extra
      if (Math.random() < dropChance) {
        numDrops = explosionCfg.eliteBaseDrops || 1;
        if (Math.random() < (explosionCfg.eliteExtraDropChance || 0.20)) numDrops++;
      }
    } else {
      // Normal enemy: single drop check
      numDrops = (Math.random() < dropChance) ? 1 : 0;
    }

    // === SPAWN DROPS ===
    const Items = State.modules?.Items;
    if (numDrops > 0 || killData.isElite || killData.isBoss) {
      State.pushDebugTrace?.('loot', 'drop_roll', {
        enemyTier: killData.isBoss ? 'boss' : (killData.isElite ? 'elite' : 'normal'),
        enemyId: killData.id || null,
        chance: Math.round(dropChance * 10000) / 10000,
        numDrops,
        depth,
        difficulty: State.run.difficulty || 'normal',
        streakLootMult: Math.round((streakLootMult || 1) * 100) / 100,
        directorLootMult: Math.round((directorMods.lootDropMult || 1) * 100) / 100,
        zoneLootMult: Math.round((zoneLootMult || 1) * 100) / 100,
        tierLootBonus: Math.round((tierLootBonus || 1) * 100) / 100
      });
    }
    for (let d = 0; d < numDrops; d++) {
      const ilvl = depth || State.meta.level || 1;

      // Smart loot: bias slot toward player needs
      let smartSlot = null;
      if (Items?.getSmartLootSlot) {
        smartSlot = Items.getSmartLootSlot();
      }

      let preRolledRarity = null;
      if (killData.isBoss) {
        // Boss: first drop always legendary, rest can vary
        if (d === 0) {
          preRolledRarity = 'legendary';
        } else {
          const roll = Math.random();
          if (roll < 0.15) preRolledRarity = 'legendary';
          else if (roll < 0.45) preRolledRarity = 'epic';
          else preRolledRarity = 'rare';
        }
      } else if (killData.isElite) {
        const roll = Math.random();
        if (roll < 0.05) preRolledRarity = 'legendary';
        else if (roll < 0.20) preRolledRarity = 'epic';
        else preRolledRarity = 'rare';
      } else {
        const roll = Math.random();
        if (roll < 0.005) preRolledRarity = 'legendary';
        else if (roll < 0.03) preRolledRarity = 'epic';
        else if (roll < 0.12) preRolledRarity = 'rare';
        else if (roll < 0.35) preRolledRarity = 'uncommon';
        else preRolledRarity = 'common';
      }
      try { State.modules?.Director?.onItemDropped?.(); } catch (e) { /* safe */ }

      // Pity override
      if (State.meta.pity) {
        if (State.meta.pity.killsSinceLegendary >= 200) preRolledRarity = 'legendary';
        else if (State.meta.pity.killsSinceRare >= 40 && preRolledRarity === 'common') preRolledRarity = 'rare';
      }
      
      // ═══ DIFFICULTY RARITY BOOST ═══
      const rarityBoost = diffMods.lootRarityBoost || 0;
      if (rarityBoost > 0) {
        const rarityLadder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
        let idx = rarityLadder.indexOf(preRolledRarity);
        if (idx >= 0) {
          idx = Math.min(rarityLadder.length - 1, idx + rarityBoost);
          preRolledRarity = rarityLadder[idx];
        }
      }
      
      // ═══ LEGENDARY CAP: non-boss legendary drops downgraded 70% to epic ═══
      if (preRolledRarity === 'legendary' && !killData.isBoss) {
        if (Math.random() < 0.70) {
          preRolledRarity = 'epic';
        }
      }
      
      // ═══ VAULT ROUTE: minimum rare floor ═══
      if (World?.currentZone?._isVault) {
        const rarityLadder2 = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
        const curIdx = rarityLadder2.indexOf(preRolledRarity);
        const rareIdx = rarityLadder2.indexOf('rare');
        if (curIdx < rareIdx) preRolledRarity = 'rare';
      }
      
      // Spread drops in a fan for loot explosion visual
      const spreadAngle = numDrops > 1 ? (d / (numDrops - 1) - 0.5) * 1.2 : 0;
      const spreadSpeed = 40 + d * 15;
      const pickupId = `loot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}_${d}`;

      State.pickups.push({
        type: 'item',
        x: killData.x,
        y: killData.y,
        vx: Math.sin(spreadAngle) * spreadSpeed + (Math.random() - 0.5) * 20,
        vy: -50 + Math.random() * 30 - d * 10,
        life: 10,
        rarity: preRolledRarity,
        rarityFloor: killData.isElite ? 'rare' : null,
        ilvl: ilvl,
        fromBoss: killData.isBoss || false,
        bossType: killData.bossType || null,
        smartSlot: smartSlot,
        debugId: pickupId
      });
      State.pushDebugTrace?.('loot', 'pickup_spawned', {
        pickupId,
        rarity: preRolledRarity,
        ilvl,
        smartSlot: smartSlot || null,
        fromBoss: killData.isBoss || false,
        enemyTier: killData.isBoss ? 'boss' : (killData.isElite ? 'elite' : 'normal')
      });
    }
    
    // Always drop cells pickup
    const cellValue = killData.isBoss ? 50 : (killData.isElite ? 20 : 5);
    State.pickups.push({
      type: 'cells',
      x: killData.x + (Math.random() - 0.5) * 20,
      y: killData.y,
      vx: (Math.random() - 0.5) * 40,
      vy: -30 + Math.random() * 20,
      value: Math.floor(cellValue * (diffMods.cellsMult || 1)),
      life: 8
    });
    
    // Chance for scrap pickup
    if (Math.random() < 0.3 || killData.isElite || killData.isBoss) {
      const scrapValue = killData.isBoss ? 100 : (killData.isElite ? 30 : 10);
      State.pickups.push({
        type: 'scrap',
        x: killData.x + (Math.random() - 0.5) * 20,
        y: killData.y,
        vx: (Math.random() - 0.5) * 40,
        vy: -30 + Math.random() * 20,
        value: Math.floor(scrapValue * (diffMods.scrapMult || 1)),
        life: 10
      });
    }
    
    // Coolant drop: 5% from normal, 15% from elite, 100% from boss
    const coolantChance = killData.isBoss ? 1.0 : (killData.isElite ? 0.15 : 0.05);
    if (Math.random() < coolantChance) {
      State.pickups.push({
        type: 'coolant',
        x: killData.x + (Math.random() - 0.5) * 30,
        y: killData.y,
        vx: (Math.random() - 0.5) * 50,
        vy: -40 + Math.random() * 20,
        life: 12
      });
    }
    
    // Chaos: bonus rare material drops from elites/bosses
    const diff = State.run.difficulty || 'normal';
    const AudioDrop = State.modules?.Audio;
    if (diff === 'chaos') {
      if (killData.isElite && Math.random() < 0.12) {
        State.meta.voidShards = (State.meta.voidShards || 0) + 1;
        if (State.ui) State.ui.announcement = { text: '💠 VOID SHARD from corrupted elite!', timer: 2 };
        if (AudioDrop?.voidShardDrop) AudioDrop.voidShardDrop();
      }
      if (killData.isBoss) {
        const shards = 1 + Math.floor(Math.random() * 3);
        State.meta.voidShards = (State.meta.voidShards || 0) + shards;
        if (Math.random() < 0.25) {
          State.meta.cosmicDust = (State.meta.cosmicDust || 0) + 1;
          if (State.ui) State.ui.announcement = { text: '✨ COSMIC DUST from corrupted boss!', timer: 2.5 };
          if (AudioDrop?.cosmicDustDrop) AudioDrop.cosmicDustDrop();
        }
      }
    } else if (diff === 'risk') {
      if (killData.isBoss && Math.random() < 0.3) {
        State.meta.voidShards = (State.meta.voidShards || 0) + 1;
        if (State.ui) State.ui.announcement = { text: '💠 VOID SHARD bonus!', timer: 2 };
        if (AudioDrop?.voidShardDrop) AudioDrop.voidShardDrop();
      }
    }
  },
  
  // Draw all bullets
  draw(ctx) {
    const t = performance.now() * 0.001;

    // === PLAYER BULLETS (type-specific) ===
    for (const b of State.bullets) {
      const type = b.bulletType || 'laser';
      const s = b.size;
      const ang = Math.atan2(b.vy, b.vx);

      // ═══ v2.15.0: Sprite draw hook ═══
      const SM = State.modules?.SpriteManager;
      const spriteType = this._resolveBulletSpriteType(type);
      if (State.modules?.Particles?.spriteBullets && SM && spriteType && SM.getStateDef?.('bullets', spriteType, 'travel')) {
        const rp = this._getBulletRenderProfile(type, false);
        const drawSize = Math.max(rp.min, s * rp.scale);
        SM.play(b, 'bullets', spriteType, 'travel', { force: false });
        if (SM.drawAnimated(ctx, b, b.x, b.y, ang, drawSize, { alpha: 1 })) continue;
      }

      ctx.save();

      switch (type) {
        case 'laser': {
          // Fast red lance: bright white-hot core with red shell and soft outer glow.
          const trailLen = Math.max(16, (State.player?.radius || 18) * 1.8);
          const outer = ctx.createLinearGradient(
            b.x - Math.cos(ang) * trailLen * 1.25, b.y - Math.sin(ang) * trailLen * 1.25,
            b.x + Math.cos(ang) * 2, b.y + Math.sin(ang) * 2
          );
          outer.addColorStop(0, 'rgba(255,40,20,0)');
          outer.addColorStop(1, 'rgba(255,70,35,0.32)');
          ctx.strokeStyle = outer;
          ctx.lineWidth = Math.max(4, s * 3.4);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(b.x - Math.cos(ang) * trailLen * 1.25, b.y - Math.sin(ang) * trailLen * 1.25);
          ctx.lineTo(b.x + Math.cos(ang) * 2, b.y + Math.sin(ang) * 2);
          ctx.stroke();

          const shell = ctx.createLinearGradient(
            b.x - Math.cos(ang) * trailLen, b.y - Math.sin(ang) * trailLen,
            b.x + Math.cos(ang) * 3, b.y + Math.sin(ang) * 3
          );
          shell.addColorStop(0, 'rgba(255,120,80,0)');
          shell.addColorStop(1, 'rgba(255,70,40,0.9)');
          ctx.strokeStyle = shell;
          ctx.lineWidth = Math.max(2.5, s * 1.9);
          ctx.beginPath();
          ctx.moveTo(b.x - Math.cos(ang) * trailLen, b.y - Math.sin(ang) * trailLen);
          ctx.lineTo(b.x + Math.cos(ang) * 3, b.y + Math.sin(ang) * 3);
          ctx.stroke();

          ctx.strokeStyle = '#fff6f0';
          ctx.lineWidth = Math.max(1.1, s * 0.75);
          ctx.shadowColor = '#ff4020';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.moveTo(b.x - Math.cos(ang) * (trailLen * 0.82), b.y - Math.sin(ang) * (trailLen * 0.82));
          ctx.lineTo(b.x + Math.cos(ang) * 4, b.y + Math.sin(ang) * 4);
          ctx.stroke();
          break;
        }
        case 'plasma': {
          // Wobbly green-yellow plasma blob with dripping trail
          const wobble = Math.sin(t * 20 + b.x * 0.1) * 2;
          // Glow trail behind
          const pTrail = 16;
          ctx.globalAlpha = 0.3;
          const pg = ctx.createLinearGradient(
            b.x - Math.cos(ang) * pTrail, b.y - Math.sin(ang) * pTrail, b.x, b.y
          );
          pg.addColorStop(0, 'rgba(100,255,0,0)');
          pg.addColorStop(1, 'rgba(136,255,68,0.5)');
          ctx.fillStyle = pg;
          ctx.beginPath();
          ctx.moveTo(b.x - Math.cos(ang) * pTrail + wobble, b.y - Math.sin(ang) * pTrail);
          ctx.quadraticCurveTo(b.x + wobble * 2, b.y - s * 2, b.x + s, b.y);
          ctx.quadraticCurveTo(b.x + wobble * 2, b.y + s * 2, b.x - Math.cos(ang) * pTrail - wobble, b.y - Math.sin(ang) * pTrail);
          ctx.fill();
          ctx.globalAlpha = 1;
          // Main blob
          ctx.fillStyle = '#88ff44';
          ctx.shadowColor = '#88ff00';
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.arc(b.x + wobble * 0.3, b.y, s, 0, Math.PI * 2);
          ctx.fill();
          // Inner bright core
          ctx.fillStyle = '#eeffaa';
          ctx.beginPath();
          ctx.arc(b.x, b.y, s * 0.4, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'railgun': {
          // Thin bright line + extended trail + sparks
          const trailLen = 40;
          // Wide subtle glow
          ctx.strokeStyle = 'rgba(200,140,255,0.12)';
          ctx.lineWidth = 8;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(b.x - Math.cos(ang) * trailLen, b.y - Math.sin(ang) * trailLen);
          ctx.lineTo(b.x + Math.cos(ang) * 3, b.y + Math.sin(ang) * 3);
          ctx.stroke();
          // Core beam
          ctx.strokeStyle = '#ffddff';
          ctx.shadowColor = '#cc88ff';
          ctx.shadowBlur = 8;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(b.x - Math.cos(ang) * trailLen, b.y - Math.sin(ang) * trailLen);
          ctx.lineTo(b.x + Math.cos(ang) * 3, b.y + Math.sin(ang) * 3);
          ctx.stroke();
          // Tip flash
          ctx.fillStyle = '#ffffff';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'missile': {
          // Small triangle + orange exhaust
          ctx.translate(b.x, b.y);
          ctx.rotate(ang + Math.PI / 2);
          // Exhaust
          ctx.fillStyle = 'rgba(255,150,0,0.6)';
          ctx.beginPath();
          ctx.moveTo(-2, 4); ctx.lineTo(0, 10 + Math.random() * 4); ctx.lineTo(2, 4);
          ctx.fill();
          // Body
          ctx.fillStyle = '#ffaa33';
          ctx.shadowColor = '#ff6600';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.moveTo(0, -s * 1.5); ctx.lineTo(-s * 0.7, s); ctx.lineTo(s * 0.7, s);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'gatling': {
          // Small fast yellow dots with speed trail
          const gTrail = 8;
          ctx.strokeStyle = 'rgba(255,238,68,0.3)';
          ctx.lineWidth = s * 1.2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(b.x - Math.cos(ang) * gTrail, b.y - Math.sin(ang) * gTrail);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          ctx.fillStyle = '#ffee44';
          ctx.shadowColor = '#ffcc00';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(b.x, b.y, s * 0.7, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'nova': {
          // Pulsing energy sphere
          const pulse = 0.8 + Math.sin(t * 15 + b.x) * 0.3;
          ctx.fillStyle = `rgba(180,100,255,${0.7 * pulse})`;
          ctx.shadowColor = '#aa66ff';
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.arc(b.x, b.y, s * pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#eeddff';
          ctx.beginPath();
          ctx.arc(b.x, b.y, s * 0.3, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        default: {
          // Fallback circle
          ctx.fillStyle = '#00ffff';
          ctx.shadowColor = '#00ffff';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(b.x, b.y, s, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Crit sparkle
      if (b.isCrit) {
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.5 + Math.sin(t * 30) * 0.3;
        ctx.beginPath();
        ctx.arc(b.x + (Math.random() - 0.5) * 4, b.y + (Math.random() - 0.5) * 4, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // === ENEMY BULLETS ===
    for (const b of State.enemyBullets) {
      const s = b.size;
      const ang = Math.atan2(b.vy, b.vx);
      const SM = State.modules?.SpriteManager;
      const spriteType = this._resolveBulletSpriteType(b.bulletType || 'enemy');
      if (State.modules?.Particles?.spriteBullets && SM && spriteType && SM.getStateDef?.('bullets', spriteType, 'travel')) {
        const rp = this._getBulletRenderProfile(b.bulletType || 'enemy', true);
        const drawSize = Math.max(rp.min, s * rp.scale);
        SM.play(b, 'bullets', spriteType, 'travel', { force: false });
        if (SM.drawAnimated(ctx, b, b.x, b.y, ang, drawSize, { alpha: 1 })) continue;
      }
      ctx.save();

      // Red-orange energy bolt
      const trailLen = 8;

      // Trail
      ctx.globalAlpha = 0.4;
      const g = ctx.createLinearGradient(
        b.x - Math.cos(ang) * trailLen, b.y - Math.sin(ang) * trailLen,
        b.x, b.y
      );
      g.addColorStop(0, 'rgba(255,50,0,0)');
      g.addColorStop(1, 'rgba(255,80,20,0.7)');
      ctx.strokeStyle = g;
      ctx.lineWidth = s;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(b.x - Math.cos(ang) * trailLen, b.y - Math.sin(ang) * trailLen);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Core
      ctx.fillStyle = '#ff4444';
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(b.x, b.y, s * 0.7, 0, Math.PI * 2);
      ctx.fill();

      // Hot center
      ctx.fillStyle = '#ffaa66';
      ctx.beginPath();
      ctx.arc(b.x, b.y, s * 0.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }
};

export default Bullets;
