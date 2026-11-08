// Wettkampfkalender: Wettkampf mit gemeldeten Disziplinen anlegen, .ics-Export, Ergebnisse aus dem Kalender eintragen
// (Abfrage der gemeldeten Disziplinen, „Speichern + weitere Disziplin“, Verknüpfung mit dem Wettkampf).
const iso = (d) => d.toISOString().slice(0, 10);
const days = (n) => iso(new Date(Date.now() + n * 86400000));

export default async function (t) {
  const p = await t.page();
  const now = new Date().toISOString();
  await t.seed(p, { "laAthletes.v1": [{ id: "a1", name: "Jochen", birthYear: 1977, sex: "m", manual: {}, updatedAt: now }] });
  const add = async (o) => {
    await p.goto(t.BASE + "kalender/"); await p.click("#addBtn"); await p.waitForSelector("#viewForm:not([hidden])");
    await p.click(`#iKind [data-v="${o.kind}"]`);
    if (o.champ) await p.selectOption("#iChampSel", o.champ); else await p.fill("#iName", o.name);
    await p.fill("#iDate", o.date); await p.fill("#iPlace", o.place); await p.click('#iVenue [data-v="outdoor"]');
    for (const d of o.discs || []) await p.click(`#iDiscs [data-d="${d}"]`);
    if (o.deadline) await p.fill("#iDeadline", o.deadline);
    await p.click('#form button[type="submit"]'); await p.waitForSelector("#viewList:not([hidden])");
  };
  await add({ kind: "meet", name: "Abendsportfest", date: days(-3), place: "Pfungstadt", discs: ["100 m", "200 m"] });
  await add({ kind: "champ", champ: "Hessische Meisterschaft", date: days(20), place: "Kassel", discs: ["60 m"], deadline: days(10) });
  const EV = await p.evaluate(() => LA.events().map((e) => Object.assign({ title: LA.eventTitle(e) }, e)));
  t.eq("2 Wettkämpfe mit Disziplinen gespeichert", EV.map((e) => [e.title, e.disciplines]).sort(),
    [["Abendsportfest", ["100 m", "200 m"]], ["Hessische Meisterschaft Kassel", ["60 m"]]]);
  t.check("anstehender Wettkampf mit Meldeschluss in der Liste", /Kassel/.test(await p.textContent("#upcoming")) && /Meldeschluss/.test(await p.textContent("#upcoming")), await p.textContent("#upcoming"));

  const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#icsAll")]);
  const ics = Buffer.concat(await (await dl.createReadStream()).toArray()).toString("utf8");
  t.check(".ics enthält nur den anstehenden Wettkampf", /Hessische Meisterschaft/.test(ics) && !/Abendsportfest/.test(ics), ics.slice(0, 300));

  // Ergebnis zum vergangenen Wettkampf
  const ev = EV.find((e) => e.name === "Abendsportfest");
  await p.goto(t.BASE + "ergebnisse/"); await p.evaluate((id) => { location.hash = "#neu/wk/" + id; }, ev.id);
  await p.waitForSelector("#viewForm:not([hidden])");
  t.eq("gemeldete Disziplinen zur Auswahl", await p.$$eval("#evDiscs button", (l) => l.map((x) => x.textContent.trim())), ["100 m", "200 m", "Weitere Disziplin …"]);
  await p.fill("#iMark", "12,40"); await p.click("#fSave");
  t.check("ohne gewählte Disziplin: Hinweis", (await p.textContent("#formErr")).length > 0, await p.textContent("#formErr"));
  await p.click('#evDiscs [data-d="100 m"]'); await p.fill("#iMark", "12,40"); await p.fill("#iWind", "0,8");
  await p.click("#fSaveNext"); await p.waitForTimeout(300);
  t.check("nach „weitere Disziplin“ bleibt das Formular beim Wettkampf", !(await p.isHidden("#viewForm")) && (await p.inputValue("#iEvent")) === ev.id);
  await p.click('#evDiscs [data-d="200 m"]'); await p.fill("#iMark", "25,30"); await p.fill("#iWind", "1,1");
  await p.click("#fSave"); await p.waitForSelector("#viewList:not([hidden])");
  const R = await p.evaluate(() => LA.results());
  t.eq("2 Ergebnisse mit Wettkampf verknüpft (Datum, Ort übernommen)", R.map((r) => [r.discipline, r.eventId, r.date, r.venue]).sort(),
    [["100 m", ev.id, ev.date, "outdoor"], ["200 m", ev.id, ev.date, "outdoor"]]);

  await p.goto(t.BASE + "kalender/"); await p.click("#pastBox summary").catch(() => {});
  t.check("vergangener Wettkampf zeigt eingetragene Ergebnisse", /12,40/.test(await p.textContent("#past")), await p.textContent("#past"));
  await t.shot(p, "kalender");
}
