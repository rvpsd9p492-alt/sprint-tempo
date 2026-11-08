// Nachbau der Supabase-Schnittstellen, die die App nutzt (Anmeldung, la_records, Token-Tabellen, la_storage_info).
// Nur für Tests: Daten im Speicher, je Konto getrennt, "neuere Änderung gewinnt" wie der Trigger la_records_touch.
import http from "node:http";
import { randomUUID } from "node:crypto";

export function startMock(port = 8799) {
  const users = new Map();          // email → { id, password }
  const tokens = new Map();         // access/refresh token → user id
  const records = new Map();        // user|kind|id → row
  const linkTables = { la_calendar_tokens: new Map(), la_entry_tokens: new Map() }; // user → token
  let clock = Date.now();
  const serverAt = () => new Date(++clock > Date.now() ? clock : (clock = Date.now())).toISOString();

  function session(u) {
    const access = "at-" + randomUUID(), refresh = "rt-" + randomUUID();
    tokens.set(access, u.id); tokens.set(refresh, u.id);
    return { access_token: access, refresh_token: refresh, expires_in: 3600, token_type: "bearer", user: { id: u.id, email: u.email } };
  }
  const send = (res, code, body) => {
    res.writeHead(code, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" });
    res.end(body === undefined ? "" : JSON.stringify(body));
  };
  const userOf = (req) => tokens.get(String(req.headers.authorization || "").replace(/^Bearer /, ""));

  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => {
      if (req.method === "OPTIONS") return send(res, 204);
      const url = new URL(req.url, "http://x"), p = url.pathname, q = url.searchParams;
      let body = null; try { body = raw ? JSON.parse(raw) : null; } catch (e) { return send(res, 400, { message: "bad json" }); }
      if (req.headers.apikey !== "test-anon-key") return send(res, 401, { message: "Invalid API key" });

      if (p === "/auth/v1/signup" && req.method === "POST") {
        if (users.has(body.email)) return send(res, 422, { msg: "User already registered" });
        if (String(body.password || "").length < 8) return send(res, 422, { msg: "Password should be at least 8 characters" });
        const u = { id: randomUUID(), email: body.email, password: body.password }; users.set(u.email, u);
        return send(res, 200, session(u));
      }
      if (p === "/auth/v1/token") {
        if (q.get("grant_type") === "password") {
          const u = users.get(body.email);
          if (!u || u.password !== body.password) return send(res, 400, { error: "invalid_grant", error_description: "Invalid login credentials" });
          return send(res, 200, session(u));
        }
        const id = tokens.get(body.refresh_token), u = [...users.values()].find((x) => x.id === id);
        return u ? send(res, 200, session(u)) : send(res, 400, { error_description: "Invalid Refresh Token" });
      }
      if (p === "/auth/v1/logout") return send(res, 204);
      if (p === "/auth/v1/recover") return send(res, 200, {});
      if (p === "/auth/v1/user" && req.method === "PUT") {
        const id = userOf(req), u = [...users.values()].find((x) => x.id === id);
        if (!u) return send(res, 401, { msg: "not authenticated" });
        if (body.password) u.password = body.password;
        return send(res, 200, { id: u.id, email: u.email });
      }

      const uid = userOf(req);
      if (p.startsWith("/rest/v1/") && !uid) return send(res, 401, { message: "JWT expired" });
      if (p === "/rest/v1/rpc/la_storage_info") {
        const own = [...records.values()].filter((r) => r.user_id === uid);
        return send(res, 200, { own_bytes: JSON.stringify(own).length, own_rows: own.length, db_bytes: 9 * 1024 * 1024 });
      }
      if (p === "/rest/v1/la_records" && req.method === "GET") {
        const gt = (q.get("server_at") || "").replace(/^gt\./, ""), limit = +q.get("limit") || 1000;
        const rows = [...records.values()].filter((r) => r.user_id === uid && (!gt || r.server_at > gt))
          .sort((a, b) => a.server_at.localeCompare(b.server_at)).slice(0, limit)
          .map(({ kind, id, data, deleted, updated_at, server_at }) => ({ kind, id, data, deleted, updated_at, server_at }));
        return send(res, 200, rows);
      }
      if (p === "/rest/v1/la_records" && req.method === "POST") {
        for (const r of Array.isArray(body) ? body : [body]) {
          if (r.user_id !== uid) return send(res, 403, { message: "new row violates row-level security policy" });
          if (!["athlete", "result", "settings"].includes(r.kind)) return send(res, 400, { message: "check constraint" });
          const key = uid + "|" + r.kind + "|" + r.id, old = records.get(key);
          if (old && old.updated_at > r.updated_at) continue; // neuere Änderung gewinnt
          records.set(key, { user_id: uid, kind: r.kind, id: r.id, data: r.deleted ? null : r.data, deleted: !!r.deleted,
            updated_at: r.updated_at, server_at: serverAt() });
        }
        return send(res, 201);
      }
      const lt = p.replace("/rest/v1/", "");
      if (linkTables[lt]) {
        if (req.method === "GET") return send(res, 200, linkTables[lt].has(uid) ? [{ token: linkTables[lt].get(uid) }] : []);
        if (req.method === "POST") { linkTables[lt].set(uid, (Array.isArray(body) ? body[0] : body).token); return send(res, 201); }
      }
      send(res, 404, { message: "not mocked: " + req.method + " " + p });
    });
  });
  return new Promise((resolve) => server.listen(port, () => resolve({
    server, close: () => new Promise((r) => server.close(r)),
    rows: (email) => { const u = users.get(email); return [...records.values()].filter((r) => u && r.user_id === u.id); },
  })));
}

if (import.meta.url === "file://" + process.argv[1]) {
  const port = +(process.argv[2] || 8799);
  startMock(port).then(() => console.log("Mock-Supabase auf http://localhost:" + port));
}
