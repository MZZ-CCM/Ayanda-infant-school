/* ==========================================================================
   API — every request is checked here, not in the browser.
   --------------------------------------------------------------------------
   The portal's own permission rules live in js/permissions.js and are shared
   with the frontend, so there is one definition of who may do what. The
   browser uses them to decide what to draw; this file uses them to decide
   what is allowed. A hand-written request gets the same answer as the UI.
   ========================================================================== */

const path = require("node:path");
const db = require("./db");
const auth = require("./auth");

const ROOT = path.resolve(__dirname, "..");
const P = require(path.join(ROOT, "js", "permissions.js"));
const D = require(path.join(ROOT, "js", "data.js"));
const Family = require(path.join(ROOT, "js", "family.js"));

class HttpError extends Error {
  constructor(status, message, detail) { super(message); this.status = status; this.detail = detail; }
}
const fail = (status, message, detail) => { throw new HttpError(status, message, detail); };

/* --- who may touch what -------------------------------------------------- */
/* read: null means "any signed-in member of staff" — things every page needs. */
const ACCESS = {
  staff:        { read: "staff.view",           write: "staff.manage",  create: "accounts.manage" },
  guardians:    { read: "portal.view",          write: "portal.manage" },
  absences:     { read: "attendance.view",      write: "attendance.mark", scoped: true },
  pupils:       { read: "pupils.view",          write: "pupils.edit",       create: "pupils.add", remove: "pupils.add", scoped: true },
  attendance:   { read: "attendance.view",      write: "attendance.mark",   scoped: true },
  messages:     { read: "messages.view",        write: "messages.send" },
  channels:     { read: "messages.view",        write: "messages.broadcast" },
  documents:    { read: "documents.view",       write: "documents.upload",  remove: "documents.manage" },
  events:       { read: "calendar.view",        write: "calendar.manage" },
  welfare:      { read: "welfare.view",         write: "welfare.log",       scoped: true },
  vacancies:    { read: "recruitment.view",     write: "recruitment.manage" },
  candidates:   { read: "recruitment.view",     write: "recruitment.manage" },
  applicants:   { read: "admissions.view",      write: "admissions.manage" },
  assessments:  { read: "gradebook.view",       write: "gradebook.mark",    scoped: true },
  invoices:     { read: "billing.view",         write: "billing.manage" },
  payments:     { read: "billing.view",         write: "billing.manage" },
  comms:        { read: "comms.view",           write: "comms.send" },
  alumni:       { read: "alumni.view",          write: "alumni.manage" },
  integrations: { read: "integrations.manage",  write: "integrations.manage" },
  board:        { read: "governance.view",      write: "governance.manage" },
  statutory:    { read: "governance.statutory", write: "governance.statutory" },
  budget:       { read: "finance.oversight",    write: "finance.oversight" },
  projects:     { read: "strategy.manage",      write: "strategy.manage" },
  audit:        { read: "audit.view",           write: null },    // written by the server only
  accessRequests: { read: "staff.manage",       write: "staff.manage" },
};

const SETTING_ACCESS = {
  school:        { read: null, write: "settings.manage" },
  classes:       { read: null, write: "staff.manage" },
  teams:         { read: null, write: "timetable.manage" },
  timetable:     { read: null, write: "timetable.manage" },
  gradeScale:    { read: null, write: "gradebook.scale" },
  feeItems:      { read: null, write: "config.manage" },
  feeRules:      { read: null, write: "config.manage" },
  docCategories: { read: "documents.view", write: "documents.manage" },
  commTemplates: { read: "comms.view",     write: "comms.send" },
  intakes:       { read: null, write: "config.manage" },
  strategy:      { read: null, write: "strategy.manage" },
  reads:         { read: null, write: null },   // each person's own read receipts
};

const allow = (staff, perm) => perm === null || P.can(staff, perm);
const require_ = (staff, perm, what) => { if (!allow(staff, perm)) fail(403, `Your role does not include "${P.PERMISSION_INFO[perm]?.label || perm}".`, { permission: perm, what }); };

/* --- scope: which classes this person may see ---------------------------- */
function classesInScope(staff) {
  const classes = db.setting("classes") || [];
  const byRole = P.classesInScope(staff, classes);
  if (byRole.length === classes.length) return classes;
  /* subject specialists also see every class they teach */
  const teams = db.setting("teams") || [];
  const timetable = db.setting("timetable") || {};
  const mine = new Set(teams.filter(t => t.teacherId === staff.id || t.assistantId === staff.id).map(t => t.id));
  const taught = classes.filter(c => D.DAYS.some(day => (timetable[c.id]?.[day] || []).some(cell => cell && mine.has(cell.t))));
  const ids = new Set([...byRole, ...taught].map(c => c.id));
  return classes.filter(c => ids.has(c.id));
}
const scopeIds = (staff) => new Set(classesInScope(staff).map(c => c.id));

