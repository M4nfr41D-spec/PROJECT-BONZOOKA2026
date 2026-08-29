# CHANGELOG_RECOVERY_RESET_v2166A28

## Dateibasis
`bonzookaa_v2166A23A_BULLET_ASSET_SYNC_MASTER.zip`

## Ziel
Rollback auf den letzten klar spielbaren Master **vor** der Verstümmelung des Welt-/Tile-Hybridpfads.

## Kernentscheidung
Die letzten Tile-/Carrier-/Manifest-Experimente werden **nicht** weiter in den globalen Overworld-Generator gedrückt.
Stattdessen werden Tooling und Sample-Module gesichert und in eine **isolierte Dungeon-Pipeline** verschoben.

## Änderungen
- Recovery-Master auf Basis A23A aufgebaut
- neues Dokument: `RECOVERY_RESET_v2166A28.md`
- neues isoliertes Tooling-Verzeichnis:
  - `tools/derelict_dungeon_pipeline/BONZOOKAA-TileForge-v6-allvector.html`
  - `tools/derelict_dungeon_pipeline/samples/*`
  - `tools/derelict_dungeon_pipeline/seed_manifest.json`
- neue inert/scaffold Dateien ohne Runtime-Verdrahtung:
  - `runtime/world/instances/DerelictDungeonInstanceSpec.js`
  - `data/dungeons/derelictInstanceScaffold.json`

## Wichtig
Dieses Master dient bewusst der **Stabilisierung**.
Es enthält **keine** aktive Runtime-Merge der jüngsten Tile-World-Umbauten.
Damit bleibt das Hauptspiel wieder die kanonische Basis, während das künftige Dungeon-System separat vorbereitet wird.

## Nächster sauberer Schritt
A29 = isolierter POI->Dungeon-Instance Loader, ohne Eingriff in den Overworld-Generator.
