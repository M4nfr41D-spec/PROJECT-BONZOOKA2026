# Changelog — Sprite Wiring Refactor

## Version
`v2.15.x-sprite-wiring-refactor`

## Added
- Roadmap document for the sprite architecture refactor.
- Canonical nested sprite folder structure under `assets/sprites/<category>/<entity>/<state>.png`.
- Semantic enemy sprite wiring fields: `spriteCategory`, `spriteId`, `animState`.

## Changed
- `assets/sprite_manifest.json`
  - Updated all sprite file references to canonical nested paths.
- `runtime/SpriteManager.js`
  - Updated manifest documentation comment to reflect canonical nested paths.
- `runtime/Enemies.js`
  - Removed hardcoded enemy PNG path assignments.
  - Removed direct sprite cache rendering branch for hardcoded enemy assets.
  - Unified animated enemy drawing through `SpriteManager`.
- `tools/sprites_studio_unified.html`
  - Updated generated file path pattern from `<entity>_<state>.png` to `<entity>/<state>.png`.
  - Updated ZIP export to write directly into `assets/`.
  - Updated export guidance text to match project-ready runtime structure.

## Removed
- Runtime dependency on:
  - `./assets/enemies/enemy_sniper.png`
  - `./assets/enemies/enemy_corrupted_spawn.png`
for animated enemy rendering.

## Operational Impact
- New sprite exports can now be dropped into the project without post-export manual path cleanup.
- The runtime is now aligned with the final production sprite architecture.
- Remaining work is primarily content completion, not structural rework.
