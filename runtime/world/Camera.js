// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// Camera.js - Player-Centered Camera System
// ============================================================
// Follows player with smooth lerp, handles map boundaries

import { State } from '../State.js';

export const Camera = {
  x: 0,
  y: 0,
  targetX: 0,
  targetY: 0,
  
  // Config (can be overridden from config.json)
  smoothing: 0.08,      // Lower = smoother/slower follow
  deadzone: 50,         // Pixels before camera starts following
  lookahead: 0,         // Look ahead in movement direction
  shake: { x: 0, y: 0, intensity: 0, duration: 0 },
  
  // Initialize camera
  init(startX = 0, startY = 0) {
    this.x = startX;
    this.y = startY;
    this.targetX = startX;
    this.targetY = startY;
    this.shake = { x: 0, y: 0, intensity: 0, duration: 0 };
  },
  
  // Update camera position
  update(dt, screenWidth, screenHeight) {
    const player = State.player;
    const map = State.world?.currentZone;
    
    if (!player) return;
    
    // Target = player center
    this.targetX = player.x - screenWidth / 2;
    this.targetY = player.y - screenHeight / 2;
    
    // Optional: Look ahead based on velocity
    if (this.lookahead > 0) {
      this.targetX += player.vx * this.lookahead;
      this.targetY += player.vy * this.lookahead;
    }
    
    // Clamp to map boundaries if map exists
    if (map) {
      const mapW = map.width || 2000;
      const mapH = map.height || 2000;
      this.targetX = Math.max(0, Math.min(mapW - screenWidth, this.targetX));
      this.targetY = Math.max(0, Math.min(mapH - screenHeight, this.targetY));
    }
    
    // Smooth follow (lerp)
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    
    // Only move if outside deadzone
    if (Math.abs(dx) > this.deadzone || Math.abs(dy) > this.deadzone) {
      this.x += dx * this.smoothing;
      this.y += dy * this.smoothing;
    }
    
    // Screen shake
    if (this.shake.duration > 0) {
      this.shake.duration -= dt;
      const intensity = this.shake.intensity * (this.shake.duration / this.shake.maxDuration);
      this.shake.x = (Math.random() - 0.5) * intensity * 2;
      this.shake.y = (Math.random() - 0.5) * intensity * 2;
    } else {
      this.shake.x = 0;
      this.shake.y = 0;
    }
  },
  
  // Get final camera position (with shake)
  getX() {
    return Math.round(this.x + this.shake.x);
  },
  
  getY() {
    return Math.round(this.y + this.shake.y);
  },
  
  // Apply camera transform to context
  applyTransform(ctx) {
    ctx.translate(-this.getX(), -this.getY());
  },
  
  // Reset transform
  resetTransform(ctx) {
    ctx.translate(this.getX(), this.getY());
  },
  
  // Trigger screen shake
  triggerShake(intensity = 5, duration = 0.2) {
    // Only override if stronger
    if (intensity > this.shake.intensity || this.shake.duration <= 0) {
      this.shake.intensity = intensity;
      this.shake.duration = duration;
      this.shake.maxDuration = duration;
    }
  },
  
  // Convert screen coords to world coords
  screenToWorld(screenX, screenY) {
    return {
      x: screenX + this.getX(),
      y: screenY + this.getY()
    };
  },
  
  // Convert world coords to screen coords
  worldToScreen(worldX, worldY) {
    return {
      x: worldX - this.getX(),
      y: worldY - this.getY()
    };
  },
  
  // Check if world position is visible on screen
  isVisible(worldX, worldY, margin = 100, screenW = 800, screenH = 600) {
    const screen = this.worldToScreen(worldX, worldY);
    return screen.x > -margin && 
           screen.x < screenW + margin &&
           screen.y > -margin && 
           screen.y < screenH + margin;
  },
  
  // Snap camera instantly (no lerp)
  snapTo(x, y) {
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
  },
  
  // Center on player instantly
  centerOnPlayer(screenWidth, screenHeight) {
    const player = State.player;
    if (player) {
      this.snapTo(
        player.x - screenWidth / 2,
        player.y - screenHeight / 2
      );
    }
  }
};

export default Camera;
