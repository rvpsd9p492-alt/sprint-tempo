// Schnelleingabe eines Ergebnisses, z. B. per Kurzbefehl auf der Apple Watch.
// Aufruf: https://<projekt>.supabase.co/functions/v1/la-result?t=<Watch-Link-Schlüssel>&d=100&z=12,34[&o=halle][&a=Jochen]
// Der geheime Schlüssel ist die Berechtigung (Kurzbefehle können sich nicht anmelden) – deshalb ohne JWT-Prüfung.
// Er darf nur ein handgestopptes Ergebnis über 50–250 m anlegen; Prüfen und Speichern übernimmt die
// Datenbankfunktion la_quick_result. Antwort ist ein kurzer Text für die Uhr.

Deno.serve(async (req: Request) => {
  const text = (s: string, status = 200) =>
    new Response(s, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  if (req.method !== "GET" && req.method !== "POST") return text("Method not allowed", 405);
  const q = new URL(req.url).searchParams;
  const t = q.get("t") ?? "";
  if (!/^[A-Za-z0-9_-]{24,64}$/.test(t)) return text("Fehler: Link ungültig.", 404);
  const base = Deno.env.get("SUPABASE_URL")!, key = Deno.env.get("SUPABASE_ANON_KEY")!;
  const res = await fetch(base + "/rest/v1/rpc/la_quick_result", {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: t, p_dist: q.get("d") ?? "", p_time: q.get("z") ?? "", p_venue: q.get("o"), p_athlete: q.get("a") }),
  });
  if (!res.ok) return text("Fehler: Speichern nicht möglich.", 502);
  const msg = String(await res.json());
  return text(msg, msg.startsWith("Fehler") ? 400 : 200);
});
