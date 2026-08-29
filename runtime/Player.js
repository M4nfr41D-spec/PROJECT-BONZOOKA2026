// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// Player.js - Player Controller (v2.5.0 - visual upgrade only)
// ============================================================

import { State } from './State.js';
import { Input } from './Input.js';
import { Bullets } from './Bullets.js';
import { Particles } from './Particles.js';

export const Player = {
  _hitFlash: 0,
  _thrustAnim: 0,
  _fireFlash: 0,

  update(dt, canvas, explorationMode = false) {
    const p = State.player;
    const cfg = State.data.config?.player || {};

    // ========== CORRUPTION DOT ==========
    if (p.dotT && p.dotT > 0) {
      p.dotT -= dt;
      this.takeDamage(p.maxHP * (p.dotPct || 0) * dt);
      if (p.dotT <= 0) { p.dotT = 0; p.dotPct = 0; }
    }

    // ========== MOVEMENT (WASD) ==========
    const move = Input.getMovement();

    const accel = cfg.acceleration || 3000;
    const friction = cfg.friction || 0.75;
    const deadzone = cfg.deadzone || 0.1;

    if (Math.abs(move.dx) > deadzone || Math.abs(move.dy) > deadzone) {
      const targetVX = move.dx * p.speed;
      const targetVY = move.dy * p.speed;
      p.vx += (targetVX - p.vx) * Math.min(1, accel * dt / p.speed);
      p.vy += (targetVY - p.vy) * Math.min(1, accel * dt / p.speed);
    } else {
      p.vx *= friction;
      p.vy *= friction;
      if (Math.abs(p.vx) < 5) p.vx = 0;
      if (Math.abs(p.vy) < 5) p.vy = 0;
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Boundary clamping
    const margin = p.radius + 5;
    if (explorationMode) {
      const zone = State.world?.currentZone;
      if (zone) {
        p.x = Math.max(margin, Math.min(zone.width - margin, p.x));
        p.y = Math.max(margin, Math.min(zone.height - margin, p.y));
      }
    } else {
      p.x = Math.max(margin, Math.min(canvas.width - margin, p.x));
      p.y = Math.max(margin, Math.min(canvas.height - margin, p.y));
    }

    // ========== AIM: Target Lock or Free Aim ==========
    const lockId = State.input.targetLock;
    let lockedEnemy = null;
    
    if (lockId) {
      lockedEnemy = State.enemies?.find(e => e.id === lockId && !e.dead);
      if (!lockedEnemy) {
        // Target died → auto-switch to nearest in range
        const maxRange = 500;
        const alive = (State.enemies || []).filter(e => !e.dead && Math.hypot(e.x - p.x, e.y - p.y) < maxRange);
        if (alive.length > 0) {
          alive.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
          lockedEnemy = alive[0];
          State.input.targetLock = lockedEnemy.id;
        } else {
          State.input.targetLock = null;
        }
      }
      // Range check — break lock if too far
      if (lockedEnemy && Math.hypot(lockedEnemy.x - p.x, lockedEnemy.y - p.y) > 700) {
        State.input.targetLock = null;
        lockedEnemy = null;
      }
    }
    
    if (lockedEnemy) {
      // Smooth aim toward locked target (not instant snap)
      const targetAngle = Math.atan2(lockedEnemy.y - p.y, lockedEnemy.x - p.x);
      let angleDiff = targetAngle - p.angle;
      // Normalize to [-PI, PI]
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      // Smooth tracking (fast but not instant — feels like lock, not teleport)
      p.angle += angleDiff * Math.min(1, dt * 12);
    } else if (explorationMode) {
      const Camera = State.modules?.Camera;
      if (Camera) {
        const worldMouse = Camera.screenToWorld(State.input.mouseX, State.input.mouseY);
        p.angle = Math.atan2(worldMouse.y - p.y, worldMouse.x - p.x);
      } else {
        p.angle = Input.getAimAngle(p.x, p.y);
      }
    } else {
      p.angle = Input.getAimAngle(p.x, p.y);
    }
    
    // Store locked enemy ref for draw (reticle)
    this._lockedEnemy = lockedEnemy;

    // ========== HEAT SYSTEM ==========
    // Per-weapon heat generation per shot
    const heatPerShot = {
      laser: 1.2,    // low heat, sustained fire (~18s before overheat)
      plasma: 2.0,   // medium heat (~13s)
      railgun: 6.0,  // high heat per shot but slow fire (~17s)
      gatling: 0.7,  // very low per bullet (~16s at max fire rate)
      beam: 1.5,
      scatter: 2.5,
      missile: 4.0,
      nova: 3.0,
    };
    const heatGenRate = heatPerShot[p.weaponType] || 3.0;
    
    // Natural heat dissipation
    const baseCoolRate = 18; // heat units per second
    const isFiring = State.input.fire;
    
    // OVERHEAT PUNISHMENT: if overheated AND still holding fire → NO COOLING
    // Must release fire button to start recovery. Rewards trigger discipline.
    let effectiveCoolRate;
    if (p.overheated) {
      if (isFiring) {
        effectiveCoolRate = 0; // Locked! Release to cool
        // Track that player hasn't released yet
        p._overheatReleased = false;
      } else {
        // Player released — start fast recovery after brief delay
        if (!p._overheatReleased) {
          p._overheatReleased = true;
          p._overheatReleasedAt = performance.now();
        }
        // 0.3s release grace period before cooling kicks in
        const releasedMs = performance.now() - (p._overheatReleasedAt || 0);
        effectiveCoolRate = releasedMs > 300 ? baseCoolRate * 2.5 : baseCoolRate * 0.5;
      }
    } else {
      // Normal operation: cools faster when NOT firing
      effectiveCoolRate = isFiring ? baseCoolRate * 0.3 : baseCoolRate * 1.5;
    }
    
    // Coolant pickup timer (no heat buildup while active)
    if (p.coolantTimer > 0) {
      p.coolantTimer -= dt;
      p.heat = 0; // forced to zero during coolant
      if (p.coolantTimer <= 0) {
        p.coolantTimer = 0;
      }
    } else {
      // Natural cooling
      if (p.heat > 0) {
        p.heat = Math.max(0, p.heat - effectiveCoolRate * dt);
      }
    }
    
    // Overheat recovery: must cool below 20% to resume firing
    if (p.overheated && p.heat <= 20) {
      p.overheated = false;
      p._overheatReleased = false;
      p._overheatReleasedAt = 0;
    }
    
    // ========== SHOOTING (manual fire, hold button) ==========
    p.fireCooldown -= dt;
    const canFire = State.input.fire && !p.overheated && p.fireCooldown <= 0;
    if (canFire) {
      this.fire();
      this._fireFlash = 0.09;
      p.fireCooldown = 1 / this.getWeaponFireRate();
      
      // Add heat (unless coolant is active)
      if (p.coolantTimer <= 0) {
        p.heat += heatGenRate;
        if (p.heat >= p.heatMax) {
          p.heat = p.heatMax;
          p.overheated = true;
          if (Audio?.shieldBreak) Audio.shieldBreak();
        }
      }
    }

    // ========== SECONDARY WEAPON (A50: auto-fire cluster missiles) ==========
    if (State.meta.equipment?.secondary) {
      p._secondaryCooldown = (p._secondaryCooldown || 0) - dt;
      if (p._secondaryCooldown <= 0) {
        if (this.fireSecondary()) p._secondaryCooldown = this.getSecondaryCooldown();
      }
    }

    // ========== SHIELD REGEN ==========
    p.shieldRegenDelay -= dt;
    if (p.shieldRegenDelay <= 0 && p.shield < p.maxShield) {
      const regenRate = cfg.shieldRegenRate || 5;
      p.shield = Math.min(p.maxShield, p.shield + regenRate * dt);
    }
    
    // ========== KILL STREAK DECAY ==========
    const streak = State.run.streak;
    if (streak && streak.count > 0) {
      streak.timer += dt;
      // Streak breaks after 3.5s without a kill (generous window)
      if (streak.timer > 3.5) {
        if (streak.count >= 5) {
          // Announce streak break if it was significant
          const Particles = State.modules?.Particles;
          if (Particles) Particles.text(p.x, p.y - 30, `${streak.count}× STREAK ENDED`, '#ff4444', 14);
        }
        streak.count = 0;
        streak.timer = 0;
        streak.xpMult = 1;
        streak.lootMult = 1;
      }
    }
    
    // ========== ACTIVE ABILITIES ==========
    this.updateAbilities(dt);

    // ========== VISUAL: thrust lerp + flash decay ==========
    const isMoving = Math.abs(p.vx) > 15 || Math.abs(p.vy) > 15;
    this._thrustAnim += ((isMoving ? 1 : 0) - this._thrustAnim) * Math.min(1, dt * 8);
    if (this._hitFlash > 0) this._hitFlash -= dt;
    if (this._fireFlash > 0) this._fireFlash -= dt;

    // Engine trail particles
    if (isMoving && Math.random() < 0.4) {
      const bx = p.x - Math.cos(p.angle) * 18;
      const by = p.y - Math.sin(p.angle) * 18;
      Particles.trail(bx, by, '#00ccff', 2);
    }

    // Update drone companion
    this.updateDrone(dt);
  },

  // A50: secondary weapon — auto-fires homing CLUSTER missiles (gravity pull on detonation)
  getSecondaryCooldown() {
    const p = State.player;
    return Math.max(0.8, 1.5 / Math.max(0.6, (p.fireRate || 1) * 0.5 + 0.5));
  },

  fireSecondary() {
    const p = State.player;
    const Bullets = State.modules?.Bullets;
    if (!Bullets) return false;
    // need a target so we don't waste missiles into empty space
    let target = null, bd = 700;
    for (const e of (State.enemies || [])) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bd) { bd = d; target = e; }
    }
    if (!target) return false;
    const Particles = State.modules?.Particles;
    const Audio = State.modules?.Audio;
    const angle = Math.atan2(target.y - p.y, target.x - p.x);
    const spd = (p.bulletSpeed || 400) * 0.7;
    const dmg = Math.max(2, Math.floor((p.damage || 5) * 1.4));
    Bullets.spawn({
      x: p.x + Math.cos(angle) * 20,
      y: p.y + Math.sin(angle) * 20,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      damage: dmg, piercing: 0, isPlayer: true, crit: false,
      bulletType: 'missile', weaponType: 'missile', homing: true,
      source: 'secondary', payload: 'cluster', splashRadius: 56,
      allowOnKillEffects: false // derived AoE must not spawn on-kill cascades
    });
    if (Particles) Particles.flash(p.x + Math.cos(angle) * 16, p.y + Math.sin(angle) * 16, '#ff9933', 4);
    if (Audio?.shootHoming) Audio.shootHoming();
    return true;
  },

  fire() {
    const p = State.player;
    const wType = p.weaponType || 'laser';
    const wDef = p.weaponDefs?.[wType] || p.weaponDefs?.laser;
    const isStationaryShot = Math.hypot(p.vx || 0, p.vy || 0) < 18;
    const Audio = State.modules?.Audio;
    
    // Nova becomes a true close-range AoE pulse, not a roaming projectile ring.
    if (wType === 'nova') {
      const dmg = Math.max(1, Math.floor(p.damage * (wDef.damage || 1)));
      Bullets.triggerNovaPulse({
        x: p.x,
        y: p.y,
        damage: dmg,
        crit: Math.random() * 100 < p.critChance,
        color: wDef.color || '#aa66ff',
        radius: Math.max(72, (p.radius || 18) * 6)
      });
      Particles.spawn(p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22, 'muzzle');
      Particles.flash(p.x, p.y, wDef.color || '#aa66ff', 5);
      if (Audio?.weaponNova) Audio.weaponNova();
      else if (Audio?.shootBeam) Audio.shootBeam();
      return;
    }

    const baseAngle = p.angle;
    const dmg = Math.max(1, Math.floor(p.damage * (wDef.damage || 1)));
    const bSpd = p.bulletSpeed * (wDef.bulletSpeed || 1);
    const pierce = p.piercing + (wDef.piercing || 0);

    // Missile pod: twin wing launchers with light convergence and later homing.
    if (wType === 'missile') {
      const rightX = Math.cos(baseAngle + Math.PI * 0.5);
      const rightY = Math.sin(baseAngle + Math.PI * 0.5);
      const forwardX = Math.cos(baseAngle);
      const forwardY = Math.sin(baseAngle);
      const wingOffset = Math.max(10, (p.radius || 18) * 0.75);
      const forwardOffset = Math.max(14, (p.radius || 18) * 1.05);
      const mounts = [-1, 1];
      for (const side of mounts) {
        const spawnX = p.x + forwardX * forwardOffset + rightX * wingOffset * side;
        const spawnY = p.y + forwardY * forwardOffset + rightY * wingOffset * side;
        const converge = side * -0.03;
        const a = baseAngle + converge;
        Bullets.spawn({
          x: spawnX,
          y: spawnY,
          vx: Math.cos(a) * bSpd,
          vy: Math.sin(a) * bSpd,
          damage: dmg,
          piercing: pierce,
          isPlayer: true,
          crit: Math.random() * 100 < p.critChance,
          bulletType: wDef.bulletType || 'missile',
          weaponType: wType,
          stationaryShot: isStationaryShot,
          homing: true
        });
      }
      Particles.spawn(p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22, 'muzzle');
      Particles.flash(p.x + forwardX * 20, p.y + forwardY * 20, wDef.color || '#ff8800', 4);
      if (Audio?.shootHoming) Audio.shootHoming();
      else if (Audio?.shootLaser) Audio.shootLaser();
      return;
    }

    // Weapon modifies projectile count additively.
    const count = Math.max(1, p.projectiles + (wDef.projectiles || 0));
    const spreadDeg = (p.spread || 0) + (wDef.spread || 0);
    const spreadRad = spreadDeg * (Math.PI / 180);

    let angles = [];
    if (count === 1) {
      angles = [baseAngle];
    } else {
      const totalSpread = spreadRad * (count - 1);
      const startAngle = baseAngle - totalSpread / 2;
      for (let i = 0; i < count; i++) {
        angles.push(startAngle + (spreadRad * i));
      }
    }

    for (const angle of angles) {
      const jitter = wType === 'gatling' ? (Math.random() - 0.5) * 0.12 : 0;
      const a = angle + jitter;
      Bullets.spawn({
        x: p.x + Math.cos(a) * 20,
        y: p.y + Math.sin(a) * 20,
        vx: Math.cos(a) * bSpd,
        vy: Math.sin(a) * bSpd,
        damage: dmg,
        piercing: pierce,
        isPlayer: true,
        crit: Math.random() * 100 < p.critChance,
        bulletType: wDef.bulletType || 'laser',
        weaponType: wType,
        stationaryShot: isStationaryShot
      });
    }

    const muzzleX = p.x + Math.cos(p.angle) * 22;
    const muzzleY = p.y + Math.sin(p.angle) * 22;
    Particles.muzzle(muzzleX, muzzleY, wDef.color || '#bfe9ff', p.angle, 1);

    if (Audio) {
      if (wType === 'laser' && Audio.shootLaser) Audio.shootLaser();
      else if (wType === 'plasma' && Audio.shootScatter) Audio.shootScatter();
      else if (wType === 'railgun' && Audio.shootRailgun) Audio.shootRailgun();
      else if (wType === 'gatling' && Audio.shootGatling) Audio.shootGatling();
      else Audio.shootLaser?.();
    }
  },
  
  // Switch weapon type
  switchWeapon(newType) {
    const p = State.player;
    if (!p.weaponDefs?.[newType]) return;
    const old = p.weaponType;
    p.weaponType = newType;
    const wDef = p.weaponDefs[newType];
    
    // Announce
    const Particles = State.modules?.Particles;
    if (Particles) {
      Particles.text(p.x, p.y - 30, `${wDef.label} EQUIPPED`, wDef.color, 16);
      Particles.ring(p.x, p.y, wDef.color, 40);
    }
    const Audio = State.modules?.Audio;
    if (Audio) Audio.itemEquip?.() || Audio.shieldRecharge?.();
    
    // console.log(`[WEAPON] ${old} → ${newType}`);
  },

  getWeaponFireRate() {
    const p = State.player;
    const wDef = p.weaponDefs?.[p.weaponType || 'laser'] || {};
    // Per-weapon minimum intervals (seconds between shots)
    const minIntervals = {
      laser: 0.055,   // rapid red lances
      plasma: 0.16,   // bursty close-range spreader
      railgun: 0.75,  // deliberate sniper cadence
      gatling: 0.05,  // fastest sustained fire
      beam: 0.15,
      scatter: 0.2,
      missile: 0.58   // slower twin salvo cadence
    };
    const minInterval = minIntervals[p.weaponType] || 0.1;
    const maxRate = 1 / minInterval;
    const rawRate = p.fireRate * (wDef.fireRate || 1);
    return Math.min(rawRate, maxRate);
  },

  takeDamage(amount) {
    const p = State.player;
    
    // Dash invulnerability
    if (p._dashInvuln) return;
    
    // ═══ v2.16.3: DODGE CHANCE ═══
    if (p.dodgeChance && Math.random() * 100 < p.dodgeChance) {
      const Particles = State.modules?.Particles;
      if (Particles) Particles.floatUp(p.x, p.y, 'DODGE', '#00ffcc', 12);
      return; // fully dodged
    }
    
    // ═══ v2.16.3: DAMAGE REDUCTION ═══
    if (p.damageReduction) {
      amount = Math.max(1, Math.floor(amount * (1 - p.damageReduction / 100)));
    }
    
    // Corruption objective: incoming damage scales with corruption level
    const obj = State.run?.objective;
    if (obj && obj.type === 'corruption' && obj.currentMult > 1) {
      amount = Math.floor(amount * obj.currentMult);
    }
    
    if (State.run?.stats) State.run.stats.damageTaken += amount;
    State.run._zoneDamageTaken = (State.run._zoneDamageTaken || 0) + amount;

    try {
      State.modules?.Director?.onPlayerHit?.(amount);
    } catch (e) { /* safe */ }

    // Shield absorbs first
    if (p.shield > 0) {
      const shieldDmg = Math.min(p.shield, amount);
      p.shield -= shieldDmg;
      amount -= shieldDmg;
      if (amount <= 0) {
        p.shieldRegenDelay = State.data.config?.player?.shieldRegenDelay || 3;
        return;
      }
    }

    p.hp -= amount;
    p.shieldRegenDelay = State.data.config?.player?.shieldRegenDelay || 3;
    this._hitFlash = 0.15;
    const Particles = State.modules?.Particles;
    if (Particles) Particles.spawn(p.x, p.y, 'playerHit');

    // ═══ v2.16.3: THORNS DAMAGE ═══
    if (p.thornsDamage && this._lastAttacker) {
      const tgt = this._lastAttacker;
      if (tgt && !tgt.dead) {
        const Enemies = State.modules?.Enemies;
        if (Enemies) Enemies.damage(tgt, p.thornsDamage, false);
        if (Particles) Particles.sparks(tgt.x, tgt.y, '#ff8844', 3);
      }
    }

    const Audio = State.modules?.Audio;
    if (Audio) Audio.hitPlayer();

    if (p.hp <= 0) {
      // ═══ v2.16.3: REVIVE CHANCE ═══
      if (p.reviveChance && Math.random() * 100 < p.reviveChance) {
        p.hp = Math.floor(p.maxHP * 0.3);
        if (Particles) {
          Particles.explosion(p.x, p.y, '#ffcc00', 20, 150);
          Particles.floatUp(p.x, p.y, 'REVIVED!', '#ffcc00', 16);
        }
        if (Audio) Audio.levelUp();
        return;
      }
      p.hp = 0;
      if (Particles) Particles.spawn(p.x, p.y, 'explosion');
      if (Audio) Audio.explosionBig();
    }
  },

  applyDot(dot) {
    const p = State.player;
    const dur = (dot && dot.duration) ? dot.duration : 4.0;
    const pct = (dot && dot.dpsPctMaxHp) ? dot.dpsPctMaxHp : 0.01;
    p.dotT = Math.max(p.dotT || 0, dur);
    p.dotPct = Math.max(p.dotPct || 0, pct);
  },

  isDead() {
    return State.player.hp <= 0;
  },

  // ============ ACTIVE ABILITIES SYSTEM ============
  // Q/1 = Dash (invuln burst), R/2 = Shield Burst (AoE + temp shield), F/3 = Orbital Strike (ring damage)
  _dashTrail: [],
  
  updateAbilities(dt) {
    const p = State.player;
    const ab = p.abilities;
    if (!ab) return;
    const input = State.input;
    const Particles = State.modules?.Particles;
    const AudioA = State.modules?.Audio;
    
    // Tick cooldowns
    for (const key of ['dash', 'shield', 'orbital']) {
      if (ab[key].cooldown > 0) ab[key].cooldown = Math.max(0, ab[key].cooldown - dt);
      if (ab[key].duration > 0) ab[key].duration = Math.max(0, ab[key].duration - dt);
      if (ab[key].duration <= 0) ab[key].active = false;
    }
    
    // ── DASH (Q/1): 0.15s invuln burst forward ──
    if (input.ability1 && ab.dash.cooldown <= 0 && !ab.dash.active) {
      input.ability1 = false; // consume press
      ab.dash.active = true;
      ab.dash.duration = 0.15;
      ab.dash.cooldown = ab.dash.maxCooldown;
      
      // Burst forward in aim direction
      const dashSpeed = p.speed * 4;
      p.vx = Math.cos(p.angle) * dashSpeed;
      p.vy = Math.sin(p.angle) * dashSpeed;
      
      // VFX: afterimage trail + flash
      if (Particles) {
        Particles.flash(p.x, p.y, '#00ccff', 10);
        for (let i = 0; i < 8; i++) {
          const bx = p.x - Math.cos(p.angle) * i * 8;
          const by = p.y - Math.sin(p.angle) * i * 8;
          Particles.trail(bx, by, '#00ccff', 4);
        }
      }
      if (AudioA?.portalEnter) AudioA.portalEnter(); // whoosh reuse
    }
    
    // Dash invuln: player takes no damage while active
    p._dashInvuln = ab.dash.active;
    
    // ── SHIELD BURST (R/2): AoE knockback + temp bonus shield ──
    if (input.ability2 && ab.shield.cooldown <= 0 && !ab.shield.active) {
      input.ability2 = false;
      ab.shield.active = true;
      ab.shield.duration = 0.3;
      ab.shield.cooldown = ab.shield.maxCooldown;
      
      // Grant temp shield (50% of maxHP)
      const shieldGain = Math.floor(p.maxHP * 0.5);
      p.shield = Math.min(p.maxShield + shieldGain, p.shield + shieldGain);
      
      // AoE damage to nearby enemies (200px radius)
      const aoeRadius = 200;
      const aoeDmg = Math.floor(p.damage * 2);
      for (const e of State.enemies) {
        if (e.dead) continue;
        const dist = Math.hypot(e.x - p.x, e.y - p.y);
        if (dist < aoeRadius) {
          const Enemies = State.modules?.Enemies;
          if (Enemies?.damage) Enemies.damage(e, aoeDmg);
        }
      }
      
      // VFX: expanding ring + shield flash
      if (Particles) {
        Particles.ring(p.x, p.y, '#00ffaa', aoeRadius);
        Particles.ring(p.x, p.y, '#00ffaa', aoeRadius * 0.6);
        Particles.flash(p.x, p.y, '#00ffaa', 15);
        Particles.screenShake = Math.max(Particles.screenShake || 0, 5);
      }
      if (AudioA?.shieldRecharge) AudioA.shieldRecharge();
    }
    
    // ── ORBITAL STRIKE (F/3): expanding ring of damage ──
    if (input.ability3 && ab.orbital.cooldown <= 0 && !ab.orbital.active) {
      input.ability3 = false;
      ab.orbital.active = true;
      ab.orbital.duration = 0.8;
      ab.orbital.cooldown = ab.orbital.maxCooldown;
      ab.orbital._radius = 0; // grows over duration
      ab.orbital._hitSet = new Set(); // track already-hit enemies
      
      if (AudioA?.explosionBig) AudioA.explosionBig();
    }
    
    // Orbital Strike: expanding damage ring
    if (ab.orbital.active && ab.orbital.duration > 0) {
      const maxRadius = 350;
      const progress = 1 - (ab.orbital.duration / 0.8);
      ab.orbital._radius = progress * maxRadius;
      const r = ab.orbital._radius;
      const orbDmg = Math.floor(p.damage * 4);
      
      // Hit enemies in the ring band (r-30 to r)
      for (const e of State.enemies) {
        if (e.dead || ab.orbital._hitSet?.has(e)) continue;
        const dist = Math.hypot(e.x - p.x, e.y - p.y);
        if (dist < r && dist > r - 40) {
          const Enemies = State.modules?.Enemies;
          if (Enemies?.damage) Enemies.damage(e, orbDmg);
          ab.orbital._hitSet?.add(e);
        }
      }
      
      // VFX: ring particles at current radius
      if (Particles && Math.random() < 0.5) {
        const angle = Math.random() * Math.PI * 2;
        Particles.trail(p.x + Math.cos(angle) * r, p.y + Math.sin(angle) * r, '#ff6600', 5);
      }
    }
  },
  
  // Draw orbital strike ring overlay (called from main draw)
  drawAbilityEffects(ctx) {
    const p = State.player;
    const ab = p.abilities;
    if (!ab) return;
    
    // Dash trail afterimage
    if (ab.dash.active) {
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#00ccff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    
    // Shield burst expanding ring
    if (ab.shield.active) {
      const progress = 1 - (ab.shield.duration / 0.3);
      const r = 200 * progress;
      ctx.strokeStyle = `rgba(0,255,170,${0.6 - progress * 0.6})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Orbital strike expanding ring
    if (ab.orbital.active) {
      const r = ab.orbital._radius || 0;
      // Outer ring
      ctx.strokeStyle = 'rgba(255,102,0,0.7)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();
      // Inner glow ring
      ctx.strokeStyle = 'rgba(255,200,0,0.3)';
      ctx.lineWidth = 30;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  },

  // ============ DRONE COMPANION SYSTEM ============
  _droneAngle: 0,
  _droneFireTimer: 0,

  updateDrone(dt) {
    const p = State.player;
    const drone = p.drone;
    if (!drone || !drone.active) return;

    // Orbit around player (radius from stats)
    const orbitSpeed = drone.type === 'shield' ? 1.5 : 2.2;
    this._droneAngle += dt * orbitSpeed;
    const orbitR = drone.orbitRadius || 45;
    drone.x = p.x + Math.cos(this._droneAngle) * orbitR;
    drone.y = p.y + Math.sin(this._droneAngle) * orbitR;

    if (drone.type === 'combat') {
      // Auto-fire at nearest enemy (or target-locked enemy)
      this._droneFireTimer -= dt;
      if (this._droneFireTimer <= 0) {
        let target = null;
        let maxRange = 320;
        
        // Prefer player's target lock
        const lockId = State.input?.targetLock;
        if (lockId) {
          const locked = State.enemies?.find(e => e.id === lockId && !e.dead);
          if (locked && Math.hypot(locked.x - drone.x, locked.y - drone.y) < maxRange) {
            target = locked;
          }
        }
        // Fallback: nearest
        if (!target) {
          let nearDist = maxRange;
          for (const e of State.enemies) {
            if (e.dead) continue;
            const d = Math.hypot(e.x - drone.x, e.y - drone.y);
            if (d < nearDist) { nearDist = d; target = e; }
          }
        }
        if (target) {
          const ang = Math.atan2(target.y - drone.y, target.x - drone.x);
          const spd = 500;
          const droneCrit = Math.min(20, (p.critChance || 0) * 0.35);
          Bullets.spawn({
            x: drone.x, y: drone.y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            damage: Math.max(1, Math.floor(p.damage * (drone.damagePct || 0.12))),
            piercing: 0,
            isPlayer: true,
            crit: Math.random() * 100 < droneCrit,
            bulletType: 'gatling',
            source: 'drone',
            element: drone.element || 'frost', // A51: build-axis — item-driven later, frost default
            allowOnKillEffects: false
          });
          this._droneFireTimer = drone.fireRate || 0.75;
        }
      }
    } else if (drone.type === 'shield') {
      // Absorb nearby enemy bullets (scaled radius)
      const absorbR = drone.absorbRadius || 20;
      for (let i = State.enemyBullets.length - 1; i >= 0; i--) {
        const b = State.enemyBullets[i];
        const d = Math.hypot(b.x - drone.x, b.y - drone.y);
        if (d < absorbR) {
          State.enemyBullets.splice(i, 1);
          drone.absorbed = (drone.absorbed || 0) + 1;
          Particles.spawn(b.x, b.y, 'muzzle');
        }
      }
    } else if (drone.type === 'repair') {
      // Heal player over time (scaled)
      drone._healTimer = (drone._healTimer || 0) + dt;
      if (drone._healTimer >= 1) {
        drone._healTimer = 0;
        const healAmt = Math.max(1, Math.floor(p.maxHP * (drone.healPct || 0.02)));
        if (p.hp < p.maxHP) {
          p.hp = Math.min(p.maxHP, p.hp + healAmt);
          Particles.trail(drone.x, drone.y, '#00ff88', 3);
        }
      }
    }
  },

  drawDrone(ctx) {
    const p = State.player;
    const drone = p.drone;
    if (!drone || !drone.active) return;

    const t = performance.now() * 0.001;
    const dx = drone.x;
    const dy = drone.y;

    ctx.save();
    ctx.translate(dx, dy);

    if (drone.type === 'combat') {
      // Small aggressive triangle
      ctx.rotate(this._droneAngle * 2);
      ctx.fillStyle = '#ff8844';
      ctx.shadowColor = '#ff6622';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(0, -8); ctx.lineTo(-6, 6); ctx.lineTo(6, 6);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (drone.type === 'shield') {
      // Blue hex shield icon
      ctx.rotate(t * 1.5);
      ctx.strokeStyle = '#44aaff';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#44aaff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        i === 0 ? ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8)
          : ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (drone.type === 'repair') {
      // Green cross
      ctx.rotate(t);
      ctx.fillStyle = '#44ff88';
      ctx.shadowColor = '#00ff44';
      ctx.shadowBlur = 6;
      ctx.fillRect(-7, -2, 14, 4);
      ctx.fillRect(-2, -7, 4, 14);
      ctx.shadowBlur = 0;
    }

    ctx.restore();

    // Connection line to player
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = drone.type === 'combat' ? '#ff8844' :
      drone.type === 'shield' ? '#44aaff' : '#44ff88';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(dx, dy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  },

  // ============ ENHANCED DRAW (v2.5.0) ============
  // ═══ Ship Skin: selects sprite entity ID for SpriteManager ═══
  _getSkinEntityId() {
    const skinId = State.meta.selectedSkin || 'default';
    if (skinId === 'default') return 'ship';
    const skinDef = State.data.skins?.[skinId];
    if (skinDef?.spriteEntity) return skinDef.spriteEntity;
    return 'ship'; // fallback to default
  },

  _getSkinPalette() {
    const skinId = State.meta.selectedSkin || 'default';
    const skins = State.data.skins;
    return skins?.[skinId] || skins?.default || null;
  },

  draw(ctx) {
    const p = State.player;
    const t = performance.now() * 0.001;
    const thrust = this._thrustAnim || 0;
    const skin = this._getSkinPalette();
    const skinEntity = this._getSkinEntityId();

    // ═══ Sprite draw hook: PNG always wins. Canvas fallback only if no sprite. ═══
    const SM = State.modules?.SpriteManager;
    if (SM) {
      let shipState = 'idle';
      if (thrust > 0.3) shipState = 'thrust';
      // Try skin-specific sprite first, then fall back to default ship
      const tryEntity = (skinEntity !== 'ship' && SM.has('player', skinEntity, shipState))
        ? skinEntity : 'ship';
      if (SM.has('player', tryEntity, shipState)) {
        SM.play('player_ship', 'player', tryEntity, shipState);
        if (SM.drawAnimated(ctx, 'player_ship', p.x, p.y, p.angle, 55)) {
          return; // sprite rendered — skip canvas fallback
        }
      }
    }

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle + Math.PI / 2);

    // === ENGINE EXHAUST ===
    if (thrust > 0.05) {
      const fl = 0.7 + Math.random() * 0.3;
      const len = 16 + thrust * 14 * fl;
      const ex = skin?.exhaust || ['rgba(0,220,255,0.9)', 'rgba(0,120,255,0.5)', 'rgba(0,60,200,0)'];
      const exEdge = skin?.exhaustEdge || 'rgba(200,240,255,0.7)';

      const g1 = ctx.createLinearGradient(-7, 14, -7, 14 + len);
      g1.addColorStop(0, ex[0]); g1.addColorStop(0.5, ex[1]); g1.addColorStop(1, ex[2]);
      ctx.fillStyle = g1;
      ctx.beginPath();
      ctx.moveTo(-10, 13); ctx.lineTo(-7, 13 + len); ctx.lineTo(-4, 13);
      ctx.fill();

      const g2 = ctx.createLinearGradient(7, 14, 7, 14 + len);
      g2.addColorStop(0, ex[0]); g2.addColorStop(0.5, ex[1]); g2.addColorStop(1, ex[2]);
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.moveTo(4, 13); ctx.lineTo(7, 13 + len * 0.85); ctx.lineTo(10, 13);
      ctx.fill();

      ctx.strokeStyle = exEdge;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-7, 14); ctx.lineTo(-7, 14 + len * 0.5);
      ctx.moveTo(7, 14); ctx.lineTo(7, 14 + len * 0.45);
      ctx.stroke();
    }

    // === WING LAYER ===
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(-16, 12); ctx.lineTo(-12, 15);
    ctx.lineTo(0, 8);
    ctx.lineTo(12, 15); ctx.lineTo(16, 12);
    ctx.closePath();
    const wc = skin?.wing || ['#003344', '#006677', '#003344'];
    const wg = ctx.createLinearGradient(-16, 0, 16, 0);
    wg.addColorStop(0, wc[0]); wg.addColorStop(0.5, wc[1]); wg.addColorStop(1, wc[2]);
    ctx.fillStyle = wg;
    ctx.fill();
    ctx.strokeStyle = skin?.wingStroke || 'rgba(0,136,153,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Wing stripe accents
    ctx.strokeStyle = skin?.wingAccent || 'rgba(0,200,255,0.3)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-3, -10); ctx.lineTo(-12, 12);
    ctx.moveTo(3, -10); ctx.lineTo(12, 12);
    ctx.stroke();

    // === HULL ===
    ctx.beginPath();
    ctx.moveTo(0, -21);
    ctx.lineTo(-8, 10); ctx.lineTo(0, 6); ctx.lineTo(8, 10);
    ctx.closePath();
    const hc = skin?.hull || ['#00ffcc', '#00bb99', '#005544'];
    const hg = ctx.createLinearGradient(0, -21, 0, 10);
    hg.addColorStop(0, hc[0]); hg.addColorStop(0.4, hc[1]); hg.addColorStop(1, hc[2]);
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.strokeStyle = skin?.hullStroke || '#00ffaa';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // === COCKPIT ===
    const cpulse = 0.7 + Math.sin(t * 3) * 0.3;
    ctx.shadowColor = skin?.cockpitGlow || '#00ffcc';
    ctx.shadowBlur = 8;
    const cockpitColor = (skin?.cockpit || 'rgba(0,255,220,{pulse})').replace('{pulse}', cpulse.toFixed(2));
    ctx.fillStyle = cockpitColor;
    ctx.beginPath();
    ctx.ellipse(0, -8, 2.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // === NAV LIGHTS ===
    if (Math.sin(t * 4) > 0) {
      ctx.fillStyle = skin?.navLeft || '#ff3333';
      ctx.beginPath(); ctx.arc(-15, 12, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = skin?.navRight || '#33ff33';
      ctx.beginPath(); ctx.arc(15, 12, 1.5, 0, Math.PI * 2); ctx.fill();
    }

    // Engine nacelles
    ctx.fillStyle = skin?.engine || '#00ddff';
    ctx.shadowColor = skin?.engineGlow || '#00ccff';
    ctx.shadowBlur = 5;
    ctx.beginPath(); ctx.arc(-7, 13, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(7, 13, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // === DAMAGE FLASH ===
    if (this._hitFlash > 0) {
      ctx.globalAlpha = this._hitFlash / 0.15;
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.moveTo(0, -21); ctx.lineTo(-16, 12); ctx.lineTo(16, 12);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // === SHIELD HEX BUBBLE ===
    if (p.shield > 0) {
      const pct = p.shield / (p.maxShield || 1);
      const r = p.radius + 10 + Math.sin(t * 2) * 2;
      ctx.save();
      ctx.globalAlpha = 0.12 + pct * 0.2;
      ctx.strokeStyle = '#00ccff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 - Math.PI / 6;
        const hx = p.x + Math.cos(a) * r;
        const hy = p.y + Math.sin(a) * r;
        i === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.shadowColor = '#00ccff';
      ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }
    
    // === TARGET LOCK RETICLE (v2.16.3) ===
    if (this._lockedEnemy) {
      const e = this._lockedEnemy;
      const lockT = performance.now() * 0.003;
      const er = (e.size || 22) + 8;
      
      ctx.save();
      
      // Dashed line from player to target
      ctx.strokeStyle = 'rgba(255,68,85,0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Rotating reticle brackets around target
      ctx.translate(e.x, e.y);
      ctx.rotate(lockT);
      ctx.strokeStyle = '#ff4455';
      ctx.lineWidth = 1.5;
      
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        const cos = Math.cos(a), sin = Math.sin(a);
        ctx.beginPath();
        ctx.moveTo(cos * er - sin * 6, sin * er + cos * 6);
        ctx.lineTo(cos * er, sin * er);
        ctx.lineTo(cos * er + sin * 6, sin * er - cos * 6);
        ctx.stroke();
      }
      
      // Inner diamond pulse
      const pulse = 0.4 + Math.sin(lockT * 3) * 0.3;
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#ff8899';
      ctx.lineWidth = 1;
      const d = er * 0.4;
      ctx.beginPath();
      ctx.moveTo(0, -d); ctx.lineTo(d, 0);
      ctx.lineTo(0, d); ctx.lineTo(-d, 0);
      ctx.closePath();
      ctx.stroke();
      
      ctx.restore();
    }
  }
};

export default Player;
