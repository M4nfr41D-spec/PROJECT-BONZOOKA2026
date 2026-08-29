# CHANGELOG — W3C RNG UNIT HOTFIX v2166A8

## File basis
Master input: `bonzookaa_v2166A7_W3C_THEME_REGISTRY_MACRO_FOG_MASTER`

## Problem
Deep-world render path crashed in `ThemeScatter.ensureCache()` because the W3C scatter rollout called `rng.unit()`, but `SeededRandom` exposed `next()`, `range()`, `int()`, `chance()`, `pick()`, `shuffle()` only.

Observed runtime symptom:
- console spam: `TypeError: rng.unit is not a function`
- world draw aborted after background layer
- gameplay scene collapsed into visible tiling / missing world composition

## Fix
Added a compatibility alias on `runtime/world/SeededRandom.js`:
- `unit()` → returns `next()`

## Why this approach
- zero-behavior change to existing seeded generation
- safest hotfix from current A7 master
- protects any future theme/world code that may call `rng.unit()` again
- avoids touching loot, modals, persistence, combat, or registry logic

## Touched files
- `runtime/world/SeededRandom.js`

## Not touched
- `runtime/world/ThemeScatter.js`
- `runtime/world/Background.js`
- `runtime/world/WorldLayers.js`
- all gameplay systems

## Validation
- grep confirmed the crash source was `ThemeScatter.js:84`
- syntax check passed for `runtime/world/SeededRandom.js`
- global search confirmed `rng.unit(` usage is now covered by the alias
