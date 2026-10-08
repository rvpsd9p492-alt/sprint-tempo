/* Cloud-Sicherung über Supabase (Auth + REST, ohne Zusatzbibliothek).
   Ablauf eines Abgleichs: 1. vom Server holen, was seit dem letzten Abgleich neu ist,
   2. lokal zusammenführen (neuere Änderung gewinnt), 3. lokale Änderungen und Löschungen hochladen. */
(function () {
  "use strict";
  const CFG = window.LA_CLOUD || {};
  const URL_ = String(CFG.url || "").replace(/\/+$/, "");
  const KEY = String(CFG.anonKey || "");
  const configured = !!(URL_ && KEY);
  const K = LA.KEYS;
  const OVERLAP_MS = 5 * 60 * 1000; // Puffer beim Abholen gegen knapp verpasste Änderungen
  const PAGE = 1000;
  // Datenbank-Limit des Supabase-Tarifs (Free: 500 MB) – über LA_CLOUD.dbLimitMB anpassbar
  const DB_LIMIT = (Number(CFG.dbLimitMB) > 0 ? Number(CFG.dbLimitMB) : 500) * 1024 * 1024;

  /* ---------- Zustand ---------- */
  // { session:{access_token,refresh_token,expires_at,user_id,email}, cursor, lastSyncAt, pushed:{ "kind:id": ms },
  //   settingsAt, settingsHash, error }
  const st = () => LA.load(K.cloud, {}) || {};
  const put = (s) => { try { localStorage.setItem(K.cloud, JSON.stringify(s)); } catch (e) {} };
  let syncing = false, timer = null, again = false;
  const listeners = new Set();

  // Postgres liefert Mikrosekunden (".123456+00:00"); Safari liest sicher nur Millisekunden.
  const ms = (t) => {
    if (!t) return 0;
    const v = new Date(String(t).replace(/(\.\d{3})\d+/, "$1").replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00")).getTime();
    return isFinite(v) ? v : 0;
  };
  const settingsHash = (o) => LA.hash(JSON.stringify(o || {}));

  function pending() {
    const s = st(), pushed = s.pushed || {};
    let n = 0;
    LA.athletes().forEach((a) => { if (pushed["athlete:" + a.id] !== ms(a.updatedAt)) n++; });
    LA.results().forEach((r) => { if (pushed["result:" + r.id] !== ms(r.updatedAt)) n++; });
    n += (LA.load(K.deleted, []) || []).length;
    if (s.settingsHash !== settingsHash(LA.tempoSettings())) n++;
    return n;
  }
  function status() {
    const s = st(), loggedIn = !!(s.session && s.session.refresh_token);
    const p = loggedIn ? pending() : 0;
    return { configured, loggedIn, email: loggedIn ? s.session.email : null, syncing, pending: p,
      storage: loggedIn && s.storage ? Object.assign({ limit: DB_LIMIT }, s.storage) : null,
      lastSyncAt: s.lastSyncAt || null, error: s.error || null,
      clean: loggedIn && p === 0 && !!s.lastSyncAt && !s.error };
  }
  function emit() { const x = status(); listeners.forEach((fn) => { try { fn(x); } catch (e) {} }); }

  /* ---------- HTTP ---------- */
  class CloudError extends Error {
    constructor(msg, code) { super(msg); this.code = code; }
  }
  async function http(path, opts) {
    const o = opts || {};
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 20000);
    let res;
    try {
      res = await fetch(URL_ + path, {
        method: o.method || "GET",
        headers: Object.assign({ apikey: KEY, "Content-Type": "application/json" },
          o.token ? { Authorization: "Bearer " + o.token } : {}, o.headers || {}),
        body: o.body ? JSON.stringify(o.body) : undefined,
        signal: ctrl.signal,
      });
    } catch (e) {
      throw new CloudError("Keine Verbindung zum Server.", "offline");
    } finally { clearTimeout(t); }
    const text = await res.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    if (!res.ok) {
      const m = data && (data.error_description || data.msg || data.message || data.error) || ("Fehler " + res.status);
      throw new CloudError(String(m), res.status);
    }
    return data;
  }
  function germanAuthError(e) {
    const m = String(e && e.message || "");
    if (e && e.code === "offline") return "Keine Internetverbindung.";
    if (/invalid login credentials/i.test(m)) return "E-Mail oder Passwort falsch.";
    if (/email not confirmed/i.test(m)) return "E-Mail-Adresse noch nicht bestätigt – bitte den Link in der Bestätigungs-Mail öffnen.";
    if (/already registered|already exists/i.test(m)) return "Für diese E-Mail gibt es schon ein Konto – bitte anmelden.";
    if (/password.*(at least|characters|short)/i.test(m)) return "Passwort zu kurz (mindestens 8 Zeichen).";
    if (/signups? not allowed|signup.*disabled/i.test(m)) return "Neue Konten sind gesperrt.";
    if (/rate limit|too many/i.test(m)) return "Zu viele Versuche – bitte kurz warten.";
    return m;
  }

  /* ---------- Anmeldung ---------- */
  function storeSession(d) {
    const s = st();
    s.session = { access_token: d.access_token, refresh_token: d.refresh_token,
      expires_at: Date.now() + (d.expires_in || 3600) * 1000,
      user_id: d.user && d.user.id, email: d.user && d.user.email };
    s.error = null;
    put(s);
  }
  async function signIn(email, password) {
    if (!configured) throw new Error("Cloud-Sicherung ist nicht eingerichtet.");
    try {
      const d = await http("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } });
      const prev = st().session;
      // anderes Konto als zuletzt: alles neu abgleichen (lokale Daten werden in dieses Konto übernommen)
      if (prev && prev.user_id && d.user && prev.user_id !== d.user.id) resetSyncState();
      storeSession(d);
    } catch (e) { throw new Error(germanAuthError(e)); }
    emit();
    return sync({ force: true });
  }
  async function signUp(email, password) {
    if (!configured) throw new Error("Cloud-Sicherung ist nicht eingerichtet.");
    let d;
    try { d = await http("/auth/v1/signup", { method: "POST", body: { email, password } }); }
    catch (e) { throw new Error(germanAuthError(e)); }
    if (d && d.access_token) { storeSession(d); emit(); await sync({ force: true }); return { confirmed: true }; }
    return { confirmed: false }; // Bestätigungs-Mail verschickt
  }
  /* ---------- Speicherbelegung ---------- */
  /** Fragt die Belegung ab (Funktion la_storage_info in Supabase): eigene Daten + Datenbank gesamt. */
  async function storageInfo() {
    const sess = await token();
    const d = await http("/rest/v1/rpc/la_storage_info", { method: "POST", token: sess.access_token, body: {} });
    const s = st();
    s.storage = { own_bytes: +d.own_bytes || 0, own_rows: +d.own_rows || 0, db_bytes: +d.db_bytes || 0, at: new Date().toISOString() };
    put(s); emit();
    return s.storage;
  }
  function refreshStorage(force) {
    const s = st();
    if (!force && s.storage && Date.now() - ms(s.storage.at) < 5 * 60 * 1000) return;
    storageInfo().catch(() => {}); // ältere Datenbank ohne Funktion oder offline: Anzeige entfällt
  }

  /* ---------- Passwort ---------- */
  /** Schickt eine E-Mail mit Link zum Zurücksetzen (öffnet die Übersichtsseite mit #…type=recovery). */
  async function requestPasswordReset(email) {
    if (!configured) throw new Error("Cloud-Sicherung ist nicht eingerichtet.");
    const back = location.origin + location.pathname.replace(/[^/]*$/, "");
    try {
      await http("/auth/v1/recover?redirect_to=" + encodeURIComponent(back), { method: "POST", body: { email } });
    } catch (e) { throw new Error(germanAuthError(e)); }
  }
  /** Liest einen Rücksetz-Link aus der Adresse (#access_token=…&type=recovery) oder dessen Fehlermeldung. */
  function readRecoveryLink() {
    const h = new URLSearchParams(String(location.hash || "").replace(/^#/, ""));
    if (h.get("type") === "recovery" && h.get("access_token")) return { token: h.get("access_token") };
    if (h.get("error") || h.get("error_code")) {
      const code = h.get("error_code") || h.get("error");
      return { error: /expired/i.test(code) ? "Der Link ist abgelaufen oder wurde schon benutzt – bitte erneut „Passwort vergessen“ wählen."
        : "Der Link ist ungültig (" + (h.get("error_description") || code) + ")." };
    }
    return null;
  }
  /** Setzt ein neues Passwort – mit dem Token aus dem Rücksetz-Link oder der aktuellen Anmeldung. */
  async function updatePassword(password, recoveryToken) {
    if (!configured) throw new Error("Cloud-Sicherung ist nicht eingerichtet.");
    let tok = recoveryToken;
    if (!tok) tok = (await token()).access_token;
    try {
      const u = await http("/auth/v1/user", { method: "PUT", token: tok, body: { password } });
      return { email: u && u.email };
    } catch (e) {
      if (/same.*password|different from the old/i.test(e.message)) throw new Error("Das neue Passwort muss sich vom alten unterscheiden.");
      if (/weak|at least|characters/i.test(e.message)) throw new Error("Passwort zu schwach (mindestens 8 Zeichen).");
      throw new Error(e.code === 401 || e.code === 403 ? "Der Link ist abgelaufen – bitte erneut „Passwort vergessen“ wählen." : germanAuthError(e));
    }
  }

  function resetSyncState() {
    const s = st();
    delete s.cursor; delete s.lastSyncAt; delete s.pushed; delete s.settingsHash; delete s.settingsAt; delete s.error;
    put(s);
  }
  async function signOut() {
    const s = st();
    if (s.session && s.session.access_token) {
      http("/auth/v1/logout", { method: "POST", token: s.session.access_token }).catch(() => {});
    }
    put({});
    emit();
  }
  async function token() {
    const s = st();
    if (!s.session || !s.session.refresh_token) throw new CloudError("Nicht angemeldet.", "auth");
    if (s.session.access_token && s.session.expires_at - Date.now() > 60000) return s.session;
    try {
      const d = await http("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: s.session.refresh_token } });
      storeSession(d);
      return st().session;
    } catch (e) {
      if (e.code === "offline") throw e;
      const s2 = st(); delete s2.session; s2.error = "Anmeldung abgelaufen – bitte erneut anmelden."; put(s2);
      throw new CloudError(s2.error, "auth");
    }
  }

  /* ---------- Abgleich ---------- */
  function applyRemote(rows, s) {
    const pushed = s.pushed || (s.pushed = {});
    let ath = LA.athletes(), res = LA.results(), changedA = false, changedR = false, changedS = false;
    const tomb = LA.load(K.deleted, []) || [];
    rows.forEach((row) => {
      const t = ms(row.updated_at), key = row.kind + ":" + row.id;
      if (row.kind === "settings") {
        if (row.id === "tempo" && !row.deleted && row.data && t > (s.settingsAt || 0)) {
          const cur = LA.load(K.tempo, {}) || {};
          LA.TEMPO_SETTINGS.forEach((k) => { if (typeof row.data[k] === "number") cur[k] = row.data[k]; });
          localStorage.setItem(K.tempo, JSON.stringify(cur));
          s.settingsAt = t; s.settingsHash = settingsHash(LA.tempoSettings()); changedS = true;
        }
        return;
      }
      const isA = row.kind === "athlete", list = isA ? ath : res;
      const i = list.findIndex((x) => x.id === row.id);
      const local = i >= 0 ? list[i] : null;
      if (local && ms(local.updatedAt) > t) return; // lokal neuer → wird hochgeladen
      const localTomb = tomb.find((x) => x.kind === row.kind && x.id === row.id);
      if (localTomb && ms(localTomb.at) > t) return; // lokal später gelöscht → Löschung wird hochgeladen
      if (row.deleted) {
        if (local) { list.splice(i, 1); isA ? (changedA = true) : (changedR = true); }
      } else if (row.data) {
        const rec = Object.assign({}, row.data, { id: row.id, updatedAt: new Date(t).toISOString() });
        if (i >= 0) list[i] = rec; else list.push(rec);
        isA ? (changedA = true) : (changedR = true);
      }
      pushed[key] = t;
    });
    if (changedA) localStorage.setItem(K.athletes, JSON.stringify(ath));
    if (changedR) localStorage.setItem(K.results, JSON.stringify(res));
    return changedA || changedR || changedS;
  }

  async function pull(sess, s) {
    let cursor = s.cursor ? new Date(ms(s.cursor) - OVERLAP_MS).toISOString() : null;
    let changed = false, maxAt = s.cursor || null;
    for (;;) {
      const q = "/rest/v1/la_records?select=kind,id,data,deleted,updated_at,server_at&order=server_at.asc&limit=" + PAGE
        + (cursor ? "&server_at=gt." + encodeURIComponent(cursor) : "");
      const rows = await http(q, { token: sess.access_token });
      if (!Array.isArray(rows) || !rows.length) break;
      if (applyRemote(rows, s)) changed = true;
      const last = rows[rows.length - 1].server_at;
      if (!maxAt || ms(last) > ms(maxAt)) maxAt = last;
      if (rows.length < PAGE) break;
      cursor = last;
    }
    s.cursor = maxAt;
    return changed;
  }

  async function push(sess, s) {
    const pushed = s.pushed || (s.pushed = {});
    const rows = [], marks = [];
    const add = (kind, id, data, at, deleted) => {
      rows.push({ user_id: sess.user_id, kind, id, data, deleted: !!deleted, updated_at: at });
      marks.push([kind + ":" + id, ms(at)]);
    };
    LA.athletes().forEach((a) => { if (pushed["athlete:" + a.id] !== ms(a.updatedAt)) add("athlete", a.id, a, a.updatedAt); });
    LA.results().forEach((r) => {
      if (!r.updatedAt) r.updatedAt = r.createdAt || new Date().toISOString();
      if (pushed["result:" + r.id] !== ms(r.updatedAt)) add("result", r.id, r, r.updatedAt);
    });
    const tomb = LA.load(K.deleted, []) || [];
    tomb.forEach((x) => add(x.kind, x.id, null, x.at, true));
    const set = LA.tempoSettings(), h = settingsHash(set);
    let setAt = null;
    if (s.settingsHash !== h) { setAt = new Date().toISOString(); add("settings", "tempo", set, setAt); }
    for (let i = 0; i < rows.length; i += 500) {
      await http("/rest/v1/la_records?on_conflict=user_id,kind,id", {
        method: "POST", token: sess.access_token, body: rows.slice(i, i + 500),
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      });
    }
    marks.forEach(([k, t]) => { pushed[k] = t; });
    // nur die hochgeladenen Löschungen entfernen (währenddessen neu hinzugekommene bleiben)
    const sent = new Set(tomb.map((x) => x.kind + ":" + x.id + ":" + x.at));
    LA.save(K.deleted, (LA.load(K.deleted, []) || []).filter((x) => !sent.has(x.kind + ":" + x.id + ":" + x.at)));
    if (setAt) { s.settingsHash = h; s.settingsAt = ms(setAt); }
    return rows.length;
  }

  async function sync(opts) {
    if (!configured) return status();
    const s0 = st();
    if (!s0.session || !s0.session.refresh_token) return status();
    if (syncing) { again = true; return status(); }
    if (!(opts && opts.force) && navigator.onLine === false) return status();
    syncing = true; emit();
    let changed = false;
    try {
      const sess = await token();
      const s = st();
      changed = await pull(sess, s);
      put(s);
      await push(sess, s);
      s.lastSyncAt = new Date().toISOString(); s.error = null;
      put(s);
      refreshStorage(opts && opts.force);
    } catch (e) {
      const s = st();
      s.error = e.code === "offline" ? null : (e.message || "Synchronisierung fehlgeschlagen.");
      put(s);
    } finally {
      syncing = false;
    }
    emit();
    if (changed) window.dispatchEvent(new CustomEvent("la:synced", { detail: { changed: true } }));
    if (again) { again = false; schedule(500); }
    return status();
  }
  function schedule(delay) {
    if (!configured || !status().loggedIn) return;
    clearTimeout(timer);
    timer = setTimeout(() => sync(), delay == null ? 2000 : delay);
  }

  window.addEventListener("la:changed", (e) => {
    // Sprint-Tempo speichert bei jeder Bedienung; nur geänderte Stellschrauben sind relevant
    if (e.detail && e.detail.key === K.tempo && settingsHash(LA.tempoSettings()) === st().settingsHash) return;
    emit(); schedule();
  });
  window.addEventListener("online", () => schedule(500));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") schedule(300); });
  if (configured) setTimeout(() => sync(), 300);

  LA.cloud = { configured, status, signIn, signUp, signOut, sync, storageInfo, requestPasswordReset, readRecoveryLink, updatePassword, onStatus: (fn) => { listeners.add(fn); return () => listeners.delete(fn); } };
})();
