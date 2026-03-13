// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// MAIN.js - BONZOOKAA Exploration Mode
// ============================================================
// Diablo-style exploration with hub, acts, and boss portals

import { State, resetRun, resetPlayer } from './runtime/State.js';
import { loadAllData } from './runtime/DataLoader.js';
import { Save } from './runtime/Save.js';
import { Stats } from './runtime/Stats.js';
import { Leveling } from './runtime/Leveling.js';
import { Items } from './runtime/Items.js';
import { Player } from './runtime/Player.js';
import { Enemies } from './runtime/Enemies.js';
import { Bullets } from './runtime/Bullets.js';
import { Pickups } from './runtime/Pickups.js';
import { Particles } from './runtime/Particles.js';
import { Input } from './runtime/Input.js';
import { Crafting } from './runtime/Crafting.js';
import { UI } from './runtime/UI.js';
import { Audio } from './runtime/Audio.js';

// World System
import { Camera } from './runtime/world/Camera.js';
import { World } from './runtime/world/World.js';
import { SceneManager } from './runtime/world/SceneManager.js';
import { SeededRandom } from './runtime/world/SeededRandom.js';
import { PostFX } from './runtime/PostFX.js';
import { Missions } from './runtime/Missions.js';
import { Prestige } from './runtime/Prestige.js';
import { Achievements } from './runtime/Achievements.js';
import { SpriteManager } from './runtime/SpriteManager.js';
import { DepthRules } from './runtime/world/DepthRules.js';
import { PauseUI } from './runtime/PauseUI.js';
import { AntiExploit } from './runtime/AntiExploit.js';
import { Contracts } from './runtime/Contracts.js';

// ============================================================
// GAME CONTROLLER
// ============================================================

