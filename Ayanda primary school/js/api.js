/* ==========================================================================
   Backend adapters
   --------------------------------------------------------------------------
   One interface, three ways to store the school:

     DemoBackend      localStorage. One browser, nothing shared. The published
                      demo runs on this so the site works with no setup.
     ServerBackend    the Node server in server/. Shared, permission-checked,
                      with a live stream so one person's change appears on
                      everyone else's screen.
     SupabaseBackend  hosted Postgres. Same behaviour as ServerBackend but with
                      nothing to run, so a static GitHub Pages site can share
                      data between accounts.

   Every adapter offers the same five things: login(), logout(), state(),
   write(...) and watch(). Store talks only to this interface, so moving the
   school from one to another is a line in js/config.js.

   None of them will tell an unauthenticated caller who works at the school.
   ========================================================================== */

const Backend = {
  kind: null,
  impl: null,

  async detect() {
    const cfg = window.AYANDA_CONFIG || {};
    const want = cfg.backend || "auto";

    if (want === "demo") return this.use(new DemoBackend());
    if (want === "server") return this.use(new ServerBackend(cfg.serverUrl || ""));
    if (want === "supabase") return this.use(new SupabaseBackend(cfg.supabase));

    /* auto: a server on this origin wins, then Supabase, then the demo */
    try {
      const r = await fetch("api/health", { headers: { Accept: "application/json" } });
      if (r.ok && (await r.json()).ok) return this.use(new ServerBackend(""));
    } catch (_) { /* no server here — expected on GitHub Pages */ }
    if (cfg.supabase && cfg.supabase.url && cfg.supabase.anonKey) return this.use(new SupabaseBackend(cfg.supabase));
    return this.use(new DemoBackend());
  },

  use(impl) { this.impl = impl; this.kind = impl.kind; return impl; },
  get shared() { return this.impl ? this.impl.shared : false; },
};

/* ==========================================================================
   Demo — this browser only
   ========================================================================== */
class DemoBackend {
  constructor() { this.kind = "demo"; this.shared = false; }

  /* The demo has no server to hash against, so it keeps its own credentials in
     this browser — one per account, hashed, must-change, with the same lockout
     the server applies. There is no shared password and no default: the first
     visit sets one up, and after that the office issues the rest exactly as it
     would on a real school database.

     This is not a security boundary. Anything in a browser's own storage
     belongs to whoever has the browser. It is here so the demo shows the real
     workflow rather than a single password everybody already knows. */
  async login(email, password) {
    const db = this.read();
    const wanted = String(email || "").trim().toLowerCase();
    const s = (db.staff || []).find(x => String(x.email || "").toLowerCase() === wanted);
    const g = s ? null : (db.guardians || []).find(x => String(x.email || "").toLowerCase() === wanted);
    const who = s || g;

    /* An unknown address still does the hashing work, and gets the same answer
       as a wrong password, so this form cannot be used to find out who is here. */
    const result = await DemoCredentials.verify(who && who.active ? who.id : "no-such-account", password);
    if (!result.ok) throw new ApiError(401, result.reason || "Those sign-in details are not recognised.");

    if (g) return { token: `demo:family:${g.id}`, kind: "family", account: g, mustChange: result.mustChange };
    return { token: `demo:${s.id}`, kind: "staff", staff: s, mustChange: result.mustChange };
  }

  /* Issuing a sign-in in demo mode: the same call the server's routes make,
     minus the network. Whoever issues it chooses or generates the password. */
  async issue(accountId, password, { mustChange = false } = {}) {
    await DemoCredentials.set(accountId, password, { mustChange, check: true });
    return { ok: true };
  }
  async changeOwnPassword(accountId, currentPassword, password) {
    const check = await DemoCredentials.verify(accountId, currentPassword);
    if (!check.ok) throw new ApiError(403, "Your current password is not correct.");
    const problem = passwordProblem(password);
    if (problem) throw new ApiError(422, problem);
    await DemoCredentials.set(accountId, password, { mustChange: false, check: false });
    return { ok: true };
  }
  async logout() {}
  async state(token) {
    const db = this.read();
    const parts = String(token || "").split(":");
    /* A family sign-in gets the same narrow payload the server would build —
       the demo is meant to show the portal honestly, not a roomier version. */
    if (parts[1] === "family") {
      const g = (db.guardians || []).find(x => x.id === parts[2]);
      if (!g) throw new ApiError(401, "Please sign in again.");
      return { ...Family.build(db, g, new Date().toISOString().slice(0, 10)), serverSeq: 0 };
    }
    return { ...db, me: parts[1] || null, serverSeq: 0 };
  }
  /* The public site asks for this without a session. In demo mode the school
     is in this same browser, so it is the same blob, narrowed. */
  async publicFacts() { return publicFacts(this.read()); }

