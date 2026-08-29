# W1B Audit — Overlay / Grid / Depth Clarification (v2166A3)

## Core finding
The world stack already had usable separation, but visual layers, collision concerns and overlay intent were still too implicit.
That makes later depth work risky because render order, gameplay collision and debug concerns remain mentally entangled.

## Clarified concerns
### Collision / navigation / query
- **Collision** = walls, interactive obstacles, structure colliders, resource-node collision presence
- **Navigation** = room/corridor layout, spawn/exit topology, branch exits, portal counts
- **Query** = runtime spatial hash used by combat systems

### Render buckets
- **Atmosphere back** = dust clouds / nebula patches
- **Landmarks** = large scenic forms
- **Micro decorations** = stars / sparkles / small debris / small visual noise
- **Wall obstacles** = solid map blockers / tile-backed blockers
- **Interactive obstacles** = mines / generators / special obstacle actors
- **Structures scene** = large environmental scene geometry

### Overlay state
- POI presence
- branch exits
- main exit
- portal presence
- locked-exit state
- active objective presence

## Why this matters
Without this split, every later visual-depth upgrade risks reintroducing the old problem pattern:
small world-visual change -> unclear side effects -> regression in unrelated systems.

## Next logical step
### W2 — Depth Stack Pass
Using the new layer profile, the next safe visual pass should target:
1. stronger mid/foreground depth
2. occlusion-readable atmosphere
3. structure/background separation
4. more scene gravitas per biome/depth

That can now happen on a cleaner foundation instead of inside mixed world/combat/render code.
