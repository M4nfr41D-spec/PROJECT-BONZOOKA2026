# BONZOOKAA v2.16.1 — Director Full Stable Implementation

## Base
- Master base: `bonzookaa v2160 flow patch 3.zip`
- Goal: clean director integration without legacy `_updateDirectorPacing` call-chain

## Core fixes
- Added `runtime/Director.js` as the single canonical pacing module
- Added `data/director.json` and wired it through `DataLoader.js`
- Added `runtime/ObjectPool.js` and stable registration/reset in `main.js`
- Integrated `Director.update(dt, State.player, State.run)` exactly once in `Game.updateCombat()`
- Explicit reset on portal start, death, and return-to-hub

## Runtime hooks
- `Player.takeDamage()` -> `Director.onPlayerHit()`
- `Enemies.damage()` -> `Director.onDamageDealt()`
- `Enemies.kill()` -> `Director.onEnemyKill()`
- `Bullets.checkLootDrop()` now applies director loot multiplier
- `Bullets.onEnemyKilled()` now applies director XP multiplier + reward cell bonus

## World pacing
- Dynamic spawn radius driven by `Director.spawnRateMult`
- Reinforcement spawns in BUILD/PEAK/AMBUSH phases
- Elite promotion chance now combines lane promotion + director promotion
- Hazard cadence scaled by director hazard multiplier

## Visibility / debug
- Added compact combat HUD for phase + intensity
- Added floating `DIR` debug button with overlay stats
- Overlay shows phase, intensity, stress, spawn budget, elite chance, reward/xp mult, relief timer, depth
- Overlay allows force-phase testing: BUILD / PEAK / RELAX / REWARD / AMBUSH / RESET

## Regression avoided
- No `_updateDirectorPacing()` method reference retained
- No World loop private-method contract required
- Director uses `State` import directly, not fragile global lookup
