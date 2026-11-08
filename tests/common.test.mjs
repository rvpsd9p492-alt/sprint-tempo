// Rechen- und Datenfunktionen aus shared/common.js und shared/ziele.js ohne Oberfläche (eigener Speicher je Lauf).
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

function loadLA(root) {
  const store = {};
  const win = { addEventListener() {}, dispatchEvent() {} };
  const sandbox = { window: win, localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } }, document: {}, navigator: {}, console, TextEncoder, Date, JSON };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, "shared/common.js"), "utf8"), sandbox);
  return { LA: win.LA, store };
}

export default async function (t) {
  const { LA } = loadLA(t.ROOT);
  const pm = (s, k) => { const r = LA.parseMark(s, k); return r.err ? "ERR" : r.mark + "=" + r.value; };
  t.eq("Zeit 11.42", pm("11.42", "t"), "11,42=11.42");
  t.eq("Zeit 1:58,32", pm("1:58,32", "t"), "1:58,32=118.32");
  t.eq("Weite 6,45 m", pm("6,45m", "d"), "6,45=6.45");
  t.eq("Status DNF", LA.parseMark("aufg.", "t").mark, "DNF");
  t.eq("Zeit unlesbar", pm("11,4,2", "t"), "ERR");

  const pg = (s, k) => { const r = LA.parseGoal(s, k); return r.err ? "ERR" : r.mark + "=" + r.value; };
  t.eq("Ziel 11.9x (Zeit: unter 12,00)", pg("11.9x", "t"), "11,9x=11.99");
  t.eq("Ziel 7,6X", pg("7,6X", "t"), "7,6x=7.69");
  t.eq("Ziel 6,4x (Weite: mindestens 6,40)", pg("6,4x", "d"), "6,4x=6.4");
  t.eq("Ziel 11,xx", pg("11,xx", "t"), "11,xx=11.99");
  t.eq("Ziel ohne x", pg("11,85", "t"), "11,85=11.85");
  t.eq("Ziel mit Tausendsteln abgelehnt", pg("11,9xx", "t"), "ERR");

  const nd = (s) => LA.normalizeDiscipline(s);
  t.eq("Disziplin-Kurzformen", [nd("60"), nd("60mH"), nd("4x100"), nd("Kugel"), nd("10000")], ["60 m", "60 m Hürden", "4×100 m", "Kugelstoß", "10.000 m"]);

  const a = { id: "a1", birthYear: 1977, sex: "m", birthDate: "1977-09-15" };
  t.eq("AK nach Jahrgang (DLV)", LA.ageClass(a, "2026-03-01").label, "M45");
  t.eq("AK international nach Geburtstag", LA.ageClass({ ...a, birthYear: 1981, birthDate: "1981-09-15" }, "2026-06-01", true).label, "M40");
  t.eq("AK U20", LA.ageClass({ id: "x", birthYear: 2008, sex: "w" }, "2026-05-01").label, "WJU20");

  const res = [
    { id: "r1", athleteId: "a1", date: "2026-05-01", discipline: "100 m", kind: "t", value: 12.10, wind: 2.5, venue: "outdoor" },
    { id: "r2", athleteId: "a1", date: "2026-05-02", discipline: "100 m", kind: "t", value: 12.20, wind: 1.0, venue: "outdoor" },
    { id: "r3", athleteId: "a1", date: "2026-05-03", discipline: "100 m", kind: "t", value: 12.00, hand: true, venue: "outdoor" },
  ];
  t.eq("Bestleistung ohne Rückenwind > 2,0 und ohne Handzeit", LA.bestMarks(res).get("a1|100 m").id, "r2");
  const eff = LA.effectivePBs({ id: "a1", manual: { "60": { v: 7.7, over: false } } }, res, new Date("2026-10-01"));
  t.eq("Wirksame Bestzeiten (auto + manuell)", [eff["100"].v, eff["100"].src, eff["60"].v, eff["60"].src], [12.2, "auto", 7.7, "manual"]);

  // Ziele & Bestenlisten
  LA.saveProg("ziele", "a1", { goals: [{ year: 2027, disc: "100 m", venue: "", goal: "11,9x" }, { year: 2027, disc: "", goal: "1" }] });
  t.eq("Ziele: ungültige Zeilen verworfen", LA.progFor("ziele", "a1").goals.map((g) => g.goal), ["11,9x"]);
  const id = LA.saveRank({ year: 2026, list: "dlv", ak: "M45", disc: "100 m", venue: "outdoor", entries: [{ r: 2, v: 11.6, m: "11,60" }, { r: 1, v: 11.5, m: "11,50" }] });
  t.eq("Bestenliste: feste id, sortiert", [id, LA.rankLists()[0].entries.map((e) => e.r)], ["2026-dlv-m45-100m-outdoor", [1, 2]]);
  LA.deleteRank(id);
  t.eq("Bestenliste gelöscht + Löschung vorgemerkt", [LA.rankLists().length, LA.load(LA.KEYS.deleted, []).some((x) => x.id === "rang:" + id)], [0, true]);

  // Sicherung: Format v2 mit allen Programmen
  const b = LA.parseBackup(JSON.stringify({ app: "leichtathletik", v: 2, athletes: [{ id: "a9", name: "Test", updatedAt: "2026-01-01T00:00:00Z" }], results: [],
    ziele: { a9: { goals: [{ year: 2026, disc: "60 m", goal: "7,6x" }], updatedAt: "2026-01-01T00:00:00Z" } } }));
  t.eq("Sicherung liest Athleten und Ziele", [b.athletes.length, Object.keys(b.ziele)], [1, ["a9"]]);

  const ics = LA.eventsToICS([LA.cleanEvent({ id: "e1", kind: "wk", name: "Sportfest", date: "2026-06-13", place: "Darmstadt", updatedAt: "2026-01-01T00:00:00Z" })]);
  t.check("Kalender-Export (ICS) enthält Termin", /BEGIN:VEVENT[\s\S]*DTSTART;VALUE=DATE:20260613[\s\S]*END:VCALENDAR/.test(ics), ics.slice(0, 300));
}
