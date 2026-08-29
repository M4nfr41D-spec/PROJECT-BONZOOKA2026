# CHANGELOG — A37 Instance Geometry Sanity Pass (v2166A37)

## Dateibasis
`bonzookaa_v2166A36_DERELICT_MODULE_ALIAS_FIX_MASTER.zip`

## Ziel
Der erste Instanzpfad hat zwar geladen, war aber räumlich unbrauchbar:
- riesige 4x-Module überlagerten die Szene
- Fallback-/Overworld-Background blutete durch
- approximierte Struktur-Collider erzeugten unsichtbare Mauern
- Floor-Unterlay malte graue Rechtecke unter transparente Tile-Bereiche

## Korrektur

### 1) Safe module set only
`DerelictDungeonAssembler.js`
- Instanz-Templates auf kleines, sicheres 1x-Modulset reduziert:
  - `corridor_h_e4w2`
  - `junction_cross`
  - `junction_t_north`
  - `junction_t_north_n2e4w4`
  - `corridor_v_s2`
  - `corner_ne_n4e4`
- große 4x-Round-Rooms und andere problematische Riesenmodule aus dem aktiven A37-Aufbau entfernt
- Layout jetzt deterministischer und deutlich lesbarer

### 2) Collision sanity
`DerelictDungeonAssembler.js`
- Instanz-Struktur-Collider standardmäßig deaktiviert (`INSTANCE_COLLISION_ENABLED = false`)
- damit verschwinden die unsichtbaren Mauern aus dem provisorischen Grid-/AABB-Näherungspfad

`World.js`
- Player-vs-Structure-Collision wird für Instanzen mit `instanceInfo.disableStructureCollision` vollständig übersprungen

### 3) No more floor-underlay rectangles
`World.js`
- `_drawInstanceTileModules()` rendert jetzt nur noch die echten Modul-PNGs
- der generische 1024x1024-Floor-Unterlay unter jedem Modul wurde entfernt
- dadurch verschwinden die großen grauen Rechtecke unter transparenten Tile-Zonen

### 4) Instance-specific background
`World.js`
- `drawParallaxBackground()` erkennt `directTileBound`-Instanzen und rendert stattdessen einen ruhigen, dunklen Innenraum-Backdrop
- kein Overworld-/tiled background bleed mehr in den Dungeon
- `drawParallaxForeground()` wird für Instanzen komplett unterdrückt

### 5) Render ordering / sanity
`World.js`
- Instanz-Module werden stabil nach Grid-Position sortiert gezeichnet
- optionaler Debug-Rahmen nur noch, wenn `State.debug.instanceTiles` aktiv ist

## Erwartetes Ergebnis
- Instanz liest jetzt wieder als kompakter Innenraum-Prototyp
- keine riesigen überlappenden 4x-Rooms mehr
- kein hässlicher Overworld-BG in der Instanz
- keine unsichtbaren Structure-Walls aus dem alten Fallback-Pfad

## Geänderte Dateien
- `runtime/world/instances/DerelictDungeonAssembler.js`
- `runtime/world/World.js`
