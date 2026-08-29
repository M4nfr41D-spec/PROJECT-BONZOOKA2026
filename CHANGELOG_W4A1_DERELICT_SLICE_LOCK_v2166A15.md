# CHANGELOG — W4A.1 Derelict Slice Lock (v2166A15)

## File basis
- Freeze anchor: `bonzookaa_v2166A13_W3H_TILE_RESTORE_SEAMSAFE_MASTER.zip`

## Purpose
Lock the world stack into a **single-biome vertical slice** for Derelict Fleet validation.

This is a routing / topology preparation pass only.
It does **not** implement the full topology graph yet.

## What changed

### New
- `runtime/world/SliceLock.js`
  - central single-biome vertical-slice routing lock
  - forces biome = `derelict`
  - forces theme = `derelict_plateyard`

### Changed
- `runtime/world/World.js`
  - applies slice lock to initial tier/act config
  - applies slice lock on tier transitions
  - applies slice lock to generated zones and boss zones

- `runtime/world/TerrainThemes.js`
  - terrain theme resolution now respects slice lock
  - all zones resolve to Derelict biome + `derelict_plateyard` theme while slice lock is enabled

- `runtime/world/index.js`
  - exports `SliceLock`

## Operational effect
- biome routing is now **Derelict Fleet only**
- no multi-biome theme spread during the slice
- architecture remains multi-biome capable; the lock is centralized rather than hardcoded everywhere

## Explicitly not touched
- modals / hub / loot / stash
- persistence
- crafting / forge
- enemy visuals / player visuals
- bullet system
- director economy
- full topology graph / room budgets / event sockets

## Next intended step
- W4A.2 — topology schema + node/path/purpose budgets on top of this derelict-only slice lock
