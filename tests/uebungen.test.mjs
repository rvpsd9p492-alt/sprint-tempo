// Kräftigung und Dehnen (gemeinsame Seite shared/uebungen.js): Kacheln mit Skizze, Disziplin-Filter,
// Favoriten je Athlet, eigene Serien/Wiederholungen, Trainingsmodus mit Verlauf.
export default async function (t) {
  const now = new Date().toISOString();
  for (const [mod, store] of [["kraft", "laKraft.v1"], ["dehnen", "laDehnen.v1"]]) {
    const p = await t.page();
    await t.seed(p, { "laAthletes.v1": [{ id: "a1", name: "Jochen", birthYear: 1977, sex: "m", manual: {}, updatedAt: now }] });
    await p.goto(t.BASE + mod + "/");
    await p.click("#tabAll");
    const all = (await p.$$("#grid .tile")).length;
    t.check(`${mod}: alle Übungen als Kacheln mit Skizze`, all >= 20 && (await p.$$("#grid .tile svg")).length === all, all);
    await p.selectOption("#fDisc", "sprint");
    const sprint = (await p.$$("#grid .tile")).length;
    t.check(`${mod}: Filter Kurzsprint grenzt ein, Schlüsselübungen zuerst`, sprint > 0 && sprint < all && (await p.$eval("#grid .tile", (el) => !!el.querySelector(".key:not(.alt)"))), sprint);
    const opts = await p.$$eval("#fDisc option", (l) => l.map((o) => o.value));
    t.eq(`${mod}: Disziplingruppen`, opts, ["", "sprint", "weit", "kugel", "wurf"]);
    await p.selectOption("#fDisc", "");

    // zwei Favoriten → Mein Programm
    const ids = await p.$$eval("#grid .tile", (l) => l.slice(0, 2).map((x) => x.dataset.id));
    for (const id of ids) await p.click(`#grid [data-fav="${id}"]`);
    await p.click("#tabMine");
    t.eq(`${mod}: Mein Programm mit 2 Übungen`, await p.$$eval("#grid .tile", (l) => l.map((x) => x.dataset.id)), ids);
    t.eq(`${mod}: Favoriten je Athlet gespeichert`, await p.evaluate((k) => JSON.parse(localStorage.getItem(k)).a1.favs, store), ids);

    // Detail: eigene Serien/Wiederholungen
    await p.click(`#grid .tile[data-id="${ids[0]}"]`); await p.waitForSelector("#viewEx:not([hidden])");
    t.check(`${mod}: Detail mit Ausführung und Empfehlung`, (await p.$$("#exSteps li")).length > 0 && /×/.test(await p.textContent("#exDose")));
    await p.click("#ovBox summary"); await p.fill("#oSets", "13"); await p.click("#oSave");
    t.check(`${mod}: Serien > 12 abgelehnt`, /1 bis 12/.test(await p.textContent("#oErr")));
    await p.fill("#oSets", "4"); await p.fill("#oReps", "8–10"); await p.click("#oSave");
    t.check(`${mod}: eigene Dosis übernommen`, /4 × 8–10/.test(await p.textContent("#exDose")), await p.textContent("#exDose"));

    // Trainingsmodus: eine Serie abhaken und beenden → Verlauf
    await p.goto(t.BASE + mod + "/"); await p.click("#tabMine"); await p.click("#startBtn"); await p.waitForSelector("#viewRun:not([hidden])");
    const setBtn = await p.$("#runList button[data-s]");
    if (setBtn) await setBtn.click(); else await p.click("#runList button[data-hold]").catch(() => {});
    await p.click("#tSkip").catch(() => {});
    await p.waitForTimeout(200);
    await p.click("#runDone"); await p.waitForSelector("#viewList:not([hidden])");
    const log = await p.evaluate((k) => JSON.parse(localStorage.getItem(k)).a1.log, store);
    t.check(`${mod}: Einheit im Verlauf`, log.length === 1 && !(await p.isHidden("#histBox")), log);
    await t.shot(p, mod);
  }
}
