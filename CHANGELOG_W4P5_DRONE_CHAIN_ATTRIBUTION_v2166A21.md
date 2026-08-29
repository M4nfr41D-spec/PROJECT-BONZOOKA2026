# CHANGELOG — v2166A21
## W4P5 Drone damage nerf + collateral kill attribution

### File basis
- Input master: `bonzookaa_v2166A20_W4P4_WEAPON_PATTERN_LOCK_MASTER.zip`

### What changed
- Combat drone damage reduced from 25% base scaling to 12% base scaling.
- Combat drone cadence slowed from the old 0.5s baseline to a 0.75s baseline.
- Combat drone target range reduced from 400 to 320.
- Combat drone crit chance no longer mirrors full player crit chance; it now uses a restrained fraction.
- Drone bullets are tagged with `source: 'drone'` and no longer trigger the player's on-kill chain/AoE propagation stack.
- Collateral kills now properly resolve rewards/objective/streak attribution for:
  - missile splash
  - shock spread
  - chain lightning
  - AoE on kill
  - volatile death explosions
- Added a central collateral-kill resolver inside `Bullets.js` so secondary kills are counted consistently.

### Why
- Drone was replacing the player too easily in mid-run states.
- Chain/lightning/splash/volatile kills could kill enemies visually but fail to count for execution/objective progress and rewards.

### Files changed
- `runtime/Bullets.js`
- `runtime/Player.js`
- `runtime/Stats.js`
- `runtime/State.js`
