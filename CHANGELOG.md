# BONZOOKAA! CHANGELOG

## v2.16.3 — "The Reward Spiral" (2026-03-19)

### [P0] Boot Fixes

- `Director.update()` wired into combat loop (was inert — L4D pacing now active)
- `BulletPool`/`ParticlePool` lazy proxy exports added to ObjectPool.js (Safari silent module death)
- Boot error guards: try-catch on all init steps, Save.load corruption recovery

### [P1] Reward Spiral — Loot, Itemization & Progression

- Depth-scaling drop rates (+0.03%/zone, cap 18%)
- Loot explosions: bosses 2–5 items (fan spread), elites 1–2
- Smart loot: 40% empty slot bias, 20% weakest slot bias → wired through Pickups.js
- Progressive pity: invisible luck during dry streaks
- 59 affixes across 15 groups + 3 elemental damage types
- 18 synergy tags → wired into Stats.js (glass_cannon, tank, frenzy, elemental, etc.)
- Item Power Score → visible in equipment slots + tooltips
- Synergy + set bonus display in Ship Stats panel

### [P1] Set Item Bonuses

- Set pieces (Void Walker 3pc, Chrono Pilot 3pc) now drop from generateUnique
- `Items.getEquippedSetBonuses()` → Stats.js (2-piece + 3-piece bonuses active)
- Tooltip shows set progress with active/inactive bonus tiers

### [P2] Dynamic Music Intensity

- Bass filter modulated 200–1800Hz based on enemy count + Director phase
- Volume swell +20% during peak combat, 500ms smoothing

### [P2] Particle LOD + Batch Rendering

- LOD threshold 300/hard-cap 500, spawn gating on trail/sparks/explosion
- Color-bucketed dot batching, 4-pass draw pipeline, shadow skip at low LOD

### [P2] Onboarding

- 6-step first-run tutorial (movement, abilities, hub, loot/synergies, portals)
- H key controls overlay with all keybindings
- Hub service button tooltips (hover)

### [P2] 58 Procedural Spritesheets

- 10 enemies + 3 bosses + 3 elites: aggro/fire/death states
- 2 explosions, 6 muzzle flashes, player fire/hit overlays

### [P3] 30+ New Stat Types in Stats.js

- Fire/Cold/Lightning damage, lifesteal, dodge, DR, thorns, eliteDamage, aoeOnKill, chainCount, etc.

---

## v2.4.0 — Infinite Zone Flow + UI Fixes (2026-02-20)

### [P0] INFINITE ZONE SYSTEM — Boss Portal Dead End -> Endless Progression

**Before:** Boss kill spawned portal -> hub (dead end, no continuation)
**After:** Boss kill spawns TWO portals:

- GOLD portal (large): Advances to NEXT zone (endless!)
- BLUE portal (small): Optional return to Hub for crafting/vendor

#### Zone Structure (tier-based, infinite)

| Portal   | Name          | Zone Range     | Tier  |
| -------- | ------------- | -------------- | ----- |
| Portal 1 | Asteroid Gate | 1 - 100        | tier1 |
| Portal 2 | Nebula Rift   | 101 - 250      | tier2 |
| Portal 3 | Void Breach   | 251 - infinity | tier3 |

- Zones auto-switch tiers when crossing thresholds (e.g., zone 101 -> Nebula biome)
- Portal 2/3 auto-unlock when player first reaches their zone range
- Boss spawns every 5 zones (configurable per tier via bossEvery)
- State.meta.highestZone tracks progress for hub display
- acts.json redesigned: tiers[] + portals[] structure (backward-compatible \_legacy_act1)

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

---

## v2.16.0 — "The Flow Patch" (2026-03-15)

### [PERF] P1 — Object Pool Full Wiring (BulletPool + ParticlePool)

**Root cause:** `ObjectPool.js` infrastructure existed since v2.13.0 but
`Bullets.js` and `Particles.js` still allocated new objects on every shot
and every particle burst → GC pressure → frame-time spikes during heavy combat.

**Changes — `runtime/Bullets.js`:**

- Added `import { BulletPool } from './ObjectPool.js'`
- `spawn()` now uses `BulletPool.acquire()` + field assign instead of `push({...})`
- All 7 player-bullet removal sites now call `BulletPool.release(b)` before `splice()`
- All 4 inline `State.particles.push({...})` replaced with `Particles` module calls
  (pillar sparks, asteroid impact sparks, shielder deflect spark, damage numbers)
- `spawnDamageNumber()` uses `ParticlePool.acquire()` with full field assignment

**Changes — `runtime/Particles.js`:**

- Added `import { ParticlePool } from './ObjectPool.js'`
- All 8 emit methods pool-ified: `explosion`, `sparks`, `ring`, `flash`,
  `floatUp`, `trail`, `text`, `spawn() default case`
- `update()` calls `ParticlePool.release(p)` on life-expired particles
- Perf-cap cull (`> 600`) returns excess particles to pool instead of GC

**Expected perf gain:** Zero alloc in steady-state combat. GC pauses eliminated.
Pool pre-warms: BulletPool=128 objects, ParticlePool=256 objects.

### [FIX] P2 — Achievements Hook on Boss Kill

**Before:** `onBossKilled()` called `Missions.onEnemyKill` but NOT `Achievements.onEnemyKill`  
**After:** Both fire on boss kill (line 1653 `main.js`)

### [DOC] GITHUB_STRUCTURE.md — New

Full branch topology, file structure, asset pipeline rules, and PR checklist.
Covers `main` / `dev/feature/*` / `asset/sprites/*` / `asset/audio/*` /
`balance/*` / `hotfix/*` branch conventions.

### Files Modified

| File                   | Change                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| `runtime/Bullets.js`   | BulletPool import + acquire in spawn() + release on all 7 splices + inline particle push cleanup |
| `runtime/Particles.js` | ParticlePool import + acquire in all 8 emit methods + release in update loop                     |
| `main.js`              | `Achievements.onEnemyKill` added to `onBossKilled()`                                             |
| `GITHUB_STRUCTURE.md`  | New file — branch topology + asset pipeline docs                                                 |
| `CHANGELOG.md`         | This entry                                                                                       |
| `ROADMAP.md`           | Phase 10.1 marked complete                                                                       |

### Test Checklist

1. Fire gatling into crowd → Chrome DevTools Memory → heap snapshot bullet objects = stable count (~128)
2. Large explosion burst → particle heap count stable (~256)
3. Boss kill → Achievement "Boss Slayer" fires (check achievement panel)
4. Zone clear → Mission "Kill N enemies" shows correct count including non-boss kills
5. `node --check runtime/*.js runtime/world/*.js` → zero errors
6. No visual regression: sparks/rings/damage numbers render identically to v2.15.0
