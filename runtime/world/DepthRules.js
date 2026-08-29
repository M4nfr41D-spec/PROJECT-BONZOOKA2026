// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// DepthRules.js - Depth-driven Escalation & Modifiers
// ============================================================
// Depth is the single progression axis. It drives difficulty and unlocks
// new modifier rules at milestones. Active modifiers per zone are sampled
// from the unlocked pool (weighted), so no run is the same.
//
// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

import { State } from '../State.js';

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// Default modifier pool (can be overridden per act via data/acts.json later)
const DEFAULT_POOL = [
  // Density mods
  { id: 'ELITE_PACKS',      weight: 1.2, name: 'Elite Packs',      desc: '+55% elite density',         icon: '⭐', lootBonus: 0.15 },
  { id: 'BULLET_HELL',      weight: 0.9, name: 'Bullet Hell',      desc: '+35% enemy count, +fire rate', icon: '🔴', lootBonus: 0.10 },
  { id: 'FAST_ENEMIES',     weight: 1.1, name: 'Haste',            desc: '+30% enemy speed',           icon: '💨', lootBonus: 0.08 },
  { id: 'DENSE_OBSTACLES',  weight: 0.9, name: 'Debris Field',     desc: '+35% obstacles',             icon: '🪨', lootBonus: 0.05 },
  { id: 'MINEFIELD',        weight: 1.0, name: 'Minefield',        desc: 'Mines in obstacle spawns',   icon: '💣', lootBonus: 0.12 },
  { id: 'CRAMPED_ZONE',     weight: 0.8, name: 'Claustrophobia',   desc: '15% smaller zone',           icon: '📦', lootBonus: 0.05 },
  { id: 'RICH_LOOT',        weight: 0.6, name: 'Jackpot',          desc: '+30% drop chance',           icon: '💰', lootBonus: 0.30 },
  
  // v2.13.0: NEW combat mods
  { id: 'ARMORED',          weight: 0.8, name: 'Armored',          desc: 'Enemies have +40% HP',       icon: '🛡️', lootBonus: 0.15 },
  { id: 'ENRAGED',          weight: 0.7, name: 'Enraged',          desc: 'Enemies deal +35% damage',   icon: '😡', lootBonus: 0.15 },
  { id: 'REFLECT',          weight: 0.5, name: 'Thorns',           desc: '8% damage reflected to player', icon: '🔁', lootBonus: 0.20 },
  { id: 'REGEN',            weight: 0.6, name: 'Regenerating',     desc: 'Enemies heal 1% HP/sec',     icon: '💚', lootBonus: 0.12 },
  { id: 'NO_SHIELD',        weight: 0.4, name: 'EMP Zone',         desc: 'Player shield disabled',     icon: '⚡', lootBonus: 0.25 },
  { id: 'VOLATILE',         weight: 0.7, name: 'Volatile',         desc: 'Enemies explode on death',   icon: '💥', lootBonus: 0.10 },
  { id: 'CLOAKED',          weight: 0.5, name: 'Cloaked',          desc: 'Enemies fade until aggro',   icon: '👻', lootBonus: 0.15 },
  { id: 'OVERCHARGED',      weight: 0.6, name: 'Overcharged',      desc: '+50% enemy fire rate',       icon: '⚡', lootBonus: 0.18 },
  { id: 'GRAVITY_WELL',     weight: 0.4, name: 'Gravity Well',     desc: 'Slow zone (−20% player speed)', icon: '🌀', lootBonus: 0.12 },
  { id: 'TREASURE',         weight: 0.3, name: 'Treasure Trove',   desc: '+2 loot drops per elite',    icon: '🏆', lootBonus: 0.0 },
  { id: 'FRENZIED',         weight: 0.5, name: 'Frenzied',         desc: 'Enemies aggro from 2× range', icon: '🐺', lootBonus: 0.08 }
];

// Milestones where we unlock a new modifier rule (hybrid)
const UNLOCK_EVERY_DEPTH = 25;