  /* In demo mode the whole database is one blob; Store hands back what it holds. */
  async write(_token, _ops, wholeDb) {
    try { localStorage.setItem(DEMO_KEY, JSON.stringify(wholeDb)); } catch (_) {}
    return { ok: true };
  }
  /* One browser, but often more than one tab of it — a teacher's portal in one
     and a parent's in another, which is exactly how the published demo gets
     shown. localStorage fires `storage` in every *other* tab when it is
     written, so that is the live feed here: the same round trip as the
     server's event stream, over the only channel a static site has. */
  watch(_token, onChange) {
    const listener = (e) => {
      if (e.key !== DEMO_KEY || !e.newValue) return;
      onChange({ seq: Date.now(), collection: "school", id: null, op: "put", by: null });
    };
    addEventListener("storage", listener);
    return () => removeEventListener("storage", listener);
  }
  read() {
    let raw = null;
    try { raw = localStorage.getItem(DEMO_KEY); } catch (_) {}
    if (raw) { try { return JSON.parse(raw); } catch (_) {} }
    const fresh = buildSeed(new Date().toISOString().slice(0, 10));
    try { localStorage.setItem(DEMO_KEY, JSON.stringify(fresh)); } catch (_) {}
    return fresh;
  }
  /* Clearing the school clears the sign-ins with it. Leaving them behind would
     hand the next school's accounts to the last school's passwords. */
  reset() { try { localStorage.removeItem(DEMO_KEY); } catch (_) {} DemoCredentials.clear(); }
}
const DEMO_KEY = "ayanda.portal.v1";

class ApiError extends Error {
  constructor(status, message, detail) { super(message); this.status = status; this.detail = detail; }
}

/* ==========================================================================
   Server — the Node backend in server/
   ========================================================================== */
class ServerBackend {
  constructor(base) {
    this.kind = "server";
    this.shared = true;
    this.base = (base || "").replace(/\/$/, "");
  }
  url(p) { return `${this.base}/api/${p.replace(/^\//, "")}`; }

