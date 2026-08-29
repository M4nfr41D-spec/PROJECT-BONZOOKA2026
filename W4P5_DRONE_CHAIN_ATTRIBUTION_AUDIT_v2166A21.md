# AUDIT — v2166A21
## Scope
- Strictly limited to combat-side projectile/kill accounting and drone balance.
- No changes to world topology, UI/meta systems, persistence, loot tables, or map routing.

## Verified statically
- `runtime/Bullets.js` syntax OK
- `runtime/Player.js` syntax OK
- `runtime/Stats.js` syntax OK
- `runtime/State.js` syntax OK

## Main expected outcomes
1. Combat drone contributes support damage instead of field-wiping by itself.
2. Drone-fired bullets do not inherit the full player on-kill propagation package.
3. Secondary/collateral kills caused by lightning, splash, volatile bursts, and AoE on kill now count through the same reward/objective pipeline as primary kills.

## Risk notes
- Collateral kills now count correctly, so objective progress, streak pace, and rewards may rise versus the older broken behavior.
- Missile splash and volatile chains can feel more rewarding now because they finally resolve through the reward path instead of silently dropping kills.
- Exact drone strength may still need live tuning after playtest.
