/* Gemeinsame Funktionen aller Leichtathletik-Module: Speicher, Datensicherung, Offline. */
(function () {
  "use strict";
  const KEYS = { tempo: "sprintTempo.v1", results: "laResults.v1", meta: "laMeta.v1" };
  const TEMPO_SETTINGS = ["rt", "hochPen", "handStd", "handFly", "kExt", "tol"];

  function load(key, def) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : def; } catch (e) { return def; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; }
  }

  /* ---------- Datensicherung ---------- */
  function hash(str) { // FNV-1a, reicht zum Erkennen von Änderungen
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16);
  }
  function fingerprint() {
    const t = load(KEYS.tempo, {}) || {};
    const set = {}; TEMPO_SETTINGS.forEach((k) => (set[k] = t[k]));
    return hash(JSON.stringify({ a: t.athletes || [], s: set, r: load(KEYS.results, []) }));
  }
  function counts() {
    const t = load(KEYS.tempo, {}) || {};
    return { athletes: (t.athletes || []).length, results: (load(KEYS.results, []) || []).length };
  }
  function backupStatus() {
    const m = load(KEYS.meta, {}) || {};
    const c = counts();
    return { empty: c.athletes + c.results === 0, upToDate: m.lastFp === fingerprint(), lastAt: m.lastAt || null, ...c };
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
    const data = { app: "leichtathletik", v: 1, exported: new Date().toISOString(),
      tempo: load(KEYS.tempo, null), results: load(KEYS.results, []) };
    const name = "leichtathletik-sicherung-" + new Date().toISOString().slice(0, 10) + ".json";
    const res = await shareOrDownload(name, "application/json", JSON.stringify(data, null, 2));
    if (res !== "aborted") markBackedUp();
    return { res, name };
  }

  /* Liest eine Sicherungsdatei (neues Format oder alte Sprint-Tempo-Sicherung). */
  function parseBackup(text) {
    const d = JSON.parse(text);
    if (d && d.app === "leichtathletik") {
      return { tempo: d.tempo && typeof d.tempo === "object" ? d.tempo : null, results: Array.isArray(d.results) ? d.results : [] };
    }
    if (d && d.app === "sprint-tempo" && d.state && Array.isArray(d.state.athletes)) {
      return { tempo: d.state, results: [] };
    }
    throw new Error("format");
  }

  function mergeById(current, incoming, newer) {
    const map = new Map(current.map((x) => [x.id, x]));
    let added = 0, updated = 0;
    incoming.forEach((x) => {
      if (!x || typeof x.id !== "string") return;
      const old = map.get(x.id);
      if (!old) { map.set(x.id, x); added++; }
      else if (newer(x, old)) { map.set(x.id, x); updated++; }
    });
    return { list: [...map.values()], added, updated };
  }

  /* Übernimmt eine Sicherung: Einträge werden zusammengeführt, nichts Vorhandenes gelöscht. */
  function applyBackup(b) {
    let athletes = 0, results = 0;
    if (b.tempo && Array.isArray(b.tempo.athletes)) {
      const cur = load(KEYS.tempo, {}) || {};
      const m = mergeById(Array.isArray(cur.athletes) ? cur.athletes : [], b.tempo.athletes, () => true);
      const next = Object.assign({}, cur);
      TEMPO_SETTINGS.forEach((k) => { if (typeof b.tempo[k] === "number") next[k] = b.tempo[k]; });
      next.athletes = m.list;
      if (!next.cur && m.list[0]) next.cur = m.list[0].id;
      save(KEYS.tempo, next);
      athletes = m.added + m.updated;
    }
    if (b.results.length) {
      const m = mergeById(load(KEYS.results, []) || [], b.results,
        (x, old) => String(x.updatedAt || "") >= String(old.updatedAt || ""));
      save(KEYS.results, m.list);
      results = m.added + m.updated;
    }
    markBackedUp();
    return { athletes, results };
  }

  /* ---------- Formatierung ---------- */
  function fmtDate(iso) {
    if (!iso) return "";
    const [y, m, d] = String(iso).slice(0, 10).split("-");
    return d + "." + m + "." + y;
  }
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

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

  window.LA = { KEYS, load, save, backupStatus, exportBackup, parseBackup, applyBackup, shareOrDownload,
    fmtDate, esc, registerOffline, VERSION: "2.0" };
})();