  async call(method, path, { body, token } = {}) {
    let res;
    try {
      res = await fetch(this.url(path), {
        method,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (_) {
      throw new ApiError(0, "Cannot reach the portal server. Check your connection.");
    }
    const text = await res.text();
    let data; try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { error: text }; }
    if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status}).`, data.detail);
    return data;
  }

  async requestAccess(request) { return this.call("POST", "access-request", { body: request }); }
  async enquire(enquiry) { return this.call("POST", "enquiry", { body: enquiry }); }
  async gateStatus() { return this.call("GET", "gate"); }
  async publicFacts() { return this.call("GET", "public"); }
  async checkGate(audience, pin) {
    try { return await this.call("POST", "gate", { body: { audience, pin } }); }
    catch (e) { return { ok: false, reason: e.message }; }
  }
  async login(email, password) { return this.call("POST", "auth/login", { body: { email, password } }); }
  async logout(token) { try { await this.call("POST", "auth/logout", { token }); } catch (_) {} }
  async state(token) { return this.call("GET", "state", { token }); }
  /* A guardian's token is refused everywhere but here, so the portal asks for
     its own state rather than the school's. */
  async familyState(token) { return this.call("GET", "portal/state", { token }); }

  /* Ops are the specific changes Store worked out; each is checked server-side. */
  async write(token, ops) {
    const results = [];
    for (const op of ops) {
      if (op.kind === "record") results.push(await this.call("PUT", `records/${op.collection}/${encodeURIComponent(op.id)}`, { body: op.data, token }));
      else if (op.kind === "delete") results.push(await this.call("DELETE", `records/${op.collection}/${encodeURIComponent(op.id)}`, { token }));
      else if (op.kind === "setting") results.push(await this.call("PUT", `settings/${op.key}`, { body: op.data, token }));
      else if (op.kind === "call") results.push(await this.call(op.method || "POST", op.path, { body: op.body, token }));
    }
    return results;
  }

  /* Server-Sent Events: the server pushes a line whenever anything changes. */
  watch(token, onChange) {
    let stopped = false, source = null, retry = null;
    const connect = () => {
      if (stopped) return;
      /* EventSource cannot send an Authorization header, so the token rides in
         the query string over the same TLS connection as everything else. */
      source = new EventSource(this.url(`stream?token=${encodeURIComponent(token)}`));
      source.addEventListener("change", (e) => { try { onChange(JSON.parse(e.data)); } catch (_) {} });
      source.onerror = () => {
        source.close();
        if (!stopped) retry = setTimeout(connect, 4000);   // the server may be restarting
      };
    };
    connect();
    return () => { stopped = true; if (source) source.close(); if (retry) clearTimeout(retry); };
  }
}

/* ==========================================================================
   Supabase — hosted Postgres, so a static site can share data
   --------------------------------------------------------------------------
   Talks to PostgREST and Realtime directly over fetch and a WebSocket, so
   there is no SDK to load and nothing to build. Row-level security in
   supabase/schema.sql does the permission work that api.js does for the
   Node server.
   ========================================================================== */
class SupabaseBackend {
  constructor(cfg) {
    this.kind = "supabase";
    this.shared = true;
    this.url = (cfg.url || "").replace(/\/$/, "");
    this.key = cfg.anonKey || "";
    if (!this.url || !this.key) throw new ApiError(0, "Supabase is selected in js/config.js but the URL or key is missing.");
  }
  headers(token) {
    return {
      "Content-Type": "application/json",
      apikey: this.key,
      Authorization: `Bearer ${this.key}`,
      /* the portal's own session, which schema.sql reads in portal_token() */
      ...(token ? { "x-portal-token": token } : {}),
      Prefer: "return=representation",
    };
  }
  async rest(method, path, { body, token, params } = {}) {
    const qs = params ? "?" + new URLSearchParams(params) : "";
    const res = await fetch(`${this.url}/rest/v1/${path}${qs}`, { method, headers: this.headers(token), body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    let data; try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
    if (!res.ok) throw new ApiError(res.status, (data && data.message) || `Supabase request failed (${res.status}).`);
    return data;
  }
  async rpc(fn, args, token) {
    return this.rest("POST", `rpc/${fn}`, { body: args, token });
  }

  async requestAccess(request) { return this.rpc("portal_request_access", { p_request: request }); }
  async enquire(enquiry) { return this.rpc("portal_enquire", { p_enquiry: enquiry }); }
  async publicFacts() {
    const out = await this.rpc("portal_public_facts", {});
    return Array.isArray(out) ? out[0] : out;
  }

  /* Sign-in is a Postgres function so the password is checked by the database,
     never by the page, and the hash never travels. */
  async login(email, password) {
    const out = await this.rpc("portal_login", { p_email: String(email), p_password: String(password) });
    const row = Array.isArray(out) ? out[0] : out;
    if (!row || !row.token) throw new ApiError(401, (row && row.error) || "Those sign-in details are not recognised.");
    return { token: row.token, staff: row.staff };
  }
  async logout(token) { try { await this.rpc("portal_logout", {}, token); } catch (_) {} }
  async state(token) {
    const out = await this.rpc("portal_state", {}, token);
    return Array.isArray(out) ? out[0] : out;
  }
  async familyState(token) {
    const out = await this.rpc("portal_family_state", {}, token);
    return Array.isArray(out) ? out[0] : out;
  }

  async gateStatus() {
    const out = await this.rpc("portal_gate_status", {});
    return Array.isArray(out) ? out[0] : out;
  }
  async checkGate(audience, pin) {
    try {
      const out = await this.rpc("portal_gate_check", { p_audience: audience, p_pin: String(pin || "") });
      return Array.isArray(out) ? out[0] : out;
    } catch (e) { return { ok: false, reason: e.message }; }
  }

  /* ------------------------------------------------------------------------
     Turning one of Store's operations into one Postgres function call.

     Store speaks in the Node server's paths, because that is what it talks to
     most of the time. PostgREST takes a function name and named arguments, so
     the translation has to be explicit: deriving a function name from a path
     that contains an id ("records/staff/s01") would invent a function that
     does not exist, and passing the body straight through would miss the
     argument names the function actually declares.
     ------------------------------------------------------------------------ */
  callFor(op) {
    const body = op.body || {};
    const path = String(op.path || "");
    const seg = path.split("/").filter(Boolean);

    /* Where Store already named the function, it knows best. */
    if (op.fn && !/[^a-z_]/.test(op.fn)) {
      if (op.fn === "portal_set_password") return { fn: op.fn, args: { p_staff_id: body.staffId || null, p_password: body.password, p_current: body.currentPassword ?? null, p_must_change: !!body.mustChange } };
      if (op.fn === "portal_family_set_password") return { fn: op.fn, args: { p_current: body.currentPassword ?? null, p_password: body.password } };
      if (op.fn === "portal_family_absence") return { fn: op.fn, args: { p_pupil_id: body.pupilId, p_date: body.date, p_reason: body.reason ?? null, p_note: body.note ?? null } };
      if (op.fn === "portal_family_message") return { fn: op.fn, args: { p_pupil_id: body.pupilId, p_subject: body.subject ?? null, p_body: body.body } };
      if (op.fn === "portal_family_details") return { fn: op.fn, args: { p_phone: body.phone ?? null, p_relationship: body.relationship ?? null } };
      if (op.fn === "portal_family_seen") return { fn: op.fn, args: { p_key: body.key || body.pupilId } };
    }

    if (seg[0] === "records" && seg[1] && seg[2]) return { fn: "portal_put", args: { p_collection: seg[1], p_id: seg[2], p_data: body } };
    if (seg[0] === "auth" && seg[1] === "password") {
      return seg[2]
        ? { fn: "portal_set_password", args: { p_staff_id: seg[2], p_password: body.password ?? "", p_current: null, p_must_change: !!body.mustChange } }
        : { fn: "portal_set_password", args: { p_staff_id: null, p_password: body.password, p_current: body.currentPassword ?? null, p_must_change: false } };
    }
    if (seg[0] === "portal" && seg[1] === "invite") {
      return { fn: "portal_family_invite", args: {
        p_pupil_id: body.pupilId, p_email: body.email ?? null, p_name: body.name ?? null,
        p_relationship: body.relationship ?? null, p_phone: body.phone ?? null, p_password: body.password ?? null,
        p_must_change: !!body.mustChange } };
    }
    if (seg[0] === "portal" && seg[1] === "accounts" && seg[2] === undefined) return null;
    if (seg[0] === "portal" && seg[1] === "accounts" && seg[3] === "reset") return { fn: "portal_family_reset", args: { p_guardian_id: seg[2], p_password: body.password ?? null, p_must_change: !!body.mustChange } };
    if (seg[0] === "portal" && seg[1] === "accounts" && seg[3] === "close") return { fn: "portal_family_close", args: { p_guardian_id: seg[2] } };
    if (seg[0] === "portal" && seg[1] === "accounts" && seg[3] === "reopen") return { fn: "portal_family_reopen", args: { p_guardian_id: seg[2] } };
    if (seg[0] === "gate" && seg[1] === "code") return { fn: "portal_gate_set", args: { p_audience: body.audience, p_pin: body.pin ?? "" } };
    if (seg[0] === "access-requests" && seg[1] && seg[2]) return { fn: "portal_decide_access", args: { p_id: seg[1], p_decision: seg[2], p_role: body.role ?? null } };

    return null;
  }

  async write(token, ops) {
    const results = [];
    for (const op of ops) {
      if (op.kind === "record") results.push(await this.rpc("portal_put", { p_collection: op.collection, p_id: op.id, p_data: op.data }, token));
      else if (op.kind === "delete") results.push(await this.rpc("portal_delete", { p_collection: op.collection, p_id: op.id }, token));
      else if (op.kind === "setting") results.push(await this.rpc("portal_setting", { p_key: op.key, p_data: op.data }, token));
      else if (op.kind === "call") {
        const mapped = this.callFor(op);
        /* Better a clear refusal naming the path than a call to a function
           invented from it, which comes back as an unreadable PostgREST error. */
        if (!mapped) throw new ApiError(501, `This backend has no translation for "${op.path}". It is a Supabase deployment; see supabase/schema.sql.`);
        const out = await this.rpc(mapped.fn, mapped.args, token);
        results.push(Array.isArray(out) ? out[0] : out);
      }
    }
    return results;
  }

  /* Realtime: Postgres tells us when the changes table gains a row. */
  watch(token, onChange) {
    let stopped = false, ws = null, ping = null, retry = null;
    const connect = () => {
      if (stopped) return;
      const wsUrl = this.url.replace(/^http/, "ws") + `/realtime/v1/websocket?apikey=${encodeURIComponent(this.key)}&vsn=1.0.0`;
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        ws.send(JSON.stringify({
          topic: "realtime:public:changes", event: "phx_join", ref: "1",
          payload: { config: { postgres_changes: [{ event: "INSERT", schema: "public", table: "changes" }] }, access_token: token },
        }));
        ping = setInterval(() => { try { ws.send(JSON.stringify({ topic: "phoenix", event: "heartbeat", payload: {}, ref: String(Date.now()) })); } catch (_) {} }, 25000);
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          const rec = msg?.payload?.data?.record;
          if (rec) onChange({ seq: rec.seq, collection: rec.collection, id: rec.id, op: rec.op, by: rec.by, at: rec.at });
        } catch (_) {}
      };
      ws.onclose = () => { clearInterval(ping); if (!stopped) retry = setTimeout(connect, 4000); };
      ws.onerror = () => { try { ws.close(); } catch (_) {} };
    };
    connect();
    return () => { stopped = true; clearInterval(ping); if (retry) clearTimeout(retry); if (ws) try { ws.close(); } catch (_) {} };
  }
}
