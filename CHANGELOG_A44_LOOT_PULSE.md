# A44 — Loot reward pulse + tiered vacuum

Goal: make loot *feel* like reward in an endless grind — rares land as a MOMENT,
trivial loot stops being a chore — without changing drop RATES (Director untouched).

## Tiered vacuum (Pickups.update)
Magnet range now depends on loot tier:
- Trivial (currency / xp / health / coolant / common+uncommon items): range ×2.3,
  stronger pull → auto-collected from afar, no chasing.
- Rare+ items: normal range → the player reaches for them (and gets the moment).

## Rarity reward pulse (Pickups._rewardPulse, on item collect)
- common / uncommon: nothing extra (their base collect ring is enough → quiet).
- rare+ : staged, scales with tier (rare → mythic):
  white core flash + rarity-colour bloom + expanding rarity ring (+ a second white
  ring for epic+), a rarity-colour spark burst, and a floating RARE/EPIC/LEGENDARY/
  MYTHIC label.
- legendary+ : a 3-frame (mythic 4) hitstop so the drop lands with weight — the "slow".
- rare+ : brighter pickup ding.

Director drop rate is NOT touched — only the *staging* of what drops.

## Verification
- acorn 56/56 clean; headless boot 0 errors / 0 request failures
- functional test in combat:
  - legendary pulse → +24 particles + 0.05s hitstop; common → 0 particles, 0 hitstop
  - vacuum: trivial pickup at 1.8× base range auto-collected; epic item at same
    distance stayed put (normal range)
- A39–A43 all intact

## Tuning
- vacuum multiplier / pull in Pickups.update; tier mapping in `_pickupTier`
- pulse scale / ring sizes / hitstop frames per rarity in `_rewardPulse`
