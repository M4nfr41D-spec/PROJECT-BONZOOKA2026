# BONZOOKAA! — GitHub Branch & Repository Structure
<!-- Copyright (c) Manfred Foissner. All rights reserved. License: See LICENSE.txt -->
_Last updated: v2.16.0 — 2026-03-15_

---

## Branch Topology

```
main                              ← protected, ship-ready builds only
│
├── dev/feature/<name>            ← one concern per branch, squash-merge
│   ├── dev/feature/object-pool-wiring
│   ├── dev/feature/ai-director
│   ├── dev/feature/save-slots
│   ├── dev/feature/set-bonuses
│   └── dev/feature/onboarding
│
├── asset/sprites/<category>      ← sprite art branches, PR → main
│   ├── asset/sprites/player
│   ├── asset/sprites/enemies
│   ├── asset/sprites/fx
│   ├── asset/sprites/pickups
│   └── asset/sprites/bosses
│
├── asset/audio/<category>        ← audio asset branches
│   ├── asset/audio/sfx
│   └── asset/audio/music
│
├── balance/<patch-id>            ← balance / sim branches
│   └── balance/v2.16-pool-pass
│
└── hotfix/<issue-id>             ← P0 emergency only, direct merge + bump
    └── hotfix/syntax-fix-v14
```

---

## Branch Rules

| Branch | Merge via | Requires |
|--------|-----------|----------|
| `main` | PR only | `node --check` all JS pass + manual play-test |
| `dev/feature/*` | Squash merge → main | One feature per branch, no legacy drag |
| `asset/sprites/*` | PR → main | `sprite_manifest.json` updated + SpriteManager load test |
| `asset/audio/*` | PR → main | Web Audio fallback must remain intact |
| `balance/*` | Squash merge → main | Balance sim zone 1–500 output attached |
| `hotfix/*` | Direct → main | Version bump + CHANGELOG entry |

---

## File Structure (v2.16.0)

```
bonzookaa/
├── index.html                       # HTML + CSS + all modals
├── main.js                          # Game loop + hub flow + render pipeline
│
├── runtime/
│   ├── State.js                     # Global state singleton + resetRun
│   ├── DataLoader.js                # JSON loader (EmbeddedData fallback)
│   ├── EmbeddedData.js              # Bundled JSON for local file:// preview
│   ├── EmbeddedSpriteManifest.js    # Bundled manifest for local preview
│   ├── Save.js                      # localStorage + export/import + migration
│   ├── Stats.js                     # Computed stat engine
│   ├── Leveling.js                  # XP curves + level up
│   ├── Mastery.js                   # Endgame mastery / paragon
│   ├── Items.js                     # Item generation + affixes + rarity
│   ├── Player.js                    # Ship update + draw + abilities
│   ├── Enemies.js                   # AI + draw + elite/boss phases
│   ├── Bullets.js                   # Projectiles + BulletPool wiring (v2.16)
│   ├── Pickups.js                   # Drop collection + loot event hooks
│   ├── Particles.js                 # VFX engine + ParticlePool wiring (v2.16)
│   ├── ObjectPool.js                # BulletPool + ParticlePool (v2.16 active)
│   ├── Input.js                     # Keyboard + mouse
│   ├── UI.js                        # HTML panel rendering
│   ├── Audio.js                     # Procedural Web Audio (49 SFX + 5 tracks)
│   ├── Crafting.js                  # Crafting system
│   ├── Missions.js                  # Mission system (10 templates)
│   ├── Prestige.js                  # Prestige / NG+ (7 tiers)
│   ├── Achievements.js              # 30 achievements + instant payouts
│   ├── SpriteManager.js             # Spritesheet runtime + manifest loader
│   ├── PostFX.js                    # Bloom, vignette, CRT, ambient dust
│   ├── PauseUI.js                   # ESC pause overlay
│   ├── AntiExploit.js               # Seed farming + reset abuse + EV checks
│   ├── Contracts.js                 # DOM contract assertions
│   ├── SpatialHash.js               # Spatial collision grid
│   ├── Invariants.js                # Debug assertions
│   └── world/
│       ├── index.js                 # Re-export barrel
│       ├── SeededRandom.js          # Mulberry32 PRNG — deterministic
│       ├── Camera.js                # Camera follow + bounds clamp
│       ├── MapGenerator.js          # Zone gen from seed + act config
│       ├── World.js                 # Obstacles + portals + zone load
│       ├── SceneManager.js          # Scene transitions + act start
│       ├── Background.js            # Procedural parallax starfield (5 biomes)
│       └── DepthRules.js            # Milestone unlocks + depth modifiers
│
├── data/                            # JSON content — source of truth
│   ├── config.json                  # Global tuning: economy, scaling, pools
│   ├── acts.json                    # Tiers + portals + zone ranges
│   ├── enemies.json                 # Enemy specs + AI patterns
│   ├── items.json                   # Base items + slots + stat ranges
│   ├── affixes.json                 # Affix tiers + weights + tag filters
│   ├── skills.json                  # Skill trees + node effects
│   ├── pilotStats.json              # Stat allocation definitions
│   ├── rarities.json                # Rarity bands + drop weights
│   ├── runUpgrades.json             # Vendor upgrades (category/tier)
│   ├── slots.json                   # Equipment slot definitions
│   ├── crafting.json                # Recipes + costs + success rates
│   ├── uniques.json                 # 16 uniques + 2 set families
│   └── packs.json                   # Enemy pack compositions per depth
│
├── assets/
│   ├── sprite_manifest.json         # Single source of truth for all sprites
│   ├── sprites/
│   │   ├── player/ship/             # idle.png, thrust.png, death.png
│   │   ├── enemies/<type>/          # patrol, aggro, fire, death per type
│   │   ├── bosses/<name>/           # patrol + phase states
│   │   ├── elites/<type>/           # patrol state
│   │   ├── bullets/<weapon>/        # travel.png, impact.png per weapon
│   │   ├── pickups/<type>/          # idle.png per pickup type
│   │   ├── equipment/<slot>/        # idle.png per equipment slot
│   │   ├── effects/                 # explosion_small, etc.
│   │   └── deco/                    # asteroid_cluster, etc.
│   ├── backgrounds/                 # Biome tile textures (.webp)
│   ├── fog/                         # Fog overlay PNGs
│   └── asteroids_deco/              # Decorative asteroid PNGs
│
├── tools/
│   ├── sprites_studio_unified.html  # Sprite preview + manifest export
│   └── sprite_generation_machine_patch.js
│
├── ROADMAP.md
├── CHANGELOG.md
├── GITHUB_STRUCTURE.md              # ← this file
└── AUDIT_REPORT_*.md
```

