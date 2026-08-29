// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// ENEMIES.js - Enemy System
// ============================================================

import { State } from './State.js';


export const Enemies = {
  // Spawn an enemy
  spawn(type, x, y, isElite = false, isBoss = false) {
    const enemyData = this.getEnemyData(type);
    if (!enemyData) {
      // Default fallback
      const enemy = this.createDefault(x, y, isElite, isBoss);
      State.enemies.push(enemy);
      return enemy;
    }
    
    const waveScale = this.getWaveScale();
    const cfg = State.data.config?.waves || {};
    const eliteMult = cfg.eliteHPMult || 2.5;
    const bossMult = cfg.bossHPMult || 8;
    
    // Exploration tuning (slower fire, smaller aggro, etc.) is driven by config.json
    const tune = State.data.config?.exploration || {};
    const fireMult = (typeof tune.enemyFireIntervalMult === 'number') ? tune.enemyFireIntervalMult : 1.0;

    const baseInterval = enemyData.shootInterval || (isBoss ? 0.6 : (isElite ? 1.2 : 2.5));
    const shootInterval = Math.max(0.35, baseInterval * fireMult);

    const enemy = {
      id: 'e_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type: type,
      x: x,
      y: y,
      vx: 0,
      vy: 0,
      hp: enemyData.hp * waveScale * (isElite ? eliteMult : 1) * (isBoss ? bossMult : 1),
      maxHP: enemyData.hp * waveScale * (isElite ? eliteMult : 1) * (isBoss ? bossMult : 1),
      damage: enemyData.damage * waveScale,
      speed: enemyData.speed,
      score: enemyData.score * (isElite ? 3 : 1) * (isBoss ? 10 : 1),
      xp: enemyData.xp * (isElite ? 2 : 1) * (isBoss ? 5 : 1),
      color: isElite ? '#ffaa00' : (isBoss ? '#ff3355' : enemyData.color),
      size: (isBoss ? 50 : (isElite ? 30 : 22)),
      isElite: isElite,
      isBoss: isBoss,
      pattern: enemyData.pattern,
      abilities: Array.isArray(enemyData.abilities) ? enemyData.abilities.slice() : [],
      patternTime: 0,
      shootTimer: shootInterval * (0.5 + Math.random() * 0.8),
      shootInterval: shootInterval,
      dead: false
    };


    // Ability-specific state (semantic sprite wiring only — no hardcoded PNG paths)
    enemy.spriteCategory = isBoss ? 'bosses' : (isElite ? 'elites' : 'enemies');
    enemy.spriteId = type;
    enemy.animState = 'patrol';

    if (enemy.abilities.includes('aimShot')) {
      enemy.aim = {
        state: 'cooldown',
        t: 0,
        windup: 0.9,
        pulseWindow: 0.18,
        lastAngle: 0
      };
    }

    if (enemy.abilities.includes('corruptDot')) {
      enemy.dot = (enemyData && enemyData.dot) ? enemyData.dot : { duration: 4.0, tick: 0.5, dpsPctMaxHp: 0.01 };
    }

    if (enemy.abilities.includes('repairTether')) {
      // Support drone: seeks an ally and repairs it while staying near (tether heal)
      const r = (enemyData && enemyData.repair) ? enemyData.repair : {};
      enemy.repair = {
        range: (typeof r.range === 'number') ? r.range : 260,
        healPctMaxHpPerSec: (typeof r.healPctMaxHpPerSec === 'number') ? r.healPctMaxHpPerSec : 0.03,
        capPctMaxHpPerSec: (typeof r.capPctMaxHpPerSec === 'number') ? r.capPctMaxHpPerSec : 0.04
      };
      enemy.tether = { targetId: null };
      enemy.orbit = { t: 0, radius: 90 };
    }

// ── New enemy ability states ──

if (enemy.abilities.includes('layMines')) {
  enemy._mineTimer = enemyData.mineInterval || 2.5;
  enemy._mineCount = enemyData.mineCount || 1;
  enemy._mineDamage = enemyData.mineDamage || 12;
  enemy._mineLife = enemyData.mineLife || 15;
}

if (enemy.abilities.includes('cloak')) {
  enemy._cloaked = true;
  enemy._cloakAlpha = enemyData.cloakAlpha || 0.08;
  enemy._cloakRange = enemyData.cloakRange || 250;
  enemy._uncloakRange = enemyData.uncloakRange || 120;
}

if (enemy.abilities.includes('summon')) {
  enemy._summonTimer = enemyData.summonInterval || 6;
  enemy._summonType = enemyData.summonType || 'grunt';
  enemy._summonMax = enemyData.summonMax || 3;
  enemy._summonCount = 0;
  enemy._summonIds = [];
}

if (enemy.abilities.includes('stationary')) {
  enemy.speed = 0;
  enemy._burstCount = enemyData.burstCount || 3;
  enemy._burstDelay = enemyData.burstDelay || 0.15;
  enemy._burstRemaining = 0;
  enemy._burstTimer = 0;
}

if (enemy.abilities.includes('projectBarrier')) {
  enemy._barrierRadius = enemyData.barrierRadius || 100;
  enemy._barrierArc = enemyData.barrierArc || 1.2;
  enemy._barrierHP = enemyData.barrierHP || 40;
  enemy._barrierMaxHP = enemy._barrierHP;
  enemy._barrierAngle = 0;
  enemy._barrierRegenTimer = 0;
}
State.enemies.push(enemy);
    return enemy;
  },
  
  // Create default enemy when data not found
  createDefault(x, y, isElite, isBoss) {
    return {
      id: 'e_' + Date.now(),
      type: 'default',
      x, y, vx: 0, vy: 0,
      hp: isBoss ? 200 : (isElite ? 60 : 20),
      maxHP: isBoss ? 200 : (isElite ? 60 : 20),
      damage: 10,
      speed: 80,
      score: 10,
      xp: 10,
      color: isBoss ? '#ff3355' : (isElite ? '#ffaa00' : '#44aa44'),
      size: isBoss ? 50 : (isElite ? 30 : 22),
      isElite, isBoss,
      pattern: 'straight',
      patternTime: 0,
      shootTimer: 3,
      shootInterval: 3,
      dead: false
    };
  },
  
  // Get enemy data from JSON
  getEnemyData(type) {
    const enemies = State.data.enemies;
    if (!enemies) return null;
    
    for (const category of ['basic', 'elite', 'bosses']) {
      if (enemies[category] && enemies[category][type]) {
        return enemies[category][type];
      }
    }
    return null;
  },
  
  // Calculate wave scaling factor (config-driven)
  getWaveScale() {
    // v2.16.3: Use zone depth for exploration scaling
    const depth = State.run.currentDepth || State.run.wave || 1;
    
    // Hybrid scaling: linear base + soft exponential boost
    // Zone 1: 1.0×, Zone 10: ~2.0×, Zone 50: ~6.5×, Zone 100: ~13×, Zone 300: ~42×
    const linear = 1 + (depth - 1) * 0.08;
    const expo = Math.pow(1.008, depth - 1); // very gentle exponential
    return linear * expo;
  },
  
  // Spawn a wave
  spawnWave(wave, canvasWidth) {
    const w = canvasWidth || 800;
    const isBossWave = wave % 20 === 0;
    
    if (isBossWave) {
      this.spawn('sentinel', w / 2, -60, false, true);
      return;
    }
    
    // Get enemy pool for this wave
    const pool = this.getEnemyPool(wave);
    const count = 5 + Math.floor(wave * 0.8);
    const eliteChance = Math.min(0.25, wave * 0.01);
    
    for (let i = 0; i < count; i++) {
      const type = pool[Math.floor(Math.random() * pool.length)];
      const isElite = Math.random() < eliteChance;
      const x = 50 + Math.random() * (w - 100);
      const y = -30 - i * 40 - Math.random() * 30;
      this.spawn(type, x, y, isElite, false);
    }
  },
  
  // Get enemy pool for wave (data-driven from enemies.json waveCompositions)
  getEnemyPool(wave) {
    const comps = State.data.enemies?.waveCompositions;
    if (!comps) return ['grunt'];

    // Find matching composition for this wave number
    let best = null;
    let bestStart = 0;
    for (const [range, comp] of Object.entries(comps)) {
      const match = range.match(/^(\d+)/);
      if (!match) continue;
      const start = parseInt(match[1], 10);
      if (wave >= start && start >= bestStart) {
        best = comp;
        bestStart = start;
      }
    }
    return best?.pool || ['grunt'];
  },
  
  // Update all enemies
  update(dt, canvas) {
    const zone = State.world?.currentZone;
    const inWorld = !!zone;

    // Per-frame heal budgets (prevents stacking exploits)
    const healBudget = Object.create(null);
    this._healBudget = healBudget;

    for (const e of State.enemies) {
      if (e.dead) continue;

      if (inWorld) {
        this.updateExplorationAI(e, dt, zone);

        // Integrate velocity in world coords
        e.x += e.vx * dt;
        e.y += e.vy * dt;

        // Clamp to zone bounds (prevents runaway drift)
        const margin = Math.max(30, e.size * 1.2);
        e.x = Math.max(margin, Math.min(zone.width - margin, e.x));
        e.y = Math.max(margin, Math.min(zone.height - margin, e.y));

        // Combat behavior (aggro only)
        this.updateExplorationShooting(e, dt);
        
        // ═══ ZONE MOD: Regen (1% HP/sec) ═══
        if (e._regenRate && e.hp < e.maxHP) {
          e.hp = Math.min(e.maxHP, e.hp + e._regenRate * dt);
        }
        
        // ═══ ZONE MOD: Cloaked (fade until aggro) ═══
        if (e._cloaked) {
          e._cloakAlpha = (e.aiState === 'chase' || e.aiState === 'attack') ? 1.0 : 0.15;
        }
        
        // ═══ v2.16.3: STATUS EFFECT TICKING ═══
        // Burn DOT
        if (e._burnTimer > 0) {
          e._burnTimer -= dt;
          const burnDmg = (e._burnDPS || 2) * dt * this.vulnMult(e); // A49: brittle/shocked burn harder (capped)
          e.hp -= burnDmg;
          // Burn visual (every ~0.5s)
          if (Math.random() < dt * 2) {
            const PM = State.modules?.Particles;
            if (PM) PM.trail(e.x + (Math.random()-0.5)*10, e.y + (Math.random()-0.5)*10, '#ff6600', 2);
          }
          if (e.hp <= 0 && !e.dead) {
            e.dead = true;
            // DOT kills: basic XP + scrap only, no chain/AoE (prevents cascade)
            if (State.run?.stats) State.run.stats.kills++;
            const PM = State.modules?.Particles;
            if (PM) PM.explosion(e.x, e.y, '#ff6600', 6, 40);
          }
        }
        // Slow (applied to speed)
        if (e._slowTimer > 0) {
          e._slowTimer -= dt;
          e._currentSpeedMult = e._slowFactor || 0.4;
        } else if (!e._freezeTimer || e._freezeTimer <= 0) {
          e._currentSpeedMult = 1;
        }
        // Freeze (full stop)
        if (e._freezeTimer > 0) {
          e._freezeTimer -= dt;
          e.vx = 0; e.vy = 0;
          e._currentSpeedMult = 0;
          // Freeze visual
          if (Math.random() < dt) {
            const PM = State.modules?.Particles;
            if (PM) PM.sparks(e.x, e.y, '#88ddff', 2);
          }
        }
        // A49: shock conductive window (drives SHOCK_VULN, decays here)
        if (e._shockTimer > 0) e._shockTimer -= dt;
        // A50: cluster gravity pull (positioning only — overrides AI movement briefly)
        if (e._pullTimer > 0) {
          e._pullTimer -= dt;
          e._currentSpeedMult = 0; // suppress AI-driven movement so the pull dominates
          const dx = (e._pullX ?? e.x) - e.x, dy = (e._pullY ?? e.y) - e.y;
          const dist = Math.hypot(dx, dy) || 1;
          const step = Math.min(dist, (e._pullSpeed || 400) * dt);
          e.x += (dx / dist) * step;
          e.y += (dy / dist) * step;
        }
      } else {
        // Wave mode
        e.patternTime += dt;
        this.applyPattern(e, dt, canvas);

        e.x += e.vx * dt;
        e.y += e.vy * dt;

        // Off screen check (wave mode only)
        if (e.y > canvas.height + 100 || e.x < -100 || e.x > canvas.width + 100) {
          e.dead = true;
          continue;
        }

        // Shooting (wave mode constraint)
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && e.y > 30 && e.y < canvas.height * 0.6) {
          e.shootTimer = e.shootInterval + Math.random();
          this.shoot(e);
        }
      }
    }
    
    State.enemies = State.enemies.filter(e => !e.dead);
  },

  // Exploration AI: patrol at spawn point, aggro in range, return when player leaves
  updateExplorationAI(e, dt, zone) {
    const p = State.player;

    // Repair drone overrides base AI
    if (e.abilities && e.abilities.includes('repairTether')) {
      this.updateRepairDroneAI(e, dt, zone);
      return;
    }

    // Turret: completely stationary, only rotates to face player
    if (e.abilities && e.abilities.includes('stationary')) {
      e.vx = 0; e.vy = 0;
      e.x = e.homeX || e.x;
      e.y = e.homeY || e.y;
      const distP = Math.hypot(p.x - e.x, p.y - e.y);
      e.aiState = distP < (e.aggroRange || 400) ? 'aggro' : 'patrol';
      return;
    }

    // Cloaker: update visibility based on distance
    if (e.abilities && e.abilities.includes('cloak')) {
      const distP = Math.hypot(p.x - e.x, p.y - e.y);
      const wasCloaked = e._cloaked;
      e._cloaked = distP > (e._uncloakRange || 120);
      // Uncloak SFX when transitioning visible
      if (wasCloaked && !e._cloaked) {
        const AudioC = State.modules?.Audio;
        if (AudioC) AudioC.uncloak();
      }
    }

    const tune = State.data.config?.exploration || {};
    const aggroMult = (typeof tune.enemyAggroRangeMult === 'number') ? tune.enemyAggroRangeMult : 1.0;

    // Lazy init for safety (should be set in World.spawnEnemy)
    if (e.homeX == null || e.homeY == null) {
      e.homeX = e.x;
      e.homeY = e.y;
    }
    if (!e.aiState) e.aiState = 'patrol';
    if (!e.patrol) e.patrol = 'circle';
    if (!e.patrolRadius) e.patrolRadius = 120;
    if (e.patrolAngle == null) e.patrolAngle = Math.random() * Math.PI * 2;
    if (!e.patrolDir) e.patrolDir = Math.random() < 0.5 ? -1 : 1;
    if (e.patrolTimer == null) e.patrolTimer = 0;
    if (!e.aggroRange) {
      const baseAggro = e.isBoss ? 550 : (e.isElite ? 420 : 340);
      e.aggroRange = baseAggro * aggroMult;
    }
    if (!e.attackRange) e.attackRange = e.aggroRange;
    if (!e.disengageRange) e.disengageRange = e.aggroRange * 1.65;
    if (!e.leashRange) e.leashRange = Math.max(e.aggroRange * 2.2, e.patrolRadius * 5);
    if (!e.returnThreshold) e.returnThreshold = Math.max(40, e.size * 1.2);
    if (e.wanderTimer == null) e.wanderTimer = 0;

    e.patrolTimer += dt;

    const dxP = p.x - e.x;
    const dyP = p.y - e.y;
    const distP = Math.hypot(dxP, dyP);
    const dxH = e.homeX - e.x;
    const dyH = e.homeY - e.y;
    const distH = Math.hypot(dxH, dyH);

    // State transitions
    if (distP <= e.aggroRange) {
      e.aiState = 'aggro';
    } else if (e.aiState === 'aggro' && (distP > e.disengageRange || distH > e.leashRange)) {
      e.aiState = 'return';
    } else if (e.aiState === 'return' && distH <= e.returnThreshold) {
      e.aiState = 'patrol';
      e.vx = 0;
      e.vy = 0;
    }

    // Movement
    const patrolSpeed = e.speed * (e.isBoss ? 0.40 : 0.32);
    const returnSpeed = e.speed * (e.isBoss ? 0.85 : 0.70);
    const chaseSpeed = e.speed * (e.isBoss ? 1.05 : (e.isElite ? 0.95 : 0.90));
    
    // v2.16.3: Apply status effect slow/freeze
    const speedMult = e._currentSpeedMult ?? 1;

    let tx = e.x;
    let ty = e.y;
    let desiredSpeed = patrolSpeed;

    if (e.aiState === 'patrol') {
      switch (e.patrol) {
        case 'circle': {
          e.patrolAngle += dt * 0.9 * e.patrolDir;
          tx = e.homeX + Math.cos(e.patrolAngle) * e.patrolRadius;
          ty = e.homeY + Math.sin(e.patrolAngle) * e.patrolRadius;
          break;
        }
        case 'line': {
          e.patrolAngle += dt * 1.1 * e.patrolDir;
          tx = e.homeX + Math.sin(e.patrolAngle) * e.patrolRadius;
          ty = e.homeY + Math.sin(e.patrolAngle * 0.5) * (e.patrolRadius * 0.25);
          break;
        }
        case 'wander': {
          e.wanderTimer -= dt;
          if (!e.wanderTarget || e.wanderTimer <= 0) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * e.patrolRadius;
            e.wanderTarget = {
              x: e.homeX + Math.cos(a) * r,
              y: e.homeY + Math.sin(a) * r
            };
            e.wanderTimer = 1.2 + Math.random() * 2.2;
          }
          tx = e.wanderTarget.x;
          ty = e.wanderTarget.y;
          break;
        }
        case 'static':
        default: {
          // Slight hover-bob without net drift
          tx = e.homeX + Math.sin(e.patrolTimer * 1.7) * 12;
          ty = e.homeY + Math.cos(e.patrolTimer * 1.3) * 10;
          break;
        }
      }
    } else if (e.aiState === 'return') {
      tx = e.homeX;
      ty = e.homeY;
      desiredSpeed = returnSpeed;
    } else if (e.aiState === 'aggro') {
      desiredSpeed = chaseSpeed;

      // Patrol-like spaceship behavior: approach, then strafe/orbit
      const orbitDist = e.isBoss ? 260 : (e.isElite ? 200 : 170);
      if (distP > 0.001) {
        const ux = dxP / distP;
        const uy = dyP / distP;
        const px = -uy;
        const py = ux;

        // Too close -> back off
        const minDist = e.size * 2.6;
        const tooClose = distP < minDist;

        const orbitBias = distP < orbitDist ? 1.0 : 0.45;
        const jitter = Math.sin(e.patrolTimer * 1.6) * 0.25;

        const dirX = (tooClose ? -ux : ux) + px * (orbitBias * e.patrolDir) + px * jitter;
        const dirY = (tooClose ? -uy : uy) + py * (orbitBias * e.patrolDir) + py * jitter;
        const d = Math.hypot(dirX, dirY) || 1;

        e.vx = (dirX / d) * desiredSpeed * speedMult;
        e.vy = (dirY / d) * desiredSpeed * speedMult;
        return;
      }
    }

    // Steer towards target (patrol/return)
    const dx = tx - e.x;
    const dy = ty - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 2) {
      e.vx = (dx / dist) * desiredSpeed;
      e.vy = (dy / dist) * desiredSpeed;
    } else {
      e.vx *= 0.85;
      e.vy *= 0.85;
    }
  },

  
