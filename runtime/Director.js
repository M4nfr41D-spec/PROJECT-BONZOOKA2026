import { State } from './State.js';

// ============================================================
// DIRECTOR.js — AI-Driven Encounter Pacing (v2.16.0)
// ============================================================
// Implements Left 4 Dead-style "peaks and valleys" intensity 
// modeling for BONZOOKAA endless zones. Controls enemy spawn 
// density, elite promotion rates, hazard frequency, and loot 
// burst windows to create rhythmic engagement.
//
// Integration: called by World.update() and Enemies.update()
// Data: reads from data/director.json for tuning knobs
// Telemetry: emits events via State.modules.Telemetry if present

// --- Constants ---
const PHASE_BUILD    = 'build';     // Ramp up intensity
const PHASE_PEAK     = 'peak';      // Max pressure
const PHASE_RELAX    = 'relax';     // Recovery window
const PHASE_REWARD   = 'reward';    // Loot burst / bonus
const PHASE_AMBUSH   = 'ambush';    // Surprise spike (rare)

const DEFAULT_CONFIG = {
  // Phase durations (seconds) — base values, modified by depth
  buildDuration:   [8, 15],    // min-max range
  peakDuration:    [4, 8],
  relaxDuration:   [5, 10],
  rewardDuration:  [3, 5],
  ambushChance:    0.12,       // % chance after relax → ambush instead of build
  
  // Intensity knobs (multipliers applied to base spawn/difficulty)
  buildIntensity:  { spawnRate: 1.0, eliteChance: 0.0, hazardRate: 0.5 },
  peakIntensity:   { spawnRate: 2.0, eliteChance: 0.25, hazardRate: 1.5 },
  relaxIntensity:  { spawnRate: 0.3, eliteChance: 0.0, hazardRate: 0.0 },
  rewardIntensity: { spawnRate: 0.1, eliteChance: 0.0, hazardRate: 0.0 },
  ambushIntensity: { spawnRate: 3.0, eliteChance: 0.5, hazardRate: 2.0 },
  
  // Adaptive tuning based on player performance
  adaptiveEnabled: true,
  stressDecayRate: 0.15,       // stress decays per second in relax
  stressGainOnHit: 0.08,      // stress rises when player takes damage
  stressGainOnKill: -0.02,    // stress drops per kill (player doing well)
  stressThresholdHigh: 0.8,   // extend relax if stress > this
  stressThresholdLow: 0.2,    // shorten relax if stress < this
  
  // Loot burst during REWARD phase
  rewardLootMultiplier: 1.8,  // loot drop chance multiplier
  rewardXPMultiplier: 1.5,    // XP gain multiplier
  rewardCellBonus: 0.3,       // chance of bonus cell drop per kill
  
  // Depth scaling (makes cycles faster/harder at high zones)
  depthSpeedScale: 0.002,     // phases get shorter by this % per zone
  depthIntensityScale: 0.003, // intensity multipliers grow by this % per zone
  maxDepthBonus: 2.0          // cap on depth scaling
};

// --- Director State ---
const DirectorState = {
  phase: PHASE_BUILD,
  phaseTimer: 0,
  phaseDuration: 10,
  intensity: 0,          // 0.0 (calm) → 1.0 (maximum pressure)
  stress: 0.5,           // player stress level (adaptive DDA)
  cycleCount: 0,         // how many full build→peak→relax cycles
  totalTime: 0,
  lastPhase: null,
  
  // Per-phase stats for telemetry
  phaseKills: 0,
  phaseDamageDealt: 0,
  phaseDamageTaken: 0,
  phaseItemsDropped: 0,
  
  // Modifiers output (consumed by spawn/loot systems)
  modifiers: {
    spawnRateMult: 1.0,
    elitePromotionChance: 0.0,
    hazardRateMult: 1.0,
    lootDropMult: 1.0,
    xpMult: 1.0,
    cellBonusChance: 0.0
  }
};

