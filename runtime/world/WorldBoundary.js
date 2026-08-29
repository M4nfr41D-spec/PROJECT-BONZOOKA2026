// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// WorldBoundary.js - World/Scene side-effect adapter
// ============================================================
// Centralizes world/scene side-effects that previously reached
// directly into DOM, UI, audio, missions and save wiring.
// This is intentionally behavior-preserving.

import { State } from '../State.js';

export const WorldBoundary = {
  forceLayoutResize() {
    requestAnimationFrame(() => requestAnimationFrame(() => window.dispatchEvent(new Event('resize'))));
  },

  clearPauseState() {
    if (State.ui) State.ui.paused = false;
    document.body.classList.remove('paused-ui');
  },

  saveProgress() {
    State.modules?.Save?.save?.();
  },

  renderHub() {
    State.modules?.UI?.renderHub?.();
  },

  showHubUI() {
    const gameUI = document.getElementById('gameUI');
    if (gameUI) gameUI.style.display = 'none';
    const hubUI = document.getElementById('hubUI');
    if (hubUI) hubUI.style.display = 'flex';
    this.renderHub();
  },

  showCombatUI() {
    const gameUI = document.getElementById('gameUI');
    if (gameUI) gameUI.style.display = 'block';
    const hubUI = document.getElementById('hubUI');
    if (hubUI) hubUI.style.display = 'none';
  },

  showDeathScreen(stats) {
    const duration = Math.floor((Date.now() - (stats?.timeStarted || Date.now())) / 1000);
    const modal = document.getElementById('deathModal');
    if (!modal) return;
    const statsEl = modal.querySelector('.death-stats');
    if (statsEl) {
      statsEl.innerHTML = `
        <div>Kills: ${stats?.kills || 0}</div>
        <div>Damage Dealt: ${Math.floor(stats?.damageDealt || 0)}</div>
        <div>Time: ${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}</div>
        <div>Items Found: ${stats?.itemsFound || 0}</div>
      `;
    }
    modal.classList.add('show');
  },

  hideDeathScreen() {
    const modal = document.getElementById('deathModal');
    if (modal) modal.classList.remove('show');
  },

  announce(text, timer = 2) {
    if (!text) return;
    if (State.ui) State.ui.announcement = { text, timer };
  },

  playAudio(methodName) {
    if (!methodName) return;
    const audio = State.modules?.Audio;
    const fn = audio?.[methodName];
    if (typeof fn === 'function') {
      try { fn.call(audio); } catch (_) {}
    }
  },

  emitZoneReached(depth) {
    try { State.modules?.Missions?.onZoneReached?.(depth); } catch (_) {}
    try { State.modules?.Achievements?.onZoneReached?.(depth); } catch (_) {}
  },

  emitPOICleared() {
    try { State.modules?.Missions?.onPOICleared?.(); } catch (_) {}
  },

  antiExploitSnapshot() {
    try { State.modules?.AntiExploit?.snapshotBaseline?.(); } catch (_) {}
  },

  exposeSpatialGrid(grid) {
    State._spatialGrid = grid;
    if (State.world) State.world.spatialQueryGrid = grid;
  },

  exposeCollisionMeta(meta) {
    if (State.world) State.world.collisionMeta = meta || null;
  },

  exposeNavigationMeta(meta) {
    if (State.world) State.world.navigationMeta = meta || null;
  },

  exposeOverlayMeta(meta) {
    if (State.world) State.world.overlayMeta = meta || null;
  },

  exposeLayerProfile(profile) {
    if (State.world) State.world.layerProfile = profile || null;
  },

  centerCameraOnPlayer() {
    const canvas = document.getElementById('gameCanvas');
    const screenW = canvas ? (canvas.width || 1920) : 1920;
    const screenH = canvas ? (canvas.height || 1080) : 1080;
    if (!State.player) return;
    State.camera.x = Math.max(0, State.player.x - screenW / 2);
    State.camera.y = Math.max(0, State.player.y - screenH / 2);
  }
};

export default WorldBoundary;
