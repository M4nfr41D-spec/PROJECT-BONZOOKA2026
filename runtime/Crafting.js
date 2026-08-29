// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// CRAFTING.js - Item Crafting & Currency Sink System
// ============================================================
// Recipes: reroll, upgrade, add affix, enchant, salvage
// Anti-exploit: escalating costs, rate limiting, craft log
// ============================================================

import { State } from './State.js';
import { getConfig, getRandomAffix } from './DataLoader.js';
import Items from './Items.js';

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const RARITY_RANK  = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };

// ── Anti-exploit: rate limiter ──
const _craftLog = [];   // { timestamp, recipe }
const MAX_CRAFTS_PER_MIN = 10;

function rateLimitOk(recipe) {
  const now = Date.now();
  // Purge old entries
  while (_craftLog.length > 0 && now - _craftLog[0].timestamp > 60000) {
    _craftLog.shift();
  }
  if (_craftLog.length >= MAX_CRAFTS_PER_MIN) {
    console.warn('[CRAFT] Rate limit hit: ' + MAX_CRAFTS_PER_MIN + '/min');
    return false;
  }
  _craftLog.push({ timestamp: now, recipe });
  return true;
}

// ── Ensure craft tracking on items ──
function ensureCraftMeta() {
  if (!State.meta.craftStats) {
    State.meta.craftStats = {
      totalCrafts: 0,
      totalScrapSpent: 0,
      totalCellsSpent: 0,
      totalVoidShardsSpent: 0,
      totalCosmicDustSpent: 0,
      successCount: 0,
      failCount: 0
    };
  }
}

