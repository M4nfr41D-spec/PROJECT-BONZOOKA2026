# W4P3 AUDIT — Weapon Projectile Budget + Zone Ownership

## Objective
Eliminate projectile-related gameplay bugs and future-proof combat performance before filling the Derelict slice with much denser content.

## Problems targeted
1. Projectiles surviving across portal/zone transitions.
2. Bullets traveling effectively across entire maps.
3. Offscreen kills and unfair carryover damage.
4. Weak weapon identity because all projectiles obeyed similar lifetime logic.
5. Nova behaving like a projectile ring instead of true close-range AoE.

## Root technical causes
- player bullets only died by generic bounds checks
- no zone ownership on bullets
- no flush on zone transition
- no weapon-specific max range or max lifetime
- no distance-based weapon damage model

## Corrections applied
- zone ownership key stamped at projectile spawn time
- transition flush added in `World.loadZone()`
- maxRange/maxLifetime introduced per projectile profile
- distance-driven damage multipliers introduced per weapon family
- nova converted to direct pulse AoE

## Risk profile
### Low risk
- zone-transition flush
- lifetime/range expiration
- enemy bullet zone ownership

### Medium risk
- damage falloff curves may need feel-tuning after live test
- plasma projectile count increase may need later balance adjustments
- railgun stationary bonus may need cap/feel tuning after practical play

## Validation priority
1. Portal jump: verify no bullets follow into next zone.
2. Very long firing line: verify bullets die before crossing whole map.
3. Missile close-range weakness feels noticeable.
4. Gattling loses punch at long range.
5. Plasma is only strong up close.
6. Nova no longer behaves as long-lived projectile cluster.
7. Railgun rewards standing still at meaningful distance.
