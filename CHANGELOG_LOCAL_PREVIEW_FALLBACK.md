# CHANGELOG_LOCAL_PREVIEW_FALLBACK

## Purpose
Fix mobile/iPad/iPhone local preview boot failures when the game is opened from Files / ZIP preview (`edge://external-file` / `file://`) instead of a real web host.

## Changes
- Added `runtime/EmbeddedData.js`
  - embeds all required `/data/*.json` files as a JS fallback payload
- Added `runtime/EmbeddedSpriteManifest.js`
  - embeds `assets/sprite_manifest.json` as a JS fallback payload
- Patched `runtime/DataLoader.js`
  - tries normal fetch first
  - automatically falls back to embedded data when fetch fails
  - marks local preview mode in `State.runtimeHints.localPreview`
- Patched `runtime/SpriteManager.js`
  - tries normal fetch for sprite manifest first
  - automatically falls back to embedded manifest when fetch fails
- Patched `main.js`
  - shows a visible boot warning banner if data loading still fails
  - logs local preview mode explicitly

## Expected result
Opening the game directly from local files on iPad/iPhone should no longer stall on the static shell just because JSON fetch is blocked by the preview/browser context.
