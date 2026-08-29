# CHANGELOG — v2166A3 W1B Overlay / Grid / Depth Boundary

## File basis
- Base master: `bonzookaa_v2166A2_W1A_WORLD_BOUNDARY_MASTER`
- Scope: **World / Map / Overlay / Visual Depth only**

## Intent
This patch does **not** redesign the generator or the meta UI.
It establishes a safer world-visual foundation by separating:
- collision/navigation/query concerns
- render-layer buckets
- overlay metadata
- depth/atmosphere profile values

## Added
- `runtime/world/WorldLayers.js`

## Changed
- `runtime/world/World.js`
- `runtime/world/WorldBoundary.js`
- `runtime/world/Background.js`
- `runtime/world/index.js`
- `runtime/State.js`

## What is new
### 1) Zone layer canonicalization
Each generated zone now gets a canonical layer state via `WorldLayers.ensureZone(...)` with:
- `atmosphereBack`
- `landmarks`
- `microDecorations`
- `wallObstacles`
- `interactiveObstacles`
- `structuresScene`
- POI/exit overlay metadata

### 2) Explicit world-grid metadata
World now exposes separate world metadata for:
- collision
- navigation
- overlay
- runtime spatial query grid
- depth/layer profile

This is written into `State.world.*` via `WorldBoundary` while keeping the old `_spatialGrid` back-compat path intact.

### 3) Depth profile hooks
A biome/depth-aware profile now exists for safe visual scaling:
- atmosphere alpha
- room glow alpha
- wall alpha
- landmark alpha
- micro-decoration alpha
- foreground wisp alpha
- structure glow alpha
- shadow alpha

### 4) Safe render wiring
`World.draw()` now consumes canonical layer buckets instead of repeatedly re-deciding the same category mix inline.
This reduces coupling and makes later depth passes safer.

### 5) Tiled background receives profile input
`Background.draw()` now reads the zone depth profile to scale stars / nebula / particles more coherently with deeper zones.

## Behavior notes
- No modal / meta-UI / loot / persistence changes
- No generator-logic rewrite
- No overlay-debug redesign yet
- Existing gameplay should remain behavior-compatible

## Strategic payoff
This patch creates the technical footing for the next steps:
- stronger depth stack
- clearer occlusion strategy
- visual overlay clarity
- biome identity pass
- later scene gravitas upgrades without cross-breaking world logic
