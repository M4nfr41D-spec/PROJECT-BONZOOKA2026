
---

## v2.10.0 — "The Juice Patch" (2025-02-25)

### 🔥 Kill Streak / Combo System
- **Kill chain tracking**: kills within 3.5s of each other build combo (×2, ×3... ×∞)
- **XP multiplier**: ×1.0 at start → ×2.0 at 11-kill streak → ×3.0 cap at 21+ kills
- **Loot multiplier**: ×1.0 → ×1.5 at 11 → ×2.0 cap at 21+ kills (boosts drop chance)
- **Cell/scrap bonus**: streak multiplier applies to all currency drops
- **HUD counter**: top-right streak display with pulsing glow, multiplier readout, decay timer bar
- **Milestone fanfares**: audio + ring VFX + announcement at 5×, 10×, 15×, 20× thresholds
- **Streak break**: 3.5s without a kill → streak resets, "STREAK ENDED" floating text if ≥5

### ⭐ Zone Mastery Bonus
- **Clear 80%+ POIs** before leaving a zone → **ZONE MASTERED** reward burst
- **Scaling rewards**: 50 + depth×10 scrap, 20 + depth×5 cells, 100 + depth×25 XP
- **Difficulty multiplied**: Risk/Chaos modifiers amplify mastery rewards
- **Full fanfare**: 6-note triumphant chord, golden explosion VFX, screen shake, 3s announcement
- **Triggers on**: exit portal, next-zone portal, or hub portal

### ⚡ 3 Active Abilities (Q/R/F or 1/2/3)
| Ability | Key | Cooldown | Effect |
|---------|-----|----------|--------|
| **DASH** | Q/1 | 4s | Burst forward at 4× speed for 0.15s. **Invulnerable** during dash. Afterimage trail VFX. |
| **SHIELD BURST** | R/2 | 12s | AoE damage (2× player damage) in 200px radius + gain 50% maxHP as temp shield. Expanding ring VFX. |
| **ORBITAL STRIKE** | F/3 | 18s | Expanding damage ring (4× player damage) sweeps outward to 350px over 0.8s. Hits each enemy once. |

- **Cooldown HUD**: 3 slots at bottom-center with radial sweep cooldown overlay + countdown timer
- **Ready glow**: bright colored border when ability ready, white flash during active
- **Key labels**: Q/R/F shown on each slot

### 📁 Files Modified (6)
- `runtime/State.js` — streak state + ability state + input fields
- `runtime/Input.js` — Q/R/F and 1/2/3 keybinds for abilities
- `runtime/Bullets.js` — streak system in onEnemyKilled, streak loot mult in checkLootDrop
- `runtime/Player.js` — streak decay timer, 3 ability implementations, dash invuln, ability VFX draw
- `runtime/world/World.js` — zone mastery check on all portal transitions
- `main.js` — ability effects draw, streak HUD, ability cooldown HUD

---

## v2.9.1 — Per-Difficulty Progress + Audio Engine v3 (2025-02-25)

### 🛡️ Per-Difficulty Resume Portals (Anti-Exploit)
- **`highestZone` → `highestZones: { normal, risk, chaos }`** — each difficulty lane tracks its own progress independently
- Hub resume section now shows separate buttons per difficulty with zone progress: 🟢 Normal Z15, 🟠 Risk Z8, 🔴 Chaos Z3
- **Exploit closed**: players can no longer farm Normal to Z100 then start Chaos at Z100 with 3× loot
- Backwards-compatible: legacy `highestZone` auto-migrates to `highestZones.normal` on first load
- If a difficulty has no progress yet (zone < 2), clicking it starts from Zone 1

### 🔊 Audio Engine v3.0 — Professional Procedural Synthesis
Complete rewrite of `Audio.js` from basic oscillators to professional multi-layer synthesis:

**Architecture Upgrades:**
- **DynamicsCompressor** on master bus (threshold -18dB, ratio 4:1) — consistent volume levels
- **Feedback-delay reverb bus** (120ms delay, lowpass 2500Hz, 25% feedback) — spatial depth
- **BiquadFilter integration** — every SFX can use lowpass/highpass/bandpass with sweep automation
- **Layered synthesis** — each sound uses 2-4 oscillators + noise layers for richness

