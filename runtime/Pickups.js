// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// PICKUPS.js - Loot and Currency Pickups
// ============================================================

import { State } from './State.js';

export const Pickups = {
  // Update all pickups
  update(dt, canvas) {
    const p = State.player;
    const zone = State.world?.currentZone;
    const inWorld = !!zone;
    
    for (let i = State.pickups.length - 1; i >= 0; i--) {
      const pk = State.pickups[i];

      // Movement
      if (inWorld) {
        // Exploration mode: no gravity (space), strong damping to remove drift
        pk.x += pk.vx * dt;
        pk.y += pk.vy * dt;

        // Damping (frame-rate independent)
        const damp = Math.pow(0.12, dt); // ~88% damp per second
        pk.vx *= damp;
        pk.vy *= damp;

        if (Math.abs(pk.vx) < 2) pk.vx = 0;
        if (Math.abs(pk.vy) < 2) pk.vy = 0;

        // Keep within zone bounds
        const margin = 20;
        pk.x = Math.max(margin, Math.min(zone.width - margin, pk.x));
        pk.y = Math.max(margin, Math.min(zone.height - margin, pk.y));
      } else {
        // Wave mode: gravity + bounce floor
        pk.vy += 100 * dt;
        pk.x += pk.vx * dt;
        pk.y += pk.vy * dt;

        pk.vx *= 0.98;
        pk.vy *= 0.98;
      }
      
      // Lifetime
      pk.life -= dt;
      if (pk.life <= 0) {
        State.pickups.splice(i, 1);
        continue;
      }
      
      // Magnet — tiered: trivial loot (currency/xp/health/common) gets auto-vacuumed
      // from a wider range; rare+ items keep normal range so the player reaches for them.
      const dx = p.x - pk.x;
      const dy = p.y - pk.y;
      const dist = Math.hypot(dx, dy);
      const baseR = p.pickupRadius || 120;
      const trivial = this._pickupTier(pk) <= 1;
      const range = baseR * (trivial ? 2.3 : 1.0);
      const pullMax = trivial ? 650 : 500;

      if (dist > 0.001 && dist < range) {
        const pull = (range - dist) / range * pullMax;
        pk.x += (dx / dist) * pull * dt;
        pk.y += (dy / dist) * pull * dt;
      }
      
      // Collection
      if (dist < 25) {
        this.collect(pk);
        State.pickups.splice(i, 1);
        continue;
      }

      // Floor bounce (wave mode only)
      if (!inWorld) {
        const floorY = canvas.height - 20;
        if (pk.y > floorY) {
          pk.y = floorY;
          pk.vy = -Math.abs(pk.vy) * 0.5;
        }
      }
    }
  },
  
  // Add a pickup to the world
  add(config) {
    State.pickups.push({
      x: config.x || 0,
      y: config.y || 0,
      vx: config.vx || (Math.random() - 0.5) * 40,
      vy: config.vy || -40 + Math.random() * 20,
      life: config.life || 15,
      lifespan: config.life || 15,
      type: config.type || 'cells',
      value: config.value || 0,
      rarity: config.rarity || null,
      weaponType: config.weaponType || null,
      fromBoss: config.fromBoss || false
    });
  },
  
  // Collect a pickup
  collect(pickup) {
    const Audio = State.modules?.Audio;
    switch (pickup.type) {
      case 'cells':
        State.run.cells += pickup.value;
        this.spawnCollectEffect(pickup.x, pickup.y, '#00d4ff');
        this.spawnFloatText(pickup.x, pickup.y, `+${pickup.value}\u26A1`, '#00d4ff');
        if (Audio) Audio.pickupScrap();
        break;
        
      case 'scrap':
        State.run.scrapEarned += pickup.value;
        this.spawnCollectEffect(pickup.x, pickup.y, '#ffd700');
        this.spawnFloatText(pickup.x, pickup.y, `+${pickup.value}\uD83D\uDCB0`, '#ffd700');
        if (Audio) Audio.pickupScrap();
        break;
        
      case 'item':
        this._collectItemPickup(pickup, Audio);
        this._rewardPulse(pickup);
        break;
        
      case 'health':
        const healed = pickup.value || 25;
        State.player.hp = Math.min(State.player.maxHP, State.player.hp + healed);
        this.spawnCollectEffect(pickup.x, pickup.y, '#00ff88');
        this.spawnFloatText(pickup.x, pickup.y, `+${healed}\u00E2\u009D\u00A4\u00EF\u00B8\u008F`, '#00ff88');
        if (Audio) Audio.pickupHealth();
        break;
      
      case 'coolant':
        State.player.heat = 0;
        State.player.overheated = false;
        State.player.coolantTimer = State.player.coolantDuration || 10;
        this.spawnCollectEffect(pickup.x, pickup.y, '#00ddff');
        this.spawnFloatText(pickup.x, pickup.y, '❄ COOLANT 10s', '#00ddff');
        if (Audio?.pickupHealth) Audio.pickupHealth();
        break;
        
      case 'xp':
        import('./Leveling.js').then(module => {
          module.Leveling.addXP(pickup.value);
        });
        this.spawnCollectEffect(pickup.x, pickup.y, '#aa55ff');
        this.spawnFloatText(pickup.x, pickup.y, `+${pickup.value}XP`, '#aa55ff');
        if (Audio) Audio.pickupScrap();
        break;
        
      case 'weapon': {
        // v2.16.3: Weapon pickups removed. Weapon type from equipped items only.
        break;
      }
    }
  },

  // Loot tier (0 = trivial: currency/xp/health/coolant; items use rarity rank)
  _pickupTier(pk) {
    if (pk.type !== 'item') return 0;
    const order = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
    return order[pk.rarity] ?? 0;
  },

  // Rarity-staged reward pulse — makes a rare+ drop a MOMENT (not just +inventory).
  // Commons stay quiet (their base collect ring is enough). Director rate untouched.
  _rewardPulse(pickup) {
    const P = State.modules?.Particles;
    if (!P) return;
    const order = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
    const r = order[pickup.rarity] ?? 0;
    if (r <= 1) return; // common/uncommon: quiet
    const color = State.data?.rarities?.[pickup.rarity]?.color || '#ffffff';
    const x = pickup.x, y = pickup.y;
    const scale = 1 + (r - 2) * 0.45; // rare 1.0 → mythic 2.35

    P.flash(x, y, '#ffffff', 9 * scale);
    P.flash(x, y, color, 15 * scale);
    P.ring(x, y, color, 20 * scale);
    if (r >= 3) P.ring(x, y, '#ffffff', 12 * scale); // epic+ double ring
    P.sparks(x, y, color, Math.round(10 * scale));

    // The "moment": brief slow on legendary+ so the drop lands with weight
    if (r >= 4) window.Game?.requestHitstop?.(r >= 5 ? 4 : 3, true);

    const label = { rare: 'RARE', epic: 'EPIC', legendary: 'LEGENDARY', mythic: 'MYTHIC' }[pickup.rarity];
    if (label) this.spawnFloatText(x, y - 6, label, color);

    const Audio = State.modules?.Audio;
    if (Audio?.pickupHealth) Audio.pickupHealth(); // brighter ding for rare+
  },

  _getUIBridge() {
    if (State.modules?.UI) return State.modules.UI;
    if (typeof window !== 'undefined' && window.UI) return window.UI;
    if (typeof globalThis !== 'undefined' && globalThis.UI) return globalThis.UI;
    return null;
  },

  _collectItemPickup(pickup, Audio) {
    const Rewards = State.modules?.Rewards;
    if (!Rewards?.resolveItemPickup) {
      console.warn('[LOOT] Rewards module missing for item pickup resolution');
      State.pushDebugTrace?.('loot', 'reward_module_missing', {
        pickupId: pickup?.debugId || null,
        stage: 'pickup_collect'
      });
      this.spawnFloatText(pickup.x, pickup.y, 'LOOT OFFLINE', '#ff4455');
      return;
    }

    return Rewards.resolveItemPickup(pickup, {
      audio: Audio,
      spawnCollectEffect: (x, y, color) => this.spawnCollectEffect(x, y, color),
      spawnFloatText: (x, y, text, color) => this.spawnFloatText(x, y, text, color),
      showLootComparison: (item) => this._showLootComparison(item)
    });
  },

  // Spawn collection effect
  spawnCollectEffect(x, y, color) {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      State.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * 80,
        vy: Math.sin(angle) * 80,
        life: 0.25,
        maxLife: 0.25,
        color: color,
        size: 4
      });
    }
  },
  
  // Spawn floating text
  spawnFloatText(x, y, text, color) {
    State.particles.push({
      x: x,
      y: y - 10,
      vx: 0,
      vy: -60,
      life: 0.8,
      maxLife: 0.8,
      text: text,
      isText: true,
      color: color,
      size: 14
    });
  },

  // ═══ v2.16.3: Loot Comparison Popup ═══
  // Shows brief HUD popup comparing new item vs currently equipped item in same slot
  _showLootComparison(item) {
    if (!item?.slot) return;
    
    const UI = window.UI;
    const rarities = State.data.rarities;
    const rarityData = rarities?.[item.rarity];
    const rarityColor = rarityData?.color || '#fff';
    
    // Find equipped item in same slot
    let eqSlot = item.slot;
    if (eqSlot === 'module') eqSlot = 'module1'; // check first module slot
    const equippedId = State.meta.equipment?.[eqSlot];
    const equipped = equippedId ? State.meta.stash.find(i => i.id === equippedId) : null;
    
    // Aggregate stats
    const newStats = { ...(item.stats || {}) };
    for (const a of item.affixes || []) newStats[a.stat] = (newStats[a.stat] || 0) + a.value;
    
    const eqStats = {};
    if (equipped) {
      Object.assign(eqStats, equipped.stats || {});
      for (const a of equipped.affixes || []) eqStats[a.stat] = (eqStats[a.stat] || 0) + a.value;
    }
    
    // Build diff lines
    const allKeys = new Set([...Object.keys(newStats), ...Object.keys(eqStats)]);
    let diffHtml = '';
    for (const stat of allKeys) {
      const nv = newStats[stat] || 0;
      const ev = eqStats[stat] || 0;
      const diff = nv - ev;
      if (Math.abs(diff) < 0.01) continue;
      const color = diff > 0 ? '#00ff88' : '#ff4455';
      const sign = diff > 0 ? '+' : '';
      const name = UI?.formatStatName?.(stat) || stat;
      diffHtml += `<div style="color:${color};font-size:10px;">${sign}${Math.round(diff * 10) / 10} ${name}</div>`;
    }
    
    // Power score comparison
    const Items = State.modules?.Items;
    let powerHtml = '';
    if (Items?.getPowerScore) {
      const newPS = Items.getPowerScore(item);
      const eqPS = equipped ? Items.getPowerScore(equipped) : 0;
      const psDiff = newPS - eqPS;
      if (psDiff !== 0) {
        const psColor = psDiff > 0 ? '#00ffcc' : '#ff4455';
        powerHtml = `<div style="color:${psColor};font-size:10px;font-weight:bold;">⚡ Power: ${psDiff > 0 ? '+' : ''}${psDiff}</div>`;
      }
    }
    
    const vsName = equipped ? equipped.name : '(empty slot)';
    const vsColor = equipped ? (rarities?.[equipped.rarity]?.color || '#666') : '#444';

    // Create/reuse popup element
    let popup = document.getElementById('_lootCompare');
    if (!popup) {
      popup = document.createElement('div');
      popup.id = '_lootCompare';
      popup.style.cssText = 'position:fixed;top:80px;right:12px;z-index:8500;width:220px;padding:10px;background:rgba(8,10,18,0.95);border:1px solid rgba(0,212,255,0.3);border-radius:8px;pointer-events:none;transition:opacity 0.3s;font-family:monospace;';
      document.body.appendChild(popup);
    }
    
    popup.innerHTML = `
      <div style="font-size:11px;color:${rarityColor};font-weight:bold;margin-bottom:2px;">${item.name}</div>
      <div style="font-size:8px;color:#666;margin-bottom:6px;">${item.slot}${item.weaponType ? ' • ' + item.weaponType.toUpperCase() : ''}</div>
      ${equipped ? `<div style="font-size:9px;color:#888;margin-bottom:4px;">vs <span style="color:${vsColor}">${vsName}</span></div>` : '<div style="font-size:9px;color:#888;margin-bottom:4px;">vs (empty slot)</div>'}
      ${powerHtml}
      ${diffHtml || '<div style="font-size:9px;color:#555;">No stat difference</div>'}
      <div style="font-size:8px;color:#444;margin-top:4px;">[I] to equip</div>
    `;
    
    popup.style.opacity = '1';
    popup.style.borderColor = rarityColor + '60';
    
    // Auto-hide after 4 seconds
    clearTimeout(this._lootCompareTimer);
    this._lootCompareTimer = setTimeout(() => {
      popup.style.opacity = '0';
    }, 4000);
  },

  // Draw all pickups
  draw(ctx) {
    const now = Date.now();
    
    for (const pk of State.pickups) {
      // Fade when about to expire
      ctx.globalAlpha = Math.min(1, pk.life * 2);
      
      // Pulse effect
      const pulse = 1 + Math.sin(now * 0.01) * 0.1;
      
      // === DROP BOUNCE (first 0.5s of life) ===
      // life counts down from ~30. If life > 29.5, we're in the first 0.5s
      const maxLife = pk.lifespan || 30;
      const age = maxLife - pk.life;
      let bounceY = 0;
      if (age < 0.5) {
        // Elastic bounce: drop from 20px above, bounce twice
        const t = age / 0.5;
        bounceY = -20 * Math.abs(Math.sin(t * Math.PI * 2.5)) * (1 - t);
      }
      
      // ═══ v2.15.1: Sprite draw hook (pickups category) ═══
      const SM = State.modules?.SpriteManager;
      if (SM && State.modules?.Particles?.spritePickups) {
        const pickupSpriteId = 'pickup_' + pk.type;
        if (SM.has('pickups', pickupSpriteId, 'idle')) {
          SM.play(pk, 'pickups', pickupSpriteId, 'idle');
          if (SM.drawAnimated(ctx, pk, pk.x, pk.y + bounceY, null, (pk.size || 8) * pulse, { alpha: ctx.globalAlpha })) {
            ctx.globalAlpha = 1;
            continue;
          }
        }
      }
      
      switch (pk.type) {
        case 'cells':
          ctx.fillStyle = '#00d4ff';
          ctx.shadowColor = '#00d4ff';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(pk.x, pk.y, 8 * pulse, 0, Math.PI * 2);
          ctx.fill();
          
          // Lightning bolt symbol
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('\u26A1', pk.x, pk.y + 4);
          break;
          
        case 'scrap':
          ctx.fillStyle = '#ffd700';
          ctx.shadowColor = '#ffd700';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(pk.x, pk.y, 8 * pulse, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.fillStyle = '#000000';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('$', pk.x, pk.y + 3);
          break;
          
        case 'item':
          const rarityColor = State.data.rarities?.[pk.rarity]?.color || '#ffffff';
          const rarityOrder = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
          const rIdx = rarityOrder[pk.rarity] || 0;
          
          // Scale size by rarity: common=10, uncommon=12, rare=14, epic=16, legendary=18, mythic=20
          const baseSize = 10 + rIdx * 2;
          const sz = baseSize * pulse;
          
          // Apply bounce offset
          const drawY = pk.y + bounceY;
          
          // Glow scales with rarity
          ctx.shadowColor = rarityColor;
          ctx.shadowBlur = 10 + rIdx * 5;
          
          // Rare+ ground glow (circular aura beneath the item)
          if (rIdx >= 2) {
            const auraR = 20 + rIdx * 8;
            const auraGrad = ctx.createRadialGradient(pk.x, pk.y + 4, 0, pk.x, pk.y + 4, auraR);
            auraGrad.addColorStop(0, rarityColor + '33');
            auraGrad.addColorStop(0.5, rarityColor + '15');
            auraGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = auraGrad;
            ctx.beginPath();
            ctx.arc(pk.x, pk.y + 4, auraR, 0, Math.PI * 2);
            ctx.fill();
          }
          
          // Epic+ gets a vertical beam of light
          if (rIdx >= 3) {
            const beamAlpha = 0.15 + rIdx * 0.05;
            const beamW = 3 + rIdx;
            ctx.fillStyle = rarityColor;
            ctx.globalAlpha = Math.min(1, pk.life * 2) * beamAlpha;
            ctx.fillRect(pk.x - beamW/2, drawY - 80, beamW, 160);
            ctx.globalAlpha = Math.min(1, pk.life * 2);
          }
          
          // Diamond shape (with bounce offset)
          ctx.fillStyle = rarityColor;
          ctx.beginPath();
          ctx.moveTo(pk.x, drawY - sz);
          ctx.lineTo(pk.x + sz * 0.8, drawY);
          ctx.lineTo(pk.x, drawY + sz);
          ctx.lineTo(pk.x - sz * 0.8, drawY);
          ctx.closePath();
          ctx.fill();
          
          // Inner highlight
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = Math.min(1, pk.life * 2) * 0.4;
          ctx.beginPath();
          ctx.moveTo(pk.x, drawY - sz * 0.5);
          ctx.lineTo(pk.x + sz * 0.3, drawY);
          ctx.lineTo(pk.x, drawY + sz * 0.5);
          ctx.lineTo(pk.x - sz * 0.3, drawY);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = Math.min(1, pk.life * 2);
          
          // Rarity ring (thicker for higher rarity)
          ctx.strokeStyle = rarityColor;
          ctx.lineWidth = 1 + rIdx * 0.5;
          ctx.beginPath();
          ctx.arc(pk.x, drawY, (sz + 6) * pulse, 0, Math.PI * 2);
          ctx.stroke();
          
          // Legendary+ gets orbiting sparkles
          if (rIdx >= 4) {
            const t = now * 0.003;
            const sparkCount = rIdx === 5 ? 4 : 2;
            for (let s = 0; s < sparkCount; s++) {
              const angle = t + (s * Math.PI * 2 / sparkCount);
              const sx = pk.x + Math.cos(angle) * (sz + 10);
              const sy = drawY + Math.sin(angle) * (sz + 10);
              ctx.fillStyle = '#ffffff';
              ctx.globalAlpha = Math.min(1, pk.life * 2) * 0.8;
              ctx.beginPath();
              ctx.arc(sx, sy, 2, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.globalAlpha = Math.min(1, pk.life * 2);
          }
          
          // Rarity label text for rare+
          if (rIdx >= 2) {
            const labels = { rare: 'RARE', epic: 'EPIC', legendary: 'LEGEND', mythic: 'MYTHIC' };
            const label = labels[pk.rarity];
            if (label) {
              ctx.fillStyle = rarityColor;
              ctx.font = `bold ${8 + rIdx}px sans-serif`;
              ctx.textAlign = 'center';
              ctx.fillText(label, pk.x, drawY - sz - 6);
            }
          }
          break;
          
        case 'health':
          ctx.fillStyle = '#00ff88';
          ctx.shadowColor = '#00ff88';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(pk.x, pk.y, 8 * pulse, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('+', pk.x, pk.y + 4);
          break;
        
        case 'coolant': {
          // Pulsing cyan diamond with snowflake
          const cSz = 10 * pulse;
          ctx.fillStyle = '#00ddff';
          ctx.shadowColor = '#00ddff';
          ctx.shadowBlur = 18;
          ctx.save();
          ctx.translate(pk.x, pk.y);
          ctx.rotate(Math.PI / 4);
          ctx.fillRect(-cSz/2, -cSz/2, cSz, cSz);
          ctx.restore();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('❄', pk.x, pk.y + 4);
          break;
        }
          
        case 'xp':
          ctx.fillStyle = '#aa55ff';
          ctx.shadowColor = '#aa55ff';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(pk.x, pk.y, 6 * pulse, 0, Math.PI * 2);
          ctx.fill();
          break;
      }
      
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }
};

export default Pickups;
