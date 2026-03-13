# BONZOOKAA! — Patch v2.12.3 "Command Deck"
**Date:** 2026-02-28  
**Focus:** UI overhaul (Hub/Vendor/Crafting) + P0 depth scaling fix

---

## [P0] CRITICAL: Depth Scaling — Enemies Now Scale With Zone

### Root Cause
`State.run.currentDepth` was **never set** anywhere in the codebase.  
All systems fell back to `State.meta.level || 1`:
- Enemy level = player level (not depth) → Zone 601 enemies = Level 1
- Item ilvl = player level → Zone 601 items = ilvl 1  
- No tier multipliers on tiers 1–3
- Zero difference between any portal regardless of zone

### Fix
| System | Before | After |
|--------|--------|-------|
| `State.run.currentDepth` | undefined | Set in `loadZone()` |
| Enemy level | `playerLvl` | `max(playerLvl, depth)` |
| Enemy HP scaling | +6%/lvl exponential | +12%/lvl linear per depth |
| Enemy DMG scaling | +6%/lvl exponential | +8%/lvl linear per depth |
| Boss HP scaling | +8%/lvl exponential | +15%/lvl linear per depth |
| Tier multipliers | None (tiers 1-3) | All 5 tiers have HP/DMG/XP/Loot mults |
| Tier loot bonus | Not wired | Applied to drop chance |

### Scaling Table (Normal Grunt, base HP=20)
| Zone | Enemy HP | Enemy DMG | Tier Mult |
|------|----------|-----------|-----------|
| 1 | 20 | 10 | ×1.0 |
| 50 | 138 | 49 | ×1.0 |
| 100 | 258 | 89 | ×1.0 |
| 101 | 312 | 103 | ×1.2 HP, ×1.15 DMG |
| 251 | 868 | 273 | ×1.4 HP, ×1.3 DMG |
| 401 | 1,568 | 495 | ×1.6 HP, ×1.5 DMG |
| 601 | 2,920 | 882 | ×2.0 HP, ×1.8 DMG |

### Tier Config (acts.json)
| Tier | Zones | Enemy HP× | Enemy DMG× | Loot× | XP× |
|------|-------|-----------|------------|-------|-----|
| 1 | 1–100 | 1.0 | 1.0 | 1.0 | 1.0 |
| 2 | 101–250 | 1.2 | 1.15 | 1.2 | 1.3 |
| 3 | 251–400 | 1.4 | 1.3 | 1.4 | 1.5 |
| 4 | 401–600 | 1.6 | 1.5 | 1.6 | 1.8 |
| 5 | 601+ | 2.0 | 1.8 | 2.0 | 2.5 |

---

## [P1] UI Overhaul — Hub "Command Deck"

### Before
- Flat centered modal, emoji heading, scrollable act-list
- Row of equal-weight buttons (Inventory/Crafting/Vendor/Pilot)
- No visual hierarchy between primary (pick mission) and secondary (manage stuff)

### After
**Two-column layout:**
- **Left (60%):** Mission select with compact portal cards
  - Zone range + description on each card
  - Enemy level + tier multipliers shown (HP×, Loot×)
  - Difficulty selector: 3 colored bars integrated directly on each card (1 click to launch)
  - Resume cards at top (compact per-difficulty continue buttons)
- **Right (40%):** Station services
  - Nav buttons with keyboard shortcuts visible (I/C/V/P)
  - Ship Power summary (DPS/Tank/Speed mini-bars)
  - Debug buttons at bottom

### New Elements
- `hubCells` display (was missing — now shows ⚡ in header)
- `section-label` class: monospace 9px uppercase with letter-spacing:3
- `diff-dots`: 3 color-coded clickable bars per portal card
- `power-bar-row`: DPS/Tank/Speed indicators

---

## [P1] UI Overhaul — Vendor "Upgrade Bay"

### Before
- 2-column grid of identical cards
- All upgrades looked the same
- No grouping, no detail panel, inline buy

### After
**Grouped by role + detail panel:**
- **Left:** Cards grouped under OFFENSE / DEFENSE / UTILITY headers
  - Compact cards: icon + name + tier pips + current stat
  - Tier pips (filled gold bars) replace "Tier 3/5" text
  - Click to select → highlighted with gold border
- **Right (detail panel):** Appears on selection
  - Large icon + name + description
  - CURRENT → NEXT comparison (big centered numbers)
  - Buy button: gold gradient if affordable, gray if not
  - Tier text below
- **Gold accent color** on header border (vs cyan for hub, purple for crafting)

### Data Change
- `runUpgrades.json`: Added `category` field to each upgrade (offense/defense/utility)

---

## [P1] UI Overhaul — Crafting "Crafting Bay"

### Before
- Tiny 120px item slot, recipe list to the right, result at bottom
- No visual weight or ceremony for crafting outcomes
- Currencies crammed in a bar

### After
**Item card + recipe panel:**
- **Left (190px):** Full item card always shows all stats
  - Icon, name, rarity, ilvl, base stats, affixes — no tooltip needed
  - Craft result appears inline under item (BEFORE → AFTER)
  - Salvage button at bottom (danger-red, separated from craft actions)
- **Right:** Recipe list with cost + success chance
  - Chance color-coded: green (100%), gold (70%), red (35%)
  - `section-label` updates based on state ("SELECT AN ITEM FIRST" / "AVAILABLE RECIPES")
- **Purple accent color** on header border
- Currencies moved to header bar (compact, always visible)

---

## Files Modified (7)

| File | Changes |
|------|---------|
| `index.html` | Hub, Vendor, Crafting modal HTML rewrite. CSS for all three. panel-header flex layout. |
| `main.js` | Hub renderer: 2-col layout, portal cards, ship power bars, compact resume |
| `runtime/UI.js` | Vendor renderer: grouped cards + detail panel + selectVendorUpgrade() |
| `runtime/world/World.js` | currentDepth set, depth-based enemy scaling, tier multipliers applied |
| `runtime/Bullets.js` | Tier loot bonus wired into drop chance |
| `data/acts.json` | Tier multipliers (HP/DMG/XP/Loot) on all 5 tiers, portal icons |
| `data/runUpgrades.json` | Category field added to each upgrade |

---

## Test Checklist
1. **Hub:** 2-column layout, portal cards show zone range + tier info, difficulty dots work
2. **Hub:** Ship power bars update with stats, keyboard hints visible
3. **Vendor:** Upgrades grouped by category, click shows detail panel with CURRENT→NEXT
4. **Vendor:** Buy button gold when affordable, gray when not, refreshes on purchase
5. **Crafting:** Item card fills with full stats, recipes show cost + colored chance
6. **Scaling Z1:** Enemies ~20 HP, items ilvl 1
7. **Scaling Z101:** Enemies ~312 HP (tier2 ×1.2), items ilvl 101
8. **Scaling Z601:** Enemies ~2920 HP (tier5 ×2.0), items ilvl 601
9. **Boss Z401:** ~19,568 HP (tier4 ×1.6)
10. **Loot Z601:** Drop chance ×2.0 from tier bonus