**49 SFX Methods (up from 22):**
| Category | New Methods | Description |
|----------|-----------|-------------|
| Weapons (7) | `shootBeam`, `shootHoming`, `shootScatter` | + enhanced laser/plasma/railgun/gatling |
| Impacts (3) | `hitCrit` | Sparkle + bass for critical hits |
| Pickups (5) | All enhanced | Magical arpeggio (items), warm rise (health), metallic clink (scrap) |
| POI (4) | `poiTrigger`, `poiCleared`, `poiReward`, `beaconActivate` | Radar ping, mini-fanfare, treasure cascade, power-up hum |
| Resources (3) | `resourceMine`, `resourceDrop`, `voidShardDrop`, `cosmicDustDrop` | Pick-axe clang, crystal shatter, ethereal drone, celestial choir |
| Difficulty (4) | `difficultyStart`, `poisonDot`, `huntingMineAlert`, `corruptAmbience` | Ominous drone, acid sizzle, rapid beeps, dark pulse |
| Events (3) | `comboUp`, `zoneMastered`, `waveComplete` | Rising pitch combo, triumphant 6-note chord, ascending two-tone |

**Music System Enhanced:**
- New `combat_chaos` track — deeper bass (42Hz), 4 chord layers, dissonant beating, faster filter LFO
- All tracks: bass drone + filter LFO + chord pad layers (3-4 voices) + optional dissonant beating
- Automatic track selection: Chaos difficulty → `combat_chaos` instead of `combat_t1`

**Audio Integration Points (new):**
- Poison DOT: throttled acid sizzle every 800ms while in poison area
- Hunting mines: rapid triple-beep when mine within 200px of player  
- Difficulty start: ominous SFX when entering Risk/Chaos
- POI lifecycle: trigger ping → cleared fanfare → reward cascade
- Rare materials: distinct ethereal/celestial SFX for void shards and cosmic dust
- Beacon defense: power-up hum on completion

### 📁 Files Modified (6)
- `runtime/Audio.js` — Complete rewrite (670 → 580 lines, more efficient)
- `runtime/State.js` — `highestZones` per-difficulty field
- `runtime/world/World.js` — Per-diff zone tracking, POI audio hooks, chaos audio hooks
- `runtime/Bullets.js` — Rare material drop audio hooks
- `main.js` — Per-difficulty resume UI, difficulty start SFX
- `ROADMAP.md` — Phase 5.8 status

---

## v2.9.0 — Resume Portal + Difficulty Lanes (2026-02-24)

### ⚡ Resume Portal (Anti-Frustration)
- **Hub now shows "CONTINUE FROM ZONE X"** card when highestZone > 1
- Player can resume from their highest reached zone immediately
- Pulsing cyan border highlights the resume option
- No more replaying early zones after death

### 🟢🟠🔴 Three Difficulty Lanes
Every portal (including resume) now offers 3 difficulty modes:

| Lane | Enemies | Loot | Special |
|------|---------|------|---------|
| **🟢 NORMAL** | Standard | Standard | Default game flow |
| **🟠 RISK** | 3× elite density, +30% HP, +20% damage | +1 rarity tier, +80% cells, +50% scrap/XP | High elite packs everywhere |
| **🔴 CHAOS** | 5× elites, +80% HP, +60% damage, 60% regular→elite promotion | +2 rarity tiers, 3× cells, 2.5× scrap/XP | Corrupted enemies, DOTs, hunting mines, poison areas |

### 🔴 CHAOS Mode Features
- **Corrupted Enemies**: All enemies have purple corruption aura with orbiting wisps
- **Elite Promotion**: 60% chance each regular enemy gets auto-promoted to elite
- **Hunting Mines**: Mines actively track the player within 600px radius
- **Poison Areas**: 3-5 toxic zones per map with skull icons, DOT damage while inside
- **Tougher Asteroids**: 2.5× asteroid HP in chaos
- **Rare Material Bonus**: 3× void shard drops, 5× cosmic dust, elite void shard chance
- **Boss chaos drops**: Guaranteed void shards + 25% cosmic dust from bosses

