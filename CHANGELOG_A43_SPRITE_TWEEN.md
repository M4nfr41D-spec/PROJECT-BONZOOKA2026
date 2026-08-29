# A43 — Sprite playback smoothing (frame cross-fade tweening)

## Why
The procedural defaults (A41/A42) are the placeholder baseline; the PNG sprites are
meant to be the higher-quality endgame. The thing that made sprites feel "hölzern"
wasn't the concept — it was **playback**: low-fps sheets (manifest has fps as low as
4–12) hard-cut between frames, and uneven frame material shows every seam.

## What
Frame **cross-fade tweening** in SpriteManager. The animation `timer` already tracks
sub-frame progress; we use it: when between frame N and N+1 (t = timer / frameDuration),
draw frame N at alpha (1-t) and frame N+1 at alpha t, at the same x/y/angle/size.
Result: frames blend (interpolation / soft motion-blur) instead of snapping — choppy
sheets and inconsistent frames read fluidly.

- In-place blend (identical transform for both frames) → no positional ghosting.
- Only the current sub-frame window is doubled; t≈0 / t≈1 / finished / single-frame
  draws stay single (no wasted draw).
- Gated to `speed <= _tweenMaxFps` (24): fast anims are already smooth, so they skip it.

## Helps both paths
Applies to every `drawAnimated` consumer: the entity sprites you already see
(ships/enemies — those low-fps sheets benefit most right now), and the
effect/bullet/pickup sprites whenever you re-enable them via their sprite flags.

## Controls
- `SpriteManager.tween` = true (default). Set false to hard-cut.
- `SpriteManager._tweenMaxFps` = 24. Lower it to tween only the choppiest sheets.

## Cost / note
Tweened anims do 2 `drawImage` calls during the blend window (one extra per active
tweened sprite). Cheap, and bounded by `_tweenMaxFps`; toggle off if ever needed.

## Verification
- acorn 56/56 clean; headless boot 0 errors / 0 request failures
- functional test against real manifest (`explosion_small`, 14 frames): at mid-frame
  timer, drawAnimated emitted exactly 2 drawFrame calls — frame 0 @ alpha 0.5 +
  frame 1 @ alpha 0.5 (correct cross-fade)
- A39 crash, A40 shake/hitstop, A41/A42 procedural FX all intact
