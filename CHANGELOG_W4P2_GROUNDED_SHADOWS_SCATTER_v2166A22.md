# CHANGELOG — v2166A22 — W4P2 Grounded Shadows + Scatter Reduction

## File-Basis
Input Master: `bonzookaa_v2166A21_W4P5_DRONE_CHAIN_ATTRIBUTION_MASTER`

## Ziel
World-/Render-Kosten im Derelict-Slice senken, ohne Readability zu opfern.

## Umgesetzt
- **grounded-only shadow rule** für World-Obstacles
- **floating debris / crates / mines cast no floor shadow**
- Derelict-Theme-Scatter für den Slice **deutlich reduziert**
- Layout-scatter draws im Derelict-Slice **selektiv ausgedünnt**
- Derelict scatter density / alpha in TerrainThemes abgesenkt

## Geänderte Dateien
- `runtime/world/DepthStack.js`
- `runtime/world/World.js`
- `runtime/world/MapGenerator.js`
- `runtime/world/ThemeScatter.js`
- `runtime/world/TerrainThemes.js`

## Erwarteter Effekt
- weniger falscher „Glasboden“-Eindruck durch Shadows unter freischwebendem Kram
- weniger World-Render-Kosten in strukturdichten Bereichen
- geringere Scatter-/Overlay-Last im Derelict-Slice
- mehr Budget für späteren Content-Ausbau
