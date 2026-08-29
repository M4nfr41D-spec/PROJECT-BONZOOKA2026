// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// SAVE.js - Persistence Layer
// ============================================================
// Handles saving/loading meta state to LocalStorage

import { State } from './State.js';

const SAVE_KEY = 'bonzookaa_save_v3';
const BACKUP_KEY = 'bonzookaa_backup_v3';
const LEGACY_KEY = 'bonzookaa_save_v2';
const LEGACY_BACKUP = 'bonzookaa_backup_v2';

// Deep clone helper
function cloneState(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export const Save = {
  // Save meta state to LocalStorage
  save() {
    try {
      const saveData = {
        version: 3,
        timestamp: Date.now(),
        meta: cloneState(State.meta),
        settings: cloneState(State.settings || {})
      };
      
      // Create backup of previous save
      const previous = localStorage.getItem(SAVE_KEY);
      if (previous) {
        localStorage.setItem(BACKUP_KEY, previous);
      }
      
      localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
      // console.log('[SAVE] Game saved');
      return true;
    } catch (error) {
      console.error(' Save failed:', error);
      return false;
    }
  },
  
  // Load meta state from LocalStorage
  load() {
    try {
      const data = localStorage.getItem(SAVE_KEY) || localStorage.getItem(LEGACY_KEY);
      if (!data) {
        // console.log(' No save file found, using defaults');
        return false;
      }
      
      const parsed = JSON.parse(data);
      
      // Version migration
      if (parsed.version < 3) {
        // console.log('[SAVE] Migrating save from version', parsed.version, '→ 3');
        this.migrate(parsed);
      }
      
      // Merge loaded data with default state (preserves new properties)
      this.mergeState(parsed.meta);
      
      // ═══ v2.15.0: Restore settings ═══
      if (parsed.settings) {
        Object.assign(State.settings, parsed.settings);
      }
      
      // console.log('[FOLDER] Save loaded from', new Date(parsed.timestamp).toLocaleString());
      return true;
    } catch (error) {
      console.error(' Load failed:', error);
      return this.loadBackup();
    }
  },
  
  // Load backup if main save is corrupted
  loadBackup() {
    try {
      const data = localStorage.getItem(BACKUP_KEY);
      if (!data) return false;
      
      const parsed = JSON.parse(data);
      this.mergeState(parsed.meta);
      // console.log('[FOLDER] Loaded from backup');
      return true;
    } catch (error) {
      console.error(' Backup load also failed:', error);
      return false;
    }
  },
  
  // Merge loaded state with defaults
  mergeState(loaded) {
    // Deep merge: preserves default values for new properties
    const merge = (target, source) => {
      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key]) target[key] = {};
          merge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    };
    
    merge(State.meta, loaded);
  },
  
  // Handle version migration
  migrate(oldSave) {
    const meta = oldSave.meta;
    
    // v1 → v2
    if (oldSave.version === 1) {
      if (!meta.settings) meta.settings = {};
      oldSave.version = 2;
    }
    
    // v2 → v3: BALANCE MIGRATION — clamp inflated item stats from pre-2.12.4
    if (oldSave.version === 2) {
      // ── Stat caps for items (matching v2.12.4 balance) ──
      const STAT_CAPS = {
        fireRate:     15,    // was unlimited → 168
        speed:        80,    // per-item cap (total capped at 600)
        projectiles:  2,     // per-item (total capped at 7)
        piercing:     2,     // per-item (total capped at 5)
        luck:         15,    // per-item (total capped at 50)
        pickupRadius: 60,    // per-item
        critChance:   12,    // per-item
        hpRegen:      5,     // per-item
        shieldRegen:  5      // per-item
      };
      
      const AFFIX_CAPS = {
        fireRate:     3,
        speed:        25,
        projectiles:  1,
        piercing:     1,
        luck:         8,
        critChance:   8,
        critDamage:   40
      };
      
      let clamped = 0;
      
      // Clamp all stash items
      if (Array.isArray(meta.stash)) {
        for (const item of meta.stash) {
          // Clamp base stats
          if (item.stats) {
            for (const [stat, cap] of Object.entries(STAT_CAPS)) {
              if (item.stats[stat] !== undefined && item.stats[stat] > cap) {
                item.stats[stat] = cap;
                clamped++;
              }
            }
          }
          // Clamp affix values
          if (Array.isArray(item.affixes)) {
            for (const affix of item.affixes) {
              const cap = AFFIX_CAPS[affix.stat];
              if (cap !== undefined && affix.value > cap) {
                affix.value = cap;
                clamped++;
              }
            }
          }
          // Re-scale ilvl if absurdly high (items generated at ilvl 100+ with old scaling)
          if (item.ilvl && item.ilvl > 1) {
            // Recalculate damage stats with new ilvl mult: 1 + (ilvl-1)*0.03
            // Old was 1 + (ilvl-1)*0.03 for ALL stats, so damage is fine
            // But rate stats were also ×4 at ilvl 103, now should be ×1.51
            // We already capped individual stats, so this is just a safety net
          }
        }
      }
      
      // ── Add new meta fields for v2.13.0 features ──
      if (!meta.prestige) {
        meta.prestige = {
          level: 0,            // prestige tier (0 = never prestiged)
          totalResets: 0,
          bonuses: {           // permanent bonuses from prestige
            damage: 0,         // +% damage per prestige
            maxHP: 0,          // +% HP per prestige
            luck: 0,           // +flat luck per prestige  
            xpRate: 0,         // +% XP gain per prestige
            startScrap: 0      // starting scrap per prestige
          }
        };
      }
      
      if (!meta.missions) {
        meta.missions = {
          active: [],          // current active missions [{id, type, target, progress, reward}]
          completed: 0,        // total missions completed
          refreshTimer: 0      // when missions were last refreshed
        };
      }
      
      if (!meta.corruption) {
        meta.corruption = 0;   // 0-10 corruption stacks (endgame difficulty)
      }
      
      if (!meta.leaderboard) {
        meta.leaderboard = []; // best 10 runs
      }
      
      if (clamped > 0) {
        console.log(`[SAVE] Migration v2→v3: clamped ${clamped} inflated stat values`);
      }
      
      oldSave.version = 3;
    }
  },
  
  // Delete save (for testing or reset)
  delete() {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(BACKUP_KEY);
    // console.log(' Save deleted');
  },
  
  // Export save as JSON string (for backup)
  export() {
    const data = localStorage.getItem(SAVE_KEY);
    return data || null;
  },
  
  // Import save from JSON string
  import(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.meta) {
        throw new Error('Invalid save format');
      }
      localStorage.setItem(SAVE_KEY, jsonString);
      this.load();
      return true;
    } catch (error) {
      console.error(' Import failed:', error);
      return false;
    }
  }
};

// Auto-save on important events
export function autoSave() {
  Save.save();
}

export default Save;
