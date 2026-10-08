/* Gemeinsame Funktionen aller Leichtathletik-Module: Athleten, Ergebnisse, Bestzeiten, Sicherung, Offline. */
(function () {
  "use strict";
  const KEYS = { athletes: "laAthletes.v1", tempo: "sprintTempo.v1", results: "laResults.v1", meta: "laMeta.v1",
    deleted: "laDeleted.v1", cloud: "laCloud.v1" };
  const SYNCED = [KEYS.athletes, KEYS.results, KEYS.tempo];
  const TEMPO_SETTINGS = ["rt", "hochPen", "handStd", "handFly", "kExt", "tol"];
  /** Sprintstrecken, deren Bestzeiten Sprint-Tempo nutzt (Schlüssel = Strecke in m). */
  const SPRINT = { "60": "60 m", "100": "100 m", "200": "200 m", "400": "400 m" };
  const SPRINT_DISTS = Object.keys(SPRINT);
  const PB_MONTHS = 18;

  function load(key, def) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : def; } catch (e) { return def; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { return false; }
    // Cloud-Sicherung über Änderungen informieren (synchronisiert verzögert im Hintergrund)
    if (SYNCED.includes(key)) window.dispatchEvent(new CustomEvent("la:changed", { detail: { key } }));
    return true;
  }
  /** Merkt eine Löschung vor, damit sie auch auf anderen Geräten ankommt. */
  function trackDelete(kind, id) {
    const list = load(KEYS.deleted, []) || [];
    list.push({ kind, id, at: new Date().toISOString() });
    save(KEYS.deleted, list);
    window.dispatchEvent(new CustomEvent("la:changed", { detail: { key: KEYS.deleted } }));
  }
  const newId = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  /** Gültiges Datum im Format JJJJ-MM-TT? */
  function isIsoDate(v) {
    if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const d = new Date(v + "T12:00:00Z");
    return !isNaN(d) && d.toISOString().slice(0, 10) === v;
  }
  /** Alter in vollendeten Jahren am Stichtag. */
  function exactAge(birthDate, dateIso) {
    const [by, bm, bd] = birthDate.split("-").map(Number), [y, m, d] = String(dateIso).slice(0, 10).split("-").map(Number);
    return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
  }

  /* ---------- Athleten ---------- */
  // { id, name, birthYear|null, manual: { "60": { v, over }, ... }, updatedAt }
  //   manual[d].over = false: Ersatzwert (es gab kein Ergebnis) – wird von Ergebnissen abgelöst
  //   manual[d].over = true:  bewusste Überschreibung eines erfassten Ergebnisses
  function cleanAthlete(a) {
    if (!a || typeof a.id !== "string" || typeof a.name !== "string") return null;
    const manual = {};
    SPRINT_DISTS.forEach((d) => {
      const m = a.manual && a.manual[d];
      if (m && typeof m.v === "number" && m.v > 0) manual[d] = { v: m.v, over: !!m.over };
    });
    const bd = isIsoDate(a.birthDate) ? a.birthDate : null;
    return { id: a.id, name: a.name.slice(0, 40),
      birthYear: bd ? +bd.slice(0, 4) : Number.isInteger(a.birthYear) ? a.birthYear : null, birthDate: bd,
      sex: a.sex === "m" || a.sex === "w" ? a.sex : null,
      manual, updatedAt: a.updatedAt || new Date().toISOString() };
  }
  /** Athlet aus dem alten Sprint-Tempo-Format (pb60 … pb400) in das zentrale Format bringen. */
  function fromTempoAthlete(a) {
    if (!a || typeof a.id !== "string" || typeof a.name !== "string") return null;
    const manual = {};
    SPRINT_DISTS.forEach((d) => { const v = a["pb" + d]; if (typeof v === "number" && v > 0) manual[d] = { v, over: false }; });
    return cleanAthlete({ id: a.id, name: a.name, birthYear: null, manual });
  }
  function migrate() {
    if (localStorage.getItem(KEYS.athletes) !== null) return;
    const t = load(KEYS.tempo, {}) || {};
    const list = (Array.isArray(t.athletes) ? t.athletes : []).map(fromTempoAthlete).filter(Boolean);
    save(KEYS.athletes, list);
  }
  function athletes() {
    const list = load(KEYS.athletes, []);
    return (Array.isArray(list) ? list : []).map(cleanAthlete).filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  }
  function saveAthletes(list) { return save(KEYS.athletes, list.map(cleanAthlete).filter(Boolean)); }
  function upsertAthlete(a) {
    const list = athletes(), i = list.findIndex((x) => x.id === a.id);
    a.updatedAt = new Date().toISOString();
    if (i >= 0) list[i] = a; else list.push(a);
    return saveAthletes(list);
  }
  function deleteAthlete(id) {
    saveAthletes(athletes().filter((a) => a.id !== id));
    trackDelete("athlete", id);
    const res = results();
    let changed = false;
    res.forEach((r) => { if (r.athleteId === id) { r.athleteId = null; r.updatedAt = new Date().toISOString(); changed = true; } });
    if (changed) saveResults(res);
  }
  const athleteName = (id, list) => { const a = (list || athletes()).find((x) => x.id === id); return a ? a.name : ""; };

  /* ---------- Ergebnisse ---------- */
  function results() { const r = load(KEYS.results, []); return Array.isArray(r) ? r : []; }
  function saveResults(list) { return save(KEYS.results, list); }
  const isWindy = (r) => r.wind != null && r.wind > 2.0;
  /** Gültig für Bestleistungen: Ergebnis vorhanden, kein Rückenwind > 2,0, nicht handgestoppt. */
  const isLegal = (r) => r.value != null && !isWindy(r) && !r.hand;

  /* ---------- Disziplinen & Bestleistungen ---------- */
  // [Name, Wertung (t=Zeit, d=Weite/Höhe, p=Punkte), Windmessung im Freien]
  const DISCIPLINE_GROUPS = [
    ["Sprint", [["50 m", "t", 1], ["60 m", "t", 1], ["75 m", "t", 1], ["100 m", "t", 1], ["150 m", "t", 0], ["200 m", "t", 1], ["300 m", "t", 0], ["400 m", "t", 0]]],
    ["Hürden", [["60 m Hürden", "t", 1], ["80 m Hürden", "t", 1], ["100 m Hürden", "t", 1], ["110 m Hürden", "t", 1], ["300 m Hürden", "t", 0], ["400 m Hürden", "t", 0]]],
    ["Lauf", [["800 m", "t", 0], ["1000 m", "t", 0], ["1500 m", "t", 0], ["2000 m", "t", 0], ["3000 m", "t", 0], ["5000 m", "t", 0], ["10.000 m", "t", 0],
      ["2000 m Hindernis", "t", 0], ["3000 m Hindernis", "t", 0], ["10 km Straße", "t", 0], ["Halbmarathon", "t", 0], ["Marathon", "t", 0]]],
    ["Staffel", [["4×100 m", "t", 0], ["4×200 m", "t", 0], ["4×400 m", "t", 0]]],
    ["Sprung", [["Hochsprung", "d", 0], ["Stabhochsprung", "d", 0], ["Weitsprung", "d", 1], ["Dreisprung", "d", 1]]],
    ["Wurf", [["Kugelstoß", "d", 0], ["Diskuswurf", "d", 0], ["Hammerwurf", "d", 0], ["Speerwurf", "d", 0], ["Ballwurf", "d", 0]]],
    ["Mehrkampf", [["Dreikampf", "p", 0], ["Vierkampf", "p", 0], ["Fünfkampf", "p", 0], ["Siebenkampf", "p", 0], ["Zehnkampf", "p", 0]]],
  ];
  const DISC = new Map();
  DISCIPLINE_GROUPS.forEach(([, list]) => list.forEach(([n, k, w]) => DISC.set(n, { kind: k, wind: !!w, order: DISC.size })));
  const discOrder = (name) => (DISC.has(name) ? DISC.get(name).order : 1000);
  // Kurzformen aus Listen/Excel → Name der Disziplinliste
  const DISC_ALIASES = { kugel: "Kugelstoß", kugelstossen: "Kugelstoß", speer: "Speerwurf", diskus: "Diskuswurf", hammer: "Hammerwurf",
    ball: "Ballwurf", weit: "Weitsprung", hoch: "Hochsprung", drei: "Dreisprung", stab: "Stabhochsprung", stabhoch: "Stabhochsprung",
    hm: "Halbmarathon", "10kmstrasse": "10 km Straße", "10km": "10 km Straße" };
  /** Vereinheitlicht Disziplinnamen: "60", "60m" → "60 m"; "4x100" → "4×100 m"; "60mH" → "60 m Hürden"; "Kugel" → "Kugelstoß". */
  function normalizeDiscipline(raw) {
    const s = String(raw == null ? "" : raw).trim().replace(/\s+/g, " ");
    if (!s || DISC.has(s)) return s;
    const fold = (x) => x.toLowerCase().replace(/ß/g, "ss").replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue");
    const low = fold(s);
    for (const n of DISC.keys()) if (fold(n) === low) return n;
    const c = low.replace(/[\s.]/g, "");
    let m;
    if ((m = c.match(/^(\d)[x×*](\d{2,4})m?$/))) return m[1] + "×" + m[2] + " m";
    if ((m = c.match(/^(\d{2,3})m?(h|hue|huerden)$/)) && DISC.has(m[1] + " m Hürden")) return m[1] + " m Hürden";
    if ((m = c.match(/^(\d{4})m?(hi|hind|hindernis)$/)) && DISC.has(m[1] + " m Hindernis")) return m[1] + " m Hindernis";
    if ((m = c.match(/^(\d{2,5})m?$/))) { const v = +m[1]; return (v >= 10000 ? v.toLocaleString("de-DE") : String(v)) + " m"; }
    if (DISC_ALIASES[c]) return DISC_ALIASES[c];
    return s;
  }
  /** Korrigiert gespeicherte Ergebnisse mit Kurzform-Disziplinen (einmalig je Eintrag; Cloud übernimmt die Änderung). */
  function normalizeStoredDisciplines() {
    const res = load(KEYS.results, []);
    if (!Array.isArray(res)) return 0;
    const now = new Date().toISOString(); let n = 0;
    res.forEach((r) => {
      const d = normalizeDiscipline(r.discipline);
      if (d && d !== r.discipline) { r.discipline = d; if (DISC.has(d)) r.kind = DISC.get(d).kind; r.updatedAt = now; n++; }
    });
    if (n) save(KEYS.results, res);
    return n;
  }
  const better = (kind, a, b) => (kind === "t" ? a < b : a > b);
  /** Einheit eines Ergebnisses: s, min, h, m oder Pkt. */
  function markUnit(r) {
    if (r.value == null) return "";
    if (r.kind === "d") return "m";
    if (r.kind === "p") return "Pkt.";
    const c = (String(r.mark).match(/:/g) || []).length;
    return c === 2 ? "h" : c === 1 ? "min" : "s";
  }
  /* ---------- Altersklassen ----------
     DLV-Regel: maßgeblich ist das Alter, das im Wettkampfjahr erreicht wird (Jahrgang).
     Masters in 5-Jahres-Klassen (M30, M35 …), 23–29 Männer/Frauen, darunter U23, U20, U18
     und ab 15 Jahren abwärts Einzeljahrgänge (M15, W14 …). */
  // International (WMA/EMA): Masters nach dem Alter am Wettkampftag und erst ab 35 –
  // dafür ist das Geburtsdatum nötig; ohne Geburtsdatum gilt weiter der Jahrgang.
  function ageClass(athlete, dateIso, intl) {
    if (!athlete || !Number.isInteger(athlete.birthYear) || !dateIso) return null;
    let age = parseInt(String(dateIso).slice(0, 4), 10) - athlete.birthYear;
    const byDay = !!(intl && athlete.birthDate && age >= 30);
    if (byDay) age = exactAge(athlete.birthDate, dateIso);
    if (!(age >= 0 && age < 120)) return null;
    const s = athlete.sex === "w" ? "W" : athlete.sex === "m" ? "M" : "";
    let label, minAge;
    if (byDay && age < 35) { minAge = 23; label = s === "W" ? "Frauen" : s === "M" ? "Männer" : "Hauptklasse"; return { label, minAge, age, masters: false, byDay }; }
    if (age >= 30) { minAge = Math.floor(age / 5) * 5; label = s ? s + minAge : "AK " + minAge; }
    else if (age >= 23) { minAge = 23; label = s === "W" ? "Frauen" : s === "M" ? "Männer" : "Hauptklasse"; }
    else if (age >= 20) { minAge = 20; label = s ? s + "U23" : "U23"; }
    else if (age >= 18) { minAge = 18; label = s ? s + "JU20" : "U20"; }
    else if (age >= 16) { minAge = 16; label = s ? s + "JU18" : "U18"; }
    else { minAge = age; label = s ? s + age : "AK " + age; }
    return { label, minAge, age, masters: age >= 30, byDay };
  }
  /** Altersklasse eines Ergebnisses (oder null, wenn Athlet/Jahrgang fehlt). */
  function resultClass(r, athleteList) {
    const a = (athleteList || athletes()).find((x) => x.id === r.athleteId);
    return a ? ageClass(a, r.date, !!r.intl) : null;
  }

  /* ---------- Meisterschaften & Titel ---------- */
  /** Feste Einträge des Auswahlmenüs, von regional nach international (erweiterbar über „Andere …“). */
  const CHAMPIONSHIPS = ["Kreismeisterschaft", "Südhessische Meisterschaft", "Hessische Meisterschaft",
    "Süddeutsche Meisterschaft", "Deutsche Meisterschaft", "Europameisterschaft", "Weltmeisterschaft"];
  const INTL_CHAMPS = ["Europameisterschaft", "Weltmeisterschaft"];
  const champRank = (c) => { const i = CHAMPIONSHIPS.indexOf(String(c || "").trim()); return i < 0 ? -1 : i; };
  /** Alle Meisterschaftsnamen: feste Liste + in Ergebnissen verwendete eigene Einträge. */
  function championships(resList) {
    const extra = [...new Set((resList || results()).map((r) => String(r.champ || "").trim())
      .filter((c) => c && !CHAMPIONSHIPS.includes(c)))].sort((a, b) => a.localeCompare(b, "de"));
    return CHAMPIONSHIPS.concat(extra);
  }
  /** Titel & Medaillen: Meisterschaftsergebnisse mit Platz 1–3, wichtigste Meisterschaft und neueste zuerst. */
  function titles(athleteId, resList) {
    return (resList || results()).filter((r) => r.athleteId === athleteId && String(r.champ || "").trim() && r.place >= 1 && r.place <= 3)
      .sort((a, b) => champRank(b.champ) - champRank(a.champ) || b.date.localeCompare(a.date) || a.place - b.place);
  }

  /* ---------- CSV ---------- */
  /** Liest eine Textdatei; Excel unter Windows speichert oft Windows-1252 statt UTF-8. */
  async function readTextFile(file) {
    const buf = await file.arrayBuffer();
    try { return new TextDecoder("utf-8", { fatal: true }).decode(buf).replace(/^\ufeff/, ""); }
    catch (e) { return new TextDecoder("windows-1252").decode(buf); }
  }
  /** CSV mit Semikolon, Komma oder Tab (automatisch erkannt), Anführungszeichen, Zeilenumbrüche in Feldern. */
  function parseCSV(text) {
    const first = text.split(/\r?\n/)[0] || "";
    const count = (ch) => first.split(ch).length - 1;
    const sep = [";", "\t", ","].sort((a, b) => count(b) - count(a))[0];
    const rows = []; let row = [], f = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += c;
      } else if (c === '"') q = true;
      else if (c === sep) { row.push(f); f = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
      else f += c;
    }
    if (f !== "" || row.length) { row.push(f); rows.push(row); }
    return rows.map((r) => r.map((x) => x.trim())).filter((r) => r.some((x) => x !== ""));
  }
  /** CSV-Text für Excel (Semikolon, UTF-8 mit BOM). */
  function toCSV(rows) {
    const q = (v) => { const s = String(v == null ? "" : v); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return "\ufeff" + rows.map((r) => r.map(q).join(";")).join("\r\n");
  }
  /** Spaltenüberschriften → Index, tolerant gegenüber Groß-/Kleinschreibung, Leerzeichen und Umlaut-Schreibweisen. */
  function headerIndex(header, aliases) {
    const norm = (s) => String(s).toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]/g, "");
    const h = header.map(norm), out = {};
    Object.entries(aliases).forEach(([key, names]) => { out[key] = h.findIndex((x) => names.map(norm).includes(x)); });
    return out;
  }
  /**
   * Import-Vorschau: zeigt vor dem Import jede übersprungene Zeile mit Grund, erkannte/ignorierte Spalten
   * und bietet die Fehlerzeilen als CSV (mit Spalte „Fehlergrund“) zum Korrigieren an.
   * problems: [{ line, type: "error"|"dup"|"warn", reason, raw: [Zellen] }]
   */
  function importPreview(o) {
    const box = o.box, e = esc;
    const errs = o.problems.filter((p) => p.type === "error"), dups = o.problems.filter((p) => p.type === "dup"),
      warns = o.problems.filter((p) => p.type === "warn");
    const skipped = o.problems.filter((p) => p.type !== "warn");
    const cols = o.header.map((h, i) => ({ h: h || "(ohne Überschrift)", used: o.usedIdx.includes(i), note: (o.colNotes || {})[i] }));
    const rowsHtml = o.problems.slice().sort((a, b) => a.line - b.line || (b.type === "warn") - (a.type === "warn")).map((p) =>
      '<tr class="t-' + p.type + '"><td class="ln">' + p.line + "</td><td><b>" + (p.type === "error" ? "Fehler" : p.type === "dup" ? "Doppelt" : "Hinweis")
      + ":</b> " + e(p.reason) + '<div class="raw">' + e(p.raw.join(" ; ")) + "</div></td></tr>").join("");
    box.innerHTML = "<h2>Import prüfen</h2>"
      + '<p class="note" style="margin-top:0">' + e(o.fileName) + " · " + plural(o.dataRows, "Datenzeile", "Datenzeilen") + "</p>"
      + '<div class="impsum"><span class="ok">✓ ' + plural(o.okCount, o.okLabel[0], o.okLabel[1]) + " werden importiert</span>"
      + (dups.length ? "<span>↺ " + plural(dups.length, "Duplikat", "Duplikate") + " übersprungen</span>" : "")
      + (errs.length ? '<span class="warn">✕ ' + plural(errs.length, "fehlerhafte Zeile", "fehlerhafte Zeilen") + " übersprungen</span>" : "")
      + (warns.length ? "<span>! " + plural(warns.length, "Hinweis", "Hinweise") + "</span>" : "") + "</div>"
      + '<p class="note">Spalten: ' + cols.map((c) => c.used ? '<span class="col">' + e(c.h) + "</span>"
        : '<span class="col off">' + e(c.h) + " – " + e(c.note || "nicht erkannt, wird ignoriert") + "</span>").join(" ") + "</p>"
      + (o.extra ? '<p class="note">' + o.extra + "</p>" : "")
      + (rowsHtml ? '<div class="impscroll"><table class="imptab"><thead><tr><th>Zeile</th><th>Grund und Inhalt</th></tr></thead><tbody>' + rowsHtml + "</tbody></table></div>" : "")
      + '<div class="row" style="margin-top:12px">'
      + '<button class="btn primary" data-act="go"' + (o.okCount ? "" : " disabled") + ">" + (o.okCount ? plural(o.okCount, o.okLabel[0], o.okLabel[1]) + " importieren" : "Nichts zu importieren") + "</button>"
      + '<button class="btn" data-act="cancel">Abbrechen</button>'
      + (skipped.length ? '<button class="btn" data-act="errcsv">Fehlerliste als CSV</button>' : "") + "</div>";
    box.hidden = false;
    document.body.classList.add("importing"); // schwebende Knöpfe ausblenden
    box.scrollIntoView({ behavior: "smooth", block: "start" });
    box.onclick = async (ev) => {
      const b = ev.target.closest("button[data-act]"); if (!b) return;
      if (b.dataset.act === "cancel" || b.dataset.act === "go") { box.hidden = true; box.innerHTML = ""; document.body.classList.remove("importing"); }
      if (b.dataset.act === "cancel") o.onCancel && o.onCancel();
      if (b.dataset.act === "go") o.onImport();
      if (b.dataset.act === "errcsv") {
        const reasons = new Map();
        skipped.forEach((p) => reasons.set(p.line, (reasons.has(p.line) ? reasons.get(p.line) + " | " : "") + p.reason));
        const rows = [o.header.concat("Fehlergrund")].concat([...reasons.keys()].sort((a, b) => a - b)
          .map((ln) => o.rawRows[ln - 2].concat(reasons.get(ln))));
        await shareOrDownload(o.fileName.replace(/\.[^.]*$/, "") + "-fehler.csv", "text/csv", toCSV(rows));
      }
    };
  }
  /** Hinweis-Probleme für Zeilen mit abweichender Spaltenzahl (typisch: Semikolon im Text ohne Anführungszeichen). */
  function columnCountWarnings(header, rows) {
    const out = [];
    rows.forEach((r, i) => {
      if (r.length !== header.length) out.push({ line: i + 2, type: "warn", raw: r,
        reason: "Zeile hat " + r.length + " statt " + header.length + " Spalten – steht ein Semikolon im Text? Dann den Text in Anführungszeichen setzen; Werte können verrutscht sein." });
    });
    return out;
  }

  /** Datum aus 12.06.2026, 12.6.26, 2026-06-12 oder 12/06/2026 → JJJJ-MM-TT (oder null). */
  function parseDate(v) {
    const s = String(v || "").trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/), y, mo, d;
    if (m) { [, y, mo, d] = m; }
    else if ((m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2}|\d{4})$/))) {
      [, d, mo, y] = m;
      if (y.length === 2) { const cur = new Date().getFullYear() % 100; y = (+y <= cur ? 2000 : 1900) + +y; }
    } else return null;
    const iso = y + "-" + String(mo).padStart(2, "0") + "-" + String(d).padStart(2, "0");
    return isIsoDate(iso) ? iso : null;
  }

  /**
   * Je Athlet und Disziplin das beste gültige Ergebnis (bei Gleichstand das frühere).
   * Schlüssel "athleteId|Disziplin"; mit opts.byClass zusätzlich je Altersklasse: "athleteId|Klasse|Disziplin".
   */
  function bestMarks(list, opts) {
    const best = new Map(), byClass = !!(opts && opts.byClass), ath = byClass ? (opts.athletes || athletes()) : null;
    list.forEach((r) => {
      if (!isLegal(r)) return;
      const c = byClass ? resultClass(r, ath) : null;
      const k = (r.athleteId || "") + "|" + (byClass ? (c ? c.label : "") + "|" : "") + r.discipline, b = best.get(k);
      if (!b || better(r.kind, r.value, b.value) || (r.value === b.value && r.date < b.date)) best.set(k, r);
    });
    return best;
  }

  /* ---------- Bestzeiten für Sprint-Tempo ---------- */
  function cutoffDate(now) {
    const d = new Date(now || Date.now());
    d.setMonth(d.getMonth() - PB_MONTHS);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  /** Beste gültige Zeit je Sprintstrecke der letzten 18 Monate: { "60": Ergebnis, ... }. */
  function autoPBs(athleteId, resList, now) {
    const cut = cutoffDate(now), best = {};
    (resList || results()).forEach((r) => {
      if (r.athleteId !== athleteId || !isLegal(r) || String(r.date) < cut) return;
      const d = SPRINT_DISTS.find((k) => SPRINT[k] === r.discipline);
      if (!d) return;
      const b = best[d];
      if (!b || r.value < b.value || (r.value === b.value && r.date < b.date)) best[d] = r;
    });
    return best;
  }
  /**
   * Wirksame Werte je Strecke: { "60": { v, src: "auto"|"manual"|"override"|null, auto, manual }, ... }
   * auto = Ergebnis-Datensatz oder null, manual = { v, over } oder null.
   */
  function effectivePBs(athlete, resList, now) {
    const auto = autoPBs(athlete.id, resList, now), out = {};
    SPRINT_DISTS.forEach((d) => {
      const a = auto[d] || null, m = (athlete.manual || {})[d] || null;
      let v = null, src = null;
      if (m && (m.over || !a)) { v = m.v; src = a ? "override" : "manual"; }
      else if (a) { v = a.value; src = "auto"; }
      out[d] = { v, src, auto: a, manual: m };
    });
    return out;
  }
  /** Übernimmt Eingaben aus dem Formular: leer = kein manueller Wert, gleich dem Ergebnis = kein manueller Wert. */
  function setManual(athlete, values, resList) {
    const auto = autoPBs(athlete.id, resList);
    const manual = {};
    SPRINT_DISTS.forEach((d) => {
      const v = values[d];
      if (v == null) return;
      const a = auto[d];
      if (a && Math.abs(a.value - v) < 0.005) return;
      manual[d] = { v, over: !!a };
    });
    athlete.manual = manual;
    return athlete;
  }
  /** Entfernt alle manuellen Werte, für die ein erfasstes Ergebnis existiert. */
  function resetToRecorded(athlete, resList) {
    const auto = autoPBs(athlete.id, resList);
    const manual = {};
    Object.keys(athlete.manual || {}).forEach((d) => { if (!auto[d]) manual[d] = athlete.manual[d]; });
    athlete.manual = manual;
    return athlete;
  }

  /* ---------- Datensicherung ---------- */
  function hash(str) { // FNV-1a, reicht zum Erkennen von Änderungen
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16);
  }
  function tempoSettings() {
    const t = load(KEYS.tempo, {}) || {}, set = {};
    TEMPO_SETTINGS.forEach((k) => { if (typeof t[k] === "number") set[k] = t[k]; });
    return set;
  }
  function fingerprint() {
    return hash(JSON.stringify({ a: load(KEYS.athletes, []), s: tempoSettings(), r: load(KEYS.results, []) }));
  }
  function backupStatus() {
    const m = load(KEYS.meta, {}) || {};
    const c = { athletes: athletes().length, results: results().length };
    const cloud = window.LA && LA.cloud ? LA.cloud.status() : null;
    const cloudSafe = !!(cloud && cloud.loggedIn && cloud.clean);
    return { empty: c.athletes + c.results === 0, upToDate: cloudSafe || m.lastFp === fingerprint(),
      fileUpToDate: m.lastFp === fingerprint(), cloudSafe, lastAt: m.lastAt || null, ...c };
  }
  function markBackedUp() {
    const m = load(KEYS.meta, {}) || {};
    m.lastAt = new Date().toISOString(); m.lastFp = fingerprint();
    save(KEYS.meta, m);
  }

  async function shareOrDownload(name, type, content) {
    const file = new File([content], name, { type });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        return "shared";
      }
    } catch (e) {
      if (e && e.name === "AbortError") return "aborted";
    }
    const url = URL.createObjectURL(file), a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return "downloaded";
  }

  async function exportBackup() {
    const data = { app: "leichtathletik", v: 2, exported: new Date().toISOString(),
      athletes: athletes(), tempoSettings: tempoSettings(), results: results() };
    const name = "leichtathletik-sicherung-" + new Date().toISOString().slice(0, 10) + ".json";
    const res = await shareOrDownload(name, "application/json", JSON.stringify(data, null, 2));
    if (res !== "aborted") markBackedUp();
    return { res, name };
  }

  /* Liest eine Sicherungsdatei (v2, v1 oder alte Sprint-Tempo-Sicherung) in ein einheitliches Format. */
  function parseBackup(text) {
    const d = JSON.parse(text);
    const out = { athletes: [], tempoSettings: {}, results: [] };
    const pickSettings = (src) => { TEMPO_SETTINGS.forEach((k) => { if (src && typeof src[k] === "number") out.tempoSettings[k] = src[k]; }); };
    if (d && d.app === "leichtathletik" && d.v >= 2) {
      out.athletes = (Array.isArray(d.athletes) ? d.athletes : []).map(cleanAthlete).filter(Boolean);
      pickSettings(d.tempoSettings);
      out.results = Array.isArray(d.results) ? d.results : [];
    } else if (d && d.app === "leichtathletik") {
      const t = d.tempo || {};
      out.athletes = (Array.isArray(t.athletes) ? t.athletes : []).map(fromTempoAthlete).filter(Boolean);
      pickSettings(t);
      out.results = Array.isArray(d.results) ? d.results : [];
    } else if (d && d.app === "sprint-tempo" && d.state && Array.isArray(d.state.athletes)) {
      out.athletes = d.state.athletes.map(fromTempoAthlete).filter(Boolean);
      pickSettings(d.state);
    } else throw new Error("format");
    return out;
  }

  function mergeById(current, incoming) {
    const map = new Map(current.map((x) => [x.id, x]));
    let added = 0, updated = 0;
    incoming.forEach((x) => {
      if (!x || typeof x.id !== "string") return;
      const old = map.get(x.id);
      if (!old) { map.set(x.id, x); added++; }
      else if (String(x.updatedAt || "") >= String(old.updatedAt || "")) { map.set(x.id, x); updated++; }
    });
    return { list: [...map.values()], added, updated };
  }

  /* Übernimmt eine Sicherung: Einträge werden zusammengeführt, nichts Vorhandenes gelöscht. */
  function applyBackup(b) {
    const ma = mergeById(athletes(), b.athletes);
    saveAthletes(ma.list);
    if (Object.keys(b.tempoSettings).length) save(KEYS.tempo, Object.assign(load(KEYS.tempo, {}) || {}, b.tempoSettings));
    const mr = mergeById(results(), b.results);
    saveResults(mr.list);
    markBackedUp();
    return { athletes: ma.added + ma.updated, results: mr.added + mr.updated };
  }

  /* ---------- Formatierung ---------- */
  function fmtDate(iso) {
    if (!iso) return "";
    const [y, m, d] = String(iso).slice(0, 10).split("-");
    return d + "." + m + "." + y;
  }
  const fmtTime = (t) => (t == null || !isFinite(t) ? "–" : t.toFixed(2).replace(".", ","));
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const plural = (n, one, many) => n + " " + (n === 1 ? one : many);

  /* ---------- Offline ---------- */
  function registerOffline(root, onState) {
    const set = onState || function () {};
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    if (!("serviceWorker" in navigator) || location.protocol === "file:") { set("Offline-Modus nicht verfügbar"); return; }
    navigator.serviceWorker.register(root + "sw.js", { scope: root }).then((reg) => {
      if (reg.active) set("offline verfügbar");
      navigator.serviceWorker.ready.then(() => set("offline verfügbar"));
    }).catch(() => set("Offline-Modus nicht verfügbar"));
  }

  migrate();
  normalizeStoredDisciplines();

  window.LA = { KEYS, SPRINT, SPRINT_DISTS, PB_MONTHS, load, save, newId, trackDelete, hash, tempoSettings, TEMPO_SETTINGS,
    athletes, saveAthletes, upsertAthlete, deleteAthlete, athleteName,
    results, saveResults, isWindy, isLegal,
    DISCIPLINE_GROUPS, DISC, discOrder, normalizeDiscipline, normalizeStoredDisciplines, better, markUnit, bestMarks, ageClass, resultClass, isIsoDate, exactAge,
    CHAMPIONSHIPS, INTL_CHAMPS, champRank, championships, titles, readTextFile, parseCSV, toCSV, headerIndex, parseDate, importPreview, columnCountWarnings,
    autoPBs, effectivePBs, setManual, resetToRecorded,
    backupStatus, exportBackup, parseBackup, applyBackup, shareOrDownload,
    fmtDate, fmtTime, esc, plural, registerOffline, VERSION: "2.11" };
})();
