#!/usr/bin/env node
/* ==========================================================================
   Ayanda Infant School — portal server
   --------------------------------------------------------------------------
   Node 22+ and nothing else: no npm install, no build step. Serves the static
   portal and the API from one process, and pushes every change to the other
   signed-in browsers over Server-Sent Events, so a register marked in Room 3
   appears on the Head Teacher's dashboard without a refresh.

       node server/server.js            → http://localhost:4000
       PORT=8080 node server/server.js
   ========================================================================== */

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const db = require("./db");
const auth = require("./auth");
const api = require("./api");
const routes = require("./routes");
const seed = require("./seed");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT) || 4000;
const DB_FILE = process.env.AYANDA_DB || path.join(ROOT, "server", "data", "ayanda.db");
const ORIGINS = (process.env.AYANDA_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);

/* --- static files -------------------------------------------------------- */
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".pdf": "application/pdf", ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json", ".mp4": "video/mp4", ".webm": "video/webm",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function serveStatic(req, res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname === "/" ? "/index.html" : pathname); }
  catch (_) { return send(res, 400, "Bad request"); }        /* e.g. a stray % */
  rel = rel.replace(/^\/+/, "");
  if (rel.includes("\0")) return send(res, 400, "Bad request");

  /* Resolve, then check — so "a/../../etc/passwd" is caught after the .. is
     collapsed rather than before. */
  const file = path.resolve(ROOT, rel);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return send(res, 403, "Forbidden");
  if (/^(server|\.git|node_modules)(\/|$)/.test(rel)) return send(res, 404, "Not found");

  /* The guide to the portal is a labelled map of every page in it, so it is
     not part of the public site: index.html does not load it and the service
     worker does not cache it. The application fetches it after sign-in, with
     the session token on the request, which is what is checked here. Without
     one the answer is the same as for a file that is not there — saying
     "forbidden" would confirm it exists. A guardian's token is not enough;
     this describes the staff side. */
  if (rel === "js/guide.js" && !auth.sessionStaff(bearer(req))) return send(res, 404, "Not found");
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) return send(res, 404, "Not found");
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Content-Length": stat.size,
      /* The page, the worker and the manifest decide what version everyone
         else is on, so they are always revalidated. Cache one of these for
         five minutes and a deploy takes five minutes to reach anybody — or
         longer, because a stale worker keeps serving the shell it knows. */
      "Cache-Control": /^(index\.html|sw\.js|manifest\.webmanifest)$/.test(rel) ? "no-cache" : "public, max-age=300",
    });
    fs.createReadStream(file).pipe(res);
  });
}

/* --- helpers ------------------------------------------------------------- */
function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, { "Content-Type": typeof body === "string" ? "text/plain; charset=utf-8" : "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(payload), ...headers });
  res.end(payload);
}

function cors(req, res) {
  const origin = req.headers.origin;
  if (!origin) return;
  if (ORIGINS.length && !ORIGINS.includes(origin)) return;
  res.setHeader("Access-Control-Allow-Origin", ORIGINS.length ? origin : "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Max-Age", "600");
}

function readBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > limit) { reject(new api.HttpError(413, "Request too large.")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch (_) { reject(new api.HttpError(400, "Body is not valid JSON.")); }
    });
    req.on("error", reject);
  });
}

const clientIp = (req) => (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "?";

const bearer = (req) => (req.headers.authorization || "").replace(/^Bearer\s+/i, "") || null;

/* EventSource cannot set headers, so the live stream — and only the live
   stream — also accepts the token as a query parameter. Nothing is logged
   here, so it does not end up in an access log. */
function tokenFor(req, url) {
  return bearer(req) || (url && url.pathname.endsWith("/stream") ? url.searchParams.get("token") : null);
}

function requireAccount(req, url) {
  const who = auth.sessionAccount(tokenFor(req, url));
  if (!who) throw new api.HttpError(401, "Please sign in again.");
  return who;
}

function requireStaff(req, url) {
  const who = requireAccount(req, url);
  if (who.kind !== "staff") throw new api.HttpError(403, "That is a family portal sign-in.");
  return who.account;
}

/* --- live change stream (SSE) ------------------------------------------- */
const streams = new Set();

/* Works for either kind of account: the frames carry a collection and an id,
   never a record, so a guardian's browser learns only that something changed
   and re-asks for what it is allowed to see. */
function openStream(req, res, staff) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(`retry: 3000\n`);
  res.write(`event: hello\ndata: ${JSON.stringify({ seq: db.latestSeq(), me: staff.id })}\n\n`);

  const client = { res, staffId: staff.id };
  streams.add(client);

  const keepalive = setInterval(() => { try { res.write(": keepalive\n\n"); } catch (_) {} }, 25000);
  req.on("close", () => { clearInterval(keepalive); streams.delete(client); });
}

