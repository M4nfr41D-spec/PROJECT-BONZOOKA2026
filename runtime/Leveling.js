// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// LEVELING.js - XP and Level Up System
// ============================================================

import { State } from './State.js';
import { getConfig } from './DataLoader.js';
import Stats from './Stats.js';
import { autoSave } from './Save.js';

export const Leveling = {
  // Calculate XP required for a level
  xpForLevel(level) {
    const baseXP = getConfig('progression.baseXP', 100);
    const scale = getConfig('progression.xpScale', 1.15);
    return Math.floor(baseXP * Math.pow(scale, level - 1));
  },
  
  // Add XP and check for level up
  addXP(amount) {
    const cfgMax = getConfig('progression.maxLevel', 100);
    const maxLevel = (typeof cfgMax === 'number' && cfgMax > 0) ? cfgMax : Number.POSITIVE_INFINITY;
    
    if (State.meta.level >= maxLevel) {
      // Overflow XP feeds into Mastery system
      try {
        import('./Mastery.js').then(mod => {
          if (mod && mod.Mastery) {
            mod.Mastery.addXP(amount);
          }
        });
      } catch (e) { /* Mastery not loaded yet */ }
      return false;
    }
    
    // Add to meta and run tracking (with prestige XP rate bonus)
    const prestigeXPBonus = State.meta.prestige?.bonuses?.xpRate || 0;
    const effectiveAmount = Math.round(amount * (1 + prestigeXPBonus / 100));
    State.meta.xp += effectiveAmount;
    State.run.xpEarned += effectiveAmount;
    
    // Check for level ups
    let leveledUp = false;
    while (State.meta.level < maxLevel) {
      const required = this.xpForLevel(State.meta.level);
      
      if (State.meta.xp >= required) {
        State.meta.xp -= required;
        this.levelUp();
        leveledUp = true;
      } else {
        break;
      }
    }
    
    return leveledUp;
  },
  
  // Level up!
  levelUp() {
    State.meta.level++;
    
    // Award skill points
    const skillPerLevel = getConfig('progression.skillPerLevel', 1);
    State.meta.skillPoints += skillPerLevel;
    
    // Award stat points
    const statPerLevel = getConfig('progression.statPerLevel', 3);
    State.meta.statPoints += statPerLevel;
    
    // Recalculate stats
    Stats.calculate();
    
    // Heal to full on level up
    State.player.hp = State.player.maxHP;
    State.player.shield = State.player.maxShield;
    
    // console.log(` Level Up! Now level ${State.meta.level}`);
    // console.log(`  +${skillPerLevel} Skill Points, +${statPerLevel} Stat Points`);
    
    // Trigger UI notification
    State.ui.levelUp = State.meta.level;
    
    // Audio
    const Audio = State.modules?.Audio;
    if (Audio) Audio.levelUp();

    // v2.14.0: Achievement tracking
    try { State.modules?.Achievements?.onLevelUp(State.meta.level); } catch(e) {}

    // Auto save
    autoSave();
    
    return {
      level: State.meta.level,
      skillPoints: skillPerLevel,
      statPoints: statPerLevel
    };
  },
  
  // Get current XP progress (0-1)
  getProgress() {
    const required = this.xpForLevel(State.meta.level);
    return State.meta.xp / required;
  },
  
  // Get XP remaining to next level
  getXPRemaining() {
    return this.xpForLevel(State.meta.level) - State.meta.xp;
  },
  
  // Calculate XP from enemy kill
  getKillXP(enemyType, isElite = false, isBoss = false) {
    const enemies = State.data.enemies;
    if (!enemies) return 10;
    
    let xp = 10;
    
    // Find enemy definition
    for (const category of Object.values(enemies)) {
      if (typeof category === 'object' && enemyType in category) {
        xp = category[enemyType].xp || 10;
        break;
      }
    }
    
    // Elite/Boss multipliers
    if (isBoss) xp *= 5;
    else if (isElite) xp *= 2;
    
    // XP bonus from skills/equipment + mastery
    let xpBonus = 0; // TODO: Get from stats system
    try {
      if (State.meta.mastery && State.meta.mastery.trees.efficiency > 0) {
        // Inline calc to avoid circular import
        const pts = State.meta.mastery.trees.efficiency;
        const dimStart = 50;
        let bonus = 0;
        for (let i = 0; i < pts; i++) {
          bonus += i < dimStart ? 0.3 : Math.max(0.05, 0.3 - (i - dimStart) * 0.02);
        }
        xpBonus += bonus;
      }
    } catch (e) { /* mastery not available */ }
    xp *= (1 + xpBonus / 100);
    
    return Math.floor(xp);
  },
  
  // Add skill point (from skill trees)
  canLearnSkill(treeId, skillId) {
    const tree = State.data.skills?.[treeId];
    if (!tree) return false;
    
    const skill = tree.skills[skillId];
    if (!skill) return false;
    
    // Check if we have skill points
    if (State.meta.skillPoints <= 0) return false;
    
    // Check current rank vs max
    const currentRank = State.meta.skills[treeId]?.[skillId] || 0;
    if (currentRank >= skill.maxRank) return false;
    
    // Check requirements
    if (skill.requires) {
      const reqSkill = skill.requires.skill;
      const reqRank = skill.requires.rank;
      const currentReqRank = State.meta.skills[treeId]?.[reqSkill] || 0;
      
      if (currentReqRank < reqRank) return false;
    }
    
    return true;
  },
  
  // Learn a skill
  learnSkill(treeId, skillId) {
    if (!this.canLearnSkill(treeId, skillId)) return false;
    
    // Initialize tree if needed
    if (!State.meta.skills[treeId]) {
      State.meta.skills[treeId] = {};
    }
    
    // Initialize skill if needed
    if (!State.meta.skills[treeId][skillId]) {
      State.meta.skills[treeId][skillId] = 0;
    }
    
    // Learn!
    State.meta.skills[treeId][skillId]++;
    State.meta.skillPoints--;
    
    // Recalculate stats
    Stats.calculate();
    autoSave();
    
    const skill = State.data.skills[treeId].skills[skillId];
    // console.log(` Learned ${skill.name} (Rank ${State.meta.skills[treeId][skillId]})`);
    
    return true;
  },
  
  // Allocate stat point
  allocateStat(statId) {
    if (State.meta.statPoints <= 0) return false;
    
    if (!State.data.pilotStats?.[statId]) return false;
    
    // Initialize if needed
    if (!State.meta.stats[statId]) {
      State.meta.stats[statId] = 0;
    }
    
    State.meta.stats[statId]++;
    State.meta.statPoints--;
    
    Stats.calculate();
    autoSave();
    
    const stat = State.data.pilotStats[statId];
    // console.log(` ${stat.name} increased to ${State.meta.stats[statId]}`);
    
    return true;
  }
};

export default Leveling;
