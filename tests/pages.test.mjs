// Alle Seiten laden ohne Fehler (hell/dunkel, iPhone/iPad), Version wird angezeigt, Übersicht verlinkt alle Module.
export default async function (t) {
  const pages = ["", "athleten/", "tempo/", "ergebnisse/", "kalender/", "kraft/", "dehnen/"];
  for (const [dev, scheme] of [["iPhone 13", "light"], ["iPad Pro 11", "dark"]]) {
    const p = await t.page(dev, { colorScheme: scheme });
    for (const pg of pages) {
      await p.goto(t.BASE + pg);
      const ver = await p.textContent("#ver").catch(() => "");
      t.check(`${pg || "Übersicht"} lädt (${dev}, ${scheme}), Version ${ver}`, /^\d+\.\d+$/.test(ver.trim()), ver);
      const scroll = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      t.check(`${pg || "Übersicht"} ohne seitliches Scrollen (${dev})`, scroll <= 1, scroll);
    }
  }
  const p = await t.page();
  await p.goto(t.BASE);
  const links = await p.$$eval("a[href]", (l) => l.map((a) => a.getAttribute("href")));
  for (const pg of pages.slice(1)) t.check(`Übersicht verlinkt ${pg}`, links.some((h) => h.replace(/^\.\//, "").startsWith(pg)), links);
  const sw = await (await fetch(t.BASE + "sw.js")).text();
  const assets = JSON.parse(sw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1].replace(/,\s*\]/, "]"));
  const missing = [];
  for (const a of assets) { const r = await fetch(t.BASE + a.replace(/^\.\//, "")); if (!r.ok) missing.push(a); }
  t.eq("alle Offline-Dateien aus sw.js vorhanden", missing, []);
  const common = await (await fetch(t.BASE + "shared/common.js")).text();
  t.check("CACHE in sw.js und VERSION gesetzt", /leichtathletik-v\d+/.test(sw) && /VERSION: "\d+\.\d+"/.test(common));
}
