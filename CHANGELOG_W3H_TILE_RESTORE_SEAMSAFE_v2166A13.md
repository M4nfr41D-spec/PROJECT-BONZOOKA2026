# BONZOOKAA v2166A13 — W3H Tile Restore + Seam-Safe Draw Pass

## File basis
- Input master: `bonzookaa_v2166A12_W3G_NEBULA_VISIBILITY_MASTER.zip`

## Problem addressed
- Space / nebula / corruption combat zones lost readable floor presence after the previous visibility pass.
- White seam / frame artifacts were still bleeding through tile edges.
- Wall obstacle tiles could still show bright / hard outer borders due to source-image edges.

## Changes
- Restored floor-tile rendering in space combat themes instead of suppressing it entirely.
- Kept the new solid room / corridor base underneath, so the background no longer dominates through the floor.
- Added `drawSeamSafeImage(...)` helper in `runtime/world/World.js`.
- Corridor floor tiles now draw via seam-safe cropped source sampling.
- Room floor tiles now draw via seam-safe cropped source sampling.
- Wall obstacle tiles now draw via seam-safe cropped source sampling.
- Space combat themes keep lower floor alpha than land / hybrid themes, so readability stays controlled instead of over-busy.

## Expected result
- Tiles / room surfaces / corridor presence are visible again in nebula-space combat zones.
- White tile-edge frames should be strongly reduced or eliminated.
- Obstacles should remain visible instead of disappearing with the floor pass.