/* One change fans out to everyone signed in. The payload is deliberately thin —
   a collection and an id — so no browser is handed data its user may not read;
   each one re-fetches what it is allowed to see. */
db.subscribe((event) => {
  const frame = `event: change\ndata: ${JSON.stringify(event)}\n\n`;
  for (const client of streams) { try { client.res.write(frame); } catch (_) { streams.delete(client); } }
});

/* --- routing ------------------------------------------------------------- */
async function handleApi(req, res, url) {
  const seg = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const method = req.method.toUpperCase();

  /* open endpoints */
  if (seg[0] === "health") return send(res, 200, { ok: true, seeded: seed.isSeeded(), seq: db.latestSeq() });
  if (seg[0] === "auth" && seg[1] === "login" && method === "POST") return send(res, 200, routes.login(await readBody(req), clientIp(req)));
  if (seg[0] === "access-request" && method === "POST") return send(res, 200, routes.requestAccess(await readBody(req), clientIp(req)));
  if (seg[0] === "enquiry" && method === "POST") return send(res, 200, routes.enquire(await readBody(req), clientIp(req)));

  /* The door code. Open by necessity — it is asked for before anyone signs in —
     and it answers only whether a code exists and whether the one given is
     right, never what it is. */
  if (seg[0] === "public" && method === "GET") return send(res, 200, api.publicFacts());
  if (seg[0] === "gate" && !seg[1] && method === "GET") return send(res, 200, routes.gateStatus());
  if (seg[0] === "gate" && !seg[1] && method === "POST") return send(res, 200, routes.checkGate(await readBody(req), clientIp(req)));

  /* everything below needs a session */
  const who = requireAccount(req, url);

  /* A guardian's token opens the family portal and nothing else. Rather than
     checking for it at each of the staff endpoints below — where one missed
     check is a pupil list — it is diverted here, before any of them. */
  if (who.kind === "family") return handleFamily(req, res, url, seg, method, who.account);

  const staff = who.account;

  if (seg[0] === "auth") {
    if (seg[1] === "logout" && method === "POST") return send(res, 200, routes.logout(staff, bearer(req)));
    if (seg[1] === "me" && method === "GET") return send(res, 200, { staff: api.publicStaff(staff), permissions: [...api.P.effectivePerms(staff)] });
    if (seg[1] === "password" && method === "POST") return send(res, 200, routes.setPassword(staff, seg[2] || staff.id, await readBody(req)));
  }

  if (seg[0] === "state" && method === "GET") return send(res, 200, api.state(staff));
  if (seg[0] === "changes" && method === "GET") return send(res, 200, { seq: db.latestSeq(), changes: db.changesSince(url.searchParams.get("since") || 0) });
  if (seg[0] === "stream" && method === "GET") return openStream(req, res, staff);

  if (seg[0] === "records" && seg[1] && seg[2]) {
    if (method === "PUT") return send(res, 200, routes.putRecord(staff, seg[1], seg[2], await readBody(req)));
    if (method === "DELETE") return send(res, 200, routes.deleteRecord(staff, seg[1], seg[2]));
  }
  if (seg[0] === "settings" && seg[1] && method === "PUT") return send(res, 200, routes.putSetting(staff, seg[1], await readBody(req)));
  if (seg[0] === "gate" && seg[1] === "code" && method === "POST") return send(res, 200, routes.setGate(staff, await readBody(req)));

  if (seg[0] === "attendance" && method === "POST") return send(res, 200, routes.saveRegister(staff, await readBody(req)));
  if (seg[0] === "admissions" && seg[1] && seg[2] === "enrol" && method === "POST") return send(res, 200, routes.enrol(staff, seg[1]));
  if (seg[0] === "access-requests" && seg[1] && seg[2] && method === "POST") return send(res, 200, routes.decideAccessRequest(staff, seg[1], seg[2], await readBody(req)));
  if (seg[0] === "payments" && method === "POST") return send(res, 200, routes.recordPayment(staff, await readBody(req)));
  if (seg[0] === "comms" && method === "POST") return send(res, 200, routes.sendComm(staff, await readBody(req)));

  /* The office's side of the family portal. */
  if (seg[0] === "portal" && seg[1] === "invite" && method === "POST") return send(res, 200, routes.inviteFamily(staff, await readBody(req)));
  if (seg[0] === "portal" && seg[1] === "accounts" && seg[2] && seg[3] === "reset" && method === "POST") return send(res, 200, routes.resetFamily(staff, seg[2], await readBody(req)));
  if (seg[0] === "portal" && seg[1] === "accounts" && seg[2] && seg[3] === "close" && method === "POST") return send(res, 200, routes.closeFamily(staff, seg[2]));
  if (seg[0] === "portal" && seg[1] === "accounts" && seg[2] && seg[3] === "reopen" && method === "POST") return send(res, 200, routes.reopenFamily(staff, seg[2]));

  throw new api.HttpError(404, `No such endpoint: ${method} ${url.pathname}`);
}