// Support AI: repair drone tethers to a nearby ally and heals it (capped per target per second)
updateRepairDroneAI(e, dt, zone) {
  const p = State.player;
  const cfg = e.repair || { range: 260, healPctMaxHpPerSec: 0.03, capPctMaxHpPerSec: 0.04 };

  // Pick target: nearest non-dead ally, prefer elites/bosses
  let best = null;
  let bestScore = -1e9;
  for (const other of State.enemies) {
    if (!other || other.dead || other.id === e.id) continue;
    if (other.abilities && other.abilities.includes('repairTether')) continue; // don't heal other repair drones
    const dx = other.x - e.x;
    const dy = other.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d > 650) continue;
    const prio = (other.isBoss ? 1000 : (other.isElite ? 200 : 0));
    const missing = Math.max(0, other.maxHP - other.hp);
    const score = prio + missing - d * 0.25;
    if (score > bestScore) { bestScore = score; best = other; }
  }

  if (best) {
    e.tether.targetId = best.id;

    // Orbit near target
    e.orbit.t += dt;
    const ang = e.orbit.t * 1.2 + (e.id.charCodeAt(e.id.length-1) % 6);
    const desiredX = best.x + Math.cos(ang) * e.orbit.radius;
    const desiredY = best.y + Math.sin(ang) * e.orbit.radius;
    const dx = desiredX - e.x;
    const dy = desiredY - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const sp = e.speed || 90;
    e.vx = (dx / dist) * sp;
    e.vy = (dy / dist) * sp;

    // Apply heal if within range
    const dToTarget = Math.hypot(best.x - e.x, best.y - e.y);
    if (dToTarget <= cfg.range && best.hp > 0 && best.hp < best.maxHP) {
      const want = best.maxHP * cfg.healPctMaxHpPerSec * dt;
      const cap = best.maxHP * cfg.capPctMaxHpPerSec * dt;

      const hb = this._healBudget || Object.create(null);
      const used = hb[best.id] || 0;
      const grant = Math.max(0, Math.min(want, cap - used));
      if (grant > 0) {
        best.hp = Math.min(best.maxHP, best.hp + grant);
        hb[best.id] = used + grant;
      }
    }
    return;
  }

  // No target: behave like normal patrol/aggro drift (fallback)
  e.tether.targetId = null;
  // Light drift toward player to stay relevant
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const sp = (e.speed || 90) * 0.4;
  e.vx = (dx / d) * sp;
  e.vy = (dy / d) * sp;
},

