# CHANGELOG_COMBAT_KEYS_TO_SERVICE_MODAL_v2166A1

## File basis
- Source master: modal consolidation patch upload (last fully working state)
- Internal project folder: `bonzookaa_v2160/`

## Goal
- Preserve the working hub-opened service modal exactly as-is.
- Stop using the broken legacy combat key modals for `I / P / T`.
- Route combat key access into the same service modal system used by the hub.

## Changes
- `main.js`
  - Added service modal context handling (`hub` vs `combat`).
  - `openServiceModal(tab, context)` now supports combat usage without closing into hub logic.
  - `closeServiceModal()` now returns to hub only when opened from hub; from combat it resumes the run.
  - `toggleCombatInventory()` now opens/closes the service modal on the `inventory` tab.
  - `toggleCombatStats()` now opens/closes the service modal on the `paragon` tab.
  - `toggleCombatSkills()` now opens/closes the service modal on the `skills` tab.
  - Legacy combat modal overlays are hard-closed when entering service modal from combat.
- `runtime/Input.js`
  - `ESC` now closes the service modal first when it is open during combat.

## Explicit non-goals
- No hub modal redesign.
- No stash/inventory renderer rewrite.
- No craft/forge migration.
- No further layout overhaul.

## Expected behavior
- Hub-opened modals stay exactly on the proven v2166A line.
- In combat:
  - `I` opens the same service modal on Inventory.
  - `P` opens the same service modal on Paragon.
  - `T` opens the same service modal on Skills.
  - `ESC` closes that modal and returns to combat instead of hub.
