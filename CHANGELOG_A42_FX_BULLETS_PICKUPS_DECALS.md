# A42 — Procedural FX extended: bullets, pickups, weapons (muzzle), decals

Same principle as A41: in this build the SpriteManager PNG path overrides the
procedural draw wherever a sprite is registered. A41 fixed explosions/impacts;
A42 covers the rest you asked about.

## Bullets — sprite back-door flag
The bullet draw had a "sprite wins" hook for both player and enemy bullets
(`SM.getStateDef('bullets', type, 'travel')` → `drawAnimated` → skip procedural).
Now gated behind **`Particles.spriteBullets`** (default false). The rich per-weapon
procedural bullets (laser lance, plasma blob, railgun beam, missile, gatling, nova —
distinct colour AND shape, with trails/glow/crit-sparkle) are guaranteed to show.

## Pickups — sprite back-door flag
The pickup draw skipped its procedural render when a `pickup_<type>` sprite existed.
Now gated behind **`Particles.spritePickups`** (default false). The rich procedural
loot shows: rarity-coloured gems, pulse, elastic drop-bounce, rare+ ground aura,
epic+ light beam, currency icons.

## Weapons — directional muzzle flash
Primary fire now emits `Particles.muzzle(x, y, weaponColor, angle)`: a bright
white→colour bloom at the barrel + a forward cone of spark streaks, instead of the
old tiny omnidirectional flash. Uses the weapon's own colour.

## Decals — NEW (did not exist)
Added a ground scorch-decal layer. Explosions stamp a dark radial scorch that
lingers (~1.3–2.1s) and fades. Rendered UNDER entities (right after World.draw,
before pickups/enemies), so it reads as a burn on the floor. Cap 48 (oldest culled),
cleared on zone change.
- `Particles.decal(x, y, radius, life)` / `Particles.drawDecals(ctx)` / aged in `Particles.update`.

## Pool stale-flag fix (carried from A41)
All new FX go through `Particles._emit`, which fully resets pooled-particle flags
(the pool only reset base fields on release).

## Full sprite back-door — one control panel on Particles
- `spriteExplosions`, `spriteImpacts`, `spriteBullets`, `spritePickups` — all default
  false (procedural). Flip any to true to use that category's PNG sprites again.

## Verification
- acorn 56/56 clean; headless boot 0 errors / 0 request failures
- composite in-combat render: 6 bullet types (distinct colour+shape), 6 rarity pickups
  + currencies, layered explosions, scorch decals, directional muzzle — all procedural;
  10 bullets / 8 pickups / 239 particles / 4 decals live; 0 console errors
- A39 crash fix, A40 shake/hitstop, A41 explosions/impacts all intact
