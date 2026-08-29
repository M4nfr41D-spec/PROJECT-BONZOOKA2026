# CHANGELOG_A29_POI_TILE_INSTANCE_BINDING_v2166A29

## Dateibasis
`bonzookaa_v2166A28_RECOVERY_RESET_SAFE_MASTER.zip`

## Ziel
Isolierte Derelict-Instanzen nicht erst logisch vorbereiten, sondern **sofort an echte Tile-Module koppeln**, ohne den Overworld-Generator erneut zu verbiegen.

## Kernänderungen
- neuer direkter Tile-Manifest-Pfad für Derelict Zone-1-Instanzen
- neue Geometrie-/Collider-Helfer aus TileForge-Shapes und Exitbreiten
- neuer `DerelictDungeonAssembler` baut aus den vorhandenen Sample-Tiles eine isolierte Station-Instanz
- `salvage_wreck` POIs sind jetzt echte Instanz-Eingänge (`Press E`)
- Instanz lädt als vorbereitete Custom-Zone; Rückkehr erfolgt über `return_instance` Portal
- Overworld bleibt auf Recovery-Basis unangetastet
- direkte Tile-Render-Schicht in `World.draw()` für Instanzmodule ergänzt

## Neue Dateien
- `runtime/world/instances/DerelictTileManifest.js`
- `runtime/world/instances/DerelictTileGeometry.js`
- `runtime/world/instances/DerelictDungeonAssembler.js`
- `CHANGELOG_A29_POI_TILE_INSTANCE_BINDING_v2166A29.md`

## Geänderte Dateien
- `runtime/world/World.js`
- `runtime/world/MapGenerator.js`
- `runtime/world/index.js`
- `runtime/world/instances/DerelictDungeonInstanceSpec.js`
- `data/dungeons/derelictInstanceScaffold.json`
- `ROADMAP.md`

## Wichtig
- A29 ersetzt **nicht** den Overworld-Generator
- Tile-Kopplung gilt nur innerhalb des isolierten Instanzpfads
- Manifest basiert bewusst auf den aktuell vorhandenen TileForge-Samples; weitere Modulfamilien können später ohne erneute Globalmutation ergänzt werden
