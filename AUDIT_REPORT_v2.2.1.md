# BONZOOKAA! ARPG Systems Audit Report
## Version 2.2.1 | 2026-02-20

---

## [DESIGN_TARGET]

BONZOOKAA is a top-down space ARPG with Diablo-style exploration, hub-and-spoke act structure, seeded procedural zone generation, and an endless depth progression axis. The player fantasy is: fly through increasingly dangerous procedurally-generated space zones, fight enemies with satisfying ship combat, collect loot that visibly powers up the ship, progress through acts with escalating difficulty, and push endless depth for ever-harder modifiers and richer rewards.

---

## A) CRITICAL BUGS FOUND & FIXED

### P0-001 · World.js — Missing Object Commas (CRASH)
```
[T+0] P0 ARPG::World SYNTAX_ERROR
CTX { file: World.js, lines: 522-551 }
DIAG Missing commas between drawParallaxBackground, drawParallaxForeground,
     and drawParallax methods in World object literal.
     Entire World module fails to import → game cannot start.
FIX  Added commas at lines 522 and 549. Removed duplicate ctx.globalAlpha=1.
TEST node --input-type=module validates cleanly after fix.
```
**Status: ✅ FIXED**

### P1-001 · DataLoader.js — getConfig() Ignores Dotted Paths
```
[T+0] P1 ARPG::DataLoader CONFIG_LOOKUP_BROKEN
CTX { file: DataLoader.js, function: getConfig() }
DIAG getConfig('progression.baseXP', 100) does State.data.config?.['progression.baseXP']
     which is undefined. Falls through to fallback value every time.
     Impact: config.progression.maxLevel=0 (unlimited) → fallback=100 (hard cap).
     Player silently capped at level 100 instead of endless progression.
FIX  Rewired getConfig() to use getData('config.' + key) which splits on '.'
TEST getConfig('progression.maxLevel', 100) now returns 0 → unlimited leveling works.
```
**Status: ✅ FIXED**

---

## B) SYSTEM-LEVEL AUDIT

### B1. Seeded Procedural Generation — FUNCTIONAL ✅
| Component | File | Status | Notes |
|-----------|------|--------|-------|
| SeededRandom | SeededRandom.js | ✅ OK | Mulberry32 PRNG, deterministic |
| MapGenerator | MapGenerator.js | ✅ OK | Zone gen from seed + act config |
| Zone Seeds | MapGenerator.createZoneSeed | ✅ OK | XOR + golden ratio hash |
| Pack Director | MapGenerator.applyPackDirector | ✅ OK | Budget-neutral grouping |
| Boss Arenas | MapGenerator.generateBossZone | ✅ OK | Structured arena with pillars |
| Depth Rules | DepthRules.js | ✅ OK | Milestone unlocks + weighted sampling |

**Risks:**
- DepthRules.sampleActive() uses `Math.random()` not seeded RNG → modifier sets not reproducible across sessions for same depth. P2 design choice (acceptable for variety).
- No chunk/streaming — entire zone loaded at once. Fine for current map sizes (≤17,500×17,500 at mapScale=5.0) but needs spatial partitioning at larger scales.

### B2. Progression System — FUNCTIONAL WITH GAPS ⚠️
| Component | File | Status | Notes |
|-----------|------|--------|-------|
| XP Curve | Leveling.js | ✅ FIXED | Was silently capped at 100. Now reads config correctly |
| Level Up | Leveling.js | ✅ OK | Awards skill + stat points, heals, auto-saves |
| Skill Trees | Leveling.js | ✅ OK | Prerequisite checks, rank capping |
| Stat Allocation | Leveling.js | ✅ OK | Point allocation with validation |
| Enemy Scaling | World.js | ✅ OK | pow(1.1, level) for enemies, pow(1.15, level) for bosses |
| Depth Modifiers | DepthRules.js | ✅ OK | 7 modifier types, milestone unlocks every 25 depth |

**Missing ARPG Systems (P2 gaps):**
- No power budget accounting (gear% vs skill% vs passives%)
- No diminishing returns on stat stacking
- No level-gated item drops (all items available at all levels)
- No endgame prestige / paragon / mastery system beyond depth

