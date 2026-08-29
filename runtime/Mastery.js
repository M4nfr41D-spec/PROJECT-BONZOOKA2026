// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// MASTERY.js - Endgame Prestige / Paragon System
// ============================================================
// Once depth progression slows, Mastery provides infinite
// small permanent bonuses. Each mastery level grants 1 point
// to spend in 5 categories. XP curve is gentle exponential.
//
// Design: Small wins often (every ~5 min at endgame).
// Power gain is bounded: diminishing returns per category.
// ============================================================

import { State } from './State.js';
import { getConfig } from './DataLoader.js';

// ── Mastery categories and their effects ──
const MASTERY_TREES = {
  firepower: {
    name: 'Firepower',
    icon: '\uD83D\uDD25',
    description: '+0.5% damage per point (diminishing)',
    stat: 'damage',
    baseBonus: 0.5,       // % per point
    diminishStart: 50,    // points before diminishing kicks in
    diminishRate: 0.02    // bonus reduction per point above start
  },
  resilience: {
    name: 'Resilience',
    icon: '\uD83D\uDEE1\uFE0F',
    description: '+0.4% max HP and shield per point',
    stat: 'maxHP',
    baseBonus: 0.4,
    diminishStart: 60,
    diminishRate: 0.015
  },
  velocity: {
    name: 'Velocity',
    icon: '\u26A1',
    description: '+0.3% speed and fire rate per point',
    stat: 'speed',
    baseBonus: 0.3,
    diminishStart: 40,
    diminishRate: 0.025
  },
  fortune: {
    name: 'Fortune',
    icon: '\uD83C\uDF40',
    description: '+0.5% item drop chance and rarity weight per point',
    stat: 'luck',
    baseBonus: 0.5,
    diminishStart: 40,
    diminishRate: 0.03
  },
  efficiency: {
    name: 'Efficiency',
    icon: '\u2699\uFE0F',
    description: '+0.3% XP and scrap gain per point',
    stat: 'xpBonus',
    baseBonus: 0.3,
    diminishStart: 50,
    diminishRate: 0.02
  }
};

function ensureMastery() {
  if (!State.meta.mastery) {
    State.meta.mastery = {
      level: 0,
      xp: 0,
      points: 0,        // unspent
      totalPoints: 0,    // lifetime allocated
      trees: {
        firepower: 0,
        resilience: 0,
        velocity: 0,
        fortune: 0,
        efficiency: 0
      }
    };
  }
}

export const Mastery = {

  // ── XP curve: gentler than main leveling ──
  // Design: ~5 min per mastery level at endgame pace
  xpForLevel(masteryLevel) {
    const base = getConfig('mastery.baseXP', 500);
    const scale = getConfig('mastery.xpScale', 1.08);  // 8% increase per level
    return Math.floor(base * Math.pow(scale, masteryLevel));
  },

  // ── Add mastery XP (overflow XP from max level feeds here) ──
  addXP(amount) {
    ensureMastery();
    const m = State.meta.mastery;

    // Efficiency bonus
    const effBonus = this.getBonusPercent('efficiency');
    amount = Math.floor(amount * (1 + effBonus / 100));

    m.xp += amount;

    let leveledUp = false;
    while (true) {
      const required = this.xpForLevel(m.level);
      if (m.xp >= required) {
        m.xp -= required;
        m.level++;
        m.points++;
        leveledUp = true;
        // console.log('[MASTERY] Level ' + m.level + '! (+1 mastery point)');
      } else {
        break;
      }
    }

    return leveledUp;
  },

  // ── Allocate point to a tree ──
  allocate(treeId) {
    ensureMastery();
    const m = State.meta.mastery;

    if (m.points <= 0) return { ok: false, reason: 'No mastery points available' };
    if (!MASTERY_TREES[treeId]) return { ok: false, reason: 'Unknown mastery tree: ' + treeId };

    m.trees[treeId] = (m.trees[treeId] || 0) + 1;
    m.points--;
    m.totalPoints++;

    const bonus = this.getBonusPercent(treeId);
    // console.log('[MASTERY] ' + MASTERY_TREES[treeId].name + ' -> ' + m.trees[treeId] + ' pts (' + bonus.toFixed(1) + '% bonus)');

    return { ok: true, tree: treeId, points: m.trees[treeId], bonusPercent: bonus };
  },

  // ── Get effective bonus % for a tree (with diminishing returns) ──
  getBonusPercent(treeId) {
    ensureMastery();
    const tree = MASTERY_TREES[treeId];
    if (!tree) return 0;

    const pts = State.meta.mastery.trees[treeId] || 0;
    if (pts <= 0) return 0;

    const base = tree.baseBonus;
    const dimStart = tree.diminishStart;
    const dimRate = tree.diminishRate;

    let total = 0;
    for (let i = 0; i < pts; i++) {
      if (i < dimStart) {
        total += base;
      } else {
        // Each point above diminishStart gives less
        const decay = Math.max(0.05, base - (i - dimStart) * dimRate);
        total += decay;
      }
    }

    return Math.round(total * 100) / 100;
  },

  // ── Get all bonuses as a flat object for Stats.calculate() ──
  getAllBonuses() {
    ensureMastery();
    const bonuses = {};
    for (const [id, tree] of Object.entries(MASTERY_TREES)) {
      bonuses[id] = {
        stat: tree.stat,
        percent: this.getBonusPercent(id)
      };
    }
    return bonuses;
  },

  // ── Get mastery state for UI ──
  getState() {
    ensureMastery();
    const m = State.meta.mastery;
    const required = this.xpForLevel(m.level);

    return {
      level: m.level,
      xp: m.xp,
      xpRequired: required,
      progress: m.xp / required,
      unspentPoints: m.points,
      totalPoints: m.totalPoints,
      trees: {}
    };
  },

  // ── Get full UI data with tree details ──
  getUIData() {
    ensureMastery();
    const m = State.meta.mastery;
    const required = this.xpForLevel(m.level);

    const trees = {};
    for (const [id, def] of Object.entries(MASTERY_TREES)) {
      trees[id] = {
        ...def,
        points: m.trees[id] || 0,
        bonusPercent: this.getBonusPercent(id),
        nextBonus: this._nextPointBonus(id)
      };
    }

    return {
      level: m.level,
      xp: m.xp,
      xpRequired: required,
      progress: required > 0 ? m.xp / required : 0,
      unspentPoints: m.points,
      totalPoints: m.totalPoints,
      trees
    };
  },

  // ── Preview what next point would give ──
  _nextPointBonus(treeId) {
    const tree = MASTERY_TREES[treeId];
    if (!tree) return 0;

    const pts = (State.meta.mastery?.trees?.[treeId] || 0);

    if (pts < tree.diminishStart) {
      return tree.baseBonus;
    }
    return Math.max(0.05, tree.baseBonus - (pts - tree.diminishStart) * tree.diminishRate);
  },

  // ── Get tree definitions (for UI rendering) ──
  getTreeDefs() {
    return { ...MASTERY_TREES };
  }
};

export default Mastery;
