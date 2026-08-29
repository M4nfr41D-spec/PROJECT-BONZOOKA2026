# CHANGELOG — Loot Trace & Reward Resolver Stabilization (v2165A)

## Date: March 30, 2026
## Master base: `bonzookaa_v2160/` from `bonzookaa_v2164_deep_maps 4.zip`

## Scope
Phase 1 stabilization patch for loot diagnostics and safer pickup resolution.

## Files changed
- `runtime/State.js`
- `runtime/Items.js`
- `runtime/Bullets.js`
- `runtime/Pickups.js`
- `main.js`

## What changed

### 1. Runtime loot trace channel added
A bounded in-memory debug trace was added to `State`.

Captured events now include:
- item drop roll summaries
- item pickup spawn events
- item generation success/failure
- stash add success/failure
- pickup-to-stash resolution
- UI refresh success/error
- hard pickup exceptions

### 2. Item pickup resolution hardened
`Pickups.js` now routes item collection through a dedicated `_collectItemPickup()` path.

This adds:
- guarded generation flow
- explicit trace checkpoints
- safer UI bridge lookup (`State.modules.UI` first, browser globals second)
- explicit fallback trace when stash is full
- explicit error trace + floating text on hard failure

### 3. Stash write verification added
`Items.addToStash()` now records:
- before / after stash size
- full-stash rejection
- invalid item rejection
- whether the inserted item can still be found in stash after push

### 4. Loot debug feed exposed in live debug UI
The existing Director debug panel now also shows:
- loot trace on/off state
- entry count
- stash size
- current ground item count
- last loot event
- rolling feed of recent loot events

## Why this patch matters
This does **not** yet fully refactor the reward architecture.
It gives us a reliable forensic layer first, so we can distinguish between:
- drop generation failure
- stash write failure
- UI refresh failure
- downstream state overwrite

That is the lowest-risk path to isolate the real loot regression before heavier restructuring.
