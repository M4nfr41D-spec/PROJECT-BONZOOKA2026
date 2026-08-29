# CHANGELOG — v2166A6 — W3B First Land Theme Rollout + Transition/Scatter Pass

## File Basis
Master used for this step:
- `bonzookaa_v2166A5_W3A_TERRAIN_THEME_MASTER`

## Goal
Stay fully inside the World / Map / Overlay / Visual Depth topic and push the next safe visual layer:
- first real rollout of land-capable terrain themes
- deterministic theme transitions per zone
- scene-specific ground storytelling via scatter / channels / debris
- no touches to meta UI, loot, saves, forging, combat modals, or world gameplay logic

## New
- `runtime/world/ThemeScatter.js`

## Updated
- `runtime/world/TerrainThemes.js`
- `runtime/world/Background.js`
- `runtime/world/World.js`
- `runtime/world/index.js`
- `assets/terrain/*` refreshed from latest user-provided seamless/reference tiles

## What changed
### 1) First land theme rollout
Current biomes can now deterministically roll into stronger overland/grounded variants without changing gameplay:
- `derelict` can roll into `ruined_urban` or `wasteland_outpost`
- `nebula` can roll into `toxic_wetland`
- `blackhole` can roll into `lava_scar`
- `asteroid` can rarely roll into `wasteland_outpost`

This remains:
- seed-stable
- depth-aware
- purely visual / thematic

### 2) Theme-specific scatter layer
New deterministic scatter pass for rooms/corridors/world patches:
- tech debris / scrap strips / urban breakup
- toxic channels / wet growth trails
- lava cracks / ember veins
- void shard bursts

### 3) Transition-surface usage
Themes with a transition tile now use it inside rooms/corridors as a low-alpha terrain bridge.
This is especially relevant for:
- sand ↔ steel
- grounded derelict / outpost sectors

### 4) Land-mode starfield reduction
Land themes now suppress the pure-space starfield layer so ground identity reads stronger.
This keeps land sectors from feeling like “space wallpaper with a floor pasted on top”.

## Explicit non-goals
Not touched:
- generator logic
- collision
- navigation
- overlays/debug logic
- loot / stash / persistence
- service modals / hub / combat UI

## Risk profile
Low-to-moderate visual risk only.
No gameplay systems were rewired.

## Expected visible effect
- stronger per-zone identity
- more believable land-like sectors inside the existing world stack
- less generic room flooring
- better scene storytelling via transitions + micro detail
