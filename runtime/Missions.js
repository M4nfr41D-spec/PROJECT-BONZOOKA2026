// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// MISSIONS.js - Session Goal System (v2.13.0)
// ============================================================
// Provides 3 rotating missions that give scrap/cells/XP on completion.
// Missions refresh every hub visit or after all 3 are completed.
// Types: kill, elite_kill, boss_kill, reach_zone, clear_pois, collect_loot, earn_scrap

import { State } from './State.js';

const MISSION_TEMPLATES = [
  // Kill missions
  { type: 'kill',       label: 'Exterminator',    icon: '💀', targetBase: 30,  targetScale: 0.5, rewardType: 'scrap', rewardBase: 80,  rewardScale: 1.2 },
  { type: 'kill',       label: 'Purge Protocol',  icon: '🔥', targetBase: 60,  targetScale: 0.8, rewardType: 'scrap', rewardBase: 150, rewardScale: 1.5 },
  { type: 'elite_kill', label: 'Elite Hunter',    icon: '⭐', targetBase: 5,   targetScale: 0.1, rewardType: 'cells', rewardBase: 30,  rewardScale: 1.0 },
  { type: 'boss_kill',  label: 'Boss Slayer',     icon: '👑', targetBase: 1,   targetScale: 0.02, rewardType: 'cells', rewardBase: 50,  rewardScale: 2.0 },
  
  // Exploration missions  
  { type: 'reach_zone', label: 'Deep Dive',       icon: '🚀', targetBase: 5,   targetScale: 0.3, rewardType: 'scrap', rewardBase: 120, rewardScale: 1.8 },
  { type: 'clear_pois', label: 'Archaeologist',   icon: '🔍', targetBase: 3,   targetScale: 0.1, rewardType: 'cells', rewardBase: 25,  rewardScale: 1.0 },
  
  // Economy missions
  { type: 'collect_loot', label: 'Treasure Hunt',  icon: '💎', targetBase: 3,  targetScale: 0.05, rewardType: 'scrap', rewardBase: 100, rewardScale: 1.0 },
  { type: 'earn_scrap',   label: 'Salvage Ops',    icon: '🔧', targetBase: 200, targetScale: 3.0, rewardType: 'cells', rewardBase: 35,  rewardScale: 0.8 },
  
  // Combat missions
  { type: 'streak',     label: 'Chain Killer',     icon: '⚡', targetBase: 10,  targetScale: 0.2, rewardType: 'scrap', rewardBase: 90,  rewardScale: 1.3 },
  { type: 'no_damage',  label: 'Untouchable',      icon: '🛡️', targetBase: 1,  targetScale: 0,   rewardType: 'cells', rewardBase: 60,  rewardScale: 2.0 }
];

const MAX_ACTIVE = 3;
const REFRESH_COOLDOWN_MS = 0; // instant refresh on hub visit

let _missionIdCounter = 0;

