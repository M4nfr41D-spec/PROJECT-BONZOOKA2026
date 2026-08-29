# W3A Terrain Theme Audit — v2166A5

## Objective
Create a safe terrain surface + zone theme layer for land-capable zones and richer biome identity without destabilizing gameplay/world logic.

## Implemented Architecture

### 1. Surface Registry
Centralized in `runtime/world/TerrainThemes.js`.

#### Registered surfaces
- `space_void`
- `space_toxic`
- `space_ruins`
- `land_industrial_dark`
- `land_sand_dunes`
- `land_steel_plate`
- `land_sand_to_steel`

### 2. Theme Profiles
Each theme now carries:
- surface mode
- backdrop surface
- accent surface
- transition surface
- atmosphere tint
- fog tint
- scatter family
- landmark family
- optional room floor surface

### 3. World Profile Exposure
`WorldLayers.buildDepthProfile()` now exposes:
- `terrainThemeId`
- `terrainSurfaceMode`
- `terrainBackdropAlpha`
- `terrainRoomFloorAlpha`
- `terrainAtmosphereTint`
- `terrainFogTint`

### 4. Background Integration
`Background.draw()` now supports:
- theme surface backdrop pass
- accent/transition surface pass
- atmosphere tint wash
- fog tint wash

### 5. Room/Corridor Integration
`World.draw()` now supports optional themed room/corridor floor surfacing through the resolved terrain theme.

## Safety Notes
- no generator logic changed
- no collision/navigation logic changed
- no UI/meta systems touched
- no save/loot logic touched

## Expected Effect
- stronger biome identity in the world layer
- better foundation for land-zone rollout
- more visual depth via surface language, not only fog/vignette
- future biome transitions can be implemented without re-entangling world logic

## Recommended Next Step
`W3B – First Land Theme Rollout + Transition/Scatter Pass`

That next pass should:
- activate 1–2 land-oriented themes in controlled contexts
- add transition logic and scatter families
- keep collision/gameplay ownership separated from surface styling
