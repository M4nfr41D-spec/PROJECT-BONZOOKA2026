# A41 — Procedural Explosions & Impacts (replace sloppy PNG FX)

## The real problem (A40 missed it)
A40 was feel-only (shake/hitstop) — visually nothing changed. The thing you were
seeing was the **SpriteManager PNG explosion/impact effects** drawn ON TOP of the
procedural particles. So the "schlampige PNG-Explosionen / rudimentäre Impact-Brocken"
were the PNGs, and my procedural particles were hidden underneath / too subtle.

## What changed
**Sprite back-door flags (Particles.js):**
- `Particles.spriteExplosions = false`  (default → procedural)
- `Particles.spriteImpacts   = false`  (default → procedural)
Flip either to `true` to bring the PNG sprite FX back. Every PNG explosion/impact
spawn site is now gated behind these flags:
- Bullets.js: `_playBulletImpactSprite` (all bullet impacts), mine `explosion_small`,
  resource-node explosion, crit `hit_spark`
- Enemies.js: boss / elite / standard death explosions

**Rich multi-layer procedural explosion (Particles.explosion — same signature, so
every existing caller upgrades for free):**
1. white-hot core flash + colored bloom
2. 1–2 bright additive expanding shockwave rings
3. fast additive **streak shrapnel** (the punch)
4. glowing drifting embers (additive)
5. soft smoke puffs for weight/aftermath
Scales with `count` (boss booms are bigger automatically).

**New directional impact (Particles.impact):** bright flash + a cone of streak sparks
sprayed back along the hit normal. Crits pop bigger + a white ring. Wired into the
bullet→enemy hit site (replaces the PNG path when spriteImpacts is off).

**Renderer additions (Particles.draw):** new passes — smoke (under), additive
shockwave, additive glow embers, additive streak lines. All shadowBlur is LOD-gated.

**Pool fix:** the particle pool only reset base fields on release, so custom flags
(isRing/isFlash/...) could leak between particle lives. New `_emit()` fully resets
every flag — fixes a latent stale-flag class of bug for all FX.

## Verification
- acorn 56/56 clean; headless boot 0 errors / 0 request failures
- in-combat render screenshot: layered red + gold explosions (core, shockwave rings,
  radial streak shrapnel, embers) + white directional impact bursts; 143 live
  particles; spriteExplosions=false, spriteImpacts=false; 0 console errors
- A39 crash fix + A40 shake/hitstop intact

## Tuning knobs
- `Particles.spriteExplosions` / `Particles.spriteImpacts` → true = PNGs back
- explosion layer counts/sizes/lifetimes in `Particles.explosion`
- impact cone width / spark count / scale in `Particles.impact`
- additive glow strength via shadowBlur in the new draw passes