---

## Asset Pipeline

### New sprite (any category)
1. Place PNG → `assets/sprites/<category>/<name>/<state>.png`
2. Add entry to `assets/sprite_manifest.json`
3. Preview in `tools/sprites_studio_unified.html`
4. SpriteManager falls back to canvas primitives if missing — **zero regression**
5. PR on `asset/sprites/<category>`

### New enemy
1. `data/enemies.json` — add spec
2. `assets/sprites/enemies/<type>/patrol.png` — placeholder minimum
3. `sprite_manifest.json` — register all available states
4. `data/acts.json` — add to tier enemy pools at correct depth gate
5. No hardcoded switch cases in `Enemies.js` — must use data-driven pattern

### New item or affix
1. `data/items.json` — base item (slot, stat ranges, rarities)
2. `data/affixes.json` — affix tiers (stat, range, tag filter)
3. `assets/sprites/equipment/<slot>/idle.png` — icon sprite
4. Zero code changes needed if using existing stat tags

### New audio SFX
1. Web Audio synthesis in `Audio.js` first — always works offline
2. Optional `.wav/.mp3` override in `assets/audio/<name>.wav`
3. Synthesis fallback must remain intact regardless

---

## Versioning

```
v<MAJOR>.<MINOR>.<PATCH>
MAJOR  = milestone (new phase complete)
MINOR  = feature patch (new system)
PATCH  = bugfix / hotfix
```

---

## PR Checklist (before any merge to main)

- [ ] `node --check runtime/*.js runtime/world/*.js` — zero errors
- [ ] No stray `console.log` in production paths
- [ ] No raw `State.bullets.push({})` — use `BulletPool.acquire()`
- [ ] No raw `State.particles.push({})` — use `ParticlePool.acquire()`
- [ ] New enemy/item/pickup has placeholder asset + manifest entry
- [ ] Save migration written in `Save.js` if `State.meta` shape changed
- [ ] `CHANGELOG.md` entry added
- [ ] `ROADMAP.md` status column updated
