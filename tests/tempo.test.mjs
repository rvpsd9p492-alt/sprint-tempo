// Sprint-Tempo: Intensität aus gestoppter Zeit (gleiche Werte wie die Watch-Antwort, siehe la-result.test.mjs),
// Trainingslauf speichern, „Letzter Lauf“ auf der Tafel, Watch-Anleitung mit Kopierlisten.
export default async function (t) {
  const p = await t.page("iPhone 13", { permissions: ["clipboard-read", "clipboard-write"] });
  const now = new Date().toISOString();
  await t.seed(p, { "laAthletes.v1": [{ id: "a1", name: "Jochen", birthYear: 1977, sex: "m", updatedAt: now,
    manual: { "60": { v: 7.76, over: false }, "100": { v: 12.22, over: false }, "200": { v: 25.42, over: false } } }] });
  await p.goto(t.BASE + "tempo/");
  t.check("Bestzeiten werden angezeigt", /7,76/.test(await p.textContent("#pbTable")) && /25,42/.test(await p.textContent("#pbTable")), await p.textContent("#pbTable"));
  t.check("ohne Lauf kein „Letzter Lauf“", await p.isHidden("#bLast"));

  const pct = async (dist, start, timing, time) => {
    await p.click(`#dist [data-v="${dist}"]`); await p.click(`#start [data-v="${start}"]`); await p.click(`#timing [data-v="${timing}"]`);
    await p.fill("#ran", time); return (await p.textContent("#ranOut")).trim();
  };
  // gleiche Fälle wie die Watch-Antwort (Hochstart, Hand)
  t.eq("60 m 8,2 s Hochstart/Hand", await pct("60", "hoch", "hand", "8,2"), "92,2 %");
  t.eq("100 m 12,9 s Hochstart/Hand", await pct("100", "hoch", "hand", "12,9"), "93,2 %");
  t.eq("150 m 20,6 s Hochstart/Hand", await pct("150", "hoch", "hand", "20,6"), "88,2 %");
  const fast = await pct("100", "block", "elec", "12,00");
  t.check("schneller als Bestzeit > 100 %", parseFloat(fast.replace(",", ".")) > 100, fast);

  // Trainingslauf speichern
  await pct("60", "hoch", "hand", "8,2"); await p.click("#ranSave");
  const runs = await p.evaluate(() => LA.runs());
  t.eq("Lauf gespeichert", runs.map((r) => [r.dist, r.value, r.start, r.timing, r.athleteId]), [[60, 8.2, "hoch", "hand", "a1"]]);
  t.check("Lauf in der Liste mit % und Uhrzeit", /92,2\s*%/.test(await p.textContent("#runsList")) && /\d{1,2}:\d{2}/.test(await p.textContent("#runsList")), await p.textContent("#runsList"));
  t.check("„Letzter Lauf“ auf der Tafel", !(await p.isHidden("#bLast")) && /60 m/.test(await p.textContent("#bLast")), await p.textContent("#bLast"));
  const order = await p.evaluate(() => { const a = document.getElementById("runsBox"), b = document.getElementById("modelBox"); return !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING); });
  t.check("Trainingsläufe stehen über „Modell und Annahmen“", order);
  await p.click(`#dist [data-v="100"]`); await p.click("#bLast");
  t.eq("Antippen übernimmt Strecke des letzten Laufs", await p.getAttribute('#dist [data-v="60"]', "aria-pressed"), "true");

  // Watch-Anleitung: Kopierlisten für die Listen-Eingabe
  await p.click("#watchBox summary");
  await p.click('[data-copy="sec"]'); const sec = (await p.evaluate(() => navigator.clipboard.readText())).split("\n");
  t.eq("Sekundenliste 5–50", [sec.length, sec[0], sec.at(-1)], [46, "5", "50"]);
  await p.click('[data-copy="ten"]');
  t.eq("Zehntelliste 0–9", (await p.evaluate(() => navigator.clipboard.readText())).split("\n").join(""), "0123456789");
  t.check("ohne Cloud-Anmeldung kein Watch-Link", /anmelden|Cloud/i.test(await p.textContent("#wLink")), await p.textContent("#wLink"));
  await t.shot(p, "tempo");
}