### 🎨 HUD Updates
- **Difficulty Badge**: Shows 🟠 RISK or 🔴 CHAOS with loot bonus indicator
- Chaos badge pulses red for visual feedback
- Difficulty buttons on every unlocked portal card
- Each portal card shows Normal/Risk/Chaos selection

### ⚙️ Technical
- `State.run.difficulty` tracks current lane ('normal'|'risk'|'chaos')
- `World.getDiffMods()` provides multipliers accessible from any module
- `_updateChaosEffects()` handles poison DOT + hunting mine tracking
- Poison areas skip collision (no pushback, DOT only)
- Difficulty multipliers applied at enemy spawn, not retroactively
- Loot rarity boost uses ladder promotion (common→uncommon→rare→epic→legendary)

---

## v2.7.1 — Retention & Feel Overhaul (2026-02-24)

### 🔴 P0: Vendor Upgrades Broken
- **BUG**: Projectiles, pierce, shield, regen vendor upgrades had ZERO effect
  - Root cause: all upgrades applied as `'percent'` but additive stats (projectiles, shieldCap, hpRegen, piercing) start from 0 or 1
  - `0 × 1.2 = 0` (shield stayed zero), `1 + 0.01 = 1` (projectiles rounded to 1)
- **FIX**: Stats.js now uses flat application for additive stats, percent for multiplicative stats

### 🟡 P1: Enemy Scaling Outpaces Player (Boring at Zone 30)
- **Problem**: Enemy HP scaled at `1.1^level` but player damage only grew by flat +2/point
  - Level 30 grunt took 4.3 seconds to kill (should be ~2s)
- **FIX — Power rebalance**:
  - Pilot stats now percentage-based: Power = +5%/pt (was flat +2), Vitality = +5%/pt (was flat +5)
  - Auto-level scaling: +3% damage & HP per level (always grows, even without stat allocation)
  - Enemy scaling reduced: `1.06^level` (was `1.10^level`)
  - Boss scaling reduced: `1.08^level` (was `1.15^level`), level offset +0-2 (was +0-5)
  - Base damage buffed: 8 (was 6)
  - Wave scaling default: `1.05` (was `1.08`)
- **Result**: Grunt TTK stable at 1.2-3.1s across 50 levels (was 1.4-18.5s)

### 🟡 P1: Item Drops All White (No Rarity Color)
- **BUG**: Rarity was only determined at pickup collection, not at spawn
  - `pk.rarity` was null for non-boss/non-elite drops → fallback to `#ffffff`
- **FIX**: Pre-roll rarity when pickup spawns in Bullets.js
  - Drops now show correct rarity color immediately on the ground
  - Common=grey, Uncommon=green, Rare=blue, Epic=purple, Legendary=orange, Mythic=red
- **BONUS**: Enhanced drop rendering by rarity tier:
  - Size scales with rarity (common=10px, mythic=20px)
  - Epic+ gets vertical light beam
  - Legendary+ gets orbiting sparkles
  - Rare+ shows rarity label text above drop

### 🟡 P1: Equipped Items Cluttering Stash
- **FIX**: Equipped items now hidden from stash grid (shown only in equipment slots)
- Stash empty slot count properly reflects available space

### 🟢 P2: Vendor Felt Useless
- Tier-1 costs reduced ~40-50% (cheapest: 10⚡ Magnet, most: 15-50⚡)
- Cells per kill: 5 (was 3) — first vendor buy achievable in ~2 zones
- Vendor cards now show stat preview: `+0% → +15%` with before/after values
- Vendor cards show effect description
- Purchase feedback: announcement banner + audio

### 🟢 P2: Crafting UI Unclear
- Each recipe now shows contextual description based on selected item
  - e.g., "Re-randomize ALL bonus stats on this rare item"
  - "Add another bonus stat (2/3 slots used)"
- Disabled recipes show WHY: "Not enough materials" / "Not available for this item"
- Success chance color-coded: green ≥70%, yellow ≥40%, red <40%
- Cost breakdown with colored currency icons

