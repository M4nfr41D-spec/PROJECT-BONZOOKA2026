# BONZOOKA

BONZOOKA is a deterministic, top-down space ARPG/shooter engine built around effectively unbounded procedural progression. Its adaptive Director converts player state and encounter pressure into controlled pacing phases: `BUILD`, `PEAK`, `RELAX`, `REWARD`, and `AMBUSH`.

This repository starts from the preserved **A60 lootfix candidate**. The imported source still displays the historical build label `BONZOOKAA A60`; product naming can be normalized in a separate, reviewable change without contaminating the recovery baseline.

## Baseline status

- Status: **candidate — not yet promoted**
- Raw import commit: `d6ccca5fe1c0a95323cb00151f2cec99428451ef`
- Raw import tree: `63131e3f68e6e68f2fb7b6c1482c100da604dd2b`
- Source evidence and verification: [BASELINE.md](BASELINE.md)
- License: proprietary; see [LICENSE.txt](LICENSE.txt)

The raw A60 import is intentionally isolated from the repository bootstrap commit. This preserves a clean recovery point before CI, documentation, or future engineering changes.

## Recovery preview

The complete A60 candidate is published on `recovery/a60-candidate`. Every update to that branch must pass structural validation before the GitHub Pages workflow can deploy it. The preview is an inspection surface, not an accepted gameplay baseline; `main` remains untouched until the browser and deterministic-play gates in [BASELINE.md](BASELINE.md) are accepted.

## Architecture

- `main.js` — boot flow, game loop, hub/combat transitions, render orchestration
- `runtime/` — player, enemies, loot, progression, Director, pooling, UI, audio, save and anti-exploit systems
- `runtime/world/` — deterministic generation, topology, instances, scene and depth rules
- `data/` — data-driven tuning and content definitions
- `assets/` — runtime sprites, terrain, instance tiles and audio
- `tools/` — balance, sprite and dungeon-production utilities

## Run locally

Serve the repository over HTTP so browser modules and data files resolve consistently:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`. The in-game controls overlay is available with `H`.

## Validate

```bash
node scripts/validate-baseline.mjs
```

The validation gate checks JavaScript syntax, JSON integrity, relative module imports, sprite-manifest assets, browser entry points, required architecture files and GitHub's 100 MB per-file ceiling. A real browser play-test remains mandatory before promotion.

## Change governance

`main` is reserved for accepted, recoverable baselines. Development proceeds one causal concern per branch and merges only with validation evidence, a documented rollback point and explicit human acceptance. The public preview authorization applies only to the A60 candidate and does not waive these promotion gates. Branch conventions and the PR checklist are defined in [GITHUB_STRUCTURE.md](GITHUB_STRUCTURE.md).
