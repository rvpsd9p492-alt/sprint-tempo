// Testlauf: node tests/run.mjs [Filter …]
// Startet einen Webserver für das Repository (http://localhost:8766/sprint-tempo/) und den Supabase-Nachbau (Port 8799),
// führt alle tests/*.test.mjs nacheinander aus und meldet je Prüfung ok/FEHLER. Exit-Code 1 bei Fehlern.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { startMock } from "./mock-supabase.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEB_PORT = 8766, MOCK_PORT = 8799, BASE = `http://localhost:${WEB_PORT}/sprint-tempo/`;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".woff2": "font/woff2", ".svg": "image/svg+xml" };

async function loadPlaywright() {
  for (const m of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"].filter(Boolean)) {
    try { return await import(m.startsWith("/") ? pathToFileURL(m).href : m); } catch (e) { /* nächster Versuch */ }
  }
  throw new Error("Playwright nicht gefunden (npm i -g playwright oder PLAYWRIGHT_MODULE=… setzen)");
}

// Cloud an/aus: shared/config.js wird je nach Test auf den Nachbau umgebogen oder leer ausgeliefert.
const web = { cloud: false };
function startWeb() {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    if (!u.pathname.startsWith("/sprint-tempo/")) { res.writeHead(404); return res.end(); }
    let rel = decodeURIComponent(u.pathname.slice("/sprint-tempo/".length));
    if (rel === "shared/config.js") {
      res.writeHead(200, { "Content-Type": TYPES[".js"], "Cache-Control": "no-store" });
      return res.end(web.cloud ? `window.LA_CLOUD={url:"http://localhost:${MOCK_PORT}",anonKey:"test-anon-key",dbLimitMB:500};` : "window.LA_CLOUD={};");
    }
    if (rel === "" || rel.endsWith("/")) rel += "index.html";
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || rel.split("/").some((s) => s.startsWith(".")) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end("not found");
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((r) => server.listen(WEB_PORT, () => r(server)));
}

const filters = process.argv.slice(2);
const files = fs.readdirSync(path.join(ROOT, "tests")).filter((f) => f.endsWith(".test.mjs") && (!filters.length || filters.some((x) => f.includes(x)))).sort();
const pw = await loadPlaywright();
const [srv, mock] = await Promise.all([startWeb(), startMock(MOCK_PORT)]);
const browser = await pw.chromium.launch();
let fails = 0, checks = 0;

for (const f of files) {
  const mod = await import(pathToFileURL(path.join(ROOT, "tests", f)).href);
  const errors = [], contexts = [];
  const ctx = {
    BASE, ROOT, mock, devices: pw.devices,
    cloud(on) { web.cloud = !!on; },
    /** Neue Seite in frischem Browser-Profil; Seitenfehler werden gesammelt und am Ende geprüft. */
    async page(device = "iPhone 13", opts = {}) {
      const c = await browser.newContext(Object.assign({}, pw.devices[device], { serviceWorkers: "block", timezoneId: "Europe/Berlin", locale: "de-DE" }, opts));
      contexts.push(c);
      const p = await c.newPage();
      p.on("pageerror", (e) => errors.push(e.message));
      p.on("dialog", (d) => d.accept());
      return p;
    },
    /** Daten direkt in localStorage legen (vor dem Laden der eigentlichen Seite). */
    async seed(p, data) {
      await p.goto(BASE + "manifest.webmanifest");
      await p.evaluate((d) => { localStorage.clear(); for (const [k, v] of Object.entries(d)) localStorage.setItem(k, JSON.stringify(v)); }, data);
    },
    check(name, cond, detail) {
      checks++;
      if (cond) console.log("  ok      " + name);
      else { fails++; console.log("  FEHLER  " + name + (detail !== undefined ? "  → " + JSON.stringify(detail) : "")); }
    },
    eq(name, actual, expected) { ctx.check(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected }); },
    shot: (p, name) => p.screenshot({ path: path.join(process.env.SHOTS || "/tmp", name + ".png"), fullPage: true }),
  };
  console.log(f);
  web.cloud = false;
  try { await mod.default(ctx); }
  catch (e) { fails++; console.log("  FEHLER  Abbruch: " + String(e && e.stack || e).split("\n").slice(0, 3).join(" | ")); }
  ctx.check("keine Seitenfehler", errors.length === 0, errors);
  for (const c of contexts) await c.close();
}

await browser.close(); srv.close(); await mock.close();
console.log(`\n${checks - fails}/${checks} Prüfungen ok` + (fails ? `, ${fails} FEHLER` : ""));
process.exit(fails ? 1 : 0);
