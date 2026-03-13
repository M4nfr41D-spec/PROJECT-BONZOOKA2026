# Legacy Start Removal

- Removed the legacy `startModal` from `index.html`.
- Stopped `main.js` from depending on the legacy start screen during hub boot.
- Added an early boot guard that removes `#startModal` if an old file slips back into the build.
- Relaxed `runtime/Contracts.js` so the old start DOM is no longer required.
