# BONZOOKA Ship Forge Integration

## Status and authority

`M4NFROID SHIP FORGE v2.9.0` is integrated here as a BONZOOKA production generator. It is not a game runtime, product branch, or independent asset architecture.

Integration base:

- Repository: `M4nfr41D-spec/PROJECT-BONZOOKA2026`
- Branch base: `recovery/a60-candidate`
- Base commit: `58b3482f1e739723af1663e851c59fb201bb3b84`
- Promotion state: candidate; owner acceptance remains mandatory

## Dependency direction

`Ship Forge → generated sprites + authoring metadata → assets/sprite_manifest.json → SpriteManager → game runtime`

The game does not import Ship Forge, Three.js, its recipes, or its component model. Ship Forge does not introduce another runtime manifest.

## Runtime contract

Every production sheet resolves to one semantic identity:

`category / entity / state`

The corresponding files are:

- Physical asset: `assets/sprites/<category>/<entity>/<state>.png`
- Manifest value: `sprites/<category>/<entity>/<state>.png`
- Authority: `assets/sprite_manifest.json`

The A60 candidate currently addresses the default player ship as `player / ship / <state>`. Renaming it to `player_ship` would change existing runtime identities and is deliberately outside this integration. The Entity field can still author new identities such as `player_ship` when that content decision is approved.

## Authoring dimensions

The following values remain generation inputs and provenance only:

- role/category and entity/type
- state
- faction, skin, and variant
- deterministic seed and variation percentage
- component recipe and enabled modules
- heading/bank production profile
- damage preview/state mapping
- hardpoints and recommended collision bounds

They do not replace BONZOOKA's `category + entity + state` runtime schema.

## Production profiles

| Profile | Grid | Frames | Sequence | Intended use |
|---|---:|---:|---|---|
| `runtime1` | 1 × 1 | 1 | none | Static runtime state |
| `heading8` | 4 × 2 | 8 | `0-7` | Eight-direction state sheet |
| `bank4` | 4 × 1 | 4 | `0-3` | Bank-left or bank-right state |
| `bank7` | 7 × 1 | 7 | `0-6` | Full bank transition |

Multi-frame profiles write both `sequenceSpec` and an explicit zero-based `sequence` into their manifest state entry.

## Export behavior

1. Open `tools/ship-forge/index.html` through the repository's HTTP preview.
2. The tool loads `../../assets/sprite_manifest.json` and displays its deterministic fingerprint.
3. If fetch is unavailable, import that same repository manifest manually.
4. Use `PROJECT ASSET ZIP` for the current semantic identity or build a Production Matrix.
5. The ZIP contains:
   - canonical PNG sheets under `assets/sprites/...`
   - the existing repository manifest with generated states merged into `assets/sprite_manifest.json`
   - non-runtime authoring evidence under `tools/ship-forge/generated/`
6. Review and apply the ZIP on an asset integration branch. Do not copy metadata into a second runtime namespace.

Production export is blocked when the authoritative manifest is unavailable or invalid. QA-only loose PNG, GLB, normal-map, emissive-map, and custom-sheet exports remain authoring aids and do not claim runtime integration.

When a generated state is merged into an existing entity, that entity's current manifest `size` is preserved. Changing Ship Forge's PNG export resolution therefore cannot silently change a runtime-owned entity size.

## Determinism boundary

Geometry, component selection, variation, damage mapping, material micro-detail, profile angles, paths, metadata, and generation IDs are deterministic for identical inputs. The previous unseeded micro-detail noise was replaced with a fixed generator seed.

Pixel-perfect equality across different browsers, GPUs, Three.js revisions, and graphics drivers is not guaranteed by WebGL. Acceptance should compare semantic metadata and representative output on the agreed production environment.

## Existing local-preview fallback

`runtime/EmbeddedSpriteManifest.js` predates this integration and is retained unchanged to preserve A60 file-preview behavior. Ship Forge never authors it. On HTTP/GitHub Pages, `assets/sprite_manifest.json` remains the loaded authority. Any future removal or generation of the embedded fallback is a separate runtime change and requires its own regression gate.

## Verification

Run:

```bash
node scripts/ship-forge-contract.test.mjs
node scripts/validate-ship-forge-integration.mjs
node scripts/validate-baseline.mjs
```

Manual acceptance still requires opening Ship Forge, loading the repository manifest, exporting at least one static and one multi-frame state, inspecting the ZIP paths/metadata, and confirming that the game preview is unchanged before any promotion.
