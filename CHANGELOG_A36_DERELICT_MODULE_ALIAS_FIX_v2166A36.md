# CHANGELOG — A36 Derelict Module Alias Fix (v2166A36)

## Root cause
The guaranteed derelict entry path reached the instance assembler correctly, but the assembler still referenced a non-manifest module id: `corridor_h_e4w4`.

The runtime manifest only shipped canonical, asset-backed ids such as `corridor_h_e4w2`, `junction_t_north_n2e4w4`, `corridor_v_s2`, `corner_ne_n4e4`, `junction_t_north`, `junction_cross`, and `anchor_round_s2`. Because `corridor_h_e4w4` was not present, entering the derelict breach crashed back into hub recovery.

## Fix
- updated `DerelictDungeonAssembler` to use canonical module ids only
- replaced both stale `corridor_h_e4w4` references with `corridor_h_e4w2`
- added a small alias layer in `DerelictTileManifest` so stale ids can resolve safely during transition

## Effect
- entering the guaranteed derelict breach no longer fails on `Unknown derelict tile module: corridor_h_e4w4`
- instance build path is now aligned with the shipped manifest ids

## Files changed
- `runtime/world/instances/DerelictTileManifest.js`
- `runtime/world/instances/DerelictDungeonAssembler.js`
