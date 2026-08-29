# A40 — Juice / Flow Pass

## Diagnosis first
Before adding anything, audited the existing FX. Most of the "clunky" was NOT
missing effects — it was:
1. The A38/A39 game-loop crash (fixed in A39) killing rendering every frame.
2. **Screen shake was dead code.** Death/impact sites set `Particles.screenShake`
   (boss 10, elite 4, standard 1.5, big player hits 8) but *nothing ever applied it* —
   `Camera.triggerShake` was never called anywhere in the build.
3. **No hitstop** existed at all.

Everything else is already effect-rich and was left intact:
- Bullets: full per-weapon-type COLOUR + SHAPE (laser red lance, plasma green blob,
  railgun purple beam, missile orange triangle+exhaust, gatling yellow dots,
  nova purple pulsing sphere) with trails/glow/crit-sparkle.
- Impacts: per-type sparks/flash/ring/explosion on every hit (Bullets.js).
- Deaths: multi-stage explosions + rings + flash, scaled boss/elite/standard.
- Loot: drop-bounce, pulse, rarity-scaled glow, rare+ ground aura, epic+ light beam.

## Changes (surgical — activate the dormant feel layer)
**main.js**
- Hitstop engine in the loop: `_hitstopRemaining` freezes gameplay (combatDt=0)
  while rendering continues — the classic impact "crunch". Hard-capped at
  `HITSTOP_MAX` (0.12s) so nothing can runaway-freeze. `_hitstopCooldown` (0.09s)
  prevents mush during rapid fire.
- `requestHitstop(frames, force)` helper. `force` (crits/kills/bosses) bypasses cooldown.
- `hitstopEveryHit` flag (default **false** = crits/kills/bosses only, keeps spray fluid;
  flip to true for hitstop on every single hit).
- Shake bridge in updateCombat: consumes `Particles.screenShake` → `Camera.triggerShake`,
  so all existing (already-tuned) shake intensities finally apply.

**Bullets.js** — at the player-hit site:
- Hitstop: 2 frames on kill, 3 on crit (forced); optional all-hits via flag.
- Subtle shake while chipping a boss (2, or 3 on crit).

**Enemies.js** — in kill():
- Boss death: 6-frame chunk-freeze. Elite death: 3-frame.

## Sprite back-door — fully open, untouched
Shake + hitstop are renderer-agnostic. Every visual already has a SpriteManager hook:
bullets (`SM.drawAnimated` travel), impacts (`_playBulletImpactSprite`, `hit_spark`),
deaths (`SM.playBestEffect`), loot (`SM.has/play` pickups). Drop sprite sheets into the
matching SpriteManager categories later and they override the procedural draw with zero
code change.

## Tuning knobs (all in main.js)
- `Game.hitstopEveryHit` — true = freeze on every hit
- `Game.HITSTOP_MAX` — hard freeze cap
- per-event frames: hit site (Bullets.js) + kill (Enemies.js)
- shake intensities: the existing `Particles.screenShake = ...` lines (Enemies.js kill,
  Bullets.js, World.js) — higher = stronger.

## Verification
- acorn strict parse 56/56 clean; headless boot 0 errors / 0 request failures
- shake bridge: legacy scalar 7 → Camera.shake.intensity 7, scalar reset (confirmed in-game)
- hitstop: request(6,true) → 0.10s, drains to 0, 0 errors during the freeze
- gating: 10 rapid non-forced requests stay at one 2-frame hitstop (no stacking, under cap)
- A39 loop-crash fix intact
