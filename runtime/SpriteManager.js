// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// SpriteManager.js v2.1 — Sprite Sheet Engine
// v2.15.0 FIX: _comment/_spec no longer blocks loading
//
// Manifest format (exported by Asset Manager):
// {
//   "_comment": "optional metadata — SKIPPED by loader",
//   "enemies": {
//     "grunt": {
//       "size": 128,
//       "patrol": { "file": "sprites/enemies/grunt_patrol.png", "cols": 2, "rows": 1, "frames": 2, "fps": 4, "loop": true },
//       "death":  { "file": "sprites/enemies/grunt_death.png",  "cols": 4, "rows": 1, "frames": 4, "fps": 12, "loop": false }
//     }
//   }
// }
//
// Each state = one PNG sprite sheet with frames in a grid.
// Runtime slices frames via drawImage source rects — zero pre-processing.
// Graceful fallback: if no manifest or missing sprite → returns false → canvas primitives still work.
// ============================================================

import { State } from './State.js';
import { EmbeddedSpriteManifest } from './EmbeddedSpriteManifest.js';

const _sheets = {};     // { filePath: Image }
const _manifest = {};   // parsed manifest
let _loaded = false;
let _loadProgress = { total: 0, done: 0 };

const _anims = new Map(); // entityRef → animState
const _effects = [];      // one-shot VFX at world positions
const _autoSequences = new Map(); // def.file|cols|rows -> non-empty frame sequence

const STATE_ALIASES = {
  move: ['thrust', 'idle'],
  thrust: ['thrust', 'move', 'idle'],
  idle: ['idle', 'patrol'],
  patrol: ['patrol', 'idle', 'aggro'],
  aggro: ['aggro', 'patrol', 'idle'],
  fire: ['fire', 'attack', 'aggro', 'patrol', 'idle'],
  attack: ['attack', 'fire', 'aggro', 'patrol'],
  death: ['death', 'destroyed', 'play', 'idle'],
  destroyed: ['destroyed', 'death', 'play', 'idle'],
  play: ['play', 'death', 'idle']
};


function _stateCandidates(stateId) {
  const out = [];
  const seen = new Set();
  const add = (s) => { if (s && !seen.has(s)) { seen.add(s); out.push(s); } };
  add(stateId);
  (STATE_ALIASES[stateId] || []).forEach(add);
  return out;
}

function _resolveState(category, entityId, stateId) {
  const ent = _manifest[category]?.[entityId];
  if (!ent) return null;
  for (const s of _stateCandidates(stateId)) {
    const def = ent[s];
    if (def && def.file) return { stateId: s, def };
  }
  for (const [k, def] of Object.entries(ent)) {
    if (k === 'size') continue;
    if (def && def.file) return { stateId: k, def };
  }
  return null;
}


function _parseSequenceSpec(spec, maxFrames = 0) {
  spec = (spec || '').trim();
  if (!spec) return null;
  const out = [];
  const seen = new Set();
  const hasZero = /(^|[^0-9])0([^0-9]|$)/.test(spec);
  const oneBased = !hasZero;
  const pushIdx = (v) => {
    v = Number.parseInt(v, 10);
    if (!Number.isFinite(v)) return;
    if (oneBased) v -= 1;
    if (v < 0) return;
    if (maxFrames && v >= maxFrames) return;
    if (!seen.has(v)) { seen.add(v); out.push(v); }
  };
  for (const raw of spec.split(',')) {
    const p = raw.trim();
    if (!p) continue;
    const m = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      let a = Number.parseInt(m[1], 10);
      let b = Number.parseInt(m[2], 10);
      if (oneBased) { a -= 1; b -= 1; }
      if (a <= b) for (let i = a; i <= b; i++) pushIdx(i);
      else for (let i = a; i >= b; i--) pushIdx(i);
    } else pushIdx(p);
  }
  return out.length ? out : null;
}

