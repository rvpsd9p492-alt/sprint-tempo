// Athlet anlegen, Ergebnisse erfassen/bearbeiten/löschen, Bestleistungen, Filter, CSV-Export und -Import.
export default async function (t) {
  const p = await t.page();
  await t.seed(p, {});
  const open = async (page, hash) => { // wie in der App: erst Liste, dann Formular (Speichern springt zurück)
    await p.goto(t.BASE + page); await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForSelector("#viewForm:not([hidden])"); };
  await open("athleten/", "#neu");
  await p.fill("#iName", "Jochen"); await p.fill("#iYear", "1977"); await p.click('#iSex [data-v="m"]');
  t.check("Altersklasse wird beim Anlegen angezeigt", /M4[05]/.test(await p.textContent("#akInfo")), await p.textContent("#akInfo"));
  await p.click('#form button[type="submit"]');
  await p.waitForSelector("#viewList:not([hidden])");
  const ath = await p.evaluate(() => LA.athletes());
  t.eq("Athlet gespeichert", ath.map((a) => [a.name, a.birthYear, a.sex]), [["Jochen", 1977, "m"]]);

  // Pflichtfeld Geschlecht
  await open("athleten/", "#neu"); await p.fill("#iName", "Ohne"); await p.click('#form button[type="submit"]');
  t.check("Geschlecht ist Pflicht", (await p.textContent("#formErr")).length > 0);

  const add = async (o) => {
    await open("ergebnisse/", "#neu");
    await p.fill("#iDate", o.date); await p.click(`#iVenue [data-v="${o.venue}"]`); await p.selectOption("#iDisc", o.disc);
    await p.fill("#iMark", o.mark); if (o.wind) await p.fill("#iWind", o.wind);
    if (o.champ) await p.selectOption("#iChampSel", o.champ);
    if (o.place) await p.fill("#iPlace", o.place);
    await p.click("#fSave"); await p.waitForSelector("#viewList:not([hidden])");
  };
  await add({ date: "2026-06-01", venue: "outdoor", disc: "100 m", mark: "12,13", wind: "1,2" });
  await add({ date: "2026-06-20", venue: "outdoor", disc: "100 m", mark: "11,98", wind: "2,4" });
  await add({ date: "2026-07-05", venue: "outdoor", disc: "200 m", mark: "25,01", wind: "0,5", champ: "Hessische Meisterschaft", place: "2" });
  await add({ date: "2025-02-01", venue: "indoor", disc: "60 m", mark: "7.74" });
  let R = await p.evaluate(() => LA.results());
  t.eq("4 Ergebnisse gespeichert, Zeit normalisiert", R.map((r) => r.mark).sort(), ["11,98", "12,13", "25,01", "7,74"]);
  t.check("Ergebnisse dem einzigen Athleten zugeordnet", R.every((r) => r.athleteId === ath[0].id));

  const pb = await p.textContent("#pbTable");
  t.check("PB 100 m ohne Rückenwind > 2,0 (12,13 statt 11,98)", pb.includes("12,13") && !pb.includes("11,98"), pb);
  t.check("Liste zeigt Rückenwind-Warnung", (await p.$$(".res .wa")).length >= 1);

  await p.selectOption("#fYear", "2025");
  t.eq("Filter Jahr 2025", await p.$$eval("#list .res .disc", (l) => l.map((x) => x.textContent.trim())), ["60 m"]);
  await p.click("#fReset");
  t.eq("Filter zurückgesetzt", (await p.$$("#list .res")).length, 4);

  // Bearbeiten und Löschen
  const id = R.find((r) => r.mark === "11,98").id;
  await open("ergebnisse/", "#bearbeiten/" + id);
  await p.fill("#iWind", "1,0"); await p.click("#fSave"); await p.waitForSelector("#viewList:not([hidden])");
  t.check("bearbeitet: 11,98 jetzt Bestleistung", (await p.textContent("#pbTable")).includes("11,98"));
  await open("ergebnisse/", "#bearbeiten/" + id);
  await p.click("#fDel"); await p.click("#fDel"); await p.waitForSelector("#viewList:not([hidden])");
  R = await p.evaluate(() => LA.results());
  t.check("gelöscht und Löschung für die Cloud vorgemerkt", R.length === 3 && (await p.evaluate((i) => LA.load(LA.KEYS.deleted, []).some((x) => x.id === i), id)));

  // CSV-Export und Re-Import (gleiche Spalten), Duplikate übersprungen
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#csv")]);
  const csv = await (await dl.createReadStream()).toArray().then((c) => Buffer.concat(c).toString("utf8"));
  t.check("CSV-Export mit Kopfzeile und 3 Zeilen", /Athlet;.*Datum;Disziplin/.test(csv) && csv.trim().split(/\r?\n/).length === 4, csv.slice(0, 200));
  const extra = csv.trim() + "\r\nJochen;M45;12.06.2026;400 m;Freiluft;58,20;s;;;;;;;\r\n";
  await p.setInputFiles("#csvFile", { name: "imp.csv", mimeType: "text/csv", buffer: Buffer.from(extra, "utf8") });
  await p.waitForSelector("#impBox:not([hidden])");
  t.check("Import-Vorschau: 1 neues Ergebnis", /1 Ergebnis importieren/.test(await p.textContent('#impBox [data-act="go"]')), await p.textContent("#impBox"));
  await p.click('#impBox [data-act="go"]');
  await p.waitForTimeout(300);
  R = await p.evaluate(() => LA.results());
  t.eq("CSV-Import: nur neue Zeile übernommen", R.map((r) => r.discipline).sort(), ["100 m", "200 m", "400 m", "60 m"]);

  t.check("Titel: Platz 2 Hessische Meisterschaft", (await p.evaluate((a) => LA.titles(a).map((r) => r.champ + " " + r.place), ath[0].id)).join() === "Hessische Meisterschaft 2");
  await t.shot(p, "ergebnisse-liste");
}
