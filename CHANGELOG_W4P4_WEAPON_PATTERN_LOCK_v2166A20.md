# CHANGELOG — v2166A20 — W4P4 Weapon Pattern Lock

## File basis
Input master: `bonzookaa_v2166A19_W4P3_PROJECTILE_HOTFIX_MASTER.zip`

## Scope
Tight combat-only pass:
- weapon fire patterns
- projectile cadence / spread / speed identity
- missile wing launch + homing + small splash
- plasma spreader restored to real forward burst
- laser converted to rapid red lance projectiles
- railgun pushed harder into sniper identity

## Changed files
- `runtime/State.js`
- `runtime/Player.js`
- `runtime/Bullets.js`

## Main changes
### Weapon definitions rebalanced
- Laser: higher fire rate, lower per-shot damage, faster projectile, red identity
- Plasma: 5-projectile front burst, higher speed, short-range close burst identity
- Railgun: much faster projectile, lower cadence, sniper role preserved
- Missile: slower cadence, stronger tracking identity, twin-wing launch pattern
- Gatling: very high cadence, 3-shot burst pattern with tighter 17° total cone

### Player fire patterns
- Missiles now launch as a **2-round wing salvo** from left/right hardpoints instead of one nose shot
- Plasma Spreader restored to a proper forward cone burst instead of a heavy single orb feel
- Per-weapon audio routing improved in `Player.fire()`

### Projectile behaviour
- Player missiles now steer toward the nearest valid enemy (`homing` + `turnRate`)
- Player missiles now carry a **small splash radius** approximately around ship-box scale
- Missile splash is applied on enemy impact and on hard obstacle impact

### Visual fallback
- Manual laser fallback render switched from cyan bolt to **white-hot red lance**

## Explicitly not changed
- drone behaviour / drone nerf
- chain-lightning objective counting
- world / topology / events / POIs
- UI / meta systems
- asset merge pipeline

## Notes
This pass is intentionally pattern-focused. It does not yet merge Manfred's newer custom projectile art assets into the master.