function _resolveSequence(def) {
  if (!def) return null;
  if (Array.isArray(def.sequence) && def.sequence.length) return def.sequence.slice();
  return _parseSequenceSpec(def.sequenceSpec || '', def.frames || 0);
}

function _getAutoTrimmedSequence(def) {
  if (!def?.autoTrimTransparentFrames) return null;
  const key = [def.file, def.cols || 1, def.rows || 1].join('|');
  if (_autoSequences.has(key)) return _autoSequences.get(key);
  const img = _sheets[def.file];
  if (!img || !img.complete || img.naturalWidth === 0) return null;
  const cols = def.cols || 1;
  const rows = def.rows || 1;
  const total = Math.min((def.frames || (cols * rows)), cols * rows);
  const fw = Math.floor(img.width / cols);
  const fh = Math.floor(img.height / rows);
  const cvs = document.createElement('canvas');
  cvs.width = fw;
  cvs.height = fh;
  const cx = cvs.getContext('2d', { willReadFrequently: true });
  const seq = [];
  for (let i = 0; i < total; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    cx.clearRect(0, 0, fw, fh);
    cx.drawImage(img, col * fw, row * fh, fw, fh, 0, 0, fw, fh);
    const data = cx.getImageData(0, 0, fw, fh).data;
    let nonEmpty = false;
    for (let p = 3; p < data.length; p += 4) {
      if (data[p] > 10) { nonEmpty = true; break; }
    }
    if (nonEmpty) seq.push(i);
  }
  const out = seq.length ? seq : null;
  _autoSequences.set(key, out);
  return out;
}

