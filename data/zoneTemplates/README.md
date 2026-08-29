# Zone Templates

Export JSON files from the Map Structure Editor tool (`tools/map_structure_editor.html`).

## Pipeline: Map Tool → Game

1. Open `tools/map_structure_editor.html`
2. Design a zone: place walls, rings, hulls, hazards, spawn/exit markers
3. Import tile PNGs via the tileset panel (set `tileReady.tileset` path)
4. Click **Export JSON** → save as `data/zoneTemplates/template_name.json`
5. MapGenerator automatically loads templates and uses them as zone blueprints
6. Templates are mixed with procedural generation — some zones use templates, others are pure procedural

## Template JSON Format

```json
{
  "zone": { "width": 5000, "height": 5000, "biome": "asteroid" },
  "structures": [
    {
      "type": "wall",
      "x": 2500, "y": 1000,
      "angle": 0.5,
      "material": "rock",
      "collision": true,
      "segments": [
        { "x": 2400, "y": 1000, "r": 40, "collision": true },
        { "x": 2500, "y": 1000, "r": 35, "collision": true }
      ],
      "tileReady": { "materialId": "asteroid_rock", "tileset": "assets/tiles/rock_wall.png" }
    }
  ],
  "entities": [
    { "type": "elite_spawn", "x": 3000, "y": 3000 },
    { "type": "loot_crate", "x": 1500, "y": 4000, "rarity": "epic" },
    { "type": "ambush_trigger", "x": 2500, "y": 2500, "enemyCount": 8 }
  ]
}
```

## Adding Tile PNGs

Place tile images in `assets/tiles/` with transparent backgrounds:
- `rock_wall.png` — repeating rock texture for walls
- `metal_panel.png` — station hull segments
- `crystal_formation.png` — nebula biome crystals
- `debris_chunk.png` — broken ship parts

The renderer stamps these at each segment position, scaled to segment radius.
