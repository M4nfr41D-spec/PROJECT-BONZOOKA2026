# A39 — Game-Loop Crash Fix (resolveCircleInGrid)

## Symptom
`TypeError: Cannot read properties of undefined (reading '19' / '25' / '12')`
firing every frame (hundredfold), forcing endless "Recovered to hub safe mode".
Stack: resolveCircleInGrid (DerelictTileGeometry.js:259) ← World.js:938 ← updateCombat ← loop.

## Root cause (introduced in A38, my code)
The unified-grid circle collision processed entities that were OUTSIDE the
instance grid (e.g. the player back at the hub/overworld while a stale
`currentZone.instanceGrid` was still attached after an in-instance recovery).
For such an entity the buried-cell branch dereferenced `cells[gy][gx±1]` with
`gy` out of range → `cells[gy]` is undefined → throw. The changing number is the
column index being read.

## Fix (DerelictTileGeometry.js → resolveCircleInGrid)
1. **Early-out:** if the entity centre is outside the grid AABB (± radius), return
   immediately. Entities that aren't in the instance area are simply not collided.
   This is both the root fix and a perf win.
2. **Hard bounds guard:** the buried branch now checks full in-bounds via `inB(x,y)`
   before reading any `cells[row][col]` (defense-in-depth).

## Verification
- acorn strict module parse: 56/56 clean
- headless boot: 0 JS errors, 0 request failures
- gameplay repro: portal → combat → derelict instance (grid active) → player
  shoved to (9 999 999, 9 999 999) for ~1 s of frames → **0 errors** (was hundredfold)
- inside-grid collision unchanged: wall push-back, velocity-kill, buried→floor all green
- connectivity guarantee intact (all POIs reachable)
