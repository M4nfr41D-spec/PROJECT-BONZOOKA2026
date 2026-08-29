# CHANGELOG — v2166A12 W3G Nebula Visibility Pass

## Basis
- Input Master: `bonzookaa_v2166A11_REPEAT_CACHE_HOTFIX_MASTER`

## Ziel
- weiße Linien / Grid-Artefakte im Nebula-/Space-Hintergrund reduzieren
- Background-Bleed durch Raum-/Korridorflächen eliminieren
- Space-Zonen lesbarer machen, ohne den Build erneut zu destabilisieren

## Änderungen

### `runtime/world/Background.js`
- Repeated surface layers für `surfaceMode === 'space'` deaktiviert
- Space-Zonen verlassen sich wieder primär auf prozedurale Background-/Star-/Nebula-Layer statt auf gekachelte Bild-Backdrops

### `runtime/world/World.js`
- neue Helpers für solide Raum-/Korridorgrundlagen in Space-/Corruption-/Rare-Chamber-Themes
- Korridore in Space-Themes erhalten jetzt eine fast opake Base-Füllung
- Räume in Space-Themes erhalten jetzt eine fast opake Base-Füllung
- altes PNG-Floor-Tiling wird in Space-Themes nicht mehr als primäre Fläche gestempelt
- verbleibende Surface-Overlays in Space-Themes stark zurückgenommen
- nicht-Space-Themes behalten Tile-/Surface-System, aber mit kräftigerer Deckung

## Erwarteter Effekt
- weniger bzw. keine gekachelten weißen Linien aus Space-Backdrop-Repeats
- Böden tragen optisch wieder und lassen den Hintergrund nicht mehr dominant durchbluten
- Nebula-/Space-Kampfzonen lesen sich stabiler

## Nicht enthalten
- kein Layout-/Encounter-Pass
- keine neuen Biome
- keine POI-/Landmark-Ausweitung
