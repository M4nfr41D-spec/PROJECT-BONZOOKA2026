# CHANGELOG — v2166A18 — W4P3 Weapon Projectile Budget + Zone Ownership

## File basis
Input master:
- `bonzookaa_v2166A17_W4P1_DERELICT_PERFORMANCE_LOCK_MASTER.zip`

## Scope
Combat/performance pass only:
- weapon-dependent projectile range and lifetime
- zone ownership and projectile flush on zone transitions
- Nova converted to true close-range AoE pulse
- plasma shifted toward close-range spreader behavior
- railgun gains stationary-shot bonus logic

## Changed files
- `runtime/Bullets.js`
- `runtime/Player.js`
- `runtime/State.js`
- `runtime/world/World.js`

## Key implementation points
### Bullets.js
- added zone-key ownership for player and enemy bullets
- added `flushForZoneTransition()`
- added per-weapon projectile profiles:
  - laser
  - missile
  - gatling
  - plasma
  - railgun
  - nova
- added `maxRange`, `maxLifetime`, `distanceTraveled`, `spawnX/Y`
- player/enemy bullets now self-expire by range/lifetime
- bullets from previous zones are culled immediately on zone mismatch
- damage now uses weapon-specific distance multipliers
- added `triggerNovaPulse()` for true close-range nova AoE

### Player.js
- `nova` no longer spawns roaming projectile ring
- nova now triggers radial AoE pulse around player
- fired bullets store `weaponType` and `stationaryShot`
- railgun stationary-shot bonus now has runtime data support

### State.js
- weapon labels updated for readability:
  - Plasma Spreader
  - Railgun Sniper
  - Missile Pod
  - Gattling Cannon
- plasma projectile count bumped toward spreader identity

### World.js
- zone load now flushes all projectiles to prevent cross-zone carryover

## Design mapping implemented
### Laser
- range: 1x screen radius
- constant damage over range

### Missile
- full damage from 0.5x screen radius outward
- close-range damage falls to 50%

### Gattling Cannon
- max damage until 0.5x screen radius
- falls to 25% at 1x screen radius

### Nova
- close-range AoE pulse
- radius ≈ 3 player lengths

### Plasma Spreader
- 125% damage up to 2 player lengths
- falls to 0 by 4 player lengths
- short-range spread behavior

### Railgun Sniper
- range: 2 screen widths
- 100% at 0.5x screen radius
- 150% at 1x screen radius if fired while standing still
- close-range damage falls toward 25%

## Expected outcomes
- no bullets surviving portal jumps
- no offscreen cross-zone kills
- reduced projectile simulation load in large/empty zones
- much stronger weapon identity by distance band
