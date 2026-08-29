# BONZOOKA A60 Candidate Baseline

## Identity

| Field | Value |
|---|---|
| Candidate | A60 lootfix |
| Source archive | `bonzookaa A60 lootfix(1).zip` |
| Source SHA-256 | `11311bfb609e102716a1b01d765d0f160dd55754d37b0860daec89af857af6b1` |
| Source files | 438 |
| Source payload | 83,370,236 bytes |
| Raw import commit | `d6ccca5fe1c0a95323cb00151f2cec99428451ef` |
| Raw import tree | `63131e3f68e6e68f2fb7b6c1482c100da604dd2b` |
| Review date | 2026-08-28 |
| Promotion state | Candidate — manual acceptance pending |
| Recovery branch | `recovery/a60-candidate` |
| Public preview | Authorized by the owner on 2026-08-28 |

The raw import commit contains the extracted upload without repository-bootstrap additions. It is the recovery anchor for all subsequent work.

## Verification evidence

| Gate | Result |
|---|---|
| Archive path safety | Pass — no absolute or parent-traversal paths |
| JavaScript syntax | Pass — 57/57 source files |
| JSON parsing | Pass — 36/36 files |
| Credential-pattern scan | Pass — no candidate files |
| GitHub file-size limit | Pass — largest file 11,426,402 bytes |
| Browser boot/play-test | Pending — required before baseline promotion |

Automated checks establish structural integrity only. They do not prove gameplay correctness, pacing quality, save migration safety, visual fidelity or long-session determinism.

## Delta from the latest identified GitHub line

The newest matching online repository found during intake was `M4nfr41D-spec/PROJECT-BONZOOKA2026`, last committed on 2026-03-13. Its root contained an earlier partial code/document set. A60 is materially newer and includes the complete runtime, data, tools and asset payload; it must therefore not be treated as a routine overwrite of that public repository.

## Known observations — not silently corrected

- The product is now referred to as **BONZOOKA**, while the preserved source still contains historical `BONZOOKAA` labels.
- The visible build stamp is `A60`, but the module cache suffix in `index.html` is still `main.js?v=2164`.
- The consolidated roadmap/version history ends in March 2026 even though later A29–A44 change records and A60 loot-filter changes are present.
- Several large dungeon sample images duplicate runtime tile assets. They are retained in the raw baseline; repository-size optimization belongs in a separate verified change.
- The proprietary `LICENSE.txt` requires a private canonical repository unless the owner explicitly approves public disclosure.
- The owner has explicitly approved disclosure of this candidate through the public recovery repository and GitHub Pages preview. This does not promote A60 to the canonical master.

## Promotion gate

A60 may be promoted only after:

1. Browser boot completes without unhandled errors or missing required assets.
2. Hub, combat entry, Director phase cycling, loot pickup/auto-salvage, save/load and one zone transition are exercised.
3. A deterministic replay or seed comparison confirms stable world generation for the agreed test case.
4. The observed result is accepted by Ing. Manfred Foissner.
