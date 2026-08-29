# CHANGELOG_W3C_THEME_REGISTRY_MACRO_FOG_v2166A7

## File-Basis
Built strictly on: `bonzookaa_v2166A6_W3B_FIRST_LAND_THEME_MASTER`

## Scope
World / Map / Overlay / Visual Depth only.
No changes to:
- modals
- loot
- persistence
- crafting/forge
- combat systems

## Implemented
### Theme registry expansion
Added new terrain and macro overlay assets/themes for:
- overgrown_facility
- neon_district
- hive_brood
- flesh_bloom
- void_geode
- abyss_web

Expanded surface registry with additional land surfaces:
- red rocky / gravel / smooth
- steel light / mid
- lava dense / open

### Macro overlay families
Added deterministic macro-overlay support per theme.
Macro overlays are now loaded through the terrain theme system and rendered as rare/clustered zone-scale fingerprints instead of being treated like ordinary floor tiles.

### Systemic readability fog
Added theme-driven fog/readability layer support.
This reduces micro-contrast pressure on highly detailed themes and creates local readability windows without flattening the whole scene.

### Theme roll logic
Expanded biome rollouts so deeper runs can now branch into:
- ruined urban
- overgrown facility
- neon district
- hive brood
- flesh bloom
- void geode
- abyss web

## Files changed
- `runtime/world/TerrainThemes.js`
- `runtime/world/ThemeScatter.js`
- `runtime/world/Background.js`
- `runtime/world/WorldLayers.js`
- `assets/terrain/*` (new surface + macro overlay assets)

## Validation
Syntax-checked successfully:
- `runtime/world/TerrainThemes.js`
- `runtime/world/ThemeScatter.js`
- `runtime/world/Background.js`
- `runtime/world/WorldLayers.js`

## Testing focus
- zone load / transition stability
- stronger theme identity in deeper zones
- no readability collapse in dense macro themes
- fog layers subtly reducing detail overload
- macro overlays staying rare/clustered, not becoming a visual carpet