export const Crafting = {

  // ── Get recipe data from crafting.json ──
  getRecipe(recipeId) {
    return State.data.crafting?.recipes?.[recipeId] || null;
  },

  // ── Calculate cost for a recipe on a specific item ──
  calcCost(recipeId, item) {
    const recipe = this.getRecipe(recipeId);
    if (!recipe) return null;

    const rarity = item.rarity || 'common';
    const costs = {};

    for (const [currency, costDef] of Object.entries(recipe.costs || {})) {
      let base = costDef.base || 0;

      // Per-rarity multiplier
      if (costDef.perRarity && costDef.perRarity[rarity]) {
        base *= costDef.perRarity[rarity];
      }

      // Per-use multiplier (for cost escalation)
      if (costDef.perUse && typeof costDef.perUse === 'number') {
        const uses = item.rerollCount || 0;
        base *= Math.pow(costDef.perUse, uses);
      }

      // Escalation from recipe-level config
      if (recipe.escalation && recipe.escalation.enabled) {
        const uses = item.rerollCount || 0;
        const mult = Math.min(
          Math.pow(recipe.escalation.perUse || 1, uses),
          recipe.escalation.maxMult || 10
        );
        base *= mult;
      }

      costs[currency] = Math.ceil(base);
    }

    return costs;
  },

  // ── Check if player can afford a cost ──
  canAfford(costs) {
    if (!costs) return false;
    for (const [currency, amount] of Object.entries(costs)) {
      const have = this._getCurrency(currency);
      if (have < amount) return false;
    }
    return true;
  },

  // ── Deduct currencies ──
  _deductCost(costs) {
    ensureCraftMeta();
    for (const [currency, amount] of Object.entries(costs)) {
      if (currency === 'legendaryItems') { this._consumeLegendaries(amount); continue; } // A58: remove items, not a number
      this._setCurrency(currency, this._getCurrency(currency) - amount);

      // Track spending
      const key = 'total' + currency.charAt(0).toUpperCase() + currency.slice(1) + 'Spent';
      if (State.meta.craftStats[key] !== undefined) {
        State.meta.craftStats[key] += amount;
      }
    }
  },

  // A58: consume N unequipped legendaries from the stash (for mythic-from-legendaries recipes)
  _consumeLegendaries(n) {
    const equipped = new Set(Object.values(State.meta.equipment || {}));
    let removed = 0;
    for (let i = State.meta.stash.length - 1; i >= 0 && removed < n; i--) {
      const it = State.meta.stash[i];
      if (it && it.rarity === 'legendary' && !equipped.has(it.id)) {
        State.meta.stash.splice(i, 1);
        removed++;
      }
    }
    return removed;
  },

  // ── Currency accessors ──
  _getCurrency(id) {
    switch (id) {
      case 'scrap':      return State.meta.scrap || 0;
      case 'cells':      return State.meta.cells || 0;   // A58 FIX: hub balance is in meta, not run
      case 'voidShard':  return State.meta.voidShards || 0;
      case 'cosmicDust': return State.meta.cosmicDust || 0;
      case 'legendaryItems': // A58: count unequipped legendaries in stash
        return (State.meta.stash || []).filter(i =>
          i && i.rarity === 'legendary' && !Object.values(State.meta.equipment || {}).includes(i.id)
        ).length;
      default: return 0;
    }
  },

  _setCurrency(id, val) {
    const v = Math.max(0, Math.floor(val));
    switch (id) {
      case 'scrap':      State.meta.scrap = v; break;
      case 'cells':      State.meta.cells = v; break;   // A58 FIX
      case 'voidShard':  State.meta.voidShards = v; break;
      case 'cosmicDust': State.meta.cosmicDust = v; break;
      // legendaryItems is consumed via _consumeLegendaries (item removal), not a numeric set
    }
  },

  // ── Validate constraints ──
  _checkConstraints(recipe, item) {
    const c = recipe.constraints || {};

    if (c.notUnique && item.isUnique) {
      return { ok: false, reason: 'Cannot craft unique items' };
    }
    if (c.minRarity) {
      if ((RARITY_RANK[item.rarity] ?? 0) < (RARITY_RANK[c.minRarity] ?? 0)) {
        return { ok: false, reason: 'Item rarity too low (min: ' + c.minRarity + ')' };
      }
    }
    if (c.maxRarity) {
      if ((RARITY_RANK[item.rarity] ?? 0) >= (RARITY_RANK[c.maxRarity] ?? 0)) {
        return { ok: false, reason: 'Item rarity already at max for this recipe' };
      }
    }
    if (c.minAffixes && (item.affixes?.length || 0) < c.minAffixes) {
      return { ok: false, reason: 'Item needs at least ' + c.minAffixes + ' affix(es)' };
    }
    if (c.mustHaveRoom) {
      const rarityData = State.data.rarities?.[item.rarity];
      const maxAffixes = rarityData?.maxAffixes || 1;
      if ((item.affixes?.length || 0) >= maxAffixes) {
        return { ok: false, reason: 'Item has no room for more affixes' };
      }
    }
    if (c.destroysItem) {
      // Just a flag, no blocking constraint
    }

    return { ok: true };
  },

  // ═══════════════════════════════════════════════
  //  RECIPE: Reroll All Affixes
  // ═══════════════════════════════════════════════
  rerollAffixes(itemId) {
    if (!rateLimitOk('reroll_affixes')) return { ok: false, reason: 'Rate limited' };

    const item = State.meta.stash.find(i => i.id === itemId);
    if (!item) return { ok: false, reason: 'Item not found' };

    const recipe = this.getRecipe('reroll_affixes');
    if (!recipe) return { ok: false, reason: 'Recipe not loaded' };

    const check = this._checkConstraints(recipe, item);
    if (!check.ok) return check;

    const costs = this.calcCost('reroll_affixes', item);
    if (!this.canAfford(costs)) return { ok: false, reason: 'Cannot afford', costs };

    // Deduct cost
    this._deductCost(costs);

    // Reroll affixes
    const rarityData = State.data.rarities?.[item.rarity];
    const maxAffixes = rarityData?.maxAffixes || 1;
    const numAffixes = Math.floor(Math.random() * (maxAffixes + 1));
    const usedStats = new Set();
    const ilvlMult = 1 + ((item.ilvl || 1) - 1) * 0.03;

    item.affixes = [];
    for (let i = 0; i < numAffixes; i++) {
      const type = i < numAffixes / 2 ? 'prefix' : 'suffix';
      const affix = getRandomAffix(item.rarity, type);
      if (affix && !usedStats.has(affix.stat)) {
        usedStats.add(affix.stat);
        const value = affix.range[0] + Math.random() * (affix.range[1] - affix.range[0]);
        item.affixes.push({
          id: affix.id, name: affix.name, stat: affix.stat,
          value: Math.round(value * ilvlMult * 10) / 10, type
        });
      }
    }

    // Rebuild name
    const baseData = State.data.items;
    let baseName = item.name;
    if (baseData) {
      for (const cat of Object.values(baseData)) {
        if (cat[item.baseId]) { baseName = cat[item.baseId].name; break; }
      }
    }
    item.name = Items.buildName(baseName, item.affixes);
    item.rerollCount = (item.rerollCount || 0) + 1;
    item.powerBudget = Items._calcPowerBudget(item);

    ensureCraftMeta();
    State.meta.craftStats.totalCrafts++;

    return { ok: true, item, costs };
  },

  // ═══════════════════════════════════════════════
  //  RECIPE: Upgrade Rarity
  // ═══════════════════════════════════════════════
  upgradeRarity(itemId) {
    if (!rateLimitOk('upgrade_rarity')) return { ok: false, reason: 'Rate limited' };

    const item = State.meta.stash.find(i => i.id === itemId);
    if (!item) return { ok: false, reason: 'Item not found' };

    const recipe = this.getRecipe('upgrade_rarity');
    if (!recipe) return { ok: false, reason: 'Recipe not loaded' };

    const check = this._checkConstraints(recipe, item);
    if (!check.ok) return check;

    const costs = this.calcCost('upgrade_rarity', item);
    if (!this.canAfford(costs)) return { ok: false, reason: 'Cannot afford', costs };

    this._deductCost(costs);

    // Roll success
    const successChance = recipe.successChance?.[item.rarity] ?? 0.5;
    const success = Math.random() < successChance;

    ensureCraftMeta();
    State.meta.craftStats.totalCrafts++;

    if (success) {
      const rank = RARITY_RANK[item.rarity] ?? 0;
      const nextRarity = RARITY_ORDER[rank + 1];
      if (nextRarity) {
        item.rarity = nextRarity;

        // Recalc stats with new rarity multiplier
        const rarityData = State.data.rarities?.[nextRarity];
        if (rarityData) {
          // Boost existing stats by ratio of new/old powerMult
          const oldMult = State.data.rarities?.[RARITY_ORDER[rank]]?.powerMult || 1;
          const ratio = rarityData.powerMult / oldMult;
          for (const stat of Object.keys(item.stats)) {
            item.stats[stat] = Math.round(item.stats[stat] * ratio * 10) / 10;
          }
        }

        item.value = Math.floor(item.value * 1.5);
        item.powerBudget = Items._calcPowerBudget(item);
        State.meta.craftStats.successCount++;
        return { ok: true, success: true, item, newRarity: nextRarity, costs };
      }
    }

    State.meta.craftStats.failCount++;
    return { ok: true, success: false, item, costs };
  },

  // ═══════════════════════════════════════════════
  //  RECIPE: Add Affix
  // ═══════════════════════════════════════════════
  addAffix(itemId) {
    if (!rateLimitOk('add_affix')) return { ok: false, reason: 'Rate limited' };

    const item = State.meta.stash.find(i => i.id === itemId);
    if (!item) return { ok: false, reason: 'Item not found' };

    const recipe = this.getRecipe('add_affix');
    if (!recipe) return { ok: false, reason: 'Recipe not loaded' };

    const check = this._checkConstraints(recipe, item);
    if (!check.ok) return check;

    const costs = this.calcCost('add_affix', item);
    if (!this.canAfford(costs)) return { ok: false, reason: 'Cannot afford', costs };

    this._deductCost(costs);

    // Pick a new affix that doesn't duplicate existing stats
    const usedStats = new Set((item.affixes || []).map(a => a.stat));
    const prefixCount = (item.affixes || []).filter(a => a.type === 'prefix').length;
    const suffixCount = (item.affixes || []).filter(a => a.type === 'suffix').length;
    const type = prefixCount <= suffixCount ? 'prefix' : 'suffix';

    const affix = getRandomAffix(item.rarity, type);
    if (!affix || usedStats.has(affix.stat)) {
      // Refund half cost on bad luck
      for (const [currency, amount] of Object.entries(costs)) {
        this._setCurrency(currency, this._getCurrency(currency) + Math.floor(amount * 0.5));
      }
      return { ok: false, reason: 'No compatible affix available (50% refund)' };
    }

    const ilvlMult = 1 + ((item.ilvl || 1) - 1) * 0.03;
    const value = affix.range[0] + Math.random() * (affix.range[1] - affix.range[0]);
    item.affixes.push({
      id: affix.id, name: affix.name, stat: affix.stat,
      value: Math.round(value * ilvlMult * 10) / 10, type
    });

    // Rebuild name
    const baseData = State.data.items;
    let baseName = item.name;
    if (baseData) {
      for (const cat of Object.values(baseData)) {
        if (cat[item.baseId]) { baseName = cat[item.baseId].name; break; }
      }
    }
    item.name = Items.buildName(baseName, item.affixes);
    item.powerBudget = Items._calcPowerBudget(item);

    ensureCraftMeta();
    State.meta.craftStats.totalCrafts++;
    State.meta.craftStats.successCount++;

    return { ok: true, item, addedAffix: affix.name, costs };
  },

  // ═══════════════════════════════════════════════
  //  RECIPE: Enchant Boost
  // ═══════════════════════════════════════════════
  enchantBoost(itemId) {
    if (!rateLimitOk('enchant_boost')) return { ok: false, reason: 'Rate limited' };

    const item = State.meta.stash.find(i => i.id === itemId);
    if (!item) return { ok: false, reason: 'Item not found' };

    const recipe = this.getRecipe('enchant_boost');
    if (!recipe) return { ok: false, reason: 'Recipe not loaded' };

    const check = this._checkConstraints(recipe, item);
    if (!check.ok) return check;

    const maxUses = recipe.maxUses || 3;
    if ((item.enchantCount || 0) >= maxUses) {
      return { ok: false, reason: 'Max enchants reached (' + maxUses + ')' };
    }

    // Calculate escalating cost
    const costs = {};
    for (const [currency, costDef] of Object.entries(recipe.costs || {})) {
      let base = costDef.base || 0;
      const perUse = costDef.perUse || 1;
      base *= Math.pow(perUse, item.enchantCount || 0);
      costs[currency] = Math.ceil(base);
    }

    if (!this.canAfford(costs)) return { ok: false, reason: 'Cannot afford', costs };

    this._deductCost(costs);

    // Boost all stats by 10-20%
    const boostRange = recipe.boostRange || [0.10, 0.20];
    const boost = boostRange[0] + Math.random() * (boostRange[1] - boostRange[0]);

    for (const stat of Object.keys(item.stats)) {
      item.stats[stat] = Math.round(item.stats[stat] * (1 + boost) * 10) / 10;
    }

    item.enchantCount = (item.enchantCount || 0) + 1;
    item.powerBudget = Items._calcPowerBudget(item);

    ensureCraftMeta();
    State.meta.craftStats.totalCrafts++;
    State.meta.craftStats.successCount++;

    return { ok: true, item, boostPercent: Math.round(boost * 100), costs };
  },

  // ═══════════════════════════════════════════════
  //  RECIPE: Salvage for Materials
  // ═══════════════════════════════════════════════
  salvage(itemId) {
    if (!rateLimitOk('salvage_advanced')) return { ok: false, reason: 'Rate limited' };

    const item = State.meta.stash.find(i => i.id === itemId);
    if (!item) return { ok: false, reason: 'Item not found' };

    // A48: never dismantle an equipped item — protected
    if (Object.values(State.meta.equipment || {}).includes(itemId)) {
      return { ok: false, reason: 'Equipped \u2014 unequip first (gesch\u00fctzt)' };
    }

    const recipe = this.getRecipe('salvage_advanced');
    if (!recipe) return { ok: false, reason: 'Recipe not loaded' };

    const check = this._checkConstraints(recipe, item);
    if (!check.ok) return check;

    // Calculate yields
    const yields = recipe.yields?.[item.rarity];
    if (!yields) return { ok: false, reason: 'No salvage yield for rarity: ' + item.rarity };

    const gained = {};
    for (const [currency, range] of Object.entries(yields)) {
      const amount = Math.floor(range[0] + Math.random() * (range[1] - range[0] + 1));
      if (amount > 0) {
        this._setCurrency(currency, this._getCurrency(currency) + amount);
        gained[currency] = amount;
      }
    }

    // Unequip if equipped
    for (const [slot, id] of Object.entries(State.meta.equipment || {})) {
      if (id === itemId) State.meta.equipment[slot] = null;
    }

    // Destroy item
    Items.removeFromStash(itemId);

    ensureCraftMeta();
    State.meta.craftStats.totalCrafts++;

    return { ok: true, destroyed: item.name, gained };
  },

  // ── Get all available recipes for an item ──
  getAvailableRecipes(itemId) {
    const item = State.meta.stash.find(i => i.id === itemId);
    if (!item) return [];

    const recipes = State.data.crafting?.recipes;
    if (!recipes) return [];

    const available = [];
    for (const [id, recipe] of Object.entries(recipes)) {
      const check = this._checkConstraints(recipe, item);
      const costs = this.calcCost(id, item);
      const affordable = this.canAfford(costs);

      available.push({
        id,
        name: recipe.name,
        icon: recipe.icon,
        description: recipe.description,
        costs,
        affordable,
        eligible: check.ok,
        reason: check.ok ? null : check.reason
      });
    }

    return available;
  },

  // ── Diagnostics ──
  getCraftStats() {
    ensureCraftMeta();
    return { ...State.meta.craftStats };
  }
};

export default Crafting;
