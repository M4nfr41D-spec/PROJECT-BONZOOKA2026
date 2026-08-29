// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// Contracts.js - Runtime contracts / invariants (DOM, state)
// ============================================================

function uniq(arr) {
  return [...new Set(arr)];
}

export const Contracts = {
  // Successful checks are cached per-scope so we can assert contracts lazily
  // (only when a feature is actually used) without re-scanning the DOM every time.
  _checkedScopes: new Set(),

  // ---- DOM CONTRACTS ----
  REQUIRED_DOM_BOOT: [
    'gameCanvas',
    'gameContainer'
  ],

  REQUIRED_DOM_HUD: [
    'hudCells',
    'hudScrap',
    'levelBadge',
    'waveDisplay',
    'xpBar',
    'xpText',
    'hpBar',
    'hpText',
    'shieldBar',
    'shieldText'
  ],

  REQUIRED_DOM_DEATH: [
    'deathModal',
    'deathWave',
    'deathKills',
    'deathDmg',
    'deathTime',
    'deathScrapEarned',
    'deathXP'
  ],

  REQUIRED_DOM_HUB: [
    'hubModal',
    'hubScrap',
    'hubLevel',
    'actList'
  ],
  REQUIRED_DOM_START: [],

  REQUIRED_DOM_VENDOR: [
    'vendorModal',
    'vendorGrid',
    'vendorCells'
  ],

  REQUIRED_DOM_META_PANELS: [
    'equipmentGrid',
    'stashGrid',
    'shipStats',
    'pilotStats',
    'statPointsNum',
    'skillTrees',
    'skillPointsNum',
    'tooltip'
  ],

  requireDom(ids, scope = 'dom') {
    const missing = [];
    for (const id of ids) {
      if (!document.getElementById(id)) missing.push(id);
    }
    if (missing.length) {
      const msg =
        ` DOM contract failed (${scope}). Missing IDs:\n` +
        missing.map(x => ` - ${x}`).join('\n');
      // Throwing is intentional: fail fast with a precise list.
      throw new Error(msg);
    }
    return true;
  },

  // Like requireDom, but caches successful checks per scope.
  // Use this from gameplay flows so optional UI modules can be removed safely
  // as long as their features are not invoked.
  ensureDom(ids, scope = 'dom') {
    if (this._checkedScopes.has(scope)) return true;
    this.requireDom(ids, scope);
    this._checkedScopes.add(scope);
    return true;
  },

  // High-level guards
  assertBoot() {
    this.ensureDom(this.REQUIRED_DOM_BOOT, 'boot');
  },

  assertCombatHUD() {
    this.ensureDom(uniq([...this.REQUIRED_DOM_BOOT, ...this.REQUIRED_DOM_HUD]), 'combat-hud');
  },

  assertDeathUI() {
    this.ensureDom(uniq([...this.REQUIRED_DOM_DEATH]), 'death');
  },

  assertHubUI() {
    this.ensureDom(uniq([...this.REQUIRED_DOM_HUB]), 'hub');
  },

  assertStartUI() { return true; },

  assertVendorUI() {
    this.ensureDom(uniq([...this.REQUIRED_DOM_VENDOR]), 'vendor');
  },

  assertMetaPanelsUI() {
    this.ensureDom(uniq([...this.REQUIRED_DOM_META_PANELS]), 'meta-panels');
  },

  assertFullUI() {
    // Legacy convenience guard: still useful for CI, but should not be called
    // in-game. Prefer the lazy asserts above.
    this.ensureDom(
      uniq([
        ...this.REQUIRED_DOM_BOOT,
        ...this.REQUIRED_DOM_HUD,
        ...this.REQUIRED_DOM_DEATH,
        ...this.REQUIRED_DOM_HUB,
        ...this.REQUIRED_DOM_START,
        ...this.REQUIRED_DOM_VENDOR,
        ...this.REQUIRED_DOM_META_PANELS,
      ]),
      'full-ui'
    );
  }
};