### Balance Numbers
| Stat | Before | After |
|------|--------|-------|
| Base damage | 6 | 8 |
| Power stat | +2 flat/pt | +5%/pt |
| Enemy scale/lvl | 1.10× | 1.06× |
| Boss scale/lvl | 1.15× | 1.08× |
| Boss level offset | +0-5 | +0-2 |
| Level auto-bonus | none | +3%/lvl |
| Cells/kill | 3 | 5 |
| Vendor T1 cost range | 20-80⚡ | 10-50⚡ |
| Grunt TTK @ lvl 30 | 4.3s | 1.7s |
| Tank TTK @ lvl 30 | 10.8s | 4.2s |

---

## v2.8.0 — Level Design Overhaul: POI System + Resource Mining (2026-02-24)

### 🔵 NEW: Points of Interest (POI) System
Zones are no longer empty rectangles with random scatter. Every zone now contains **3-7 structured encounters** placed along a navigable path from spawn to exit.

**10 POI Types** (unlocked progressively by depth):
| POI | Depth | Description |
|-----|-------|-------------|
| 📦 Guard Post | 1+ | 4-6 enemies guarding a loot cache with cover obstacles |
| 💎 Hidden Cache | 1+ | Light/no guard, guaranteed rare+ item drop |
| ⛏️ Ore Deposit | 1+ | 3-5 rich ore asteroids, 3× scrap per node |
| ⚠️ Ambush Zone | 5+ | Invisible until triggered, 5-8 enemies spawn around you |
| 🔧 Salvage Wreck | 5+ | Destroyed ship hull: mixed scrap + cells + 30% item chance |
| 💀 Elite Den | 10+ | Mini-boss + minions in arena, guaranteed epic+ loot |
| 🔷 Crystal Cavern | 10+ | Blue crystal nodes: 4× cells, void shard chance |
| 📡 Defense Beacon | 20+ | Press E to start wave defense, epic/legendary reward |
| 🌀 Void Rift | 20+ | Dangerous area with void crystal nodes (void shards + cosmic dust) |
| 🏛️ Ancient Vault | 50+ | 2 elites + 6 minions, guaranteed legendary + void shards |

**POI Lifecycle:**
1. Grey marker on minimap → approach to trigger
2. Yellow marker → clear all enemies
3. Green marker → walk in to collect reward (loot explosion + VFX)

### 🔵 NEW: Resource Mining System
**4 Mineable Node Types** scattered across zones + inside POIs:
| Node | Visual | Drops | Special |
|------|--------|-------|---------|
| Ore Rich | Gold-veined asteroid with glow | 3× Scrap | — |
| Crystal Node | Blue hexagonal crystal | 4× Cells | 3-15% Void Shard chance |
| Void Crystal | Purple pulsing pentagon | Void Shard + Scrap | 8-10% Cosmic Dust chance |
| Salvage Wreck | Ship hull fragment | Mixed scrap + cells | 30% item drop |

All nodes have unique colored glow + animated rendering. Destruction triggers colored explosion VFX matching node type.

**Drop announcements:** "💠 VOID SHARD found!" / "✨ COSMIC DUST found!" banner on rare material drops.

### 🔵 NEW: Navigation HUD
- **POI Compass:** Edge-of-screen arrows point to off-screen POIs with icon + distance
- **Minimap POI markers:** Diamond shapes (grey=undiscovered, yellow=active, green=cleared)
- **Minimap resource nodes:** Small colored dots matching node glow
- **Zone Tracker:** "📍 X POI remaining" counter in HUD
- **Status prompts:** "[COLLECT]" / "[PRESS E]" / "[CLEAR ENEMIES]" shown near POIs

### 🟢 Zone Dimension Retuning
| Parameter | Before | After | Why |
|-----------|--------|-------|-----|
| mapScale | 5.0 | 3.5 | Smaller = denser content, less dead space |
| enemyDensityMult | 0.35 | 0.45 | More ambient encounters between POIs |
| eliteDensityMult | 0.5 | 0.6 | Slightly more elite encounters |
| maxEnemySpawns | 90 | 75 | Lower cap since POIs add 15-35 more |
| minDistBetween | 190 | 160 | Tighter clusters feel more natural |

**Content per zone (depth 1 → depth 50):**
- Ambient enemies: 75 (capped)
- POI enemies: ~15 → ~35
- POIs: 4 → 7
- Resource nodes: 3 → 6
- Total enemies: ~90 → ~110
- Zone cross time: ~31s → ~35s

