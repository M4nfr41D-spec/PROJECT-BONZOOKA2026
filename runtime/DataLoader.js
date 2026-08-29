// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// DATALOADER.js - Loads JSON Data Files
// ============================================================
// Fetches all game data from /data/ folder and populates State.data

import { State } from './State.js';
import { EmbeddedData } from './EmbeddedData.js';

const DATA_FILES = [
  'config',
  'rarities',
  'slots',
  'items',
  'affixes',
  'skills',
  'pilotStats',
  'runUpgrades',
  'enemies',
  'acts',
  // v9A0+: optional procedural director data
  'packs',
  // v2.16.0: encounter pacing director
  'director',
  // v2.3.0: ARPG endgame systems
  'crafting',
  'uniques',
  // v2.16.3: ship skins
  'skins',
  // v2.16.3: paragon tree + forge
  'paragonTree',
  'forge',
  'zoneTemplates'
];

export async function loadAllData() {
  // console.log('📦 Loading game data...');
  const isLocalPreview = location.protocol === 'file:' || location.protocol === 'edge:' || String(location.href || '').startsWith('edge://external-file');

  // Load main data files
  const promises = DATA_FILES.map(async (name) => {
    try {
      const response = await fetch(`./data/${name}.json`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      State.data[name] = data;
      return { name, success: true, source: 'fetch' };
    } catch (error) {
      const embedded = EmbeddedData?.[name];
      if (embedded != null) {
        State.data[name] = JSON.parse(JSON.stringify(embedded));
        console.warn(`   ${name}.json fetch failed; using embedded fallback`, error?.message || error);
        return { name, success: true, source: 'embedded-fallback' };
      }
      console.error(`   ${name}.json failed:`, error.message);
      return { name, success: false, error };
    }
  });

  const results = await Promise.all(promises);
  const failed = results.filter(r => !r.success);
  if (failed.length > 0) {
    console.warn(`⚠️ ${failed.length} data files failed to load`);
  }

  if (isLocalPreview) {
    State.runtimeHints = State.runtimeHints || {};
    State.runtimeHints.localPreview = true;
  }

  return failed.length === 0;
}

// Helper to get nested data safely
export function getData(path) {
  const parts = path.split('.');
  let current = State.data;
  
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  
  return current;
}

// Get config value with fallback (supports dotted paths like 'progression.baseXP')
export function getConfig(key, fallback = null) {
  const result = getData('config.' + key);
  return result ?? fallback;
}

// Get all items as flat array
export function getAllItems() {
  const items = State.data.items;
  if (!items) return [];
  
  const result = [];
  for (const category of Object.values(items)) {
    for (const [id, item] of Object.entries(category)) {
      result.push({ id, ...item });
    }
  }
  return result;
}

// Get item by ID
export function getItemData(itemId) {
  const items = State.data.items;
  if (!items) return null;
  
  for (const category of Object.values(items)) {
    if (itemId in category) {
      return { id: itemId, ...category[itemId] };
    }
  }
  return null;
}

// Get random affix for rarity
export function getRandomAffix(rarity, type = 'prefix') {
  const affixes = State.data.affixes?.[type === 'prefix' ? 'prefixes' : 'suffixes'];
  if (!affixes) return null;
  
  const allAffixes = [];
  for (const category of Object.values(affixes)) {
    for (const affix of category) {
      if (affix.tiers.includes(rarity)) {
        allAffixes.push(affix);
      }
    }
  }
  
  if (allAffixes.length === 0) return null;
  return allAffixes[Math.floor(Math.random() * allAffixes.length)];
}

export default { loadAllData, getData, getConfig, getAllItems, getItemData, getRandomAffix };
