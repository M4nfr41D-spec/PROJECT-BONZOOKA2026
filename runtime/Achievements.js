// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// Achievements.js — Persistent achievement tracker with INSTANT payouts
// 
// Design: Check-on-event, reward immediately, never wait for hub.
// Categories: Combat, Exploration, Economy, Mastery, Prestige
// ============================================================

import { State } from './State.js';

// ── ACHIEVEMENT DEFINITIONS ──
// Each: { id, name, desc, icon, category, check(meta,run), reward: {type,amount}, hidden? }
const ACHIEVEMENTS = [
  // ═══ COMBAT (10) ═══
  { id: 'first_blood',      name: 'First Blood',       desc: 'Kill your first enemy',                icon: '⚔️', category: 'combat',
    check: m => m.totalKills >= 1,          reward: { scrap: 50 } },
  { id: 'centurion',        name: 'Centurion',          desc: 'Kill 100 enemies',                     icon: '💀', category: 'combat',
    check: m => m.totalKills >= 100,        reward: { scrap: 200 } },
  { id: 'slayer_1k',        name: 'Slayer',             desc: 'Kill 1,000 enemies',                   icon: '🗡️', category: 'combat',
    check: m => m.totalKills >= 1000,       reward: { scrap: 500, cells: 20 } },
  { id: 'annihilator',      name: 'Annihilator',        desc: 'Kill 10,000 enemies',                  icon: '☠️', category: 'combat',
    check: m => m.totalKills >= 10000,      reward: { scrap: 2000, cells: 100 } },
  { id: 'streak_10',        name: 'Chain Lightning',    desc: 'Reach a 10-kill streak',               icon: '⚡', category: 'combat',
    check: (m, r) => (r?.stats?.bestStreak || 0) >= 10, reward: { scrap: 150 } },
  { id: 'streak_25',        name: 'Unstoppable',        desc: 'Reach a 25-kill streak',               icon: '🔥', category: 'combat',
    check: (m, r) => (r?.stats?.bestStreak || 0) >= 25, reward: { scrap: 400, cells: 15 } },
  { id: 'boss_killer',      name: 'Boss Killer',        desc: 'Defeat your first boss',               icon: '👑', category: 'combat',
    check: m => (m.totalBossKills || 0) >= 1, reward: { scrap: 300 } },
  { id: 'boss_slayer_10',   name: 'Boss Slayer',        desc: 'Defeat 10 bosses',                     icon: '🏆', category: 'combat',
    check: m => (m.totalBossKills || 0) >= 10, reward: { scrap: 800, cells: 30 } },
  { id: 'no_damage_zone',   name: 'Untouchable',        desc: 'Clear a zone without taking damage',   icon: '🛡️', category: 'combat',
    check: (m, r) => r?.stats?.flawlessZones >= 1, reward: { scrap: 500 } },
  { id: 'elite_hunter_50',  name: 'Elite Hunter',       desc: 'Kill 50 elite enemies',                icon: '💎', category: 'combat',
    check: m => (m.totalEliteKills || 0) >= 50, reward: { scrap: 600, cells: 25 } },

  // ═══ EXPLORATION (8) ═══
  { id: 'zone_10',          name: 'Explorer',           desc: 'Reach Zone 10',                        icon: '🗺️', category: 'exploration',
    check: m => getBestDepth(m) >= 10,      reward: { scrap: 100 } },
  { id: 'zone_50',          name: 'Deep Diver',         desc: 'Reach Zone 50',                        icon: '🌊', category: 'exploration',
    check: m => getBestDepth(m) >= 50,      reward: { scrap: 400, cells: 15 } },
  { id: 'zone_100',         name: 'Abyss Walker',       desc: 'Reach Zone 100',                       icon: '🕳️', category: 'exploration',
    check: m => getBestDepth(m) >= 100,     reward: { scrap: 1000, cells: 50 } },
  { id: 'zone_250',         name: 'Void Traveler',      desc: 'Reach Zone 250',                       icon: '🌌', category: 'exploration',
    check: m => getBestDepth(m) >= 250,     reward: { scrap: 2000, cells: 100 } },
  { id: 'zone_500',         name: 'Event Horizon',      desc: 'Reach Zone 500',                       icon: '⭐', category: 'exploration',
    check: m => getBestDepth(m) >= 500,     reward: { scrap: 5000, cells: 250 } },
  { id: 'all_biomes',       name: 'Cartographer',       desc: 'Visit all 5 biomes',                   icon: '🧭', category: 'exploration',
    check: m => getBestDepth(m) >= 601,     reward: { scrap: 800, cells: 40 } },
  { id: 'runs_10',          name: 'Persistent',         desc: 'Complete 10 runs',                     icon: '🔄', category: 'exploration',
    check: m => (m.totalRuns || 0) >= 10,   reward: { scrap: 200 } },
  { id: 'runs_50',          name: 'Veteran',            desc: 'Complete 50 runs',                     icon: '🎖️', category: 'exploration',
    check: m => (m.totalRuns || 0) >= 50,   reward: { scrap: 800, cells: 30 } },

  // ═══ ECONOMY (6) ═══
  { id: 'scrap_1k',         name: 'Scavenger',          desc: 'Earn 1,000 total scrap',               icon: '🔧', category: 'economy',
    check: m => (m.totalScrapEarned || 0) >= 1000, reward: { scrap: 100 } },
  { id: 'scrap_10k',        name: 'Salvage King',       desc: 'Earn 10,000 total scrap',              icon: '💰', category: 'economy',
    check: m => (m.totalScrapEarned || 0) >= 10000, reward: { scrap: 500, cells: 20 } },
  { id: 'items_100',        name: 'Hoarder',            desc: 'Collect 100 items',                    icon: '📦', category: 'economy',
    check: m => (m.totalItemsCollected || 0) >= 100, reward: { scrap: 300 } },
  { id: 'craft_10',         name: 'Tinkerer',           desc: 'Craft 10 times',                       icon: '🔨', category: 'economy',
    check: m => (m.totalCrafts || 0) >= 10, reward: { scrap: 200, cells: 10 } },
  { id: 'legendary_drop',   name: 'Jackpot!',           desc: 'Find a Legendary item',                icon: '🌟', category: 'economy',
    check: m => (m.totalLegendaries || 0) >= 1, reward: { scrap: 500 } },
  { id: 'legendary_5',      name: 'Fortune Favors',     desc: 'Find 5 Legendary items',               icon: '✨', category: 'economy',
    check: m => (m.totalLegendaries || 0) >= 5, reward: { scrap: 1500, cells: 50 } },

  // ═══ MASTERY (4) ═══
  { id: 'level_10',         name: 'Rookie Pilot',       desc: 'Reach Level 10',                       icon: '🎯', category: 'mastery',
    check: m => (m.level || 1) >= 10,       reward: { scrap: 150 } },
  { id: 'level_25',         name: 'Ace Pilot',          desc: 'Reach Level 25',                       icon: '🏅', category: 'mastery',
    check: m => (m.level || 1) >= 25,       reward: { scrap: 400, cells: 15 } },
  { id: 'level_50',         name: 'Commander',          desc: 'Reach Level 50',                       icon: '⭐', category: 'mastery',
    check: m => (m.level || 1) >= 50,       reward: { scrap: 1000, cells: 40 } },
  { id: 'max_corruption',   name: 'Embrace the Void',   desc: 'Play at Corruption 10',                icon: '🔮', category: 'mastery',
    check: (m, r) => (r?.corruption || m.corruption || 0) >= 10, reward: { scrap: 2000, cells: 100 } },

  // ═══ PRESTIGE (2) ═══
  { id: 'first_prestige',   name: 'Reborn',             desc: 'Prestige for the first time',          icon: '♻️', category: 'prestige',
    check: m => (m.prestige?.totalResets || 0) >= 1, reward: { scrap: 500, cells: 25 } },
  { id: 'prestige_5',       name: 'Ascendant',          desc: 'Prestige 5 times',                     icon: '🌠', category: 'prestige',
    check: m => (m.prestige?.totalResets || 0) >= 5, reward: { scrap: 3000, cells: 150 } },
];

