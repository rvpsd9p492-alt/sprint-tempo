// Edge-Function la-result (Watch-Kurzbefehl) ohne Supabase: Deno und die Datenbankfunktion la_quick_result2 werden
// nachgebildet. Prüft Zeit/Stoppuhr-Auswertung, Fehlertexte und die Intensität (muss zur App passen, siehe tempo.test.mjs).
import path from "node:path";
import { pathToFileURL } from "node:url";

export default async function (t) {
  let handler = null, lastBody = null, rpc = null; const urls = new Set();
  globalThis.Deno = { serve: (h) => { handler = h; }, env: { get: (k) => ({ SUPABASE_URL: "http://db", SUPABASE_ANON_KEY: "anon" })[k] } };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, o) => {
    lastBody = JSON.parse(o.body);
    urls.add(String(url));
    return new Response(JSON.stringify(rpc(lastBody)), { status: 200 });
  };
  try {
    try { await import(pathToFileURL(path.join(t.ROOT, "supabase/functions/la-result/index.ts")).href); }
    catch (e) { t.check("TypeScript laden (Node ≥ 22.18 oder --experimental-strip-types)", false, String(e)); return; }
    const PB = { "60": 7.76, "100": 12.22, "200": 25.42 };
    const ok = (b) => { const v = +String(b.p_time).replace(",", "."); return { ok: true, dist: +b.p_dist, value: v, mark: String(b.p_time).replace(".", ","), start: "hoch",
      timing: "hand", runin: 20, name: "Jochen", pb: PB, set: {}, msg: `Training gespeichert: ${b.p_dist} m in ${String(b.p_time).replace(".", ",")} s (Jochen)` }; };
    const call = async (qs) => { const r = await handler(new Request("http://fn/la-result?" + qs)); return [r.status, await r.text()]; };
    const TOK = "t=" + "a".repeat(32);

    rpc = ok;
    t.eq("60 m 8,2 s → 92,2 %", await call(TOK + "&d=60&z=8,2"), [200, "Training gespeichert: 60 m in 8,2 s (Jochen)\n92,2 % · Schnelligkeit submaximal"]);
    t.eq("100 m 12,9 s → 93,2 %", (await call(TOK + "&d=100&z=12.9"))[1].split("\n")[1], "93,2 % · Schnelligkeit submaximal");
    t.eq("150 m 20,6 s → 88,2 %", (await call(TOK + "&d=150&z=20,6"))[1].split("\n")[1], "88,2 % · Mittelzone · submaximal");
    t.eq("schneller als Bestzeit → Hinweis", (await call(TOK + "&d=100&z=11,5"))[1].split("\n")[1].replace(/^[\d,]+ % · /, ""), "schneller als Bestzeit – Messung prüfen");

    // Stoppuhr-Variante: Millisekunden des Tages, auch mit Tausenderpunkten und über Mitternacht
    await call(TOK + "&d=50&s=80085859&e=80088807"); t.eq("Stoppuhr: e − s", lastBody.p_time, "2.95");
    await call(TOK + "&d=60&s=86.395.000&e=3.200"); t.eq("Stoppuhr über Mitternacht, mit Tausenderpunkten", lastBody.p_time, "8.20");
    t.eq("Stoppuhr unlesbar → 400", (await call(TOK + "&d=60&s=abc&e=1"))[0], 400);

    t.eq("Link-Schlüssel ungültig → 404 ohne Datenbankaufruf", await call("t=kurz&d=60&z=8,2"), [404, "Fehler: Link ungültig."]);
    rpc = () => ({ ok: false, msg: "Fehler: Strecke nicht erlaubt." });
    t.eq("Fehlertext der Datenbank wird durchgereicht", await call(TOK + "&d=70&z=9"), [400, "Fehler: Strecke nicht erlaubt."]);
    rpc = (b) => Object.assign(ok(b), { pb: { "60": 7.76 } });
    t.eq("ohne Bestzeiten: Hinweis statt %", (await call(TOK + "&d=60&z=8,2"))[1].split("\n")[1], "Intensität: Bestzeiten 60/100/200 m fehlen");
    rpc = (b) => Object.assign(ok(b), { name: null, msg: "Training gespeichert: 60 m in 8,2 s (ohne Athlet)" });
    t.eq("ohne Athlet: nur eine Zeile", await call(TOK + "&d=60&z=8,2"), [200, "Training gespeichert: 60 m in 8,2 s (ohne Athlet)"]);
    rpc = ok;
    await call(TOK + "&d=100&z=12,9&o=tief&a=Jochen");
    t.eq("Startart und Athlet werden weitergegeben", [lastBody.p_venue, lastBody.p_athlete], ["tief", "Jochen"]);
    t.eq("ruft nur la_quick_result2 auf", [...urls], ["http://db/rest/v1/rpc/la_quick_result2"]);
  } finally { globalThis.fetch = realFetch; delete globalThis.Deno; }
}
