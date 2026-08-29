# CHANGELOG — A38 Instance Unified Grid + Real Collision (v2166A38)

## Dateibasis
`bonzookaa_v2166A37_INSTANCE_GEOMETRY_SANITY` (room_systems)

## Ausgangslage (warum aufgegeben wurde)
Der Derelict-Instanz-Pfad scheiterte am **Tile-Anlagen-Design**:
- `buildBoundaryColliders()` legte pro Wand-Zelle einen **Kreis**-Collider mit
  Radius `cell*0.56 ≈ 72px` (Zelle = 128px). Radius > halbe Zelle → die Kreise
  beulten in den Korridor (**unsichtbare Wände**) und ließen an Zell-Ecken
  **Lücken** (Durchrutschen).
- Tile-Art (PNG) ≠ Spec-Grid (A30) → selbst korrekte Collider lagen daneben.
- Reaktion in A37: **Instanz-Kollision komplett deaktiviert**
  (`INSTANCE_COLLISION_ENABLED = false`). Folge: man fliegt durch alles, Räume
  sind keine echten Räume → nicht spielbar.
- Tür-Anschlüsse zwischen Modulen wurden nie validiert → Wände, wo Türen sein
  sollten / abgeschnittene Räume.

## Lösung — Phase 1: Eine Wahrheit, exakte Kollision, Render aus Spec

### 1) Unified Instance Grid (Single Source of Truth)
`DerelictTileGeometry.js` → `buildInstanceGrid(modules)`
- Stempelt das 8×8-`buildWalkGrid` jedes Moduls in **ein** globales Zellen-Grid.
- Dieses Grid ist die einzige Wahrheit für Kollision **und** Rendering — der
  Art-vs-Collider-Drift ist damit konstruktiv unmöglich.

### 2) Exakte Tilemap-Kollision (ersetzt die Kreis-Näherung)
`DerelictTileGeometry.js` → `resolveCircleInGrid(ent, radius, grid)`
- Kreis-vs-Zelle (nearest-point), Außenbereich = solide → Instanz vollständig
  umschlossen. Gerade Wände, keine Beulen, keine Ecklecks.
- Buried-Fall stößt Richtung angrenzender Bodenzelle aus und tötet die
  einwärts gerichtete Velocity (Slide statt Kleben).
`World.js` (in `update(dt)`)
- Player **und** Gegner werden für `currentZone.instanceGrid` gegen das Grid
  aufgelöst. Instanz-Kollision ist damit wieder aktiv — korrekt diesmal.

### 3) Render aus der Spec
`World.js` → `_drawInstanceGrid()`; `_drawInstanceTileModules()` delegiert dahin,
wenn `instanceGrid` existiert.
- Boden- und Wandzellen werden direkt aus dem Grid gezeichnet (Sci-Fi-Trim an
  der Boden/Wand-Kante). Was man sieht == woran man anstößt. Kein PNG-Mismatch,
  keine async-Ladewartezeit.

### 4) Connectivity-Garantie (Kern gegen die Failure-Klasse)
`DerelictDungeonAssembler.js`
- `floodFraction()` prüft, ob das Boden-Areal **eine** zusammenhängende
  Komponente ist.
- `pickConnectedTemplate()` liefert nur zusammenhängende Layouts aus; ein
  defektes Template (z.B. die alte Variante mit Rotations-Mismatch) fällt
  automatisch auf das bewährte Layout zurück. **Ein zerrissener Dungeon wird
  nie ausgeliefert.**

## Verifiziert (headless Chromium, echte Module)
- acorn module-parse: 56/56 sauber
- Boot: 0 JS-Fehler, 0 Request-Fehler
- 8/8 Seeds: `reachFrac = 1.0`, Spawn/Objective/Reward/Airlock alle erreichbar
- Wand-Kollision: endet auf Boden, wird zurückgeschoben, Velocity gekillt
- Buried-Fall: wird auf Boden ausgestoßen
- Top-Down-Karte der assemblierten Instanz: kohärente Korridore/Räume, Türen
  passen (siehe `instance_map.png`)

## Geänderte Dateien
- `runtime/world/instances/DerelictTileGeometry.js`
- `runtime/world/instances/DerelictDungeonAssembler.js`
- `runtime/world/World.js`

## Nächste Phasen
- **Phase 2 (Politur):** Boden-/Wand-Texturen aus der Tile-Forge-Palette,
  optional die Vektor-Tiles als Cosmetic-Layer über dem Grid.
- **Phase 3 (Vielfalt):** Tür-Sockets aus `exits/exitWidths` beim Stempeln
  validieren + Auto-Stitch, damit *mehrere* authored/prozedurale Layouts robust
  zusammenhängen (dann reaktiviert sich auch die zweite Variante).
- **Phase 4 (Rewarding):** POI/Event-Layer (Cache, Control-Node, Airlock — schon
  vorhanden) an den Topologie-Graphen hängen → prozedurale Variation.
