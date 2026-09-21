/* ==========================================================================
   Database — SQLite through node:sqlite (Node 22+). No dependencies.
   --------------------------------------------------------------------------
   Two shapes cover the whole school:

     records   every list of identified things (pupils, attendance, messages,
               invoices, board minutes…) as one row each, so two people editing
               different pupils never collide.
     settings  the handful of single documents (school profile, timetable,
               fee rules, teaching teams…).

   Every write also appends to `changes`, which is what the live feed replays
   to other signed-in browsers.
   ========================================================================== */

const { DatabaseSync } = require("node:sqlite");
const path = require("node:path");
const fs = require("node:fs");

/* Which top-level keys of the seed are lists of records, and how each row is
   indexed so the common queries stay fast. k1/k2/k3 are plain columns lifted
   out of the JSON. */
const COLLECTIONS = {
  staff:        { idKey: "id", index: (r) => [r.role, r.active ? "active" : "inactive", null] },
  guardians:    { idKey: "id", index: (r) => [r.email, r.active ? "active" : "inactive", null] },
  pupils:       { idKey: "id", index: (r) => [r.classId, r.status, null] },
  absences:     { idKey: "id", index: (r) => [r.pupilId, r.date, r.status] },
  attendance:   { idKey: null, index: (r, id) => id.split("|") },   // `${date}|${periodId}|${pupilId}`
  messages:     { idKey: "id", index: (r) => [r.channel, r.from, null] },
  documents:    { idKey: "id", index: (r) => [r.cat, r.owner, null] },
  events:       { idKey: "id", index: (r) => [r.date, r.kind, null] },
  welfare:      { idKey: "id", index: (r) => [r.classId, r.status, r.pupilId] },
  vacancies:    { idKey: "id", index: (r) => [r.status, r.classId, null] },
  candidates:   { idKey: "id", index: (r) => [r.vacancyId, r.stage, null] },
  applicants:   { idKey: "id", index: (r) => [r.intakeId, r.stage, r.targetGrade] },
  assessments:  { idKey: "id", index: (r) => [r.classId, r.subject, r.kind] },
  invoices:     { idKey: "id", index: (r) => [r.pupilId, r.term, null] },
  payments:     { idKey: "id", index: (r) => [r.pupilId, r.date, r.method] },
  comms:        { idKey: "id", index: (r) => [r.pupilId, r.classId, r.channel] },
  alumni:       { idKey: "id", index: (r) => [r.left.slice(0, 4), r.destination, null] },
  integrations: { idKey: "id", index: (r) => [r.cat, r.status, null] },
  board:        { idKey: "id", index: (r) => [r.date, r.status, null] },
  statutory:    { idKey: "id", index: (r) => [r.owner, r.expires, null] },
  budget:       { idKey: "id", index: (r) => [r.kind, null, null] },
  projects:     { idKey: "id", index: (r) => [r.status, r.owner, null] },
  channels:     { idKey: "id", index: (r) => [r.kind, null, null] },
  audit:        { idKey: null, index: (r) => [r.by, r.at.slice(0, 10), null] },
};

/* Single documents, stored whole. Small, read constantly, written rarely. */
const SETTINGS = ["school", "classes", "teams", "timetable", "gradeScale", "feeItems", "feeRules",
  "docCategories", "commTemplates", "intakes", "strategy", "reads"];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS records (
  collection TEXT NOT NULL,
  id         TEXT NOT NULL,
  data       TEXT NOT NULL,
  k1 TEXT, k2 TEXT, k3 TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (collection, id)
);
CREATE INDEX IF NOT EXISTS idx_records_k1 ON records (collection, k1);
CREATE INDEX IF NOT EXISTS idx_records_k2 ON records (collection, k2);
CREATE INDEX IF NOT EXISTS idx_records_k3 ON records (collection, k3);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

-- The live feed. Every write appends here; browsers replay from their last seq.
CREATE TABLE IF NOT EXISTS changes (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  collection TEXT NOT NULL,
  id         TEXT,
  op         TEXT NOT NULL,
  by         TEXT,
  at         TEXT NOT NULL
);

-- staff_id is an account id: a member of staff, or a guardian with a portal
-- sign-in. One session table means one place that expires and revokes them.
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  staff_id   TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen  TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_staff ON sessions (staff_id);

-- Credentials live here, never in the staff or guardian JSON, so they cannot
-- leak to a client. staff_id is an account id, of either kind.
CREATE TABLE IF NOT EXISTS credentials (
  staff_id      TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  must_change INTEGER NOT NULL DEFAULT 0,
  failed      INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT
);

CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

let db = null;

function open(file) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL");   // readers don't block the writer
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec(SCHEMA);
  return db;
}
function handle() {
  if (!db) throw new Error("Database not open. Call db.open(file) first.");
  return db;
}

const now = () => new Date().toISOString();

