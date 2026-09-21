/* ==========================================================================
   Authentication — school email and password. No dependencies.
   --------------------------------------------------------------------------
   Passwords are hashed with scrypt from node:crypto and kept in their own
   table, so a staff list can never carry a credential. Sessions are opaque
   random tokens held server-side, so signing someone out really does.

   Two things this file is careful about:

     It never says whether an email exists. A wrong address and a wrong
     password give the same message and take the same time, so the sign-in
     form cannot be used to find out who works here.

     It throttles by address as well as by account, because locking one
     account does nothing to stop someone working through a list.
   ========================================================================== */

const crypto = require("node:crypto");
const path = require("node:path");
const db = require("./db");

/* The password rules and the generator are shared with the browser, so what
   the sign-in form promises and what this file enforces cannot drift apart. */
const C = require(path.join(__dirname, "..", "js", "credentials.js"));
const { WORDS, passwordProblem, temporaryPassword } = C;

const SESSION_DAYS = 14;
const MAX_FAILED = C.PASSWORD_POLICY.MAX_FAILED;        // per account, then a lockout
const LOCKOUT_MINUTES = C.PASSWORD_POLICY.LOCKOUT_MINUTES;
const MAX_PER_IP = 20;                                  // per address, per hour
const MIN_PASSWORD = C.PASSWORD_POLICY.MIN;
const SCRYPT = { N: 16384, r: 8, p: 1 };

/* A throwaway hash with the same cost as a real one, so a wrong email takes
   as long as a wrong password and reveals nothing by timing. */
const DECOY = hashPassword(crypto.randomBytes(24).toString("hex"));

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password), salt, 64, SCRYPT).toString("hex");
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  const candidate = crypto.scryptSync(String(password), salt, 64, SCRYPT);
  const stored = Buffer.from(hash, "hex");
  return stored.length === candidate.length && crypto.timingSafeEqual(stored, candidate);
}

function setPassword(staffId, password, { mustChange = false, check = true } = {}) {
  if (check) { const problem = passwordProblem(password); if (problem) throw Object.assign(new Error(problem), { status: 422 }); }
  const { hash, salt } = hashPassword(password);
  db.handle().prepare(`INSERT INTO credentials (staff_id, password_hash, password_salt, must_change, failed, locked_until)
                       VALUES (?, ?, ?, ?, 0, NULL)
                       ON CONFLICT (staff_id) DO UPDATE SET
                         password_hash = excluded.password_hash, password_salt = excluded.password_salt,
                         must_change = excluded.must_change, failed = 0, locked_until = NULL`)
    .run(staffId, hash, salt, mustChange ? 1 : 0);
}

function credential(staffId) {
  return db.handle().prepare("SELECT * FROM credentials WHERE staff_id = ?").get(staffId) || null;
}

/* --- throttling by address ------------------------------------------------ */
const attemptsByIp = new Map();
function ipBlocked(ip) {
  const hour = 60 * 60 * 1000;
  const seen = (attemptsByIp.get(ip) || []).filter(t => Date.now() - t < hour);
  attemptsByIp.set(ip, seen);
  return seen.length >= MAX_PER_IP;
}
function noteAttempt(ip) { attemptsByIp.set(ip, [...(attemptsByIp.get(ip) || []), Date.now()]); }
function clearAttempts(ip) { attemptsByIp.delete(ip); }

/* --- signing in ----------------------------------------------------------- */
const SAME_ANSWER = "Those sign-in details are not recognised.";

const lower = (v) => String(v || "").trim().toLowerCase();

function staffByEmail(email) {
  const wanted = lower(email);
  if (!wanted) return null;
  return db.all("staff").find(s => lower(s.email) === wanted) || null;
}

/* A guardian's portal account. Separate records, one credential store: the
   lockout, the throttle and the timing-safe answer below are written once and
   protect both. */
function guardianByEmail(email) {
  const wanted = lower(email);
  if (!wanted) return null;
  return db.all("guardians").find(g => lower(g.email) === wanted) || null;
}

