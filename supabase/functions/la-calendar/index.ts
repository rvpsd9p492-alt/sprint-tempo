// Kalender-Abo für den Wettkampfkalender der Leichtathletik-App.
// Aufruf: https://<projekt>.supabase.co/functions/v1/la-calendar?t=<geheimer Link-Schlüssel>
// Der Schlüssel ist die Berechtigung (Kalender-Apps können sich nicht anmelden) – deshalb ohne JWT-Prüfung.
// Die Daten liest die Datenbankfunktion la_calendar_feed, die nur die Wettkämpfe zum Schlüssel liefert.
// Muss inhaltlich zu eventsToICS in shared/common.js passen.

type Ev = {
  id: string; kind?: string; champ?: string; name?: string; date: string; endDate?: string | null;
  place?: string; venue?: string; deadline?: string | null; url?: string; note?: string;
};

const KINDS: Record<string, string> = { meet: "Sportfest", champ: "Meisterschaft", other: "Sonstiger Wettkampf" };
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const fmt = (iso: string) => iso.slice(8, 10) + "." + iso.slice(5, 7) + "." + iso.slice(0, 4);
const nextDay = (iso: string) => new Date(Date.parse(iso + "T12:00:00Z") + 864e5).toISOString().slice(0, 10);
const d8 = (iso: string) => iso.replace(/-/g, "");
const txt = (v: unknown) => String(v ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

function fold(line: string): string {
  const enc = new TextEncoder();
  let out = "", cur = "", len = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (len + n > 74) { out += cur + "\r\n "; cur = ""; len = 1; }
    cur += ch; len += n;
  }
  return out + cur;
}

function title(e: Ev): string {
  if (e.name) return e.name;
  const where = e.place ? " " + e.place.split(",")[0] : "";
  if (e.kind === "champ" && e.champ) return e.champ + where;
  return (KINDS[e.kind ?? "meet"] ?? "Wettkampf") + where;
}

function ics(list: Ev[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Leichtathletik-App//Wettkampfkalender//DE", "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH", "X-WR-CALNAME:Wettkämpfe", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H"];
  for (const e of list) {
    if (!isDate(e.date)) continue;
    const t = title(e), end = isDate(e.endDate) && e.endDate > e.date ? e.endDate : e.date;
    const desc = [e.kind === "champ" && e.champ ? e.champ : KINDS[e.kind ?? "meet"] ?? "Wettkampf", e.venue === "indoor" ? "Halle" : "Freiluft"];
    if (isDate(e.deadline)) desc.push("Meldeschluss " + fmt(e.deadline));
    if (e.note) desc.push(e.note);
    L.push("BEGIN:VEVENT", "UID:" + e.id + "@leichtathletik-app", "DTSTAMP:" + stamp,
      "DTSTART;VALUE=DATE:" + d8(e.date), "DTEND;VALUE=DATE:" + d8(nextDay(end)),
      "SUMMARY:" + txt(t), "DESCRIPTION:" + txt(desc.join(" · ")), "TRANSP:TRANSPARENT");
    if (e.place) L.push("LOCATION:" + txt(e.place));
    if (e.url && /^https?:\/\//i.test(e.url)) L.push("URL:" + e.url);
    L.push("END:VEVENT");
    if (isDate(e.deadline)) {
      L.push("BEGIN:VEVENT", "UID:" + e.id + "-meldeschluss@leichtathletik-app", "DTSTAMP:" + stamp,
        "DTSTART;VALUE=DATE:" + d8(e.deadline), "DTEND;VALUE=DATE:" + d8(nextDay(e.deadline)),
        "SUMMARY:" + txt("Meldeschluss: " + t), "DESCRIPTION:" + txt("Wettkampf am " + fmt(e.date)), "TRANSP:TRANSPARENT",
        "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + txt("Meldeschluss morgen: " + t), "TRIGGER:-PT15H", "END:VALARM",
        "END:VEVENT");
    }
  }
  L.push("END:VCALENDAR");
  return L.map(fold).join("\r\n") + "\r\n";
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
  const t = new URL(req.url).searchParams.get("t") ?? "";
  if (!/^[A-Za-z0-9_-]{24,64}$/.test(t)) return new Response("Not found", { status: 404 });
  const base = Deno.env.get("SUPABASE_URL")!, key = Deno.env.get("SUPABASE_ANON_KEY")!;
  const res = await fetch(base + "/rest/v1/rpc/la_calendar_feed", {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: t }),
  });
  if (!res.ok) return new Response("Calendar unavailable", { status: 502 });
  const rows = (await res.json()) as Ev[];
  // Unbekannter Schlüssel und leerer Kalender sehen gleich aus – so lässt sich nichts ausprobieren.
  const body = ics(rows.sort((a, b) => String(a.date).localeCompare(String(b.date))));
  return new Response(req.method === "HEAD" ? null : body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="wettkaempfe.ics"',
      "Cache-Control": "private, max-age=300",
    },
  });
});
