# CHANGELOG — W2 Depth Stack Pass (v2166A4)

## File basis
Built strictly on:
- `bonzookaa_v2166A3_W1B_OVERLAY_GRID_DEPTH_MASTER`

## Scope
World / Map / Overlay / Visual Depth only.
No changes to:
- modals
- loot / stash
- persistence
- crafting / forge
- combat key routing

## Added
- `runtime/world/DepthStack.js`

## Changed
- `runtime/world/World.js`
- `runtime/world/Background.js`
- `runtime/world/WorldLayers.js`
- `runtime/world/index.js`

## What changed
- Added a dedicated visual depth helper layer (`DepthStack`) to keep atmospheric staging separate from gameplay logic.
- Added screen-space backdrop wash, biome-tinted shafts, and vignette framing in the background pass.
- Added room underlays and corridor fog to make room volumes read more clearly.
- Added soft obstacle shadows to improve wall/structure grounding.
- Added landmark halos to make large scene features feel more spatially anchored.
- Added a foreground veil / drifting wisp pass for stronger depth and scene gravitas.
- Extended `WorldLayers.buildDepthProfile()` with explicit depth-visual parameters for future tuning.

## Design intent
This is a visual-depth foundation pass, not a generator or gameplay refactor.
The goal is to create more:
- spatial separation
- scene layering
- atmosphere
- biome/depth identity
without increasing coupling or risking regressions in unrelated systems.

## Verification
Syntax check passed for:
- `runtime/world/DepthStack.js`
- `runtime/world/WorldLayers.js`
- `runtime/world/Background.js`
- `runtime/world/World.js`
- `runtime/world/index.js`
