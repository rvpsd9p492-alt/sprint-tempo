// Schnelleingabe eines Trainingslaufs (Sprint-Tempo), z. B. per Kurzbefehl auf der Apple Watch.
// Aufruf mit Zeit:          …/functions/v1/la-result?t=<Watch-Link-Schlüssel>&d=100&z=12,34[&o=tief|fliegend][&a=Jochen]
// Aufruf als Stoppuhr:      …/functions/v1/la-result?t=<Watch-Link-Schlüssel>&d=100&s=<Start>&e=<Stopp>
//   s/e = Millisekunden des Tages (Datumsformat „A“ im Kurzbefehl); die Zeit ist e − s (auch über Mitternacht).
// Der geheime Schlüssel ist die Berechtigung (Kurzbefehle können sich nicht anmelden) – deshalb ohne JWT-Prüfung.
// Er darf nur einen handgestoppten Trainingslauf über 50–250 m anlegen; Prüfen und Speichern übernimmt die
// Datenbankfunktion la_quick_result2. Antwort ist ein kurzer Text für die Uhr, mit Intensität nach dem
// Sprint-Tempo-Modell (muss zu fitModel/refFor/offFor/zone in tempo/index.html passen).

const DAY_MS = 86_400_000;

type Settings = { rt: number; hochPen: number; handStd: number; handFly: number; kExt: number };
const DEF: Settings = { rt: 0.16, hochPen: 0.10, handStd: 0.15, handFly: 0.00, kExt: 1.10 };

/* Geschwindigkeitsmodell nach Hill/Keller (Tibshirani 1997) aus 60/100/200 m – wie fitModel() in der App */
function fitModel(pb: Record<string, number>, S: Settings) {
  const p60 = pb["60"], p100 = pb["100"], p200 = pb["200"], p400 = pb["400"];
  if (!(p60 > 0 && p100 > 0 && p200 > 0)) return null;
  const RT = S.rt, T60 = p60 - RT, T100 = p100 - RT, T200 = p200 - RT;
  if (!(T60 > 0 && T100 > T60 && T200 > T100)) return null;
  const AB = (t: number, tau: number) => { const g = t - tau * (1 - Math.exp(-t / tau)); return [tau * g, tau * tau * g - tau * t * t / 2]; };
  const solve = (tau: number) => {
    const [a1, b1] = AB(T60, tau), [a2, b2] = AB(T100, tau), det = a1 * b2 - a2 * b1;
    const f0 = (60 * b2 - 100 * b1) / det, c = (a1 * 100 - a2 * 60) / det, [a3, b3] = AB(T200, tau);
    return { f0, c, r: f0 * a3 + c * b3 - 200 };
  };
  let lo = 0.2, hi = 6;
  if (!(solve(lo).r > 0 && solve(hi).r < 0)) return null;
  for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (solve(m).r > 0) lo = m; else hi = m; }
  const tau = lo, { f0, c } = solve(tau), K = f0 * tau + c * tau * tau;
  const d = (t: number) => K * (t - tau * (1 - Math.exp(-t / tau))) - c * tau * t * t / 2;
  const k = p400 && p400 > p200 ? Math.log(p400 / p200) / Math.LN2 : S.kExt;
  const tMove = (D: number) => {
    if (D <= 200) { let a = 0, b = T200 + 1; for (let i = 0; i < 70; i++) { const m = (a + b) / 2; if (d(m) < D) a = m; else b = m; } return (a + b) / 2; }
    return p200 * Math.pow(D / 200, k) - RT;
  };
  return { tMove };
}
function intensity(r: { dist: number; value: number; start: string; timing: string; runin: number }, pb: Record<string, number>, S: Settings) {
  const M = fitModel(pb, S);
  if (!M) return null;
  const ref = r.start === "fly" ? M.tMove(r.dist + r.runin) - M.tMove(r.runin) : M.tMove(r.dist) + (r.start === "hoch" ? S.hochPen : 0);
  const off = r.timing === "hand" ? -(r.start === "fly" ? S.handFly : S.handStd) : 0;
  const p = ref / (r.value - off) * 100;
  return Number.isFinite(p) && p > 0 ? p : null;
}
function zone(p: number) {
  if (p < 75) return "Tempo extensiv";
  if (p < 90) return "Mittelzone · submaximal";
  if (p < 95) return "Schnelligkeit submaximal";
  return "Maximalschnelligkeit";
}

Deno.serve(async (req: Request) => {
  const text = (s: string, status = 200) =>
    new Response(s, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  if (req.method !== "GET" && req.method !== "POST") return text("Method not allowed", 405);
  const q = new URL(req.url).searchParams;
  const t = q.get("t") ?? "";
  if (!/^[A-Za-z0-9_-]{24,64}$/.test(t)) return text("Fehler: Link ungültig.", 404);

  let z = q.get("z") ?? "";
  if (!z && (q.has("s") || q.has("e"))) {
    // Stoppuhr-Variante: nur Ziffern zulassen (Kurzbefehle können Tausenderpunkte einfügen)
    const raw = [q.get("s") ?? "", q.get("e") ?? ""].map((v) => v.trim());
    const ok = raw.every((v) => /^\d[\d.\u00a0\u202f ]*$/.test(v));
    const [s, e] = raw.map((v) => Number(v.replace(/\D/g, "")));
    if (!ok || s >= DAY_MS || e >= DAY_MS) {
      return text("Fehler: Start/Stopp nicht lesbar – im Kurzbefehl Datumsformat „A“ prüfen.", 400);
    }
    const ms = (e - s + DAY_MS) % DAY_MS;
    z = (ms / 1000).toFixed(2);
  }

  const base = Deno.env.get("SUPABASE_URL")!, key = Deno.env.get("SUPABASE_ANON_KEY")!;
  const res = await fetch(base + "/rest/v1/rpc/la_quick_result2", {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: t, p_dist: q.get("d") ?? "", p_time: z, p_venue: q.get("o"), p_athlete: q.get("a") }),
  });
  if (!res.ok) return text("Fehler: Speichern nicht möglich.", 502);
  const r = await res.json();
  if (!r || !r.ok) return text(String(r?.msg ?? "Fehler: Speichern nicht möglich."), 400);

  // Intensität: Fehler hier dürfen das (bereits gespeicherte) Ergebnis nicht verdecken
  let line2 = "";
  try {
    const S: Settings = { ...DEF };
    for (const k of Object.keys(DEF) as (keyof Settings)[]) { const v = Number(r.set?.[k]); if (Number.isFinite(v)) S[k] = v; }
    const pb: Record<string, number> = {};
    for (const k of Object.keys(r.pb ?? {})) { const v = Number(r.pb[k]); if (v > 0) pb[k] = v; }
    const p = r.name ? intensity({ dist: r.dist, value: Number(r.value), start: r.start, timing: r.timing, runin: r.runin }, pb, S) : null;
    if (p) line2 = p.toFixed(1).replace(".", ",") + " % · " + (p > 100 ? "schneller als Bestzeit – Messung prüfen" : zone(p));
    else if (r.name) line2 = "Intensität: Bestzeiten 60/100/200 m fehlen";
  } catch (_) { /* nur ohne Prozentwert antworten */ }
  return text(r.msg + (line2 ? "\n" + line2 : ""), 200);
});
