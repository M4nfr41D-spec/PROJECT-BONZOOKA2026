# W3H TILE RESTORE + SEAM-SAFE AUDIT

## Scope
- `runtime/world/World.js`

## Audit summary
- Previous pass overcorrected by suppressing floor-tile drawing in `surfaceMode = space/corruption/rare_chamber`.
- New pass restores those floor draws while preserving the solid under-base introduced in A12.
- Seams are now handled at draw-time via cropped source sampling (`drawSeamSafeImage`).
- Wall tile rendering also uses the seam-safe path.

## Technical note
This is a render-path correction only. No gameplay logic, spawning, loot, persistence, or modal routing was changed.