/* --- the 15-minute register window, enforced here as well as in the UI --- */
function periodsThatTakeRegisters() { return D.PERIODS.filter(p => !p.kind || p.kind === "admin"); }

function slotFor(classId, date, periodId) {
  const classes = db.setting("classes") || [];
  const cls = classes.find(c => c.id === classId);
  const weekday = new Date(date + "T12:00:00").getDay();
  if (!cls || weekday === 0 || weekday === 6) return null;
  const day = D.DAYS[weekday - 1];
  if (periodId === "reg") return { subject: "Registration", teacherId: cls.teacherId, assistantId: cls.assistantId };
  const idx = D.PERIODS.filter(p => !p.kind).findIndex(p => p.id === periodId);
  const cell = ((db.setting("timetable") || {})[classId]?.[day] || [])[idx];
  if (!cell || !cell.t) return null;
  const team = (db.setting("teams") || []).find(t => t.id === cell.t);
  return team ? { subject: cell.s, teamId: team.id, teacherId: team.teacherId, assistantId: team.assistantId } : null;
}

function windowFor(date, periodId) {
  const p = periodsThatTakeRegisters().find(x => x.id === periodId);
  if (!p) return null;
  const lockMinutes = Number((db.setting("school") || {}).lockMinutes ?? 15);
  const start = new Date(`${date}T${p.start}:00`);
  const lockAt = new Date(start.getTime() + lockMinutes * 60000);
  const now = new Date();
  return { start, lockAt, state: now < start ? "upcoming" : now <= lockAt ? "open" : "locked" };
}

/* The same rule the Attendance page draws, applied to the request itself. */
function assertCanMark(staff, classId, date, periodId) {
  require_(staff, "attendance.mark");
  const slot = slotFor(classId, date, periodId);
  if (!slot) fail(422, "No register is taken for that period.");
  const onTeam = slot.teacherId === staff.id || slot.assistantId === staff.id;
  const wholeSchool = P.ROLES[staff.role].scope === "all" || (staff.grants || []).includes("scope.all");
  if (!onTeam && !wholeSchool) fail(403, "That register is taken by the pair teaching the period.");
  const win = windowFor(date, periodId);
  if (!win) fail(422, "Unknown period.");
  if (win.state === "upcoming") fail(422, `That register opens at ${win.start.toTimeString().slice(0, 5)}.`);
  if (win.state === "locked" && !P.can(staff, "attendance.edit_past")) {
    fail(403, `That register locked at ${win.lockAt.toTimeString().slice(0, 5)}. Only holders of "Amend locked registers" can change it now.`);
  }
  return { slot, window: win, amending: win.state === "locked" };
}