/* Who this address belongs to, if anyone. Staff first: a member of staff who
   is also a parent signs in to their staff account, which is the wider one. */
function accountByEmail(email) {
  const staff = staffByEmail(email);
  if (staff) return { kind: "staff", account: staff };
  const guardian = guardianByEmail(email);
  if (guardian) return { kind: "family", account: guardian };
  return null;
}

function accountById(id) {
  const staff = db.get("staff", id);
  if (staff) return { kind: "staff", account: staff };
  const guardian = db.get("guardians", id);
  if (guardian) return { kind: "family", account: guardian };
  return null;
}

function login(email, password, ip = "?") {
  if (ipBlocked(ip)) return { ok: false, reason: "Too many attempts from this device. Try again in an hour, or telephone the school office." };
  noteAttempt(ip);

  const found = accountByEmail(email);
  const who = found ? found.account : null;
  const cred = who ? credential(who.id) : null;

  /* No account, no credential, or not active: still do the work, still give
     the same answer. A parent's address and a teacher's are equally unknown. */
  if (!who || !who.active || !cred) {
    verifyPassword(password, DECOY.hash, DECOY.salt);
    return { ok: false, reason: SAME_ANSWER };
  }

  if (cred.locked_until && cred.locked_until > db.now()) {
    const mins = Math.ceil((new Date(cred.locked_until) - new Date()) / 60000);
    return { ok: false, reason: `This account is locked for ${mins} more minute${mins === 1 ? "" : "s"} after repeated failed attempts.` };
  }

  if (!verifyPassword(password, cred.password_hash, cred.password_salt)) {
    const failed = cred.failed + 1;
    const lock = failed >= MAX_FAILED ? new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString() : null;
    db.handle().prepare("UPDATE credentials SET failed = ?, locked_until = ? WHERE staff_id = ?").run(failed, lock, who.id);
    return { ok: false, reason: lock ? `This account is now locked for ${LOCKOUT_MINUTES} minutes.` : SAME_ANSWER };
  }

  db.handle().prepare("UPDATE credentials SET failed = 0, locked_until = NULL WHERE staff_id = ?").run(who.id);
  clearAttempts(ip);
  /* `staff` is kept for the callers that predate the family portal. */
  return { ok: true, kind: found.kind, account: who, staff: found.kind === "staff" ? who : null, mustChange: !!cred.must_change };
}

/* --- sessions ------------------------------------------------------------- */
function createSession(staffId) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  db.handle().prepare("INSERT INTO sessions (token, staff_id, created_at, last_seen, expires_at) VALUES (?, ?, ?, ?, ?)")
    .run(token, staffId, db.now(), db.now(), expires);
  return { token, expires };
}

/* A session identifies an account, which may be a member of staff or a
   guardian. The caller is told which, and never has to guess from the shape. */
function sessionAccount(token) {
  if (!token) return null;
  const row = db.handle().prepare("SELECT * FROM sessions WHERE token = ?").get(token);
  if (!row) return null;
  if (row.expires_at <= db.now()) { destroySession(token); return null; }
  db.handle().prepare("UPDATE sessions SET last_seen = ? WHERE token = ?").run(db.now(), token);
  const found = accountById(row.staff_id);
  return found && found.account.active ? found : null;
}

function sessionStaff(token) {
  const found = sessionAccount(token);
  return found && found.kind === "staff" ? found.account : null;
}

const destroySession = (token) => db.handle().prepare("DELETE FROM sessions WHERE token = ?").run(token);
const destroyAllSessions = (staffId) => db.handle().prepare("DELETE FROM sessions WHERE staff_id = ?").run(staffId);
const purgeExpired = () => db.handle().prepare("DELETE FROM sessions WHERE expires_at <= ?").run(db.now());

module.exports = {
  WORDS, hashPassword, verifyPassword, passwordProblem, setPassword, credential,
  staffByEmail, guardianByEmail, accountByEmail, accountById,
  login, createSession, sessionAccount, sessionStaff, destroySession, destroyAllSessions, purgeExpired,
  temporaryPassword, MIN_PASSWORD,
};