/* --- the family portal's whole HTTP surface ------------------------------ */
/* Six endpoints, and every one of them is reached only with a guardian's own
   token. There is no route here that takes a class, a collection or a query:
   the account says which children it reaches and the rest follows from that. */
async function handleFamily(req, res, url, seg, method, guardian) {
  if (seg[0] === "auth" && seg[1] === "logout" && method === "POST") { auth.destroySession(bearer(req)); return send(res, 200, { ok: true }); }
  if (seg[0] === "auth" && seg[1] === "password" && method === "POST") return send(res, 200, routes.familySetPassword(guardian, await readBody(req)));
  if (seg[0] === "stream" && method === "GET") return openStream(req, res, guardian);

  if (seg[0] === "portal" || seg[0] === "state") {
    if ((seg[0] === "state" || seg[1] === "state") && method === "GET") return send(res, 200, api.familyState(guardian));
    if (seg[1] === "absence" && method === "POST") return send(res, 200, routes.reportAbsence(guardian, await readBody(req)));
    if (seg[1] === "message" && method === "POST") return send(res, 200, routes.familyMessage(guardian, await readBody(req)));
    if (seg[1] === "details" && method === "POST") return send(res, 200, routes.familyDetails(guardian, await readBody(req)));
    if (seg[1] === "seen" && method === "POST") return send(res, 200, routes.familySeen(guardian, await readBody(req)));
  }
  throw new api.HttpError(403, "The family portal does not reach that part of the school.");
}

const server = http.createServer(async (req, res) => {
  /* A request line the URL parser will not take — "//" and friends — must be a
     400, not the end of the process. */
  let url;
  try { url = new URL(req.url, `http://${req.headers.host || "localhost"}`); }
  catch (_) { return send(res, 400, "Bad request"); }

  cors(req, res);
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  try {
    if (!url.pathname.startsWith("/api")) return serveStatic(req, res, url.pathname);
    await handleApi(req, res, url);
  } catch (err) {
    if (err instanceof api.HttpError) return send(res, err.status, { error: err.message, ...(err.detail ? { detail: err.detail } : {}) });
    console.error("[error]", req.method, url.pathname, err);
    /* A single bad request must never take the school's portal down with it. */
    if (!res.headersSent) send(res, 500, { error: "Something went wrong on the server." });
  }
});

/* --- start --------------------------------------------------------------- */
function start() {
  db.open(DB_FILE);
  const result = seed.seed();
  if (result.seeded) {
    console.log(`\n  Seeded ${result.demo ? "the demo school" : "a fresh school"} — ${result.counts.pupils} pupils, ${result.counts.staff} staff.`);
    if (result.demo) console.log("  Every child and every member of staff here is invented. Do not put real records beside them.");
    console.log(`  Temporary passwords, shown once. Hand them over in person and they will be asked to change them:\n`);
    for (const a of result.issued.filter(x => x.kind !== "family")) console.log(`    ${a.email.padEnd(42)} ${a.password}   (${a.name})`);
    const families = result.issued.filter(x => x.kind === "family");
    if (families.length) {
      console.log(`\n  Family portal — ${families.length} account${families.length === 1 ? "" : "s"}, the first few:\n`);
      for (const a of families.slice(0, 5)) console.log(`    ${a.email.padEnd(42)} ${a.password}   (${a.name})`);
      if (families.length > 5) console.log(`    …and ${families.length - 5} more. Reset any of them from the pupil's record.`);
    }
    console.log("");
  }
  auth.purgeExpired();
  setInterval(() => auth.purgeExpired(), 60 * 60 * 1000).unref();

  server.listen(PORT, () => {
    console.log(`\n  Ayanda Infant School — portal server`);
    console.log(`  ------------------------------------`);
    console.log(`  portal   http://localhost:${PORT}`);
    console.log(`  api      http://localhost:${PORT}/api/health`);
    console.log(`  database ${DB_FILE}`);
    console.log(`  live     Server-Sent Events on /api/stream\n`);
  });
}

if (require.main === module) start();
module.exports = { server, start, handleApi, handleFamily };
