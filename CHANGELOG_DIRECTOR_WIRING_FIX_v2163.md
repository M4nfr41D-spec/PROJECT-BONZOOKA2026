# BONZOOKAA v2.16.3 — Director Wiring Fix

## P0 Fix: Director.update() Now Called
- **Root cause**: `Director.update(dt, State.player, State.run)` was never invoked in `main.js:updateCombat()`
- Director init/reset/HUD/forcePhase all worked, but the core per-frame intensity cycling was **inert**
- **Fix**: Single-line insertion after `World.update(dt)`, before `Player.update(dt)`
- Now active: BUILD → PEAK → RELAX → REWARD → AMBUSH phase cycling
- Now active: adaptive stress tracking, dynamic spawn rate modifiers, loot/XP multipliers
- Existing hooks in Enemies.js (onDamageDealt, onEnemyKill) and Bullets.js (getModifiers for xp/loot/cells) already wired via State.modules — no changes needed

## P2 Fix: Player Sprite States fire + hit
- Added `fire` and `hit` entries to `assets/sprite_manifest.json`
- Added matching entries to `runtime/EmbeddedSpriteManifest.js`
- Created placeholder PNGs (256×256 semi-transparent tint) at `assets/sprites/player/ship/fire.png` and `hit.png`
- Runtime already has `_fireFlash` and `_hitFlash` vars in Player.js — sprite fallback pattern handles gracefully

## Files Changed
- `main.js` — 1 line added (Director.update call)
- `assets/sprite_manifest.json` — 2 entries added (player.ship.fire, player.ship.hit)
- `runtime/EmbeddedSpriteManifest.js` — 2 entries added (matching)
- `assets/sprites/player/ship/fire.png` — NEW placeholder
- `assets/sprites/player/ship/hit.png` — NEW placeholder

## Validation
- All 39 JS files pass `node --check` — zero errors
- Manifest JSON validates clean
- Director guard `if (!runState?.active) return` ensures no-op outside combat
