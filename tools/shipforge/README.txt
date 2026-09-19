M4NFROID SHIP FORGE v3.0.0 production bundle
ZIP ueber das Repo-Root entpacken: assets/ und runtime/ liegen bereits richtig.
assets/sprite_manifest.json und runtime/EmbeddedSpriteManifest.js sind gemergt,
sofern eine Basis ueber REPO BRIDGE geladen wurde - sonst enthalten sie nur die neuen Assets.
Canonical runtime profile: runtime1 / 1 frame per state.
Thruster flames are not baked into sprites; use dynamic external FX.
Review sprite_manifest_shipforge_fragment.json before merging into the game master manifest.
