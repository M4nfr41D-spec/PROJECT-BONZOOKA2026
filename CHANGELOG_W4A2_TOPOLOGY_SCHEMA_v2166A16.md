# CHANGELOG — v2166A16 — W4A.2 Topology Schema + Derelict Slice Graph

## File basis
Input master:
- `bonzookaa_v2166A15_W4A1_DERELICT_SLICE_LOCK_MASTER.zip`

## Scope
World/topology only.

No touch:
- modals
- loot / stash
- persistence
- crafting / forge
- combat key routing
- player / enemy rendering

## Added
- `runtime/world/topology/TopologySchema.js`
- `runtime/world/topology/EventSocketSchema.js`
- `runtime/world/topology/PortalSchema.js`
- `runtime/world/topology/DerelictSliceGraph.js`

## Changed
- `runtime/world/MapGenerator.js`
- `runtime/world/index.js`

## What this pass does
- introduces a production-facing topology schema with hard budgets
- introduces launch trigger/socket schema for the vertical slice
- introduces launch portal schema for paired / shortcut / boss-gate portals
- builds a deterministic authored Derelict slice graph on zone generation
- attaches topology metadata to generated zones
- routes the layout generator through a topology-driven layout path when the Derelict slice lock is active
- uses encounter capacity metadata for room enemy budgeting
- suppresses branching exits in vertical-slice mode to keep the test build controlled

## Budget target
- medium slice
- 12–16 nodes
- 7–9 main path nodes
- 2–3 optional nodes
- 2 POI/reward nodes
- 1 arena
- 1 secret branch
- 1 trap branch
- 1 relief/service node

## Notes
This is a topology/spec pass, not yet the full authored event/trap/portal implementation.
It establishes the graph, metadata, and budget enforcement layer that the next slice steps can build on.
