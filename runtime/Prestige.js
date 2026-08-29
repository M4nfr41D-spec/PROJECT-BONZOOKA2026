// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// PRESTIGE.js - New Game+ / Prestige Reset System (v2.13.0)
// ============================================================
// Reset level/gear/zones for permanent scaling bonuses.
// Each prestige grants stronger bonuses. Requires reaching deeper zones
// to unlock higher prestige tiers.

import { State } from './State.js';

// ── Prestige tier requirements and bonuses ──
// Each tier requires reaching a minimum zone depth before you can prestige
const PRESTIGE_TIERS = [
  { level: 1, reqDepth: 50,   bonuses: { damage: 5,  maxHP: 5,  luck: 2,  xpRate: 10, startScrap: 200  } },
  { level: 2, reqDepth: 100,  bonuses: { damage: 8,  maxHP: 8,  luck: 3,  xpRate: 15, startScrap: 500  } },
  { level: 3, reqDepth: 200,  bonuses: { damage: 12, maxHP: 12, luck: 5,  xpRate: 20, startScrap: 1000 } },
  { level: 4, reqDepth: 350,  bonuses: { damage: 15, maxHP: 15, luck: 7,  xpRate: 25, startScrap: 2000 } },
  { level: 5, reqDepth: 500,  bonuses: { damage: 20, maxHP: 20, luck: 10, xpRate: 30, startScrap: 3500 } },
  { level: 6, reqDepth: 750,  bonuses: { damage: 25, maxHP: 25, luck: 12, xpRate: 35, startScrap: 5000 } },
  { level: 7, reqDepth: 1000, bonuses: { damage: 30, maxHP: 30, luck: 15, xpRate: 40, startScrap: 8000 } }
];

// Hard cap: max 10 prestige resets (bonuses stack but cap at tier 7 values × 10)
const MAX_PRESTIGE = 10;

export const Prestige = {
  
  ensureMeta() {
    if (!State.meta.prestige) {
      State.meta.prestige = {
        level: 0,
        totalResets: 0,
        bonuses: { damage: 0, maxHP: 0, luck: 0, xpRate: 0, startScrap: 0 }
      };
    }
  },
  
  // Can the player prestige?
  canPrestige() {
    this.ensureMeta();
    const current = State.meta.prestige.level;
    if (current >= MAX_PRESTIGE) return false;
    
    const nextTier = PRESTIGE_TIERS[Math.min(current, PRESTIGE_TIERS.length - 1)];
    const bestDepth = Math.max(
      State.meta.highestZones?.normal || 0,
      State.meta.highestZones?.risk || 0,
      State.meta.highestZones?.chaos || 0,
      State.meta.depth?.bestDepth || 0
    );
    
    return bestDepth >= nextTier.reqDepth;
  },
  
  // Get info about current and next prestige tier
  getInfo() {
    this.ensureMeta();
    const current = State.meta.prestige;
    const nextIdx = Math.min(current.level, PRESTIGE_TIERS.length - 1);
    const nextTier = PRESTIGE_TIERS[nextIdx];
    
    const bestDepth = Math.max(
      State.meta.highestZones?.normal || 0,
      State.meta.highestZones?.risk || 0,
      State.meta.highestZones?.chaos || 0,
      State.meta.depth?.bestDepth || 0
    );
    
    return {
      currentLevel: current.level,
      maxLevel: MAX_PRESTIGE,
      totalResets: current.totalResets,
      bonuses: { ...current.bonuses },
      nextTier: current.level < MAX_PRESTIGE ? nextTier : null,
      bestDepth: bestDepth,
      canPrestige: this.canPrestige()
    };
  },
  
  // Execute prestige reset
  doPrestige() {
    if (!this.canPrestige()) return false;
    this.ensureMeta();
    
    const p = State.meta.prestige;
    const tierIdx = Math.min(p.level, PRESTIGE_TIERS.length - 1);
    const tier = PRESTIGE_TIERS[tierIdx];
    
    // ── Stack bonuses (cumulative per prestige) ──
    p.bonuses.damage   += tier.bonuses.damage;
    p.bonuses.maxHP    += tier.bonuses.maxHP;
    p.bonuses.luck     += tier.bonuses.luck;
    p.bonuses.xpRate   += tier.bonuses.xpRate;
    p.bonuses.startScrap += tier.bonuses.startScrap;
    
    p.level++;
    p.totalResets++;
    
    // ── RESET: keep prestige + missions.completed + leaderboard ──
    // Wipe: level, XP, scrap, stash, equipment, skills, stats, zones, depth
    State.meta.level = 1;
    State.meta.xp = 0;
    State.meta.scrap = p.bonuses.startScrap; // prestige bonus starting scrap
    State.meta.skillPoints = 0;
    State.meta.statPoints = 0;
    State.meta.skills = {};
    State.meta.stats = {};
    State.meta.equipment = {};
    State.meta.stash = [];
    State.meta.highestWave = 0;
    State.meta.highestZones = { normal: 0, risk: 0, chaos: 0 };
    State.meta.totalRuns = State.meta.totalRuns || 0; // keep total runs
    State.meta.depth = { bestDepth: 1, unlocked: [], lastUnlockAt: 0 };
    
    // Keep: prestige, missions.completed count, leaderboard, corruption, totalKills, totalPlaytime
    // Reset active missions
    if (State.meta.missions) {
      State.meta.missions.active = [];
    }
    
    // Corruption resets to 0 on prestige (earned fresh each cycle)
    State.meta.corruption = 0;
    
    return {
      level: p.level,
      bonuses: { ...tier.bonuses },
      totalBonuses: { ...p.bonuses }
    };
  },
  
  // Get current prestige stat bonuses for Stats.js
  getBonuses() {
    this.ensureMeta();
    return State.meta.prestige.bonuses;
  }
};

export default Prestige;
