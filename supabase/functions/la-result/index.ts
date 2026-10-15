// Schnelleingabe eines Trainingslaufs (Sprint-Tempo), z. B. per Kurzbefehl auf der Apple Watch.
// Aufruf mit Zeit:          …/functions/v1/la-result?t=<Watch-Link-Schlüssel>&d=100&z=12,34[&o=tief|fliegend][&a=Jochen]
// Aufruf als Stoppuhr:      …/functions/v1/la-result?t=<Watch-Link-Schlüssel>&d=100&s=<Start>&e=<Stopp>
//   s/e = Millisekunden des Tages (Datumsformat „A“ im Kurzbefehl); die Zeit ist e − s (auch über Mitternacht).
// Der geheime Schlüssel ist die Berechtigung (Kurzbefehle können sich nicht anmelden) – deshalb ohne JWT-Prüfung.
// Er darf nur einen handgestoppten Trainingslauf über 50–250 m anlegen; Prüfen und Speichern übernimmt die
// Datenbankfunktion la_quick_result. Antwort ist ein kurzer Text für die Uhr.

const DAY_MS = 86_400_000;

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
  const res = await fetch(base + "/rest/v1/rpc/la_quick_result", {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: t, p_dist: q.get("d") ?? "", p_time: z, p_venue: q.get("o"), p_athlete: q.get("a") }),
  });
  if (!res.ok) return text("Fehler: Speichern nicht möglich.", 502);
  const msg = String(await res.json());
  return text(msg, msg.startsWith("Fehler") ? 400 : 200);
});
