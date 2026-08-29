# W2 Depth Stack Audit — v2166A4

## Objective
Increase perceived depth and scene readability while keeping world/gameplay behavior stable.

## Safe hooks used
1. `Background.draw()`
   - screen-space backdrop wash
   - biome-tinted shafts
   - vignette framing

2. `World.draw()`
   - room underlays / corridor fog
   - obstacle grounding shadows
   - landmark halos
   - foreground veil before portals / top markers

3. `WorldLayers.buildDepthProfile()`
   - expanded visual tuning fields only
   - no collision or nav changes

## Why this is low risk
- no generator mutation
- no zone data mutation beyond cached visual state
- no collision/pathing changes
- no state-system changes
- no UI/meta changes

## Visual outcomes targeted
- clearer room volumes
- better wall grounding
- stronger landmark presence
- more atmospheric depth at higher tiers/depths
- more “space has weight” feeling without perspective break

## Next likely step (same topic)
W3 should focus on **scene identity and biome differentiation**:
- per-biome landmark language
- material contrast
- threat/rarity space cues
- POI/environment storytelling
