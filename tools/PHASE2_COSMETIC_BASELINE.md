# Phase 2 Cosmetic Baseline

This baseline aligns runtime + tools for the first production-grade cosmetic sprint.

## Sprint 1 Scope
- Player ship: idle, thrust, fire, hit, death
- Standard cannon: travel, impact, muzzle, trail

## Canonical paths
- assets/sprites/player/ship/<state>.png
- assets/sprites/bullets/standard_cannon/<state>.png

## Runtime notes
- Player runtime now supports `fire` and `hit` sprite states when present.
- Bullet runtime now resolves `standard_cannon`, `dual_cannon`, and `laser_desintegrator` via canonical sprite aliases.
- Tool export now writes `anchorX` / `anchorY` defaults into manifest entries for forward compatibility.

## Tooling notes
- Sprite Studio presets updated for player ship and bullet cosmetic baseline states.
- `standard_cannon` bullet entity is seeded automatically in the tool for direct export into runtime-compatible structure.
