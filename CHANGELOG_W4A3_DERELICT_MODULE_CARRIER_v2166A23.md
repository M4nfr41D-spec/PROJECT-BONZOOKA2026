# CHANGELOG_W4A3_DERELICT_MODULE_CARRIER_v2166A23

## File basis
Input Master: `bonzookaa_v2166A22_W4P2_GROUNDED_SHADOWS_SCATTER_MASTER.zip`

## Scope
This pass corrects the roadmap order and implements the missing **module / structure carrier layer** for the Derelict vertical slice.

## What changed
- added `runtime/world/topology/DerelictModuleLibrary.js`
- `MapGenerator` now assigns concrete **room modules** and **corridor modules** to topology nodes/edges in the Derelict slice
- topology layouts now expose:
  - `moduleId`
  - `carrierClass`
  - `moduleTags`
  - corridor module metadata
- Derelict topology layouts are now marked `carrierReady`
- zone metadata now includes `moduleCarrier` summary
- `MapGenerator._generateLayoutWalls()` now routes Derelict slice layouts into a dedicated **carrier structure realization pass**
- new realized structure families for Derelict slice:
  - `bulkhead`
  - `cargo_stack`
  - `console_bank`
  - `gate_pylon`
  - existing `pillar` / `salvage_wreck` reused intentionally
- `World.js` now renders the new carrier structure types
- added corrected roadmap document:
  - `WORLD_TOPOLOGY_ROADMAP_v2166A22B.md`

## Design intent
This is the missing bridge between:
- topology graph
- and later socket/runtime behavior

Meaning:
- first build the stage
- then place sockets
- then make them live

## Not touched
- UI / Meta / Save
- director logic
- drone balance
- event runtime wiring
- portal runtime activation
- secrets/traps runtime behavior

## Expected result
The Derelict slice should now feel less like empty abstract room blobs and more like a real structural carrier:
- clearer bulkhead corridor language
- more authored room identity
- better service/gate/poi/secret/trap staging