export const SpriteManager = {

  // ── A43 playback smoothing ──
  // Cross-fade consecutive frames using the sub-frame timer, so choppy low-fps
  // sheets and uneven frame material play fluidly instead of hard-cutting.
  tween: true,
  _tweenMaxFps: 24, // only tween at/below this fps (fast anims are already smooth)

  // ════════════════════════════════════════════
  // INIT — loads sprite_manifest.json, preloads all sheet images
  // ════════════════════════════════════════════

  async init() {
    try {
      let data = null;
      try {
        const resp = await fetch('./assets/sprite_manifest.json');
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        data = await resp.json();
      } catch (fetchErr) {
        if (EmbeddedSpriteManifest) {
          console.warn('[SPRITES] sprite_manifest fetch failed; using embedded fallback:', fetchErr?.message || fetchErr);
          data = JSON.parse(JSON.stringify(EmbeddedSpriteManifest));
        } else {
          throw fetchErr;
        }
      }
      if (!data) {
        console.warn('[SPRITES] No sprite manifest data — canvas fallbacks active');
        return;
      }

      // v2.1 FIX: Skip metadata keys (_comment, _spec) instead of aborting
      const paths = new Set();
      for (const [cat, entities] of Object.entries(data)) {
        if (cat.startsWith('_') || typeof entities !== 'object') continue;
        _manifest[cat] = {};
        for (const [eid, entData] of Object.entries(entities)) {
          if (typeof entData !== 'object') continue;
          _manifest[cat][eid] = { size: entData.size || 128 };
          for (const [key, val] of Object.entries(entData)) {
            if (key === 'size') continue;
            if (val && typeof val === 'object' && val.file) {
              _manifest[cat][eid][key] = val;
              paths.add(val.file);
            }
          }
        }
      }

      if (paths.size === 0) {
        console.warn('[SPRITES] Manifest loaded but 0 sprite entries — canvas fallbacks active');
        _loaded = true;
        return;
      }

      _loadProgress.total = paths.size;
      _loadProgress.done = 0;
      await Promise.allSettled([...paths].map(p => this._loadSheet(p)));
      _loaded = true;
      console.warn('[SPRITES] Loaded ' + _loadProgress.done + '/' + _loadProgress.total + ' sheets');
    } catch (e) {
      console.warn('[SPRITES] Init error:', e.message);
    }
  },

  _loadSheet(path) {
    return new Promise((resolve, reject) => {
      if (_sheets[path]) { _loadProgress.done++; resolve(); return; }
      const img = new Image();
      img.onload = () => { _sheets[path] = img; _loadProgress.done++; resolve(); };
      img.onerror = () => {
        console.warn('[SPRITES] Failed to load: ./assets/' + path);
        _loadProgress.done++;
        reject();
      };
      img.src = './assets/' + path;
    });
  },

  get isLoaded() { return _loaded; },
  get progress() { return _loadProgress; },

  // ════════════════════════════════════════════
  // LOOKUP
  // ════════════════════════════════════════════

  has(category, entityId, stateId) {
    const resolved = _resolveState(category, entityId, stateId);
    return !!(resolved?.def?.file && _sheets[resolved.def.file]);
  },

  getStateDef(category, entityId, stateId) {
    return _resolveState(category, entityId, stateId)?.def || null;
  },

  resolveState(category, entityId, stateId) {
    return _resolveState(category, entityId, stateId)?.stateId || null;
  },

  getEntitySize(category, entityId) {
    return _manifest[category]?.[entityId]?.size || 128;
  },

  // ════════════════════════════════════════════
  // DRAW — slice frame from sheet, render at world position
  // ════════════════════════════════════════════

  drawFrame(ctx, category, entityId, stateId, frameIndex, x, y, angle, displaySize, options) {
    const resolved = _resolveState(category, entityId, stateId);
    const def = resolved?.def;
    if (!def) return false;
    const img = _sheets[def.file];
    if (!img || !img.complete || img.naturalWidth === 0) return false;

    const cols = def.cols || 1;
    const rows = def.rows || 1;
    const seq = _resolveSequence(def);
    const actualFrame = (seq && seq.length) ? seq[frameIndex % seq.length] : frameIndex;
    const fw = img.width / cols;
    const fh = img.height / rows;
    const col = actualFrame % cols;
    const row = Math.floor(actualFrame / cols);

    // Scale sprite to match game entity size
    const scale = (displaySize * 2.5) / Math.max(fw, fh);
    const dw = fw * scale;
    const dh = fh * scale;

    ctx.save();
    ctx.translate(x, y);
    if (angle !== undefined && angle !== null) {
      ctx.rotate(angle + Math.PI / 2); // sprites face UP, game 0 = right
    }
    if (options?.alpha !== undefined) ctx.globalAlpha = options.alpha;

    ctx.drawImage(img, col * fw, row * fh, fw, fh, -dw / 2, -dh / 2, dw, dh);

    // Damage tint flash overlay
    if (options?.tint) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = options.tint;
      ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.restore();
    return true;
  },

  // ════════════════════════════════════════════
  // ANIMATION
  // ════════════════════════════════════════════

  play(entityRef, category, entityId, stateId, options) {
    const resolved = _resolveState(category, entityId, stateId);
    const def = resolved?.def;
    const resolvedStateId = resolved?.stateId;
    if (!def || !resolvedStateId) return null;

    const existing = _anims.get(entityRef);
    if (existing && existing.stateId === resolvedStateId &&
        existing.category === category && existing.entityId === entityId &&
        !options?.force) {
      return existing;
    }

    const anim = {
      category, entityId, stateId: resolvedStateId,
      frame: 0, timer: 0,
      speed: options?.fps || def.fps || 8,
      loop: options?.loop !== undefined ? options.loop : (def.loop !== false),
      totalFrames: ((_resolveSequence(def) || []).length) || def.frames || 1,
      finished: false,
      onComplete: options?.onComplete || null,
    };
    _anims.set(entityRef, anim);
    return anim;
  },

  stop(entityRef) { _anims.delete(entityRef); },

  update(dt) {
    for (const [ref, anim] of _anims) {
      if (anim.finished) continue;
      anim.timer += dt;
      const dur = 1 / anim.speed;
      while (anim.timer >= dur) {
        anim.timer -= dur;
        anim.frame++;
        if (anim.frame >= anim.totalFrames) {
          if (anim.loop) { anim.frame = 0; }
          else {
            anim.frame = anim.totalFrames - 1;
            anim.finished = true;
            if (anim.onComplete) anim.onComplete(ref);
            break;
          }
        }
      }
    }
  },

  // Draw current animation frame. Returns true if sprite drawn.
  // With tween on, cross-fades into the next frame using the sub-frame timer.
  drawAnimated(ctx, entityRef, x, y, angle, displaySize, options) {
    const anim = _anims.get(entityRef);
    if (!anim) return false;

    if (this.tween && !anim.finished && anim.totalFrames > 1 &&
        anim.speed > 0 && anim.speed <= this._tweenMaxFps) {
      const dur = 1 / anim.speed;
      const t = anim.timer > 0 ? Math.max(0, Math.min(1, anim.timer / dur)) : 0;
      if (t > 0.02 && t < 0.98) {
        const baseAlpha = (options?.alpha !== undefined) ? options.alpha : 1;
        let nextFrame = anim.frame + 1;
        if (nextFrame >= anim.totalFrames) nextFrame = anim.loop ? 0 : anim.frame;
        // Same x/y/angle/size for both → clean in-place blend (no positional ghosting)
        const okA = this.drawFrame(ctx, anim.category, anim.entityId, anim.stateId, anim.frame,
          x, y, angle, displaySize, { ...options, alpha: baseAlpha * (1 - t) });
        const okB = this.drawFrame(ctx, anim.category, anim.entityId, anim.stateId, nextFrame,
          x, y, angle, displaySize, { ...options, alpha: baseAlpha * t });
        return okA || okB;
      }
    }
    return this.drawFrame(ctx, anim.category, anim.entityId, anim.stateId, anim.frame, x, y, angle, displaySize, options);
  },

  getAnim(entityRef) { return _anims.get(entityRef) || null; },

  // ════════════════════════════════════════════
  // ONE-SHOT EFFECTS (explosions, shield break, etc.)
  // ════════════════════════════════════════════

  playEffect(effectId, x, y, options) {
    const category = options?.category || 'effects';
    const stateId = options?.state || 'play';
    const key = 'fx_' + effectId + '_' + Date.now() + '_' + Math.random();

    const anim = this.play(key, category, effectId, stateId, {
      loop: false, fps: options?.fps,
      onComplete: () => {
        this.stop(key);
        const idx = _effects.findIndex(e => e.key === key);
        if (idx >= 0) _effects.splice(idx, 1);
      }
    });
    if (anim) {
      _effects.push({ key, x, y, size: options?.size || 40, angle: options?.angle || 0, alpha: options?.alpha || 1 });
    }
    return key;
  },



  chooseEffect(effectIds, stateId = 'play', category = 'effects') {
    const ids = Array.isArray(effectIds) ? effectIds : [effectIds];
    for (const effectId of ids) {
      if (this.has(category, effectId, stateId)) return effectId;
    }
    return null;
  },

  playBestEffect(effectIds, x, y, options) {
    const category = options?.category || 'effects';
    const stateId = options?.state || 'play';
    const effectId = this.chooseEffect(effectIds, stateId, category);
    if (!effectId) return null;
    return this.playEffect(effectId, x, y, { ...options, category, state: stateId });
  },

  drawEffects(ctx) {
    for (const fx of _effects) {
      this.drawAnimated(ctx, fx.key, fx.x, fx.y, fx.angle, fx.size, { alpha: fx.alpha });
    }
  },

  // ════════════════════════════════════════════
  // CLEANUP
  // ════════════════════════════════════════════

  cleanup(predicate) {
    for (const [ref] of _anims) {
      if (typeof ref === 'object' && predicate(ref)) _anims.delete(ref);
    }
  },

  getStats() {
    return {
      loaded: _loaded,
      sheetsLoaded: Object.keys(_sheets).length,
      activeAnims: _anims.size,
      activeEffects: _effects.length,
      progress: { ..._loadProgress }
    };
  },
};
