# WORLD_TOPOLOGY_ROADMAP_v2166A22B

## Purpose
This is the corrected implementation order for BONZOOKAA world evolution after the Derelict vertical-slice decision.

The key correction is:
**do not wire runtime events before the map has a real structure carrier layer.**

---

## Corrected cornerstones

### Cornerstone 1 — Stability and performance lock
Required before scaling content.
- render stability
- projectile range/lifetime/zone ownership
- grounded shadows only
- scatter cost reduction
- Derelict slice lock

### Cornerstone 2 — Topology core
Defines what exists and how it connects.
- node classes
- path classes
- purpose schema
- budget validation
- authored Derelict slice graph

### Cornerstone 3 — Module / structure carrier layer
Creates the real stage that content will live on.
- room modules
- corridor modules
- arena modules
- service modules
- portal-capable rooms
- secret-capable rooms
- trap-capable rooms

This is the missing bridge between abstract topology and runtime gameplay.

### Cornerstone 4 — Socket placement layer
Only after Cornerstone 3.
- event beacons
- portal in/out
- secret doors
- scanner nodes
- lockdown doors
- trap triggers
- reward locks

### Cornerstone 5 — Runtime wiring
Only after sockets have meaningful spatial hosts.
- ambush
- cleanup
- lockdown
- portal activation
- secret reveal
- trap behavior

### Cornerstone 6 — Biome rollout
Only after the Derelict slice proves the structure.
- Asteroid Belt
- Nebula Expanse
- Void Rift
- Black Hole

---

## Generator architecture correction
The existing `MapGenerator` remains the orchestration core, but its role changes.

### Old role
- generates rough map mass / rooms / obstacles directly

### New role
1. **build topology graph**
2. **realize modules / carriers**
3. **apply theme / surfaces**
4. **later place sockets**
5. **later wire runtime behaviors**

This means the generator is no longer the final space painter.
It becomes the **topology-driven orchestrator**.

---

## Immediate next implementation order

### Done
- Derelict slice lock
- topology schema / budgets
- projectile budget / weapon identity
- stability / performance hotfixes

### Now
- **W4A.3 — Derelict module / structure carrier pass**

### Next
- **W4A.4 — socket placement layer**

### Then
- **W4A.5 — runtime behavior wiring**

---

## Hard rule
Do not place portals, secrets, traps, or event runtime logic into empty or generic space.

First build the stage.
Then place the sockets.
Then make them live.
