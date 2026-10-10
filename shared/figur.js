/* Skizzen für Übungsbibliotheken (Kräftigung, Dehnen): Strichfigur aus Gelenkwinkeln, Start/Ende und Animation. */
(function () {
  "use strict";
  /* ---------- Skizze: Strichfigur aus Gelenkwinkeln ----------
     Blick von der Seite, Figur schaut nach rechts. Winkel in Grad:
     t = Oberkörper ab senkrecht nach oben (+ = vorgebeugt), Beine/Arme ab senkrecht nach unten (+ = nach vorn).
     l1/l2 = [Oberschenkel, Unterschenkel] nah/fern, r1/r2 = [Oberarm, Unterarm], f1/f2 = Fuß (Standard 90 = waagerecht). */
  const LEN = { trunk: 20, thigh: 17, shank: 17, upper: 11, fore: 10, head: 7.6, foot: 5 }, FLOOR = 92;
  const rad = (d) => (d * Math.PI) / 180;
  const add = (p, len, ang, up) => [p[0] + len * Math.sin(rad(ang)), p[1] + (up ? -1 : 1) * len * Math.cos(rad(ang))];
  function rawJoints(q) {
    const p = [0, 0], s = add(p, LEN.trunk, q.t, true), J = { p, s, hd: add(s, LEN.head, q.t, true) };
    [[1, q.l1, q.f1], [2, q.l2, q.f2]].forEach(([i, l, f]) => {
      J["k" + i] = add(p, LEN.thigh, l[0]); J["a" + i] = add(J["k" + i], LEN.shank, l[1]);
      J["t" + i] = q.front ? J["a" + i] : add(J["a" + i], LEN.foot, f == null ? 90 : f);
    });
    [[1, q.r1], [2, q.r2]].forEach(([i, r]) => { J["e" + i] = add(s, LEN.upper, r[0]); J["h" + i] = add(J["e" + i], LEN.fore, r[1]); });
    return J;
  }
  function offset(q, J, ex) {
    const anchor = q.anchor || ex.anchor;
    let dy;
    if (anchor) dy = anchor[1] - J[anchor[0]][1];
    else dy = FLOOR - Math.max(...Object.keys(J).map((k) => J[k][1] + (k === "hd" ? 4.6 : 0)));
    const ax = ex.ax || "a1", x = q.x != null ? q.x : ex.x != null ? ex.x : 52;
    return [x - J[ax][0], dy];
  }
  function lerpPose(a, b, t) {
    const m = (x, y) => x + (y - x) * t, ml = (x, y) => [m(x[0], y[0]), m(x[1], y[1])];
    return { t: m(a.t, b.t), l1: ml(a.l1, b.l1), l2: ml(a.l2, b.l2), r1: ml(a.r1, b.r1), r2: ml(a.r2, b.r2),
      f1: m(a.f1 == null ? 90 : a.f1, b.f1 == null ? 90 : b.f1), f2: m(a.f2 == null ? 90 : a.f2, b.f2 == null ? 90 : b.f2), front: a.front };
  }
  /** Gelenke einer Pose (bzw. Zwischenstand t zwischen Start und Ende), bereits auf den Boden gestellt. */
  function poseJoints(ex, t) {
    const A = ex.poses[0], B = ex.poses[1] || A;
    const JA = rawJoints(A), JB = rawJoints(B), oA = offset(A, JA, ex), oB = offset(B, JB, ex);
    const q = t <= 0 ? A : t >= 1 ? B : lerpPose(A, B, t), J = t <= 0 ? JA : t >= 1 ? JB : rawJoints(q);
    const o = [oA[0] + (oB[0] - oA[0]) * t, oA[1] + (oB[1] - oA[1]) * t], out = {};
    Object.keys(J).forEach((k) => { out[k] = [J[k][0] + o[0], J[k][1] + o[1]]; });
    return out;
  }
  const f1 = (n) => Math.round(n * 10) / 10;
  const line = (a, b, w, c) => '<line x1="' + f1(a[0]) + '" y1="' + f1(a[1]) + '" x2="' + f1(b[0]) + '" y2="' + f1(b[1]) + '" style="stroke:' + c + '" stroke-width="' + w + '" stroke-linecap="round"/>';
  function figure(J, ghost) {
    const ink = ghost ? "var(--muted)" : "var(--ink)", far = "var(--muted)", op = ghost ? ' opacity=".35"' : "";
    let g = "<g" + op + ">";
    // ferne Gliedmaßen zuerst (heller)
    g += line(J.p, J.k2, 3.2, far) + line(J.k2, J.a2, 3.2, far) + line(J.a2, J.t2, 2.6, far);
    g += line(J.s, J.e2, 3, far) + line(J.e2, J.h2, 3, far);
    g += line(J.p, J.s, 4, ink);
    g += line(J.p, J.k1, 3.6, ink) + line(J.k1, J.a1, 3.6, ink) + line(J.a1, J.t1, 3, ink);
    g += line(J.s, J.e1, 3.4, ink) + line(J.e1, J.h1, 3.4, ink);
    g += '<circle cx="' + f1(J.hd[0]) + '" cy="' + f1(J.hd[1]) + '" r="4.6" style="fill:' + ink + '"/>';
    return g + "</g>";
  }
  function props(ex, J, J0, J1) {
    const eq = "var(--clay)";
    let g = "";
    (ex.props || []).forEach((p) => {
      const ref = p.ref === 1 ? J1 : J0, at = p.at ? J[p.at] : null, sa = p.at ? ref[p.at] : null;
      if (p.t === "plate" && at) g += '<circle cx="' + f1(at[0] + (p.dx || 0)) + '" cy="' + f1(at[1] + (p.dy || 0)) + '" r="6.5" style="fill:none;stroke:' + eq + '" stroke-width="3"/>';
      if (p.t === "db" && at) g += '<rect x="' + f1(at[0] - 5) + '" y="' + f1(at[1] - 2.2) + '" width="10" height="4.4" rx="1.5" style="fill:' + eq + '"/>';
      if (p.t === "kb" && at) g += '<circle cx="' + f1(at[0]) + '" cy="' + f1(at[1] + 5) + '" r="4.6" style="fill:' + eq + '"/>';
      if (p.t === "ball" && at) g += '<circle cx="' + f1(at[0]) + '" cy="' + f1(at[1]) + '" r="5.5" style="fill:' + eq + '"/>';
      if (p.t === "pad" && at) g += '<rect x="' + f1(at[0] - 4) + '" y="' + f1(at[1] - 7) + '" width="8" height="5" rx="1.5" style="fill:' + eq + '"/>';
      if (p.t === "box") g += '<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + (FLOOR - p.y) + '" rx="2" style="fill:none;stroke:' + eq + '" stroke-width="2.5"/>';
      if (p.t === "boxUnder" && sa) { const top = sa[1] + (p.dy || 3), x = sa[0] - p.w / 2 + (p.dx || 0);
        g += '<rect x="' + f1(x) + '" y="' + f1(top) + '" width="' + p.w + '" height="' + f1(FLOOR - top) + '" rx="2" style="fill:none;stroke:' + eq + '" stroke-width="2.5"/>'; }
      if (p.t === "bench") { const a = ref[p.from], b = ref[p.at], top = Math.max(a[1], b[1]) + 4;
        g += '<rect x="' + f1(a[0] - 8) + '" y="' + f1(top) + '" width="' + f1(b[0] - a[0] + 12) + '" height="5" rx="2" style="fill:none;stroke:' + eq + '" stroke-width="2.5"/>'
          + line([b[0] - 2, top + 5], [b[0] - 2, FLOOR], 2.5, eq) + line([a[0] - 4, top + 5], [a[0] - 4, FLOOR], 2.5, eq); }
      if (p.t === "bar") g += line([30, p.y], [90, p.y], 3, eq);
      if (p.t === "wall") g += line([p.x, 20], [p.x, FLOOR], 3, "var(--line)");
      if (p.t === "bandK") g += line(J.k1, J.k2, 2.5, eq);
      if (p.t === "wallJ" && sa) g += line([sa[0] + (p.dx || 0), 18], [sa[0] + (p.dx || 0), FLOOR], 3, "var(--line)");
      if (p.t === "strap" && at) g += line(at, J[p.to], 2, eq);
      if (p.t === "bandTo" && at) g += line(at, [p.x, p.y], 2, eq) + line([p.x - 2, p.y - 6], [p.x - 2, p.y + 6], 3, "var(--line)");
    });
    return g;
  }
  /** SVG-Skizze. t = null: Start blass + Ende kräftig; t = 0…1: Zwischenstand für die Animation. */
  function sketch(ex, t, label) {
    const J0 = poseJoints(ex, 0), J1 = poseJoints(ex, 1), still = !ex.poses[1];
    let g = line([4, FLOOR + 1.5], [116, FLOOR + 1.5], 2, "var(--line)");
    if (t == null) { g += props(ex, J1, J0, J1); if (!still) g += figure(J0, true); g += figure(J1, false); }
    else { const J = poseJoints(ex, t); g += props(ex, J, J0, J1) + figure(J, false); }
    return '<svg viewBox="0 0 120 100" role="img" aria-label="' + (label || ex.name) + '">' + g + "</svg>";
  }

  window.LA_FIGUR = { sketch, poseJoints };
})();