---

## v2.11.0 — "The Polish Patch" (2026-02-26)

### 🔧 CRITICAL FIX: Background Tiles Activated
- **Background.js was never wired into World.js** — tiles existed but were invisible
- Added `import { Background }` to World.js
- `Background.prepareZone()` now called on every zone load
- `Background.draw()` integrated into `drawParallaxBackground()` (with starfield fallback)
- Fixed asset paths: fog referenced 3 files (only 1 exists), deco referenced 5 files (only 2 exist)
- **Result**: Tiled terrain (void/toxicity/city_ruins) + fog overlays + deco asteroids now visible from zone 1

### ✨ NEW: Post-Processing Pipeline (PostFX.js)
- **Bloom**: Soft radial glow centered on player, intensifies with kill streak (orange bloom at 5+ streak)
- **Vignette**: Edge darkening focuses attention on center; red vignette warning when HP < 30%
- **CRT Scanlines**: Subtle 2px repeating pattern for retro space feel
- **Ambient Space Dust**: 60 drifting particles with twinkle animation (screen-space, zero perf cost)
- Full pipeline: scene → bloom → dust → vignette → scanlines → HUD

### 🔫 Enhanced Weapon Trail FX (6 Types)
| Weapon | Enhancement |
|--------|------------|
| **Laser** | Double-layer trail (outer glow 4×wide + inner bright), trail length 12→24px |
| **Plasma** | Wobbly dripping trail with quadratic curve behind blob |
| **Railgun** | 40px trail (was 22), wide subtle glow halo + enhanced tip flash |
| **Missile** | Unchanged (already had exhaust) |
| **Gatling** | Speed trail behind each round (was just dots) |
| **Nova** | Unchanged (already had pulsing sphere) |

### 💥 Per-Weapon Impact Sparks
Every bullet type now triggers unique VFX on enemy hit:
- **Laser**: Cyan sparks (3 normal, 6 on crit)
- **Plasma**: Green sparks + trailing splatter
- **Railgun**: Purple sparks + white flash
- **Missile**: Orange explosion (8 particles) + flash
- **Gatling**: Small yellow sparks (fast, minimal)
- **Nova**: Purple ring pulse + sparks

### 🔦 Enhanced Muzzle Flash
- Muzzle flash color now matches weapon type (cyan/green/purple/orange/yellow/purple)
- Additional `Particles.flash()` at barrel position per shot

### 💎 Loot Drop Polish
- **Bounce Animation**: Items drop with elastic bounce (0.5s, 2 bounces from 20px height)
- **Ground Glow Aura**: Rare+ items emit circular radial glow beneath them (radius scales with rarity)
- **Beam + Bounce**: Epic+ light beams now track bounce position
- All sparkles and rings follow bounce offset

### Files Modified (7)
| File | Change |
|------|--------|
| `runtime/world/Background.js` | Fixed fog/deco asset paths to match actual files |
| `runtime/world/World.js` | Import Background, call prepareZone + draw |
| `runtime/PostFX.js` | **NEW** — Bloom, vignette, scanlines, ambient dust |
| `main.js` | Import PostFX, init/update/draw pipeline integration |
| `runtime/Bullets.js` | Enhanced trails (laser/plasma/railgun/gatling), impact sparks per type |
| `runtime/Player.js` | Per-weapon muzzle flash colors |
| `runtime/Pickups.js` | Drop bounce animation, rarity ground glow aura |


---

## v2.11.1 — "Cleanup Hotfix" (2026-02-26)

### 🔧 FIX: Tile White Borders
- **Root cause**: JavaScript `%` operator returns negative values for negative camera positions → 1px gaps between tile repeats
- **Fix**: Positive modulo `(((camX % tw) + tw) % tw)`, disabled `imageSmoothingEnabled` during tile draws, extended fill padding to `±3×tile_size`

