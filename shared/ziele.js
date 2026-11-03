/* Ziele & Einordnung (Ansicht #ziele in Wettkampfergebnisse):
   Ziele je Athlet und Jahr (manuell, auch "11,9x") und Einordnung der Jahresbestleistung in DLV- und WMA-Bestenlisten
   der Altersklasse. Bestenlisten werden manuell eingefügt (vollständige Liste oder Eckwerte wie Platz 10/30/50). */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id), esc = LA.esc;
  const VKEY = "laZiele.view";
  const KIND = (d) => (LA.DISC.has(d) ? LA.DISC.get(d).kind : "t");
  const venueTxt = (v) => (v === "indoor" ? "Halle" : v === "outdoor" ? "Freiluft" : "");
  const discTxt = (d, v) => d + (v === "indoor" ? " Halle" : "");
  const LIST_TXT = { dlv: "Deutschland (DLV)", wma: "Welt (WMA)" };
  let V = Object.assign({ ath: "", year: 0 }, (() => { try { return LA.load(VKEY, {}) || {}; } catch (e) { return {}; } })());
  let ATH = [], R = [], editGoals = false, rankEdit = null;

  /* ---------- Werte ---------- */
  const fmt = (v, kind) => {
    if (kind === "p") return String(Math.round(v));
    if (kind === "t" && v >= 60) { const m = Math.floor(v / 60), s = v - m * 60; return m + ":" + (s < 10 ? "0" : "") + s.toFixed(2).replace(".", ","); }
    return v.toFixed(2).replace(".", ",");
  };
  const better = (kind, a, b) => (kind === "t" ? a < b : a > b);
  const atLeast = (kind, a, b) => (kind === "t" ? a <= b + 1e-9 : a >= b - 1e-9); // a mindestens so gut wie b
  const athlete = () => ATH.find((a) => a.id === V.ath) || null;
  function akFor(a, y) { // Altersklasse(n) im Jahr y: DLV (Jahrgang) und international (Alter zur Jahresmitte)
    if (!a) return [];
    const d = LA.ageClass(a, y + "-12-31", false), w = LA.ageClass(a, y + "-07-01", true);
    return [...new Set([d && d.label, w && w.label].filter(Boolean))];
  }
  const akMain = (a, y) => akFor(a, y)[0] || "";
  function marks(aid, opts) { // gültige Ergebnisse (ohne Rückenwind > 2,0 und Handzeit)
    return R.filter((r) => r.athleteId === aid && LA.isLegal(r) && r.discipline === opts.disc
      && (!opts.venue || r.venue === opts.venue) && (!opts.year || r.date.slice(0, 4) === String(opts.year))
      && (!opts.ak || (LA.resultClass(r, ATH) || {}).label === opts.ak));
  }
  function bestOf(list, kind) { let b = null; list.forEach((r) => { if (!b || better(kind, r.value, b.value)) b = r; }); return b; }
  const goalsAll = (aid) => (aid ? LA.progFor("ziele", aid).goals : []);

  /* ---------- Bestenlisten lesen ---------- */
  const MARK_RE = { t: /^((?:\d{1,2}:)?\d{1,2}[.,]\d{1,3})[a-zA-Z*]?$/, d: /^(\d{1,3}[.,]\d{1,2})[a-zA-Z*]?$/, p: /^(\d{3,5})$/ };
  /** Text → [{ r, v, m }]: eine Zeit je Zeile (Rang davor optional) oder mehrere Zeiten je Zeile; Rest der Zeile (Name, Wind, Datum) wird ignoriert. */
  function parseRankText(text, kind) {
    const out = [], warn = [];
    let seq = 0;
    const read = (tok) => {
      const m = tok.match(MARK_RE[kind] || MARK_RE.t); if (!m) return null;
      const p = LA.parseMark(m[1], kind);
      return p.value != null && !(kind === "t" && p.value < 4) ? p : null;
    };
    String(text || "").split(/\r?\n/).forEach((line, li) => {
      const t = line.trim(); if (!t) return;
      const toks = t.split(/[\s;]+/).filter(Boolean);
      const all = toks.map(read);
      if (all.every(Boolean)) { all.forEach((p) => { seq++; out.push({ r: seq, v: p.value, m: p.mark }); }); return; }
      const rm = t.match(/^(?:platz\s*|top\s*|#)?(\d{1,4})\s*[.:)]?(?=\s)/i);
      const rest = rm ? t.slice(rm[0].length) : t;
      const p = rest.split(/[\s;]+/).filter(Boolean).filter((x) => !/^[+\-−]/.test(x)).map(read).find(Boolean);
      if (!p) { warn.push("Zeile " + (li + 1) + " ohne erkennbares Ergebnis"); return; }
      const r = rm ? +rm[1] : seq + 1; seq = Math.max(seq, r);
      out.push({ r, v: p.value, m: p.mark });
    });
    out.sort((a, b) => a.r - b.r);
    for (let i = 1; i < out.length; i++) if (better(kind, out[i].v, out[i - 1].v)) { warn.push("Reihenfolge prüfen bei Platz " + out[i].r); break; }
    return { entries: out, warn };
  }
  const complete = (e) => e.length > 0 && e[0].r === 1 && e.every((x, i) => x.r <= i + 1);
  /** Platz einer Leistung in der Liste: vollständige Liste → "#12", Eckwerte → "Top 30". */
  function rankOf(L, v, kind) {
    const e = L.entries, last = e[e.length - 1];
    if (complete(e)) {
      if (!atLeast(kind, v, last.v)) return { txt: "> #" + last.r, n: null };
      const n = e.filter((x) => better(kind, x.v, v)).length + 1;
      return { txt: "#" + n, n };
    }
    const hit = e.find((x) => atLeast(kind, v, x.v));
    if (!hit) return { txt: "> Top " + last.r, n: null };
    return hit.r === 1 ? { txt: "#1", n: 1 } : { txt: "Top " + hit.r, n: null };
  }
  /** Markierungen auf der Achse: bei vollständigen Listen Platz 1/10/20/30/50/100, sonst alle Eckwerte. */
  function ticksOf(L) {
    const e = L.entries;
    if (!complete(e)) return e.slice(0, 6);
    let c = [1, 10, 20, 30, 50, 100].filter((n) => n <= e.length);
    if (c.length > 4) c = c.filter((n) => n !== 20);
    if (c.length > 4) c = c.filter((n) => n !== 1);
    const t = c.map((n) => e[n - 1]);
    if (e.length < 10 || (e.length > c[c.length - 1] && c.length < 4 && e.length <= 100)) t.push(e[e.length - 1]);
    return [...new Map(t.map((x) => [x.r, x])).values()];
  }
  /** Listen für eine Disziplin im Jahr y (Altersklasse des Athleten); ohne Listen in y: das letzte Jahr davor mit Listen. */
  function listsFor(a, y, disc, venue) {
    const all = LA.rankLists().filter((l) => l.disc === disc && l.venue === venue && l.year <= y);
    const years = [...new Set(all.map((l) => l.year))].sort((p, q) => q - p);
    for (const yy of years) {
      const aks = akFor(a, yy), hit = all.filter((l) => l.year === yy && (!aks.length || aks.includes(l.ak)));
      if (hit.length) return { year: yy, lists: hit };
    }
    return null;
  }

  /* ---------- Darstellung ---------- */
  function years(a) {
    const now = new Date().getFullYear(), s = new Set([now, now + 1]);
    if (a) { R.forEach((r) => { if (r.athleteId === a.id) s.add(+r.date.slice(0, 4)); }); goalsAll(a.id).forEach((g) => s.add(g.year)); }
    LA.rankLists().forEach((l) => s.add(l.year));
    return [...s].filter((y) => y > 1950).sort((p, q) => q - p);
  }
  function render() {
    ATH = LA.athletes(); R = LA.results();
    const box = $("viewGoals");
    if (!ATH.length) { $("gBody").innerHTML = '<p class="empty">Zuerst einen Athleten anlegen (Übersicht → Athleten).</p>'; $("gAth").innerHTML = ""; $("gYear").innerHTML = ""; return; }
    if (!athlete()) V.ath = ATH[0].id;
    const a = athlete(), ys = years(a);
    if (!ys.includes(V.year)) V.year = new Date().getFullYear();
    try { LA.save(VKEY, V); } catch (e) { /* nur Komfort */ }
    $("gAth").innerHTML = ATH.map((x) => '<option value="' + esc(x.id) + '"' + (x.id === a.id ? " selected" : "") + ">" + esc(x.name) + "</option>").join("");
    $("gAth").closest("div").hidden = ATH.length < 2;
    $("gYear").innerHTML = ys.map((y) => '<option value="' + y + '"' + (y === V.year ? " selected" : "") + ">" + y + "</option>").join("");
    const ak = akMain(a, V.year);
    $("gSub").textContent = a.name + (ak ? " · " + ak + " im Jahr " + V.year : " · Jahrgang fehlt – Altersklasse unbekannt");
    box.querySelector("#gBody").innerHTML = targetsHtml(a) + standHtml(a);
    if (editGoals) $("gEdit").innerHTML = goalEditorHtml(a);
    if (rankEdit) { $("rEdit").innerHTML = rankEditorHtml(a); updRankPreview(); }
    drawAxes();
  }

  /* --- Ziele --- */
  function targetsHtml(a) {
    const y = V.year, gs = goalsAll(a.id).filter((g) => g.year === y).sort((p, q) => LA.discOrder(p.disc) - LA.discOrder(q.disc) || p.venue.localeCompare(q.venue));
    const ak = akMain(a, y);
    let h = '<section class="gsec"><div class="ghead"><h2>Ziele ' + y + '</h2><button class="btn" id="gEditBtn" type="button">' + (editGoals ? "Schließen" : gs.length ? "Bearbeiten" : "+ Ziele") + "</button></div>";
    if (!gs.length && !editGoals) h += '<p class="note">Noch keine Ziele für ' + y + ". Ziele lassen sich auch ungefähr angeben: „11,9x“ heißt irgendwas unter 12,00.</p>";
    if (gs.length) {
      const hero = gs.find((g) => g.disc === "100 m") || gs[0], hk = KIND(hero.disc);
      h += '<div class="ghero"><div class="ghk">Ziel ' + y + "</div><div class=\"ghrow\"><span class=\"ghv\">" + esc(hero.goal) + '</span><span class="ghd">' + esc(discTxt(hero.disc, hero.venue)) + "</span></div></div>";
      h += '<div class="gcards">' + gs.map((g) => {
        const k = KIND(g.disc), gv = LA.parseGoal(g.goal, k), pb = ak ? bestOf(marks(a.id, { disc: g.disc, venue: g.venue, ak }), k) : null;
        const sbY = bestOf(marks(a.id, { disc: g.disc, venue: g.venue, year: y }), k), sbP = sbY ? null : bestOf(marks(a.id, { disc: g.disc, venue: g.venue, year: y - 1 }), k);
        let st = "";
        if (sbY && gv.value != null) st = atLeast(k, sbY.value, gv.value) ? '<div class="gst ok">✓ erreicht mit ' + esc(sbY.mark) + "</div>"
          : '<div class="gst">noch ' + fmt(Math.abs(sbY.value - gv.value), "d") + (k === "t" ? " s" : " m") + " · SB " + esc(sbY.mark) + "</div>";
        else if (sbP) st = '<div class="gst">SB ' + (y - 1) + " " + esc(sbP.mark) + "</div>";
        return '<div class="gcard"><div class="gd">' + esc(discTxt(g.disc, g.venue)) + "</div>"
          + '<div class="gpb">' + (pb ? "PB " + esc(pb.mark) + (ak ? ' <span>' + esc(ak) + "</span>" : "") : "PB –") + "</div>"
          + '<div class="gv">' + esc(g.goal) + "</div>"
          + (g.longterm ? '<div class="gl">Langfristig ' + esc(g.longterm) + "</div>" : "")
          + (g.note ? '<div class="gl">' + esc(g.note) + "</div>" : "")
          + st
          + (g.ultimate ? '<div class="gult"><span>Ultimate</span><b>' + esc(g.ultimate) + "</b></div>" : "") + "</div>";
      }).join("") + "</div>";
    }
    h += '<div id="gEdit"></div></section>';
    return h;
  }
  const discOptions = (sel) => LA.DISCIPLINE_GROUPS.map(([g, l]) => '<optgroup label="' + esc(g) + '">' + l.map(([n]) =>
    '<option' + (n === sel ? " selected" : "") + ">" + esc(n) + "</option>").join("") + "</optgroup>").join("");
  const venueOptions = (sel, all) => [["", all], ["outdoor", "Freiluft"], ["indoor", "Halle"]].map(([v, t]) => '<option value="' + v + '"' + (v === sel ? " selected" : "") + ">" + t + "</option>").join("");
  function goalRow(g) {
    return '<div class="grow" data-id="' + esc(g.id || "") + '"><div class="grid2">'
      + '<div><label class="fl">Disziplin</label><select data-f="disc">' + discOptions(g.disc) + "</select></div>"
      + '<div><label class="fl">Halle / Freiluft</label><select data-f="venue">' + venueOptions(g.venue, "beides") + "</select></div>"
      + '<div><label class="fl">Ziel</label><input type="text" data-f="goal" inputmode="decimal" placeholder="z. B. 11,9x" value="' + esc(g.goal || "") + '"></div>'
      + '<div><label class="fl">Ultimate</label><input type="text" data-f="ultimate" inputmode="decimal" placeholder="optional" value="' + esc(g.ultimate || "") + '"></div>'
      + '<div><label class="fl">Langfristig</label><input type="text" data-f="longterm" inputmode="decimal" placeholder="optional" value="' + esc(g.longterm || "") + '"></div>'
      + '<div><label class="fl">Notiz</label><input type="text" data-f="note" maxlength="80" placeholder="z. B. 150 m 18,00" value="' + esc(g.note || "") + '"></div>'
      + '</div><div class="row" style="justify-content:space-between;margin-top:6px"><p class="err" data-f="err"></p><button class="btn" type="button" data-del>Entfernen</button></div></div>';
  }
  function goalEditorHtml(a) {
    const gs = goalsAll(a.id).filter((g) => g.year === V.year);
    const rows = gs.length ? gs : ["60 m", "100 m", "200 m"].map((d) => ({ disc: d, venue: "", goal: "" }));
    return '<div class="gedit"><div id="gRows">' + rows.map(goalRow).join("") + "</div>"
      + '<button class="btn" type="button" id="gAdd">+ Weitere Disziplin</button>'
      + '<p class="hint">x steht für beliebige Ziffern: „11,9x“ = unter 12,00, „6,4x“ = mindestens 6,40. Leeres Ziel = Zeile wird nicht gespeichert.</p>'
      + '<div class="formbtns"><button class="btn primary" type="button" id="gSave">Ziele ' + V.year + ' speichern</button><button class="btn" type="button" id="gCancel">Abbrechen</button></div></div>';
  }
  function saveGoals() {
    const a = athlete(); let bad = false; const keep = [];
    document.querySelectorAll("#gRows .grow").forEach((row) => {
      const f = (n) => row.querySelector('[data-f="' + n + '"]'), err = f("err"); err.textContent = "";
      const g = { id: row.dataset.id || LA.newId(), year: V.year, disc: f("disc").value, venue: f("venue").value,
        goal: f("goal").value.trim(), ultimate: f("ultimate").value.trim(), longterm: f("longterm").value.trim(), note: f("note").value.trim() };
      if (!g.goal) { if (g.ultimate || g.longterm || g.note) { err.textContent = "Ziel fehlt."; bad = true; } return; }
      const k = KIND(g.disc);
      for (const [n, label] of [["goal", "Ziel"], ["ultimate", "Ultimate"], ["longterm", "Langfristig"]]) {
        if (!g[n]) continue;
        const p = LA.parseGoal(g[n], k);
        if (p.err) { err.textContent = label + ": " + p.err; bad = true; return; }
        g[n] = p.mark;
      }
      if (keep.some((x) => x.disc === g.disc && x.venue === g.venue)) { err.textContent = "Disziplin doppelt."; bad = true; return; }
      keep.push(g);
    });
    if (bad) return;
    const rec = LA.progFor("ziele", a.id);
    rec.goals = rec.goals.filter((g) => g.year !== V.year).concat(keep);
    LA.saveProg("ziele", a.id, rec);
    editGoals = false; render();
  }

  /* --- Einordnung --- */
  function standHtml(a) {
    const y = V.year, ak = akMain(a, y);
    const keys = new Map();
    LA.rankLists().filter((l) => l.year <= y).forEach((l) => keys.set(l.disc + "|" + l.venue, [l.disc, l.venue]));
    const cards = [...keys.values()].sort((p, q) => LA.discOrder(p[0]) - LA.discOrder(q[0]) || p[1].localeCompare(q[1]))
      .map(([d, v]) => ({ d, v, f: listsFor(a, y, d, v) })).filter((x) => x.f);
    let h = '<section class="gsec"><div class="ghead"><h2>Einordnung ' + y + '</h2><button class="btn" type="button" id="rAdd">+ Bestenliste</button></div>'
      + '<div class="glegend"><span><i class="w"></i>Welt (WMA)</span><span><i class="g"></i>Deutschland (DLV)</span>' + (ak ? "<span>" + esc(ak) + "</span>" : "") + "</div>";
    if (!cards.length) h += '<p class="note">Noch keine Bestenliste für ' + esc(ak || "die Altersklasse") + " bis " + y + ". Über „+ Bestenliste“ die Zeiten aus der DLV- oder WMA-Bestenliste einfügen – ganze Liste oder nur Eckwerte (Platz 10, 30, 50).</p>";
    h += '<div id="rEdit"></div>';
    cards.forEach((c, i) => {
      const k = KIND(c.d), ly = c.f.year;
      const sb = bestOf(marks(a.id, { disc: c.d, venue: c.v, year: y }), k);
      const own = sb || bestOf(marks(a.id, { disc: c.d, venue: c.v, year: ly }), k);
      const ownY = sb ? y : ly;
      const goal = goalsAll(a.id).find((g) => g.year === y && g.disc === c.d && g.venue === c.v) || goalsAll(a.id).find((g) => g.year === y + 1 && g.disc === c.d && g.venue === c.v)
        || goalsAll(a.id).find((g) => g.year === y && g.disc === c.d && !g.venue);
      const gv = goal ? LA.parseGoal(goal.goal, k) : null;
      const byList = (id) => c.f.lists.find((l) => l.list === id);
      const ranks = ["dlv", "wma"].map((id) => { const L = byList(id); return L && own ? LA.RANK_LISTS[id] + " " + rankOf(L, own.value, k).txt : null; }).filter(Boolean);
      h += '<div class="gstand"><div class="gsh"><b>' + esc(discTxt(c.d, c.v)) + '</b><span>' + ly + (c.f.lists[0].ak ? " · " + esc(c.f.lists[0].ak) : "") + (ranks.length ? " · " + ranks.join(" · ") : "") + "</span></div>"
        + '<div class="gends"><span>← ' + (k === "t" ? "schneller" : "besser") + "</span><span>" + (k === "t" ? "langsamer" : "schwächer") + " →</span></div>"
        + '<div class="gaxis" data-i="' + i + '"></div>'
        + '<div class="gsrc">' + ["wma", "dlv"].map((id) => { const L = byList(id); return L ? '<div><button type="button" class="link" data-redit="' + esc(L.id) + '">' + LIST_TXT[id] + " " + L.year + " · " + L.entries.length + (complete(L.entries) ? " Plätze" : " Eckwerte") + (L.source ? " · " + esc(L.source) : "") + "</button></div>" : ""; }).join("")
        + (ly !== y ? '<div class="hint">Für ' + y + " noch keine Liste – Einordnung mit der Liste " + ly + ".</div>" : "")
        + (!own ? '<div class="hint">Keine gültige Leistung ' + ly + " in dieser Disziplin.</div>" : "") + "</div></div>";
      AX[i] = { k, wma: byList("wma"), dlv: byList("dlv"), own: own ? { v: own.value, t: "SB " + ownY + " · " + own.mark } : null,
        goal: gv && gv.value != null ? { v: gv.value, t: "Ziel " + goal.year + " · " + goal.goal } : null };
    });
    AX.length = cards.length;
    return h + "</section>";
  }
  const AX = [];
  function drawAxes() {
    document.querySelectorAll("#gBody .gaxis").forEach((el) => { const c = AX[+el.dataset.i]; if (c) el.innerHTML = axisSvg(c, el.clientWidth || 320); });
  }
  function axisSvg(c, W) {
    const k = c.k, top = c.wma ? ticksOf(c.wma) : [], bot = c.dlv ? ticksOf(c.dlv) : [];
    const vals = top.concat(bot).map((x) => x.v).concat(c.own ? [c.own.v] : [], c.goal ? [c.goal.v] : []);
    let lo = Math.min(...vals), hi = Math.max(...vals); if (hi - lo < 0.05) { lo -= 0.1; hi += 0.1; }
    const pad = (hi - lo) * 0.08, PL = 26, PR = 26;
    const X = (v) => { const f = (v - (lo - pad)) / (hi - lo + 2 * pad); return PL + (k === "t" ? f : 1 - f) * (W - PL - PR); };
    const rowsOf = (ts) => { // Beschriftungen, die sich überlappen würden, in bis zu drei Reihen staffeln
      const sorted = ts.map((t) => ({ t, x: X(t.v) })).sort((p, q) => p.x - q.x), last = [-1e9, -1e9, -1e9];
      sorted.forEach((s) => { let r = last.findIndex((x) => s.x - x >= 46); if (r < 0) r = last.indexOf(Math.min(...last)); s.row = r; last[r] = s.x; });
      return sorted; };
    const T = rowsOf(top), B = rowsOf(bot), RH = 28;
    const nT = T.length ? Math.max(...T.map((s) => s.row)) + 1 : 0, nB = B.length ? Math.max(...B.map((s) => s.row)) + 1 : 0;
    const AY = 6 + nT * RH + 8, lab = (s) => (s.t.r === 1 ? "Platz 1" : "Top " + s.t.r);
    const tx = (x) => Math.max(18, Math.min(W - 18, x));
    let svg = '<line class="ax" x1="' + PL / 2 + '" x2="' + (W - PR / 2) + '" y1="' + AY + '" y2="' + AY + '"/>';
    T.forEach((s) => { const y = AY - 8 - s.row * RH;
      svg += '<line class="tw" x1="' + s.x + '" x2="' + s.x + '" y1="' + (AY - 1) + '" y2="' + (y + 2) + '"/><text class="vw" x="' + tx(s.x) + '" y="' + (y - 12) + '">' + esc(s.t.m || fmt(s.t.v, k)) + '</text><text class="lw" x="' + tx(s.x) + '" y="' + (y - 1) + '">' + lab(s) + "</text>"; });
    B.forEach((s) => { const y = AY + 8 + s.row * RH;
      svg += '<line class="tg" x1="' + s.x + '" x2="' + s.x + '" y1="' + (AY + 1) + '" y2="' + (y - 2) + '"/><text class="vg" x="' + tx(s.x) + '" y="' + (y + 10) + '">' + esc(s.t.m || fmt(s.t.v, k)) + '</text><text class="lg" x="' + tx(s.x) + '" y="' + (y + 21) + '">' + lab(s) + "</text>"; });
    let by = AY + 8 + nB * RH + 14;
    const marksL = [c.goal && Object.assign({ cls: "mg" }, c.goal), c.own && Object.assign({ cls: "mo" }, c.own)].filter(Boolean).map((m) => Object.assign(m, { x: X(m.v), w: m.t.length * 6.6 + 16 }));
    marksL.sort((p, q) => p.x - q.x);
    let prevR = -1e9, lvl = 0, maxL = 0;
    marksL.forEach((m) => { m.bx = Math.max(2, Math.min(W - m.w - 2, m.x - m.w / 2)); m.lvl = m.bx < prevR + 6 ? ++lvl : (lvl = 0); prevR = m.bx + m.w; maxL = Math.max(maxL, m.lvl); });
    marksL.forEach((m) => { svg += '<line class="ml" x1="' + m.x + '" x2="' + m.x + '" y1="' + AY + '" y2="' + (by + m.lvl * 30) + '"/>'; });
    marksL.forEach((m) => { const yb = by + m.lvl * 30;
      svg += '<rect class="' + m.cls + '" x="' + m.bx + '" y="' + yb + '" width="' + m.w + '" height="22" rx="5"/><text class="mt" x="' + (m.bx + m.w / 2) + '" y="' + (yb + 15) + '">' + esc(m.t) + "</text>"; });
    marksL.forEach((m) => { svg += '<circle class="md" cx="' + m.x + '" cy="' + AY + '" r="6"/>'; });
    const H = marksL.length ? by + maxL * 30 + 26 : AY + 8 + nB * RH + 6;
    return '<svg viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Einordnung auf der Bestenliste">' + svg + "</svg>";
  }

  /* --- Bestenliste bearbeiten --- */
  function rankEditorHtml(a) {
    const L = rankEdit.id ? LA.rankLists().find((x) => x.id === rankEdit.id) : null;
    const s = L ? { list: L.list, disc: L.disc, venue: L.venue, ak: L.ak, year: L.year, source: L.source, text: L.entries.map((e) => e.r + ". " + e.m).join("\n") }
      : Object.assign({ list: "dlv", disc: "100 m", venue: "outdoor", ak: akMain(a, V.year), year: V.year, source: "", text: "" }, rankEdit.draft || {});
    return '<div class="gedit"><h3>' + (L ? "Bestenliste bearbeiten" : "Bestenliste einfügen") + "</h3>"
      + '<div class="seg" id="rList">' + Object.keys(LA.RANK_LISTS).map((id) => '<button type="button" data-v="' + id + '" aria-pressed="' + (s.list === id) + '">' + LIST_TXT[id] + "</button>").join("") + "</div>"
      + '<div class="grid2">'
      + '<div><label class="fl" for="rDisc">Disziplin</label><select id="rDisc">' + discOptions(s.disc) + "</select></div>"
      + '<div><label class="fl" for="rVenue">Halle / Freiluft</label><select id="rVenue">' + venueOptions(s.venue, "nicht getrennt") + "</select></div>"
      + '<div><label class="fl" for="rYear">Jahr</label><input type="number" id="rYear" inputmode="numeric" min="1950" max="2200" value="' + s.year + '"></div>'
      + '<div><label class="fl" for="rAk">Altersklasse</label><input type="text" id="rAk" maxlength="12" value="' + esc(s.ak) + '" placeholder="z. B. M55"></div>'
      + "</div>"
      + '<label class="fl" for="rText">Zeiten aus der Bestenliste</label><textarea id="rText" rows="8" placeholder="Ganze Liste einfügen (Name, Wind usw. werden ignoriert) oder nur Eckwerte:\n10: 11,56\n30: 11,77\n50: 11,88">' + esc(s.text) + "</textarea>"
      + '<p class="hint" id="rPrev"></p>'
      + '<label class="fl" for="rSrc">Quelle / Stand</label><input type="text" id="rSrc" maxlength="120" placeholder="z. B. DLV-Bestenliste, Stand 01.11." value="' + esc(s.source) + '">'
      + '<p class="err" id="rErr"></p>'
      + '<div class="formbtns"><button class="btn primary" type="button" id="rSave">Speichern</button><button class="btn" type="button" id="rCancel">Abbrechen</button>'
      + (L ? '<button class="btn danger" type="button" id="rDel">Löschen</button>' : "") + "</div></div>";
  }
  function rankForm() {
    const list = (document.querySelector('#rList [aria-pressed="true"]') || {}).dataset;
    return { list: list ? list.v : "dlv", disc: $("rDisc").value, venue: $("rVenue").value, year: parseInt($("rYear").value, 10), ak: $("rAk").value.trim(), source: $("rSrc").value.trim(), text: $("rText").value };
  }
  function updRankPreview() {
    if (!$("rText")) return;
    const f = rankForm(), k = KIND(f.disc), p = parseRankText(f.text, k), e = p.entries;
    $("rPrev").textContent = !e.length ? "Noch keine Zeiten erkannt." : e.length + " Einträge erkannt (" + (complete(e) ? "vollständige Liste" : "Eckwerte") + ") · Platz " + e[0].r + ": " + e[0].m
      + (e.length > 1 ? " · Platz " + e[e.length - 1].r + ": " + e[e.length - 1].m : "") + (p.warn.length ? " · " + p.warn.slice(0, 2).join(" · ") : "");
  }
  function saveRankForm() {
    const f = rankForm(), k = KIND(f.disc), p = parseRankText(f.text, k);
    if (!(f.year > 1950 && f.year < 2200)) { $("rErr").textContent = "Jahr prüfen."; return; }
    if (!p.entries.length) { $("rErr").textContent = "Keine Zeiten erkannt."; return; }
    const id = LA.saveRank({ id: rankEdit.id, list: f.list, disc: f.disc, venue: f.venue, year: f.year, ak: f.ak, source: f.source, entries: p.entries });
    if (!id) { $("rErr").textContent = "Speichern fehlgeschlagen."; return; }
    rankEdit = null; render();
  }

  /* ---------- Ereignisse ---------- */
  document.addEventListener("click", (ev) => {
    const t = ev.target.closest("button"); if (!t || !t.closest("#viewGoals")) return;
    if (t.id === "gEditBtn") { editGoals = !editGoals; render(); if (editGoals) $("gEdit").scrollIntoView({ block: "nearest" }); }
    else if (t.id === "gCancel") { editGoals = false; render(); }
    else if (t.id === "gSave") saveGoals();
    else if (t.id === "gAdd") { const used = [...document.querySelectorAll('#gRows [data-f="disc"]')].map((s) => s.value);
      const d = ["60 m", "100 m", "200 m", "400 m", "Weitsprung", "Kugelstoß"].find((x) => !used.includes(x)) || "100 m";
      $("gRows").insertAdjacentHTML("beforeend", goalRow({ disc: d, venue: "", goal: "" })); }
    else if (t.hasAttribute("data-del")) t.closest(".grow").remove();
    else if (t.id === "rAdd") { rankEdit = { id: null }; render(); $("rEdit").scrollIntoView({ block: "start", behavior: "smooth" }); }
    else if (t.dataset.redit) { rankEdit = { id: t.dataset.redit }; render(); $("rEdit").scrollIntoView({ block: "start", behavior: "smooth" }); }
    else if (t.closest("#rList")) { t.parentNode.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === t))); }
    else if (t.id === "rCancel") { rankEdit = null; render(); }
    else if (t.id === "rSave") saveRankForm();
    else if (t.id === "rDel") {
      if (t.dataset.armed) { LA.deleteRank(rankEdit.id); rankEdit = null; render(); }
      else { t.dataset.armed = "1"; t.textContent = "Wirklich löschen?"; t.classList.add("armed"); }
    }
  });
  document.addEventListener("input", (ev) => { if (ev.target.closest && ev.target.closest("#rEdit")) updRankPreview(); });
  document.addEventListener("change", (ev) => {
    const t = ev.target;
    if (t.id === "gAth") { V.ath = t.value; editGoals = false; rankEdit = null; render(); }
    else if (t.id === "gYear") { V.year = +t.value; editGoals = false; if (rankEdit && !rankEdit.id) rankEdit = null; render(); }
    else if (t.id === "rDisc" || t.id === "rYear") updRankPreview();
  });
  let rz = 0;
  window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if (!$("viewGoals").hidden) drawAxes(); }, 150); });
  window.addEventListener("la:synced", () => { if (!$("viewGoals").hidden && !editGoals && !rankEdit) render(); });

  window.LA_ZIELE = {
    show(athleteId) { if (athleteId && athleteId !== "__none") V.ath = athleteId; editGoals = false; rankEdit = null; render(); },
    parseRankText, rankOf, ticksOf,
  };
})();
