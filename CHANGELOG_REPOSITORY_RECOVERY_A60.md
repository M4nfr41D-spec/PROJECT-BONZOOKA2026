# Repository Recovery — A60 Candidate

Date: 2026-08-28

## Scope

This change publishes the preserved A60 lootfix package as a complete recovery and browser-preview candidate in `M4nfr41D-spec/PROJECT-BONZOOKA2026`.

## Repository topology

- Preserve the existing remote `main` branch as the March 2026 historical line.
- Publish the complete A60 tree on `recovery/a60-candidate`.
- Validate the candidate with `scripts/validate-baseline.mjs` on every branch update.
- Deploy only the validated candidate through GitHub Pages.

## Deliberately unchanged

- No gameplay, Director, loot, FX, world-generation or asset behavior was changed.
- No A38/A49 instance branch was merged into A60.
- No legacy implementation was deleted or declared canonical.
- No candidate-to-`main` promotion was performed.

## Promotion gate

The branch remains a recovery candidate until the browser smoke test, representative gameplay path, deterministic replay comparison and owner acceptance recorded in `BASELINE.md` are complete. The forthcoming AI System Governance contract may add or tighten those gates.