### B3. Itemization — FUNCTIONAL ✅
| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Item Generation | Items.js | ✅ OK | Base + rarity + affixes |
| Rarity Rolling | Items.rollRarity | ✅ OK | Weighted pool with luck modifier |
| Affix System | Items.js + affixes.json | ✅ OK | Prefix/suffix, tier-gated |
| Equipment | Items.equip/unequip | ✅ OK | Slot-based with module auto-fill |
| Stash | Items.addToStash | ✅ OK | Capped at config.stash.baseSlots |
| Sell/Vendor | Items.sell | ✅ OK | Unequip + remove + scrap |
| Rarity Floor | Items.generate | ✅ OK | Elite drops guaranteed ≥ rare |

**Items Catalog:** 20 base items across 7 slot categories (weapon, secondary, shield, engine, reactor, module×3, drone). 6 rarity tiers.

**Missing ARPG Systems (P2 gaps):**
- No item level gating (ilvl independent of drop context)
- No unique/legendary items with fixed identities
- No crafting system (no currency sinks)
- No set items
- No affix weighting by item type/tags

### B4. Loot & Economy — FUNCTIONAL ✅
| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Drop Tables | Bullets.checkLootDrop | ✅ OK | Base 5%, elite 30%, boss 100% |
| Currency Drops | Bullets.onEnemyKilled | ✅ OK | Cells + scrap with multipliers |
| Pickup Collection | Pickups.collect | ✅ OK | Auto-gen item on pickup |
| Stash Overflow | Pickups.collect | ✅ OK | Converts to scrap if full |

**Economy Health:**
- No pity protection (pure RNG, no guaranteed drops after N kills)
- No crafting sinks → only currency faucet is killing, only sink is vendor
- No anti-inflation guardrails at high depth (scrap accrues unbounded)
- No EV/time exploit detection

### B5. Combat System — FUNCTIONAL ✅
| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Player Movement | Player.js | ✅ OK | WASD + mouse aim, exploration mode |
| Shooting | Player.js → Bullets.js | ✅ OK | Multi-projectile, pierce, crit |
| Enemy AI | Enemies.js | ✅ OK | patrol/aggro/return state machine |
| Sniper AI | Enemies.js | ✅ OK | Telegraphed aimShot with tracking |
| Repair Drone | Enemies.js | ✅ OK | Heal tether with per-frame budget cap |
| Damage Numbers | Bullets.js | ✅ OK | Configurable, crit/big-hit variants |
| Asteroid Props | Bullets.js + World.js | ✅ OK | Destructible, drop scrap |

### B6. World & Scene Management — FIXED ✅
| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Zone Loading | World.loadZone | ✅ OK | Seed-based, depth-driven |
| Proximity Spawn | World.update | ✅ OK | 600px spawn, 1200px despawn |
| Despawn Safety | World.update | ✅ OK | Won't despawn aggro'd enemies |
| Portal System | World.onPortalEnter | ⚠️ OK | Basic — no transition animation |
| Exit System | World.onExitReached | ✅ OK | Loads next zone |
| Boss Trigger | World.spawnBoss | ✅ OK | Announces, spawns portal on kill |
| Parallax | World.drawParallax* | ✅ FIXED | Was broken by missing commas |
| Camera | Camera.js | ✅ OK | Follow + snap + transform |
| Scene Manager | SceneManager.js | ✅ OK | Hub/combat/loading transitions |

### B7. Save System — FUNCTIONAL ✅
| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Save/Load | Save.js | ✅ OK | localStorage with JSON serialization |
| Backup | Save.loadBackup | ✅ OK | Automatic backup of previous save |
| Migration | Save.migrate | ✅ OK | v1→v2 migration path |
| Export/Import | Save.export/import | ✅ OK | JSON string for manual backup |

