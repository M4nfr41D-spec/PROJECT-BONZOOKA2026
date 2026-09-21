# CHANGELOG — v2166C Combat Key Modal Routing Hard Fix

## File basis
Master basis: bonzookaa_v2166B

## Goal
Eliminate remaining legacy combat modal openings from keyboard access during combat.

## Changes
- Added hard close / hard hide guard for legacy combat modal overlays
- Routed combat hotkeys `I`, `P`, `T` directly to unified `combatServiceModal`
- Added `toggleCombatServiceTab(tab)` helper to centralize combat service routing
- Extended proxy mapping so even legacy `combatStatsModalOld` requests resolve into the service modal
- Hardened hub return to close service modal and suppress legacy overlays
- Marked legacy combat modal DOM nodes as hidden / inert via inline style and aria-hidden

## Intent
From combat, keyboard-driven meta access should now always resolve into the unified service modal and never surface the obsolete legacy overlays again.
