# Leichtathletik-App – Arbeitsregeln für Claude

Offline-Web-App (PWA) ohne Build-Schritt: reines HTML/CSS/JavaScript, Daten in localStorage, optionale Cloud-Sicherung
über Supabase. Live über GitHub Pages aus `main`: https://rvpsd9p492-alt.github.io/sprint-tempo/
Aufbau, Module, Cloud, Watch und Migrationen stehen in der README – vor größeren Änderungen lesen.

## Bei jeder Änderung

1. **`CACHE` in `sw.js` und `VERSION` in `shared/common.js` hochzählen** (z. B. v40 → v41, 2.36 → 2.37), sonst laden
   installierte Geräte die neuen Dateien nicht. Neue Dateien in `ASSETS` (`sw.js`) eintragen.
2. **Tests:** `node tests/run.mjs` (alle, ~20 s) bzw. `node tests/run.mjs <name>`. Alles muss grün sein, bevor
   gepusht wird. Neue Funktionen bekommen Prüfungen in `tests/*.test.mjs` (siehe `tests/README.md`).
   Testdateien und Hilfsskripte gehören ins Repository, nicht nur in den Zwischenspeicher der Sitzung
   (eine frühere Testsammlung ging so verloren).
3. Direkt auf `main` committen und pushen. **Keine Pull Requests**, außer der Nutzer verlangt es ausdrücklich.
4. README ergänzen, wenn sich Bedienung, Datenformat oder Supabase-Teile ändern.

## Konventionen

- Oberfläche und Kommentare auf Deutsch; Dezimalkomma in der Anzeige (12,13), Eingaben mit Punkt oder Komma.
- Code-Stil wie im Bestand: kompakt, gemeinsame Logik in `shared/common.js` (`window.LA`), Modulseiten mit Inline-Script.
- Farben nur über die CSS-Variablen aus `shared/base.css` (hell/dunkel). Ansichten müssen auf dem iPhone ohne
  seitliches Scrollen funktionieren.
- Bestleistungen immer ohne Rückenwind über +2,0 m/s und ohne Handzeiten; Bestleistungen gelten je Altersklasse
  (DLV: Jahrgang, international: Alter am Wettkampftag).
- Diagramme: schnellere Zeiten oben.
- Neue synchronisierte Daten als `kind = 'settings'` mit id-Präfix (`event:`, `run:`, `kraft:`, `ziele:`, `rang:` …),
  damit ältere App-Versionen sie ignorieren. Datensätze im Muster von `LA.PROGRAMS` werden automatisch abgeglichen
  und gesichert.

## Supabase (Projekt `hdtukcemlnhaoirdxitc`, „Leichtathletik“)

- **Nutzerdaten nie ohne Rückfrage ändern oder löschen.** Lesen zur Fehlersuche ist in Ordnung; Tests gegen die echte
  Datenbank nur in einer Transaktion mit `rollback`.
- **Schreibende Supabase-Aufrufe brauchen eine Bestätigung, die beim Nutzer nicht ankommt** (Zeitüberschreitung).
  Datenbankänderungen daher als Migration in `supabase/migrations/` anlegen und dem Nutzer das SQL zum Ausführen im
  SQL Editor geben; danach Ergebnis prüfen. Der Migrationsverlauf in Supabase entspricht den Dateien im Repository
  (Stand 08.11.2026) – neue Migrationen dort mit eintragen lassen.
- Edge-Functions `la-calendar` (Kalender-Abo) und `la-result` (Apple-Watch-Kurzbefehl) laufen ohne JWT-Prüfung;
  der geheime Link ist die Berechtigung. Das ist gewollt (vom Nutzer freigegeben). Weitere Zugänge ohne Anmeldung nur
  mit ausdrücklicher Zustimmung.
- `la-result` rechnet die Intensität mit demselben Modell wie `tempo/index.html` (fitModel/refFor/offFor/zone).
  Wer das Modell ändert, ändert beide Stellen; `tests/tempo.test.mjs` und `tests/la-result.test.mjs` prüfen dieselben Werte.
- Registrierung neuer Konten ist abgeschaltet und bleibt es. Keine Secrets oder `service_role`-Schlüssel ins
  Repository (es ist öffentlich); in `shared/config.js` steht nur der öffentliche Publishable Key.

## Hinweise zum Nutzer

- Nutzt die App auf iPhone und Apple Watch (Kurzbefehle: Stoppuhr-Variante und Listen-Eingabe funktionieren auf der
  Watch). Bestenlisten (DLV, WMA) werden von Hand eingefügt – es gibt keine Schnittstelle zum automatischen Laden.
- Die Repositories `SprintTime` (alte native iOS-App) und `wp-monitor` sind archiviert und gehören nicht zu dieser App.
