# CHANGELOG — W1A World Boundary Cut (v2166A2)

## File basis
Master basis: bonzookaa_v2166A1_COMBAT_KEYS_USE_HUB_MODAL

## Scope
Safe world/scene dependency cut only.
Meta UI, loot, persistence, crafting/forge, and combat modal routing intentionally left untouched.

## Added
- `runtime/world/WorldBoundary.js`

## Changed
- `runtime/world/World.js`
- `runtime/world/SceneManager.js`
- `runtime/world/index.js`

## What changed
- Centralized world/scene side-effects behind `WorldBoundary`
- Moved direct UI announcement writes into boundary adapter where touched
- Moved world audio calls in touched paths into boundary adapter
- Moved zone-reached mission/achievement hooks into boundary adapter
- Moved anti-exploit baseline snapshot call into boundary adapter
- Moved spatial-grid exposure into boundary adapter
- Moved scene DOM toggles / pause-clear / save / death modal handling into boundary adapter
- Moved camera snap-on-zone-load into boundary adapter

## Intent
Behavior-preserving first boundary cut.
No generator redesign, no overlay rewrite, no scene logic rewrite.
This reduces direct World/Scene coupling to DOM/UI/audio/mission systems without changing the functional game loop.
