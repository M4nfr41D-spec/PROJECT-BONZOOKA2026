# CHANGELOG — v2166D Service Modal Unification

## File basis
Built **exclusively on** `bonzookaa_v2166C_MASTER`.

## Scope
Phase 2B — full service-modal unification for the meta layer.

## Implemented

### Unified service modal extended
The existing unified service modal now covers all core meta systems:
- Inventory
- Paragon
- Skills
- Crafting
- Forge

### Hub routing cleaned up
Hub buttons now route into the unified service modal instead of legacy / fragmented flows:
- `open-inventory` -> service modal / inventory
- `open-skills` -> service modal / skills
- `open-pilot` -> service modal / paragon
- `open-crafting` -> service modal / crafting
- `open-vendor` -> service modal / forge

### New hub skill entry
Added a dedicated **Skills** station-service button to the hub.

### DOM mounting extended
The unified service modal now safely mounts and restores these previously separate UI regions:
- equipment grid
- stash grid
- ship stats
- paragon tree
- skill trees
- crafting currencies
- crafting item slot / name / result / salvage button
- crafting recipe label / recipe list / stash picker
- forge currencies
- forge recipe catalog
- forge detail panel

### Crafting integration
Crafting now opens inside the service modal with a purpose-fit layout:
- item bench on the left
- recipes on the right
- stash picker as a dedicated lower strip
- reset path retained when entering crafting from hub

### Forge integration
Forge now opens inside the same service modal architecture:
- currency row
- recipe catalog
- detail / target / action panel

### Legacy modal shutdown
The following legacy paths are now hard-closed when the unified service modal is used:
- combatInventoryModal
- combatParagonModal
- combatSkillModal
- combatStatsModal
- combatStatsModalOld
- craftModal
- vendorModal

### Hub keyboard support added
While hub modal is open:
- `I` opens inventory service modal
- `T` opens skills service modal
- `C` opens crafting service modal
- `V` opens forge service modal

## Notes
- `P` in hub still remains bound to settings logic and was **not** reassigned in this patch.
- Legacy craft/forge modal markup still physically exists as fallback structure, but it is no longer the intended active path.
- This patch focuses on architectural consolidation and layout relief, not final visual polish.

## Files changed
- `index.html`
- `main.js`
- `runtime/Input.js`

## Validation
Syntax-checked successfully:
- `main.js`
- `runtime/Input.js`
- `runtime/UI.js`
