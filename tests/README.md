# Tests

```
node tests/run.mjs            # alle Tests
node tests/run.mjs common     # nur Dateien, deren Name "common" enthält
```

- Voraussetzung: Node 22 und Playwright mit Chromium (`npm i -g playwright`, oder `PLAYWRIGHT_MODULE=/pfad/zu/playwright/index.mjs`).
- `run.mjs` startet einen Webserver für das Repository (`http://localhost:8766/sprint-tempo/`) und den Supabase-Nachbau
  `mock-supabase.mjs` (Port 8799). `shared/config.js` wird dabei je Test leer (ohne Cloud) oder auf den Nachbau
  zeigend ausgeliefert (`t.cloud(true)`); die echte Datei und die echte Datenbank bleiben unberührt.
- Jede Datei `*.test.mjs` exportiert `async function (t)`; Prüfungen mit `t.check(name, bedingung, detail)` bzw.
  `t.eq(name, ist, soll)`. Seitenfehler (JavaScript-Ausnahmen) zählen automatisch als Fehler.
- Bildschirmfotos: `t.shot(page, "name")` legt PNGs in `$SHOTS` (Standard `/tmp`) ab.