const Game = {
  canvas: null,
  ctx: null,
  lastTime: 0,
  
  // Screen dimensions
  screenW: 800,
  screenH: 600,
  
  // Game mode
  mode: 'exploration', // 'exploration' or 'waves' (legacy)
  
  // ========== INITIALIZATION ==========
  
  async init() {
    const legacyStartModal = document.getElementById('startModal');
    if (legacyStartModal) legacyStartModal.remove();
    // console.log(' BONZOOKAA Exploration Mode initializing...');
    
    // Setup canvas
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize(true));

    // v2.15.1: DOM contract check — fail fast if critical elements missing
    try { Contracts.assertBoot(); } catch(e) { console.error(e.message); }

    // HOTFIX: observe container size changes (UI overlays / grid reflow) and keep canvas in sync.
    const container = document.getElementById('gameContainer');
    if (window.ResizeObserver && container) {
      this._containerRO = new ResizeObserver(() => this.resize(true));
      this._containerRO.observe(container);
    }
    
    // Load data
    await loadAllData();
    
    // Load save
    Save.load();
    
    // Register modules in State for cross-module access
    State.modules = {
      Save, Stats, Leveling, Items, Player, 
      Enemies, Bullets, Pickups, Particles, UI,
      Camera, World, SceneManager, Crafting, Audio, PostFX,
      Missions, Prestige, Achievements, SpriteManager, DepthRules,
      PauseUI, AntiExploit, Contracts
    };
    
    // Initialize systems
    Input.init(this.canvas);
    UI.init();
    Audio.init();
    PostFX.init();
    Camera.init(0, 0);
    SpriteManager.init(); // Async — loads sprite_manifest.json if present
    SceneManager.init();
    
    // ═══ v2.15.0: Settings callback from HTML modal ═══
    window._settingsUpdate = (key, val) => {
      const s = State.settings;
      switch (key) {
        case 'sfx':
          s.sfxVolume = val / 100;
          if (Audio.setSFXVolume) Audio.setSFXVolume(s.sfxVolume);
          document.getElementById('sfxVolLabel').textContent = val + '%';
          break;
        case 'music':
          s.musicVolume = val / 100;
          if (Audio.setMusicVolume) Audio.setMusicVolume(s.musicVolume);
          document.getElementById('musicVolLabel').textContent = val + '%';
          break;
        case 'shake':
          s.screenShake = !!val;
          break;
        case 'dmgNum':
          s.damageNumbers = !!val;
          break;
        case 'postfx':
          s.postEffects = !!val;
          break;
        case 'close':
          State.ui.paused = false;
          Save.save();
          break;
      }
    };
    
    // Calculate stats
    Stats.calculate();
    
    // Add starter items if new
    if (State.meta.stash.length === 0) {
      this.addStarterItems();
    }
    
    // Initialize act unlocks
    this.initActUnlocks();
    
    // Show hub
    this.showHub();
    
    // Start loop
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
    
    // console.log(' Exploration mode ready');
  },
  
  resize(force = false) {
    const container = document.getElementById('gameContainer');
    if (!container || !this.canvas) return;

    // Use rect (more reliable with overlays / transforms)
    const rect = container.getBoundingClientRect();
    const w = Math.floor(rect.width);
    const h = Math.floor(rect.height);

    // Guard: during UI reflow the container can briefly collapse to the left column.
    // In that case we retry on the next frame instead of "locking in" a tiny canvas.
    if (!force && (w < 480 || h < 320)) {
      if (!this._resizeRetryScheduled) {
        this._resizeRetryScheduled = true;
        requestAnimationFrame(() => {
          this._resizeRetryScheduled = false;
          this.resize(true);
        });
      }
      return;
    }

    if (w <= 0 || h <= 0) return;

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.screenW = w;
      this.screenH = h;
    }
  },
  
  addStarterItems() {
    const starterWeapon = Items.generate('laser_cannon', 'common');
    const starterShield = Items.generate('energy_barrier', 'common');
    const starterEngine = Items.generate('ion_thruster', 'common');
    
    if (starterWeapon) Items.addToStash(starterWeapon);
    if (starterShield) Items.addToStash(starterShield);
    if (starterEngine) Items.addToStash(starterEngine);
    
    if (starterWeapon) Items.equip(starterWeapon.id);
    if (starterShield) Items.equip(starterShield.id);
    if (starterEngine) Items.equip(starterEngine.id);
    
    Stats.calculate();
    Save.save();
    UI.renderAll();
  },
  
  initActUnlocks() {
    const acts = State.data.acts;
    if (!acts) return;

    // New tier/portal format
    if (acts.portals) {
      if (!State.meta.portalsUnlocked) State.meta.portalsUnlocked = {};
      for (const portal of acts.portals) {
        // ALPHA: Force all portals unlocked
        State.meta.portalsUnlocked[portal.id] = true;
      }
    }

    // Legacy act format fallback
    if (!State.meta.actsUnlocked) {
      State.meta.actsUnlocked = { act1: true };
    }
    for (const [actId, actData] of Object.entries(acts)) {
      if (actId === 'tiers' || actId === 'portals' || actId.startsWith('_')) continue;
      if (actData.unlocked && !State.meta.actsUnlocked[actId]) {
        State.meta.actsUnlocked[actId] = true;
      }
    }
  },
  
  // ========== MAIN LOOP ==========
  
  loop(time) {
    try {
      const dt = Math.min((time - this.lastTime) / 1000, 0.05);
      this.lastTime = time;
      
      // Update scene transitions
      SceneManager.updateTransition(dt);
      
      // Scene-specific updates
      const scene = SceneManager.getScene();
      
      if (scene === 'combat' && !State.ui.paused) {
        this.updateCombat(dt);
      }
      
      // Always render
      this.render(dt);
      
    } catch (error) {
      console.error(' Error in game loop:', error);
    }
    
    requestAnimationFrame((t) => this.loop(t));
  },
  
  // ========== COMBAT UPDATE ==========
  
  updateCombat(dt) {
    // Don't update if zone not loaded yet
    if (!World.currentZone) return;
    
    State.run.stats.timeElapsed += dt;
    
    // Update camera to follow player
    Camera.update(dt, this.screenW, this.screenH);
    
    // Update world (proximity spawning)
    World.update(dt);
    
    // Update player
    Player.update(dt, this.canvas, true); // true = exploration mode
    
    // Check death
    if (Player.isDead()) {
      this.onDeath();
      return;
    }
    
    // Update enemies (pass camera offset)
    Enemies.update(dt, this.canvas);
    
    // Update bullets
    Bullets.update(dt, this.canvas);
    
    // Update pickups
    Pickups.update(dt, this.canvas);
    
    // Update particles
    Particles.update(dt);
    SpriteManager.update(dt);
    
    // Post-processing update (ambient dust drift)
    PostFX.update(dt);
    
    // Update ambient music based on game state
    Audio.updateMusicForState();

    // Update HUD
    this.updateHUD();
  },
  
  // ========== RENDERING ==========
  
  render(dt) {
    const ctx = this.ctx;
    const scene = SceneManager.getScene();
    
    // Clear
    ctx.fillStyle = '#050810';
    ctx.fillRect(0, 0, this.screenW, this.screenH);
    
    // Only render combat if zone is actually loaded
    if ((scene === 'combat' || scene === 'loading') && World.currentZone) {
      this.renderCombat(ctx, dt);
    } else if (scene === 'loading') {
      // Show loading indicator
      ctx.fillStyle = '#00aaff';
      ctx.font = 'bold 24px Orbitron';
      ctx.textAlign = 'center';
      ctx.fillText('LOADING...', this.screenW / 2, this.screenH / 2);
    }
    
    // Draw scene transitions on top
    SceneManager.drawTransition(ctx, this.screenW, this.screenH);
  },
  
  renderCombat(ctx, dt) {
    // Draw parallax background (screen-space)
    (World.drawParallaxBackground ? World.drawParallaxBackground(ctx, this.screenW, this.screenH)
      : World.drawParallax(ctx, this.screenW, this.screenH));
    
    // Apply camera transform for world objects
    ctx.save();
    Camera.applyTransform(ctx);
    
    // Draw world elements (obstacles, decorations, exits, portals)
    World.draw(ctx, this.screenW, this.screenH);
    
    // Draw pickups
    Pickups.draw(ctx);
    
    // Draw enemies
    Enemies.draw(ctx);
    
    // Draw bullets
    Bullets.draw(ctx);
    
    // Draw player
    Player.draw(ctx);
    
    // Draw ability effects (dash trail, shield ring, orbital ring)
    Player.drawAbilityEffects(ctx);

    // Draw drone companion
    Player.drawDrone(ctx);
    
    // Draw particles
    Particles.draw(ctx);
    SpriteManager.drawEffects(ctx);
    ctx.restore();

    // Parallax foreground (screen-space; above world, below UI)
    if (World.drawParallaxForeground) World.drawParallaxForeground(ctx, this.screenW, this.screenH);
    
    // Post-processing: bloom, vignette, scanlines, ambient dust
    if (State.settings?.postEffects !== false) {
      PostFX.draw(ctx, this.screenW, this.screenH);
    }
    
    // Draw screen-space UI (minimap, etc)
    this.drawMinimap(ctx);
    
    // Draw POI edge compass indicators
    this.drawPOICompass(ctx);
    
    // Draw zone progress tracker
    this.drawZoneTracker(ctx);
    
    // Draw difficulty lane badge
    this.drawDifficultyBadge(ctx);
    
    // Draw kill streak counter
    this.drawStreakHUD(ctx);
    
    // Draw ability cooldowns
    this.drawAbilityHUD(ctx);
    
    // Draw heat meter
    this.drawHeatBar(ctx);
    
    // Draw zone objective
    this.drawObjectiveHUD(ctx);
    
    // Draw current weapon indicator
    this.drawWeaponHUD(ctx);
    
    // Draw zone mods (top-left under difficulty badge)
    this.drawZoneModsHUD(ctx);
    
    // Draw corruption level
    this.drawCorruptionBadge(ctx);
    
    // Draw mission tracker (right side)
    this.drawMissionHUD(ctx);
  },
  
  // ========== DIFFICULTY BADGE ==========
  drawDifficultyBadge(ctx) {
    const diff = State.run.difficulty || 'normal';
    if (diff === 'normal') return;
    
    const x = 10;
    const y = 164;
    const label = diff === 'chaos' ? '🔴 CHAOS' : '🟠 RISK';
    const color = diff === 'chaos' ? '#ff3355' : '#ffaa00';
    const bgColor = diff === 'chaos' ? 'rgba(255,20,60,0.15)' : 'rgba(255,170,0,0.15)';
    const t = performance.now() * 0.001;
    const pulse = diff === 'chaos' ? (0.8 + Math.sin(t * 3) * 0.2) : 1;
    
    ctx.globalAlpha = pulse;
    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, 85, 20);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, 85, 20);
    ctx.fillStyle = color;
    ctx.font = 'bold 9px Orbitron, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 5, y + 14);
    ctx.globalAlpha = 1;
    
    // Loot bonus indicator
    const bonus = diff === 'chaos' ? '+200% LOOT' : '+50% LOOT';
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x, y + 22, 85, 14);
    ctx.fillStyle = '#aaa';
    ctx.font = '8px Orbitron, sans-serif';
    ctx.fillText(bonus, x + 5, y + 32);
  },

  // ========== KILL STREAK HUD ==========
  drawStreakHUD(ctx) {
    const streak = State.run.streak;
    if (!streak || streak.count < 2) return;
    
    const sw = this.screenW;
    const x = sw - 10;
    const y = 80;
    const t = performance.now() * 0.001;
    
    // Pulse intensity based on streak size
    const intensity = Math.min(1, streak.count / 15);
    const pulse = 1 + Math.sin(t * 4) * 0.1 * intensity;
    
    // Background glow
    const glowAlpha = 0.1 + intensity * 0.15;
    ctx.fillStyle = `rgba(255,200,0,${glowAlpha})`;
    ctx.fillRect(x - 105, y - 5, 100, 45);
    ctx.strokeStyle = `rgba(255,200,0,${0.3 + intensity * 0.5})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 105, y - 5, 100, 45);
    
    // Streak count
    ctx.save();
    ctx.textAlign = 'right';
    ctx.font = `bold ${Math.floor(18 * pulse)}px Orbitron, sans-serif`;
    ctx.fillStyle = intensity > 0.6 ? '#ff6600' : '#ffcc00';
    ctx.shadowColor = '#ff6600';
    ctx.shadowBlur = intensity * 12;
    ctx.fillText(`${streak.count}× STREAK`, x - 10, y + 15);
    ctx.shadowBlur = 0;
    
    // Multiplier
    ctx.font = '10px Orbitron, sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText(`XP ×${streak.xpMult.toFixed(1)}  LOOT ×${streak.lootMult.toFixed(1)}`, x - 10, y + 30);
    
    // Decay timer bar
    const decayPct = Math.max(0, 1 - streak.timer / 3.5);
    const barW = 90;
    ctx.fillStyle = 'rgba(50,50,50,0.6)';
    ctx.fillRect(x - 100, y + 34, barW, 3);
    ctx.fillStyle = decayPct > 0.3 ? '#ffcc00' : '#ff3333';
    ctx.fillRect(x - 100, y + 34, barW * decayPct, 3);
    ctx.restore();
  },
  
  // ========== ABILITY COOLDOWN HUD ==========
  drawAbilityHUD(ctx) {
    const ab = State.player.abilities;
    if (!ab) return;
    
    const sw = this.screenW;
    const sh = this.screenH;
    const slotSize = 40;
    const gap = 8;
    const totalW = slotSize * 3 + gap * 2;
    const startX = (sw - totalW) / 2;
    const y = sh - 55;
    
    const abilities = [
      { key: 'dash',    label: 'Q', name: 'DASH',    color: '#00ccff', data: ab.dash },
      { key: 'shield',  label: 'R', name: 'SHIELD',  color: '#00ffaa', data: ab.shield },
      { key: 'orbital', label: 'F', name: 'ORBITAL', color: '#ff6600', data: ab.orbital }
    ];
    
    for (let i = 0; i < abilities.length; i++) {
      const a = abilities[i];
      const x = startX + i * (slotSize + gap);
      const cd = a.data.cooldown;
      const maxCd = a.data.maxCooldown;
      const ready = cd <= 0;
      const cdPct = ready ? 0 : cd / maxCd;
      
      // Background
      ctx.fillStyle = ready ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.5)';
      ctx.fillRect(x, y, slotSize, slotSize);
      
      // Cooldown sweep (clockwise fill)
      if (!ready) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath();
        ctx.moveTo(x + slotSize/2, y + slotSize/2);
        ctx.arc(x + slotSize/2, y + slotSize/2, slotSize/2, -Math.PI/2, -Math.PI/2 + Math.PI*2*cdPct);
        ctx.closePath();
        ctx.fill();
        
        // Cooldown number
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(cd.toFixed(1), x + slotSize/2, y + slotSize/2 + 5);
      }
      
      // Border (bright when ready)
      ctx.strokeStyle = ready ? a.color : 'rgba(100,100,100,0.5)';
      ctx.lineWidth = ready ? 2 : 1;
      if (ready && a.data.active) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
      }
      ctx.strokeRect(x, y, slotSize, slotSize);
      
      // Key label (top-left)
      ctx.fillStyle = ready ? a.color : '#666';
      ctx.font = 'bold 10px Orbitron, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(a.label, x + 3, y + 11);
      
      // Ability name (bottom)
      ctx.font = '7px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = ready ? '#ccc' : '#555';
      ctx.fillText(a.name, x + slotSize/2, y + slotSize + 10);
    }
    ctx.textAlign = 'left';
    ctx.lineWidth = 1;
  },
  
  // ========== HEAT METER HUD ==========
  drawHeatBar(ctx) {
    const p = State.player;
    if (!State.run.active) return;
    
    const sw = this.screenW;
    const sh = this.screenH;
    const barW = 140;
    const barH = 8;
    const x = (sw - barW) / 2;
    const y = sh - 105; // above ability slots
    
    const heatPct = (p.heat || 0) / (p.heatMax || 100);
    const isCoolant = (p.coolantTimer || 0) > 0;
    const isOverheated = p.overheated;
    
    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.strokeStyle = isOverheated ? '#ff2200' : '#333';
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, barW, barH);
    ctx.strokeRect(x, y, barW, barH);
    
    // Fill — color shifts from cyan→yellow→red as heat rises
    let fillColor;
    if (isCoolant) {
      fillColor = '#00ddff'; // cyan = coolant active
    } else if (heatPct < 0.4) {
      fillColor = '#44cc66'; // green = cool
    } else if (heatPct < 0.7) {
      fillColor = '#ffaa00'; // yellow = warming
    } else if (heatPct < 0.9) {
      fillColor = '#ff6600'; // orange = hot
    } else {
      fillColor = '#ff2200'; // red = critical
    }
    
    if (heatPct > 0 || isCoolant) {
      const fillW = isCoolant ? barW : barW * heatPct;
      ctx.fillStyle = fillColor;
      ctx.fillRect(x + 1, y + 1, Math.max(0, fillW - 2), barH - 2);
    }
    
    // Overheat flash
    if (isOverheated && Math.floor(Date.now() / 200) % 2 === 0) {
      ctx.fillStyle = 'rgba(255,34,0,0.15)';
      ctx.fillRect(0, 0, sw, sh);
    }
    
    // Label
    ctx.font = '8px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    if (isCoolant) {
      ctx.fillStyle = '#00ddff';
      ctx.fillText(`❄ COOLANT ${Math.ceil(p.coolantTimer)}s`, sw / 2, y - 3);
    } else if (isOverheated) {
      ctx.fillStyle = '#ff2200';
      // Show different message based on whether player released fire
      if (State.input.fire) {
        ctx.fillText('⚠ RELEASE TO COOL!', sw / 2, y - 3);
      } else {
        ctx.fillText('⚠ COOLING...', sw / 2, y - 3);
      }
    } else {
      ctx.fillStyle = '#666';
      ctx.fillText('HEAT', sw / 2, y - 3);
    }
    ctx.textAlign = 'left';
  },
  
  // ========== ZONE OBJECTIVE HUD ==========
  drawObjectiveHUD(ctx) {
    const obj = State.run.objective;
    if (!obj) return;
    
    const sw = this.screenW;
    const x = sw / 2;
    const y = 10;
    
    // Background bar
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - 160, y, 320, 36);
    
    // Objective icon + label
    const color = obj.complete ? '#00ff88' : (obj.exitLocked ? '#ff6644' : '#ffcc00');
    ctx.font = 'bold 11px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    const statusText = obj.complete ? '✓ COMPLETE' : `${obj.icon} ${obj.label}`;
    ctx.fillText(statusText, x, y + 13);
    
    // Progress bar (for exterminate, lockdown, survival)
    if (obj.target && !obj.complete) {
      const pct = Math.min(1, obj.progress / obj.target);
      const barW = 200;
      const barH = 6;
      const barX = x - barW / 2;
      const barY = y + 19;
      
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = color;
      ctx.fillRect(barX, barY, barW * pct, barH);
      
      // Progress text
      ctx.font = '8px Orbitron, sans-serif';
      ctx.fillStyle = '#aaa';
      if (obj.type === 'survival' || obj.type === 'timetrial') {
        const remaining = Math.max(0, obj.target - obj.progress);
        ctx.fillText(`${remaining.toFixed(1)}s`, x, barY + barH + 9);
      } else {
        ctx.fillText(`${obj.progress}/${obj.target}`, x, barY + barH + 9);
      }
    }
    
    // Border
    ctx.strokeStyle = color + '44';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 160, y, 320, 36);
  },
  
  // ========== WEAPON HUD ==========
  drawWeaponHUD(ctx) {
    const p = State.player;
    const wType = p.weaponType || 'laser';
    const wDef = p.weaponDefs?.[wType];
    if (!wDef) return;
    
    const sw = this.screenW;
    const sh = this.screenH;
    const x = sw - 120;
    const y = sh - 55;
    
    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x, y, 110, 40);
    ctx.strokeStyle = wDef.color + '88';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, 110, 40);
    
    // Weapon color dot
    ctx.fillStyle = wDef.color;
    ctx.shadowColor = wDef.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(x + 16, y + 20, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Weapon name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Orbitron, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(wDef.label.toUpperCase(), x + 30, y + 16);
    
    // Stats hint
    ctx.font = '8px sans-serif';
    ctx.fillStyle = '#888';
    const dmgStr = wDef.damage >= 2 ? 'HIGH DMG' : wDef.damage <= 0.5 ? 'LOW DMG' : 'MED DMG';
    const spdStr = wDef.fireRate >= 2 ? 'FAST' : wDef.fireRate <= 0.5 ? 'SLOW' : 'MED';
    ctx.fillText(`${dmgStr} · ${spdStr}`, x + 30, y + 30);
    
    // Tab hint
    ctx.fillStyle = '#555';
    ctx.font = '7px sans-serif';
    ctx.fillText('TAB cycle · BKSP laser', x + 2, y + 50);
  },
  
  // ═══ v2.13.0: ZONE MODS HUD (top-left, under difficulty badge) ═══
  drawZoneModsHUD(ctx) {
    const mods = State.run.zoneMods || [];
    if (mods.length === 0) return;
    
    const startY = 190;
    ctx.font = '8px Orbitron, sans-serif';
    ctx.textAlign = 'left';
    
    for (let i = 0; i < mods.length; i++) {
      const m = mods[i];
      const y = startY + i * 16;
      
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(10, y, 100, 14);
      ctx.fillStyle = '#cccccc';
      ctx.fillText(`${m.icon} ${m.name}`, 14, y + 10);
    }
    ctx.globalAlpha = 1;
  },
  
  // ═══ v2.13.0: CORRUPTION BADGE ═══
  drawCorruptionBadge(ctx) {
    const corr = State.run.corruption || 0;
    if (corr === 0) return;
    
    const x = 10;
    const y = 190 + (State.run.zoneMods?.length || 0) * 16 + 4;
    const t = performance.now() * 0.001;
    const pulse = 0.85 + Math.sin(t * 2) * 0.15;
    
    ctx.globalAlpha = pulse;
    ctx.fillStyle = 'rgba(255,33,85,0.15)';
    ctx.fillRect(x, y, 90, 16);
    ctx.strokeStyle = '#ff2155';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, 90, 16);
    ctx.fillStyle = '#ff2155';
    ctx.font = 'bold 9px Orbitron, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`🔮 CORRUPT ×${corr}`, x + 4, y + 12);
    ctx.globalAlpha = 1;
  },
  
  // ═══ v2.13.0: MISSION TRACKER HUD (right side) ═══
  drawMissionHUD(ctx) {
    const missions = Missions.getActive();
    if (missions.length === 0) return;
    
    const sw = this.screenW;
    const startX = sw - 160;
    const startY = 10;
    
    ctx.font = '8px Orbitron, sans-serif';
    ctx.textAlign = 'left';
    
    for (let i = 0; i < Math.min(3, missions.length); i++) {
      const m = missions[i];
      const y = startY + i * 28;
      const pct = Math.min(1, m.progress / m.target);
      const done = m.complete;
      
      // Background
      ctx.fillStyle = done ? 'rgba(68,255,102,0.08)' : 'rgba(0,0,0,0.3)';
      ctx.fillRect(startX, y, 150, 24);
      
      // Icon + label
      ctx.fillStyle = done ? '#44ff66' : '#aaa';
      ctx.fillText(`${m.icon} ${m.label}`, startX + 4, y + 10);
      
      // Progress bar
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(startX + 4, y + 14, 120, 4);
      ctx.fillStyle = done ? '#44ff66' : '#ffaa00';
      ctx.fillRect(startX + 4, y + 14, 120 * pct, 4);
      
      // Progress text
      ctx.fillStyle = '#888';
      ctx.fillText(`${m.progress}/${m.target}`, startX + 128, y + 18);
    }
    ctx.globalAlpha = 1;
  },
  // Arrow indicators at screen edges pointing to off-screen POIs
  drawPOICompass(ctx) {
    const zone = World.currentZone;
    if (!zone || !zone.pois) return;
    
    const px = State.player.x;
    const py = State.player.y;
    const camX = Camera.getX();
    const camY = Camera.getY();
    const sw = this.screenW;
    const sh = this.screenH;
    const margin = 40;
    
    for (const poi of zone.pois) {
      if (poi.collected) continue;
      if (poi.hidden && !poi.triggered) continue;
      
      // Check if POI is off-screen
      const screenX = poi.x - camX;
      const screenY = poi.y - camY;
      
      if (screenX > -30 && screenX < sw + 30 && screenY > -30 && screenY < sh + 30) continue;
      
      // Calculate edge position
      const dx = poi.x - px;
      const dy = poi.y - py;
      const angle = Math.atan2(dy, dx);
      const dist = Math.hypot(dx, dy);
      
      // Skip very far POIs
      if (dist > 4000) continue;
      
      // Project to screen edge
      let edgeX = sw / 2 + Math.cos(angle) * (sw / 2 - margin);
      let edgeY = sh / 2 + Math.sin(angle) * (sh / 2 - margin);
      
      // Clamp to screen bounds
      edgeX = Math.max(margin, Math.min(sw - margin, edgeX));
      edgeY = Math.max(margin, Math.min(sh - margin, edgeY));
      
      // Color based on state
      const color = poi.cleared ? '#00ff88' : poi.triggered ? '#ffaa00' : '#aaaaaa';
      const alpha = Math.max(0.3, 1 - dist / 3000);
      
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(edgeX, edgeY);
      ctx.rotate(angle);
      
      // Arrow
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-6, -7);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-6, 7);
      ctx.closePath();
      ctx.fill();
      
      // Icon behind arrow
      ctx.rotate(-angle);
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(poi.icon || '?', -14, 0);
      
      // Distance
      ctx.fillStyle = '#ffffff';
      ctx.font = '8px Orbitron, sans-serif';
      ctx.fillText(Math.floor(dist / 100) + 'm', 0, 14);
      
      ctx.restore();
    }
  },
  
  // ========== ZONE TRACKER ==========
  // Shows POIs remaining and zone progress
  drawZoneTracker(ctx) {
    const zone = World.currentZone;
    if (!zone || !zone.pois || zone.pois.length === 0) return;
    
    const x = 10;
    const y = 140;
    
    const total = zone.pois.filter(p => !p.hidden || p.triggered).length;
    const cleared = zone.pois.filter(p => p.collected).length;
    const remaining = total - cleared;
    
    if (remaining <= 0) return;
    
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, y, 110, 20);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, 110, 20);
    
    ctx.fillStyle = '#ccc';
    ctx.font = '9px Orbitron, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`📍 ${remaining} POI remaining`, x + 5, y + 13);
  },
  
  // ========== MINIMAP ==========
  
  drawMinimap(ctx) {
    const zone = World.currentZone;
    if (!zone) return;
    
    const mapSize = 120;
    const mapX = this.screenW - mapSize - 10;
    const mapY = 10;
    const scale = mapSize / Math.max(zone.width, zone.height);
    
    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(mapX, mapY, mapSize, mapSize);
    ctx.strokeStyle = '#00aaff';
    ctx.lineWidth = 2;
    ctx.strokeRect(mapX, mapY, mapSize, mapSize);
    
    // Map bounds
    const zoneW = zone.width * scale;
    const zoneH = zone.height * scale;
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(mapX, mapY, zoneW, zoneH);
    
    // Enemies (green dots)
    ctx.fillStyle = '#44aa44';
    for (const spawn of zone.enemySpawns) {
      if (!spawn.killed) {
        ctx.fillRect(
          mapX + spawn.x * scale - 1,
          mapY + spawn.y * scale - 1,
          2, 2
        );
      }
    }
    
    // Elites (yellow dots)
    ctx.fillStyle = '#ffaa00';
    for (const spawn of zone.eliteSpawns) {
      if (!spawn.killed) {
        ctx.fillRect(
          mapX + spawn.x * scale - 2,
          mapY + spawn.y * scale - 2,
          4, 4
        );
      }
    }
    
    // Boss (red dot)
    if (zone.bossSpawn && !zone.bossSpawn.killed) {
      ctx.fillStyle = '#ff3355';
      ctx.fillRect(
        mapX + zone.bossSpawn.x * scale - 3,
        mapY + zone.bossSpawn.y * scale - 3,
        6, 6
      );
    }
    
    // Exit (orange)
    if (zone.exit) {
      ctx.fillStyle = '#ff8800';
      ctx.fillRect(
        mapX + zone.exit.x * scale - 3,
        mapY + zone.exit.y * scale - 3,
        6, 6
      );
    }
    
    // Portals (yellow pulse)
    ctx.fillStyle = '#ffdd00';
    for (const portal of zone.portals) {
      ctx.fillRect(
        mapX + portal.x * scale - 4,
        mapY + portal.y * scale - 4,
        8, 8
      );
    }
    
    // POI markers (diamond shapes on minimap)
    World.drawMinimapPOIs(ctx, mapX, mapY, mapSize, mapSize, zone.width, zone.height);
    
    // Player (cyan dot)
    ctx.fillStyle = '#00ffff';
    ctx.fillRect(
      mapX + State.player.x * scale - 3,
      mapY + State.player.y * scale - 3,
      6, 6
    );
    
    // Viewport rectangle
    const camX = Camera.getX();
    const camY = Camera.getY();
    ctx.strokeStyle = 'rgba(0, 170, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      mapX + camX * scale,
      mapY + camY * scale,
      this.screenW * scale,
      this.screenH * scale
    );
    
    // Zone label
    ctx.fillStyle = '#aaa';
    ctx.font = '10px Orbitron';
    ctx.textAlign = 'left';
    ctx.fillText(`Zone ${World.zoneIndex + 1}`, mapX + 4, mapY + mapSize - 4);
  },
  
  // ========== HUB ==========
  
  showHub() {
    try { Contracts.assertHubUI(); } catch(e) { console.warn(e.message); }
    SceneManager.goToHub();
    this.showModal('hubModal');
    this.renderHubUI();
  },
  
  renderHubUI() {
    // Update hub stats
    const scrapEl = document.getElementById('hubScrap');
    const cellsEl = document.getElementById('hubCells');
    const levelEl = document.getElementById('hubLevel');
    const actsEl = document.getElementById('actList');
    
    if (scrapEl) scrapEl.textContent = State.meta.scrap;
    if (cellsEl) cellsEl.textContent = State.run?.cells || 0;
    if (levelEl) levelEl.textContent = State.meta.level;
    
    // Ship power bars
    const p = State.player;
    const stats = State.computed || {};
    const maxRef = 500; // reference max for bar scaling
    const dps = Math.round((stats.damage || 10) * (stats.fireRate || 2));
    const tank = Math.round((stats.maxHP || 100) + (stats.shield || 0));
    const spd = Math.round(stats.speed || 200);
    
    const dpsBar = document.getElementById('hubDPSBar');
    const dpsVal = document.getElementById('hubDPSVal');
    const tankBar = document.getElementById('hubTankBar');
    const tankVal = document.getElementById('hubTankVal');
    const spdBar = document.getElementById('hubSpeedBar');
    const spdVal = document.getElementById('hubSpeedVal');
    if (dpsBar) { dpsBar.style.width = Math.min(100, (dps / maxRef) * 100) + '%'; }
    if (dpsVal) dpsVal.textContent = dps;
    if (tankBar) { tankBar.style.width = Math.min(100, (tank / maxRef) * 100) + '%'; }
    if (tankVal) tankVal.textContent = tank;
    if (spdBar) { spdBar.style.width = Math.min(100, (spd / 400) * 100) + '%'; }
    if (spdVal) spdVal.textContent = spd;
    
    // Render portal list
    if (actsEl) {
      const acts = State.data.acts;
      if (!acts) {
        actsEl.innerHTML = '<p>No zone data loaded</p>';
        return;
      }
      
      const portals = acts.portals || [];
      const tiers = acts.tiers || [];
      if (!State.meta.highestZones) State.meta.highestZones = { normal: 0, risk: 0, chaos: 0 };
      if (State.meta.highestZone && !State.meta.highestZones.normal) {
        State.meta.highestZones.normal = State.meta.highestZone;
      }
      const hz = State.meta.highestZones;
      
      let html = '';
      
      // ═══ RESUME CARDS (compact) ═══
      const lanes = [
        { key: 'normal', label: 'NORMAL', color: '#44cc66', zone: hz.normal || 0 },
        { key: 'risk',   label: 'RISK',   color: '#ffaa00', zone: hz.risk || 0 },
        { key: 'chaos',  label: 'CHAOS',  color: '#ff3355', zone: hz.chaos || 0 }
      ].filter(l => l.zone > 1);
      
      if (lanes.length > 0) {
        html += `<div style="padding:8px;background:rgba(0,212,255,0.03);border:1px solid rgba(0,136,170,0.2);border-radius:6px;margin-bottom:8px;">`;
        html += `<div class="section-label" style="margin-bottom:6px;">⚡ CONTINUE</div>`;
        html += `<div style="display:flex;gap:5px;">`;
        for (const lane of lanes) {
          const tierForZone = tiers.find(t => lane.zone >= (t.zoneStart||1) && lane.zone <= (t.zoneEnd||Infinity)) || tiers[0];
          html += `
            <button style="flex:1;padding:6px 8px;background:rgba(0,0,0,0.3);border:1px solid ${lane.color}40;border-radius:4px;cursor:pointer;text-align:left;color:var(--text);" 
                    onclick="Game.startResume('${lane.key}')">
              <div style="font-size:9px;color:${lane.color};font-weight:bold;letter-spacing:1px;">${lane.label}</div>
              <div style="font-size:12px;color:#fff;font-family:monospace;">Z${lane.zone}</div>
              <div style="font-size:8px;color:#666;">${tierForZone?.name || ''}</div>
            </button>`;
        }
        html += `</div></div>`;
      }
      
      // ═══ MISSIONS PANEL ═══
      Missions.maybeRefresh();
      const activeMissions = Missions.getActive();
      if (activeMissions.length > 0) {
        html += `<div style="padding:8px;background:rgba(255,170,0,0.04);border:1px solid rgba(255,170,0,0.2);border-radius:6px;margin-bottom:8px;">`;
        html += `<div class="section-label" style="margin-bottom:6px;color:#ffaa00;">📋 MISSIONS (${Missions.getClaimableCount()} claimable)</div>`;
        for (const m of activeMissions) {
          const pct = Math.min(100, (m.progress / m.target) * 100);
          const done = m.complete;
          const barColor = done ? '#44ff66' : '#ffaa00';
          html += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;padding:4px;background:rgba(0,0,0,0.2);border-radius:3px;">`;
          html += `<span style="font-size:14px;">${m.icon}</span>`;
          html += `<div style="flex:1;">`;
          html += `<div style="font-size:10px;color:${done?'#44ff66':'#ccc'};">${m.label}: ${m.progress}/${m.target}</div>`;
          html += `<div style="height:4px;background:rgba(255,255,255,0.1);border-radius:2px;"><div style="height:100%;width:${pct}%;background:${barColor};border-radius:2px;"></div></div>`;
          html += `</div>`;
          if (done && !m.claimed) {
            html += `<button onclick="event.stopPropagation();Game.claimMission('${m.id}')" style="padding:2px 8px;background:${barColor};color:#000;border:none;border-radius:3px;cursor:pointer;font-size:9px;font-weight:bold;">CLAIM</button>`;
          } else {
            html += `<span style="font-size:9px;color:#666;">${m.rewardAmount} ${m.rewardType === 'scrap' ? '🔧' : '⚡'}</span>`;
          }
          html += `</div>`;
        }
        html += `</div>`;
      }
      
      // ═══ PRESTIGE + CORRUPTION ROW ═══
      const prestigeInfo = Prestige.getInfo();
      const corr = State.meta.corruption || 0;
      html += `<div style="display:flex;gap:6px;margin-bottom:8px;">`;
      
      // Prestige card
      html += `<div style="flex:1;padding:8px;background:rgba(168,85,247,0.06);border:1px solid rgba(168,85,247,0.25);border-radius:6px;">`;
      html += `<div class="section-label" style="color:#a855f7;margin-bottom:4px;">🌟 PRESTIGE ${prestigeInfo.currentLevel > 0 ? 'LV' + prestigeInfo.currentLevel : ''}</div>`;
      if (prestigeInfo.canPrestige) {
        html += `<button onclick="Game.doPrestige()" style="width:100%;padding:4px;background:#a855f7;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:10px;font-weight:bold;">PRESTIGE NOW</button>`;
        html += `<div style="font-size:8px;color:#a855f7;margin-top:3px;">Reset → +${prestigeInfo.nextTier.bonuses.damage}% DMG, +${prestigeInfo.nextTier.bonuses.maxHP}% HP, +${prestigeInfo.nextTier.bonuses.luck} Luck</div>`;
      } else if (prestigeInfo.currentLevel >= prestigeInfo.maxLevel) {
        html += `<div style="font-size:9px;color:#a855f7;">MAX PRESTIGE</div>`;
      } else {
        html += `<div style="font-size:9px;color:#888;">Need Zone ${prestigeInfo.nextTier?.reqDepth || '?'} (best: ${prestigeInfo.bestDepth})</div>`;
      }
      if (prestigeInfo.currentLevel > 0) {
        html += `<div style="font-size:8px;color:#666;margin-top:2px;">+${prestigeInfo.bonuses.damage}% DMG | +${prestigeInfo.bonuses.maxHP}% HP | +${prestigeInfo.bonuses.luck} Luck | +${prestigeInfo.bonuses.xpRate}% XP</div>`;
      }
      html += `</div>`;
      
      // Corruption card
      html += `<div style="flex:1;padding:8px;background:rgba(255,33,85,0.06);border:1px solid rgba(255,33,85,0.25);border-radius:6px;">`;
      html += `<div class="section-label" style="color:#ff2155;margin-bottom:4px;">🔮 CORRUPTION: ${corr}</div>`;
      html += `<div style="display:flex;align-items:center;gap:6px;">`;
      html += `<button onclick="Game.changeCorruption(-1)" style="width:24px;height:24px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:3px;color:#fff;cursor:pointer;font-size:14px;">−</button>`;
      html += `<div style="flex:1;height:8px;background:rgba(255,255,255,0.1);border-radius:4px;position:relative;">`;
      html += `<div style="height:100%;width:${corr*10}%;background:linear-gradient(90deg,#ff2155,#ff6600);border-radius:4px;"></div>`;
      html += `</div>`;
      html += `<button onclick="Game.changeCorruption(1)" style="width:24px;height:24px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:3px;color:#fff;cursor:pointer;font-size:14px;">+</button>`;
      html += `</div>`;
      html += `<div style="font-size:8px;color:#888;margin-top:3px;">+${corr*15}% HP | +${corr*10}% DMG | +${corr*5}% Loot | +${corr*8}% XP</div>`;
      html += `</div>`;
      
      html += `</div>`;
      
      // ═══ TIER PORTALS (compact with integrated difficulty dots) ═══
      for (const portal of portals) {
        const tier = tiers.find(t => t.id === portal.tierId);
        // ALPHA: All portals unlocked regardless of save state
        const unlocked = true;
        const endZone = tier?.zoneEnd || '\u221E';
        const icon = portal.icon || '\u{1F6F8}';
        const enemyLvl = portal.startZone || 1;
        
        if (!unlocked) {
          html += `
            <div class="act-card locked">
              <div class="act-icon">\u{1F512}</div>
              <div class="act-info">
                <h3>${portal.name} <span class="zone-range">Z${portal.startZone}–${endZone}</span></h3>
                <p>LOCKED — Reach Zone ${portal.startZone}</p>
              </div>
            </div>`;
        } else {
          html += `
            <div class="act-card" onclick="Game.startPortalDiff('${portal.id}','normal')" style="cursor:pointer;">
              <div class="act-icon">${icon}</div>
              <div class="act-info">
                <h3>${portal.name} <span class="zone-range">Z${portal.startZone}–${endZone}</span></h3>
                <p>${tier?.description || ''}</p>
                <div class="act-meta">
                  <span style="color:var(--text-dim);">Enemy Lvl ${enemyLvl}+</span>
                  ${tier?.enemyHPMult > 1 ? '<span style="color:var(--danger);">HP×' + tier.enemyHPMult + '</span>' : ''}
                  ${tier?.lootBonus > 1 ? '<span style="color:var(--gold);">Loot×' + tier.lootBonus + '</span>' : ''}
                </div>
              </div>
              <div class="diff-dots">
                <div class="diff-dot diff-normal active" title="Normal (click card)" onclick="event.stopPropagation();Game.startPortalDiff('${portal.id}','normal')">N</div>
                <div class="diff-dot diff-risk" title="Risk: +Loot +Danger" onclick="event.stopPropagation();Game.startPortalDiff('${portal.id}','risk')">R</div>
                <div class="diff-dot diff-chaos" title="Chaos: Maximum danger" onclick="event.stopPropagation();Game.startPortalDiff('${portal.id}','chaos')">C</div>
              </div>
            </div>`;
        }
      }
      // ═══ ACHIEVEMENTS PANEL ═══
      const achData = Achievements.getDisplayData();
      html += `<div style="padding:8px;background:rgba(255,215,0,0.03);border:1px solid rgba(255,215,0,0.15);border-radius:6px;margin-top:8px;">`;
      html += `<div class="section-label" style="margin-bottom:4px;color:#ffd700;">🏆 ACHIEVEMENTS (${achData.done}/${achData.total})</div>`;
      // Progress bar
      const achPct = achData.total > 0 ? (achData.done / achData.total * 100) : 0;
      html += `<div style="height:4px;background:rgba(255,255,255,0.08);border-radius:2px;margin-bottom:6px;"><div style="height:100%;width:${achPct}%;background:linear-gradient(90deg,#ffd700,#ff8c00);border-radius:2px;"></div></div>`;
      // Show recent/incomplete by category
      for (const [cat, achs] of Object.entries(achData.categories)) {
        const catDone = achs.filter(a => a.completed).length;
        const catTotal = achs.length;
        const catLabel = cat.charAt(0).toUpperCase() + cat.slice(1);
        html += `<div style="font-size:9px;color:#888;margin-top:4px;">${catLabel} (${catDone}/${catTotal})</div>`;
        html += `<div style="display:flex;flex-wrap:wrap;gap:3px;">`;
        for (const a of achs) {
          const bg = a.completed ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.03)';
          const opacity = a.completed ? '1' : '0.5';
          const border = a.completed ? '1px solid rgba(255,215,0,0.3)' : '1px solid rgba(255,255,255,0.08)';
          const rewardStr = [];
          if (a.reward.scrap) rewardStr.push(`${a.reward.scrap}🔧`);
          if (a.reward.cells) rewardStr.push(`${a.reward.cells}⚡`);
          html += `<div title="${a.desc}${a.completed ? ' ✓' : ' — Reward: ' + rewardStr.join(', ')}" style="padding:2px 5px;background:${bg};border:${border};border-radius:3px;font-size:8px;opacity:${opacity};cursor:default;">${a.icon} ${a.name}${a.completed ? ' ✓' : ''}</div>`;
        }
        html += `</div>`;
      }
      html += `</div>`;
      
      // ═══ LEADERBOARD (Best Runs) ═══
      const lb = State.meta.leaderboard || [];
      if (lb.length > 0) {
        html += `<div style="padding:8px;background:rgba(0,212,255,0.03);border:1px solid rgba(0,136,170,0.15);border-radius:6px;margin-top:8px;">`;
        html += `<div class="section-label" style="margin-bottom:4px;color:#00d4ff;">📊 BEST RUNS</div>`;
        for (let i = 0; i < Math.min(7, lb.length); i++) {
          const r = lb[i];
          const diffIcon = r.difficulty === 'chaos' ? '🔴' : r.difficulty === 'risk' ? '🟠' : '🟢';
          const corrStr = r.corruption > 0 ? ` 🔮${r.corruption}` : '';
          const mins = Math.floor(r.time / 60);
          const secs = r.time % 60;
          const dmgStr = r.damage ? ` ${Game.formatNumber(r.damage)} dmg` : '';
          const streakStr = r.bestStreak ? ` 🔥${r.bestStreak}` : '';
          const bossStr = r.bossKills ? ` 👑${r.bossKills}` : '';
          html += `<div style="display:flex;justify-content:space-between;align-items:center;font-size:9px;padding:2px 0;border-bottom:1px solid rgba(255,255,255,0.04);">`;
          html += `<span style="color:#666;width:16px;">#${i+1}</span>`;
          html += `<span style="color:#fff;flex:1;">Zone ${r.depth} ${diffIcon}${corrStr}</span>`;
          html += `<span style="color:#888;">${r.kills}☠${streakStr}${bossStr}${dmgStr}</span>`;
          html += `<span style="color:#666;margin-left:6px;">${mins}m${secs < 10 ? '0' : ''}${secs}s</span>`;
          html += `</div>`;
        }
        html += `</div>`;
      }
      
      // ═══ SAVE EXPORT/IMPORT ═══
      html += `<div style="display:flex;gap:6px;margin-top:8px;">`;
      html += `<button onclick="Game.exportSave()" style="flex:1;padding:5px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#aaa;cursor:pointer;font-size:9px;">📤 Export Save</button>`;
      html += `<button onclick="Game.importSave()" style="flex:1;padding:5px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#aaa;cursor:pointer;font-size:9px;">📥 Import Save</button>`;
      html += `</div>`;
      
      actsEl.innerHTML = html;
    }
    
    // Update UI panels
    UI.renderAll();
  },
  
  // ========== GAME FLOW ==========
  
  startAct(actId) {
    // console.log(`[GAME] Starting ${actId}...`);
    
    // Generate seed (can be customized)
    const seed = SeededRandom.fromString(actId + '_' + Date.now());
    
    // Hide hub modal
    this.hideModal('hubModal');
    
    // Reset run state
    resetRun();
    State.run.active = true;
    State.run.currentAct = actId;
    
    // Calculate stats and init HP
    Stats.calculate();
    Stats.initializeHP();
    
    // Start the act via SceneManager
    SceneManager.startAct(actId, seed);
    
    // Announce
    const actName = State.data.acts?.[actId]?.name || actId;
    this.announce(`[COMBAT] ${actName.toUpperCase()}`, 'boss');
    
    UI.renderAll();
  },
  
  // -- Resume from highest zone with difficulty --
  startResume(difficulty = 'normal') {
    if (!State.meta.highestZones) State.meta.highestZones = { normal: 0, risk: 0, chaos: 0 };
    const highestZone = State.meta.highestZones[difficulty] || 1;
    if (highestZone < 2) {
      // Fallback: start from zone 1 for this difficulty
      this.startPortalDiff('portal1', difficulty);
      return;
    }
    const acts = State.data.acts;
    
    // Find the tier for this zone
    const tiers = acts?.tiers || [];
    const tier = tiers.find(t => {
      const zs = t.zoneStart || 1;
      const ze = t.zoneEnd || Infinity;
      return highestZone >= zs && highestZone <= ze;
    }) || tiers[0];
    
    if (!tier) {
      console.error('No tier found for zone', highestZone);
      return;
    }
    
    const tierName = tier.name || 'Unknown';
    const diffLabel = difficulty === 'chaos' ? '🔴 CHAOS' : difficulty === 'risk' ? '🟠 RISK' : '🟢 NORMAL';
    // console.log(`[GAME] Resuming Zone ${highestZone} (${tierName}) [${difficulty}]`);
    
    const seed = SeededRandom.fromString(tier.id + '_' + Date.now());
    
    this.hideModal('hubModal');
    
    resetRun();
    State.run.active = true;
    State.run.currentAct = tier.id;
    State.run.difficulty = difficulty;
    State.run.startZone = highestZone;
    
    Stats.calculate();
    Stats.initializeHP();
    
    // Use SceneManager for proper transition (World.init accepts zone numbers)
    SceneManager.startAct(highestZone, seed);
    
    this.announce(`${diffLabel} — ${tierName.toUpperCase()} ZONE ${highestZone}`, 'boss');
    if (difficulty !== 'normal' && Audio?.difficultyStart) Audio.difficultyStart(difficulty);
    UI.renderAll();
  },
  
  // -- Start portal with difficulty selection --
  startPortalDiff(portalId, difficulty = 'normal') {
    // Store difficulty then delegate to existing startPortal
    this._pendingDifficulty = difficulty;
    this.startPortal(portalId);
  },

  startPortal(portalId) {
    const acts = State.data.acts;
    const portal = acts?.portals?.find(p => p.id === portalId);
    if (!portal) {
      console.error('Portal not found:', portalId);
      return;
    }

    const tier = acts.tiers?.find(t => t.id === portal.tierId);
    const tierName = tier?.name || portal.name;
    const difficulty = this._pendingDifficulty || 'normal';
    this._pendingDifficulty = null;
    const diffLabel = difficulty === 'chaos' ? '🔴 CHAOS' : difficulty === 'risk' ? '🟠 RISK' : '🟢 NORMAL';
    // console.log(`Entering ${portal.name} (Zone ${portal.startZone}+) [${difficulty}]`);

    const seed = SeededRandom.fromString(portal.tierId + '_' + Date.now());

    this.hideModal('hubModal');

    resetRun();
    State.run.active = true;
    State.run.currentAct = portal.tierId;
    State.run.difficulty = difficulty;
    State.run.startZone = portal.startZone;

    Stats.calculate();
    Stats.initializeHP();

    // Use portal ID -> World.init resolves tier + starting zone
    SceneManager.startAct(portalId, seed);

    this.announce(`${diffLabel} — ${tierName.toUpperCase()} ZONE ${portal.startZone}`, 'boss');
    if (difficulty !== 'normal' && Audio?.difficultyStart) Audio.difficultyStart(difficulty);
    UI.renderAll();
  },

  returnToHub() {
    SceneManager.returnToHub('portal');
    
    // Add earned resources
    State.meta.scrap += State.run.scrapEarned;
    // v2.14.0: Expanded tracking
    State.meta.totalRuns = (State.meta.totalRuns || 0) + 1;
    State.meta.totalKills = (State.meta.totalKills || 0) + (State.run.stats?.kills || 0);
    State.meta.totalPlaytime = (State.meta.totalPlaytime || 0) + (State.run.stats?.timeElapsed || 0);
    State.meta.totalScrapEarned = (State.meta.totalScrapEarned || 0) + State.run.scrapEarned;
    
    // ═══ v2.13.0: Record run to leaderboard ═══
    this.recordRunToLeaderboard();
    
    Save.save();
    
    setTimeout(() => {
      this.showHub();
    }, 600);
  },
  
  // ═══ v2.13.0: MISSION SYSTEM ═══
  claimMission(missionId) {
    const reward = Missions.claim(missionId);
    if (reward) {
      const label = reward.type === 'scrap' ? '🔧 Scrap' : '⚡ Cells';
      this.announce(`MISSION COMPLETE: +${reward.amount} ${label}`, 'loot');
      if (Audio?.levelUp) Audio.levelUp();
      Save.save();
      this.renderHubUI();
    }
  },
  
  // ═══ v2.13.0: PRESTIGE SYSTEM ═══
  doPrestige() {
    if (!confirm('PRESTIGE RESET\n\nThis will reset your level, gear, stash, skills, and zone progress.\n\nYou keep: permanent stat bonuses, leaderboard, total kills/playtime.\n\nContinue?')) return;
    
    const result = Prestige.doPrestige();
    if (result) {
      this.announce(`🌟 PRESTIGE ${result.level}! +${result.bonuses.damage}% DMG, +${result.bonuses.maxHP}% HP`, 'boss');
      if (Audio?.levelUp) Audio.levelUp();
      // v2.14.0: Achievement tracking
      try { Achievements.onPrestige(); } catch(e) {}
      Stats.calculate();
      Save.save();
      this.renderHubUI();
    }
  },
  
  // ═══ v2.13.0: CORRUPTION SYSTEM ═══
  changeCorruption(delta) {
    const current = State.meta.corruption || 0;
    State.meta.corruption = Math.max(0, Math.min(10, current + delta));
    Save.save();
    this.renderHubUI();
  },
  
  // ═══ v2.13.0: LEADERBOARD ═══
  recordRunToLeaderboard() {
    if (!Array.isArray(State.meta.leaderboard)) State.meta.leaderboard = [];
    
    const depth = State.run.currentDepth || World.zoneIndex + 1 || 1;
    if (depth <= 1) return; // don't record empty runs
    
    const entry = {
      depth: depth,
      kills: State.run.stats?.kills || 0,
      time: Math.round(State.run.stats?.timeElapsed || 0),
      scrap: State.run.scrapEarned || 0,
      difficulty: State.run.difficulty || 'normal',
      corruption: State.run.corruption || 0,
      level: State.meta.level || 1,
      damage: Math.round(State.run.stats?.damageDealt || 0),
      bestStreak: State.run.stats?.bestStreak || 0,
      bossKills: State.run.stats?.bossKills || 0,
      date: Date.now()
    };
    
    State.meta.leaderboard.push(entry);
    // Keep top 15 by depth
    State.meta.leaderboard.sort((a, b) => b.depth - a.depth);
    if (State.meta.leaderboard.length > 15) {
      State.meta.leaderboard = State.meta.leaderboard.slice(0, 15);
    }
  },
  
  // ═══ v2.13.0: SAVE EXPORT/IMPORT ═══
  exportSave() {
    const data = Save.export();
    if (!data) { alert('No save data found.'); return; }
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bonzookaa_save_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
  
  importSave() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const success = Save.import(ev.target.result);
        if (success) {
          Stats.calculate();
          this.renderHubUI();
          this.announce('Save imported!', 'loot');
        } else {
          alert('Import failed — invalid save file.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  },
  
  onBossKilled(actId) {
    // Track mission boss kills
    try { Missions.onEnemyKill({ isBoss: true, isElite: false }); } catch(e) {}
    
    // Mark act as completed
    if (!State.meta.actsCompleted) State.meta.actsCompleted = {};
    State.meta.actsCompleted[actId] = true;
    
    // Unlock next acts from rewards
    const actData = State.data.acts?.[actId];
    if (actData?.rewards?.unlocks) {
      for (const unlockId of actData.rewards.unlocks) {
        State.meta.actsUnlocked[unlockId] = true;
      }
    }
    
    // Add completion bonus
    if (actData?.rewards?.completionScrap) {
      State.run.scrapEarned += actData.rewards.completionScrap;
    }
    
    Save.save();
    
    this.announce('[OK] ACT COMPLETE!', 'boss');
  },
  
  onDeath() {
    State.run.active = false;
    try { Contracts.assertDeathUI(); } catch(e) { console.warn(e.message); }
    
    // Add earnings (partial)
    State.meta.scrap += Math.floor(State.run.scrapEarned * 0.5);
    State.meta.totalRuns++;
    State.meta.totalKills += State.run.stats.kills;
    State.meta.totalPlaytime += State.run.stats.timeElapsed;
    // v2.14.0: Expanded tracking
    State.meta.totalScrapEarned = (State.meta.totalScrapEarned || 0) + Math.floor(State.run.scrapEarned * 0.5);
    
    // ═══ v2.13.0: Record run to leaderboard ═══
    this.recordRunToLeaderboard();
    
    // ═══ v2.15.0: AntiExploit — track reset + EV check ═══
    try {
      const { AntiExploit: AE } = State.modules || {};
      if (AE) { AE.onZoneReset(); AE.snapshot(); AE.checkEVSpike(); }
    } catch (e) { /* safe */ }
    
    Save.save();
    
    // Update death modal
    document.getElementById('deathWave').textContent = `Zone ${World.zoneIndex + 1}`;
    document.getElementById('deathKills').textContent = State.run.stats.kills;
    document.getElementById('deathDmg').textContent = this.formatNumber(State.run.stats.damageDealt);
    document.getElementById('deathTime').textContent = this.formatTime(State.run.stats.timeElapsed);
    document.getElementById('deathScrapEarned').textContent = Math.floor(State.run.scrapEarned * 0.5);
    document.getElementById('deathXP').textContent = State.run.xpEarned;
    
    this.showModal('deathModal');
  },
  
  restart() {
    this.hideModal('deathModal');
    const actId = State.run.currentAct || 'portal1';
    // Check if it was started via portal system
    if (actId.startsWith('tier') || actId.startsWith('portal')) {
      this.startPortal(actId.startsWith('tier') ? 
        (State.data.acts?.portals?.find(p => p.tierId === actId)?.id || 'portal1') : actId);
    } else {
      this.startAct(actId);
    }
  },
  
  toHub() {
    this.hideModal('deathModal');
    this.showHub();
  },
  
  // ========== VENDOR ==========
  
  openVendor() {
    try { Contracts.assertVendorUI(); } catch(e) { console.warn(e.message); }
    State.ui.paused = true;
    UI.renderVendor();
    this.showModal('vendorModal');
  },
  
  closeVendor() {
    this.hideModal('vendorModal');
    State.ui.paused = false;
    Stats.calculate();
    UI.renderShipStats();
  },

  // ========== CRAFTING UI ==========
  _craftSelectedItem: null,
  _craftPickerOpen: false,

  openCrafting() {
    this._craftSelectedItem = null;
    this._craftPickerOpen = false;
    this._updateCraftCurrencies();
    this._renderCraftRecipes();
    document.getElementById('craftStashPick').style.display = 'none';
    document.getElementById('craftResult').className = 'craft-result';
    document.getElementById('craftResult').textContent = '';
    document.getElementById('craftItemSlot').innerHTML = '<span class="slot-label">Select Item</span>';
    document.getElementById('craftItemName').textContent = '--';
    document.getElementById('craftSalvageBtn').disabled = true;
    this.showModal('craftModal');
  },

  closeCrafting() {
    this.hideModal('craftModal');
    UI.renderAll();
  },

  _updateCraftCurrencies() {
    const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    el('craftScrap', State.meta.scrap || 0);
    el('craftCells', State.run?.cells || State.meta.cells || 0);
    el('craftVoidShards', State.meta.voidShards || 0);
    el('craftCosmicDust', State.meta.cosmicDust || 0);
  },

  craftSelectItem() {
    // Toggle item picker visibility
    const picker = document.getElementById('craftStashPick');
    if (this._craftPickerOpen) {
      picker.style.display = 'none';
      this._craftPickerOpen = false;
      return;
    }

    const stash = State.meta.stash || [];
    if (stash.length === 0) {
      picker.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-dim);font-size:11px;padding:12px;">Stash is empty</div>';
      picker.style.display = 'grid';
      this._craftPickerOpen = true;
      return;
    }

    const rarityColors = { common: '#aaa', uncommon: '#4a4', rare: '#44f', epic: '#a4a', legendary: '#fa0', mythic: '#f44' };
    let html = '';
    for (const item of stash) {
      const color = rarityColors[item.rarity] || '#666';
      const sel = this._craftSelectedItem?.id === item.id ? ' selected' : '';
      const icon = item.icon || item.slot?.[0]?.toUpperCase() || '?';
      html += `<div class="craft-stash-item${sel}" style="border-color:${color}" onclick="Game.craftPickItem('${item.id}')">
        <span>${icon}</span>
        <span class="item-ilvl">${item.ilvl || 1}</span>
      </div>`;
    }
    picker.innerHTML = html;
    picker.style.display = 'grid';
    this._craftPickerOpen = true;
  },

  craftPickItem(itemId) {
    const item = (State.meta.stash || []).find(i => i.id === itemId);
    if (!item) return;

    this._craftSelectedItem = item;
    this._craftPickerOpen = false;
    document.getElementById('craftStashPick').style.display = 'none';

    // Update slot display with FULL item stats
    const slot = document.getElementById('craftItemSlot');
    const rarityColors = { common: '#aaa', uncommon: '#4a4', rare: '#44f', epic: '#a4a', legendary: '#fa0', mythic: '#f44' };
    const rc = rarityColors[item.rarity] || '#666';
    
    let statsHtml = `<span style="font-size:20px;">${item.icon || '?'}</span>`;
    // Show base stats
    if (item.baseStats) {
      for (const [stat, val] of Object.entries(item.baseStats)) {
        if (val) statsHtml += `<div style="font-size:8px;color:#ccc;margin-top:1px">${stat}: ${typeof val === 'number' ? val.toFixed(1) : val}</div>`;
      }
    }
    // Show affixes
    if (item.affixes?.length) {
      for (const af of item.affixes) {
        statsHtml += `<div style="font-size:8px;color:#8af;margin-top:1px">+${typeof af.value === 'number' ? af.value.toFixed(1) : af.value} ${af.name || af.stat}</div>`;
      }
    }
    
    slot.innerHTML = statsHtml;
    slot.style.borderColor = rc;
    slot.style.borderStyle = 'solid';
    slot.className = 'craft-item-slot filled';
    document.getElementById('craftItemName').textContent = item.name || 'Unknown';
    document.getElementById('craftItemName').style.color = rc;
    document.getElementById('craftSalvageBtn').disabled = false;

    // Clear result
    document.getElementById('craftResult').className = 'craft-result';
    document.getElementById('craftResult').innerHTML = '';

    this._renderCraftRecipes();
  },

  _renderCraftRecipes() {
    const container = document.getElementById('craftRecipes');
    const recipes = State.data.crafting?.recipes;
    const item = this._craftSelectedItem;

    if (!recipes || !item) {
      container.innerHTML = '<div style="color:var(--text-dim);font-size:11px;text-align:center;padding:20px;">Select an item from your stash first</div>';
      return;
    }

    // Lazy import Crafting
    const Crafting = State.modules?.Crafting;
    if (!Crafting) {
      container.innerHTML = '<div style="color:var(--danger);font-size:11px;text-align:center;padding:12px;">Crafting module not loaded</div>';
      return;
    }

    const recipeIcons = {
      reroll_affixes: '&#x1F3B2;', upgrade_rarity: '&#x2B06;&#xFE0F;',
      reroll_single_affix: '&#x1F504;', add_affix: '&#x2795;',
      salvage_advanced: '&#x1F5D1;', enchant_boost: '&#x2728;'
    };
    
    // Friendly descriptions per recipe
    const friendlyDesc = {
      reroll_affixes: `Re-randomize ALL bonus stats on this ${item.rarity || ''} item`,
      upgrade_rarity: `Try to upgrade rarity: ${item.rarity || '?'} → next tier`,
      reroll_single_affix: 'Pick one bonus stat and re-roll its value',
      add_affix: `Add another bonus stat (${(item.affixes||[]).length}/${this._maxAffixes(item)} slots used)`,
      enchant_boost: `Boost all base stats by 10-20% (${item._enchants || 0}/3 used)`
    };

    let html = '';
    for (const [id, recipe] of Object.entries(recipes)) {
      if (id === 'salvage_advanced') continue; // separate button

      const costs = Crafting.calcCost(id, item);
      const canAfford = costs ? Crafting.canAfford(costs) : false;
      const check = Crafting._checkConstraints ? Crafting._checkConstraints(recipe, item) : { ok: true };
      const disabled = !check.ok || !canAfford;
      
      // Build reason text when disabled
      let reasonText = '';
      if (!check.ok) {
        reasonText = check.reason || 'Not available for this item';
      } else if (!canAfford) {
        reasonText = 'Not enough materials';
      }

      // Format costs with icons
      let costStr = '';
      if (costs) {
        const parts = [];
        if (costs.scrap) parts.push(`<span style="color:#ffd700">${costs.scrap}</span> &#x2699;`);
        if (costs.cells) parts.push(`<span style="color:#00d4ff">${costs.cells}</span> &#x26A1;`);
        if (costs.voidShard) parts.push(`<span style="color:#aa55ff">${costs.voidShard}</span> &#x1F4A0;`);
        if (costs.cosmicDust) parts.push(`<span style="color:#ffaa00">${costs.cosmicDust}</span> &#x2728;`);
        costStr = parts.join(' &middot; ');
      }

      // Success chance
      let chanceStr = '';
      if (recipe.successChance && recipe.successChance[item.rarity]) {
        const pct = Math.round(recipe.successChance[item.rarity] * 100);
        const color = pct >= 70 ? '#0f0' : pct >= 40 ? '#fa0' : '#f44';
        chanceStr = `<div class="recipe-chance" style="color:${color}">${pct}% success</div>`;
      }

      html += `<div class="craft-recipe ${disabled ? 'disabled' : ''}" onclick="${disabled ? '' : `Game.craftExecute('${id}')`}">
        <div class="recipe-icon">${recipeIcons[id] || '&#x2699;'}</div>
        <div class="recipe-info">
          <div class="recipe-name">${recipe.name}</div>
          <div class="recipe-desc">${friendlyDesc[id] || recipe.description || ''}</div>
          ${chanceStr}
          ${disabled && reasonText ? `<div style="font-size:8px;color:#f66;margin-top:2px">⚠ ${reasonText}</div>` : ''}
        </div>
        <div class="recipe-cost ${canAfford ? '' : 'expensive'}">${costStr || 'FREE'}</div>
      </div>`;
    }

    container.innerHTML = html || '<div style="color:var(--text-dim);font-size:11px;text-align:center;">No recipes available</div>';
  },
  
  _maxAffixes(item) {
    const caps = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6 };
    return caps[item?.rarity] || 3;
  },

  craftExecute(recipeId) {
    const item = this._craftSelectedItem;
    if (!item) return;

    const Crafting = State.modules?.Crafting;
    if (!Crafting) return;

    const resultEl = document.getElementById('craftResult');
    
    // ═══ CAPTURE BEFORE STATE ═══
    const beforeSnap = {
      name: item.name,
      rarity: item.rarity,
      affixes: (item.affixes || []).map(a => ({ ...a })),
      baseStats: item.baseStats ? { ...item.baseStats } : {}
    };
    
    let result;

    // Route to correct method
    switch (recipeId) {
      case 'reroll_affixes': result = Crafting.rerollAffixes(item.id); break;
      case 'upgrade_rarity': result = Crafting.upgradeRarity(item.id); break;
      case 'reroll_single_affix': result = Crafting.rerollSingleAffix?.(item.id) || { ok: false, reason: 'Not implemented' }; break;
      case 'add_affix': result = Crafting.addAffix(item.id); break;
      case 'enchant_boost': result = Crafting.enchantBoost(item.id); break;
      default: result = { ok: false, reason: 'Unknown recipe' };
    }

    if (result.ok) {
      const afterItem = result.item || item;
      
      // ═══ BUILD BEFORE → AFTER COMPARISON ═══
      let compareHtml = '<div style="font-size:11px;font-weight:600;color:#0f0;margin-bottom:6px">✓ SUCCESS</div>';
      compareHtml += '<div style="display:flex;gap:12px;font-size:10px">';
      
      // BEFORE column
      compareHtml += '<div style="flex:1;opacity:0.5">';
      compareHtml += `<div style="font-weight:600;color:#888;margin-bottom:3px">BEFORE</div>`;
      compareHtml += `<div style="color:#888">${beforeSnap.name}</div>`;
      compareHtml += `<div style="color:#666;font-size:9px">${beforeSnap.rarity}</div>`;
      if (beforeSnap.affixes.length) {
        for (const af of beforeSnap.affixes) {
          compareHtml += `<div style="color:#668">+${typeof af.value === 'number' ? af.value.toFixed(1) : af.value} ${af.name || af.stat}</div>`;
        }
      } else {
        compareHtml += '<div style="color:#444">no affixes</div>';
      }
      compareHtml += '</div>';
      
      // Arrow
      compareHtml += '<div style="display:flex;align-items:center;color:#0f0;font-size:16px">→</div>';
      
      // AFTER column
      compareHtml += '<div style="flex:1">';
      compareHtml += `<div style="font-weight:600;color:#0f0;margin-bottom:3px">AFTER</div>`;
      const rarityColors2 = { common: '#aaa', uncommon: '#4a4', rare: '#44f', epic: '#a4a', legendary: '#fa0', mythic: '#f44' };
      compareHtml += `<div style="color:${rarityColors2[afterItem.rarity] || '#fff'}">${afterItem.name}</div>`;
      compareHtml += `<div style="color:${rarityColors2[afterItem.rarity] || '#666'};font-size:9px">${afterItem.rarity}</div>`;
      if (afterItem.affixes?.length) {
        for (const af of afterItem.affixes) {
          // Highlight changed/new affixes
          const wasBefore = beforeSnap.affixes.find(b => b.stat === af.stat);
          const isNew = !wasBefore;
          const isBetter = wasBefore && af.value > wasBefore.value;
          const isWorse = wasBefore && af.value < wasBefore.value;
          const col = isNew ? '#0f0' : isBetter ? '#0f0' : isWorse ? '#f44' : '#8af';
          compareHtml += `<div style="color:${col}">+${typeof af.value === 'number' ? af.value.toFixed(1) : af.value} ${af.name || af.stat}${isNew ? ' ★NEW' : isBetter ? ' ▲' : isWorse ? ' ▼' : ''}</div>`;
        }
      } else {
        compareHtml += '<div style="color:#444">no affixes</div>';
      }
      compareHtml += '</div></div>';
      
      resultEl.className = 'craft-result show success';
      resultEl.innerHTML = compareHtml;
      
      // v2.14.0: Achievement tracking
      try { Achievements.onCraft(); } catch(e) {}
      
      // Refresh selected item display
      this._craftSelectedItem = afterItem;
      this.craftPickItem(afterItem.id);
    } else {
      resultEl.className = 'craft-result show fail';
      resultEl.textContent = result.reason || 'Craft failed';
    }

    this._updateCraftCurrencies();
    this._renderCraftRecipes();
    Save.save();
  },

  craftSalvage() {
    const item = this._craftSelectedItem;
    if (!item) return;

    const Crafting = State.modules?.Crafting;
    if (!Crafting) return;

    const result = Crafting.salvage(item.id);
    const resultEl = document.getElementById('craftResult');

    if (result.ok) {
      resultEl.className = 'craft-result show success';
      let yieldStr = '';
      if (result.gained) {
        const parts = [];
        for (const [k, v] of Object.entries(result.gained)) {
          if (v > 0) parts.push(`+${v} ${k}`);
        }
        yieldStr = parts.join(', ');
      }
      resultEl.textContent = 'SALVAGED! ' + yieldStr;
      this._craftSelectedItem = null;
      document.getElementById('craftItemSlot').innerHTML = '<span class="slot-label">Select Item</span>';
      document.getElementById('craftItemSlot').style.borderStyle = 'dashed';
      document.getElementById('craftItemSlot').style.borderColor = '';
      document.getElementById('craftItemSlot').className = 'craft-item-slot';
      document.getElementById('craftItemName').textContent = '--';
      document.getElementById('craftSalvageBtn').disabled = true;
    } else {
      resultEl.className = 'craft-result show fail';
      resultEl.textContent = result.reason || 'Cannot salvage';
    }

    this._updateCraftCurrencies();
    this._renderCraftRecipes();
    Save.save();
  },
  
  // ========== UI HELPERS ==========
  
  announce(text, type = '') {
    const el = document.getElementById('announcement');
    if (el) {
      el.textContent = text;
      el.className = 'show ' + type;
      setTimeout(() => el.className = '', 2500);
    }
  },
  
  updateHUD() {
    try { Contracts.assertCombatHUD(); } catch(e) { console.warn(e.message); return; }
    const p = State.player;
    const zone = World.currentZone;
    
    document.getElementById('hudCells').textContent = State.run.cells;
    document.getElementById('hudScrap').textContent = State.meta.scrap + State.run.scrapEarned;
    document.getElementById('levelBadge').textContent = State.meta.level;
    
    // Show zone depth + tier name
    const tierName = World.currentAct?.name || '';
    const zoneText = zone?.isBossZone ? 'BOSS Z' + (World.zoneIndex + 1) : 'ZONE ' + (World.zoneIndex + 1);
    document.getElementById('waveDisplay').textContent = zoneText;
    
    // XP
    const xpProgress = Leveling.getProgress();
    const xpNeeded = Leveling.xpForLevel(State.meta.level);
    document.getElementById('xpBar').style.width = (xpProgress * 100) + '%';
    document.getElementById('xpText').textContent = `${State.meta.xp} / ${xpNeeded} XP`;
    
    // HP
    const hpPct = (p.hp / p.maxHP) * 100;
    const hpBar = document.getElementById('hpBar');
    hpBar.style.width = hpPct + '%';
    hpBar.className = 'player-bar-fill hp' + (hpPct < 30 ? ' low' : '');
    document.getElementById('hpText').textContent = `${Math.ceil(p.hp)}/${Math.round(p.maxHP)}`;
    
    // Shield
    const shPct = p.maxShield > 0 ? (p.shield / p.maxShield) * 100 : 0;
    document.getElementById('shieldBar').style.width = shPct + '%';
    document.getElementById('shieldText').textContent = `${Math.ceil(p.shield)}/${Math.round(p.maxShield)}`;
  },
  
  showModal(id) {
    document.getElementById(id)?.classList.add('active');
  },
  
  hideModal(id) {
    document.getElementById(id)?.classList.remove('active');
  },
  
  // ========== DEBUG ==========
  
  debugAddItems() {
    const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    for (let i = 0; i < 8; i++) {
      const rarity = rarities[Math.floor(Math.random() * rarities.length)];
      const item = Items.generateRandom(rarity);
      if (item) Items.addToStash(item);
    }
    Save.save();
    UI.renderAll();
  },
  
  debugAddResources() {
    State.meta.scrap += 1000;
    State.meta.skillPoints += 10;
    State.meta.statPoints += 20;
    State.run.cells += 500;
    Save.save();
    UI.renderAll();
    this.renderHubUI();
  },
  
  debugUnlockAll() {
    const acts = State.data.acts;
    if (acts) {
      for (const actId of Object.keys(acts)) {
        State.meta.actsUnlocked[actId] = true;
      }
    }
    Save.save();
    this.renderHubUI();
    // console.log('🔓 All acts unlocked');
  },
  
  debugTeleport(zoneIndex) {
    if (World.currentZone) {
      World.loadZone(zoneIndex);
      // console.log(` Teleported to zone ${zoneIndex}`);
    }
  },
  
  // ========== FORMATTING ==========
  
  formatNumber(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return Math.floor(n).toString();
  },
  
  formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }
};

// Global access
window.Game = Game;

// Init on DOM ready
document.addEventListener('DOMContentLoaded', () => Game.init());
