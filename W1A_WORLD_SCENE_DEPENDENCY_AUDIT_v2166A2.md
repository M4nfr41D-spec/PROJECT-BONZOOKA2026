# W1A — World / Scene Dependency Audit (v2166A2)

## File basis
Master basis: bonzookaa_v2166A1_COMBAT_KEYS_USE_HUB_MODAL

## Audit summary
The world stack is already structurally grouped under `runtime/world/`, but the runtime boundary is still too porous.
The main regression risk does **not** come from procedural generation itself. It comes from world/scene code directly reaching into DOM, UI, audio, missions, achievements, and shared cross-module state.

## Main coupling hotspots

### 1) SceneManager -> DOM/UI coupling
`SceneManager.js` directly toggled DOM nodes (`gameUI`, `hubUI`, `deathModal`), cleared pause classes, and forced layout resize.

### 2) World -> UI/audio coupling
`World.js` directly wrote announcements and triggered audio in multiple zone / POI / reward paths.

### 3) World -> meta systems coupling
`World.js` directly called:
- Missions.onZoneReached
- Missions.onPOICleared
- Achievements.onZoneReached
- AntiExploit.snapshotBaseline

### 4) World -> shared runtime exposure
`World.js` directly exposed `_spatialGrid` onto `State._spatialGrid` for bullet queries.

### 5) World -> camera / DOM coupling
Zone load recenters camera by reaching directly into `gameCanvas` dimensions.

## Safe-cut strategy
### Implemented in this pass
A first boundary adapter was introduced:
- `runtime/world/WorldBoundary.js`

This adapter now owns the touched side-effects for:
- announcements
- world-scene audio hooks
- mission / achievement bridge hooks
- anti-exploit snapshot
- scene UI DOM visibility toggles
- pause clearing
- save trigger
- death modal open/close
- spatial grid exposure
- camera centering on zone load

## Why this is the right first cut
This changes **where** the side-effects are wired, without changing the gameplay decisions themselves.
That keeps the risk low while reducing future regression surface.

## What remains intentionally for later W1/W2 passes
- Formal world event bus / signals
- SceneManager state-machine cleanup
- Overlay/debug/collision-grid separation
- MapGenerator contract cleanup
- Reducing `State` reads inside world systems
- Extracting POI reward orchestration out of `World.js`

## Next recommended step
### W1B — Overlay / Grid Boundary Clarification
Goal:
- separate collision/nav grid, visual overlay, and debug overlay responsibilities
- remove ambiguity about which layer is authoritative for gameplay queries
