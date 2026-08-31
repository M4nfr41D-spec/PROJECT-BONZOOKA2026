# Change Lock — Ship Forge v2.9.0 Integration Candidate

## Identity

| Field | Value |
|---|---|
| Date | 2026-08-31 |
| Repository | `M4nfr41D-spec/PROJECT-BONZOOKA2026` |
| Working branch | `integration/ship-forge-v2.9.0` |
| Base branch | `recovery/a60-candidate` |
| Base commit | `58b3482f1e739723af1663e851c59fb201bb3b84` |
| Source tool | `M4NFROID SHIP FORGE v2.9.0 — Silhouette Variance` |
| Promotion state | Candidate — owner acceptance pending |

## Pre-change evidence

- Remote `main` at `4e4f27d6143cbc81817693cb466ec39427b611f2` contains documentation, `index.html`, `main.js`, and `tools/ship-forge-probe/`, but not the documented `assets/`, `runtime/`, or unified Sprite Studio implementation.
- The complete sprite-wiring architecture exists on `recovery/a60-candidate` at `58b3482f1e739723af1663e851c59fb201bb3b84`.
- Verified authority files on that commit:
  - `assets/sprite_manifest.json`
  - `runtime/SpriteManager.js`
  - `tools/sprites_studio_unified.html`
  - `ROADMAP_SPRITE_WIRING_REFACTOR.md`
  - `CHANGELOG_SPRITE_WIRING_REFACTOR.md`
- No integration change was applied to the incomplete `main` tree.

## Authorized concern

Integrate Ship Forge into the existing BONZOOKA sprite production pipeline without adding a parallel runtime, manifest, branch authority, or asset namespace.

## Changes

### Tool placement

- Added `tools/ship-forge/index.html` from the supplied v2.9.0 source.
- Added `tools/ship-forge/bonzooka-contract.mjs` as a pure authoring-side adapter for canonical paths, production profiles, manifest entries, guarded merges, and deterministic fingerprints.

### Manifest authority

- Production export loads or imports the existing `assets/sprite_manifest.json` baseline.
- Production export is blocked if that baseline is absent, empty, or structurally invalid.
- Manifest loading remains independent from WebGL startup so repository authority can be inspected even when the current browser cannot create a 3D context; render/export paths remain unavailable in that case.
- Removed the former production behavior that emitted `assets/sprite_manifest_shipforge_fragment.json` as a separate manifest candidate.
- Project bundles now contain the generated PNGs plus the existing authoritative manifest with only generated semantic states merged in.
- Existing entity `size` values are preserved during merge so that a different authoring/export resolution cannot silently change runtime sizing.

### Runtime-compatible profile metadata

- `runtime1`: `1 × 1`, 1 frame.
- `heading8`: `4 × 2`, 8 frames, sequence `0-7`.
- `bank4`: `4 × 1`, 4 frames, sequence `0-3`.
- `bank7`: `7 × 1`, 7 frames, sequence `0-6`.
- Manifest states include `file`, `cols`, `rows`, `frames`, `fps`, `loop`, and `sequenceSpec` / `sequence` for multi-frame sheets.

### Deterministic authoring

- Preserved recipe, component, skin, faction, state, damage, seed, and variation inputs.
- Replaced unseeded `Math.random()` material micro-detail with a fixed deterministic generator seed.
- Added stable generation fingerprints to authoring metadata and batch indexes.

### Runtime isolation

- No game runtime file imports Ship Forge, its contract module, Three.js, JSZip, recipes, or production metadata.
- No changes were made to game logic, `SpriteManager`, Director, save data, gameplay assets, or the current authoritative sprite manifest.
- Existing `runtime/EmbeddedSpriteManifest.js` file-preview fallback remains unchanged and is explicitly not authored by Ship Forge.

## Added verification

- `scripts/ship-forge-contract.test.mjs`
  - canonical paths
  - profile grid/sequence metadata
  - non-mutating manifest merge
  - rejection of non-canonical generated files
  - stable fingerprints
- `scripts/validate-ship-forge-integration.mjs`
  - required file presence
  - inline module syntax
  - authoritative manifest merge path
  - absence of a Ship Forge parallel manifest
  - absence of unseeded randomness
  - absence of runtime dependencies on Ship Forge or Three.js

### Public HTTP smoke evidence

- Exact remote commit tested: `aaeb65e18f2a0a06300a0f1792cbc1328272cea0`.
- Ship Forge title and production-contract UI loaded from a commit-bound HTTP preview.
- `assets/sprite_manifest.json` loaded as `repository baseline` with deterministic fingerprint `sf-3f0e06d9`.
- The isolated cloud browser could not create a WebGL context, so no image/ZIP export gate is claimed from that environment.

## Recovery path

The complete change is isolated from `main` and from the A60 recovery branch. Before merge, recovery is deletion of `integration/ship-forge-v2.9.0`. If accepted, squash-merge the candidate so one revert returns the recovery branch exactly to base commit `58b3482f1e739723af1663e851c59fb201bb3b84`.

## Acceptance gates

- [x] Contract unit tests pass.
- [x] Ship Forge integration validator passes.
- [x] A60 baseline validator passes unchanged.
- [x] Tool loads the repository manifest over HTTP/GitHub Pages.
- [ ] One `runtime1` project bundle has canonical paths and a valid merged manifest.
- [ ] One multi-frame bank or heading bundle has correct grid and sequence metadata.
- [ ] A representative game boot/play path shows no regression.
- [ ] Ing. Manfred Foissner accepts the candidate.

No completed automated gate constitutes owner acceptance or baseline promotion.
