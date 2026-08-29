# BONZOOKAA! — Changelog v2.16.0 "The Flow Patch"
**Date:** 2026-03-15
**Focus:** Object Pool wiring (zero GC in hot paths) + event hook audit + GitHub structure

---

## [P1] Object Pool — BulletPool Wired (runtime/Bullets.js)

**Before:** Every bullet fired allocated a new JS object → GC pauses at sustained fire rates.
**After:** `BulletPool.acquire()` recycles pre-allocated objects. `BulletPool.release(b)` called at all 7 removal sites.

### Changes
| Location | Before | After |
|---|---|---|
| `Bullets.spawn()` | `State.bullets.push({...})` | `BulletPool.acquire()` + field assign |
| Out-of-bounds (zone) | `splice(i,1)` | `BulletPool.release(b)` → `splice` |
| Out-of-bounds (canvas) | `splice(i,1)` | `BulletPool.release(b)` → `splice` |
| Mine detonation | `splice(i,1)` | `BulletPool.release(b)` → `splice` |
| Pillar impact | `splice(i,1)` | `BulletPool.release(b)` → `splice` |
| Asteroid destroy | `splice(i,1)` | `BulletPool.release(b)` → `splice` |
| Shielder deflect | `splice(i,1)` | `BulletPool.release(b)` → `splice` |
| Pierce exhausted | `splice(i,1)` | `BulletPool.release(b)` → `splice` |
| Inline sparks (pillar/asteroid) | `State.particles.push({})` ×9 | `Particles.sparks()` (pool-safe) |

**Perf target:** 0 bullet object allocations in steady-state combat. GC pauses < 1ms/frame at 200+ bullets/frame.

---

## [P1] Object Pool — ParticlePool Wired (runtime/Particles.js)

**Before:** Every particle effect (`explosion`, `sparks`, `ring`, `flash`, `floatUp`, `trail`, `text`) allocated new objects.
**After:** All 8 emit helpers use `ParticlePool.acquire()`. Update loop calls `ParticlePool.release(p)` on death and on cull.

### Changes
| Method | Before | After |
|---|---|---|
| `spawn()` default | `State.particles.push({})` | `ParticlePool.acquire()` |
| `explosion()` | `push({})` × count | `ParticlePool.acquire()` × count |
| `sparks()` | `push({})` × count | `ParticlePool.acquire()` × count |
| `ring()` | `push({})` | `ParticlePool.acquire()` |
| `flash()` | `push({})` | `ParticlePool.acquire()` |
| `floatUp()` | `push({})` × count | `ParticlePool.acquire()` × count |
| `trail()` | `push({})` | `ParticlePool.acquire()` |
| `text()` | `push({})` | `ParticlePool.acquire()` |
| `update()` death | `splice(i,1)` | `ParticlePool.release(p)` → `splice` |
| `update()` cull | `splice(0, excess)` | release each → `splice` |

**Damage numbers** (`Bullets.spawnDamageNumber`): also migrated to `ParticlePool.acquire()` with full field assign including `scale` and `isCrit`.

**Pool config (ObjectPool.js):**
- `BulletPool`: 128 pre-allocated, grows on demand
- `ParticlePool`: 256 pre-allocated, grows on demand

---

## [P2] Event Hook — Achievements.onEnemyKill in onBossKilled (main.js)

**Before:** `main.js:onBossKilled()` called `Missions.onEnemyKill` but NOT `Achievements.onEnemyKill` for boss kills.
**After:** Both called. Boss kills now correctly credit achievement progress (e.g. "Boss Hunter" achievement).

```js
// main.js onBossKilled() — added line:
try { Achievements.onEnemyKill({ isBoss: true, isElite: false }); } catch(e) {}
```

Note: Regular enemy kill events were already fully wired via `Bullets.js:onEnemyKilled()` which calls both `Missions.onEnemyKill` and `Achievements.onEnemyKill` for every kill. This patch closes the boss-kill gap in main.js only.

---

## [DOCS] GITHUB_STRUCTURE.md — New File

Full branch topology document added:
- Protected `main` branch rules + CI checklist
- `dev/feature/*`, `asset/sprites/*`, `asset/audio/*`, `balance/*`, `hotfix/*` conventions
- Directory structure with annotations
- Sprite state requirements per category (player/enemies/bosses/bullets/pickups/effects)
- Naming conventions table
- Asset PR workflow (example: adding new enemy sprite)

---

## Files Modified

| File | Change |
|---|---|
| `runtime/Bullets.js` | BulletPool+ParticlePool import; spawn() pool-acquire; 7 splice→release; 2 inline sparks→Particles.sparks(); spawnDamageNumber pool-acquire |
| `runtime/Particles.js` | ParticlePool import; all 8 emit helpers pool-acquire; update() pool-release on death+cull |
| `main.js` | onBossKilled: add Achievements.onEnemyKill |
| `GITHUB_STRUCTURE.md` | New file |
| `ROADMAP.md` | Phase 10.1 marked complete; v2.16.0 added to version history |

---

## Test Checklist

```
1. Fire gatling (high fire rate) for 10s → Chrome DevTools Memory → heap stable, no saw-tooth
2. Boss kill → Achievements panel shows boss kill progress increment
3. Kill 10 enemies → Missions "Kill X" counter matches kill count exactly
4. Enter zone with 300+ particles on screen → no frame drops vs baseline
5. BulletPool.getStats() → recycleRate > 0.95 after 60s combat
6. ParticlePool.getStats() → recycleRate > 0.90 after 60s combat
7. Zone 1 → Zone 601 → no regression in enemy scaling, loot drops, UI
8. All JS files: node --check passes with 0 errors
```

---

## Performance Targets

| Metric | v2.15.0 | v2.16.0 Target |
|---|---|---|
| Bullet allocs/frame (sustained fire) | ~8–15 new objects | 0 in steady state |
| Particle allocs/frame (combat) | ~30–80 new objects | 0 in steady state |
| GC pause (heavy combat) | 5–20ms spikes | < 1ms |
| BulletPool recycle rate | N/A | > 95% |
| ParticlePool recycle rate | N/A | > 90% |