### 🧹 Visual Cleanup (5 noise layers removed)
| Removed | What it was | Why |
|---------|-------------|-----|
| Starfield over tiles | 100+ star dots drawn ON TOP of tile pattern | Tiles already provide visual depth — stars added noise |
| Foreground nebula wisps | Colored ellipses overlaid above game objects | Created visual mud on top of tiles |
| PostFX scanlines | 2px repeating stripe pattern over full screen | Retro gimmick, added noise without improving readability |
| PostFX bloom | Radial gradient with 'screen' blend at player pos | Barely visible, added GPU cost for nothing |
| PostFX ambient dust | 60 drifting particles across screen | More visual noise, competed with actual gameplay particles |

### 🔽 Visual Reduction
- Dust clouds + nebula patches: alpha reduced to 30% of original when tiles are active (tiles already provide atmosphere)

### ✅ Kept (things that actually help)
- **Vignette**: Edge darkening focuses eye on center — genuine improvement
- **Low-HP red pulse**: Gameplay feedback, not decoration
- **Weapon trails + impact sparks**: Combat feedback (from v2.11.0)
- **Loot bounce + ground glow**: Item readability (from v2.11.0)

### Lesson Learned
More layers ≠ more polish. Visual hierarchy matters: **Background (dark, atmospheric) → Game Objects (bright, readable) → UI (clear, minimal)**. Each layer should serve readability, not compete for attention.


---

## v2.12.0 — "The Gameplay Patch" (2026-02-26)

### 🎯 ZONE OBJECTIVES (5 types)
Every zone (depth 3+) gets a random objective that changes HOW you play:

| Objective | Mechanic | Exit Locked? |
|-----------|----------|:------------:|
| **EXTERMINATE** 💀 | Kill 80% of enemies | ✅ Yes |
| **SURVIVAL** ⏱️ | Survive 30-80s in arena | ✅ Yes |
| **TIME TRIAL** ⚡ | Reach exit fast for bonus loot | ❌ No (bonus only) |
| **CORRUPTION** ☠️ | Zone gets deadlier over time — exit when you dare | ❌ No (risk/reward) |
| **LOCKDOWN** 🔒 | Destroy 3 generators to unlock exit | ✅ Yes |

Locked exits show RED with 🔒 icon. Progress bar at top of screen.
Completing objectives awards bonus scrap + cells scaling with depth.

### 🔫 WEAPON SYSTEM (6 types, drops from elites/bosses)
All 6 weapon types now PLAYABLE with distinct feel:

| Weapon | Fire Rate | Damage | Special |
|--------|-----------|--------|---------|
| **Laser** | ×1.0 | ×1.0 | Balanced default |
| **Plasma** | ×0.6 | ×1.5 | Slow, high damage, slight spread |
| **Railgun** | ×0.35 | ×3.0 | Charge-style, +2 pierce, fast projectile |
| **Missile** | ×0.5 | ×2.0 | Slow projectile, high damage |
| **Gatling** | ×2.5 | ×0.4 | Spray & pray, +2 projectiles, jitter |
| **Nova** | ×0.8 | ×1.8 | 360° burst, 6 projectiles, short range |

- **Elite kills**: 15% weapon drop chance
- **Boss kills**: 50% weapon drop chance
- Weapon pickups: glowing hexagon with weapon color
- HUD: bottom-right weapon indicator with damage/speed stats

### 🔀 BRANCHING EXITS (depth 3+)
Zone exits become route CHOICES:

| Route | Risk | Reward |
|-------|------|--------|
| 🟢 **SAFE** | Standard zone | Normal loot |
| 🟡 **RISKY** | +1 zone modifier | +50% loot |
| 🔴 **VAULT** | Dead end, +2 mods | +100% loot, guaranteed rare+ |

Three colored portals at zone exit. Each visually distinct with label + description.

### Why This Matters
Before: Spawn → walk to exit → repeat. Zero decisions, 5-minute bore.
After: Every zone asks "what's the objective?", every elite drop asks "switch weapon?", every exit asks "safe, risky, or vault?"


