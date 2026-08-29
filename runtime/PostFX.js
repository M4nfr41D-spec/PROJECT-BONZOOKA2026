// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// PostFX.js - Post-Processing Effects (Clean & Minimal)
// ============================================================
// Only effects that genuinely improve readability:
//  1. Vignette: darkens edges → focuses attention on center
//  2. Low-HP danger overlay: red edge pulse when near death
// No scanlines, no dust, no bloom spam. Clean > noisy.

import { State } from './State.js';

export const PostFX = {
  vignetteEnabled: true,
  
  // Cached vignette gradient (rebuilt on resize)
  _vignetteW: 0,
  _vignetteH: 0,
  _vignetteGrad: null,
  
  init() {
    // Nothing heavy to init
  },
  
  update(dt) {
    // No per-frame state needed
  },
  
  // Main draw (call after scene, before HUD)
  draw(ctx, screenW, screenH) {
    if (this.vignetteEnabled) {
      this._drawVignette(ctx, screenW, screenH);
    }
    // Corruption objective: progressive red tint
    const obj = State.run?.objective;
    if (obj && obj.type === 'corruption' && obj.progress > 0) {
      const intensity = Math.min(0.25, obj.progress / 100 * 0.25);
      ctx.fillStyle = `rgba(80,0,0,${intensity})`;
      ctx.fillRect(0, 0, screenW, screenH);
    }
  },
  
  _drawVignette(ctx, screenW, screenH) {
    const cx = screenW / 2;
    const cy = screenH / 2;
    const maxR = Math.hypot(cx, cy);
    
    // Cache gradient - only rebuild on resize
    if (this._vignetteW !== screenW || this._vignetteH !== screenH) {
      this._vignetteW = screenW;
      this._vignetteH = screenH;
      const grad = ctx.createRadialGradient(cx, cy, maxR * 0.45, cx, cy, maxR);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.75, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.4)');
      this._vignetteGrad = grad;
    }
    
    ctx.fillStyle = this._vignetteGrad;
    ctx.fillRect(0, 0, screenW, screenH);
    
    // Red edge pulse when low HP (< 30%)
    const p = State.player;
    if (!p) return;
    const hpPct = p.hp / Math.max(1, p.maxHP);
    if (hpPct < 0.3) {
      const danger = (0.3 - hpPct) / 0.3;
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.006);
      const alpha = danger * 0.3 * pulse;
      
      const dGrad = ctx.createRadialGradient(cx, cy, maxR * 0.3, cx, cy, maxR);
      dGrad.addColorStop(0, 'rgba(0,0,0,0)');
      dGrad.addColorStop(0.5, 'rgba(0,0,0,0)');
      dGrad.addColorStop(1, `rgba(180,0,0,${alpha})`);
      ctx.fillStyle = dGrad;
      ctx.fillRect(0, 0, screenW, screenH);
    }
  }
};

export default PostFX;
