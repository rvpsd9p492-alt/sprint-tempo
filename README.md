# Leichtathletik

Offline-Web-App mit mehreren Leichtathletik-Modulen.

**App öffnen:** https://rvpsd9p492-alt.github.io/sprint-tempo/

## Module

- **Athleten** (`athleten/`) – zentrale Athletenverwaltung für alle Module.
- **Sprint-Tempo** (`tempo/`) – Trainings-Sollzeiten aus 60/100/200-m-Bestzeiten über ein physikalisches
  Geschwindigkeitsmodell (Hill/Keller, Tibshirani 1997). Bestzeiten kommen automatisch aus den Wettkampfergebnissen
  der letzten 18 Monate (elektronisch, Wind ≤ +2,0); fehlende Werte manuell, Überschreiben und Zurücksetzen möglich.
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

## Cloud-Sicherung (Supabase)

1. Im Supabase-Dashboard **SQL Editor** öffnen, Inhalt von `supabase/migrations/20261008000000_la_records.sql` einfügen und ausführen
   (oder automatisch über die Supabase-GitHub-Integration mit „Deploy to production“).
2. Unter **Project Settings → API** die *Project URL* und den *anon public* Key in `shared/config.js` eintragen,
   `CACHE` in `sw.js` hochzählen, committen.
3. In der App auf der Übersicht unter *Datensicherung → Cloud* ein Konto erstellen (E-Mail + Passwort).
4. Danach unter **Authentication → Sign In / Providers** „Allow new users to sign up“ ausschalten, damit niemand
   sonst Konten in deinem Projekt anlegt.

Abgleich: je Athlet, Ergebnis und Einstellung; neuere Änderung gewinnt (auch serverseitig per Trigger),
Löschungen werden übertragen. Offline-Änderungen werden beim nächsten Online-Start nachgeholt.

## Entwicklung

- Gemeinsames Design: `shared/base.css`, gemeinsame Funktionen (Speicher, Sicherung, Offline): `shared/common.js`
- Neues Modul: Ordner mit `index.html` anlegen, Kachel in `index.html` ergänzen, Ordner in `sw.js` (`ASSETS`) eintragen.
- **Bei jeder Änderung `CACHE` in `sw.js` hochzählen**, sonst laden installierte Geräte neue Dateien nicht vollständig.

Schrift: Barlow / Barlow Condensed, SIL Open Font License 1.1 (siehe `fonts/LICENSE.txt`).