### v2.12.0a — Integration Hotfix (same session)
- **FIX**: Added `Pickups.add()` method (weapon drops were calling non-existent function)
- **FIX**: Corruption objective now applies damage multiplier to incoming player damage (×1.0→×3.0)
- **FIX**: Route loot multiplier (risky +50%, vault +100%) now applied in loot drop calculations
- **FIX**: Vault route guarantees rare+ floor on all item drops
- **FIX**: Objective bonus loot (scrap + cells) now awarded on zone exit
- **FIX**: Time trial bonus awarded if player reaches exit before timer expires
- **FIX**: Corruption bonus scales with how long player stayed (×2 per corruption%)
- **FIX**: Objective announced to player on zone load (text + HUD popup after 500ms)
- **FIX**: Corruption zones tint screen progressively red (PostFX overlay)

---

## v2.12.1 — "The Cleanup Patch" 

### P0: Performance
- **FIXED: Tile background lag** — Rewrote Background.js with offscreen canvas tile buffer. Old: `createPattern` + `fillRect` over 3× screen area every frame (~2ms per frame). New: pre-stamp tiles once into offscreen canvas, blit with single `drawImage` (~0.1ms). **~20× faster BG rendering.**
- **FIXED: White tile seams** — Removed scale transform from tile offset math. Offset now computed in pixel space with positive modulo.

### P0: Obstacle Overload
- **FIXED: 1200 obstacles per zone → 50** — `config.json` had `maxObstaclesPerZone: 1200` which overrode code defaults. Now set to 50. Cluster sizes reduced (4-10 per cluster, 2-4 clusters).
- **FIXED: Mines in normal zones** — Mines now spawn ONLY in zones with the MINEFIELD modifier. Normal zone pools: `['asteroid', 'debris']` only.

### P0: POI Markers Persist
- **FIXED: Cleared POI markers remain forever** — POIs with no collectible reward now auto-set `collected=true` on clear, removing the marker immediately.
- **FIXED: POI rewards hard to collect** — Auto-collect timer: 2s after clearing, if player is within `radius + 50px`, reward auto-collects.

### P1: POI Rewards Too Low
- **Boosted all POI rewards** — Guard Post: 30-60 + depth×2 scrap (was 15-40). Treasure Cache: 25-50 + depth×2 (was 8-20). Ambush Zone: 30-60 + depth×2 each (was 20-50). Elite Den: 50-80 + depth×3 scrap, 20-40 + depth×2 cells (was 30-60, 15-30). Ore Deposit now has reward (was null).

### P1: Weapon Switching
- **Added Tab key weapon cycling** — Tab = next weapon, Shift+Tab = previous, Backspace = reset to Laser.
- **HUD updated** — Shows "TAB cycle · BKSP laser" hint below weapon name.

### P1: Crafting Before/After Preview
- **Added stat comparison on craft** — Crafting now captures item snapshot before operation, shows BEFORE → AFTER side-by-side with color-coded changes (green = new/better, red = worse).
- **Item stats shown in craft slot** — Selected item now displays base stats and affixes in the crafting slot, not just icon.
- **CSS fixes** — Craft slot expanded (120×auto), result panel left-aligned for comparison layout.

### Integration Fixes (from v2.12.0a)
- Pickups.add() method (weapon drops now spawn correctly)
- Corruption damage multiplier applied to Player.takeDamage
- Route loot multiplier applied in Bullets.checkLootDrop
- Vault route guarantees rare+ floor on drops
- Objective bonus loot awarded on zone exit
- Time trial bonus awarded on exit before timer
- Corruption bonus scales with time stayed
- Objective announced to player on zone load
- Corruption zones tint screen progressively red
- Weapon balance pass (Nova/Gatling DPS normalized)

---

## v2.12.2 — "Variety & Balance Patch"

### P0: Tile Background → Procedural Parallax
- **REMOVED tile backgrounds entirely** (persistent white seam issue across all browsers)
- **NEW: Procedural 3-layer parallax** per biome:
  - Layer 0: 350-550 twinkling stars (0.05 parallax, near-static)
  - Layer 1: 6-12 nebula clouds with radial gradients (0.08 parallax + drift)
  - Layer 2: 30-60 close particles (0.3-0.6 parallax)
- **5 unique biome palettes**: Asteroid Belt (blue/white), Nebula Depths (purple/pink), The Void (deep purple), Derelict Fleet (amber/warm), Event Horizon (red/crimson)
- **Zero tile loading, zero seam issues, zero lag**