/* --- audit --------------------------------------------------------------- */
function audit(staff, action) {
  const id = `au_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
  db.put("audit", id, { id, at: db.now(), by: staff ? staff.id : null, action }, staff?.id);
  return id;
}

/* --- reading the world --------------------------------------------------- */
/* One call returns everything the signed-in person is allowed to see, already
   scoped, so the browser holds a correct partial copy rather than the school. */
function state(staff) {
  const out = { serverSeq: db.latestSeq(), now: db.now(), me: staff.id };
  const ids = scopeIds(staff);

  for (const [key, rule] of Object.entries(SETTING_ACCESS)) {
    if (!allow(staff, rule.read)) continue;
    const value = db.setting(key);
    if (value !== null) out[key] = value;
  }
  /* each person only gets their own read receipts */
  if (out.reads) out.reads = Object.fromEntries(Object.entries(out.reads).filter(([k]) => k.startsWith(staff.id + "|")));

  for (const [collection, rule] of Object.entries(ACCESS)) {
    if (!allow(staff, rule.read)) { out[collection] = Array.isArray(db.all(collection)) ? [] : []; continue; }
    if (collection === "attendance") { out.attendance = scopedAttendance(staff, ids); continue; }
    let rows = db.all(collection);
    if (rule.scoped && ids.size < (db.setting("classes") || []).length) rows = rows.filter(r => inScope(collection, r, ids, staff));
    if (collection === "staff") rows = rows.map(publicStaff);
    if (collection === "pupils" && !P.can(staff, "pupils.view_medical")) rows = rows.map(redactMedical);
    if (collection === "audit") rows = rows.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 300);
    out[collection] = rows;
  }

  /* Whether each door has a code, for the Settings page. The codes themselves
     are hashed in a setting that is deliberately absent from SETTING_ACCESS,
     so they are never in a response to begin with. */
  if (P.can(staff, "settings.manage")) {
    const g = db.setting("gate") || {};
    out.gateStatus = Object.fromEntries(["staff", "family"].map(a => [a, {
      required: !!(g[a] && g[a].hash), setAt: (g[a] && g[a].setAt) || null, setBy: (g[a] && g[a].setBy) || null,
    }]));
  }

  /* everyone needs the staff directory to render names, even without staff.view */
  if (!out.staff || !out.staff.length) out.staff = db.all("staff").map(minimalStaff);
  return out;
}

function inScope(collection, row, ids, staff) {
  if (collection === "pupils" || collection === "assessments") return ids.has(row.classId);
  if (collection === "absences") { const p = db.get("pupils", row.pupilId); return !!p && ids.has(p.classId); }
  if (collection === "welfare") return ids.has(row.classId) || row.reportedBy === staff.id;
  return true;
}

/* Attendance is the biggest table; send only the classes in scope, and only
   the current term, which is all any page actually reads. */
function scopedAttendance(staff, ids) {
  const term = (db.setting("school") || {}).term || {};
  const pupils = db.all("pupils").filter(p => ids.has(p.classId));
  const allowed = new Set(pupils.map(p => p.id));
  const out = {};
  for (const [key, row] of Object.entries(db.map("attendance"))) {
    const [date, , pupilId] = key.split("|");
    if (!allowed.has(pupilId)) continue;
    if (term.start && date < term.start) continue;
    out[key] = row;
  }
  return out;
}

/* Never send a credential, and never send another person's overrides to
   someone who cannot administer them. */
function publicStaff(s) { const { pin, password, ...rest } = s; return rest; }

/* Allergies and conditions are restricted. The UI hides them; this makes sure
   they were never in the response to hide in the first place. */
function redactMedical(p) {
  return { ...p, medical: { allergies: "", conditions: "", doctor: "", restricted: true } };
}
/* ==========================================================================
   The family portal's own read
   --------------------------------------------------------------------------
   A guardian never goes through state() above. That function starts from the
   whole school and removes what the person may not see; this one starts from
   the child and adds nothing else. Getting a filter wrong leaks; getting this
   wrong shows a parent a blank page.
   ========================================================================== */
function familyState(guardian) {
  const wanted = new Set(guardian.pupilIds || []);
  const pupils = db.all("pupils").filter(p => wanted.has(p.id));
  const classIds = new Set(pupils.map(p => p.classId));

  /* Attendance is the one big table. Pull only these children's rows. */
  const attendance = {};
  for (const [key, row] of Object.entries(db.map("attendance"))) {
    if (wanted.has(key.split("|")[2])) attendance[key] = row;
  }

  const source = {
    school: db.setting("school") || {},
    classes: (db.setting("classes") || []).filter(c => classIds.has(c.id)),
    teams: db.setting("teams") || [],
    timetable: db.setting("timetable") || {},
    gradeScale: db.setting("gradeScale") || D.GRADE_SCALE,
    staff: db.all("staff").map(minimalStaff),
    pupils, attendance,
    assessments: db.all("assessments").filter(a => classIds.has(a.classId)),
    invoices: db.all("invoices").filter(i => wanted.has(i.pupilId)),
    payments: db.all("payments").filter(x => wanted.has(x.pupilId)),
    comms: db.all("comms").filter(c => (c.pupilId ? wanted.has(c.pupilId) : (!c.classId || classIds.has(c.classId)))),
    absences: db.all("absences").filter(a => wanted.has(a.pupilId)),
    events: db.all("events"),
    documents: db.all("documents"),
  };
  return { ...Family.build(source, guardian, db.now().slice(0, 10)), serverSeq: db.latestSeq() };
}

/* A guardian record carries no credential, but it does carry the list of
   children it reaches, so it is only ever sent to staff who may see it. */
function publicGuardian(g) { const { password, pin, ...rest } = g; return rest; }

function minimalStaff(s) {
  return { id: s.id, first: s.first, last: s.last, title: s.title, role: s.role, active: s.active, grants: [], revokes: [], extraClasses: [] };
}

/* --- what anyone may be told --------------------------------------------
   The public website quotes the school's fees, intakes and class names, and
   it has no session with which to ask for them. This is the one open read in
   the API, and it is narrow by construction: js/data.js names the fields it
   will publish, so nothing added to a setting later leaks by default. The
   door codes live in a setting of their own and are not among them. */
function publicFacts() {
  return D.publicFacts({
    school: db.setting("school"),
    classes: db.setting("classes"),
    intakes: db.setting("intakes"),
    feeItems: db.setting("feeItems"),
    feeRules: db.setting("feeRules"),
    gradeScale: db.setting("gradeScale"),
  });
}

module.exports = { HttpError, fail, ACCESS, SETTING_ACCESS, allow, require_, classesInScope, scopeIds,
  publicFacts,
  slotFor, windowFor, assertCanMark, audit, state, familyState, publicStaff, publicGuardian,
  redactMedical, periodsThatTakeRegisters, P, D, Family };
