# W4A.2 TOPOLOGY SCHEMA AUDIT — v2166A16

## Goal
Lock the Derelict vertical slice onto a topology-first schema instead of open-ended biome/world drift.

## Result
The build now has a dedicated topology layer for the Derelict slice:
- node taxonomy
- path taxonomy
- purpose schema
- portal schema
- trigger/socket schema
- medium-zone topology budget
- deterministic authored graph template

## Key implementation points
1. `MapGenerator.generate()` now attaches:
   - `zone.topologyBudget`
   - `zone.topology`
   - `zone.sliceLock`

2. `_generateLayout()` now switches to `_generateTopologyLayout()` when a valid slice topology is present.

3. The authored Derelict graph contains:
   - spawn room
   - narrow corridor
   - combat room
   - poi room
   - service/relief room
   - danger corridor
   - arena room
   - portal room
   - boss gate room
   - finale arena
   - optional loot room
   - secret room
   - trap room
   - shortcut room

4. Encounter budgeting now respects `room.encounterCapacity` when present.

5. Branching exits are disabled for vertical-slice mode to keep the first validation pass controlled.

## Remaining work for next slice steps
- event/socket activation in runtime, not only metadata
- authored portal placement/render/gameplay use
- secret/trap activation logic
- readability kit and derelict module pass
- editor-side topology/socket authoring support

## Risk assessment
Low-to-moderate.
This patch changes world generation behavior in Derelict slice mode, but leaves the rest of the project scope untouched.
