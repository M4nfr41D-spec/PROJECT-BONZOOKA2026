# CHANGELOG — v2166A Modal Consolidation + Forge Visibility

## File basis
Master basis: bonzookaa_v2165C_reward_flow_decouple_patch.zip  
Working folder: bonzookaa_v2160/

## Scope
Phase 2A — Meta-UI consolidation for hub-side management flows.

## Implemented
- Added a new purpose-built **Service Modal** for hub-side meta management.
- Hub routing for **Inventory**, **Paragon**, and **Skills** now opens the new modal instead of falling back to the live combat sidebars.
- Added a dedicated **Skills** hub button.
- Re-homed the live DOM nodes for equipment, stash, ship stats, paragon, and skills into the service modal while it is open, then restores them on close.
- Added a tabbed management layer inside the service modal:
  - Loadout
  - Paragon
  - Skills
- Enlarged and relaxed layout constraints for **Crafting** and **Forge** modals to reduce cramped / overlapping content.
- Added stash slot micro-badges for:
  - socket capacity
  - inserted gem/core
  - corruption
  - forged stats
- Extended item tooltips to show:
  - socket capacity / occupancy
  - inserted gem/core label
  - forged stat contributions
  - corruption label
- After forge execution, the equipment / stash / ship stats views are rerendered immediately.

## Files changed
- index.html
- main.js
- runtime/UI.js

## Notes
- This is the first architectural cut of the meta modal layer.
- Crafting and Forge remain separate dedicated modals, but their viewport and scroll behavior were widened and stabilized.
- Inventory / Paragon / Skills are now clean hub-management surfaces instead of reusing the combat-side layout.