export const Missions = {
  
  // Ensure meta has missions
  ensureMeta() {
    if (!State.meta.missions) {
      State.meta.missions = { active: [], completed: 0, refreshTimer: 0 };
    }
    if (!Array.isArray(State.meta.missions.active)) {
      State.meta.missions.active = [];
    }
  },
  
  // Generate N missions scaled to player level + depth
  generate(count = MAX_ACTIVE) {
    this.ensureMeta();
    
    const level = State.meta.level || 1;
    const bestDepth = State.meta.depth?.bestDepth || 1;
    const prestigeLvl = State.meta.prestige?.level || 0;
    
    // Shuffle templates and pick unique types
    const shuffled = [...MISSION_TEMPLATES].sort(() => Math.random() - 0.5);
    const picked = [];
    const usedTypes = new Set();
    
    for (const template of shuffled) {
      if (picked.length >= count) break;
      if (usedTypes.has(template.type)) continue;
      usedTypes.add(template.type);
      
      // Scale target by player progress
      const scaleFactor = 1 + bestDepth * template.targetScale * 0.01;
      const target = Math.max(1, Math.round(template.targetBase * scaleFactor));
      
      // Scale reward by level + prestige
      const rewardScale = (1 + level * 0.05) * (1 + prestigeLvl * 0.1) * template.rewardScale;
      const reward = Math.round(template.rewardBase * rewardScale);
      
      picked.push({
        id: 'mission_' + (++_missionIdCounter) + '_' + Date.now(),
        type: template.type,
        label: template.label,
        icon: template.icon,
        target: target,
        progress: 0,
        complete: false,
        claimed: false,
        rewardType: template.rewardType,
        rewardAmount: reward
      });
    }
    
    State.meta.missions.active = picked;
    State.meta.missions.refreshTimer = Date.now();
  },
  
  // Refresh if all completed or on hub visit
  maybeRefresh() {
    this.ensureMeta();
    const missions = State.meta.missions.active;
    
    if (missions.length === 0) {
      this.generate();
      return;
    }
    
    // Auto-refresh if all claimed
    const allClaimed = missions.every(m => m.claimed);
    if (allClaimed) {
      this.generate();
    }
  },
  
  // ════════════════════════════════════════
  // EVENT HOOKS (call from game systems)
  // ════════════════════════════════════════
  
  onEnemyKill(enemyData) {
    this.ensureMeta();
    for (const m of State.meta.missions.active) {
      if (m.complete || m.claimed) continue;
      
      if (m.type === 'kill') {
        m.progress = Math.min(m.progress + 1, m.target);
      }
      if (m.type === 'elite_kill' && enemyData.isElite) {
        m.progress = Math.min(m.progress + 1, m.target);
      }
      if (m.type === 'boss_kill' && enemyData.isBoss) {
        m.progress = Math.min(m.progress + 1, m.target);
      }
      
      if (m.progress >= m.target) m.complete = true;
    }
  },
  
  onZoneReached(depth) {
    this.ensureMeta();
    for (const m of State.meta.missions.active) {
      if (m.complete || m.claimed) continue;
      if (m.type === 'reach_zone') {
        m.progress = Math.max(m.progress, depth);
        if (m.progress >= m.target) m.complete = true;
      }
    }
  },
  
  onPOICleared() {
    this.ensureMeta();
    for (const m of State.meta.missions.active) {
      if (m.complete || m.claimed) continue;
      if (m.type === 'clear_pois') {
        m.progress = Math.min(m.progress + 1, m.target);
        if (m.progress >= m.target) m.complete = true;
      }
    }
  },
  
  onLootCollected() {
    this.ensureMeta();
    for (const m of State.meta.missions.active) {
      if (m.complete || m.claimed) continue;
      if (m.type === 'collect_loot') {
        m.progress = Math.min(m.progress + 1, m.target);
        if (m.progress >= m.target) m.complete = true;
      }
    }
  },
  
  onScrapEarned(amount) {
    this.ensureMeta();
    for (const m of State.meta.missions.active) {
      if (m.complete || m.claimed) continue;
      if (m.type === 'earn_scrap') {
        m.progress = Math.min(m.progress + amount, m.target);
        if (m.progress >= m.target) m.complete = true;
      }
    }
  },
  
  onStreak(count) {
    this.ensureMeta();
    for (const m of State.meta.missions.active) {
      if (m.complete || m.claimed) continue;
      if (m.type === 'streak') {
        m.progress = Math.max(m.progress, count);
        if (m.progress >= m.target) m.complete = true;
      }
    }
  },
  
  onZoneClearedNoDamage() {
    this.ensureMeta();
    for (const m of State.meta.missions.active) {
      if (m.complete || m.claimed) continue;
      if (m.type === 'no_damage') {
        m.progress = Math.min(m.progress + 1, m.target);
        if (m.progress >= m.target) m.complete = true;
      }
    }
  },
  
  // Claim reward for a completed mission
  claim(missionId) {
    this.ensureMeta();
    const m = State.meta.missions.active.find(x => x.id === missionId);
    if (!m || !m.complete || m.claimed) return null;
    
    m.claimed = true;
    State.meta.missions.completed++;
    
    // Award reward
    if (m.rewardType === 'scrap') {
      State.meta.scrap += m.rewardAmount;
    } else if (m.rewardType === 'cells') {
      State.run.cells = (State.run.cells || 0) + m.rewardAmount;
    }
    
    return { type: m.rewardType, amount: m.rewardAmount };
  },
  
  // Get active missions for HUD display
  getActive() {
    this.ensureMeta();
    return State.meta.missions.active.filter(m => !m.claimed);
  },
  
  // Get count of claimable missions
  getClaimableCount() {
    this.ensureMeta();
    return State.meta.missions.active.filter(m => m.complete && !m.claimed).length;
  }
};

export default Missions;
