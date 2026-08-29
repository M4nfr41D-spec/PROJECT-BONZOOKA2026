// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// STATS.js - Player Stats Calculator
// ============================================================
// Calculates final player stats from: Base + Meta + Skills + Equipment + RunUpgrades

import { State } from './State.js';

export const Stats = {
  // Recalculate all player stats
  calculate() {
    const p = State.player;
    const m = State.meta;
    const r = State.run;
    const data = State.data;
    
    if (!data.config) {
      console.warn('Stats.calculate: No config data loaded');
      return;
    }
    
    const cfg = data.config.player;
    
    // ========== BASE VALUES ==========
    p.maxHP = cfg.baseHP;
    p.damage = cfg.baseDamage;
    p.speed = cfg.baseSpeed;
    p.fireRate = cfg.baseFireRate;
    p.critChance = cfg.baseCritChance;
    p.critDamage = cfg.baseCritDamage;
    p.pickupRadius = cfg.basePickupRadius;
    p.maxShield = 0;
    p.piercing = 0;
    p.projectiles = 1;
    p.luck = 0;
    p.hpRegen = 0;
    p.shieldRegen = 0;
    
    // ========== PER-LEVEL AUTO-SCALING ==========
    // Every level grants passive growth so the player always gets stronger
    const level = m.level || 1;
    const levelBonus = 1 + (level - 1) * 0.015; // +1.5% per level (was 3%)
    p.damage *= levelBonus;
    p.maxHP *= levelBonus;
    
    // ========== PRESTIGE BONUSES (permanent, cumulative) ==========
    const prestige = m.prestige?.bonuses || {};
    if (prestige.damage)  p.damage *= (1 + prestige.damage / 100);
    if (prestige.maxHP)   p.maxHP *= (1 + prestige.maxHP / 100);
    if (prestige.luck)    p.luck += prestige.luck;
    // prestige.xpRate handled in Leveling.js
    // prestige.startScrap handled in Prestige.doPrestige()
    
    // ========== PARAGON TREE (v2.16.3 — replaces flat pilotStats) ==========
    const paragon = data.paragonTree;
    if (paragon?.branches) {
      const unlocked = m.paragon?.unlocked || {};
      for (const [branchId, branch] of Object.entries(paragon.branches)) {
        for (const node of branch.nodes) {
          if (!unlocked[node.id]) continue;
          // Choice nodes: only apply if this specific choice was picked
          if (node.type === 'choice' && unlocked[node.id] !== true) continue;
          for (const [stat, val] of Object.entries(node.effect || {})) {
            this.applyStat(stat, val, 'flat');
          }
        }
      }
    }
    // Legacy pilotStats fallback (old saves)
    else if (data.pilotStats) {
      for (const [statId, points] of Object.entries(m.stats)) {
        const statDef = data.pilotStats[statId];
        if (statDef && points > 0) {
          const effectType = statDef.effect.type || 'flat';
          this.applyStat(statDef.effect.stat, statDef.effect.perPoint * points, effectType);
        }
      }
    }
    
    // ========== SKILL TREE BONUSES (percent bonuses) ==========
    if (data.skills) {
      for (const [treeId, tree] of Object.entries(data.skills)) {
        const learned = m.skills[treeId] || {};
        for (const [skillId, rank] of Object.entries(learned)) {
          if (rank > 0 && tree.skills[skillId]) {
            const skill = tree.skills[skillId];
            if (skill.effect) {
              this.applyStat(skill.effect.stat, skill.effect.perRank * rank, 'percent');
            }
          }
        }
      }
    }
    
    // ========== EQUIPMENT BONUSES ==========
    // v2.16.3: Reset weapon type — equipped weapon item determines fire pattern
    State.player.weaponType = 'laser'; // default fallback
    
    for (const [slotId, itemId] of Object.entries(m.equipment)) {
      if (!itemId) continue;
      
      const item = m.stash.find(i => i.id === itemId);
      if (!item) continue;
      
      // Base stats
      for (const [stat, value] of Object.entries(item.stats || {})) {
        this.applyStat(stat, value, 'flat');
      }
      
      // Affix bonuses
      for (const affix of item.affixes || []) {
        this.applyStat(affix.stat, affix.value, 'flat');
      }
      
      // v2.16.3: Weapon type from equipped weapon item
      if (slotId === 'weapon' && item.weaponType) {
        State.player.weaponType = item.weaponType;
      }
    }
    
    // ========== SYNERGY TAG BONUSES (v2.16.3) ==========
    // If 3+ equipped items share a tag, activate bonus stats
    try {
      const Items = State.modules?.Items;
      if (Items?.getEquippedSynergies) {
        const syn = Items.getEquippedSynergies();
        State.computed = State.computed || {};
        State.computed.synergies = syn; // cache for UI display
        for (const [stat, value] of Object.entries(syn.bonuses || {})) {
          this.applyStat(stat, value, 'flat');
        }
      }
    } catch(e) { /* safe — synergies are non-critical */ }
    
    // ========== SET ITEM BONUSES (v2.16.3) ==========
    try {
      const Items = State.modules?.Items;
      if (Items?.getEquippedSetBonuses) {
        const sets = Items.getEquippedSetBonuses();
        State.computed = State.computed || {};
        State.computed.setBonuses = sets; // cache for UI
        for (const [stat, value] of Object.entries(sets.bonuses || {})) {
          if (typeof value === 'number') this.applyStat(stat, value, 'flat');
          // Boolean flags (killExplosion, overdriveInvuln) stored directly
          else p[stat] = value;
        }
      }
    } catch(e) { /* safe */ }
    
    // ========== RUN UPGRADES ==========
    // Some stats need flat application (additive), others percent (multiplicative)
    const flatStats = new Set(['projectiles', 'piercing', 'shieldCap', 'hpRegen', 'shieldRegen', 'pickupRadius']);
    if (data.runUpgrades) {
      for (const [upgradeId, tier] of Object.entries(r.upgrades)) {
        if (tier > 0 && data.runUpgrades[upgradeId]) {
          const upgrade = data.runUpgrades[upgradeId];
          if (upgrade.effect) {
            const statName = upgrade.effect.stat;
            const mode = flatStats.has(statName) ? 'flat' : 'percent';
            this.applyStat(statName, upgrade.effect.perTier * tier, mode);
          }
        }
      }
    }
    
    // ========== HARD CAPS (prevents infinite scaling) ==========
    // These are absolute ceilings that gear + skills + upgrades cannot exceed
    p.fireRate = Math.min(p.fireRate, 15);          // max 15 shots/sec (was unlimited → 168)
    p.projectiles = Math.min(p.projectiles, 7);     // max 7 projectiles (was unlimited → 27)
    p.speed = Math.min(p.speed, 600);               // max 600 speed (was unlimited → 1105)
    p.luck = Math.min(p.luck, 50);                  // max 50 luck (was unlimited → 138)
    p.piercing = Math.min(p.piercing, 5);           // max 5 pierce
    p.critChance = Math.min(p.critChance, 75);      // max 75% crit (not 100%)
    p.critDamage = Math.min(p.critDamage, 400);     // max 400% crit damage
    p.hpRegen = Math.min(p.hpRegen, 20);            // max 20 hp/sec regen
    p.pickupRadius = Math.min(p.pickupRadius, 250); // max 250 pickup radius
    
    // ========== ZONE MOD EFFECTS ON PLAYER ==========
    const zoneMods = new Set(State.world?.currentZone?.mods || []);
    if (zoneMods.has('NO_SHIELD'))    { p.maxShield = 0; p.shield = 0; }
    if (zoneMods.has('GRAVITY_WELL')) { p.speed *= 0.80; }
    
    // ========== ENSURE MINIMUMS ==========
    p.maxHP = Math.max(1, Math.round(p.maxHP));
    p.damage = Math.max(1, Math.round(p.damage * 10) / 10);
    p.speed = Math.max(50, Math.round(p.speed));
    p.fireRate = Math.max(0.5, Math.round(p.fireRate * 10) / 10);
    p.critChance = Math.min(100, Math.max(0, p.critChance));
    p.critDamage = Math.max(100, p.critDamage);
    p.projectiles = Math.max(1, Math.floor(p.projectiles));
    p.piercing = Math.max(0, Math.floor(p.piercing));
    p.pickupRadius = Math.max(20, Math.round(p.pickupRadius));
    
    // Cap HP if needed
    if (p.hp > p.maxHP) p.hp = p.maxHP;
    if (p.shield > p.maxShield) p.shield = p.maxShield;
    
    // ═══ v2.16.3: DRONE SCALING ═══
    // Drone scales with player stats + paragon/equipment bonuses
    if (p.drone) {
      const d = p.drone;
      // Combat drone: deliberately restrained so it supports the player instead of replacing them
      d.damagePct = 0.12 + (p.droneDamageBonus || 0) / 100;
      d.fireRate = Math.max(0.3, (d.baseFireRate || 0.75) - (p.droneFireRateBonus || 0) * 0.015);
      // Shield drone: absorb radius scales with shield stats
      d.absorbRadius = 20 + (p.shieldCap || 0) * 0.1;
      // Repair drone: heal scales with maxHP
      d.healPct = 0.02 + (p.maxHP > 200 ? 0.01 : 0) + (p.hpRegen || 0) * 0.002;
      // Orbit radius scales slightly with speed
      d.orbitRadius = 45 + Math.min(20, (p.speed - 200) * 0.05);
    }
  },
  
  // Apply a stat bonus
  applyStat(stat, value, type = 'flat') {
    const p = State.player;
    
    // Percent bonuses multiply, flat bonuses add
    if (type === 'percent') {
      value = value / 100;
    }
    
    switch (stat) {
      case 'damage':
        if (type === 'percent') p.damage *= (1 + value);
        else p.damage += value;
        break;
      case 'fireRate':
        if (type === 'percent') p.fireRate *= (1 + value);
        else p.fireRate += value;
        break;
      case 'speed':
        if (type === 'percent') p.speed *= (1 + value);
        else p.speed += value;
        break;
      case 'maxHP':
        if (type === 'percent') p.maxHP *= (1 + value);
        else p.maxHP += value;
        break;
      case 'shieldCap':
        if (type === 'percent') p.maxShield *= (1 + value);
        else p.maxShield += value;
        break;
      case 'critChance':
        p.critChance += value * (type === 'percent' ? 100 : 1);
        break;
      case 'critDamage':
        p.critDamage += value * (type === 'percent' ? 100 : 1);
        break;
      case 'piercing':
        p.piercing += value;
        break;
      case 'projectiles':
        p.projectiles += value;
        break;
      case 'luck':
        p.luck += value;
        break;
      case 'pickupRadius':
        if (type === 'percent') p.pickupRadius *= (1 + value);
        else p.pickupRadius += value;
        break;
      case 'hpRegen':
        p.hpRegen += value;
        break;
      case 'shieldRegen':
        p.shieldRegen += value;
        break;
      case 'dropRate':
        p.luck += value; // Treat as luck for simplicity
        break;
      // ═══ v2.16.3: Extended stats from synergies + affixes ═══
      case 'damageBonus':
        p.damage += value;
        break;
      case 'damageReduction':
        p.damageReduction = (p.damageReduction || 0) + value;
        break;
      case 'dodgeChance':
        p.dodgeChance = (p.dodgeChance || 0) + value;
        break;
      case 'lifesteal':
        p.lifesteal = (p.lifesteal || 0) + value;
        break;
      case 'scrapBonus':
        p.scrapBonus = (p.scrapBonus || 0) + value;
        break;
      case 'dropBonus':
        p.dropBonus = (p.dropBonus || 0) + value;
        break;
      case 'fireDamage':
        p.fireDamage = (p.fireDamage || 0) + value;
        break;
      case 'coldDamage':
        p.coldDamage = (p.coldDamage || 0) + value;
        break;
      case 'lightningDamage':
        p.lightningDamage = (p.lightningDamage || 0) + value;
        break;
      case 'allElementalDamage':
        p.fireDamage = (p.fireDamage || 0) + value;
        p.coldDamage = (p.coldDamage || 0) + value;
        p.lightningDamage = (p.lightningDamage || 0) + value;
        break;
      case 'allStats':
        p.damage += value; p.maxHP += value; p.speed += value;
        break;
      case 'energyOnKill': case 'aoeOnKill': case 'chainCount': case 'aoeRadius':
      case 'burnChance': case 'slowChance': case 'freezeChance': case 'shockChance':
      case 'thornsDamage': case 'eliteDamage': case 'damageAtLowHP': case 'scrapOnKill':
      case 'cellBonus': case 'acceleration': case 'energyRegen':
        // Store as generic stat — combat systems read from p directly
        p[stat] = (p[stat] || 0) + value;
        break;
    }
  },
  
  // Initialize player HP/Shield on run start
  initializeHP() {
    const p = State.player;
    p.hp = p.maxHP;
    p.shield = p.maxShield;
  },
  
  // Get DPS calculation for display
  getDPS() {
    const p = State.player;
    const baseDPS = p.damage * p.fireRate * p.projectiles;
    const critMult = 1 + (p.critChance / 100) * ((p.critDamage - 100) / 100);
    return Math.round(baseDPS * critMult);
  }
};

export default Stats;
