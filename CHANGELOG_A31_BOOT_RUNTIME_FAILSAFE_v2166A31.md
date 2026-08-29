# CHANGELOG — v2166A31 BOOT + RUNTIME FAILSAFE

## Dateibasis
`bonzookaa_v2166A30_TILE_DATA_NORMALIZED_MASTER.zip`

## Ziel
Den A29/A30-Instanzpfad so absichern, dass ein Fehler in World/Instanz/Render nicht wieder in einem schwarzen Hänger mit unsichtbarem Hub endet.

## Kernänderungen
- `main.js` Boot jetzt mit echtem Top-Level-Failsafe:
  - `Game.init()` ist vollständig in `try/catch` gehärtet.
  - Bei Boot-Fehler wird aktiv in einen **Hub Safe Mode** zurückgezwungen.
- Neuer `handleBootFailure(error)`:
  - setzt Szene hart auf `hub`
  - aktiviert `hubModal` direkt
  - schreibt Fehler sichtbar ins `actList`-Panel
  - blendet ein `bootErrorBanner` ein
- Neuer `recoverToHubSafeMode(error, context)`:
  - schließt hängende Combat-/Service-/Vendor-/Craft-Modals
  - verlässt Combat-Fullscreen
  - erzwingt kanonischen Hub-Zustand
  - zeigt Hub-Fallback statt still weiter im defekten Gameloop zu laufen
- Game-Loop jetzt mit Circuit Breaker:
  - bei Loop-Fehler nicht nur `console.error`, sondern sofortige Recovery in den Hub
- `DOMContentLoaded` Init nun promise-safe:
  - unhandled async Boot-Errors laufen in den Failsafe statt das Boot still abzubrechen

## Absicht
A31 behauptet nicht, dass damit jeder World-/Instanzfehler magisch weg ist.
Aber es verhindert, dass derselbe Fehler den ganzen Build wieder in einen **schwarzen Stillstand ohne Hub-Modal** kippt.

## Validierung
- `node --check main.js`
