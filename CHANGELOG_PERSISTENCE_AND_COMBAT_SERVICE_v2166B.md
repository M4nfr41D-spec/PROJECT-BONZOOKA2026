# CHANGELOG v2166B — Persistence Hardening + Unified Combat Service Modal

## File basis
- Base: `bonzookaa_v2164_deep_maps 4.zip`
- Working folder: `bonzookaa_v2166B/`

## What changed

### 1) Persistence hardening
- Upgraded save payload to `bonzookaa_save_v4`
- Save now includes:
  - `meta`
  - `settings`
  - `scene`
  - lightweight `runSnapshot`
- Added lifecycle flushes on:
  - `pagehide`
  - `beforeunload`
  - `visibilitychange`
- Added 15s heartbeat autosave
- Added post-boot save to stabilize fresh sessions
- Corrupted-save cleanup now uses `Save.delete()` instead of removing only an obsolete key

### 2) Refresh recovery
- If the page is refreshed during combat, load now recovers the save and safely salvages pending run-state progression into meta where appropriate:
  - pending earned scrap gets banked
  - best depth / lane depth is preserved
  - run is reset back to a safe hub state instead of losing everything

### 3) More aggressive autosave triggers
- XP gain now autosaves
- Stash add/remove autosaves
- Equip/unequip autosaves
- Sell autosaves
- Pickup collection now autosaves for:
  - cells snapshot
  - scrap snapshot
  - item pickups
  - health/coolant snapshots
  - XP pickups

### 4) Combat keys no longer route into the old legacy modals
- Added a new unified `combatServiceModal`
- `I` now opens inventory in the new modal
- `P` now opens paragon in the new modal
- `T` now opens skills in the new modal
- `ESC` closes the unified modal first
- The new modal uses tabs and larger genre-appropriate management layout

## Files changed
- `runtime/Save.js`
- `runtime/Input.js`
- `runtime/Items.js`
- `runtime/Pickups.js`
- `runtime/Leveling.js`
- `main.js`
- `index.html`

## Intent
This patch is focused on two concrete pain points only:
1. prevent refresh from nuking progression
2. stop combat hotkeys from opening the old cramped management overlays
