// Cloud-Sicherung gegen den Supabase-Nachbau: Konto anlegen, Abgleich zwischen zwei Geräten (Athlet, Ergebnis, Lauf,
// Ziele, Bestenliste), Löschungen, „neuere Änderung gewinnt“, Fehlermeldungen, Kalender- und Watch-Link.
export default async function (t) {
  t.cloud(true);
  const synced = (p) => p.waitForFunction(() => { const x = LA.cloud.status(); return !x.syncing && x.pending === 0 && x.lastSyncAt; }, null, { timeout: 15000 });
  const until = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 30000 }).then(() => true, () => false);
  const now = new Date().toISOString(), email = "t" + Date.now() + "@example.com";

  const A = await t.page("iPhone 13");
  await t.seed(A, { "laAthletes.v1": [{ id: "a1", name: "Jochen", birthYear: 1977, sex: "m", manual: {}, updatedAt: now }] });
  await A.goto(t.BASE);
  await A.fill("#cEmail", email); await A.fill("#cPw", "kurz"); await A.click("#cUp");
  t.check("zu kurzes Passwort wird erklärt", /mindestens 8/.test(await A.textContent("#cMsg")), await A.textContent("#cMsg"));
  await A.fill("#cPw", "geheim123"); await A.click("#cUp"); await synced(A);
  t.check("angemeldet, lokale Daten hochgeladen", (await A.textContent("#cWho")).includes(email) && t.mock.rows(email).some((r) => r.kind === "athlete"));

  await A.evaluate(() => {
    LA.saveResults([{ id: "r1", athleteId: "a1", date: "2026-06-01", discipline: "100 m", kind: "t", mark: "12,13", value: 12.13, venue: "outdoor", wind: 1.2,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]);
    LA.saveRuns([{ id: "w1", athleteId: "a1", date: "2026-06-02", dist: 60, value: 8.2, mark: "8,2", start: "hoch", timing: "hand", runin: 20, source: "app" }]);
    LA.saveProg("ziele", "a1", { goals: [{ year: 2027, disc: "100 m", venue: "", goal: "11,9x" }] });
    LA.saveRank({ year: 2026, list: "dlv", ak: "M45", disc: "100 m", venue: "outdoor", entries: [{ r: 10, v: 11.67, m: "11,67" }] });
  });
  await A.goto(t.BASE + "ergebnisse/"); await synced(A);
  const kinds = t.mock.rows(email).map((r) => r.kind + ":" + r.id.split(":")[0]).sort();
  t.check("alle Datenarten in der Cloud", ["result:r1", "settings:run", "settings:ziele", "settings:rang", "settings:tempo"].every((k) => kinds.includes(k)), kinds);

  // zweites Gerät
  const B = await t.page("iPad Pro 11");
  await t.seed(B, {});
  await B.goto(t.BASE);
  await B.fill("#cEmail", email); await B.fill("#cPw", "falsch999"); await B.click("#cIn");
  await until(B, () => !/warten/.test(document.getElementById("cMsg").textContent));
  t.check("falsches Passwort wird erklärt", /E-Mail oder Passwort falsch/.test(await B.textContent("#cMsg")), await B.textContent("#cMsg"));
  await B.fill("#cPw", "geheim123"); await B.click("#cIn"); await synced(B);
  const got = await B.evaluate(() => ({ a: LA.athletes().map((x) => x.name), r: LA.results().map((x) => x.mark), n: LA.runs().map((x) => x.mark),
    z: LA.progFor("ziele", "a1").goals.map((g) => g.goal), g: LA.rankLists().map((l) => l.id) }));
  t.eq("zweites Gerät hat alles", got, { a: ["Jochen"], r: ["12,13"], n: ["8,2"], z: ["11,9x"], g: ["2026-dlv-m45-100m-outdoor"] });

  // Änderung auf B, Löschung auf B → A übernimmt beim nächsten Abgleich
  await B.evaluate(() => { const r = LA.results(); r[0].mark = "12,03"; r[0].value = 12.03; r[0].updatedAt = new Date().toISOString(); LA.saveResults(r);
    LA.deleteRank("2026-dlv-m45-100m-outdoor"); LA.saveRuns([]); LA.trackDelete("settings", "run:w1"); });
  await B.goto(t.BASE + "ergebnisse/"); await synced(B);
  await A.goto(t.BASE + "ergebnisse/");
  t.check("Änderung und Löschungen kommen auf Gerät A an",
    await until(A, () => LA.results()[0] && LA.results()[0].mark === "12,03" && LA.rankLists().length === 0 && LA.runs().length === 0));

  // ältere Änderung darf neuere nicht überschreiben
  await A.evaluate(() => { const r = LA.results(); r[0].mark = "12,99"; r[0].value = 12.99; r[0].updatedAt = "2020-01-01T00:00:00.000Z"; LA.saveResults(r); });
  await A.goto(t.BASE + "ergebnisse/"); await synced(A);
  t.eq("neuere Änderung gewinnt in der Cloud", t.mock.rows(email).find((r) => r.id === "r1").data.mark, "12,03");

  // Kalender-Abo und Watch-Link
  await A.goto(t.BASE + "kalender/"); await A.click("#aboMake"); await A.waitForSelector("#aboUrl");
  t.check("Kalender-Abo-Link erzeugt", /^(https?|webcal):\/\/localhost:8799\/functions\/v1\/la-calendar\?t=[\w-]{24,}$/.test((await A.textContent("#aboUrl")).trim()), await A.textContent("#aboUrl"));
  await A.goto(t.BASE + "tempo/"); await A.click("#watchBox summary"); await A.click("#wMake"); await A.waitForSelector("#wUrl");
  t.check("Watch-Link erzeugt", /\/functions\/v1\/la-result\?t=[\w-]{24,}/.test(await A.textContent("#wUrl")), await A.textContent("#wUrl"));
  const pct = await until(A, () => /Trainingsl/.test(document.getElementById("runsHead").textContent));
  t.check("Sprint-Tempo zeigt Trainingsläufe-Bereich", pct);
  t.cloud(false);
}
