# Bullet Wiring Fix

## Fixed
- bullet travel sprites now render with dedicated per-type draw sizes instead of a one-size-fits-all scale
- bullet travel sprites can use manifest-level `angleOffset`, `rotateWithVelocity`, `renderScale`, and `minDisplaySize`
- enemy bullets now prefer the sane `plasma` bullet sheet before falling back to `plasma_basic`
- `plasma_basic/travel` now has an explicit trimmed sequence and transparent-frame auto-trim fallback
- sequence-based frame selection is honored at runtime for bullet sheets exactly like other sprite categories

## Why this was necessary
The previous wiring treated bullet travel sprites like generic entities. That made several projectile sheets look undersized, over-rotated, or visually inconsistent when the source sheet did not start at frame 0 or contained many transparent cells.