// --- Main Export ---
export const Director = {
  config: { ...DEFAULT_CONFIG },
  state: DirectorState,
  
  // ========== INITIALIZATION ==========
  
  init(customConfig = null) {
    if (customConfig) {
      Object.assign(this.config, customConfig);
    }
    this.reset();
  },
  
  reset() {
    const s = this.state;
    s.phase = PHASE_BUILD;
    s.phaseTimer = 0;
    s.phaseDuration = this._rollDuration(PHASE_BUILD);
    s.intensity = 0;
    s.stress = 0.5;
    s.cycleCount = 0;
    s.totalTime = 0;
    s.lastPhase = null;
    s.phaseKills = 0;
    s.phaseDamageDealt = 0;
    s.phaseDamageTaken = 0;
    s.phaseItemsDropped = 0;
    this._updateModifiers();
  },
  
  // ========== LOAD CONFIG FROM JSON ==========
  
  loadConfig(directorData) {
    if (!directorData) return;
    // Merge with defaults (don't overwrite missing keys)
    for (const [key, val] of Object.entries(directorData)) {
      if (key in this.config) {
        if (typeof val === 'object' && !Array.isArray(val)) {
          Object.assign(this.config[key], val);
        } else {
          this.config[key] = val;
        }
      }
    }
  },
  
  // ========== MAIN UPDATE (call every frame) ==========
  
  update(dt, playerState, runState) {
    if (!runState?.active) return;
    
    const s = this.state;
    const c = this.config;
    
    s.totalTime += dt;
    s.phaseTimer += dt;
    
    // Update adaptive stress
    if (c.adaptiveEnabled) {
      this._updateStress(dt, playerState);
    }
    
    // Update intensity curve within current phase
    this._updateIntensity(dt);
    
    // Check phase transition
    if (s.phaseTimer >= s.phaseDuration) {
      this._transitionPhase(runState);
    }
    
    // Update output modifiers
    this._updateModifiers();
  },
  
  // ========== EVENT HOOKS (call from game systems) ==========
  
  onPlayerHit(damage) {
    this.state.phaseDamageTaken += damage;
    this.state.stress = Math.min(1.0, this.state.stress + this.config.stressGainOnHit);
  },
  
  onEnemyKill(enemy) {
    this.state.phaseKills++;
    this.state.stress = Math.max(0, this.state.stress + this.config.stressGainOnKill);
    
    // Track elite/boss kills for cycle momentum
    if (enemy?.isElite) this.state.stress -= 0.03;
    if (enemy?.isBoss) this.state.stress -= 0.08;
  },
  
  onDamageDealt(damage) {
    this.state.phaseDamageDealt += damage;
  },
  
  onItemDropped() {
    this.state.phaseItemsDropped++;
  },
  
  // ========== GETTERS (consumed by game systems) ==========
  
  getModifiers() {
    return this.state.modifiers;
  },
  
  getPhase() {
    return this.state.phase;
  },
  
  getIntensity() {
    return this.state.intensity;
  },
  
  getStress() {
    return this.state.stress;
  },
  
  isRewardPhase() {
    return this.state.phase === PHASE_REWARD;
  },
  
  isPeakPhase() {
    return this.state.phase === PHASE_PEAK || this.state.phase === PHASE_AMBUSH;
  },
  
  isRelaxPhase() {
    return this.state.phase === PHASE_RELAX;
  },
  
  // ========== HUD DATA ==========
  
  getHUDData() {
    const s = this.state;
    const remaining = Math.max(0, (s.phaseDuration || 0) - (s.phaseTimer || 0));
    return {
      phase: s.phase,
      intensity: s.intensity,
      stress: s.stress,
      phaseProgress: s.phaseDuration > 0 ? s.phaseTimer / s.phaseDuration : 0,
      cycleCount: s.cycleCount,
      remaining,
      depth: this._getCurrentDepth(),
      modifiers: { ...s.modifiers }
    };
  },

  getDebugSnapshot() {
    const hud = this.getHUDData();
    return {
      ...hud,
      spawnBudget: Number((hud.modifiers?.spawnRateMult || 1).toFixed(2)),
      rewardMultiplier: Number((hud.modifiers?.lootDropMult || 1).toFixed(2)),
      xpMultiplier: Number((hud.modifiers?.xpMult || 1).toFixed(2)),
      eliteChance: Number((hud.modifiers?.elitePromotionChance || 0).toFixed(3)),
      reliefTimer: Number(hud.remaining.toFixed(2))
    };
  },

  forcePhase(phase) {
    const allowed = [PHASE_BUILD, PHASE_PEAK, PHASE_RELAX, PHASE_REWARD, PHASE_AMBUSH];
    if (!allowed.includes(phase)) return false;
    const s = this.state;
    s.lastPhase = s.phase;
    s.phase = phase;
    s.phaseTimer = 0;
    s.phaseDuration = this._rollDuration(phase);
    s.phaseKills = 0;
    s.phaseDamageDealt = 0;
    s.phaseDamageTaken = 0;
    s.phaseItemsDropped = 0;
    this._updateIntensity(0);
    this._updateModifiers();
    this._emitPhaseStart();
    return true;
  },
  
  // ========== INTERNAL: PHASE MACHINE ==========
  
  _transitionPhase(runState) {
    const s = this.state;
    const c = this.config;
    
    // Emit telemetry for completed phase
    this._emitPhaseEnd();
    
    s.lastPhase = s.phase;
    
    // Phase transition logic
    switch (s.phase) {
      case PHASE_BUILD:
        s.phase = PHASE_PEAK;
        break;
        
      case PHASE_PEAK:
        s.phase = PHASE_RELAX;
        s.cycleCount++;
        break;
        
      case PHASE_RELAX:
        // After relax: reward → build, or rare ambush
        if (s.cycleCount > 0 && s.cycleCount % 3 === 0) {
          // Every 3rd cycle, guaranteed reward phase
          s.phase = PHASE_REWARD;
        } else if (Math.random() < c.ambushChance) {
          s.phase = PHASE_AMBUSH;
        } else {
          s.phase = PHASE_BUILD;
        }
        break;
        
      case PHASE_REWARD:
        s.phase = PHASE_BUILD;
        break;
        
      case PHASE_AMBUSH:
        // After ambush: always reward (the payoff)
        s.phase = PHASE_REWARD;
        break;
    }
    
    // Roll new phase duration
    s.phaseDuration = this._rollDuration(s.phase);
    
    // Adaptive: extend relax if player is stressed
    if (s.phase === PHASE_RELAX && c.adaptiveEnabled) {
      if (s.stress > c.stressThresholdHigh) {
        s.phaseDuration *= 1.5;
      } else if (s.stress < c.stressThresholdLow) {
        s.phaseDuration *= 0.6;
      }
    }
    
    s.phaseTimer = 0;
    s.phaseKills = 0;
    s.phaseDamageDealt = 0;
    s.phaseDamageTaken = 0;
    s.phaseItemsDropped = 0;
    
    // Emit phase start
    this._emitPhaseStart();
  },
  
  _updateIntensity(dt) {
    const s = this.state;
    const progress = s.phaseDuration > 0 ? s.phaseTimer / s.phaseDuration : 0;
    
    switch (s.phase) {
      case PHASE_BUILD:
        // Smooth ramp from 0.2 → 0.7
        s.intensity = 0.2 + progress * 0.5;
        break;
      case PHASE_PEAK:
        // Hold near max with slight wobble
        s.intensity = 0.8 + Math.sin(s.totalTime * 2) * 0.1;
        break;
      case PHASE_RELAX:
        // Quick drop to low
        s.intensity = Math.max(0.05, 0.6 * (1 - progress));
        break;
      case PHASE_REWARD:
        // Very low combat, high reward feel
        s.intensity = 0.1;
        break;
      case PHASE_AMBUSH:
        // Instant spike to max
        s.intensity = 0.95 + Math.sin(s.totalTime * 5) * 0.05;
        break;
    }
    
    s.intensity = Math.max(0, Math.min(1, s.intensity));
  },
  
  _updateStress(dt, playerState) {
    const s = this.state;
    const c = this.config;
    
    // Natural stress decay during relax
    if (s.phase === PHASE_RELAX || s.phase === PHASE_REWARD) {
      s.stress = Math.max(0, s.stress - c.stressDecayRate * dt);
    }
    
    // HP-based stress: low HP → higher stress
    if (playerState) {
      const hpPct = (playerState.hp || 0) / (playerState.maxHP || 100);
      if (hpPct < 0.3) {
        s.stress = Math.min(1.0, s.stress + 0.05 * dt);
      }
    }
  },
  
  _updateModifiers() {
    const s = this.state;
    const c = this.config;
    const m = s.modifiers;
    const depth = this._getDepthFactor();
    
    // Get base multipliers for current phase
    let base;
    switch (s.phase) {
      case PHASE_BUILD:   base = c.buildIntensity; break;
      case PHASE_PEAK:    base = c.peakIntensity; break;
      case PHASE_RELAX:   base = c.relaxIntensity; break;
      case PHASE_REWARD:  base = c.rewardIntensity; break;
      case PHASE_AMBUSH:  base = c.ambushIntensity; break;
      default:            base = c.buildIntensity;
    }
    
    // Apply intensity curve as interpolation factor
    const t = s.intensity;
    
    m.spawnRateMult = this._lerp(0.3, base.spawnRate, t) * depth;
    m.elitePromotionChance = base.eliteChance * t * depth;
    m.hazardRateMult = base.hazardRate * t * depth;
    
    // Loot modifiers (boosted during reward phase)
    if (s.phase === PHASE_REWARD) {
      m.lootDropMult = c.rewardLootMultiplier * depth;
      m.xpMult = c.rewardXPMultiplier;
      m.cellBonusChance = c.rewardCellBonus;
    } else {
      m.lootDropMult = 1.0;
      m.xpMult = 1.0;
      m.cellBonusChance = 0;
    }
  },
  
  // ========== INTERNAL: HELPERS ==========
  
  _rollDuration(phase) {
    const c = this.config;
    let range;
    switch (phase) {
      case PHASE_BUILD:   range = c.buildDuration; break;
      case PHASE_PEAK:    range = c.peakDuration; break;
      case PHASE_RELAX:   range = c.relaxDuration; break;
      case PHASE_REWARD:  range = c.rewardDuration; break;
      case PHASE_AMBUSH:  range = [3, 5]; break;
      default:            range = [5, 10];
    }
    
    const base = range[0] + Math.random() * (range[1] - range[0]);
    
    // Depth scaling: phases get shorter at higher zones
    const depthFactor = this._getDepthSpeedFactor();
    return Math.max(2, base / depthFactor);
  },
  
  _getDepthFactor() {
    // Import-safe: try to read current zone depth
    try {
      const depth = this._getCurrentDepth();
      const scale = 1 + depth * this.config.depthIntensityScale;
      return Math.min(this.config.maxDepthBonus, scale);
    } catch { return 1.0; }
  },
  
  _getDepthSpeedFactor() {
    try {
      const depth = this._getCurrentDepth();
      const scale = 1 + depth * this.config.depthSpeedScale;
      return Math.min(1.5, scale);
    } catch { return 1.0; }
  },
  
  _getCurrentDepth() {
    return State?.run?.currentDepth || 1;
  },
  
  _lerp(a, b, t) {
    return a + (b - a) * Math.max(0, Math.min(1, t));
  },
  
  // ========== TELEMETRY ==========
  
  _emitPhaseStart() {
    const s = this.state;
    try {
      const Telemetry = State?.modules?.Telemetry;
      if (Telemetry?.emit) {
        Telemetry.emit('director_phase_start', {
          phase: s.phase,
          cycle: s.cycleCount,
          stress: s.stress.toFixed(2),
          depth: this._getCurrentDepth()
        });
      }
    } catch { /* safe */ }
  },
  
  _emitPhaseEnd() {
    const s = this.state;
    try {
      const Telemetry = State?.modules?.Telemetry;
      if (Telemetry?.emit) {
        Telemetry.emit('director_phase_end', {
          phase: s.phase,
          duration: s.phaseTimer.toFixed(1),
          kills: s.phaseKills,
          damageDealt: s.phaseDamageDealt,
          damageTaken: s.phaseDamageTaken,
          items: s.phaseItemsDropped,
          stress: s.stress.toFixed(2)
        });
      }
    } catch { /* safe */ }
  }
};