### P0: Zone Progression Unlocked
- **All 5 portals unlocked** — no more zone gating that was impossible to reach
- **Tier boundaries lowered**: Tier1 z1-20, Tier2 z21-50, Tier3 z51-100, Tier4 z101-200, Tier5 z201+
- Visual variety hits at zone 21 (new biome colors), 51, 101, 201
- Enemy/item levels still scale with depth (no power gating removed)

### P1: Chaos Mode Rebalanced
- **Enemy HP: 1.8× → 3.0×** (was barely noticeable, now threatening)
- **Enemy Damage: 1.6× → 2.5×** (actually dangerous)
- **NEW: Enemy Speed +40%** in chaos (enemySpeedMult applied)
- **Elite promotion: 60% → 30%** (less spam, each more impactful)
- **Loot rarity boost: +2 → +1** (no more instant legendary on every drop)
- **NEW: Legendary cap** — non-boss legendary drops downgraded to epic 70% of time
  - Result: ~6% legendary from chaos elites (was near 100%)
  - Bosses still guarantee legendary consideration
- **DOT damage: 3 → 5** per second

### P1: Chaos Enemy Visuals
- **Corruption overlay reworked** — was opaque purple circle hiding enemy art
- **Now**: thin purple ring + 2 small orbiting wisps. Enemy type clearly visible underneath.

### Files Modified (7)
1. runtime/world/Background.js — complete rewrite (procedural parallax)
2. runtime/world/World.js — chaos balance, enemy speed mult
3. runtime/Enemies.js — subtle corruption overlay
4. runtime/Bullets.js — legendary drop cap
5. data/acts.json — tier boundaries lowered, all portals unlocked
6. PATCH_NOTES.md

---

## v2.12.2 — "Visual Variety + Chaos Rebalance"

### P0: Tile White Seams — REMOVED TILES ENTIRELY
- Replaced tile-based background with **procedural parallax starfield**
- Zero tile images loaded, zero seam possibility
- 3 parallax layers per biome: deep stars (twinkle), nebula clouds (drift), close particles
- **5 unique biome palettes**: Asteroid (blue/white), Nebula (pink/purple), Void (deep purple), Derelict (amber/warm), Black Hole (red/crimson)
- Each zone generates unique star placement from zone seed → no two zones look alike

### P0: Portal Unlock Gating Removed
- All 5 portals now **unlocked by default** — no level gate required
- Tier boundaries lowered to reachable ranges:
  - Tier 1 (Asteroid Belt): Zone 1-20
  - Tier 2 (Nebula Depths): Zone 21-50
  - Tier 3 (The Void): Zone 51-100
  - Tier 4 (Derelict Fleet): Zone 101-200
  - Tier 5 (Black Hole): Zone 201+
- Enemy/item levels still scale with depth (unchanged)

### P1: Chaos Mode Rebalance
- **Enemy HP**: 1.8× → **3.0×** (enemies were barely tougher than normal)
- **Enemy Damage**: 1.6× → **2.5×** (actually threatening now)
- **Enemy Speed**: NEW +40% movement speed (enemies chase harder)
- **Elite Promotion**: 60% → **30%** (less spam, more meaningful)
- **DOT Damage**: 3 → **5** per second (environment hurts)
- **Loot Rarity Boost**: +2 → **+1** tier (was instant legendary, now +1 step)
- **Legendary Cap**: Non-boss legendary drops have 70% chance to downgrade to epic
- **Resource Mults**: Reduced (cells 3×→2.5×, scrap 2.5×→2×, void 3×→2×, dust 5×→3×)

### P1: Chaos Enemy Visuals
- **FIXED: "Purple circles"** — Corruption overlay changed from filled purple circle (hiding all enemy art) to subtle ring outline + 2 small orbiting wisps
- Enemy sprites/shapes now fully visible through corruption effect

### Files Modified
- runtime/world/Background.js (complete rewrite — procedural parallax)
- runtime/world/World.js (chaos balance, enemy speed mult, tier transitions)
- runtime/Enemies.js (corruption overlay → subtle ring)
- runtime/Bullets.js (legendary drop cap)
- data/acts.json (portal unlocks, tier boundaries)
