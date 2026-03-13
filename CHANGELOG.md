# BONZOOKAA! CHANGELOG

## v2.4.0 — Infinite Zone Flow + UI Fixes (2026-02-20)

### [P0] INFINITE ZONE SYSTEM — Boss Portal Dead End -> Endless Progression

**Before:** Boss kill spawned portal -> hub (dead end, no continuation)
**After:** Boss kill spawns TWO portals:
- GOLD portal (large): Advances to NEXT zone (endless!)
- BLUE portal (small): Optional return to Hub for crafting/vendor

#### Zone Structure (tier-based, infinite)
| Portal | Name | Zone Range | Tier |
|--------|------|-----------|------|
| Portal 1 | Asteroid Gate | 1 - 100 | tier1 |
| Portal 2 | Nebula Rift | 101 - 250 | tier2 |
| Portal 3 | Void Breach | 251 - infinity | tier3 |

- Zones auto-switch tiers when crossing thresholds (e.g., zone 101 -> Nebula biome)
- Portal 2/3 auto-unlock when player first reaches their zone range
- Boss spawns every 5 zones (configurable per tier via bossEvery)
- State.meta.highestZone tracks progress for hub display
- acts.json redesigned: tiers[] + portals[] structure (backward-compatible _legacy_act1)

Files changed: World.js, main.js, data/acts.json

### [P2] EMOJI ENCODING — Mojibake Fixed

Before: All emoji icons rendered as hieroglyphs
Root cause: Double UTF-8 encoding (bytes encoded as CP-1252 then re-encoded)
Fix: 16 unique byte patterns replaced with HTML entities

### [P2] UI OVERFLOW — Stash + Skill Panel

- Stash: removed hover scale, reduced borders/fonts, added overflow containment
- Skills: added max-height + overflow-y scroll to skill-tree-container
- Panels: overflow-x hidden on both side panels + panel-inner

### [P2] HUB FLOW

- Start button routes to hub portal selection (not dead start)
- Hub renders tier-based portals with zone ranges
- Restart resolves portal/tier system properly
- Hub shows highest zone reached

---

## v2.3.0 — Module Integration (previous)
## v2.2.0 — Base ARPG Systems (previous)
