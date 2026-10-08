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
    return { id: a.id, name: a.name.slice(0, 40), birthYear: Number.isInteger(a.birthYear) ? a.birthYear : null,
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
  function ageClass(athlete, dateIso) {
    if (!athlete || !Number.isInteger(athlete.birthYear) || !dateIso) return null;
    const age = parseInt(String(dateIso).slice(0, 4), 10) - athlete.birthYear;
    if (!(age >= 0 && age < 120)) return null;
    const s = athlete.sex === "w" ? "W" : athlete.sex === "m" ? "M" : "";
    let label, minAge;
    if (age >= 30) { minAge = Math.floor(age / 5) * 5; label = s ? s + minAge : "AK " + minAge; }
    else if (age >= 23) { minAge = 23; label = s === "W" ? "Frauen" : s === "M" ? "Männer" : "Hauptklasse"; }
    else if (age >= 20) { minAge = 20; label = s ? s + "U23" : "U23"; }
    else if (age >= 18) { minAge = 18; label = s ? s + "JU20" : "U20"; }
    else if (age >= 16) { minAge = 16; label = s ? s + "JU18" : "U18"; }
    else { minAge = age; label = s ? s + age : "AK " + age; }
    return { label, minAge, age, masters: age >= 30 };
  }
  /** Altersklasse eines Ergebnisses (oder null, wenn Athlet/Jahrgang fehlt). */
  function resultClass(r, athleteList) {
    const a = (athleteList || athletes()).find((x) => x.id === r.athleteId);
    return a ? ageClass(a, r.date) : null;
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

  window.LA = { KEYS, SPRINT, SPRINT_DISTS, PB_MONTHS, load, save, newId, trackDelete, hash, tempoSettings, TEMPO_SETTINGS,
    athletes, saveAthletes, upsertAthlete, deleteAthlete, athleteName,
    results, saveResults, isWindy, isLegal,
    DISCIPLINE_GROUPS, DISC, discOrder, better, markUnit, bestMarks, ageClass, resultClass,
    autoPBs, effectivePBs, setManual, resetToRecorded,
    backupStatus, exportBackup, parseBackup, applyBackup, shareOrDownload,
    fmtDate, fmtTime, esc, plural, registerOffline, VERSION: "2.5" };
})();
