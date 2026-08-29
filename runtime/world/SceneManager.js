// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// SceneManager.js - Scene State Management
// ============================================================
// Handles transitions between Hub and Combat scenes

import { State } from '../State.js';
import { World } from './World.js';
import { Camera } from './Camera.js';
import { WorldBoundary } from './WorldBoundary.js';


export const SceneManager = {
  currentScene: 'hub', // 'hub', 'combat', 'loading', 'gameover'
  
  // Scene transition data
  transition: {
    active: false,
    type: 'fade', // 'fade', 'slide', 'warp'
    progress: 0,
    duration: 0.5,
    callback: null
  },
  
  // Initialize scene manager
  init() {
    this.currentScene = 'hub';
    State.scene = 'hub';
  },
  
  // Switch to hub scene
  goToHub() {
    this.startTransition('fade', () => {
      this.currentScene = 'hub';
      State.scene = 'hub';
      State.run.inCombat = false;
      
      

      // HOTFIX: always return to known UI state
      WorldBoundary.clearPauseState();
      WorldBoundary.forceLayoutResize();
      // Show hub UI
      this.showHubUI();
      
      // Save progress
      WorldBoundary.saveProgress();
    });
  },
  
  // Start an act/combat
  startAct(actId, seed = null) {
    this.startTransition('warp', async () => {
      try {
        this.currentScene = 'loading';
        State.scene = 'loading';

        // Initialize world (zone generation can throw if data/config is invalid)
        const success = await World.init(actId, seed);
        if (!success) throw new Error(`World.init() returned false for act: ${actId}`);

        this.currentScene = 'combat';
        State.scene = 'combat';
        State.run.inCombat = true;
        State.run.currentAct = actId;

        

        // HOTFIX: entering combat must not keep paused overlay active
        WorldBoundary.clearPauseState();
        WorldBoundary.forceLayoutResize();
        // Hide hub UI, show game UI
        this.showCombatUI();

        // Reset run stats
        State.run.wave = 1;
        State.run.kills = 0;
        State.run.stats = {
          kills: 0,
          damageDealt: 0,
          damageTaken: 0,
          itemsFound: 0,
          eliteKills: 0,
          bossKills: 0,
          bestStreak: 0,
          flawlessZones: 0,
          timeStarted: Date.now()
        };

        // Initialize player HP
        State.modules.Stats?.initializeHP();
      } catch (err) {
        console.error(' startAct failed:', err);

        // Fail-safe: never get stuck in loading
        this.currentScene = 'hub';
        State.scene = 'hub';
        State.run.inCombat = false;

        this.showHubUI();
        WorldBoundary.saveProgress();
      }
    });
  },

  // Return to hub (portal, death, etc)
  returnToHub(reason = 'portal') {
    if (reason === 'death') {
      // Show death screen first
      this.showDeathScreen();
      return;
    }
    
    this.goToHub();
  },
  
  // Start scene transition
  startTransition(type, callback) {
    this.transition = {
      active: true,
      type: type,
      progress: 0,
      duration: type === 'warp' ? 0.8 : 0.5,
      callback: callback,
      phase: 'out' // 'out' then 'in'
    };
  },
  
  // Update transition
  updateTransition(dt) {
    if (!this.transition.active) return;
    
    this.transition.progress += dt / (this.transition.duration / 2);
    
    if (this.transition.progress >= 1 && this.transition.phase === 'out') {
      // Execute callback at midpoint
      if (this.transition.callback) {
        this.transition.callback();
      }
      this.transition.phase = 'in';
      this.transition.progress = 0;
    }
    
    if (this.transition.progress >= 1 && this.transition.phase === 'in') {
      this.transition.active = false;
    }
  },
  
  // Draw transition effect
  drawTransition(ctx, screenW, screenH) {
    if (!this.transition.active) return;
    
    const p = this.transition.progress;
    const phase = this.transition.phase;
    
    switch (this.transition.type) {
      case 'fade':
        const alpha = phase === 'out' ? p : 1 - p;
        ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
        ctx.fillRect(0, 0, screenW, screenH);
        break;
        
      case 'warp':
        // Warp tunnel effect
        const warpAlpha = phase === 'out' ? p : 1 - p;
        ctx.fillStyle = `rgba(0, 0, 20, ${warpAlpha * 0.9})`;
        ctx.fillRect(0, 0, screenW, screenH);
        
        // Streaking stars
        ctx.strokeStyle = `rgba(100, 200, 255, ${warpAlpha})`;
        ctx.lineWidth = 2;
        const centerX = screenW / 2;
        const centerY = screenH / 2;
        
        for (let i = 0; i < 20; i++) {
          const angle = (i / 20) * Math.PI * 2;
          const innerR = 50 + p * 100;
          const outerR = 100 + p * 300;
          
          ctx.beginPath();
          ctx.moveTo(
            centerX + Math.cos(angle) * innerR,
            centerY + Math.sin(angle) * innerR
          );
          ctx.lineTo(
            centerX + Math.cos(angle) * outerR,
            centerY + Math.sin(angle) * outerR
          );
          ctx.stroke();
        }
        break;
    }
  },
  
  // Show hub UI elements
  showHubUI() {
    WorldBoundary.showHubUI();
  },
  
  // Show combat UI elements
  showCombatUI() {
    WorldBoundary.showCombatUI();
  },
  
  // Show death screen
  showDeathScreen() {
    this.currentScene = 'gameover';
    State.scene = 'gameover';
    
    // Calculate run stats
    const stats = State.run.stats;
    WorldBoundary.showDeathScreen(stats);
  },
  
  // Continue from death (return to hub)
  continueFromDeath() {
    WorldBoundary.hideDeathScreen();
    
    this.goToHub();
  },
  
  // Get current scene
  getScene() {
    return this.currentScene;
  },
  
  // Check if in combat
  isInCombat() {
    return this.currentScene === 'combat';
  },
  
  // Check if in hub
  isInHub() {
    return this.currentScene === 'hub';
  }
};

export default SceneManager;
