// Ziele & Einordnung (#ziele in Wettkampfergebnisse): Ziele je Jahr mit x-Taste, Bestenlisten einfügen (ganze Liste
// oder Eckwerte), berechneter Platz, Rückgriff auf die Liste des Vorjahres.
export default async function (t) {
  const p = await t.page();
  const now = new Date().toISOString();
  const R = (id, date, disc, value, venue, wind) => ({ id, athleteId: "a1", date, discipline: disc, kind: "t", mark: value.toFixed(2).replace(".", ","),
    value, venue, wind: wind ?? null, createdAt: now, updatedAt: now });
  await t.seed(p, {
    "laAthletes.v1": [{ id: "a1", name: "Jochen", birthYear: 1977, sex: "m", manual: {}, updatedAt: now }],
    "laResults.v1": [R("r1", "2026-06-01", "100 m", 12.13, "outdoor", 1.2), R("r2", "2026-07-01", "200 m", 25.01, "outdoor", 0.5),
      R("r3", "2026-02-01", "60 m", 7.74, "indoor"), R("r4", "2025-06-01", "100 m", 12.30, "outdoor", 0.1)],
  });
  await p.goto(t.BASE + "ergebnisse/");
  await p.click("#goalsBtn"); await p.waitForSelector("#viewGoals:not([hidden])");
  await p.selectOption("#gYear", "2027");
  t.eq("Altersklasse im Untertitel", await p.textContent("#gSub"), "Jochen · M50 im Jahr 2027");

  await p.click("#gEditBtn");
  t.eq("Vorschlag 60/100/200 m", await p.$$eval('#gRows [data-f="disc"]', (l) => l.map((s) => s.value)), ["60 m", "100 m", "200 m"]);
  const row = async (i) => (await p.$$("#gRows .grow"))[i];
  const set = async (i, f, v) => { const el = await (await row(i)).$(`[data-f="${f}"]`); if (f === "disc" || f === "venue") await el.selectOption(v); else await el.fill(v); };
  await set(0, "venue", "indoor"); await set(0, "goal", "7.6x"); await set(0, "ultimate", "7,5x");
  // x-Taste (Ziffernblock des iPhones hat kein x)
  await set(1, "goal", "11,9"); await (await (await row(1)).$('[data-f="goal"] + [data-x]')).click();
  await set(1, "ultimate", "11,"); for (let i = 0; i < 2; i++) await (await (await row(1)).$('[data-f="ultimate"] + [data-x]')).click();
  t.eq("x-Taste hängt x an", [await (await (await row(1)).$('[data-f="goal"]')).inputValue(), await (await (await row(1)).$('[data-f="ultimate"]')).inputValue()], ["11,9x", "11,xx"]);
  await set(1, "longterm", "11,85");
  await set(2, "goal", "24,4x");
  await p.click("#gAdd"); await set(3, "disc", "200 m"); await set(3, "goal", "abc");
  await p.click("#gSave");
  t.check("unlesbares Ziel wird gemeldet", /Ziel:/.test(await (await (await row(3)).$('[data-f="err"]')).textContent()));
  await (await (await row(3)).$("[data-del]")).click();
  await p.click("#gSave");
  const cards = await p.$$eval(".gcard", (l) => l.map((x) => x.innerText.replace(/\s*\n\s*/g, " | ")));
  t.eq("3 Zielkarten", cards.length, 3);
  t.check("Karte 100 m: PB, Ziel, Langfristig, Ultimate", /100 M \| PB 12,13 M45.*11,9x \| Langfristig 11,85.*ULTIMATE \| 11,xx/i.test(cards[1]), cards[1]);
  t.eq("Hauptziel groß (100 m)", await p.textContent(".ghv"), "11,9x");

  // Bestenlisten für 2026
  await p.selectOption("#gYear", "2026");
  const addList = async (list, disc, text) => {
    await p.click("#rAdd"); await p.click(`#rList [data-v="${list}"]`); await p.selectOption("#rDisc", disc); await p.selectOption("#rVenue", "outdoor");
    await p.fill("#rText", text); const prev = await p.textContent("#rPrev"); await p.click("#rSave"); return prev;
  };
  const full = ["1. Max Muster 1977 LG X 11,56 +0,8 12.05.2026", "2 Peter P 1976 11,60 +1,1"];
  [11.61, 11.65, 11.70, 11.80, 11.90, 12.00, 12.13, 12.20].forEach((v, i) => full.push(`${i + 3} N${i} ${v.toFixed(2).replace(".", ",")} −0,3`));
  t.eq("ganze Liste: Namen, Wind, Datum ignoriert", await addList("dlv", "100 m", full.join("\n")),
    "10 Einträge erkannt (vollständige Liste) · Platz 1: 11,56 · Platz 10: 12,20");
  t.eq("Eckwerte erkannt", await addList("wma", "100 m", "10: 11,56\n30: 11,77\n50: 11,88"), "3 Einträge erkannt (Eckwerte) · Platz 10: 11,56 · Platz 50: 11,88");
  t.eq("Platz berechnet (gleiche Zeit = gleicher Platz)", await p.textContent(".gsh span"), "2026 · M45 · DLV #9 · WMA > Top 50");
  t.check("Achse mit Markern SB und Ziel", (await p.$$(".gaxis circle")).length === 2 && /SB 2026 · 12,13/.test(await p.textContent(".gaxis")) && /Ziel 2027 · 11,9x/.test(await p.textContent(".gaxis")),
    await p.textContent(".gaxis"));
  await t.shot(p, "ziele-2026");

  // 2027: noch keine Liste → Liste 2026, Hinweis
  await p.selectOption("#gYear", "2027");
  t.check("2027 nutzt die Liste 2026 mit Hinweis", /noch keine Liste/.test(await p.textContent(".gstand")), await p.textContent(".gstand"));
  // 2025: AK M45, keine Liste aus 2025 oder früher
  await p.selectOption("#gYear", "2025");
  t.eq("2025 ohne Liste", (await p.$$(".gstand")).length, 0);

  // Liste bearbeiten und löschen
  await p.selectOption("#gYear", "2026");
  await p.click('[data-redit="2026-wma-m45-100m-outdoor"]');
  t.check("Bearbeiten zeigt die gespeicherten Einträge", /10\. 11,56/.test(await p.inputValue("#rText")));
  await p.click("#rDel"); await p.click("#rDel");
  t.eq("WMA-Liste gelöscht", await p.evaluate(() => LA.rankLists().map((l) => l.id)), ["2026-dlv-m45-100m-outdoor"]);

  await p.click("#gBack"); await p.waitForSelector("#viewList:not([hidden])");
  t.check("Kurzinfo auf dem Einstieg", /Ziele 2027: 60 m 7,6x · 100 m 11,9x/.test(await p.textContent("#goalsSum")), await p.textContent("#goalsSum"));
}
