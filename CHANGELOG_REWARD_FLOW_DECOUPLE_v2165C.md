# CHANGELOG — v2165C Reward Flow Decouple

## File basis
Master base: `bonzookaa_v2160/` from `bonzookaa_v2164_deep_maps 4.zip`

## Goal
First low-risk decoupling cut for reward handling so combat, pickups, and UI no longer each own overlapping reward logic.

## Added
- `runtime/Rewards.js`
  - central enemy-kill economy resolution
  - central item-pickup resolution
  - safe bridge for UI, missions, achievements, and audio hooks

## Changed
- `main.js`
  - imports and registers `Rewards`
- `runtime/State.js`
  - adds `Rewards` slot to default module registry
- `runtime/Bullets.js`
  - `onEnemyKilled()` now delegates XP / cells / scrap / loot-roll orchestration to `Rewards`
  - combat-specific logic remains in `Bullets`
- `runtime/Pickups.js`
  - item pickup resolution delegated to `Rewards`
  - pickup module stays focused on spatial pickup behavior and visual hooks

## Result
- `Bullets` no longer owns most economy / progression consequences of a kill
- `Pickups` no longer directly resolves item generation + stash write + mission / achievement side effects
- reward logic now has one runtime home, making the next event-layer cut safer

## Notes
- `checkLootDrop()` remains in `Bullets` for this patch and is invoked through a delegated callback
- this is an intentional low-risk intermediate cut, not the final event-bus architecture
