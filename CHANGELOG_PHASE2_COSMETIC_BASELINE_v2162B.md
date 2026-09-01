# CHANGELOG — v2162B Phase 2 Cosmetic Baseline

## Runtime
- Added player sprite-state readiness for `fire` and `hit` without breaking existing `idle` / `thrust` / `death` flow.
- Added bullet sprite alias support for `standard_cannon`, `dual_cannon`, `laser_desintegrator`.

## Tools
- Updated Sprite Studio presets:
  - player: idle, thrust, fire, hit, death
  - bullets: travel, impact, muzzle, trail
- Seeded runtime-facing `bullets/standard_cannon` placeholder entity.
- Export manifest now includes default `anchorX` / `anchorY` fields for forward-compatible cosmetic mapping.

## Goal
Prepare runtime + tools for high-quality state-based art integration without another core refactor.
