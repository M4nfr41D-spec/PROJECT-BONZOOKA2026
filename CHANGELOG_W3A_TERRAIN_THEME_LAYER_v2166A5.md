# CHANGELOG — v2166A5 W3A Terrain Surface Registry + Zone Theme Layer

## File Basis
Built strictly on:
- `v2166A4_W2_DEPTH_STACK_MASTER`

## Scope
World / Map / Overlay / Visual Depth only.

No changes to:
- modals
- loot
- save/persistence
- crafting/forge
- combat key routing

## Added
- `runtime/world/TerrainThemes.js`
- `assets/terrain/land_industrial_dark.jpeg`
- `assets/terrain/land_sand_dunes.jpeg`
- `assets/terrain/land_steel_plate.jpeg`
- `assets/terrain/land_sand_to_steel_transition.jpeg`
- `assets/terrain/ref_cosmic_fracture.jpeg`
- `assets/terrain/ref_toxic_wetlands.jpeg`
- `assets/terrain/ref_lava_scar.jpeg`
- `assets/terrain/ref_ruined_city.jpeg`

## Changed
- `runtime/world/Background.js`
- `runtime/world/World.js`
- `runtime/world/WorldLayers.js`
- `runtime/world/index.js`

## What this patch does
- introduces a canonical terrain surface registry
- introduces zone theme profiles for current space biomes plus future land biomes
- prepares seamless land-zone surface assets without forcing a full biome rollout yet
- adds subtle terrain/surface backdrop passes into the background renderer
- adds optional themed room/corridor floor surfacing for theme-enabled zones
- exposes terrain theme metadata into the world layer profile/debug path

## Current biome defaults
- asteroid -> asteroid_belt
- nebula -> nebula_depths
- void -> void_fracture
- derelict -> derelict_plateyard
- blackhole -> blackhole_scar

## Future-ready land themes included
- wasteland_outpost
- toxic_wetland
- lava_scar
- ruined_urban

## Intent
This is the W3A foundation patch:
- surface identity
- theme identity
- transition readiness
- safe separation between surface styling and world logic

The actual stronger biome rollout / scatter / transition expansion should happen in follow-up passes.