updateExplorationShooting(e, dt) {
    // Boss ability ticks (shield timer, periodic adds)
    if (e.isBoss) this._tickBossAbilities(e, dt);

    if (e.aiState !== 'aggro') return;
    const p = State.player;
    const dist = Math.hypot(p.x - e.x, p.y - e.y);
    if (dist > e.attackRange) return;

    // Sniper special (aimShot): telegraphed windup then high-velocity shot
    if (e.abilities && e.abilities.includes('aimShot') && e.aim) {
      const aim = e.aim;
      if (aim.state === 'cooldown') {
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          aim.state = 'windup';
          aim.t = 0;
          // Cache the angle at start (reduces jitter)
          aim.lastAngle = Math.atan2(p.y - e.y, p.x - e.x);
        }
        return;
      }

      if (aim.state === 'windup') {
        aim.t += dt;
        // Track target slowly during windup for fairness
        const targetAngle = Math.atan2(p.y - e.y, p.x - e.x);
        const trackRate = 4.0; // rad/s
        const delta = ((targetAngle - aim.lastAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        aim.lastAngle += Math.max(-trackRate * dt, Math.min(trackRate * dt, delta));

        if (aim.t >= aim.windup) {
          // Fire
          this.shootSniper(e, aim.lastAngle);
          // Reset cooldown
          aim.state = 'cooldown';
          aim.t = 0;
          e.shootTimer = e.shootInterval + Math.random() * 0.35;
        }
        return;
      }
    }

    e.shootTimer -= dt;

    // ── Bomber: lay mines while in aggro ──
    if (e.abilities && e.abilities.includes('layMines')) {
      e._mineTimer -= dt;
      if (e._mineTimer <= 0) {
        e._mineTimer = 2.5 + Math.random();
        const zone = State.world?.currentZone;
        if (zone && zone.obstacles) {
          for (let m = 0; m < (e._mineCount || 1); m++) {
            zone.obstacles.push({
              x: e.x + (Math.random() - 0.5) * 40,
              y: e.y + (Math.random() - 0.5) * 40,
              type: 'mine', radius: 12, rotation: 0,
              destructible: true, hp: 6,
              damage: e._mineDamage || 12,
              destroyed: false
            });
          }
          // Brief VFX
          const Particles = State.modules?.Particles;
          if (Particles) Particles.flash(e.x, e.y, '#ff6633', 6);
        }
      }
    }

    // ── Summoner: spawn minions periodically ──
    if (e.abilities && e.abilities.includes('summon')) {
      // Clean dead summons from tracking
      e._summonIds = (e._summonIds || []).filter(id => State.enemies.some(en => en.id === id && !en.dead));
      e._summonCount = e._summonIds.length;

      e._summonTimer -= dt;
      if (e._summonTimer <= 0 && e._summonCount < (e._summonMax || 3)) {
        e._summonTimer = 6 + Math.random() * 2;
        const ang = Math.random() * Math.PI * 2;
        const sx = e.x + Math.cos(ang) * (e.size * 2.5);
        const sy = e.y + Math.sin(ang) * (e.size * 2.5);
        const minion = this.spawn(e._summonType || 'grunt', sx, sy, false, false);
        if (minion) {
          minion.hp *= 0.6;
          minion.maxHP *= 0.6;
          minion.xp = Math.floor(minion.xp * 0.3);
          minion.homeX = e.x;
          minion.homeY = e.y;
          minion.aiState = 'aggro';
          e._summonIds.push(minion.id);
        }
        const Particles = State.modules?.Particles;
        if (Particles) {
          Particles.ring(e.x, e.y, '#cc44ff', e.size * 1.5);
          Particles.flash(sx, sy, '#cc44ff', 8);
        }
        const AudioS = State.modules?.Audio;
        if (AudioS) AudioS.summon();
      }
    }

    // ── Turret: burst fire (3 shots rapid, then pause) ──
    if (e.abilities && e.abilities.includes('stationary')) {
      if (e._burstRemaining > 0) {
        e._burstTimer -= dt;
        if (e._burstTimer <= 0) {
          this.shoot(e);
          e._burstRemaining--;
          e._burstTimer = e._burstDelay || 0.15;
        }
        return; // don't do normal shoot during burst
      }
    }

    // ── Shielder: orient barrier toward player ──
    if (e.abilities && e.abilities.includes('projectBarrier')) {
      e._barrierAngle = Math.atan2(p.y - e.y, p.x - e.x);
      // Regen barrier slowly
      e._barrierRegenTimer += dt;
      if (e._barrierRegenTimer > 3 && e._barrierHP < e._barrierMaxHP) {
        e._barrierHP = Math.min(e._barrierMaxHP, e._barrierHP + e._barrierMaxHP * 0.1 * dt);
      }
    }

    if (e.shootTimer <= 0) {
      // Light jitter to avoid perfectly deterministic bullet streams
      e.shootTimer = e.shootInterval + Math.random() * 0.35;

      // Turret: start burst
      if (e.abilities && e.abilities.includes('stationary')) {
        e._burstRemaining = (e._burstCount || 3) - 1; // -1 because we fire the first now
        e._burstTimer = e._burstDelay || 0.15;
      }

      this.shoot(e);
    }
  },

  shootSniper(e, angle) {
    const speed = 560;

    // Spawn from the "nose" of the sprite (along aim angle), not from a fixed Y offset.
    const ox = Math.cos(angle) * (e.size * 1.1);
    const oy = Math.sin(angle) * (e.size * 1.1);

    State.enemyBullets.push({
      x: e.x + ox,
      y: e.y + oy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage: e.damage,
      size: 6,
      // tag for potential future FX / rendering tweaks
      isSniper: true
    });
  },
  
  // Apply movement pattern
  applyPattern(e, dt, canvas) {
    switch (e.pattern) {
      case 'zigzag':
        e.vy = e.speed * 0.5;
        e.vx = Math.sin(e.patternTime * 4) * e.speed;
        break;
      case 'dive':
        e.vy = e.patternTime < 1.5 ? e.speed * 0.3 : e.speed * 2;
        break;
      case 'snake':
        e.vy = e.speed * 0.5;
        e.vx = Math.sin(e.patternTime * 3) * e.speed * 0.8;
        break;
      case 'charge':
        if (e.patternTime > 1) {
          const p = State.player;
          const dx = p.x - e.x, dy = p.y - e.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 10) {
            e.vx = (dx / dist) * e.speed * 1.5;
            e.vy = (dy / dist) * e.speed * 1.5;
          }
        } else {
          e.vy = e.speed * 0.2;
        }
        break;
      default:
        e.vy = e.speed;
    }
    
    // Keep on screen
    if (e.x < 30) e.vx = Math.abs(e.vx);
    if (e.x > canvas.width - 30) e.vx = -Math.abs(e.vx);
  },
  
  // Enemy shoots
  shoot(e) {
    const p = State.player;
    const dx = p.x - e.x, dy = p.y - e.y;
    const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.2;
    const speed = 280;
    
    State.enemyBullets.push({
      x: e.x, y: e.y + e.size / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage: e.damage,
      size: e.isBoss ? 8 : 5,
      dot: (e.abilities && e.abilities.includes("corruptDot")) ? (e.dot || { duration: 4.0, tick: 0.5, dpsPctMaxHp: 0.01 }) : null
    });

    // Subtle enemy shoot SFX (pooled to prevent spam)
    const AudioE = State.modules?.Audio;
    if (AudioE) AudioE.enemyShoot();
  },
  
  // Damage an enemy
  // ═══ A49 STATUS CORE: one capped vulnerability budget (additive, never multiplicative) ═══
  // All "takes more damage" sources add into ONE value, hard-capped. This is the structural
  // guard against the synergy multiplication that got the elemental system cut before.
  STATUS: {
    VULN_CAP: 0.6,            // combined cap: at most +60% damage taken from ALL status sources
    BRITTLE_VULN: 0.30,       // frozen enemies are brittle
    SHOCK_VULN: 0.15,         // shocked enemies are conductive
    SHOCK_MARK_DURATION: 1.5  // conductive window after a shock proc
  },
  // Effective damage-taken multiplier from active statuses (computed live → no decay bugs).
  vulnMult(e) {
    if (!e) return 1;
    let v = 0;
    if (e._freezeTimer > 0) v += this.STATUS.BRITTLE_VULN;
    if (e._shockTimer > 0)  v += this.STATUS.SHOCK_VULN;
    return 1 + Math.min(v, this.STATUS.VULN_CAP);
  },

  damage(enemy, amount, isCrit = false) {
    if (enemy.dead) return false;

    // Boss shield phase: reduce damage by 80%
    if (enemy._shieldPhase) amount *= 0.2;

    // A49: apply the single capped vulnerability budget (frozen/shocked take more — bounded)
    amount *= this.vulnMult(enemy);

    enemy.hp -= amount;
    State.run.stats.damageDealt += amount;
    try { State.modules?.Director?.onDamageDealt?.(amount); } catch (e) { /* safe */ }
    
    // Hit particles
    for (let i = 0; i < (isCrit ? 10 : 5); i++) {
      State.particles.push({
        x: enemy.x + (Math.random() - 0.5) * enemy.size,
        y: enemy.y + (Math.random() - 0.5) * enemy.size,
        vx: (Math.random() - 0.5) * 150,
        vy: (Math.random() - 0.5) * 150,
        life: 0.25,
        maxLife: 0.3,
        color: isCrit ? '#ffff00' : enemy.color,
        size: isCrit ? 5 : 3
      });
    }

    // ── Boss phase transitions ──
    if (enemy.isBoss && enemy.phases) {
      this._updateBossPhases(enemy);
    }
    
    if (enemy.hp <= 0) {
      return this.kill(enemy);
    }
    return null;
  },

  // Boss phase system: trigger abilities at HP thresholds
  _updateBossPhases(boss) {
    if (!boss._phaseInit) {
      boss._phaseInit = true;
      boss._currentPhase = 1;
      boss._phaseThresholds = [];
      boss._abilityCooldowns = {};
      boss._shieldPhase = false;
      boss._shieldTimer = 0;
      boss._enraged = false;
      boss._addTimer = 0;
      // Generate thresholds: e.g. 3 phases → [0.66, 0.33, 0] 
      const n = boss.phases || 3;
      for (let i = 1; i < n; i++) {
        boss._phaseThresholds.push(1 - (i / n));
      }
    }

    const hpPct = boss.hp / boss.maxHP;
    const thresholds = boss._phaseThresholds;
    let newPhase = 1;
    for (let i = 0; i < thresholds.length; i++) {
      if (hpPct <= thresholds[i]) newPhase = i + 2;
    }

    if (newPhase > boss._currentPhase) {
      boss._currentPhase = newPhase;
      this._onBossPhaseChange(boss, newPhase);
    }
  },

  _onBossPhaseChange(boss, phase) {
    const Particles = State.modules?.Particles;

    // Phase change flash
    if (Particles) {
      Particles.ring(boss.x, boss.y, boss.color, boss.size * 2);
      Particles.flash(boss.x, boss.y, '#ffffff');
      if (Particles.screenShake != null) Particles.screenShake = Math.max(Particles.screenShake, 4);
    }

    const AudioPhase = State.modules?.Audio;
    if (AudioPhase) AudioPhase.bossPhaseChange();

    const abilities = boss.abilities || [];

    // Shield phase (phase 2+)
    if (abilities.includes('shield_phase') && phase === 2) {
      boss._shieldPhase = true;
      boss._shieldTimer = 4; // 4 seconds of shield
    }

    // Spawn adds
    if (abilities.includes('spawn_adds') || abilities.includes('drone_swarm')) {
      this._bossSpawnAdds(boss, phase);
    }

    // Enrage on final phase
    if (phase >= (boss.phases || 3)) {
      boss._enraged = true;
      boss.speed *= 1.35;
      boss.shootInterval = Math.max(0.2, boss.shootInterval * 0.6);
      boss.damage *= 1.4;
    }
  },

  _bossSpawnAdds(boss, phase) {
    const addCount = 2 + phase;
    const World = State.modules?.World;
    for (let i = 0; i < addCount; i++) {
      const a = (i / addCount) * Math.PI * 2;
      const sx = boss.x + Math.cos(a) * (boss.size * 2.5);
      const sy = boss.y + Math.sin(a) * (boss.size * 2.5);
      // Spawn a grunt-level add
      const enemy = this.spawn('grunt', sx, sy, false, false);
      if (enemy) {
        enemy.hp *= 0.5; // weaker adds
        enemy.maxHP *= 0.5;
        enemy.xp = Math.floor(enemy.xp * 0.3);
        enemy.homeX = boss.x;
        enemy.homeY = boss.y;
        enemy.aiState = 'aggro'; // immediately aggressive
      }
    }
  },

  // Called every frame for active bosses (from updateExplorationShooting)
  _tickBossAbilities(boss, dt) {
    if (!boss._phaseInit) return;

    // Shield phase timer
    if (boss._shieldPhase && boss._shieldTimer > 0) {
      boss._shieldTimer -= dt;
      if (boss._shieldTimer <= 0) {
        boss._shieldPhase = false;
      }
    }

    // Periodic add spawning (every 8s in aggro, phase 3+)
    if (boss._currentPhase >= 3 && boss.aiState === 'aggro') {
      boss._addTimer = (boss._addTimer || 0) + dt;
      if (boss._addTimer > 8) {
        boss._addTimer = 0;
        this._bossSpawnAdds(boss, boss._currentPhase);
      }
    }
  },
  
  // Kill enemy
  kill(enemy) {
    enemy.dead = true;
    State.run.stats.kills++;
    if (enemy.isElite) State.run.stats.eliteKills++;
    if (enemy.isBoss) State.run.stats.bossKills++;
    try { State.modules?.Director?.onEnemyKill?.(enemy); } catch (e) { /* safe */ }
    
    // Notify World system (for exploration mode spawn tracking)
    const World = State.modules?.World;
    if (World && enemy.spawnRef) {
      World.onEnemyKilled(enemy);
    }
    
    // Check for boss kill callback
    if (enemy.isBoss && State.run.currentAct) {
      window.Game?.onBossKilled?.(State.run.currentAct);
    }
    
    // Death explosion - use Particles helpers for rich FX
    const Particles = State.modules?.Particles;
    const SM = State.modules?.SpriteManager;
    if (Particles) {
      if (enemy.isBoss) {
        // Boss: massive multi-stage explosion
        Particles.explosion(enemy.x, enemy.y, enemy.color, 45, 350);
        Particles.explosion(enemy.x, enemy.y, '#ffffff', 20, 200);
        Particles.explosion(enemy.x, enemy.y, '#ffcc00', 25, 250);
        Particles.ring(enemy.x, enemy.y, enemy.color, enemy.size * 2.5);
        Particles.ring(enemy.x, enemy.y, '#ffffff', enemy.size * 1.5);
        Particles.flash(enemy.x, enemy.y, '#ffffff', 25);
        Particles.screenShake = Math.max(Particles.screenShake || 0, 10);
        window.Game?.requestHitstop?.(6, true); // boss death = satisfying chunk-freeze
        if (SM && Particles?.spriteExplosions) SM.playBestEffect?.(['boss_death','explosion_big','explosion_elite','explosion_small','explosion'], enemy.x, enemy.y, { category: 'effects', state: 'play', size: enemy.size * 2 }) || SM.playEffect('explosion_big', enemy.x, enemy.y, { size: enemy.size * 2 });
      } else if (enemy.isElite) {
        // Elite: big explosion + ring
        Particles.explosion(enemy.x, enemy.y, enemy.color, 30, 250);
        Particles.explosion(enemy.x, enemy.y, '#ffffff', 10, 150);
        Particles.ring(enemy.x, enemy.y, enemy.color, enemy.size * 2);
        Particles.flash(enemy.x, enemy.y, enemy.color, 12);
        Particles.screenShake = Math.max(Particles.screenShake || 0, 4);
        window.Game?.requestHitstop?.(3); // elite death = small chunk-freeze (A47: gated, not forced — risk instances spawn many elites)
        if (SM && Particles?.spriteExplosions) SM.playBestEffect?.(['elite_death','explosion_elite','explosion_big','explosion_small','explosion'], enemy.x, enemy.y, { category: 'effects', state: 'play', size: enemy.size * 1.5 }) || SM.playEffect('explosion_big', enemy.x, enemy.y, { size: enemy.size * 1.5 });
      } else {
        // Standard: explosion + small ring
        Particles.explosion(enemy.x, enemy.y, enemy.color, 18, 180);
        Particles.ring(enemy.x, enemy.y, enemy.color, enemy.size * 1.5);
        Particles.screenShake = Math.max(Particles.screenShake || 0, 1.5);
        if (SM && Particles?.spriteExplosions) SM.playBestEffect?.(['death','explosion_small','explosion'], enemy.x, enemy.y, { category: 'effects', state: 'play', size: enemy.size }) || SM.playEffect('explosion_small', enemy.x, enemy.y, { size: enemy.size });
      }
    } else {
      // Fallback: direct particle push
      const count = enemy.isBoss ? 40 : (enemy.isElite ? 25 : 15);
      for (let i = 0; i < count; i++) {
        State.particles.push({
          x: enemy.x, y: enemy.y,
          vx: (Math.random() - 0.5) * 250,
          vy: (Math.random() - 0.5) * 250,
          life: 0.4, maxLife: 0.5,
          color: enemy.color,
          size: 3 + Math.random() * 5
        });
      }
    }
    
    // Death SFX
    const AudioMod = State.modules?.Audio;
    if (AudioMod) {
      if (enemy.isBoss) AudioMod.explosionBig();
      else if (enemy.isElite) AudioMod.explosion();
      else AudioMod.hitEnemy();
    }

    return { x: enemy.x, y: enemy.y, xp: enemy.xp, isElite: enemy.isElite, isBoss: enemy.isBoss, bossType: enemy.bossType || enemy.type || null, _volatile: enemy._volatile || false, damage: enemy.damage || 0, id: enemy.id, _wasFrozen: (enemy._freezeTimer || 0) > 0 };
  },
  
  // Draw all enemies
  draw(ctx) {
    const t = performance.now() * 0.001;
    const p = State.player;

    for (const e of State.enemies) {
      if (e.dead) continue;

      // --- Sniper telegraph ---
      if (e.aim && e.aim.state === 'windup') {
        const aim = e.aim;
        const tProg = Math.min(1, aim.t / Math.max(0.001, aim.windup));
        ctx.save();
        ctx.globalAlpha = 0.2 + 0.4 * tProg;
        ctx.setLineDash([8, 6]);
        ctx.strokeStyle = '#c070ff';
        ctx.lineWidth = 1.5 + tProg;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.setLineDash([]);
        const timeLeft = Math.max(0, aim.windup - aim.t);
        if (timeLeft <= (aim.pulseWindow || 0.3)) {
          const pT = 1 - (timeLeft / Math.max(0.001, aim.pulseWindow || 0.3));
          ctx.globalAlpha = 0.3 + 0.5 * pT;
          ctx.fillStyle = '#ffdd88';
          ctx.shadowColor = '#ffdd88';
          ctx.shadowBlur = 20;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.size * (0.3 + 0.3 * pT), 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        ctx.restore();
      }

      // --- Repair tether ---
      if (e.abilities && e.abilities.includes('repairTether') && e.tether && e.tether.targetId) {
        const target = State.enemies.find(o => o.id === e.tether.targetId && !o.dead);
        if (target) {
          ctx.save();
          // Animated dashed tether
          const dashOff = t * 30;
          ctx.setLineDash([6, 4]);
          ctx.lineDashOffset = -dashOff;
          ctx.globalAlpha = 0.35 + Math.sin(t * 5) * 0.1;
          ctx.strokeStyle = '#66ddff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
          ctx.setLineDash([]);
          // Heal pulse at target
          ctx.globalAlpha = 0.15;
          ctx.fillStyle = '#aaffff';
          ctx.shadowColor = '#66ddff';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(target.x, target.y, 8 + Math.sin(t * 6) * 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.restore();
        }
      }

      // --- Face player angle ---
      const faceAng = Math.atan2(p.y - e.y, p.x - e.x);

      // ═══ v2.15.0: Sprite draw hook (skip canvas body if sprite available) ═══
      const SM = State.modules?.SpriteManager;
      if (SM) {
        const spCat = e.spriteCategory || (e.isBoss ? 'bosses' : (e.isElite ? 'elites' : 'enemies'));
        const spId = e.spriteId || e.type;
        const spState = e.animState || (e._firing ? 'fire' : (e._aggro ? 'aggro' : 'patrol'));
        const hasSpr = SM.has(spCat, spId, spState) || (e.isElite && SM.has('enemies', spId, spState));
        const useCat = SM.has(spCat, spId, spState) ? spCat : 'enemies';
        if (hasSpr) {
          e.animState = spState;
          SM.play(e, useCat, spId, spState);
          const sprOpts = {
            alpha: (e.abilities?.includes('cloak') && e._cloaked) ? (e._cloakAlpha || 0.08) : 1,
            tint: e._hitFlash > 0 ? 'rgba(255,255,255,0.6)' : null
          };
          if (SM.drawAnimated(ctx, e, e.x, e.y, faceAng, e.size, sprOpts)) {
            this._drawHPBar(ctx, e);
            continue; // skip canvas fallback
          }
        }
      }

      ctx.save();
      ctx.translate(e.x, e.y);

      // Cloaker: apply alpha based on cloak state
      if (e.abilities && e.abilities.includes('cloak') && e._cloaked) {
        ctx.globalAlpha = e._cloakAlpha || 0.08;
      }

      // ====== TYPE-SPECIFIC RENDERING ======
      if (e.isBoss) {
        this._drawBoss(ctx, e, t, faceAng);
        // Boss shield phase overlay
        if (e._shieldPhase) {
          ctx.globalAlpha = 0.2 + Math.sin(t * 8) * 0.1;
          ctx.strokeStyle = '#66ddff';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, e.size * 1.3, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = 'rgba(100,200,255,0.08)';
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        // Boss enrage overlay
        if (e._enraged) {
          ctx.globalAlpha = 0.1 + Math.sin(t * 10) * 0.06;
          ctx.fillStyle = '#ff2200';
          ctx.beginPath();
          ctx.arc(0, 0, e.size * 1.1, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      } else if (e.isElite) {
        this._drawElite(ctx, e, t, faceAng);
      } else {
        this._drawBasic(ctx, e, t, faceAng);
      }

      // ═══ CHAOS CORRUPTION OVERLAY ═══
      // Subtle edge glow only — don't hide the enemy art
      if (e._corrupt) {
        const pulse = 0.06 + Math.sin(t * 4 + e.id * 0.7) * 0.03;
        // Thin corruption ring (not filled circle)
        ctx.globalAlpha = 0.35 + Math.sin(t * 3) * 0.15;
        ctx.strokeStyle = e._corruptColor || '#aa22ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, e.size * 1.1, 0, Math.PI * 2);
        ctx.stroke();
        // 2 small orbiting wisps
        ctx.globalAlpha = 0.3;
        for (let ci = 0; ci < 2; ci++) {
          const wa = t * 3 + ci * Math.PI + e.id;
          const wd = e.size * 0.9;
          ctx.fillStyle = '#cc44ff';
          ctx.beginPath();
          ctx.arc(Math.cos(wa) * wd, Math.sin(wa) * wd, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      ctx.restore();
      this._drawHPBar(ctx, e);
    }
  },

  // ============ BASIC ENEMY TYPES ============
  _drawBasic(ctx, e, t, faceAng) {
    const sz = e.size;
    const type = e.type;

    switch (type) {
      case 'grunt': {
        // Triangular fighter with engine stripe
        ctx.rotate(faceAng + Math.PI / 2);
        // Wings
        const wg = ctx.createLinearGradient(-sz, 0, sz, 0);
        wg.addColorStop(0, '#1a5522');
        wg.addColorStop(0.5, e.color);
        wg.addColorStop(1, '#1a5522');
        ctx.fillStyle = wg;
        ctx.beginPath();
        ctx.moveTo(0, -sz);
        ctx.lineTo(-sz * 0.9, sz * 0.7);
        ctx.lineTo(0, sz * 0.4);
        ctx.lineTo(sz * 0.9, sz * 0.7);
        ctx.closePath();
        ctx.fill();
        // Hull stripe
        ctx.fillStyle = '#66dd66';
        ctx.beginPath();
        ctx.moveTo(0, -sz * 0.8);
        ctx.lineTo(-sz * 0.15, sz * 0.4);
        ctx.lineTo(sz * 0.15, sz * 0.4);
        ctx.closePath();
        ctx.fill();
        // Cockpit
        ctx.fillStyle = '#aaffaa';
        ctx.shadowColor = '#44ff44';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(0, -sz * 0.35, 2.5, 0, Math.PI * 2);
        ctx.fill();
        // Engine glow
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(0,255,100,0.5)';
        ctx.beginPath();
        ctx.arc(-sz * 0.35, sz * 0.65, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sz * 0.35, sz * 0.65, 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'scout': {
        // Sleek fast interceptor - thin swept wings
        ctx.rotate(faceAng + Math.PI / 2);
        const sg = ctx.createLinearGradient(0, -sz, 0, sz);
        sg.addColorStop(0, '#66ccff');
        sg.addColorStop(1, '#224488');
        ctx.fillStyle = sg;
        // Swept-back wings
        ctx.beginPath();
        ctx.moveTo(0, -sz * 1.1);
        ctx.lineTo(-sz * 0.5, -sz * 0.1);
        ctx.lineTo(-sz * 1.0, sz * 0.6);
        ctx.lineTo(-sz * 0.3, sz * 0.3);
        ctx.lineTo(0, sz * 0.5);
        ctx.lineTo(sz * 0.3, sz * 0.3);
        ctx.lineTo(sz * 1.0, sz * 0.6);
        ctx.lineTo(sz * 0.5, -sz * 0.1);
        ctx.closePath();
        ctx.fill();
        // Center line
        ctx.strokeStyle = '#aaddff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -sz * 0.9);
        ctx.lineTo(0, sz * 0.3);
        ctx.stroke();
        // Cockpit
        ctx.fillStyle = '#ddeeff';
        ctx.shadowColor = '#44aaff';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.ellipse(0, -sz * 0.3, 2, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        break;
      }
      case 'diver': {
        // Sharp dart/arrow - aggressive red
        ctx.rotate(faceAng + Math.PI / 2);
        const dg = ctx.createLinearGradient(0, -sz, 0, sz);
        dg.addColorStop(0, '#ff6666');
        dg.addColorStop(1, '#881111');
        ctx.fillStyle = dg;
        // Sharp pointed body
        ctx.beginPath();
        ctx.moveTo(0, -sz * 1.3);
        ctx.lineTo(-sz * 0.4, -sz * 0.2);
        ctx.lineTo(-sz * 0.8, sz * 0.5);
        ctx.lineTo(-sz * 0.15, sz * 0.2);
        ctx.lineTo(0, sz * 0.7);
        ctx.lineTo(sz * 0.15, sz * 0.2);
        ctx.lineTo(sz * 0.8, sz * 0.5);
        ctx.lineTo(sz * 0.4, -sz * 0.2);
        ctx.closePath();
        ctx.fill();
        // Danger stripe
        ctx.strokeStyle = '#ffcc44';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-sz * 0.3, 0);
        ctx.lineTo(sz * 0.3, 0);
        ctx.stroke();
        // Hot nose tip
        ctx.fillStyle = '#ffaa44';
        ctx.shadowColor = '#ff4444';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, -sz * 1.0, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        break;
      }
      case 'tank': {
        // Heavy armored hexagon with plating
        ctx.rotate(t * 0.2);
        const tz = sz * 1.1;
        // Armor plates (outer hex)
        const tg = ctx.createRadialGradient(0, 0, tz * 0.2, 0, 0, tz);
        tg.addColorStop(0, '#aabbcc');
        tg.addColorStop(0.6, '#778899');
        tg.addColorStop(1, '#445566');
        ctx.fillStyle = tg;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3;
          const px = Math.cos(a) * tz;
          const py = Math.sin(a) * tz;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#99aabb';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Armor plate lines
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * tz * 0.85, Math.sin(a) * tz * 0.85);
          ctx.stroke();
        }
        // Inner core
        ctx.fillStyle = '#556677';
        ctx.beginPath();
        ctx.arc(0, 0, tz * 0.4, 0, Math.PI * 2);
        ctx.fill();
        // Center turret
        ctx.fillStyle = '#cc4444';
        ctx.shadowColor = '#ff4444';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(0, 0, tz * 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        break;
      }
      case 'corrupted': {
        // Organic toxic blob - pulsing irregular
        const pulse = 0.85 + Math.sin(t * 5 + e.x * 0.1) * 0.15;
        const cz = sz * pulse;
        // Toxic aura
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#aaff00';
        ctx.beginPath();
        ctx.arc(0, 0, cz * 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        // Irregular body (8-point blob)
        ctx.fillStyle = e.color;
        ctx.shadowColor = '#ddcc00';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4;
          const wobble = 0.7 + Math.sin(t * 3 + i * 1.5) * 0.3;
          const r = cz * wobble;
          i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) :
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        // Toxic veins
        ctx.strokeStyle = 'rgba(100,255,0,0.4)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const a = t + i * 2.1;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(
            Math.cos(a) * cz * 0.5, Math.sin(a) * cz * 0.5,
            Math.cos(a + 0.5) * cz * 0.8, Math.sin(a + 0.5) * cz * 0.8
          );
          ctx.stroke();
        }
        // Toxic eye
        ctx.fillStyle = '#ff4444';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        break;
      }
      case 'repair_drone': {
        // Small rotating cross/plus with heal glow
        ctx.rotate(t * 2);
        const dz = sz * 0.8;
        // Cross shape
        ctx.fillStyle = '#44ccee';
        ctx.shadowColor = '#66ddff';
        ctx.shadowBlur = 8;
        ctx.fillRect(-dz * 0.6, -dz * 0.2, dz * 1.2, dz * 0.4);
        ctx.fillRect(-dz * 0.2, -dz * 0.6, dz * 0.4, dz * 1.2);
        // Center circle
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, dz * 0.15, 0, Math.PI * 2);
        ctx.fill();
        // Heal ring (pulsing)
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.2 + Math.sin(t * 4) * 0.15;
        ctx.strokeStyle = '#66ffaa';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, dz + Math.sin(t * 3) * 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      }

      // ============ NEW ENEMY TYPES ============

      case 'bomber': {
        // Bulky round body with mine hatches
        ctx.rotate(faceAng + Math.PI / 2);
        const grad = ctx.createRadialGradient(0, 0, sz * 0.1, 0, 0, sz);
        grad.addColorStop(0, '#ffaa55');
        grad.addColorStop(0.6, '#ff6633');
        grad.addColorStop(1, '#882211');
        ctx.fillStyle = grad;
        ctx.shadowColor = '#ff6633';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, 0, sz * 0.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        // Mine hatch marks (3 circles on body)
        ctx.fillStyle = '#331100';
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 + t * 0.5;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * sz * 0.45, Math.sin(a) * sz * 0.45, sz * 0.15, 0, Math.PI * 2);
          ctx.fill();
        }
        // Warning stripes
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, sz * 0.6, -0.5, 0.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, sz * 0.6, Math.PI - 0.5, Math.PI + 0.5);
        ctx.stroke();
        // Center eye
        ctx.fillStyle = '#ffdd00';
        ctx.shadowColor = '#ffdd00';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(0, -sz * 0.15, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        break;
      }

      case 'cloaker': {
        // Ghostly stealth ship - alpha handled in parent draw
        ctx.rotate(faceAng + Math.PI / 2);
        // Swept phantom body
        ctx.fillStyle = '#8844cc';
        ctx.shadowColor = '#aa66ff';
        ctx.shadowBlur = e._cloaked ? 15 : 6;
        ctx.beginPath();
        ctx.moveTo(0, -sz);
        ctx.lineTo(sz * 0.5, sz * 0.2);
        ctx.lineTo(sz * 0.3, sz * 0.6);
        ctx.lineTo(0, sz * 0.4);
        ctx.lineTo(-sz * 0.3, sz * 0.6);
        ctx.lineTo(-sz * 0.5, sz * 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        // Phase shimmer lines
        ctx.strokeStyle = 'rgba(200,140,255,0.3)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const oy = -sz * 0.4 + i * sz * 0.35;
          ctx.beginPath();
          ctx.moveTo(-sz * 0.3, oy);
          ctx.lineTo(sz * 0.3, oy + Math.sin(t * 4 + i) * 3);
          ctx.stroke();
        }
        // Eyes (red when uncloaked)
        const eyeColor = e._cloaked ? 'rgba(255,100,255,0.4)' : '#ff44ff';
        ctx.fillStyle = eyeColor;
        ctx.shadowColor = eyeColor;
        ctx.shadowBlur = e._cloaked ? 2 : 8;
        ctx.beginPath();
        ctx.arc(-sz * 0.15, -sz * 0.2, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sz * 0.15, -sz * 0.2, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        break;
      }

      case 'summoner': {
        // Arcane floating orb with rune circle
        const pulse2 = 0.85 + Math.sin(t * 3) * 0.15;
        // Rune circle (outer)
        ctx.strokeStyle = 'rgba(204,68,255,0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, sz * 1.2 * pulse2, 0, Math.PI * 2);
        ctx.stroke();
        // Rune glyphs around circle
        ctx.save();
        ctx.rotate(t * 0.8);
        ctx.fillStyle = 'rgba(204,68,255,0.5)';
        ctx.font = `${Math.max(6, sz * 0.3)}px monospace`;
        ctx.textAlign = 'center';
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const rx = Math.cos(a) * sz * 1.1;
          const ry = Math.sin(a) * sz * 1.1;
          ctx.fillText('\u2726', rx, ry + 3);
        }
        ctx.restore();
        // Central orb
        const orbGrad = ctx.createRadialGradient(0, 0, sz * 0.05, 0, 0, sz * 0.7);
        orbGrad.addColorStop(0, '#ffffff');
        orbGrad.addColorStop(0.3, '#dd88ff');
        orbGrad.addColorStop(0.7, '#cc44ff');
        orbGrad.addColorStop(1, '#440066');
        ctx.fillStyle = orbGrad;
        ctx.shadowColor = '#cc44ff';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, sz * 0.6 * pulse2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        // Inner energy swirl
        ctx.strokeStyle = 'rgba(255,200,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, sz * 0.3, t * 2, t * 2 + Math.PI * 1.2);
        ctx.stroke();
        break;
      }

      case 'turret': {
        // Stationary gun platform
        // Base platform (octagon)
        ctx.fillStyle = '#887722';
        ctx.shadowColor = '#ccaa33';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const r = sz * 0.9;
          i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r)
            : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        // Armor ring
        ctx.strokeStyle = '#aaaa44';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, sz * 0.7, 0, Math.PI * 2);
        ctx.stroke();
        // Rotating gun barrel
        ctx.save();
        ctx.rotate(faceAng + Math.PI / 2);
        ctx.fillStyle = '#666633';
        ctx.fillRect(-sz * 0.12, -sz * 1.1, sz * 0.24, sz * 0.8);
        // Muzzle flash hint
        ctx.fillStyle = '#ffee44';
        ctx.shadowColor = '#ffee44';
        ctx.shadowBlur = 4 + Math.sin(t * 12) * 3;
        ctx.beginPath();
        ctx.arc(0, -sz * 1.1, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
        // Center sensor
        ctx.fillStyle = '#ff4444';
        ctx.shadowColor = '#ff4444';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(0, 0, sz * 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        break;
      }

      case 'shielder': {
        // Shield-projecting ship with visible barrier
        // Body (drawn rotated toward player)
        ctx.save();
        ctx.rotate(faceAng + Math.PI / 2);
        const sGrad = ctx.createLinearGradient(0, -sz, 0, sz * 0.8);
        sGrad.addColorStop(0, '#55ccee');
        sGrad.addColorStop(0.5, '#33aacc');
        sGrad.addColorStop(1, '#115566');
        ctx.fillStyle = sGrad;
        ctx.shadowColor = '#33aacc';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(0, -sz * 0.8);
        ctx.quadraticCurveTo(sz * 0.6, -sz * 0.2, sz * 0.5, sz * 0.3);
        ctx.lineTo(0, sz * 0.6);
        ctx.lineTo(-sz * 0.5, sz * 0.3);
        ctx.quadraticCurveTo(-sz * 0.6, -sz * 0.2, 0, -sz * 0.8);
        ctx.fill();
        ctx.shadowBlur = 0;
        // Shield projector nodes
        ctx.fillStyle = '#88eeff';
        ctx.beginPath();
        ctx.arc(-sz * 0.35, -sz * 0.1, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sz * 0.35, -sz * 0.1, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore(); // back to translated-only (no rotation)
        // Draw barrier arc in world-space angle (still translated to e.x, e.y)
        if (e._barrierHP > 0) {
          const bAlpha = Math.max(0.15, e._barrierHP / (e._barrierMaxHP || 40));
          ctx.globalAlpha = bAlpha;
          ctx.strokeStyle = '#44ddff';
          ctx.lineWidth = 3;
          ctx.shadowColor = '#44ddff';
          ctx.shadowBlur = 10;
          const bAng = e._barrierAngle || 0;
          const bArc = (e._barrierArc || 1.2) / 2;
          ctx.beginPath();
          ctx.arc(0, 0, e._barrierRadius || 100, bAng - bArc, bAng + bArc);
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        }
        break;
      }

      default: {
        // Generic fallback diamond
        ctx.rotate(faceAng + Math.PI / 2);
        ctx.fillStyle = e.color;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(0, -sz);
        ctx.lineTo(sz * 0.7, 0);
        ctx.lineTo(0, sz * 0.8);
        ctx.lineTo(-sz * 0.7, 0);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  },

  // ============ ELITE ENEMY TYPES ============
  _drawElite(ctx, e, t, faceAng) {
    const sz = e.size;
    const type = e.type;
    const pulse = 0.9 + Math.sin(t * 3.5 + e.x * 0.05) * 0.1;

    // Elite aura ring
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = e.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, sz * 1.5 + Math.sin(t * 2) * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    switch (type) {
      case 'commander': {
        // Star-shaped with commanding aura
        ctx.rotate(t * 0.4);
        const cz = sz * pulse;
        // 5-pointed star
        ctx.fillStyle = e.color;
        ctx.shadowColor = '#ffcc00';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = i * Math.PI / 5 - Math.PI / 2;
          const r = i % 2 === 0 ? cz : cz * 0.45;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        // Inner gradient
        ctx.shadowBlur = 0;
        const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, cz * 0.4);
        cg.addColorStop(0, '#ffffff');
        cg.addColorStop(1, 'rgba(255,170,0,0)');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(0, 0, cz * 0.4, 0, Math.PI * 2);
        ctx.fill();
        // Command crown lines
        ctx.strokeStyle = 'rgba(255,255,200,0.3)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
          const a = i * Math.PI * 2 / 5 - Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * cz * 1.3, Math.sin(a) * cz * 1.3);
          ctx.stroke();
        }
        break;
      }
      case 'berserker': {
        // Jagged aggressive shape with rage flames
        ctx.rotate(faceAng + Math.PI / 2);
        const bz = sz * pulse;
        // Jagged body
        ctx.fillStyle = e.color;
        ctx.shadowColor = '#ff4400';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.moveTo(0, -bz * 1.2);
        ctx.lineTo(-bz * 0.3, -bz * 0.5);
        ctx.lineTo(-bz * 1.0, -bz * 0.2);
        ctx.lineTo(-bz * 0.5, bz * 0.1);
        ctx.lineTo(-bz * 0.8, bz * 0.8);
        ctx.lineTo(0, bz * 0.4);
        ctx.lineTo(bz * 0.8, bz * 0.8);
        ctx.lineTo(bz * 0.5, bz * 0.1);
        ctx.lineTo(bz * 1.0, -bz * 0.2);
        ctx.lineTo(bz * 0.3, -bz * 0.5);
        ctx.closePath();
        ctx.fill();
        // Rage flames (flickering)
        ctx.shadowBlur = 0;
        for (let i = 0; i < 4; i++) {
          const fx = (Math.random() - 0.5) * bz * 0.8;
          const fy = -bz * 0.6 - Math.random() * bz * 0.6;
          const fs = 2 + Math.random() * 3;
          ctx.fillStyle = `rgba(255,${100 + Math.random() * 100},0,${0.4 + Math.random() * 0.3})`;
          ctx.beginPath();
          ctx.arc(fx, fy, fs, 0, Math.PI * 2);
          ctx.fill();
        }
        // Rage eye
        ctx.fillStyle = '#ffff00';
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, -bz * 0.2, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        break;
      }
      case 'sniper': {
        // Elongated scope ship (fallback when no sprite)
        ctx.rotate(faceAng + Math.PI / 2);
        const snz = sz;
        const sg = ctx.createLinearGradient(0, -snz * 1.5, 0, snz);
        sg.addColorStop(0, '#cc88ff');
        sg.addColorStop(1, '#552288');
        ctx.fillStyle = sg;
        ctx.shadowColor = '#aa44ff';
        ctx.shadowBlur = 12;
        // Long narrow body
        ctx.beginPath();
        ctx.moveTo(0, -snz * 1.5);
        ctx.lineTo(-snz * 0.3, -snz * 0.3);
        ctx.lineTo(-snz * 0.6, snz * 0.3);
        ctx.lineTo(0, snz * 0.7);
        ctx.lineTo(snz * 0.6, snz * 0.3);
        ctx.lineTo(snz * 0.3, -snz * 0.3);
        ctx.closePath();
        ctx.fill();
        // Scope lens
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ff88ff';
        ctx.shadowColor = '#ff44ff';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(0, -snz * 1.1, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        break;
      }
      default: {
        // Generic elite diamond
        ctx.rotate(t * 0.5);
        const ez = sz * pulse;
        ctx.fillStyle = e.color;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.moveTo(0, -ez * 1.2);
        ctx.lineTo(ez, 0);
        ctx.lineTo(0, ez * 1.2);
        ctx.lineTo(-ez, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.4;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }
    }
  },

  // ============ BOSS TYPES ============
  _drawBoss(ctx, e, t, faceAng) {
    const sz = e.size;
    const type = e.type;
    const hpPct = e.hp / e.maxHP;

    switch (type) {
      case 'sentinel': {
        // === SENTINEL ALPHA: Mechanical hexagon + rotating segments + shield rings ===
        // Outer rotating armor segments (6 pieces, counter-rotating)
        ctx.save();
        ctx.rotate(-t * 0.6);
        ctx.strokeStyle = '#ff9933';
        ctx.lineWidth = 3;
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3;
          const gap = 0.15;
          ctx.beginPath();
          ctx.arc(0, 0, sz * 1.15, a + gap, a + Math.PI / 3 - gap);
          ctx.stroke();
        }
        ctx.restore();

        // Main hex body
        const sg = ctx.createRadialGradient(0, 0, sz * 0.15, 0, 0, sz);
        sg.addColorStop(0, '#ffcc66');
        sg.addColorStop(0.5, e.color);
        sg.addColorStop(1, '#663300');
        ctx.fillStyle = sg;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 25;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3 - Math.PI / 6;
          i === 0 ? ctx.moveTo(Math.cos(a) * sz, Math.sin(a) * sz)
            : ctx.lineTo(Math.cos(a) * sz, Math.sin(a) * sz);
        }
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;

        // Armor plate divisions
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3 - Math.PI / 6;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * sz * 0.9, Math.sin(a) * sz * 0.9);
          ctx.stroke();
        }

        // Inner tech ring
        ctx.strokeStyle = '#ffdd88';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, sz * 0.55, 0, Math.PI * 2);
        ctx.stroke();

        // Core eye (changes color with HP)
        const eyeColor = hpPct > 0.5 ? '#ffdd00' : (hpPct > 0.25 ? '#ff8800' : '#ff2200');
        const eyePulse = 0.8 + Math.sin(t * 4) * 0.2;
        ctx.fillStyle = eyeColor;
        ctx.shadowColor = eyeColor;
        ctx.shadowBlur = 18 * eyePulse;
        ctx.beginPath();
        ctx.arc(0, 0, sz * 0.2 * eyePulse, 0, Math.PI * 2);
        ctx.fill();
        // Eye pupil
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, sz * 0.08, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Low HP warning sparks
        if (hpPct < 0.3) {
          ctx.strokeStyle = '#ff4400';
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.6;
          for (let i = 0; i < 3; i++) {
            const sa = Math.random() * Math.PI * 2;
            const sr = sz * (0.4 + Math.random() * 0.5);
            ctx.beginPath();
            ctx.moveTo(Math.cos(sa) * sr, Math.sin(sa) * sr);
            ctx.lineTo(Math.cos(sa + 0.3) * sr * 1.2, Math.sin(sa + 0.3) * sr * 1.2);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
        break;
      }

      case 'collector': {
        // === THE COLLECTOR: Spider/crab with extending arms + tractor glow ===
        const cz = sz;
        // Rotating arms (8 spider legs)
        ctx.save();
        ctx.rotate(t * 0.35);
        ctx.strokeStyle = '#bb66ff';
        ctx.lineWidth = 2.5;
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4;
          const extend = 0.8 + Math.sin(t * 2 + i * 0.8) * 0.2;
          const endR = cz * 1.2 * extend;
          const midR = cz * 0.6;
          const midA = a + Math.sin(t * 1.5 + i) * 0.15;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * cz * 0.35, Math.sin(a) * cz * 0.35);
          ctx.quadraticCurveTo(
            Math.cos(midA) * midR, Math.sin(midA) * midR,
            Math.cos(a) * endR, Math.sin(a) * endR
          );
          ctx.stroke();
          // Claw tip
          ctx.fillStyle = '#dd88ff';
          ctx.beginPath();
          ctx.arc(Math.cos(a) * endR, Math.sin(a) * endR, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        // Central body (oval)
        const cg = ctx.createRadialGradient(0, 0, cz * 0.1, 0, 0, cz * 0.7);
        cg.addColorStop(0, '#dd99ff');
        cg.addColorStop(0.5, e.color);
        cg.addColorStop(1, '#440077');
        ctx.fillStyle = cg;
        ctx.shadowColor = '#aa00ff';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.ellipse(0, 0, cz * 0.7, cz * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Carapace pattern
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(0, 0, cz * 0.45, cz * 0.35, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Multi-eye cluster
        const eyePositions = [[0, -cz * 0.15], [-cz * 0.15, 0], [cz * 0.15, 0], [0, cz * 0.12]];
        for (const [ex, ey] of eyePositions) {
          ctx.fillStyle = hpPct > 0.5 ? '#ff44ff' : '#ff2222';
          ctx.shadowColor = '#ff00ff';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(ex, ey, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;

        // Tractor beam ambient
        ctx.globalAlpha = 0.08 + Math.sin(t * 2) * 0.04;
        ctx.fillStyle = '#cc66ff';
        ctx.beginPath();
        ctx.arc(0, 0, cz * 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }

      case 'harbinger': {
        // === HARBINGER: Skull/dreadnought + void rings + meteor aura ===
        const hz = sz;

        // Void energy rings (multiple, different speeds)
        for (let ring = 0; ring < 3; ring++) {
          const rr = hz * (1.0 + ring * 0.25);
          const rSpeed = (1 + ring * 0.7) * (ring % 2 === 0 ? 1 : -1);
          ctx.save();
          ctx.rotate(t * rSpeed);
          ctx.strokeStyle = ring === 0 ? '#ff0044' : (ring === 1 ? '#ff3366' : '#cc0033');
          ctx.lineWidth = 2 - ring * 0.4;
          ctx.globalAlpha = 0.25 - ring * 0.06;
          // Partial arcs
          for (let seg = 0; seg < 3; seg++) {
            const sa = seg * Math.PI * 2 / 3;
            ctx.beginPath();
            ctx.arc(0, 0, rr, sa, sa + Math.PI * 0.5);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
          ctx.restore();
        }

        // Main body - skull-like shape
        const hg = ctx.createRadialGradient(0, 0, hz * 0.1, 0, 0, hz * 0.85);
        hg.addColorStop(0, '#ff6688');
        hg.addColorStop(0.4, e.color);
        hg.addColorStop(1, '#440011');
        ctx.fillStyle = hg;
        ctx.shadowColor = '#ff0044';
        ctx.shadowBlur = 30;

        // Skull shape (rounded pentagon)
        ctx.beginPath();
        ctx.moveTo(0, -hz * 0.85);
        ctx.quadraticCurveTo(-hz * 0.7, -hz * 0.6, -hz * 0.9, -hz * 0.05);
        ctx.quadraticCurveTo(-hz * 0.85, hz * 0.5, -hz * 0.4, hz * 0.75);
        ctx.lineTo(0, hz * 0.55);
        ctx.lineTo(hz * 0.4, hz * 0.75);
        ctx.quadraticCurveTo(hz * 0.85, hz * 0.5, hz * 0.9, -hz * 0.05);
        ctx.quadraticCurveTo(hz * 0.7, -hz * 0.6, 0, -hz * 0.85);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;

        // Skull detail lines
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1.5;
        // Nose ridge
        ctx.beginPath();
        ctx.moveTo(0, -hz * 0.2);
        ctx.lineTo(0, hz * 0.3);
        ctx.stroke();
        // Cheek lines
        ctx.beginPath();
        ctx.moveTo(-hz * 0.35, hz * 0.1);
        ctx.lineTo(-hz * 0.25, hz * 0.55);
        ctx.moveTo(hz * 0.35, hz * 0.1);
        ctx.lineTo(hz * 0.25, hz * 0.55);
        ctx.stroke();

        // Eye sockets (left + right - glowing)
        const eyeFlicker = 0.7 + Math.sin(t * 6) * 0.3;
        for (const side of [-1, 1]) {
          const ex = side * hz * 0.35;
          const ey = -hz * 0.2;
          // Socket dark
          ctx.fillStyle = '#220011';
          ctx.beginPath();
          ctx.ellipse(ex, ey, hz * 0.18, hz * 0.14, 0, 0, Math.PI * 2);
          ctx.fill();
          // Glowing eye
          ctx.fillStyle = hpPct > 0.5 ? `rgba(255,0,68,${eyeFlicker})` : `rgba(255,255,0,${eyeFlicker})`;
          ctx.shadowColor = hpPct > 0.5 ? '#ff0044' : '#ffff00';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(ex, ey, hz * 0.1, 0, Math.PI * 2);
          ctx.fill();
          // Pupil
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(ex + Math.cos(faceAng) * 2, ey + Math.sin(faceAng) * 2, hz * 0.04, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;

        // Rage mode particles (low HP)
        if (hpPct < 0.4) {
          ctx.globalAlpha = 0.5;
          for (let i = 0; i < 5; i++) {
            const pa = Math.random() * Math.PI * 2;
            const pr = hz * (0.5 + Math.random() * 0.8);
            const ps = 1.5 + Math.random() * 2.5;
            ctx.fillStyle = `rgba(255,${Math.floor(Math.random() * 100)},0,0.6)`;
            ctx.beginPath();
            ctx.arc(Math.cos(pa) * pr, Math.sin(pa) * pr, ps, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
        break;
      }

      default: {
        // Generic boss - double hex with eye (fallback)
        ctx.rotate(t * 0.3);
        const gz = sz;
        const gg = ctx.createRadialGradient(0, 0, gz * 0.15, 0, 0, gz);
        gg.addColorStop(0, '#ffaacc');
        gg.addColorStop(0.5, e.color);
        gg.addColorStop(1, '#440022');
        ctx.fillStyle = gg;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 25;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3;
          i === 0 ? ctx.moveTo(Math.cos(a) * gz, Math.sin(a) * gz)
            : ctx.lineTo(Math.cos(a) * gz, Math.sin(a) * gz);
        }
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        // Inner hex
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3 + Math.PI / 6;
          const r = gz * 0.55;
          i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r)
            : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        // Eye
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(0, 0, gz * 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  },

  _drawHPBar(ctx, e) {
    if (e.hp >= e.maxHP) return;
    const barW = e.isBoss ? e.size * 3 : e.size * 2;
    const barH = e.isBoss ? 8 : 5;
    const pct = e.hp / e.maxHP;
    const bx = e.x - barW / 2;
    const by = e.y - e.size - (e.isBoss ? 25 : 14);

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);

    // HP fill gradient
    const hpColor = pct > 0.5 ? '#00ff88' : pct > 0.25 ? '#ffaa00' : '#ff4444';
    const hpDark = pct > 0.5 ? '#00aa44' : pct > 0.25 ? '#cc6600' : '#aa0000';
    const grad = ctx.createLinearGradient(bx, by, bx, by + barH);
    grad.addColorStop(0, hpColor);
    grad.addColorStop(1, hpDark);
    ctx.fillStyle = grad;
    ctx.fillRect(bx, by, barW * pct, barH);

    // Boss: name tag + phase indicator
    if (e.isBoss) {
      ctx.fillStyle = '#ffdd00';
      ctx.font = 'bold 11px Orbitron';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText(e.name || 'BOSS', e.x, by - 5);
      ctx.shadowBlur = 0;
      // HP percentage
      ctx.fillStyle = '#ffffff';
      ctx.font = '8px Orbitron';
      ctx.fillText(Math.ceil(pct * 100) + '%', e.x, by + barH + 9);
    }
  }
};

export default Enemies;