export const DepthRules = {

  // Ensure meta schema exists
  ensureMeta() {
    if (!State.meta.depth) {
      State.meta.depth = {
        bestDepth: 1,
        unlocked: [],    // array of modifier ids
        lastUnlockAt: 0  // depth where last unlock happened
      };
    }
    if (!Array.isArray(State.meta.depth.unlocked)) State.meta.depth.unlocked = [];
    if (typeof State.meta.depth.bestDepth !== 'number') State.meta.depth.bestDepth = 1;
    if (typeof State.meta.depth.lastUnlockAt !== 'number') State.meta.depth.lastUnlockAt = 0;
  },

  // Active modifier slot count per depth bucket
  modifierSlots(depth) {
    if (depth < 25) return 1;
    if (depth < 50) return 2;
    if (depth < 100) return 3;
    if (depth < 200) return 4;
    // Open-ended: slow growth
    return 5 + Math.floor((depth - 200) / 150);
  },

  // Unlock new rule at milestones using weighted randomness (B)
  maybeUnlock(depth, actConfig = null) {
    this.ensureMeta();

    const last = State.meta.depth.lastUnlockAt || 0;
    if (depth < UNLOCK_EVERY_DEPTH) return null;

    // Only unlock once per milestone boundary
    const milestone = Math.floor(depth / UNLOCK_EVERY_DEPTH) * UNLOCK_EVERY_DEPTH;
    if (milestone <= last) return null;

    const pool = (actConfig && actConfig.modifiers && Array.isArray(actConfig.modifiers.pool))
      ? actConfig.modifiers.pool
      : DEFAULT_POOL;

    const unlockedSet = new Set(State.meta.depth.unlocked);
    const candidates = pool.filter(m => !unlockedSet.has(m.id));
    if (candidates.length === 0) {
      State.meta.depth.lastUnlockAt = milestone;
      return null;
    }

    const picked = this.weightedPick(candidates);
    State.meta.depth.unlocked.push(picked.id);
    State.meta.depth.lastUnlockAt = milestone;
    return picked.id;
  },

  // Sample active modifiers for this zone from unlocked pool + baseline
  sampleActive(depth, actConfig = null) {
    this.ensureMeta();

    const pool = (actConfig && actConfig.modifiers && Array.isArray(actConfig.modifiers.pool))
      ? actConfig.modifiers.pool
      : DEFAULT_POOL;

    // Baseline rules that can always appear (even at depth 1)
    const baseline = (actConfig && actConfig.modifiers && Array.isArray(actConfig.modifiers.baseline))
      ? actConfig.modifiers.baseline
      : ['ELITE_PACKS'];

    const unlocked = new Set(State.meta.depth.unlocked);
    for (const b of baseline) unlocked.add(b);

    const available = pool.filter(m => unlocked.has(m.id));
    if (available.length === 0) return [];

    const slots = clamp(this.modifierSlots(depth), 0, 8);
    const picked = [];
    const used = new Set();

    // Without a seeded RNG here: use Math.random for variety between runs
    for (let i = 0; i < slots; i++) {
      const cand = available.filter(m => !used.has(m.id));
      if (cand.length === 0) break;
      const p = this.weightedPick(cand);
      picked.push(p.id);
      used.add(p.id);
    }
    return picked;
  },

  weightedPick(list) {
    let total = 0;
    for (const it of list) total += (it.weight ?? 1);
    let r = Math.random() * total;
    for (const it of list) {
      r -= (it.weight ?? 1);
      if (r <= 0) return it;
    }
    return list[list.length - 1];
  },

  // Convenience: update best depth
  recordDepth(depth) {
    this.ensureMeta();
    if (depth > State.meta.depth.bestDepth) State.meta.depth.bestDepth = depth;
  },
  
  // Get mod metadata for HUD display
  getModData(modId) {
    return DEFAULT_POOL.find(m => m.id === modId) || { id: modId, name: modId, desc: '', icon: '❓', lootBonus: 0 };
  },
  
  // Get all mod data for a list of mod IDs
  getModsWithData(modIds) {
    return (modIds || []).map(id => this.getModData(id));
  },
  
  // Calculate total loot bonus from active mods
  getLootBonus(modIds) {
    let bonus = 0;
    for (const id of modIds || []) {
      const data = this.getModData(id);
      bonus += data.lootBonus || 0;
    }
    return bonus;
  },
  
  // ═══ CORRUPTION SCALING ═══
  // Corruption stacks (0-10) multiply zone difficulty
  // Each stack: +15% enemy HP, +10% enemy damage, +5% loot quality, +8% XP
  getCorruptionMults(stacks) {
    const s = Math.max(0, Math.min(10, stacks || 0));
    return {
      enemyHP:    1 + s * 0.15,  // 1.0 → 2.5 at 10 stacks
      enemyDmg:   1 + s * 0.10,  // 1.0 → 2.0 at 10 stacks
      enemySpeed: 1 + s * 0.03,  // 1.0 → 1.3 at 10 stacks
      lootBonus:  s * 0.05,      // 0 → 50% at 10 stacks
      xpMult:     1 + s * 0.08,  // 1.0 → 1.8 at 10 stacks
      dropBonus:  s * 0.03       // 0 → 30% at 10 stacks
    };
  }
};

export default DepthRules;
