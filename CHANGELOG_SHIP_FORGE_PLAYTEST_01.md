# CHANGELOG — SHIP FORGE PLAYTEST 01

## File basis
Built exclusively on `bonzookaa_v2166D_MASTER.zip`.

## Objective
Establish the first playable end-to-end Ship Forge vertical slice before further tool expansion.

## Added
- `tools/ship-forge/index.html` — M4NFROID SHIP FORGE v2.9.0 integrated into the BONZOOKAA tool layer.
- `tools/ship-forge/README.md` — explicit one-way runtime contract.
- `assets/sprites/player/ship/bank.png` — 9-frame Ship Forge player bank sheet.

## Changed
- `assets/sprite_manifest.json`
  - added canonical `player/ship/bank` state
  - 8 columns × 2 rows
  - 9 active frames
- `runtime/EmbeddedSpriteManifest.js`
  - mirrored the bank state for file:// / external-file fallback.
- `runtime/Player.js`
  - default player ship now renders the Ship Forge bank sheet when available.
  - frame is selected deterministically from local lateral velocity.
  - neutral frame is index 4.
  - no Ship Forge runtime dependency was introduced.

## Runtime contract
`Ship Forge -> assets/sprites/... -> sprite_manifest.json -> SpriteManager -> Player`

## Guardrails
- No gameplay balance changes.
- No Save schema changes.
- No Director changes.
- No collision changes.
- No input changes.
- Existing sprite/canvas fallback remains intact if the Ship Forge bank asset is unavailable.

## Acceptance gate
- Player ship visible in real gameplay.
- Correct orientation/scale/pivot.
- Left/right lateral motion produces visible bank response.
- Movement, aim, weapons and game flow remain functional.
- Do not expand Ship Forge until this gate is evaluated.
