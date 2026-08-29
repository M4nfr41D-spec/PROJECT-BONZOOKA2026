# CHANGELOG — v2166A9 W3D Render Correctness Pass

## Base
- Master input: `bonzookaa_v2166A8_W3C_RNG_UNIT_HOTFIX_MASTER.zip`

## Goal
Stabilize the world/map/theme render stack before any further biome rollout.

## Core fixes

### 1) Ship-tethered readability fog removed
- `runtime/world/Background.js`
- Replaced screen-anchored fog blobs with deterministic world-space fog banks.
- Fog now uses seeded world positions + parallax/drift and no longer rides with the player ship.
- Broad tint wash kept, but reduced.

### 2) Room-floor grid stamping removed for terrain theme overlays
- `runtime/world/World.js`
- Theme room-floor surfaces are no longer drawn as repeated 256px image stamps per room cell.
- Theme floors now use clipped pattern fills over the full room/corridor footprint.
- This removes the visible hard grid/frame artifacts created by scaling large terrain images into small room cells.

### 3) Transition and macro assets no longer treated like seamless repeat tiles
- `runtime/world/ThemeScatter.js`
- Transition/macro surfaces now render as stamped overlays instead of repeated patterns.
- Macro overlays are now sparse and cluster-based rather than wallpaper-style repetition.

### 4) Theme asset usage is now sanitized by role
- `runtime/world/TerrainThemes.js`
- Added usage-aware validation for:
  - backdrop surfaces
  - accent surfaces
  - room-floor surfaces
  - transition surfaces
  - macro surfaces
- Invalid surface-role combinations are now nulled or safely replaced.
- Prevents transition assets from silently being used as generic room-floor fills.

### 5) Auto-roll narrowed to conservative production-safe themes
- `runtime/world/TerrainThemes.js`
- Temporarily disabled automatic rollout for highly experimental/detail-heavy themes:
  - `neon_district`
  - `hive_brood`
  - `flesh_bloom`
  - `void_geode`
  - `abyss_web`
- These remain available for explicit/manual rollout later.

### 6) Wasteland room-floor misuse corrected
- `runtime/world/TerrainThemes.js`
- `wasteland_outpost` no longer uses the sand→steel transition texture as its main room floor.
- Transition stays a transition layer; floor uses a stable sand base.

### 7) Starfield suppression for non-space surface modes
- `runtime/world/TerrainThemes.js`
- `starfieldAlphaResolved` now collapses to `0` for non-space themes.
- This prevents stars from leaking through land/overland scenes.

## Files changed
- `runtime/world/Background.js`
- `runtime/world/World.js`
- `runtime/world/ThemeScatter.js`
- `runtime/world/TerrainThemes.js`

## Verification
- `node --check runtime/world/TerrainThemes.js`
- `node --check runtime/world/Background.js`
- `node --check runtime/world/ThemeScatter.js`
- `node --check runtime/world/World.js`

## Notes
This is a render-correctness pass, not a content expansion pass.
No changes were made to:
- loot
- persistence
- modals
- combat systems
- crafting / forge
