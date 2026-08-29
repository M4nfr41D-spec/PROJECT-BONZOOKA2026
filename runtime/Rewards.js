// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// REWARDS.js - Reward Resolution / Economy Bridge
// ============================================================
// Centralizes non-combat reward handling so combat and pickup
// systems stay focused on their own responsibilities.
// ============================================================

import { State } from './State.js';
import { Items } from './Items.js';

export const Rewards = {
  _getUIBridge() {
    if (State.modules?.UI) return State.modules.UI;
    if (typeof window !== 'undefined' && window.UI) return window.UI;
    if (typeof globalThis !== 'undefined' && globalThis.UI) return globalThis.UI;
    return null;
  },

  _safe(label, fn) {
    try {
      return fn?.();
    } catch (e) {
      console.warn(`[REWARDS] ${label} failed`, e);
      return null;
    }
  },

  _getKillContext() {
    const World = State.modules?.World;
    const diffMods = World?.getDiffMods?.() || {
      cellsMult: 1,
      scrapMult: 1,
      xpMult: 1,
      lootRarityBoost: 0
    };
    const directorMods = State.modules?.Director?.getModifiers?.() || {
      xpMult: 1,
      lootDropMult: 1,
      cellBonusChance: 0
    };
    const corruption = State.run.corruption || 0;
    const DepthRulesRef = State.modules?.DepthRules;
    const corruptXPMult = (corruption > 0 && DepthRulesRef)
      ? (DepthRulesRef.getCorruptionMults(corruption).xpMult || 1)
      : 1;

    return { World, diffMods, directorMods, corruption, DepthRulesRef, corruptXPMult };
  },

  applyEnemyKill(killData, context = {}) {
    const cfg = State.data.config || {};
    const { diffMods, directorMods, corruptXPMult } = this._getKillContext();
    const streakXP = context.streakXP || 1;
    const streakLoot = context.streakLoot || 1;

    const xpAmount = Math.floor(
      (killData.xp || 0) *
      (diffMods.xpMult || 1) *
      streakXP *
      corruptXPMult *
      (directorMods.xpMult || 1)
    );
    if (xpAmount > 0) {
      this._safe('Leveling.addXP', () => State.modules?.Leveling?.addXP?.(xpAmount));
    }

    const baseCells = cfg?.economy?.cellsPerKill || 3;
    let cells = baseCells;
    if (killData.isElite) cells *= 3;
    if (killData.isBoss) cells *= 10;
    const cellsAwarded = Math.floor(cells * (diffMods.cellsMult || 1) * streakXP);
    State.run.cells += cellsAwarded;
    if ((directorMods.cellBonusChance || 0) > 0 && Math.random() < directorMods.cellBonusChance) {
      State.run.cells += 1;
    }

    const baseScrap = cfg?.economy?.scrapPerKill || 5;
    let scrap = baseScrap;
    if (killData.isElite) scrap *= (cfg?.economy?.eliteScrapMult || 3);
    if (killData.isBoss) scrap *= (cfg?.economy?.bossScrapMult || 10);
    const scrapAwarded = Math.floor(scrap * (diffMods.scrapMult || 1) * streakXP);
    State.run.scrapEarned += scrapAwarded;

    if (typeof context.rollLoot === 'function') {
      context.rollLoot(diffMods, streakLoot);
      const zoneMods = new Set(State.world?.currentZone?.mods || []);
      if (zoneMods.has('TREASURE') && killData.isElite) {
        context.rollLoot(diffMods, streakLoot);
        context.rollLoot(diffMods, streakLoot);
      }
    }

    this._safe('Missions.onEnemyKill', () => {
      const Missions = State.modules?.Missions;
      if (!Missions) return;
      Missions.onEnemyKill?.(killData);
      if (State.run.streak?.count) Missions.onStreak?.(State.run.streak.count);
      Missions.onScrapEarned?.(scrapAwarded);
    });

    this._safe('Achievements.onEnemyKill', () => {
      const Achievements = State.modules?.Achievements;
      if (!Achievements) return;
      Achievements.onEnemyKill?.(killData);
      Achievements.onScrapEarned?.(scrapAwarded);
    });

    State.pushDebugTrace?.('loot', 'kill_rewards_applied', {
      enemyTier: killData.isBoss ? 'boss' : (killData.isElite ? 'elite' : 'normal'),
      enemyId: killData.id || null,
      xpAwarded: xpAmount,
      cellsAwarded,
      scrapAwarded,
      streakXP: Math.round(streakXP * 100) / 100,
      streakLoot: Math.round(streakLoot * 100) / 100
    });

    return { xpAmount, cellsAwarded, scrapAwarded, diffMods, directorMods, streakXP, streakLoot };
  },

  resolveItemPickup(pickup, hooks = {}) {
    const pickupId = pickup?.debugId || null;
    const stashBefore = State.meta?.stash?.length || 0;
    State.pushDebugTrace?.('loot', 'pickup_collected', {
      pickupId,
      rarity: pickup?.rarity || null,
      rarityFloor: pickup?.rarityFloor || null,
      ilvl: pickup?.ilvl || null,
      smartSlot: pickup?.smartSlot || null,
      stashBefore
    });

    try {
      const item = Items.generateRandom(pickup.rarity, pickup.rarityFloor, pickup.ilvl, {
        fromBoss: pickup.fromBoss,
        bossType: pickup.bossType,
        preferSlot: pickup.smartSlot || null
      });

      if (!item) {
        State.pushDebugTrace?.('loot', 'pickup_generate_null', {
          pickupId,
          rarity: pickup?.rarity || null,
          ilvl: pickup?.ilvl || null,
          stashBefore
        });
        hooks.spawnFloatText?.(pickup.x, pickup.y, 'LOOT NULL', '#ff4455');
        return { ok: false, reason: 'generate_null' };
      }

      State.pushDebugTrace?.('loot', 'pickup_item_ready', {
        pickupId,
        itemId: item.id,
        name: item.name,
        rarity: item.rarity,
        slot: item.slot,
        stashBefore
      });

      const added = Items.addToStash(item);
      if (added) {
        const stashAfter = State.meta.stash.length;
        const present = State.meta.stash.some(i => i?.id === item.id);
        const rarityColor = State.data.rarities?.[item.rarity]?.color || '#ffffff';

        State.pushDebugTrace?.('loot', 'pickup_resolved_to_stash', {
          pickupId,
          itemId: item.id,
          name: item.name,
          rarity: item.rarity,
          slot: item.slot,
          stashBefore,
          stashAfter,
          present
        });

        hooks.spawnCollectEffect?.(pickup.x, pickup.y, rarityColor);
        hooks.spawnFloatText?.(pickup.x, pickup.y, item.name, rarityColor);

        const UI = this._getUIBridge();
        if (UI) {
          try {
            UI.renderStash?.();
            State.pushDebugTrace?.('loot', 'ui_render_stash_ok', {
              pickupId,
              itemId: item.id,
              stashAfter
            });
          } catch (e) {
            State.pushDebugTrace?.('loot', 'ui_render_stash_error', {
              pickupId,
              itemId: item.id,
              message: e?.message || String(e)
            });
          }
          try {
            hooks.showLootComparison?.(item);
          } catch (e) {
            State.pushDebugTrace?.('loot', 'ui_loot_compare_error', {
              pickupId,
              itemId: item.id,
              message: e?.message || String(e)
            });
          }
        } else {
          State.pushDebugTrace?.('loot', 'ui_bridge_missing', {
            pickupId,
            itemId: item.id,
            stashAfter
          });
        }

        this._safe('Audio.pickupItem', () => State.modules?.Audio?.pickupItem?.());
        this._safe('Missions.onLootCollected', () => State.modules?.Missions?.onLootCollected?.());
        this._safe('Achievements.onItemCollected', () => State.modules?.Achievements?.onItemCollected?.(item));
        return { ok: true, mode: 'stash', item };
      }

      const scrapValue = item.value;
      State.run.scrapEarned += scrapValue;
      State.pushDebugTrace?.('loot', 'pickup_fallback_scrap', {
        pickupId,
        itemId: item.id,
        name: item.name,
        rarity: item.rarity,
        slot: item.slot,
        stashBefore,
        stashAfter: State.meta.stash.length,
        scrapValue
      });
      hooks.spawnFloatText?.(pickup.x, pickup.y, `FULL! +${scrapValue}💰`, '#ff8800');
      this._safe('Audio.pickupScrap', () => State.modules?.Audio?.pickupScrap?.());
      return { ok: true, mode: 'scrap_fallback', item, scrapValue };
    } catch (e) {
      console.error('[LOOT] Item pickup resolution failed', e);
      State.pushDebugTrace?.('loot', 'pickup_error', {
        pickupId,
        message: e?.message || String(e),
        stashBefore,
        stashAfter: State.meta.stash.length
      });
      hooks.spawnFloatText?.(pickup.x, pickup.y, 'LOOT ERR', '#ff4455');
      return { ok: false, reason: 'exception', error: e };
    }
  }
};

export default Rewards;