// Helper: best depth across all difficulty lanes
function getBestDepth(meta) {
  const hz = meta.highestZones || {};
  return Math.max(hz.normal || 0, hz.risk || 0, hz.chaos || 0, meta.highestZone || 0);
}

// ── ACHIEVEMENT ENGINE ──
export const Achievements = {
  _defs: ACHIEVEMENTS,
  
  // Initialize tracking counters in meta if missing
  ensureMeta() {
    if (!State.meta.achievements) State.meta.achievements = {};
    // Ensure tracking counters exist
    if (State.meta.totalBossKills === undefined) State.meta.totalBossKills = 0;
    if (State.meta.totalEliteKills === undefined) State.meta.totalEliteKills = 0;
    if (State.meta.totalScrapEarned === undefined) State.meta.totalScrapEarned = 0;
    if (State.meta.totalItemsCollected === undefined) State.meta.totalItemsCollected = 0;
    if (State.meta.totalCrafts === undefined) State.meta.totalCrafts = 0;
    if (State.meta.totalLegendaries === undefined) State.meta.totalLegendaries = 0;
  },
  
  // Check ALL achievements and pay out any newly completed ones INSTANTLY.
  // Returns array of newly completed achievement objects.
  checkAll() {
    this.ensureMeta();
    const completed = State.meta.achievements;
    const newlyDone = [];
    
    for (const ach of ACHIEVEMENTS) {
      if (completed[ach.id]) continue; // already done
      
      try {
        if (ach.check(State.meta, State.run)) {
          // COMPLETE — mark + pay immediately
          completed[ach.id] = { at: Date.now() };
          this._payReward(ach);
          newlyDone.push(ach);
        }
      } catch (e) { /* check failed, skip */ }
    }
    
    return newlyDone;
  },
  
  // Pay reward directly into meta (instant, no hub required)
  _payReward(ach) {
    const r = ach.reward;
    if (!r) return;
    if (r.scrap) {
      State.meta.scrap = (State.meta.scrap || 0) + r.scrap;
    }
    if (r.cells) {
      State.meta.cells = (State.meta.cells || 0) + r.cells;
    }
  },
  
  // Show toast + particle for newly completed achievements
  announce(newlyDone) {
    if (!newlyDone || newlyDone.length === 0) return;
    
    const Particles = State.modules?.Particles;
    const Audio = State.modules?.Audio;
    const p = State.player;
    
    for (const ach of newlyDone) {
      // Floating text above player
      if (Particles && p) {
        Particles.text(p.x, p.y - 60, `🏆 ${ach.name}`, '#ffd700', 14);
        const r = ach.reward;
        const parts = [];
        if (r.scrap) parts.push(`+${r.scrap}🔧`);
        if (r.cells) parts.push(`+${r.cells}⚡`);
        if (parts.length) {
          Particles.text(p.x, p.y - 40, parts.join(' '), '#ffcc00', 11);
        }
        // Celebration burst
        Particles.explosion(p.x, p.y, '#ffd700', 20, 200);
        Particles.ring(p.x, p.y, '#ffaa00', 50);
      }
      
      // Sound
      if (Audio?.levelUp) Audio.levelUp();
      
      // UI announcement
      if (State.ui) {
        State.ui.announcement = {
          text: `🏆 ACHIEVEMENT: ${ach.name}`,
          timer: 3.0
        };
      }
    }
  },
  
  // Track event: enemy killed
  onEnemyKill(killData) {
    this.ensureMeta();
    if (killData.isBoss) State.meta.totalBossKills = (State.meta.totalBossKills || 0) + 1;
    if (killData.isElite) State.meta.totalEliteKills = (State.meta.totalEliteKills || 0) + 1;
    
    // Track best streak in current run
    if (State.run.streak?.count > (State.run.stats.bestStreak || 0)) {
      State.run.stats.bestStreak = State.run.streak.count;
    }
    
    const done = this.checkAll();
    this.announce(done);
  },
  
  // Track event: item collected
  onItemCollected(item) {
    this.ensureMeta();
    State.meta.totalItemsCollected = (State.meta.totalItemsCollected || 0) + 1;
    
    // Check rarity for legendary tracking
    const rarity = item?.rarity || item?.rarityId || '';
    if (rarity === 'legendary' || rarity === 'unique') {
      State.meta.totalLegendaries = (State.meta.totalLegendaries || 0) + 1;
    }
    
    const done = this.checkAll();
    this.announce(done);
  },
  
  // Track event: scrap earned (call with amount)
  onScrapEarned(amount) {
    this.ensureMeta();
    State.meta.totalScrapEarned = (State.meta.totalScrapEarned || 0) + amount;
    
    const done = this.checkAll();
    this.announce(done);
  },
  
  // Track event: craft performed
  onCraft() {
    this.ensureMeta();
    State.meta.totalCrafts = (State.meta.totalCrafts || 0) + 1;
    
    const done = this.checkAll();
    this.announce(done);
  },
  
  // Track event: zone reached
  onZoneReached(depth) {
    const done = this.checkAll();
    this.announce(done);
  },
  
  // Track event: level up
  onLevelUp(level) {
    const done = this.checkAll();
    this.announce(done);
  },
  
  // Track event: prestige
  onPrestige() {
    const done = this.checkAll();
    this.announce(done);
  },
  
  // Track event: flawless zone (no damage taken)
  onFlawlessZone() {
    if (!State.run.stats) State.run.stats = {};
    State.run.stats.flawlessZones = (State.run.stats.flawlessZones || 0) + 1;
    
    const done = this.checkAll();
    this.announce(done);
  },
  
  // Get display data for hub panel
  getDisplayData() {
    this.ensureMeta();
    const completed = State.meta.achievements || {};
    const total = ACHIEVEMENTS.length;
    const done = Object.keys(completed).length;
    
    const categories = {};
    for (const ach of ACHIEVEMENTS) {
      if (!categories[ach.category]) categories[ach.category] = [];
      categories[ach.category].push({
        ...ach,
        completed: !!completed[ach.id],
        completedAt: completed[ach.id]?.at || null
      });
    }
    
    return { total, done, categories };
  }
};