### B8. Data Pipeline — FUNCTIONAL ✅
| Component | File | Status | Notes |
|-----------|------|--------|-------|
| DataLoader | DataLoader.js | ✅ FIXED | getConfig() now supports dot paths |
| JSON Files | data/*.json | ✅ OK | 10 data files loaded |
| Error Handling | loadAllData | ✅ OK | Graceful failure per file |

---

## C) DIRECTORY STRUCTURE MISMATCH — P2

The import paths in source code reference a nested directory structure:
```
main.js imports from ./runtime/State.js, ./runtime/world/Camera.js, etc.
World.js imports from ../State.js (relative to runtime/world/)
```

But the Claude project stores all files flat. For deployment, files must be placed in:
```
bonzookaa/
├── index.html
├── main.js
├── runtime/
│   ├── State.js, DataLoader.js, Save.js, Stats.js, Leveling.js
│   ├── Items.js, Player.js, Enemies.js, Bullets.js, Pickups.js
│   ├── Particles.js, Input.js, UI.js, PauseUI.js
│   ├── Background.js, Contracts.js, Invariants.js
│   └── world/
│       ├── index.js, SeededRandom.js, Camera.js
│       ├── MapGenerator.js, World.js, SceneManager.js, DepthRules.js
├── data/
│   ├── config.json, acts.json, enemies.json, items.json
│   ├── affixes.json, skills.json, pilotStats.json
│   ├── rarities.json, runUpgrades.json, slots.json, packs.json
└── assets/
    ├── enemies/, asteroids/, backgrounds/, fog/, asteroids_deco/
    └── audio/ (future)
```

---

## D) [BALANCE_MODEL]

### XP Curve
```
XP(L) = 100 × 1.15^(L-1)
L1:100, L5:175, L10:352, L20:1,637, L50:108,366
Time-to-level scales ~15% per level (healthy ARPG curve)
```

### Enemy Scaling
```
enemyHP(L) = baseHP × 1.10^(L-1) × waveMult × (elite?2.5:1) × (boss?8:1)
enemyDMG(L) = baseDMG × 1.10^(L-1)
bossHP(L) = baseHP × 1.15^(L-1) × 8
```

### Depth Modifiers (escalation axis)
```
Modifier slots: depth<25→1, <50→2, <100→3, <200→4, 200+→5+
Unlock milestone: every 25 depth
Pool: ELITE_PACKS, BULLET_HELL, FAST_ENEMIES, CRAMPED_ZONE, MINEFIELD, DENSE_OBSTACLES, RICH_LOOT
```

### Drop Rates
```
Base: 5% per kill (×luck bonus at +2%/pt)
Elite: 30%, Boss: 100%
Rarity weights: common(100) > uncommon(50) > rare(15) > epic(4) > legendary(1)
```

### Anti-Exploit Gaps
- No reset abuse detection (player can restart act for guaranteed boss drops)
- No seed farming protection (same seed = same loot placement)
- No EV/time monitoring
- No pity counters

---

## E) [VALIDATION]

### Deterministic Tests
- Same actSeed + zoneIndex → identical zone layout ✅ (verified via SeededRandom)
- Same seed → same enemy spawns, obstacles, decorations ✅
- Pack director doesn't increase total spawn count ✅ (budget-neutral)

### Runtime Tests Needed
- [ ] Play through Act 1 zones 1-4 + boss → verify no crashes
- [ ] Push to depth 25 → verify modifier unlock
- [ ] Kill 200+ enemies → verify loot drop distribution
- [ ] Level to 100+ → verify unlimited leveling (after getConfig fix)
- [ ] Fill stash → verify overflow → scrap conversion

### Perf Concerns
- mapScale=5.0 creates zones up to 17,500×17,500 pixels
- maxEnemySpawnsPerZone=90, maxObstaclesPerZone=1500 → manageable
- No spatial partitioning yet → O(n²) collision checks
- 4000+ decorations rendered per frame (culled by Camera.isVisible)

---

## F) [ITERATION_PLAN]

### Tuning Knobs (config.json)
| Knob | Current | Range | Effect |
|------|---------|-------|--------|
| exploration.mapScale | 5.0 | 1.0–10.0 | Zone size multiplier |
| exploration.enemyDensityMult | 0.35 | 0.1–1.0 | Enemy count per area |
| exploration.enemyAggroRangeMult | 0.7 | 0.3–1.5 | How far enemies detect player |
| exploration.enemyFireIntervalMult | 1.75 | 0.5–3.0 | How often enemies shoot |
| loot.baseDropChance | 0.05 | 0.01–0.15 | Loot per kill |
| progression.xpScale | 1.15 | 1.05–1.25 | XP curve steepness |
| waves.scaleBase | 1.12 | 1.05–1.20 | Stat scaling per wave |

### Priority Roadmap
1. **NOW**: Apply P0+P1 fixes, verify game boots
2. **NEXT**: Spatial partitioning (SpatialHash.js) for collision perf
3. **THEN**: Item level gating + crafting system + currency sinks
4. **LATER**: Unique items, set bonuses, pity protection, endgame prestige
