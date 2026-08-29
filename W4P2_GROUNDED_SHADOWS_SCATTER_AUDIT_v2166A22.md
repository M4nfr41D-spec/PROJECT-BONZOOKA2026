# AUDIT — v2166A22 — W4P2 Grounded Shadows + Scatter Reduction

## Kernbefund vor dem Pass
Die Map brach in der Nähe von Structures/Floors stark ein. Zwei klare Lastquellen waren:
1. **unnötige Shadows** für nicht sinnvoll geerdete Kleinteile
2. **zu dichter Layout-/Theme-Scatter** im Derelict-Slice

## Korrekturprinzip
- Nur geerdete, große Geometry darf Boden-Schatten werfen
- freischwebender / kleiner Junk wird schattenlos gezeichnet
- Derelict-Scatter wird im Slice kostengünstiger und seltener ausgespielt

## Technische Maßnahmen
### DepthStack.js
- Shadow pass ignoriert jetzt:
  - `grounded === false`
  - `castsShadow === false`
  - `shadowClass in ['debris','crate','mine']`

### World.js
- Shadow pass läuft über gefilterte grounded obstacles statt blind über alle Wall-Obstacles

### MapGenerator.js
- Layout-obstacles bekommen explizite Shadow-/Grounding-Metadaten
- crate/debris obstacles markieren sich als `castsShadow: false`

### ThemeScatter.js
- Slice-spezifischer perf factor für Derelict eingebaut
- weniger world patches / macro patches
- room/corridor scatter im Slice teilweise übersprungen
- debris/channel/shard counts an reduzierte alpha/perf factor gekoppelt

### TerrainThemes.js
- `derelict_plateyard` scatter density / alpha reduziert

## Risiko
- Derelict kann an einigen Stellen etwas „ruhiger“ wirken als vorher
- Wenn zu viel visuelle Identität verloren geht, justieren wir alpha/patch count wieder leicht hoch

## Nicht angefasst
- Combat
- Bullets
- Drone
- UI / Meta / Save
