# Leichtathletik

Offline-Web-App mit mehreren Leichtathletik-Modulen.

**App öffnen:** https://rvpsd9p492-alt.github.io/sprint-tempo/

## Module

- **Sprint-Tempo** (`tempo/`) – Trainings-Sollzeiten aus 60/100/200-m-Bestzeiten über ein physikalisches
  Geschwindigkeitsmodell (Hill/Keller, Tibshirani 1997).
- **Wettkampfergebnisse** (`ergebnisse/`) – Ergebnisse mit Datum, Disziplin, Halle/Freiluft, Ergebnis, Wind,
  Meisterschaft, Platzierung und Kommentar erfassen; Filter nach Jahr, Disziplin, Meisterschaft und Halle/Freiluft;
  Bestleistungen (PB/SB, ohne Rückenwind über +2,0 m/s); CSV-Export für Excel.

## Auf iPhone/iPad installieren

1. Link oben in **Safari** öffnen.
2. **Teilen → Zum Home-Bildschirm**.
3. Einmal mit Internet starten – danach läuft die App auch ohne Netz.

## Daten

Alle Daten liegen nur auf dem Gerät (localStorage). Sicherung und Übertragung auf andere Geräte über
**Datensicherung** auf der Übersichtsseite (JSON-Datei; Import führt zusammen, löscht nichts).

## Entwicklung

- Gemeinsames Design: `shared/base.css`, gemeinsame Funktionen (Speicher, Sicherung, Offline): `shared/common.js`
- Neues Modul: Ordner mit `index.html` anlegen, Kachel in `index.html` ergänzen, Ordner in `sw.js` (`ASSETS`) eintragen.
- **Bei jeder Änderung `CACHE` in `sw.js` hochzählen**, sonst laden installierte Geräte neue Dateien nicht vollständig.

Schrift: Barlow / Barlow Condensed, SIL Open Font License 1.1 (siehe `fonts/LICENSE.txt`).
