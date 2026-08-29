# CHANGELOG – Loot Pity Canonicalization Fix v2165B

## File-Basis
Master: `bonzookaa_v2160/`
Source upload: `bonzookaa_v2164_deep_maps 4.zip`

## Root Cause
Loot pickup resolution failed because `State.meta.pity` existed in older / partially migrated states,
but did **not** always contain the newer fields:
- `rarityHist`
- `totalDrops`

`Items._trackDrop()` assumed those fields existed and attempted writes like:
- `pity.rarityHist[rarity]`

That produced runtime errors such as:
- `Cannot read properties of undefined (reading 'common')`
- `Cannot read properties of undefined (reading 'uncommon')`
- `Cannot read properties of undefined (reading 'rare')`

This also explains the boot-time starter-item error in `addStarterItems()`.

## Implemented Fix

### 1) Hardened pity canonicalization in `runtime/Items.js`
`ensurePity()` now:
- initializes missing pity data if absent
- hydrates missing subfields on older save states
- repairs invalid numeric values
- guarantees `rarityHist` is always an object

### 2) Updated default state in `runtime/State.js`
The default `State.meta.pity` now also includes:
- `totalDrops: 0`
- `rarityHist: {}`

## Result
This removes the current loot-resolution crash path caused by partial pity state shape drift.

## Scope
Changed files:
- `runtime/Items.js`
- `runtime/State.js`
