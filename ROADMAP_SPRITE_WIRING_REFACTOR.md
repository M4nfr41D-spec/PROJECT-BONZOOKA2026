# Sprite Wiring Refactor Roadmap

## Objective
Consolidate all runtime-relevant sprites into the canonical path model:

`assets/sprites/<category>/<entity>/<state>.png`

and route all animated game entities through `runtime/SpriteManager.js` + `assets/sprite_manifest.json`.

## Target Architecture
- **Single source of truth:** `assets/sprite_manifest.json`
- **Canonical sprite path:** `assets/sprites/<category>/<entity>/<state>.png`
- **Runtime lookup:** `SpriteManager.has/play/drawAnimated`
- **Semantic enemy wiring:** `spriteCategory`, `spriteId`, `animState`
- **Generator/export rule:** ZIP exports directly into `assets/...`

## Implemented Now
### Phase 1 — Canonical Asset Structure
- Migrated manifest file references from flat names such as `sprites/enemies/grunt_patrol.png` to nested paths such as `sprites/enemies/grunt/patrol.png`.
- Moved existing sprite sheets into entity/state folders under `assets/sprites`.
- Preserved manifest metadata (`cols`, `rows`, `frames`, `fps`, `loop`, `sequenceSpec`, `sequence`).

### Phase 2 — Runtime Wiring Cleanup
- Removed direct enemy sprite PNG hardcodes from `runtime/Enemies.js`.
- Replaced path-based sprite assignment with semantic wiring:
  - `spriteCategory`
  - `spriteId`
  - `animState`
- Kept canvas fallback rendering for entities that do not yet have sprite sheets.

### Phase 3 — Generation Machine Alignment
- Updated `tools/sprites_studio_unified.html` to generate canonical nested state paths.
- Updated ZIP export to write project-ready files under `assets/...`.
- Updated manifest export guidance text to reflect the canonical runtime structure.

## Next Recommended Steps
1. Add missing state sheets where only `patrol` currently exists (`aggro`, `fire`, `death` where needed).
2. Apply the same semantic wiring rule to any other runtime modules that still use direct PNG references in future revisions.
3. Add an automated validation script that checks:
   - every manifest file exists
   - every state has consistent frame metadata
   - no duplicate file references remain
4. Consider adding a `tools/validate_sprite_manifest.js` utility for CI or manual pre-release QA.

## Final Canonical Rules
### Asset Rule
`assets/sprites/<category>/<entity>/<state>.png`

### Manifest Rule
```json
"enemies": {
  "grunt": {
    "size": 256,
    "patrol": {
      "file": "sprites/enemies/grunt/patrol.png",
      "cols": 2,
      "rows": 1,
      "frames": 2,
      "fps": 8,
      "loop": true
    }
  }
}
```

### Runtime Rule
- No direct `./assets/enemies/*.png` hardcodes for animated enemies.
- Runtime should request sprites semantically via category + entity + state.
- `SpriteManager` remains the only animated sprite ingestion path.
