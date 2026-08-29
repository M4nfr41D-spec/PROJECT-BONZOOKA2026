// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// Input.js - Desktop Input (WASD + Mouse)
// ============================================================

import { State } from './State.js';

export const Input = {
  canvas: null,
  canvasRect: null,
  
  init(canvas) {
    this.canvas = canvas;
    this.updateRect();
    
    // Keyboard
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    
    // Mouse
    canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // Track canvas position for resize
    window.addEventListener('resize', () => this.updateRect());
    
    // Prevent space scrolling
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
      }
    });
  },
  
  updateRect() {
    if (this.canvas) {
      this.canvasRect = this.canvas.getBoundingClientRect();
    }
  },
  
  onKeyDown(e) {
    const input = State.input;
    
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        input.up = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        input.down = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        input.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        input.right = true;
        break;
      case 'Space':
        input.fire = true;
        break;
      case 'KeyE':
        // Edge-trigger (pressed) + level-trigger (held)
        if (!input.interact) input.interactPressed = true;
        input.interact = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        input.shift = true;
        break;
      case 'KeyG': {
        // Cycle drone type: combat → shield → repair → off → combat
        const drone = State.player.drone;
        if (!drone) break;
        const types = ['combat', 'shield', 'repair'];
        if (drone.active) {
          const idx = types.indexOf(drone.type);
          if (idx >= types.length - 1) {
            drone.active = false; // cycle off
          } else {
            drone.type = types[idx + 1];
          }
        } else {
          drone.active = true;
          drone.type = 'combat';
        }
        const AudioD = State.modules?.Audio;
        if (AudioD) AudioD.droneSwitch();
        break;
      }

      case 'KeyM': {
        // Toggle audio mute
        const AudioM = State.modules?.Audio;
        if (AudioM) {
          const muted = AudioM.toggleMute();
          State.ui?.showAnnouncement?.(muted ? '🔇 AUDIO MUTED' : '🔊 AUDIO ON');
        }
        break;
      }
      
      // Active abilities
      case 'KeyQ':
      case 'Digit1':
        if (!input.ability1) input.ability1 = true;
        break;
      case 'KeyR':
      case 'Digit2':
        if (!input.ability2) input.ability2 = true;
        break;
      case 'KeyF':
      case 'Digit3':
        if (!input.ability3) input.ability3 = true;
        break;
      
      // ── ESC: Pause toggle (mid-run overlay) ──
      case 'Escape': {
        e.preventDefault();
        // v2.16.3: Close combat modals first
        const serviceModal = document.getElementById('serviceModal');
        const combatInv = document.getElementById('combatInventoryModal');
        const combatParagon = document.getElementById('combatParagonModal');
        const combatSkills = document.getElementById('combatSkillModal');
        const combatStats = document.getElementById('combatStatsModal');
        if (serviceModal?.classList.contains('active')) {
          if (window.Game?.closeServiceModal) window.Game.closeServiceModal();
          break;
        }
        if (combatInv?.classList.contains('active')) {
          if (window.Game?.closeCombatModal) window.Game.closeCombatModal('combatInventoryModal');
          break;
        }
        if (combatParagon?.classList.contains('active')) {
          if (window.Game?.closeCombatModal) window.Game.closeCombatModal('combatParagonModal');
          break;
        }
        if (combatSkills?.classList.contains('active')) {
          if (window.Game?.closeCombatModal) window.Game.closeCombatModal('combatSkillModal');
          break;
        }
        if (combatStats?.classList.contains('active')) {
          if (window.Game?.closeCombatModal) window.Game.closeCombatModal('combatStatsModal');
          break;
        }
        const PauseUI = State.modules?.PauseUI;
        const scene = State.modules?.SceneManager?.getScene?.();
        // Close settings if open
        const sModal = document.getElementById('settingsModal');
        if (sModal && sModal.style.display !== 'none') {
          sModal.style.display = 'none';
          State.ui.paused = false;
          break;
        }
        if (scene === 'combat') {
          if (PauseUI) PauseUI.toggle();
          else { State.ui.paused = !State.ui.paused; }
        }
        break;
      }

      // ── P: Combat stats modal (combat) or Settings (hub) ──
      case 'KeyP': {
        const sceneP = State.modules?.SceneManager?.getScene?.();
        if (sceneP === 'combat') {
          if (window.Game?.toggleCombatStats) window.Game.toggleCombatStats();
          break;
        }
        const sModal2 = document.getElementById('settingsModal');
        if (sModal2) {
          const isOpen = sModal2.style.display !== 'none';
          sModal2.style.display = isOpen ? 'none' : 'flex';
          State.ui.paused = !isOpen;
          if (!isOpen) {
            const Audio = State.modules?.Audio;
            const sfxEl = document.getElementById('sfxVol');
            const musEl = document.getElementById('musicVol');
            const shakeEl = document.getElementById('shakeToggle');
            const dmgEl = document.getElementById('dmgNumToggle');
            if (sfxEl) sfxEl.value = Math.round((State.settings?.sfxVolume ?? 0.7) * 100);
            if (musEl) musEl.value = Math.round((State.settings?.musicVolume ?? 0.4) * 100);
            if (shakeEl) shakeEl.checked = State.settings?.screenShake !== false;
            if (dmgEl) dmgEl.checked = State.settings?.damageNumbers !== false;
          }
        }
        break;
      }

      // ── S: Combat skills modal ──
      case 'KeyT': {
        const sceneS = State.modules?.SceneManager?.getScene?.();
        if (sceneS === 'combat') {
          if (window.Game?.toggleCombatSkills) window.Game.toggleCombatSkills();
        }
        break;
      }

      // ── I: Combat inventory modal ──
      case 'KeyI': {
        if (window.Game?.toggleCombatInventory) window.Game.toggleCombatInventory();
        break;
      }

      // ── Tab: Cycle target lock to next enemy ──
      case 'Tab': {
        e.preventDefault();
        this._cycleTargetLock(e.shiftKey ? -1 : 1);
        break;
      }

      // ── H: Controls overlay ──
      case 'KeyH': {
        if (window.Game?.toggleControlsOverlay) window.Game.toggleControlsOverlay();
        break;
      }
    }
  },
  
  onKeyUp(e) {
    const input = State.input;
    
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        input.up = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        input.down = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        input.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        input.right = false;
        break;
      case 'Space':
        input.fire = false;
        break;
      case 'KeyE':
        input.interact = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        input.shift = false;
        break;
      case 'KeyQ':
      case 'Digit1':
        input.ability1 = false;
        break;
      case 'KeyR':
      case 'Digit2':
        input.ability2 = false;
        break;
      case 'KeyF':
      case 'Digit3':
        input.ability3 = false;
        break;
    }
  },
  
  onMouseMove(e) {
    this.updateRect();
    
    // Convert to canvas coordinates
    State.input.mouseX = e.clientX - this.canvasRect.left;
    State.input.mouseY = e.clientY - this.canvasRect.top;
  },
  
  onMouseDown(e) {
    if (e.button === 0) { // Left click
      State.input.fire = true;
      // ── Target Lock: click on enemy to lock ──
      this._tryTargetLock();
    }
    if (e.button === 2) { // Right click = unlock
      State.input.targetLock = null;
    }
  },
  
  onMouseUp(e) {
    if (e.button === 0) {
      State.input.fire = false;
    }
  },

  // ═══ TARGET LOCK SYSTEM (v2.16.3) ═══
  
  _tryTargetLock() {
    const Camera = State.modules?.Camera;
    if (!Camera) return;
    
    const worldMouse = Camera.screenToWorld(State.input.mouseX, State.input.mouseY);
    const enemies = State.enemies;
    if (!enemies?.length) return;
    
    const lockRange = 80; // px click radius to lock
    let closest = null, closestDist = lockRange;
    
    for (const e of enemies) {
      if (e.dead) continue;
      const dist = Math.hypot(e.x - worldMouse.x, e.y - worldMouse.y);
      if (dist < closestDist) {
        closest = e;
        closestDist = dist;
      }
    }
    
    if (closest) {
      State.input.targetLock = closest.id;
    }
    // Don't clear on empty click — let fire continue in free aim
  },
  
  _cycleTargetLock(direction) {
    const p = State.player;
    const enemies = State.enemies;
    if (!enemies?.length) return;
    
    const maxRange = 600; // max lock range from player
    const alive = enemies.filter(e => !e.dead && Math.hypot(e.x - p.x, e.y - p.y) < maxRange);
    if (!alive.length) { State.input.targetLock = null; return; }
    
    // Sort by distance
    alive.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    
    const currentId = State.input.targetLock;
    const currentIdx = alive.findIndex(e => e.id === currentId);
    
    if (currentIdx < 0) {
      // No current lock → lock nearest
      State.input.targetLock = alive[0].id;
    } else {
      // Cycle
      const nextIdx = ((currentIdx + direction) % alive.length + alive.length) % alive.length;
      State.input.targetLock = alive[nextIdx].id;
    }
    
    // Audio feedback
    const Audio = State.modules?.Audio;
    if (Audio?.uiClick) Audio.uiClick();
  },
  
  // Get movement vector from WASD
  getMovement() {
    const input = State.input;
    let dx = 0, dy = 0;
    
    if (input.up) dy -= 1;
    if (input.down) dy += 1;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;
    
    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
    }
    
    return { dx, dy };
  },
  
  // Get angle from player to mouse
  getAimAngle(playerX, playerY) {
    const mx = State.input.mouseX;
    const my = State.input.mouseY;
    return Math.atan2(my - playerY, mx - playerX);
  }
};

export default Input;
