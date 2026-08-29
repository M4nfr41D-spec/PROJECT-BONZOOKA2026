# CHANGELOG — Boot State Canonicalization

## Summary
Stabilized startup after removal of the legacy `startModal`.

## Changes
- Added `neutralizeLegacyBootArtifacts()` in `main.js` to remove stale legacy overlays at boot.
- Added `forceCanonicalHubState()` in `main.js` to set the authoritative startup scene to `hub`.
- Clears leftover death/gameover overlay state before first render.
- Resets transition flags so mobile Safari cannot inherit an interrupted scene transition.

## Intent
Prevent the game from booting into a stale `combat` / `gameover` / undefined state after the legacy modal was removed.
