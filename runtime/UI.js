// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// UI.js - Desktop UI System
// ============================================================

import { State } from './State.js';
import { Stats } from './Stats.js';
import { Leveling } from './Leveling.js';
import { Items } from './Items.js';
import { Save } from './Save.js';

export const UI = {
  tooltipEl: null,
  // Persist opened skill tree sections across rerenders (prevents accordion reset)
  openTrees: new Set(),

  // ── Slot-type metadata (A48): make item type unambiguous, not icon-guessing ──
  SLOT_META: {
    weapon:    { label: 'WAFFE',     abbr: 'WPN', color: '#ff5a4a' },
    secondary: { label: 'SEK.WAFFE', abbr: 'SEC', color: '#ff9933' },
    engine:    { label: 'ENGINE',    abbr: 'ENG', color: '#4ad6ff' },
    reactor:   { label: 'REAKTOR',   abbr: 'RKT', color: '#a26bff' },
    shield:    { label: 'SCHILD',    abbr: 'SHD', color: '#48e0c0' },
    module:    { label: 'MODUL',     abbr: 'MOD', color: '#82e84f' },
    drone:     { label: 'DROHNE',    abbr: 'DRN', color: '#ffd166' }
  },
  slotMeta(slot) {
    if (!slot) return null;
    const base = String(slot).replace(/[0-9]/g, '');
    return this.SLOT_META[base] || null;
  },
  // Small corner tag for grid/picker cells (cell must be position:relative)
  slotTag(slot) {
    const m = this.slotMeta(slot);
    if (!m) return '';
    return `<span style="position:absolute;top:1px;left:1px;font-size:7px;font-weight:800;`
      + `letter-spacing:.3px;padding:0 2px;border-radius:2px;background:${m.color};color:#0a0a0a;`
      + `line-height:1.5;z-index:3;pointer-events:none;">${m.abbr}</span>`;
  },
  // Full readable label (tooltip)
  slotLabel(slot) {
    const m = this.slotMeta(slot);
    return m ? m.label : (slot || '');
  },

  init() {
    this.tooltipEl = document.getElementById('tooltip');
    
    // Initial render
    this.renderAll();
  },
  
  renderAll() {
    this.renderEquipment();
    this.renderStash();
    this.renderShipStats();
    this.renderPilotStats();
    this.renderSkillTrees();
  },
  
  // ========== EQUIPMENT PANEL ==========
  
  // Map slot IDs to equipment sprite paths
  _slotSprite(slotId) {
    const map = {
      weapon: 'assets/sprites/equipment/equip_weapon/idle.png',
      secondary: 'assets/sprites/equipment/equip_secondary/idle.png',
      shield: 'assets/sprites/equipment/equip_shield/idle.png',
      engine: 'assets/sprites/equipment/equip_engine/idle.png',
      reactor: 'assets/sprites/equipment/equip_reactor/idle.png',
      module1: 'assets/sprites/equipment/equip_module/idle.png',
      module2: 'assets/sprites/equipment/equip_module/idle.png',
      module3: 'assets/sprites/equipment/equip_module/idle.png',
      drone: 'assets/sprites/equipment/equip_drone/idle.png',
    };
    return map[slotId] || '';
  },
  
  // Map item slot to sprite (for stash/tooltip)
  _itemSprite(item) {
    if (!item || !item.slot) return '';
    const slotBase = item.slot.replace(/[0-9]/g, '');
    const map = {
      weapon: 'equip_weapon', secondary: 'equip_secondary',
      shield: 'equip_shield', engine: 'equip_engine',
      reactor: 'equip_reactor', module: 'equip_module',
      drone: 'equip_drone',
    };
    const key = map[slotBase];
    return key ? `assets/sprites/equipment/${key}/idle.png` : '';
  },

  renderEquipment() {
    const container = document.getElementById('equipmentGrid');
    if (!container) return;
    
    const slots = State.data.slots;
    const equipment = State.meta.equipment;
    const stash = State.meta.stash;
    const rarities = State.data.rarities;
    
    let html = '';
    
    for (const [slotId, slotDef] of Object.entries(slots || {})) {
      const equippedId = equipment[slotId];
      const item = equippedId ? stash.find(i => i.id === equippedId) : null;
      const rarityColor = item ? (rarities[item.rarity]?.color || '#666') : '#333';
      // Use emoji icons directly instead of attempting sprite loading
      const iconHtml = item ? item.icon : slotDef.icon;
      
      html += `
        <div class="equip-slot ${item ? 'filled' : ''}" 
             style="--rarity-color: ${rarityColor}"
             onclick="UI.onEquipSlotClick('${slotId}')"
             onmouseenter="UI.showSlotTooltip(event, '${slotId}')"
             onmouseleave="UI.hideTooltip()">
          <div class="slot-icon">${iconHtml}</div>
          <div class="slot-info">
            <div class="slot-type">${slotDef.name}</div>
            ${item 
              ? `<div class="slot-item" style="color:${rarityColor}">${item.name}</div>
                 <div style="font-size:8px;color:#00ccff;margin-top:1px;">⚡${State.modules?.Items?.getPowerScore?.(item) || ''}</div>`
              : `<div class="slot-empty">Empty</div>`
            }
          </div>
        </div>
      `;
    }
    
    container.innerHTML = html;
  },
  
  // ========== STASH PANEL ==========
  renderStash() {
    const container = document.getElementById('stashGrid');
    if (!container) return;
    
    const stash = State.meta.stash;
    const equipment = State.meta.equipment;
    const rarities = State.data.rarities;
    const maxSlots = State.data.config?.stash?.baseSlots || 40;
    const equippedIds = new Set(Object.values(equipment).filter(Boolean));
    
    let html = '';
    
    // Items - HIDE equipped items (they show in equipment grid)
    let visibleCount = 0;
    for (const item of stash) {
      if (equippedIds.has(item.id)) continue; // Skip equipped items
      visibleCount++;
      const rarityColor = rarities[item.rarity]?.color || '#666';
      
      // Show emoji icon directly, skip sprite loading to avoid freeze on missing images
      const iconHtml = item.icon;
      
      const badges = [];
      if ((item.sockets || 0) > 0) badges.push(`<span class="slot-badge socket">◌${item.sockets}</span>`);
      if (item.socket) badges.push(`<span class="slot-badge gem">${(item.socket || '').slice(0, 2)}</span>`);
      if (item.corrupted) badges.push(`<span class="slot-badge corrupt">☠</span>`);
      if (item.forgeStats && Object.keys(item.forgeStats).length > 0) badges.push(`<span class="slot-badge forge">✦</span>`);
      html += `
        <div class="stash-slot filled"
             style="--rarity-color: ${rarityColor}; position:relative;"
             onclick="UI.onStashItemClick('${item.id}', event)"
             oncontextmenu="UI.sellItem(event, '${item.id}')"
             onmouseenter="UI.showItemTooltip(event, '${item.id}')"
             onmouseleave="UI.hideTooltip()">
          ${iconHtml}
          ${this.slotTag(item.slot)}
          ${badges.length ? `<div class="slot-badge-stack">${badges.join('')}</div>` : ''}
        </div>
      `;
    }
    
    // Empty slots (based on non-equipped items)
    const freeSlots = Math.max(0, maxSlots - stash.length);
    const emptyCount = Math.min(freeSlots, 20);
    for (let i = 0; i < emptyCount; i++) {
      html += `<div class="stash-slot"></div>`;
    }
    
    container.innerHTML = html;
  },
  
  // ========== SHIP STATS ==========
  renderShipStats() {
    const container = document.getElementById('shipStats');
    if (!container) return;
    
    const p = State.player;
    
    const stats = [
      { name: 'HP', value: Math.round(p.maxHP) },
      { name: 'Shield', value: Math.round(p.maxShield) },
      { name: 'Damage', value: p.damage.toFixed(1) },
      { name: 'Fire Rate', value: p.fireRate.toFixed(1) + '/s' },
      { name: 'Crit %', value: p.critChance.toFixed(0) + '%' },
      { name: 'Crit Dmg', value: p.critDamage + '%' },
      { name: 'Speed', value: Math.round(p.speed) },
      { name: 'Projectiles', value: p.projectiles },
      { name: 'Pierce', value: p.piercing },
      { name: 'Luck', value: p.luck },
      { name: 'DPS', value: Stats.getDPS(), highlight: true }
    ];
    
    // Extended stats (only show if > 0)
    const extended = [
      { name: '🔥 Fire', value: p.fireDamage, color: '#ff6633' },
      { name: '❄️ Cold', value: p.coldDamage, color: '#66ccff' },
      { name: '⚡ Lightning', value: p.lightningDamage, color: '#ffee33' },
      { name: 'Lifesteal', value: p.lifesteal },
      { name: 'Dodge %', value: p.dodgeChance },
      { name: 'DR', value: p.damageReduction },
    ];
    for (const s of extended) {
      if (s.value && s.value > 0) stats.push(s);
    }
    
    let html = '';
    for (const stat of stats) {
      html += `
        <div class="stat-item ${stat.highlight ? 'highlight' : ''}">
          <span>${stat.name}</span>
          <span class="stat-value">${stat.value}</span>
        </div>
      `;
    }
    
    container.innerHTML = html;
    
    // ═══ v2.16.3: Active Synergy Tags ═══
    const syn = State.computed?.synergies;
    if (syn?.active?.length > 0) {
      let synHtml = '<div style="margin-top:6px;padding-top:6px;border-top:1px solid #223;">';
      synHtml += '<div style="font-size:9px;color:#00ccff;font-weight:bold;margin-bottom:4px;">⚡ SYNERGIES</div>';
      for (const s of syn.active) {
        synHtml += `<div style="font-size:9px;color:#88ccff;margin-bottom:2px;">`;
        synHtml += `<span style="color:#00ffcc;">${s.tag}</span> ×${s.count}`;
        synHtml += `</div>`;
      }
      const bonusEntries = Object.entries(syn.bonuses || {}).filter(([, v]) => v !== 0);
      if (bonusEntries.length > 0) {
        synHtml += '<div style="font-size:8px;color:#556;margin-top:2px;">';
        synHtml += bonusEntries.map(([k, v]) => {
          const color = v > 0 ? '#00ff88' : '#ff4455';
          return `<span style="color:${color}">${v > 0 ? '+' : ''}${v} ${this.formatStatName(k)}</span>`;
        }).join(' · ');
        synHtml += '</div>';
      }
      synHtml += '</div>';
      container.innerHTML += synHtml;
    }
    
    // ═══ v2.16.3: Active Set Bonuses ═══
    const sets = State.computed?.setBonuses;
    if (sets?.sets?.length > 0) {
      let setHtml = '<div style="margin-top:6px;padding-top:6px;border-top:1px solid #223;">';
      setHtml += '<div style="font-size:9px;color:#ff8800;font-weight:bold;margin-bottom:4px;">🔮 SET BONUSES</div>';
      for (const s of sets.sets) {
        setHtml += `<div style="font-size:9px;margin-bottom:3px;">`;
        setHtml += `<span style="color:#ff8800;">${s.icon} ${s.name}</span> <span style="color:#666;">(${s.count}/${s.threshold})</span>`;
        setHtml += `<div style="font-size:8px;color:#ffcc66;margin-left:12px;">${s.label}: ${s.description}</div>`;
        setHtml += `</div>`;
      }
      setHtml += '</div>';
      container.innerHTML += setHtml;
    }
  },
  
  // ========== PARAGON TREE (replaces flat pilotStats) ==========
  renderPilotStats() {
    const container = document.getElementById('pilotStats');
    const pointsEl = document.getElementById('statPointsNum');
    if (!container) return;
    
    const paragon = State.data.paragonTree;
    const points = State.meta.statPoints || 0;
    if (pointsEl) pointsEl.textContent = points;

    if (!paragon?.branches) {
      container.innerHTML = '<div style="color:#666;font-size:11px;">No paragon data</div>';
      return;
    }

    if (!State.meta.paragon) State.meta.paragon = { unlocked: {}, choicesMade: {} };
    const unlocked = State.meta.paragon.unlocked;
    const totalUnlocked = Object.keys(unlocked).length;
    const maxNodes = paragon.maxTotalUnlocks || 25;

    // Detect if we're in the full modal (4-col) or sidebar (stacked)
    const isWide = container.classList.contains('paragon-modal-grid') || container.closest('.combat-modal-body');
    
    let html = '';
    if (!isWide) {
      html += `<div style="font-size:10px;color:#888;margin-bottom:8px;">Nodes: <span style="color:#00ffcc;">${totalUnlocked}</span>/${maxNodes} · Must specialize!</div>`;
    }
    
    for (const [branchId, branch] of Object.entries(paragon.branches)) {
      const branchNodes = branch.nodes;
      const unlockedCount = branchNodes.filter(n => unlocked[n.id]).length;
      
      html += `<div class="paragon-branch" style="border-color:${branch.color}20;">`;
      html += `<div class="paragon-branch-title" style="color:${branch.color};">${branch.icon} ${branch.name} <span style="font-size:10px;color:#666;font-weight:normal;">${unlockedCount}/${branchNodes.length}</span></div>`;
      
      for (const node of branchNodes) {
        const isUnlocked = !!unlocked[node.id];
        const canUnlock = this._canUnlockParagonNode(node, unlocked, points);
        const isChoice = node.type === 'choice';
        const choiceBlocked = isChoice && State.meta.paragon.choicesMade[node.group] && State.meta.paragon.choicesMade[node.group] !== node.id;
        
        const effectStr = Object.entries(node.effect || {})
          .map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${this.formatStatName(k)}`).join(', ');
        
        const bg = isUnlocked ? `${branch.color}18` : canUnlock && !choiceBlocked ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.15)';
        const border = isUnlocked ? branch.color + '50' : canUnlock && !choiceBlocked ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)';
        const opacity = choiceBlocked ? '0.25' : '1';
        const badgeIcon = isUnlocked ? '✓' : node.type === 'capstone' ? '★' : isChoice ? '◆' : `T${node.tier}`;
        const badgeBg = isUnlocked ? branch.color + '30' : 'rgba(255,255,255,0.05)';
        const badgeColor = isUnlocked ? branch.color : '#555';
        const canClick = canUnlock && !isUnlocked && !choiceBlocked;
        
        html += `<div class="paragon-node ${canClick ? 'can-unlock' : ''}" 
          style="background:${bg};border:1px solid ${border};opacity:${opacity};"
          ${canClick ? `onclick="UI.unlockParagonNode('${node.id}')"` : ''}
          title="${node.description}">`;
        html += `<div class="node-badge" style="background:${badgeBg};color:${badgeColor};">${badgeIcon}</div>`;
        html += `<div class="node-info">`;
        html += `<div class="node-name" style="color:${isUnlocked ? '#fff' : '#999'};">${node.name}</div>`;
        html += `<div class="node-desc">${isUnlocked ? effectStr : node.description}</div>`;
        html += `</div>`;
        html += `<div class="node-cost" style="color:${canClick ? '#00ffcc' : isUnlocked ? branch.color : '#444'};">${isUnlocked ? '✓' : node.cost + 'pt'}</div>`;
        html += `</div>`;
      }
      
      html += `</div>`;
    }
    
    container.innerHTML = html;
  },

  _canUnlockParagonNode(node, unlocked, points) {
    if (unlocked[node.id]) return false;
    if (points < node.cost) return false;
    // Node cap: can't unlock everything, must specialize
    const paragon = State.data.paragonTree;
    const maxNodes = paragon?.maxTotalUnlocks || 25;
    const currentCount = Object.keys(unlocked).length;
    if (currentCount >= maxNodes) return false;
    // Requirement check
    if (!node.requires || node.requires.length === 0) return true;
    for (const req of node.requires) {
      if (req.includes('|')) {
        const alts = req.split('|');
        if (!alts.some(a => unlocked[a])) return false;
      } else {
        if (!unlocked[req]) return false;
      }
    }
    return true;
  },

  unlockParagonNode(nodeId) {
    const paragon = State.data.paragonTree;
    if (!paragon?.branches) return;
    if (!State.meta.paragon) State.meta.paragon = { unlocked: {}, choicesMade: {} };
    const unlocked = State.meta.paragon.unlocked;
    const points = State.meta.statPoints || 0;

    // Find node
    let targetNode = null, branchId = null;
    for (const [bid, branch] of Object.entries(paragon.branches)) {
      for (const node of branch.nodes) {
        if (node.id === nodeId) { targetNode = node; branchId = bid; break; }
      }
      if (targetNode) break;
    }
    if (!targetNode) return;

    // Check requirements
    if (!this._canUnlockParagonNode(targetNode, unlocked, points)) return;

    // Choice group: block others in same group
    if (targetNode.type === 'choice' && targetNode.group) {
      if (State.meta.paragon.choicesMade[targetNode.group]) return; // already chose
      State.meta.paragon.choicesMade[targetNode.group] = nodeId;
    }

    // Unlock
    unlocked[nodeId] = true;
    State.meta.statPoints -= targetNode.cost;

    // Recalculate + save + render
    Stats.calculate();
    Save.save();
    this.renderAll();

    // Audio feedback
    const Audio = State.modules?.Audio;
    if (Audio?.levelUp) Audio.levelUp();
  },

  _hexToRgb(hex) {
    const h = hex.replace('#', '');
    return `${parseInt(h.substr(0, 2), 16)},${parseInt(h.substr(2, 2), 16)},${parseInt(h.substr(4, 2), 16)}`;
  },
  
  // ========== SKILL TREES ==========
  renderSkillTrees() {
    const container = document.getElementById('skillTrees');
    const pointsEl = document.getElementById('skillPointsNum');
    if (!container) return;
    
    const trees = State.data.skills;
    const learned = State.meta.skills;
    const points = State.meta.skillPoints;
    
    if (pointsEl) pointsEl.textContent = points;
    
    let html = '';
    
    for (const [treeId, tree] of Object.entries(trees || {})) {
      const totalInTree = Object.values(learned[treeId] || {}).reduce((a, b) => a + b, 0);
      
      html += `
        <div class="skill-tree-section ${this.openTrees.has(treeId) ? 'open' : ''}" id="tree-${treeId}">
          <div class="skill-tree-header" style="--tree-color: ${tree.color}" onclick="UI.toggleTree('${treeId}')">
            <span class="tree-icon">${tree.icon}</span>
            <span class="tree-name">${tree.name}</span>
            <span class="tree-pts">${totalInTree} pts</span>
          </div>
          <div class="skill-tree-body">
      `;
      
      for (const [skillId, skill] of Object.entries(tree.skills)) {
        const currentRank = learned[treeId]?.[skillId] || 0;
        const canLearn = Leveling.canLearnSkill(treeId, skillId);
        const maxed = currentRank >= skill.maxRank;
        
        html += `
          <div class="skill-node ${currentRank > 0 ? 'learned' : ''} ${canLearn && !maxed ? 'available' : ''}"
               onmousedown="UI.startHold('skill','${treeId}','${skillId}')"
               onmouseup="UI.stopHold()"
               onmouseleave="UI.stopHold()"
               ontouchstart="UI.startHold('skill','${treeId}','${skillId}')"
               ontouchend="UI.stopHold()">
            <span class="skill-icon">${skill.icon}</span>
            <div class="skill-info">
              <div class="skill-name">${skill.name}</div>
              <div class="skill-desc">${skill.description}</div>
            </div>
            <span class="skill-rank">${currentRank}/${skill.maxRank}</span>
          </div>
        `;
      }
      
      html += `</div></div>`;
    }
    
    container.innerHTML = html;
  },
  
  toggleTree(treeId) {
    const section = document.getElementById(`tree-${treeId}`);
    // Update DOM + persisted state so the tree stays open after rerenders.
    if (section) section.classList.toggle('open');
    if (this.openTrees.has(treeId)) this.openTrees.delete(treeId);
    else this.openTrees.add(treeId);
  },
  
  // ========== VENDOR ==========
  renderVendor() {
    const container = document.getElementById('vendorGrid');
    const cellsEl = document.getElementById('vendorCells');
    const detailEl = document.getElementById('vendorDetail');
    if (!container) return;
    
    const forge = State.data.forge;
    if (!forge?.recipes) {
      container.innerHTML = '<div style="color:#666;font-size:11px;padding:12px;">Forge data not loaded</div>';
      return;
    }

    // Show currencies
    if (cellsEl) {
      cellsEl.innerHTML = `⚙️${State.meta.scrap || 0} · ⚡${State.run?.cells || 0} · 💠${State.meta.voidShards || 0} · ✨${State.meta.cosmicDust || 0}`;
    }

    // Group by category
    const cats = forge.categories || {};
    const grouped = {};
    for (const [recipeId, recipe] of Object.entries(forge.recipes)) {
      const cat = recipe.category || 'misc';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push({ id: recipeId, ...recipe });
    }

    let html = '';
    for (const [catId, catDef] of Object.entries(cats)) {
      const recipes = grouped[catId];
      if (!recipes?.length) continue;
      
      html += `<div style="margin-bottom:8px;">`;
      html += `<div style="font-size:10px;color:${catDef.color};font-weight:bold;letter-spacing:1px;margin-bottom:4px;">${catDef.icon} ${catDef.name}</div>`;
      
      for (const r of recipes) {
        const costStr = Object.entries(r.costs || {})
          .map(([k, v]) => {
            const icons = { scrap: '⚙️', cells: '⚡', voidShard: '💠', cosmicDust: '✨', legendaryItems: '🏆' };
            return `${v}${icons[k] || k}`;
          }).join(' ');
        
        const canAfford = this._canAffordForge(r.costs);
        
        html += `<div class="vendor-card ${canAfford ? '' : 'maxed'}" 
                      data-recipe="${r.id}"
                      onclick="UI.selectForgeRecipe('${r.id}')"
                      style="cursor:pointer;padding:6px;margin-bottom:3px;background:rgba(255,255,255,${canAfford ? '0.04' : '0.01'});border:1px solid ${canAfford ? catDef.color + '40' : 'rgba(255,255,255,0.06)'};border-radius:4px;">`;
        html += `<div style="display:flex;align-items:center;gap:6px;">`;
        html += `<span style="font-size:16px;">${r.icon}</span>`;
        html += `<div style="flex:1;">`;
        html += `<div style="font-size:10px;color:${canAfford ? '#fff' : '#666'};">${r.name}</div>`;
        html += `<div style="font-size:8px;color:#888;">${costStr}</div>`;
        html += `</div>`;
        html += `</div></div>`;
      }
      html += `</div>`;
    }
    
    container.innerHTML = html;
    
    if (detailEl) {
      detailEl.innerHTML = `<div class="vendor-detail-empty">
        <div style="font-size:28px;opacity:0.2;margin-bottom:8px;">🔨</div>
        <div>Select a recipe</div>
        <div style="font-size:9px;margin-top:2px;">to see details</div>
      </div>`;
    }
  },

  _canAffordForge(costs) {
    if (!costs) return true;
    const m = State.meta;
    if (costs.scrap && (m.scrap || 0) < costs.scrap) return false;
    if (costs.cells && (m.cells || 0) < costs.cells) return false;   // A58 FIX: meta, not run
    if (costs.voidShard && (m.voidShards || 0) < costs.voidShard) return false;
    if (costs.cosmicDust && (m.cosmicDust || 0) < costs.cosmicDust) return false;
    if (costs.legendaryItems && this._legendaryCount() < costs.legendaryItems) return false; // A58
    return true;
  },

  // A58: number of unequipped legendaries in stash (forge "legendaryItems" material)
  _legendaryCount() {
    const m = State.meta;
    const equipped = new Set(Object.values(m.equipment || {}));
    return (m.stash || []).filter(i => i && i.rarity === 'legendary' && !equipped.has(i.id)).length;
  },

  selectForgeRecipe(recipeId) {
    const detailEl = document.getElementById('vendorDetail');
    if (!detailEl) return;
    
    const forge = State.data.forge;
    const recipe = forge?.recipes?.[recipeId];
    if (!recipe) return;
    
    this._forgeRecipeId = recipeId;
    this._forgeTargetItem = null;
    
    const canAfford = this._canAffordForge(recipe.costs);
    const catDef = forge.categories?.[recipe.category] || {};
    
    const costLines = Object.entries(recipe.costs || {})
      .map(([k, v]) => {
        const icons = { scrap: '⚙️', cells: '⚡', voidShard: '💠 Void Shard', cosmicDust: '✨ Cosmic Dust', legendaryItems: '🏆 Legendary' };
        const has = k === 'scrap' ? State.meta.scrap : k === 'cells' ? State.meta.cells : k === 'voidShard' ? State.meta.voidShards : k === 'cosmicDust' ? State.meta.cosmicDust : k === 'legendaryItems' ? this._legendaryCount() : 0;
        const color = (has || 0) >= v ? '#00ff88' : '#ff4455';
        return `<div style="color:${color};font-size:10px;">${icons[k] || k}: ${v} (have: ${has || 0})</div>`;
      }).join('');
    
    // Result description
    let resultStr = recipe.description;
    if (recipe.result && typeof recipe.result === 'object' && recipe.result.stats) {
      resultStr += '<div style="margin-top:4px;color:#00ccff;font-size:9px;">';
      for (const [s, v] of Object.entries(recipe.result.stats)) {
        resultStr += `+${v} ${this.formatStatName(s)} · `;
      }
      resultStr = resultStr.slice(0, -3) + '</div>';
    }
    
    // Find eligible items from stash
    const eligible = this._getForgeEligibleItems(recipe);
    let itemPickerHtml = '';
    if (eligible.length > 0) {
      itemPickerHtml = `<div style="margin:8px 0;"><div style="font-size:9px;color:#888;margin-bottom:4px;">SELECT TARGET ITEM:</div>`;
      itemPickerHtml += `<div style="max-height:150px;overflow-y:auto;">`;
      for (const it of eligible) {
        const rc = State.data.rarities?.[it.rarity]?.color || '#fff';
        itemPickerHtml += `<div onclick="UI.selectForgeTarget('${it.id}')" 
          style="padding:4px 6px;margin-bottom:2px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:3px;cursor:pointer;display:flex;align-items:center;gap:6px;font-size:10px;"
          data-forge-item="${it.id}"
          onmouseover="this.style.borderColor='${rc}40'" onmouseout="this.style.borderColor='rgba(255,255,255,0.08)'">
          <span style="font-size:14px;">${it.icon || '📦'}</span>
          <div style="flex:1;">
            <div style="color:${rc};">${it.name}</div>
            <div style="font-size:8px;color:#666;">${it.slot}${it.weaponType ? ' • ' + it.weaponType : ''} · ilvl ${it.ilvl}</div>
          </div>
        </div>`;
      }
      itemPickerHtml += `</div></div>`;
    } else if (recipe.constraints && Object.keys(recipe.constraints).length > 0) {
      itemPickerHtml = `<div style="font-size:10px;color:#ff4455;margin:8px 0;padding:6px;background:rgba(255,0,0,0.05);border-radius:4px;">No eligible items in stash</div>`;
    }
    // Some recipes don't need items (like fuse_upgrade which consumes legendaries)
    const needsItem = recipe.constraints?.slotType || recipe.constraints?.requiresSocket || recipe.constraints?.minRarity || recipe.constraints?.isCorrupted || recipe.constraints?.isUnique || recipe.constraints?.notCorrupted;
    
    detailEl.innerHTML = `
      <div style="padding:8px;">
        <div style="font-size:14px;margin-bottom:4px;">${recipe.icon} <span style="color:${catDef.color || '#fff'}">${recipe.name}</span></div>
        <div style="font-size:10px;color:#aaa;margin-bottom:8px;">${resultStr}</div>
        <div style="margin-bottom:8px;padding:6px;background:rgba(0,0,0,0.3);border-radius:4px;">
          <div style="font-size:9px;color:#888;margin-bottom:3px;">COST:</div>
          ${costLines}
        </div>
        ${needsItem ? itemPickerHtml : ''}
        <div id="forgeTargetDisplay" style="display:none;margin-bottom:6px;padding:6px;background:rgba(0,255,200,0.05);border:1px solid rgba(0,255,200,0.2);border-radius:4px;">
          <div style="font-size:9px;color:#00ffcc;">TARGET:</div>
          <div id="forgeTargetName" style="font-size:11px;color:#fff;"></div>
        </div>
        <button id="forgeBtn" onclick="UI.executeForgeRecipe('${recipeId}')"
                style="width:100%;padding:8px;background:#333;color:#666;border:none;border-radius:4px;font-weight:bold;font-size:11px;cursor:default;margin-top:6px;"
                disabled>
          ${needsItem ? 'SELECT AN ITEM FIRST' : (canAfford ? 'FORGE' : 'INSUFFICIENT MATERIALS')}
        </button>
      </div>
    `;
    
    // If recipe doesn't need an item target, enable button directly
    if (!needsItem && canAfford) {
      const btn = document.getElementById('forgeBtn');
      if (btn) { btn.disabled = false; btn.style.background = catDef.color || '#00ccff'; btn.style.color = '#000'; btn.style.cursor = 'pointer'; btn.textContent = 'FORGE'; }
    }
  },

  selectForgeTarget(itemId) {
    const item = State.meta.stash.find(i => i.id === itemId);
    if (!item) return;
    this._forgeTargetItem = itemId;
    
    const rc = State.data.rarities?.[item.rarity]?.color || '#fff';
    
    // Highlight selected item
    document.querySelectorAll('[data-forge-item]').forEach(el => {
      el.style.borderColor = el.dataset.forgeItem === itemId ? rc : 'rgba(255,255,255,0.08)';
      el.style.background = el.dataset.forgeItem === itemId ? 'rgba(0,255,200,0.06)' : 'rgba(255,255,255,0.03)';
    });
    
    // Show target display
    const display = document.getElementById('forgeTargetDisplay');
    const nameEl = document.getElementById('forgeTargetName');
    if (display) display.style.display = 'block';
    if (nameEl) {
      const socketLabel = (item.sockets || 0) > 0
        ? (item.socket ? `Socket: ${item.socket}` : `Socket: empty (${item.sockets})`)
        : 'Socket: none';
      nameEl.innerHTML = `<span style="color:${rc}">${item.name}</span> (${item.slot})<div style="font-size:9px;color:#88e6ff;margin-top:2px;">${socketLabel}</div>`;
    }
    
    // Enable forge button
    const btn = document.getElementById('forgeBtn');
    const forge = State.data.forge;
    const recipe = forge?.recipes?.[this._forgeRecipeId];
    const catDef = forge?.categories?.[recipe?.category] || {};
    const canAfford = this._canAffordForge(recipe?.costs);
    if (btn && canAfford) {
      btn.disabled = false;
      btn.style.background = catDef.color || '#00ccff';
      btn.style.color = '#000';
      btn.style.cursor = 'pointer';
      btn.textContent = 'FORGE';
    }
  },

  _getForgeEligibleItems(recipe) {
    const stash = State.meta.stash || [];
    const c = recipe.constraints || {};
    const RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
    
    return stash.filter(item => {
      if (c.slotType && item.slot !== c.slotType) return false;
      if (c.minRarity && (RANK[item.rarity] ?? 0) < (RANK[c.minRarity] ?? 0)) return false;
      if (c.isUnique && !item.isUnique) return false;
      if (c.notUnique === true && item.isUnique) return false;
      if (c.isCorrupted && !item.corrupted) return false;
      if (c.notCorrupted && item.corrupted) return false;
      if (c.requiresSocket && (item.sockets || 0) <= 0) return false;
      if (c.requiresSocket && item.socket) return false;
      if (c.maxSockets != null && (item.sockets || 0) >= c.maxSockets) return false;
      return true;
    });
  },

  executeForgeRecipe(recipeId) {
    const forge = State.data.forge;
    const recipe = forge?.recipes?.[recipeId];
    if (!recipe || !this._canAffordForge(recipe.costs)) return;
    
    // Check if recipe needs an item target
    const needsItem = recipe.constraints?.slotType || recipe.constraints?.requiresSocket || recipe.constraints?.minRarity || recipe.constraints?.isCorrupted || recipe.constraints?.isUnique || recipe.constraints?.notCorrupted;
    
    let targetItem = null;
    if (needsItem) {
      targetItem = State.meta.stash.find(i => i.id === this._forgeTargetItem);
      if (!targetItem) return;
    }

    // Deduct costs
    const m = State.meta;
    if (recipe.costs.scrap) m.scrap -= recipe.costs.scrap;
    if (recipe.costs.cells) m.cells = (m.cells || 0) - recipe.costs.cells;   // A58 FIX: meta, not run
    if (recipe.costs.voidShard) m.voidShards = (m.voidShards || 0) - recipe.costs.voidShard;
    if (recipe.costs.cosmicDust) m.cosmicDust = (m.cosmicDust || 0) - recipe.costs.cosmicDust;
    if (recipe.costs.legendaryItems) { // A58: consume actual legendaries
      const equipped = new Set(Object.values(m.equipment || {}));
      let removed = 0;
      for (let i = m.stash.length - 1; i >= 0 && removed < recipe.costs.legendaryItems; i--) {
        const it = m.stash[i];
        if (it && it.rarity === 'legendary' && !equipped.has(it.id) && it.id !== this._forgeTargetItem) {
          m.stash.splice(i, 1); removed++;
        }
      }
    }

    // Execute recipe result
    let resultMsg = '';
    const result = recipe.result;
    
    if (result === 'addSocket' && targetItem) {
      targetItem.sockets = (targetItem.sockets || 0) + 1;
      if (!Object.prototype.hasOwnProperty.call(targetItem, 'socket')) targetItem.socket = null;
      resultMsg = `💎 Socket added to ${targetItem.name}!`;
    } else if (typeof result === 'object' && result.stats && targetItem) {
      if ((targetItem.sockets || 0) <= 0) {
        this.showToast('No empty socket available on target item.', '#ff4455');
        return;
      }
      if (targetItem.socket) {
        this.showToast('Target socket is already occupied.', '#ff4455');
        return;
      }
      // Core insertion: add stats to item
      if (!targetItem.forgeStats) targetItem.forgeStats = {};
      for (const [stat, val] of Object.entries(result.stats)) {
        targetItem.forgeStats[stat] = (targetItem.forgeStats[stat] || 0) + val;
        targetItem.stats[stat] = (targetItem.stats[stat] || 0) + val;
      }
      targetItem.socket = recipe.icon + ' ' + recipe.name;
      resultMsg = `${recipe.icon} ${recipe.name} inserted into ${targetItem.name}!`;
    } else if (result === 'corrupt' && targetItem) {
      const pool = recipe.corruptPool;
      const isPositive = Math.random() < (pool?.positiveChance || 0.65);
      const outcomes = isPositive ? pool.positive : pool.negative;
      const totalWeight = outcomes.reduce((s, o) => s + (o.weight || 1), 0);
      let roll = Math.random() * totalWeight;
      let picked = outcomes[0];
      for (const o of outcomes) { roll -= (o.weight || 1); if (roll <= 0) { picked = o; break; } }
      
      if (picked.label === 'BRICK — item destroyed') {
        const idx = State.meta.stash.findIndex(i => i.id === targetItem.id);
        if (idx >= 0) State.meta.stash.splice(idx, 1);
        resultMsg = `☠️ CORRUPTION FAILED! ${targetItem.name} was destroyed!`;
      } else {
        targetItem.corrupted = true;
        targetItem.corruptionLabel = picked.label;
        for (const [stat, val] of Object.entries(picked.effect || {})) {
          targetItem.stats[stat] = (targetItem.stats[stat] || 0) + val;
        }
        resultMsg = isPositive ? `✨ ${targetItem.name} gained: ${picked.label}` : `☠️ ${targetItem.name} corrupted: ${picked.label}`;
      }
    } else if (result === 'purify' && targetItem) {
      // Remove corruption stats
      targetItem.corrupted = false;
      targetItem.corruptionLabel = null;
      resultMsg = `✨ ${targetItem.name} purified!`;
    } else if (result === 'reforgeUnique' && targetItem) {
      // Reroll fixed stats ±20%
      for (const [stat, val] of Object.entries(targetItem.stats || {})) {
        const variance = val * 0.2;
        targetItem.stats[stat] = Math.round((val - variance + Math.random() * variance * 2) * 10) / 10;
      }
      resultMsg = `🔨 ${targetItem.name} reforged!`;
    } else if (result === 'mythicShard') {
      // Consume 3 legendaries (TODO: item picker for multiple items)
      m.mythicShards = (m.mythicShards || 0) + 1;
      resultMsg = `🌟 Mythic Shard created! (${m.mythicShards} total)`;
    } else {
      resultMsg = `🔨 ${recipe.name} complete!`;
    }

    const Audio = State.modules?.Audio;
    if (Audio?.craftSuccess) Audio.craftSuccess();
    
    if (State.ui) State.ui.announcement = { text: resultMsg, timer: 3.5 };
    
    // Recalculate stats if item was modified
    Stats.calculate();
    Save.save();
    this.renderEquipment();
    this.renderStash();
    this.renderShipStats();

    this._forgeTargetItem = null;
    this.renderVendor();
    this.selectForgeRecipe(recipeId); // refresh detail panel
  },

  // ========== TOOLTIPS ==========
  showItemTooltip(event, itemId) {
    const item = State.meta.stash.find(i => i.id === itemId);
    if (!item) return;
    
    const rarities = State.data.rarities;
    const rarityData = rarities?.[item.rarity];
    const isEquipped = Object.values(State.meta.equipment).includes(itemId);
    
    // Sprite icon for tooltip
    const spritePath = this._itemSprite(item);
    const iconHtml = spritePath
      ? `<img src="${spritePath}" style="width:36px;height:36px;object-fit:contain;vertical-align:middle">`
      : item.icon;
    
    let statsHtml = '';
    for (const [stat, value] of Object.entries(item.stats || {})) {
      statsHtml += `<div class="tooltip-stat">+${value} ${this.formatStatName(stat)}</div>`;
    }
    for (const affix of item.affixes || []) {
      statsHtml += `<div class="tooltip-stat affix">+${affix.value} ${this.formatStatName(affix.stat)}</div>`;
    }
    
    // ═══ COMPARISON with currently equipped item ═══
    let compareHtml = '';
    if (!isEquipped && item.slot) {
      // Find the slot this item would go into
      const targetSlot = item.slot;
      const equippedId = State.meta.equipment[targetSlot];
      const equipped = equippedId ? State.meta.stash.find(i => i.id === equippedId) : null;
      
      if (equipped) {
        const eqRarity = rarities?.[equipped.rarity];
        // Aggregate all stats from both items
        const itemStats = { ...(item.stats || {}) };
        for (const a of item.affixes || []) itemStats[a.stat] = (itemStats[a.stat] || 0) + a.value;
        const eqStats = { ...(equipped.stats || {}) };
        for (const a of equipped.affixes || []) eqStats[a.stat] = (eqStats[a.stat] || 0) + a.value;
        
        const allKeys = new Set([...Object.keys(itemStats), ...Object.keys(eqStats)]);
        let diffHtml = '';
        for (const stat of allKeys) {
          const newVal = itemStats[stat] || 0;
          const oldVal = eqStats[stat] || 0;
          const diff = newVal - oldVal;
          if (diff === 0) continue;
          const color = diff > 0 ? '#00ff88' : '#ff4455';
          const sign = diff > 0 ? '+' : '';
          diffHtml += `<div style="color:${color};font-size:10px">${sign}${Math.round(diff*10)/10} ${this.formatStatName(stat)}</div>`;
        }
        
        if (diffHtml) {
          compareHtml = `
            <div style="border-top:1px solid #223;margin-top:6px;padding-top:6px">
              <div style="color:#888;font-size:9px;margin-bottom:3px">VS EQUIPPED: <span style="color:${eqRarity?.color || '#888'}">${equipped.name}</span></div>
              ${diffHtml}
            </div>
          `;
        }
      } else {
        compareHtml = `<div style="color:#556;font-size:9px;margin-top:4px">Slot empty — direct upgrade</div>`;
      }
    }
    
    // ═══ v2.16.3: Power Score + Synergy Tags ═══
    let powerScoreHtml = '';
    const Items = State.modules?.Items;
    if (Items?.getPowerScore) {
      const ps = Items.getPowerScore(item);
      powerScoreHtml = `<div style="color:#00ccff;font-size:10px;font-weight:bold;margin-top:2px;">⚡ Power: ${ps}</div>`;
    }
    
    let tagsHtml = '';
    const allTags = new Set();
    for (const affix of item.affixes || []) {
      for (const tag of affix.tags || []) allTags.add(tag);
    }
    if (allTags.size > 0) {
      const tagSpans = [...allTags].map(t => `<span style="padding:1px 4px;background:rgba(0,204,255,0.12);border:1px solid rgba(0,204,255,0.25);border-radius:2px;font-size:8px;color:#88ccff;">${t}</span>`).join(' ');
      tagsHtml = `<div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:3px;">${tagSpans}</div>`;
    }
    
    // Set piece info
    let setHtml = '';
    if (item.setFamily) {
      const setDef = State.data.uniques?.sets?.[item.setFamily];
      if (setDef) {
        const sets = State.computed?.setBonuses;
        const owned = sets?.counts?.[item.setFamily] || 0;
        const totalPieces = Object.keys(setDef.pieces || {}).length;
        setHtml += `<div style="margin-top:4px;padding:4px;background:rgba(255,136,0,0.08);border:1px solid rgba(255,136,0,0.2);border-radius:3px;">`;
        setHtml += `<div style="font-size:9px;color:#ff8800;font-weight:bold;">${setDef.icon} ${setDef.name} (${owned}/${totalPieces})</div>`;
        for (const [threshold, bonus] of Object.entries(setDef.bonuses || {})) {
          const active = owned >= parseInt(threshold);
          setHtml += `<div style="font-size:8px;color:${active ? '#ffcc66' : '#555'};margin-left:8px;">(${threshold}) ${bonus.label}: ${bonus.description}</div>`;
        }
        setHtml += `</div>`;
      }
    }
    
    let forgeHtml = '';
    const socketInfo = (item.sockets || 0) > 0
      ? `<div class="tooltip-stat" style="color:#6ddcff;">Socket Capacity: ${item.sockets}</div>${item.socket ? `<div class="tooltip-stat" style="color:#ffd44d;">Inserted Core: ${item.socket}</div>` : `<div class="tooltip-stat" style="color:#6ddcff;">Socket Status: empty</div>`}`
      : '';
    const forgeStats = item.forgeStats && Object.keys(item.forgeStats).length
      ? Object.entries(item.forgeStats).map(([stat, value]) => `<div class="tooltip-stat" style="color:#d0b0ff;">+${value} forged ${this.formatStatName(stat)}</div>`).join('')
      : '';
    const corruptionInfo = item.corrupted
      ? `<div class="tooltip-stat" style="color:#ff6f8b;">Corrupted${item.corruptionLabel ? `: ${item.corruptionLabel}` : ''}</div>`
      : '';
    if (socketInfo || forgeStats || corruptionInfo) {
      forgeHtml = `<div style="border-top:1px solid #223;margin-top:6px;padding-top:6px;">${socketInfo}${forgeStats}${corruptionInfo}</div>`;
    }

    const html = `
      <div class="tooltip-header">
        <span class="tooltip-icon">${iconHtml}</span>
        <div>
          <div class="tooltip-name" style="color:${rarityData?.color || '#fff'}">${item.name}</div>
          <div class="tooltip-type"><span style="color:${(this.slotMeta(item.slot)?.color) || '#ccc'};font-weight:700">${this.slotLabel(item.slot)}</span>${isEquipped ? ' \u2022 <span style="color:#82e84f;font-weight:700">EQUIPPED</span>' : ''} \u2022 Level ${item.level}${item.weaponType ? ' \u2022 <span style="color:#ffcc00">' + item.weaponType.toUpperCase() + '</span>' : ''}</div>
          ${powerScoreHtml}
        </div>
      </div>
      <div class="tooltip-body">
        ${statsHtml}
        ${tagsHtml}
        ${setHtml}
        ${forgeHtml}
        ${compareHtml}
        <div class="tooltip-value">Sell: ${item.value} \uD83D\uDCB0</div>
        <div class="tooltip-hint">${isEquipped ? 'Click to unequip' : 'Click to equip'}</div>
      </div>
    `;
    
    this.showTooltip(event, html, rarityData?.color);
  },
  
  showSlotTooltip(event, slotId) {
    const slots = State.data.slots;
    if (!slots) return;
    
    const equipment = State.meta.equipment;
    const stash = State.meta.stash;
    const slotDef = slots[slotId];
    if (!slotDef) return;
    
    const equippedId = equipment[slotId];
    const item = equippedId ? stash.find(i => i.id === equippedId) : null;
    
    if (item) {
      this.showItemTooltip(event, item.id);
    } else {
      const spritePath = this._slotSprite(slotId);
      const iconHtml = spritePath
        ? `<img src="${spritePath}" style="width:36px;height:36px;object-fit:contain">`
        : slotDef.icon;
      const html = `
        <div class="tooltip-header">
          <span class="tooltip-icon">${iconHtml}</span>
          <div>
            <div class="tooltip-name">${slotDef.name}</div>
            <div class="tooltip-type">Empty Slot</div>
          </div>
        </div>
        <div class="tooltip-body">
          <div class="tooltip-hint">Click to see available items</div>
        </div>
      `;
      this.showTooltip(event, html);
    }
  },
  
  showTooltip(event, html, color = null) {
    if (!this.tooltipEl) return;
    
    // Wrap in tooltip-panel for proper styling
    this.tooltipEl.innerHTML = `
      <div class="tooltip-panel" style="--rarity-color: ${color || 'var(--cyan)'}">
        ${html}
      </div>
    `;
    this.tooltipEl.classList.add('visible');
    
    // Position
    const rect = this.tooltipEl.getBoundingClientRect();
    let x = event.clientX + 15;
    let y = event.clientY + 15;
    
    // Keep on screen
    if (x + rect.width > window.innerWidth - 10) {
      x = event.clientX - rect.width - 15;
    }
    if (y + rect.height > window.innerHeight - 10) {
      y = event.clientY - rect.height - 15;
    }
    
    this.tooltipEl.style.left = x + 'px';
    this.tooltipEl.style.top = y + 'px';
  },
  
  hideTooltip() {
    if (this.tooltipEl) {
      this.tooltipEl.classList.remove('visible');
    }
  },

  // ── A56/A59: SELL-MODE toggle — fast bulk selling (works on desktop + touch) ──
  toggleSellMode() {
    this.sellMode = !this.sellMode;
    document.body.classList.toggle('sell-mode', this.sellMode);
    for (const id of ['invSellModeBtn', 'loadoutSellModeBtn']) {
      const btn = document.getElementById(id);
      if (!btn) continue;
      btn.classList.toggle('active', this.sellMode);
      btn.innerHTML = this.sellMode ? '🏷️ SELL ON' : '🏷️ SELL-MODE';
    }
  },

  // ── A59/A60: AUTO-SALVAGE drop filter — cycle the kept-rarity threshold ──
  cycleAutoSalvage() {
    const order = ['off', 'uncommon', 'rare', 'epic', 'legendary'];
    if (!State.settings) State.settings = {};
    const cur = State.settings.autoSalvageBelow || 'off';
    const next = order[(order.indexOf(cur) + 1) % order.length];
    State.settings.autoSalvageBelow = next;
    State.modules?.Save?.save?.();
    const cleared = next === 'off' ? 0 : this.sweepStashBelow(next); // A60: retroactively clear existing junk
    this.syncLoadoutControls();
    this.renderAll?.();
    if (cleared > 0) this.showFloatingText?.((window.innerWidth || 1200) / 2, 130, `Salvaged ${cleared} junk → scrap`, '#7fd0ff');
  },

  // A60: salvage every unequipped stash item below the given rarity floor (returns count)
  sweepStashBelow(floor) {
    const RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
    const fr = RANK[floor] ?? 99;
    const equipped = new Set(Object.values(State.meta.equipment || {}));
    let count = 0, gain = 0;
    for (let i = State.meta.stash.length - 1; i >= 0; i--) {
      const it = State.meta.stash[i];
      if (!it || equipped.has(it.id)) continue;
      if ((RANK[it.rarity] ?? 0) < fr) {
        gain += it.value || 0;
        State.meta.stash.splice(i, 1);
        count++;
      }
    }
    if (gain) State.meta.scrap = (State.meta.scrap || 0) + gain;
    if (count) State.modules?.Save?.save?.();
    return count;
  },

  syncLoadoutControls() {
    const v = (State.settings && State.settings.autoSalvageBelow) || 'off';
    const btn = document.getElementById('autoSalvageBtn');
    if (btn) {
      const on = v !== 'off';
      btn.innerHTML = '🗑️ AUTO-SALVAGE: ' + v.toUpperCase();
      btn.style.background = on ? 'rgba(0,212,255,.18)' : 'rgba(0,212,255,.06)';
      btn.style.boxShadow = on ? '0 0 10px rgba(0,212,255,.4)' : 'none';
    }
    const sb = document.getElementById('loadoutSellModeBtn');
    if (sb) { sb.classList.toggle('active', !!this.sellMode); sb.innerHTML = this.sellMode ? '🏷️ SELL ON' : '🏷️ SELL-MODE'; }
  },

  showAutoSalvageTick(gain, rarity) {
    // lightweight feedback near the currency bar; non-blocking
    try {
      const x = (window.innerWidth || 1200) - 120, y = 90;
      this.showFloatingText?.(x, y, `+${gain} ⚙ (auto)`, '#7fd0ff');
    } catch (_) {}
  },
  
  // ========== ACTIONS ==========
  onEquipSlotClick(slotId) {
    this.hideTooltip();
    const equipment = State.meta.equipment;
    const equippedId = equipment[slotId];
    
    if (equippedId) {
      // Unequip
      Items.unequip(slotId);
      Stats.calculate();
      Save.save();
      this.renderAll();
    }
  },
  
  onStashItemClick(itemId, ev) {
    this.hideTooltip();
    const item = State.meta.stash.find(i => i.id === itemId);
    if (!item) return;

    // A56: in sell-mode a tap sells the item instantly (fast bulk clearing)
    if (this.sellMode) {
      const x = ev ? ev.clientX : innerWidth / 2, y = ev ? ev.clientY : 120;
      const equipped = Object.values(State.meta.equipment).includes(itemId);
      if (equipped) { this.showFloatingText(x, y, 'Erst ablegen!', '#ff4444'); return; }
      const value = Items.sell(itemId);
      this.showFloatingText(x, y, `+${value} \uD83D\uDCB0`, '#ffcc00');
      Save.save();
      this.renderAll();
      this.renderScrap?.();
      return;
    }

    const isEquipped = Object.values(State.meta.equipment).includes(itemId);
    
    if (isEquipped) {
      // Find slot and unequip
      for (const [slot, id] of Object.entries(State.meta.equipment)) {
        if (id === itemId) {
          Items.unequip(slot);
          break;
        }
      }
    } else {
      // Equip
      Items.equip(itemId);
    }
    
    Stats.calculate();
    Save.save();
    this.renderAll();
  },
  
  // Right-click to sell item
  sellItem(event, itemId) {
    event.preventDefault();
    this.hideTooltip();
    
    const item = State.meta.stash.find(i => i.id === itemId);
    if (!item) return;
    
    // Can't sell equipped items directly
    const isEquipped = Object.values(State.meta.equipment).includes(itemId);
    if (isEquipped) {
      this.showFloatingText(event.clientX, event.clientY, 'Unequip first!', '#ff4444');
      return;
    }
    
    // Sell it!
    const value = Items.sell(itemId);
    
    // Show feedback
    this.showFloatingText(event.clientX, event.clientY, `+${value} \uD83D\uDCB0`, '#ffcc00');
    
    Save.save();
    this.renderAll();
    this.renderScrap();
  },
  
  // Show floating text feedback
  showFloatingText(x, y, text, color) {
    const el = document.createElement('div');
    el.className = 'floating-text';
    el.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      color: ${color};
      font-family: 'Orbitron', monospace;
      font-size: 18px;
      font-weight: bold;
      text-shadow: 0 0 10px ${color};
      pointer-events: none;
      z-index: 9999;
      animation: floatUp 1s ease-out forwards;
    `;
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  },
  
  // Update scrap display (hub/start/hud)
  renderScrap() {
    const metaScrap = State.meta.scrap || 0;
    const runScrap = State.run?.scrapEarned || 0;

    // Hub + Start screens show meta only
    const hubEl = document.getElementById('hubScrap');
    if (hubEl) hubEl.textContent = metaScrap;

    const startEl = document.getElementById('startScrap');
    if (startEl) startEl.textContent = metaScrap;

    // HUD shows meta + run earnings
    const hudEl = document.getElementById('hudScrap');
    if (hudEl) hudEl.textContent = metaScrap + runScrap;
  },
  
  // ========== HOLD-TO-REPEAT (stat + skill allocation) ==========
  _holdTimer: null,
  _holdDelay: 350,   // ms before repeat starts
  _holdRate: 80,     // ms between repeats

  startHold(type, arg1, arg2) {
    this.stopHold();
    const action = () => {
      if (type === 'stat') this.allocateStat(arg1);
      else if (type === 'skill') this.learnSkill(arg1, arg2);
    };
    // Immediate first allocation
    action();
    // After delay, start repeating
    this._holdTimer = setTimeout(() => {
      this._holdTimer = setInterval(action, this._holdRate);
    }, this._holdDelay);
  },

  stopHold() {
    if (this._holdTimer) {
      clearTimeout(this._holdTimer);
      clearInterval(this._holdTimer);
      this._holdTimer = null;
    }
  },

  allocateStat(statId) {
    if (Leveling.allocateStat(statId)) {
      this.renderPilotStats();
      this.renderShipStats();
    }
  },
  
  learnSkill(treeId, skillId) {
    if (Leveling.learnSkill(treeId, skillId)) {
      this.renderSkillTrees();
      this.renderShipStats();
    }
  },
  
  buyUpgrade(upgradeId) {
    // Legacy run upgrades (kept for backward compat with old saves)
    const upgrades = State.data.runUpgrades;
    const upgrade = upgrades?.[upgradeId];
    if (!upgrade) return;
    
    const tier = State.run.upgrades[upgradeId] || 0;
    if (tier >= upgrade.maxTier) return;
    
    const cost = upgrade.costs[tier];
    if (State.run.cells < cost) return;
    
    State.run.cells -= cost;
    State.run.upgrades[upgradeId] = tier + 1;
    
    Stats.calculate();
    this.renderVendor();
    this.renderShipStats();
  },
  
  // ========== HELPERS ==========
  formatStatName(stat) {
    const names = {
      damage: 'Damage',
      fireRate: 'Fire Rate',
      speed: 'Speed',
      maxHP: 'Max HP',
      shieldCap: 'Shield',
      critChance: 'Crit %',
      critDamage: 'Crit Dmg',
      piercing: 'Pierce',
      projectiles: 'Projectiles',
      luck: 'Luck',
      pickupRadius: 'Pickup',
      hpRegen: 'HP Regen',
      shieldRegen: 'Shield Regen',
      lifesteal: 'Lifesteal'
    };
    return names[stat] || stat;
  }
};

// Global access (browser only)
if (typeof window !== 'undefined') {
  window.UI = UI;
}

export default UI;
