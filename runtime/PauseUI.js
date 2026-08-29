// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// PauseUI.js - In-run overlay toggle (Inventory/Skills)
//
// Goals:
// - Keep the game viewport clean during combat
// - Show left/right panels only when paused (overlay)
// - Deterministic, minimal surface area change
// ============================================================

import { State } from './State.js';

export const PauseUI = {
  apply() {
    // CSS controls visibility/positioning for panels + backdrop.
    document.body.classList.toggle('paused-ui', !!State.ui.paused);
  },

  toggle() {
    State.ui.paused = !State.ui.paused;
    this.apply();
  },

  open() {
    State.ui.paused = true;
    this.apply();
  },

  close() {
    State.ui.paused = false;
    this.apply();
  }
};
