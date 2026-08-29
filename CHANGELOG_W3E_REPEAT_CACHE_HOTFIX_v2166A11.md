# CHANGELOG — v2166A11 W3E Repeat Cache Hotfix

## Base
- From: `bonzookaa_v2166A10_W3E_TILE_SEAM_ATMOSPHERE_MASTER.zip`

## Purpose
Hotfix the Zone 101+ render crash caused by the terrain repeat-source cache being referenced before initialization.

## Root cause
`runtime/world/TerrainThemes.js` introduced `getRepeatSource()` logic that reads and writes `this._repeatCache[...]`, but the `TerrainThemes` singleton did not define `_repeatCache`.

This caused a runtime exception in the background draw path once repeat-pattern terrain rendering was reached:
- `TypeError: Cannot read properties of undefined (reading 'space_void|812x812|2')`

## Changes
- Added `TerrainThemes._repeatCache = Object.create(null)`
- Added a defensive lazy-init guard inside `getRepeatSource()`:
  - `if (!this._repeatCache) this._repeatCache = Object.create(null);`

## Scope
- No biome registry changes
- No layout changes
- No modal / loot / persistence / combat changes
- No asset changes

## Expected result
- Zone 101+ should no longer hard-fail in `Background.drawSurfaceLayer()` because of `_repeatCache` access.
- This is a crash-recovery hotfix only; it does not address broader biome intent / layout density topics.
