// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// TouchControls.js - Dev-phase mobile/iPad controls
// ============================================================
// Minimal on-screen controls for cross-device dev testing:
//   - Left thumbstick  -> movement (sets input.up/down/left/right)
//   - FIRE button      -> input.fire + auto-lock nearest enemy
//   - E button         -> input.interact (enter derelicts/terminals)
// No specials/dash. Appears only on touch devices.
// Force on/off via URL: ?touch=1 / ?touch=0

import { State } from './State.js';

export const TouchControls = {
  enabled: false,
  canvas: null,
  root: null,
  _baseCenter: { x: 0, y: 0 },
  _stickPid: null,
  _stickR: 56,        // max nub travel (px)
  _deadzone: 0.28,
  _firePid: null,
  _fireHeld: false,
  _interPid: null,
  _nub: null,
  _fireBtn: null,

  init(canvas) {
    const force = new URLSearchParams(location.search).get('touch');
    const isTouch = force === '1' ? true
      : force === '0' ? false
      : (navigator.maxTouchPoints > 0 || 'ontouchstart' in window
         || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) // iPadOS desktop-mode masquerade
         || (window.matchMedia && window.matchMedia('(pointer:coarse)').matches));
    if (!isTouch) return;
    this.canvas = canvas;
    this.enabled = true;
    document.documentElement.classList.add('touch'); // A55: enables touch-scoped CSS
    this._build();
    this._loop();
    // A55: block pinch-zoom / double-tap-zoom gestures that interrupt touches (→ stuck inputs)
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('gesturechange', (e) => e.preventDefault());
    let _lastTap = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - _lastTap < 300) e.preventDefault(); // kill double-tap zoom
      _lastTap = now;
    }, { passive: false });
    // A55: enter fullscreen on the first user gesture (best-effort; also a manual ⛶ button)
    const goFsOnce = () => { this._goFullscreen(); window.removeEventListener('pointerdown', goFsOnce); };
    window.addEventListener('pointerdown', goFsOnce);
    window.addEventListener('blur', () => this._resetAll()); // A55: clear ALL inputs on blur (was _resetMove → fire could stick)
    document.addEventListener('visibilitychange', () => { if (document.hidden) this._resetAll(); });
  },

  _goFullscreen() {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen;
    if (req && !document.fullscreenElement) { try { req.call(el); } catch (_) {} }
  },

  // ── DOM + styles ──
  _build() {
    const css = document.createElement('style');
    css.textContent = `
      #tc-root{position:fixed;inset:0;z-index:9000;pointer-events:none;
        font-family:'Orbitron',sans-serif;touch-action:none;
        -webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;}
      #tc-root .tc{pointer-events:auto;touch-action:none;position:fixed;
        display:flex;align-items:center;justify-content:center;}
      #tc-base{left:calc(24px + env(safe-area-inset-left));bottom:calc(28px + env(safe-area-inset-bottom));
        width:150px;height:150px;border-radius:50%;
        background:radial-gradient(circle,rgba(20,24,28,.55),rgba(10,12,14,.35));
        border:2px solid rgba(130,232,79,.35);box-shadow:0 0 18px rgba(130,232,79,.12) inset;}
      #tc-nub{width:64px;height:64px;border-radius:50%;
        background:radial-gradient(circle,rgba(130,232,79,.85),rgba(70,140,40,.6));
        border:2px solid rgba(180,255,140,.8);box-shadow:0 0 14px rgba(130,232,79,.5);
        transition:transform .04s linear;}
      #tc-fire{right:calc(30px + env(safe-area-inset-right));bottom:calc(40px + env(safe-area-inset-bottom));
        width:104px;height:104px;border-radius:50%;color:#ffd9cf;font-weight:700;font-size:15px;letter-spacing:1px;
        background:radial-gradient(circle,rgba(255,70,60,.4),rgba(120,20,16,.35));
        border:2px solid rgba(255,90,70,.6);box-shadow:0 0 16px rgba(255,70,50,.18) inset;}
      #tc-fire.on{background:radial-gradient(circle,rgba(255,120,90,.85),rgba(180,40,30,.7));
        box-shadow:0 0 22px rgba(255,90,60,.7);transform:scale(.96);}
      #tc-int{right:calc(150px + env(safe-area-inset-right));bottom:calc(96px + env(safe-area-inset-bottom));
        width:64px;height:64px;border-radius:50%;color:#bff;font-weight:700;font-size:20px;
        background:radial-gradient(circle,rgba(60,180,220,.35),rgba(20,60,80,.35));
        border:2px solid rgba(90,210,240,.6);box-shadow:0 0 12px rgba(80,200,240,.16) inset;}
      #tc-int.on{background:radial-gradient(circle,rgba(120,220,255,.8),rgba(30,110,150,.7));transform:scale(.94);}
      #tc-hide{top:calc(10px + env(safe-area-inset-top));right:calc(12px + env(safe-area-inset-right));
        width:auto;height:26px;padding:0 10px;border-radius:13px;color:#9ab;font-size:11px;letter-spacing:1px;
        background:rgba(20,24,28,.5);border:1px solid rgba(120,140,160,.4);}
      #tc-fs{top:calc(10px + env(safe-area-inset-top));right:calc(96px + env(safe-area-inset-right));
        width:34px;height:26px;border-radius:13px;color:#9ab;font-size:14px;
        background:rgba(20,24,28,.5);border:1px solid rgba(120,140,160,.4);}
      #tc-root.hidden #tc-base,#tc-root.hidden #tc-fire,#tc-root.hidden #tc-int{display:none;}
    `;
    document.head.appendChild(css);

    const root = document.createElement('div');
    root.id = 'tc-root';
    root.innerHTML = `
      <div id="tc-base" class="tc"><div id="tc-nub"></div></div>
      <div id="tc-fire" class="tc">FIRE</div>
      <div id="tc-int" class="tc">E</div>
      <div id="tc-fs" class="tc">⛶</div>
      <div id="tc-hide" class="tc">TOUCH ⏻</div>`;
    document.body.appendChild(root);
    this.root = root;
    this._nub = root.querySelector('#tc-nub');
    this._fireBtn = root.querySelector('#tc-fire');
    const fsBtn = root.querySelector('#tc-fs');
    fsBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (document.fullscreenElement) { (document.exitFullscreen || document.webkitExitFullscreen)?.call(document); }
      else this._goFullscreen();
    });

    const base = root.querySelector('#tc-base');
    const fire = this._fireBtn;
    const inter = root.querySelector('#tc-int');
    const hide = root.querySelector('#tc-hide');

    // Movement stick
    base.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._stickPid = e.pointerId;
      const r = base.getBoundingClientRect();
      this._baseCenter = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      try { base.setPointerCapture(e.pointerId); } catch (_) {}
      this._moveStick(e.clientX, e.clientY);
    });
    base.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this._stickPid) return;
      e.preventDefault();
      this._moveStick(e.clientX, e.clientY);
    });
    const endStick = (e) => {
      if (e.pointerId !== this._stickPid) return;
      this._stickPid = null;
      this._nub.style.transform = 'translate(0,0)';
      this._resetMove();
    };
    base.addEventListener('pointerup', endStick);
    base.addEventListener('pointercancel', endStick);

    // Fire (with auto-lock)
    fire.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this._firePid != null) return; // A55: ignore 2nd finger (was overwriting pid → stuck fire)
      this._firePid = e.pointerId;
      this._fireHeld = true;
      State.input.fire = true;
      fire.classList.add('on');
      this._ensureLock();
      try { fire.setPointerCapture(e.pointerId); } catch (_) {}
    });
    const endFire = (e) => {
      if (e && e.pointerId !== this._firePid) return;
      this._firePid = null;
      this._fireHeld = false;
      State.input.fire = false;
      fire.classList.remove('on');
    };
    fire.addEventListener('pointerup', endFire);
    fire.addEventListener('pointercancel', endFire);
    // A55: capture lost for ANY reason (OS gesture, callout, app switch) → force-clear, never stick
    fire.addEventListener('lostpointercapture', () => endFire(null));
    // A55: window-level safety net in case the button never sees the release
    window.addEventListener('pointerup', (e) => { if (e.pointerId === this._firePid) endFire(e); });
    window.addEventListener('pointercancel', (e) => { if (e.pointerId === this._firePid) endFire(e); });
    // A57: ultimate anti-stuck — if all fingers are off the screen, fire CANNOT be held
    window.addEventListener('touchend', (e) => { if (this._fireHeld && (e.touches?.length ?? 0) === 0) endFire(null); }, { passive: true });
    window.addEventListener('touchcancel', () => { if (this._fireHeld) endFire(null); }, { passive: true });

    // Interact (E)
    inter.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._interPid = e.pointerId;
      if (!State.input.interact) State.input.interactPressed = true;
      State.input.interact = true;
      inter.classList.add('on');
    });
    const endInter = (e) => {
      if (e.pointerId !== this._interPid) return;
      this._interPid = null;
      State.input.interact = false;
      inter.classList.remove('on');
    };
    inter.addEventListener('pointerup', endInter);
    inter.addEventListener('pointercancel', endInter);

    // Hide/show toggle (when controls cover a menu)
    hide.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      root.classList.toggle('hidden');
      this._resetAll();
    });
  },

  _moveStick(cx, cy) {
    let dx = cx - this._baseCenter.x;
    let dy = cy - this._baseCenter.y;
    const len = Math.hypot(dx, dy) || 1;
    const cl = Math.min(len, this._stickR);
    const ux = (dx / len), uy = (dy / len);
    this._nub.style.transform = `translate(${ux * cl}px,${uy * cl}px)`;
    const nx = (dx / this._stickR), ny = (dy / this._stickR);
    const dz = this._deadzone;
    const i = State.input;
    i.left = nx < -dz; i.right = nx > dz;
    i.up = ny < -dz; i.down = ny > dz;
  },

  _resetMove() {
    const i = State.input;
    i.up = i.down = i.left = i.right = false;
    if (this._nub) this._nub.style.transform = 'translate(0,0)';
  },

  _resetAll() {
    this._resetMove();
    this._fireHeld = false; this._firePid = null; this._stickPid = null; this._interPid = null;
    State.input.fire = false; State.input.interact = false;
    this._fireBtn?.classList.remove('on');
  },

  // While firing, keep a lock so the player auto-aims (Player.js tracks + re-acquires on death)
  _ensureLock() {
    if (State.input.targetLock) return;
    const p = State.player; if (!p) return;
    const en = State.enemies || [];
    let best = null, bd = 900;
    for (const e of en) {
      if (!e || e.dead) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) State.input.targetLock = best.id;
  },

  _loop() {
    const tick = () => {
      if (this._fireHeld) this._ensureLock();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
};

export default TouchControls;
