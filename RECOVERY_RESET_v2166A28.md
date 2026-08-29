# BONZOOKAA Recovery Reset — v2166A28

## Working file basis
`bonzookaa_v2166A23A_BULLET_ASSET_SYNC_MASTER.zip`

## Decision
This recovery master intentionally restores the last clearly playable baseline before the tile/carrier/world-path regression chain.

The supplied TileForge + sample modules are preserved, but moved into an **isolated derelict dungeon pipeline** so they do not deform the overworld again.

## What this master is
- playable overworld baseline recovery
- no global tile-world replacement
- no hybrid legacy/collision/tile corridor mutation
- explicit preparation for **future isolated dungeon instances**

## What this master is not
- not the final dungeon implementation
- not tile-first overworld
- not a live runtime merge of the last 2-day experiments

## Canonical architectural rule from here onward
1. Overworld stays playable and stable.
2. Derelict / wreck / station interiors become **isolated instances** entered from POIs.
3. Tile-first assembly happens **inside those instances only** until proven stable.
4. Only after a full instance loop is fun and readable may broader integration be considered.

## Preserved assets/tooling
- `tools/derelict_dungeon_pipeline/BONZOOKAA-TileForge-v6-allvector.html`
- `tools/derelict_dungeon_pipeline/samples/*`
- `tools/derelict_dungeon_pipeline/seed_manifest.json`

## First implementation target after this reset
A29 should build only this:
- POI entry trigger -> load isolated derelict interior
- one small module family
- one reward room
- one return path
- zero impact on the overworld generator
