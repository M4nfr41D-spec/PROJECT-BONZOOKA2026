// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// ITEMS.js v2.3 - Enhanced Item Generation System
// ============================================================
// ilvl gating, pity protection, unique items, power budget
// ============================================================

import { State } from './State.js';
import { getItemData, getRandomAffix, getConfig } from './DataLoader.js';

// ── Pity tracker (in-memory, saved via State.meta.pity) ──
function ensurePity() {
  const current = State.meta.pity;
  if (!current || typeof current !== 'object') {
    State.meta.pity = {
      killsSinceRare: 0,
      killsSinceLegendary: 0,
      killsSinceUnique: 0,
      dryStreakLuck: 0,
      totalDrops: 0,
      rarityHist: {}
    };
    return State.meta.pity;
  }

  if (typeof current.killsSinceRare !== 'number' || !Number.isFinite(current.killsSinceRare)) current.killsSinceRare = 0;
  if (typeof current.killsSinceLegendary !== 'number' || !Number.isFinite(current.killsSinceLegendary)) current.killsSinceLegendary = 0;
  if (typeof current.killsSinceUnique !== 'number' || !Number.isFinite(current.killsSinceUnique)) current.killsSinceUnique = 0;
  if (typeof current.dryStreakLuck !== 'number' || !Number.isFinite(current.dryStreakLuck)) current.dryStreakLuck = 0;
  if (typeof current.totalDrops !== 'number' || !Number.isFinite(current.totalDrops)) current.totalDrops = 0;
  if (!current.rarityHist || typeof current.rarityHist !== 'object' || Array.isArray(current.rarityHist)) current.rarityHist = {};
  return current;
}

// ── Pity thresholds (overridable via config.json loot.pity) ──
function getPityConfig() {
  return {
    rareGuarantee:      getConfig('loot.pity.rareGuarantee', 40),
    legendaryGuarantee: getConfig('loot.pity.legendaryGuarantee', 200),
    uniqueGuarantee:    getConfig('loot.pity.uniqueGuarantee', 500),
    enabled:            getConfig('loot.pity.enabled', true)
  };
}