/* --- change feed --------------------------------------------------------- */
const listeners = new Set();
function note(collection, id, op, by) {
  handle().prepare("INSERT INTO changes (collection, id, op, by, at) VALUES (?, ?, ?, ?, ?)")
    .run(collection, id, op, by || null, now());
  const seq = handle().prepare("SELECT last_insert_rowid() AS seq").get().seq;
  const event = { seq, collection, id, op, by: by || null, at: now() };
  for (const fn of listeners) { try { fn(event); } catch (_) { /* a dead stream must not break the write */ } }
  return seq;
}
function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function changesSince(seq) {
  return handle().prepare("SELECT * FROM changes WHERE seq > ? ORDER BY seq LIMIT 500").all(Number(seq) || 0);
}
function latestSeq() {
  return handle().prepare("SELECT COALESCE(MAX(seq), 0) AS seq FROM changes").get().seq;
}

/* --- records ------------------------------------------------------------- */
function indexesFor(collection, id, row) {
  const spec = COLLECTIONS[collection];
  if (!spec) return [null, null, null];
  try { const k = spec.index(row, id) || []; return [k[0] ?? null, k[1] ?? null, k[2] ?? null]; }
  catch (_) { return [null, null, null]; }
}

function put(collection, id, row, by, { silent = false } = {}) {
  const [k1, k2, k3] = indexesFor(collection, id, row);
  handle().prepare(`INSERT INTO records (collection, id, data, k1, k2, k3, updated_at, updated_by, deleted)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
                    ON CONFLICT (collection, id) DO UPDATE SET
                      data = excluded.data, k1 = excluded.k1, k2 = excluded.k2, k3 = excluded.k3,
                      updated_at = excluded.updated_at, updated_by = excluded.updated_by, deleted = 0`)
    .run(collection, id, JSON.stringify(row), k1, k2, k3, now(), by || null);
  if (!silent) note(collection, id, "put", by);
  return row;
}

function get(collection, id) {
  const r = handle().prepare("SELECT data FROM records WHERE collection = ? AND id = ? AND deleted = 0").get(collection, id);
  return r ? JSON.parse(r.data) : null;
}

function all(collection, where = {}) {
  const clauses = ["collection = ?", "deleted = 0"]; const args = [collection];
  for (const [k, v] of Object.entries(where)) { if (v === undefined) continue; clauses.push(`${k} = ?`); args.push(v); }
  return handle().prepare(`SELECT data FROM records WHERE ${clauses.join(" AND ")}`).all(...args).map(r => JSON.parse(r.data));
}

/* Returned keyed by id — the shape the browser already expects for attendance. */
function map(collection, where = {}) {
  const clauses = ["collection = ?", "deleted = 0"]; const args = [collection];
  for (const [k, v] of Object.entries(where)) { if (v === undefined) continue; clauses.push(`${k} = ?`); args.push(v); }
  const out = {};
  for (const r of handle().prepare(`SELECT id, data FROM records WHERE ${clauses.join(" AND ")}`).all(...args)) out[r.id] = JSON.parse(r.data);
  return out;
}

function remove(collection, id, by) {
  handle().prepare("UPDATE records SET deleted = 1, updated_at = ?, updated_by = ? WHERE collection = ? AND id = ?")
    .run(now(), by || null, collection, id);
  note(collection, id, "delete", by);
}

function count(collection, where = {}) {
  const clauses = ["collection = ?", "deleted = 0"]; const args = [collection];
  for (const [k, v] of Object.entries(where)) { if (v === undefined) continue; clauses.push(`${k} = ?`); args.push(v); }
  return handle().prepare(`SELECT COUNT(*) AS n FROM records WHERE ${clauses.join(" AND ")}`).get(...args).n;
}

/* --- settings ------------------------------------------------------------ */
function setting(key) {
  const r = handle().prepare("SELECT data FROM settings WHERE key = ?").get(key);
  return r ? JSON.parse(r.data) : null;
}
function setSetting(key, value, by, { silent = false } = {}) {
  handle().prepare(`INSERT INTO settings (key, data, updated_at, updated_by) VALUES (?, ?, ?, ?)
                    ON CONFLICT (key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
    .run(key, JSON.stringify(value), now(), by || null);
  if (!silent) note("settings", key, "put", by);
  return value;
}

/* --- meta ---------------------------------------------------------------- */
function meta(key) { const r = handle().prepare("SELECT value FROM meta WHERE key = ?").get(key); return r ? r.value : null; }
function setMeta(key, value) {
  handle().prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(key, String(value));
}

/* Run a batch as one transaction: either the whole register saves or none of it does. */
function transaction(fn) {
  handle().exec("BEGIN");
  try { const out = fn(); handle().exec("COMMIT"); return out; }
  catch (e) { try { handle().exec("ROLLBACK"); } catch (_) {} throw e; }
}

module.exports = {
  COLLECTIONS, SETTINGS, open, handle, now,
  put, get, all, map, remove, count,
  setting, setSetting, meta, setMeta,
  note, subscribe, changesSince, latestSeq, transaction,
};