export const Items = {

  // ── Generate item with ilvl gating ──
  generate(baseId, forceRarity = null, rarityFloor = null, ilvl = null) {
    const baseData = getItemData(baseId);
    if (!baseData) {
      console.warn('Items.generate: Unknown item', baseId);
      return null;
    }

    const rarities = State.data.rarities;
    if (!rarities) return null;

    // Resolve item level: passed > zone depth > player level
    const itemLevel = ilvl
      || State.run.currentDepth
      || State.meta.level
      || 1;

    // Roll rarity
    let rarity = forceRarity || this.rollRarity(baseData.rarities, itemLevel);

    // Pity override
    if (!forceRarity) {
      rarity = this._applyPity(rarity);
    }

    // Rarity floor (elites etc.)
    if (!forceRarity && rarityFloor) {
      const RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
      if ((RANK[rarity] ?? 0) < (RANK[rarityFloor] ?? 0)) rarity = rarityFloor;
    }

    const rarityData = rarities[rarity];
    if (!rarityData) return null;

    // Create item
    const item = {
      id: this.generateId(),
      baseId: baseId,
      name: baseData.name,
      slot: baseData.slot,
      icon: baseData.icon,
      description: baseData.description,
      rarity: rarity,
      ilvl: itemLevel,
      level: State.meta.level,
      stats: {},
      affixes: [],
      value: 0,
      enchantCount: 0,
      rerollCount: 0,
      isUnique: false,
      weaponType: baseData.weaponType || null  // v2.16.3: fire pattern from item type
    };

    // ilvl scaling: different stat types scale differently
    // Damage/HP/Shield: full scaling (+3%/ilvl)
    // Speed/FireRate/Luck: minimal scaling (+0.5%/ilvl) 
    // Projectiles/Piercing: NO ilvl scaling (count stats are flat)
    const ilvlDamage = 1 + (itemLevel - 1) * 0.03;   // damage, shieldCap, maxHP
    const ilvlRate   = 1 + (itemLevel - 1) * 0.005;   // fireRate, speed, luck
    const ilvlCount  = 1;                              // projectiles, piercing (never scale)
    
    // Stat classification for ilvl scaling
    const rateStats = new Set(['fireRate', 'speed', 'luck', 'pickupRadius', 'acceleration', 'energyRegen', 'shieldRegen', 'hpRegen', 'scrapBonus']);
    const countStats = new Set(['projectiles', 'piercing', 'mineCount', 'dashCharges', 'tracking']);

    // Roll base stats with rarity x ilvl multiplier (stat-specific)
    for (const [stat, range] of Object.entries(baseData.stats || {})) {
      const base = range[0] + Math.random() * (range[1] - range[0]);
      let ilvlMult = ilvlDamage;
      if (rateStats.has(stat)) ilvlMult = ilvlRate;
      if (countStats.has(stat)) ilvlMult = ilvlCount;
      item.stats[stat] = Math.round(base * rarityData.powerMult * ilvlMult * 10) / 10;
    }

    // Roll affixes (ilvl gates higher-tier affixes)
    const numAffixes = Math.floor(Math.random() * (rarityData.maxAffixes + 1));
    const usedStats = new Set();

    for (let i = 0; i < numAffixes; i++) {
      const type = i < numAffixes / 2 ? 'prefix' : 'suffix';
      const affix = getRandomAffix(rarity, type);

      if (affix && !usedStats.has(affix.stat)) {
        usedStats.add(affix.stat);

        const value = affix.range[0] + Math.random() * (affix.range[1] - affix.range[0]);
        let affIlvlMult = ilvlDamage;
        if (rateStats.has(affix.stat)) affIlvlMult = ilvlRate;
        if (countStats.has(affix.stat)) affIlvlMult = ilvlCount;
        item.affixes.push({
          id: affix.id,
          name: affix.name,
          stat: affix.stat,
          value: Math.round(value * affIlvlMult * 10) / 10,
          type: type
        });
      }
    }

    // Build display name
    item.name = this.buildName(baseData.name, item.affixes);

    // Calculate sell value (scales with ilvl)
    item.value = Math.floor(
      50 * rarityData.sellMult * (1 + itemLevel * 0.12) * (1 + item.affixes.length * 0.15)
    );

    // Calculate power budget for balance tracking
    item._ilvlDmgMult = ilvlDamage;
    item.powerBudget = this._calcPowerBudget(item);

    // Track pity
    this._trackDrop(rarity);

    return item;
  },

  // ── Unique item generation ──
  generateUnique(uniqueId, ilvl, options = {}) {
    const uniques = State.data.uniques;
    if (!uniques) return null;

    const itemLevel = ilvl || State.run.currentDepth || State.meta.level || 1;
    const fromBoss = options.fromBoss || false;
    const bossType = options.bossType || null;

    // Find eligible uniques (meet minIlvl requirement)
    const eligible = [];
    for (const [category, items] of Object.entries(uniques)) {
      if (category.startsWith('_')) continue;
      if (typeof items !== 'object') continue;
      
      // Set items: nested under pieces
      if (category === 'sets') {
        for (const [setId, setDef] of Object.entries(items)) {
          if (!setDef.pieces) continue;
          for (const [pieceId, data] of Object.entries(setDef.pieces)) {
            if (uniqueId && pieceId !== uniqueId) continue;
            if (itemLevel < (data.minIlvl || 1)) continue;
            if (data.bossOnly && !fromBoss) continue;
            if (data.bossPool && Array.isArray(data.bossPool) && bossType) {
              if (!data.bossPool.includes(bossType)) continue;
            }
            if (data.minDepth && (State.run.currentDepth || 1) < data.minDepth) continue;
            eligible.push({ id: pieceId, ...data, category: 'sets', setFamily: setId, icon: data.icon || setDef.icon });
          }
        }
        continue;
      }
      
      for (const [id, data] of Object.entries(items)) {
        if (uniqueId && id !== uniqueId) continue;
        if (itemLevel < (data.minIlvl || 1)) continue;
        if (data.bossOnly && !fromBoss) continue;
        if (data.bossPool && Array.isArray(data.bossPool) && bossType) {
          if (!data.bossPool.includes(bossType)) continue;
        }
        if (data.minDepth && (State.run.currentDepth || 1) < data.minDepth) continue;
        eligible.push({ id, ...data, category });
      }
    }

    if (eligible.length === 0) return null;

    // Pick one (weighted)
    let picked;
    if (uniqueId) {
      picked = eligible[0];
    } else {
      picked = this._weightedPick(eligible, e => e.dropWeight || 1.0);
    }
    if (!picked) return null;

    const rarityData = State.data.rarities?.[picked.rarity] || State.data.rarities?.legendary;

    const item = {
      id: this.generateId(),
      baseId: picked.id,
      uniqueId: picked.id,
      name: picked.name,
      slot: picked.slot,
      icon: picked.icon,
      description: picked.description,
      flavor: picked.flavor || '',
      rarity: picked.rarity,
      ilvl: itemLevel,
      level: State.meta.level,
      stats: { ...picked.fixedStats },
      affixes: [],       // Uniques have no random affixes
      value: Math.floor(200 * (rarityData?.sellMult || 20) * (1 + itemLevel * 0.1)),
      enchantCount: 0,
      rerollCount: 0,
      isUnique: true,
      setFamily: picked.setFamily || null,
      weaponType: picked.weaponType || null,
      powerBudget: 0
    };

    item.powerBudget = this._calcPowerBudget(item);

    // Track pity reset
    ensurePity();
    State.meta.pity.killsSinceUnique = 0;

    return item;
  },

  // ── Roll rarity with ilvl gating + depth scaling ──
  rollRarity(allowedRarities, ilvl) {
    const rarities = State.data.rarities;
    const ilvlVal = ilvl || 1;
    if (!rarities) return allowedRarities?.[0] || 'common';

    const luck = State.player?.luck || 0;
    const lootCfg = State.data.config?.loot || {};
    const depthCfg = lootCfg.depthScaling || {};

    // ilvl gating: certain rarities only available at higher ilvls
    const gatingCfg = lootCfg.ilvlGating || {};
    const RARITY_MIN_ILVL = {
      common: gatingCfg.common || 1, uncommon: gatingCfg.uncommon || 1,
      rare: gatingCfg.rare || 3, epic: gatingCfg.epic || 8,
      legendary: gatingCfg.legendary || 15, mythic: gatingCfg.mythic || 30
    };

    const gatedRarities = (allowedRarities || Object.keys(rarities)).filter(
      r => ilvlVal >= (RARITY_MIN_ILVL[r] || 1)
    );

    if (gatedRarities.length === 0) return 'common';

    // Depth-based rarity shift: transfers weight from common → higher rarities
    const depthShift = depthCfg.enabled
      ? Math.min(depthCfg.rarityShiftCap || 0.6, (ilvlVal - 1) * (depthCfg.rarityShiftPerDepth || 0.002))
      : 0;

    // Progressive pity luck bonus (invisible to player, resets on rare+ drop)
    const pityLuck = (lootCfg.pity?.progressiveLuck && State.meta.pity)
      ? (State.meta.pity.killsSinceRare || 0) * (lootCfg.pity.luckPerDryStreak || 0.005)
      : 0;

    // Build weighted pool
    let total = 0;
    const weights = {};

    for (const rarity of gatedRarities) {
      const data = rarities[rarity];
      if (!data) continue;

      let weight = data.weight;

      // Depth shift: reduce common weight, boost rare+
      if (rarity === 'common') {
        weight *= Math.max(0.15, 1 - depthShift);
      } else {
        // Higher rarities get progressively more of the redistributed weight
        const RANK = { uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
        const rankMult = 1 + depthShift * (RANK[rarity] || 1) * 0.5;
        weight *= rankMult;
      }

      // Luck bonus: +2% per point for non-common
      if (rarity !== 'common') {
        weight *= (1 + (luck + pityLuck) * 0.02);
      }
      // ilvl bonus: gradually increase rare+ weights at high ilvl
      if (rarity !== 'common' && ilvlVal > 10) {
        weight *= (1 + (ilvlVal - 10) * 0.005);
      }
      weights[rarity] = weight;
      total += weight;
    }

    // Roll
    let roll = Math.random() * total;
    for (const [rarity, weight] of Object.entries(weights)) {
      roll -= weight;
      if (roll <= 0) return rarity;
    }

    return gatedRarities[0];
  },

  // ── Pity protection ──
  _applyPity(rolledRarity) {
    ensurePity();
    const pityCfg = getPityConfig();
    if (!pityCfg.enabled) return rolledRarity;

    const RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
    const pity = State.meta.pity;

    // Legendary pity
    if (pity.killsSinceLegendary >= pityCfg.legendaryGuarantee) {
      if ((RANK[rolledRarity] ?? 0) < RANK.legendary) {
        // console.log('[PITY] Legendary guaranteed after ' + pity.killsSinceLegendary + ' drops');
        return 'legendary';
      }
    }

    // Rare pity
    if (pity.killsSinceRare >= pityCfg.rareGuarantee) {
      if ((RANK[rolledRarity] ?? 0) < RANK.rare) {
        // console.log('[PITY] Rare guaranteed after ' + pity.killsSinceRare + ' drops');
        return 'rare';
      }
    }

    return rolledRarity;
  },

  _trackDrop(rarity) {
    ensurePity();
    const RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
    const pity = State.meta.pity;

    pity.totalDrops++;
    pity.rarityHist[rarity] = (pity.rarityHist[rarity] || 0) + 1;

    if ((RANK[rarity] ?? 0) >= RANK.rare) {
      pity.killsSinceRare = 0;
    } else {
      pity.killsSinceRare++;
    }

    if ((RANK[rarity] ?? 0) >= RANK.legendary) {
      pity.killsSinceLegendary = 0;
    } else {
      pity.killsSinceLegendary++;
    }

    pity.killsSinceUnique++;
  },

  // ── Power budget calculation ──
  _calcPowerBudget(item) {
    let budget = 0;
    const W = {
      damage: 3.0, fireRate: 2.0, critChance: 2.5, critDamage: 1.5,
      piercing: 4.0, projectiles: 5.0, aoeRadius: 2.0,
      maxHP: 1.0, shieldCap: 1.2, speed: 1.5, luck: 0.8,
      lifesteal: 3.5, dodgeChance: 3.0, damageMult: 3.5,
      energyRegen: 1.0, scrapBonus: 0.5, dropBonus: 1.5
    };

    for (const [stat, val] of Object.entries(item.stats || {})) {
      budget += Math.abs(val) * (W[stat] || 1.0);
    }
    for (const affix of item.affixes || []) {
      budget += Math.abs(affix.value) * (W[affix.stat] || 1.0);
    }

    return Math.round(budget);
  },

  // ── Weighted random pick ──
  _weightedPick(list, weightFn) {
    let total = 0;
    for (const item of list) total += weightFn(item);
    if (total <= 0) return list[0];
    let roll = Math.random() * total;
    for (const item of list) {
      roll -= weightFn(item);
      if (roll <= 0) return item;
    }
    return list[list.length - 1];
  },

  // Build item name
  buildName(baseName, affixes) {
    const prefix = affixes.find(a => a.type === 'prefix');
    const suffix = affixes.find(a => a.type === 'suffix');
    let name = baseName;
    if (prefix) name = prefix.name + ' ' + name;
    if (suffix) name = name + ' ' + suffix.name;
    return name;
  },

  // Generate unique item ID
  generateId() {
    return 'item_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
  },

  // ── Get random item (enhanced with ilvl + unique chance) ──
  generateRandom(forceRarity, rarityFloor, ilvl, dropContext = {}) {
    const items = State.data.items;
    if (!items) {
      State.pushDebugTrace?.('loot', 'item_generate_data_missing', {
        forcedRarity: forceRarity || null,
        rarityFloor: rarityFloor || null,
        ilvl: ilvl || null
      });
      return null;
    }

    const itemLevel = ilvl || State.run.currentDepth || State.meta.level || 1;

    // Check for unique drop
    ensurePity();
    const pityCfg = getPityConfig();
    const uniqueChance = getConfig('loot.uniqueDropChance', 0.005);
    const pityUniqueTriggered = pityCfg.enabled
      && State.meta.pity.killsSinceUnique >= pityCfg.uniqueGuarantee;

    if (pityUniqueTriggered || Math.random() < uniqueChance) {
      const unique = this.generateUnique(null, itemLevel, {
        fromBoss: dropContext.fromBoss || false,
        bossType: dropContext.bossType || null
      });
      if (unique) return unique;
    }

    // Normal generation
    const allIds = [];
    for (const category of Object.values(items)) {
      for (const [id, itemDef] of Object.entries(category)) {
        allIds.push({ id, slot: itemDef.slot });
      }
    }
    if (allIds.length === 0) {
      State.pushDebugTrace?.('loot', 'item_generate_pool_empty', {
        forcedRarity: forceRarity || null,
        rarityFloor: rarityFloor || null,
        ilvl: itemLevel
      });
      return null;
    }

    // Smart loot: prefer items matching the target slot
    let picked = null;
    const preferSlot = dropContext.preferSlot;
    if (preferSlot) {
      const slotMatches = allIds.filter(i => i.slot === preferSlot);
      if (slotMatches.length > 0) {
        picked = slotMatches[Math.floor(Math.random() * slotMatches.length)].id;
      }
    }
    if (!picked) {
      picked = allIds[Math.floor(Math.random() * allIds.length)].id;
    }
    const item = this.generate(picked, forceRarity, rarityFloor, itemLevel);
    State.pushDebugTrace?.('loot', item ? 'item_generated' : 'item_generate_failed', {
      itemId: item?.id || null,
      baseId: item?.baseId || picked,
      name: item?.name || null,
      rarity: item?.rarity || forceRarity || null,
      slot: item?.slot || null,
      ilvl: item?.ilvl || itemLevel,
      preferSlot: preferSlot || null,
      isUnique: !!item?.isUnique
    });
    return item;
  },

  // ── Stash management ──
  addToStash(item) {
    const maxSlots = getConfig('stash.baseSlots', 56);
    const beforeCount = State.meta.stash.length;

    if (!item || !item.id) {
      State.pushDebugTrace?.('loot', 'stash_add_failed_invalid_item', {
        beforeCount,
        maxSlots,
        itemId: item?.id || null,
        name: item?.name || null
      });
      return false;
    }

    // A60: AUTO-SALVAGE FILTER — junk below the kept-rarity threshold is converted to scrap on pickup
    const floor = State.settings && State.settings.autoSalvageBelow;
    if (floor && floor !== 'off' && item.rarity) {
      const RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
      if ((RANK[item.rarity] ?? 0) < (RANK[floor] ?? 99)) {
        const gain = item.value || 0;
        State.meta.scrap = (State.meta.scrap || 0) + gain;
        if (State.run?.stats) State.run.stats.itemsFound++;
        State.modules?.UI?.showAutoSalvageTick?.(gain, item.rarity);
        return true; // collected, but salvaged instead of stored
      }
    }

    if (State.meta.stash.length >= maxSlots) {
      console.warn('Stash is full!');
      State.pushDebugTrace?.('loot', 'stash_add_failed_full', {
        itemId: item.id,
        name: item.name,
        rarity: item.rarity,
        slot: item.slot,
        beforeCount,
        maxSlots
      });
      return false;
    }

    State.meta.stash.push(item);
    if (State.run.stats) State.run.stats.itemsFound++;

    const afterCount = State.meta.stash.length;
    const present = State.meta.stash.some(i => i?.id === item.id);
    State.pushDebugTrace?.('loot', 'stash_add_success', {
      itemId: item.id,
      name: item.name,
      rarity: item.rarity,
      slot: item.slot,
      beforeCount,
      afterCount,
      maxSlots,
      present
    });
    return true;
  },

  removeFromStash(itemId) {
    const index = State.meta.stash.findIndex(i => i.id === itemId);
    if (index !== -1) {
      State.meta.stash.splice(index, 1);
      return true;
    }
    return false;
  },

  equip(itemId) {
    const item = State.meta.stash.find(i => i.id === itemId);
    if (!item) return false;

    let slot = item.slot;
    if (item.slot === 'module' || (item.slot && item.slot.startsWith('module'))) {
      const slots = ['module1', 'module2', 'module3'];
      let placed = false;
      for (const s of slots) {
        if (!State.meta.equipment[s]) { slot = s; placed = true; break; }
      }
      if (!placed) slot = 'module1'; // all module slots full → replace the first
    }

    const oldId = State.meta.equipment[slot] || null;
    State.meta.equipment[slot] = itemId;

    // A48 swap-in-place: the previously-equipped item takes the new item's stash position,
    // so it reappears exactly where the just-equipped item was (no more guessing what got swapped).
    if (oldId && oldId !== itemId) {
      const stash = State.meta.stash;
      const ni = stash.findIndex(i => i.id === itemId);
      const oi = stash.findIndex(i => i.id === oldId);
      if (ni >= 0 && oi >= 0 && ni !== oi) {
        const tmp = stash[ni]; stash[ni] = stash[oi]; stash[oi] = tmp;
      }
    }
    return true;
  },

  unequip(slot) {
    if (State.meta.equipment[slot]) {
      State.meta.equipment[slot] = null;
      return true;
    }
    return false;
  },

  sell(itemId) {
    const item = State.meta.stash.find(i => i.id === itemId);
    if (!item) return 0;

    for (const [slot, id] of Object.entries(State.meta.equipment)) {
      if (id === itemId) State.meta.equipment[slot] = null;
    }

    this.removeFromStash(itemId);
    State.meta.scrap += item.value;
    return item.value;
  },

  compare(item1, item2) {
    if (!item1 || !item2) return null;
    const diff = {};
    const allStats = new Set([
      ...Object.keys(item1.stats || {}),
      ...Object.keys(item2.stats || {})
    ]);
    for (const stat of allStats) {
      const v1 = item1.stats?.[stat] || 0;
      const v2 = item2.stats?.[stat] || 0;
      if (v1 !== v2) diff[stat] = { old: v1, new: v2, change: v2 - v1 };
    }
    return diff;
  },

  // ── Diagnostics ──
  getPityState() {
    ensurePity();
    return { ...State.meta.pity };
  },

  getEquippedPowerBudget() {
    let total = 0;
    const breakdown = {};
    for (const [slot, itemId] of Object.entries(State.meta.equipment || {})) {
      if (!itemId) continue;
      const item = State.meta.stash.find(i => i.id === itemId);
      if (item) {
        const pb = item.powerBudget || this._calcPowerBudget(item);
        breakdown[slot] = pb;
        total += pb;
      }
    }
    return { total, breakdown };
  },

  // ═══════════════════════════════════════════════════
  // SMART LOOT — bias toward player's weakest/empty slots
  // ═══════════════════════════════════════════════════

  getSmartLootSlot() {
    const cfg = State.data.config?.loot?.smartLoot;
    if (!cfg?.enabled) return null;

    const equipment = State.meta.equipment || {};
    const allSlots = State.data.slots ? Object.keys(State.data.slots) : [
      'weapon','secondary','shield','engine','reactor','module1','module2','module3','drone'
    ];

    // Phase 1: empty slot bias
    const emptySlots = allSlots.filter(s => !equipment[s]);
    if (emptySlots.length > 0 && Math.random() < (cfg.emptySlotBias || 0.4)) {
      return emptySlots[Math.floor(Math.random() * emptySlots.length)];
    }

    // Phase 2: weakest slot bias (lowest power budget)
    if (Math.random() < (cfg.weakestSlotBias || 0.2)) {
      let weakest = null;
      let weakestPB = Infinity;
      for (const slot of allSlots) {
        const itemId = equipment[slot];
        if (!itemId) { weakest = slot; break; }
        const item = State.meta.stash.find(i => i.id === itemId);
        const pb = item ? (item.powerBudget || this._calcPowerBudget(item)) : 0;
        if (pb < weakestPB) { weakestPB = pb; weakest = slot; }
      }
      return weakest;
    }

    return null; // no bias — fully random
  },

  // ═══════════════════════════════════════════════════
  // SET BONUS RESOLUTION
  // ═══════════════════════════════════════════════════

  getEquippedSetBonuses() {
    const uniques = State.data.uniques?.sets;
    if (!uniques) return { sets: [], bonuses: {} };

    const equipment = State.meta.equipment || {};
    const setCounts = {};

    // Count equipped pieces per set family
    for (const [slot, itemId] of Object.entries(equipment)) {
      if (!itemId) continue;
      const item = State.meta.stash.find(i => i.id === itemId);
      if (!item?.setFamily) continue;
      setCounts[item.setFamily] = (setCounts[item.setFamily] || 0) + 1;
    }

    const activeSets = [];
    const totalBonuses = {};

    for (const [setId, count] of Object.entries(setCounts)) {
      const setDef = uniques[setId];
      if (!setDef?.bonuses) continue;

      // Check each tier (2-piece, 3-piece)
      for (const [threshold, bonus] of Object.entries(setDef.bonuses)) {
        if (count >= parseInt(threshold)) {
          activeSets.push({
            setId, name: setDef.name, icon: setDef.icon,
            count, threshold: parseInt(threshold),
            label: bonus.label, description: bonus.description
          });
          for (const [stat, val] of Object.entries(bonus.stats || {})) {
            if (typeof val === 'number') totalBonuses[stat] = (totalBonuses[stat] || 0) + val;
            else totalBonuses[stat] = val; // booleans like killExplosion
          }
        }
      }
    }

    return { sets: activeSets, bonuses: totalBonuses, counts: setCounts };
  },

  // ═══════════════════════════════════════════════════

  getEquippedSynergies() {
    const synergyCfg = State.data.affixes?.synergies;
    if (!synergyCfg) return { tags: {}, active: [], bonuses: {} };

    const equipment = State.meta.equipment || {};
    const tagCounts = {};

    // Count tags across all equipped items
    for (const [slot, itemId] of Object.entries(equipment)) {
      if (!itemId) continue;
      const item = State.meta.stash.find(i => i.id === itemId);
      if (!item) continue;
      const itemTags = new Set();
      for (const affix of item.affixes || []) {
        for (const tag of affix.tags || []) {
          itemTags.add(tag);
        }
      }
      for (const tag of itemTags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }

    // Resolve active synergies
    const active = [];
    const bonuses = {};

    for (const [tag, count] of Object.entries(tagCounts)) {
      const syn = synergyCfg[tag];
      if (!syn) continue;

      let tier = null;
      if (count >= 4 && syn['4']) tier = '4';
      else if (count >= 3 && syn['3']) tier = '3';

      if (tier) {
        active.push({ tag, count, tier: parseInt(tier) });
        const bonus = syn[tier];
        for (const [stat, val] of Object.entries(bonus)) {
          bonuses[stat] = (bonuses[stat] || 0) + val;
        }
      }
    }

    return { tags: tagCounts, active, bonuses };
  },

  // ═══════════════════════════════════════════════════
  // ITEM POWER SCORE (instant comparison number)
  // ═══════════════════════════════════════════════════

  getPowerScore(item) {
    if (!item) return 0;
    const RANK = { common: 1, uncommon: 1.3, rare: 1.7, epic: 2.2, legendary: 3, mythic: 5 };
    const base = this._calcPowerBudget(item);
    const rarityMult = RANK[item.rarity] || 1;
    const ilvlMult = 1 + (item.ilvl || 1) * 0.01;
    const affixBonus = (item.affixes?.length || 0) * 5;
    const uniqueBonus = item.isUnique ? 20 : 0;
    return Math.round((base + affixBonus + uniqueBonus) * rarityMult * ilvlMult);
  }
};

export default Items;
