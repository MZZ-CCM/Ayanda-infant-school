/* ==========================================================================
   Store: the school, in memory, kept in step with whichever backend is in use
   --------------------------------------------------------------------------
   Every view reads `Store.db` synchronously, exactly as it always has. What
   changed is the two ends: load() fills it from the backend, and save() works
   out what actually changed and sends only that. When the backend is shared,
   a live stream brings other people's changes back and the page re-renders.
   ========================================================================== */

const STORE_KEY = "ayanda.portal.v1";
const SESSION_KEY = "ayanda.portal.session";

/* Where the session token lives.

   On a shared backend it is localStorage, so closing the laptop and coming
   back tomorrow does not mean signing in again — the token is good for a
   fortnight and the server can revoke it.

   In demo mode it is sessionStorage, which is per tab. That is what lets one
   browser hold a teacher in one tab and a parent in another, so the published
   demo can actually show a message going from the staff side to the family
   side. localStorage is shared between tabs, and a single session key there
   would mean signing in twice only to find both tabs were the second person. */
function sessionStore(shared) {
  try { return shared ? localStorage : sessionStorage; } catch (_) { return null; }
}

/* Which top-level keys are lists of records, and what identifies a row.
   `null` means the key is already an object keyed by id (attendance). */
const RECORD_COLLECTIONS = {
  staff: "id", guardians: "id", accessRequests: "id", pupils: "id", absences: "id", attendance: null, messages: "id", channels: "id", documents: "id",
  events: "id", welfare: "id", vacancies: "id", candidates: "id", applicants: "id", assessments: "id",
  invoices: "id", payments: "id", comms: "id", alumni: "id", integrations: "id", board: "id",
  statutory: "id", budget: "id", projects: "id", audit: "id",
};
const SETTING_KEYS = ["school", "classes", "teams", "timetable", "gradeScale", "feeItems", "feeRules",
  "docCategories", "commTemplates", "intakes", "strategy", "reads"];

const Store = {
  db: null,
  session: null,
  backend: null,
  baseline: null,        // what the backend last confirmed, for working out changes
  pending: 0,            // writes in flight
  offline: false,
  unwatch: null,

  today() { return new Date().toISOString().slice(0, 10); },
  get shared() { return !!(this.backend && this.backend.shared); },

  /* --- start-up --------------------------------------------------------- */
  async init() {
    this.backend = await Backend.detect();
    try { this.session = JSON.parse(this.sessionBox().getItem(SESSION_KEY) || "null"); } catch (_) { this.session = null; }
    if (this.session) {
      try { await this.load(); }
      catch (e) { if (e.status === 401) this.logout(); else throw e; }
    }
    return this.backend;
  },

  /* Asking for an account. Open to anyone — it creates a request, not an
     account — so the backend rate-limits it and HR decides. */
  async requestAccess(request) {
    if (!this.shared) {
      const db = this.backend.read();
      db.accessRequests = db.accessRequests || [];
      db.accessRequests.unshift({ ...request, id: this.uid("ar"), at: new Date().toISOString(), status: "pending" });
      this.backend.write(null, [], db);
      return { ok: true };
    }
    return this.backend.requestAccess(request);
  },

  /* A family asking about a place. It becomes an enquiry at the head of the
     admissions pipeline — the same list the office already works from. */
  async enquire(enquiry) {
    if (!this.shared) {
      const db = this.backend.read();
      db.applicants = db.applicants || [];
      db.applicants.unshift({
        id: this.uid("a"), first: enquiry.childFirst, last: enquiry.childLast, gender: enquiry.gender || "F",
        dob: enquiry.dob || "", targetGrade: enquiry.targetGrade, intakeId: (db.intakes || [])[0]?.id || null,
        stage: "enquiry", appliedOn: this.today(), source: "Website", sibling: !!enquiry.sibling,
        guardian: { name: enquiry.guardianName, relationship: enquiry.relationship || "Guardian", phone: enquiry.phone || "", email: enquiry.email || "" },
        docs: { birth: false, clinic: false, photo: false, report: false, consent: false },
        baseline: "", offerSentOn: "", offerExpires: "", notes: enquiry.message || "",
      });
      this.backend.write(null, [], db);
      return { ok: true };
    }
    return this.backend.enquire(enquiry);
  },

  /* ----------------------------------------------------------------------
     The door code
     ----------------------------------------------------------------------
     Asked for before anyone signs in, so it goes through its own open
     endpoint on a shared backend, and through this browser's own store in
     demo mode. Passing it is remembered for the tab and no longer: close the
     browser and the school asks again.
     ---------------------------------------------------------------------- */
  /* ----------------------------------------------------------------------
     The school's own figures, for people who are not signed in
     ----------------------------------------------------------------------
     The public site quotes fees, intakes, places left and class names. Signed
     in, it can read them off Store.db. Signed out there is no db at all, and
     it used to fall back to the constants in js/data.js — so the office could
     move an intake or change a fee and the website would go on advertising
     the old one. This fetches the publishable slice, once per page load.
     ---------------------------------------------------------------------- */
  facts: null,
  _factsAsked: false,
  async loadPublic() {
    if (this._factsAsked) return this.facts;
    this._factsAsked = true;
    try {
      this.facts = await this.backend.publicFacts();
    } catch (_) { this.facts = null; }    // the constants remain the fallback
    return this.facts;
  },

  gateStatusCache: null,

  async gateStatus() {
    if (!this.shared) return DemoGate.status();
    if (this.gateStatusCache) return this.gateStatusCache;
    try {
      const out = await this.backend.gateStatus();
      this.gateStatusCache = out;
      return out;
    } catch (_) {
      /* Unreachable is not the same as unlocked, but refusing to draw the page
         at all helps nobody — the password behind it is the real check. */
      return { staff: { required: false }, family: { required: false } };
    }
  },

  async checkGate(audience, pin) {
    const out = this.shared ? await this.backend.checkGate(audience, pin) : await DemoGate.check(audience, pin);
    if (!out.ok) throw new ApiError(401, out.reason || "That code is not right.");
    this.passGate(audience);
    return out;
  },

  gatePassed(audience) { try { return sessionStorage.getItem(`ayanda.gate.${audience}`) === "1"; } catch (_) { return true; } },
  passGate(audience) { try { sessionStorage.setItem(`ayanda.gate.${audience}`, "1"); } catch (_) {} },

  async setGate(audience, pin) {
    if (this.shared) { const out = await this.request("gate/code", { audience, pin }); this.gateStatusCache = null; return out; }
    await DemoGate.set(audience, pin, this.session && this.session.staffId);
    return { ok: true, status: DemoGate.status() };
  },

  /* --- session ---------------------------------------------------------- */
  async login(email, password) {
    const out = await this.backend.login(email, password);
    const family = out.kind === "family";
    const who = family ? out.account : out.staff;
    this.session = {
      kind: family ? "family" : "staff",
      staffId: who.id,                    // the account id, whichever kind it is
      token: out.token, at: new Date().toISOString(), mustChange: !!out.mustChange,
    };
    this.persistSession();
    await this.load();
    this.watch();
    return who;
  },

  logout() {
    if (this.unwatch) { this.unwatch(); this.unwatch = null; }
    this.gateStatusCache = null;
    const token = this.session?.token;
    this.session = null; this.db = null; this.baseline = null;
    try { this.sessionBox().removeItem(SESSION_KEY); } catch (_) {}
    /* An older build kept it in localStorage; clear that too or it comes back. */
    try { localStorage.removeItem(SESSION_KEY); } catch (_) {}
    if (token && this.backend) this.backend.logout(token);
  },

  me() { return this.session && this.db && !this.isFamily ? this.staff(this.session.staffId) : null; },

  /* A family sign-in. It holds a different database — one built around the
     account's own children — so nothing that reads Store.db as the school
     should ever run while this is true. */
  get isFamily() { return !!(this.session && this.session.kind === "family"); },
  /* Not `account()`: that name already belongs to a pupil's fee account
     further down this object, and the later one would quietly win. */
  familyAccount() { return this.isFamily && this.db ? this.db.account : null; },
  /* The person signed in, of whichever kind, for the few places that only
     need a first name to say hello. */
  whoami() {
    if (this.isFamily) { const a = this.familyAccount(); return a ? { first: (a.name || "").split(" ")[0] || a.name, name: a.name } : null; }
    const me = this.me();
    return me ? { first: me.first, name: `${me.title} ${me.first} ${me.last}` } : null;
  },

  /* Signed in on a password somebody else chose. Until they pick their own,
     that password is still written on a piece of paper somewhere. */
  get mustChangePassword() { return !!(this.session && this.session.mustChange); },
  async setOwnPassword(currentPassword, password) {
    if (!this.shared) {
      await this.backend.changeOwnPassword(this.session.staffId, currentPassword, password);
      this.session.mustChange = false; this.persistSession(); return { ok: true };
    }
    if (this.isFamily) {
      await this.backend.write(this.session.token, [{ kind: "call", method: "POST", path: "auth/password", body: { currentPassword, password }, fn: "portal_family_set_password" }]);
      this.session.mustChange = false; this.persistSession(); return { ok: true };
    }
    await this.backend.write(this.session.token, [{ kind: "call", method: "POST", path: "auth/password", body: { currentPassword, password }, fn: "portal_set_password" }]);
    this.session.mustChange = false;
    this.persistSession();
    return { ok: true };
  },
  sessionBox() { return sessionStore(this.shared) || { getItem: () => null, setItem() {}, removeItem() {} }; },
  persistSession() { try { this.sessionBox().setItem(SESSION_KEY, JSON.stringify(this.session)); } catch (_) {} },

  /* --- loading ---------------------------------------------------------- */
  async load() {
    if (this.isFamily) {
      const fn = this.backend.familyState ? "familyState" : "state";
      const state = await this.backend[fn](this.session.token);
      if (!state || state.kind !== "family") throw new ApiError(401, "Please sign in again.");
      this.db = state;
      this.baseline = null;      // a family writes through named calls, never a diff
      this.offline = false;
      return this.db;
    }
    const state = await this.backend.state(this.session.token);
    this.db = this.normalise(state);
    this.baseline = this.snapshot(this.db);
    this.offline = false;
    return this.db;
  },

  /* The backend sends lists; the views expect the shapes they always had. */
  normalise(state) {
    const db = { ...state };
    db.attendance = state.attendance || {};
    db.reads = state.reads || {};
    for (const key of Object.keys(RECORD_COLLECTIONS)) if (!db[key]) db[key] = RECORD_COLLECTIONS[key] === null ? {} : [];
    for (const key of SETTING_KEYS) if (db[key] === undefined) db[key] = null;
    db.audit = (db.audit || []).sort((a, b) => b.at.localeCompare(a.at));
    return db;
  },

  /* --- working out what changed ----------------------------------------- */
  /* A map of every row as JSON, so a save can tell precisely which records the
     user touched and send those alone. */
  snapshot(db) {
    const snap = { records: {}, settings: {} };
    for (const [collection, idKey] of Object.entries(RECORD_COLLECTIONS)) {
      const bucket = snap.records[collection] = {};
      const value = db[collection];
      if (!value) continue;
      if (idKey === null) for (const [id, row] of Object.entries(value)) bucket[id] = JSON.stringify(row);
      else for (const row of value) bucket[String(row[idKey])] = JSON.stringify(row);
    }
    for (const key of SETTING_KEYS) snap.settings[key] = JSON.stringify(db[key] ?? null);
    return snap;
  },

  diff() {
    if (!this.baseline) return [];
    const now = this.snapshot(this.db); const ops = [];
    for (const collection of Object.keys(RECORD_COLLECTIONS)) {
      const before = this.baseline.records[collection] || {};
      const after = now.records[collection] || {};
      for (const [id, json] of Object.entries(after)) if (before[id] !== json) ops.push({ kind: "record", collection, id, data: JSON.parse(json) });
      for (const id of Object.keys(before)) if (!(id in after)) ops.push({ kind: "delete", collection, id });
    }
    for (const key of SETTING_KEYS) if (now.settings[key] !== this.baseline.settings[key]) ops.push({ kind: "setting", key, data: JSON.parse(now.settings[key]) });
    return ops;
  },

  /* --- saving ------------------------------------------------------------ */
  /* Views call save() after changing Store.db, as they always have. On a
     shared backend this sends the difference; in demo mode it writes the blob. */
  save() {
    if (!this.db || this.isFamily) return;
    if (!this.shared) { this.backend.write(null, [], this.db); this.baseline = this.snapshot(this.db); return; }   // `storage` tells the other tabs
    const ops = this.diff();
    if (!ops.length) return;
    this.push(ops);
  },

  async push(ops) {
    this.pending++;
    try {
      await this.backend.write(this.session.token, ops);
      this.baseline = this.snapshot(this.db);
      this.offline = false;
    } catch (e) {
      /* The server refused or is unreachable: put the screen back to the last
         state the server confirmed rather than leaving a convincing lie on it. */
      this.offline = e.status === 0;
      await this.revert();
      if (typeof App !== "undefined") {
        App.toast(e.status === 0 ? "Not saved — the server is unreachable." : e.message, "err");
        App.render();
      }
    } finally { this.pending--; }
  },

  async revert() {
    try { await this.load(); } catch (_) { /* keep what we have if even reloading fails */ }
  },

  /* A call that needs the server to do something as a unit (enrolling an
     applicant raises their first invoice in the same breath). */
  async request(path, body, method = "POST") {
    if (!this.shared) return null;
    const out = await this.backend.write(this.session.token, [{ kind: "call", path, body, method, fn: path.replace(/\W+/g, "_") }]);
    await this.load();
    return out[0];
  },

  /* ----------------------------------------------------------------------
     What a family may write
     ----------------------------------------------------------------------
     Three calls, matching the three server endpoints. In demo mode there is
     no server, so the same records are written into the local blob using the
     same builder the server uses — the portal behaves identically either way.
     ---------------------------------------------------------------------- */
  async portal(action, body) {
    if (!this.isFamily) throw new Error("Not a family sign-in.");
    if (this.shared) {
      const out = await this.backend.write(this.session.token, [{ kind: "call", method: "POST", path: `portal/${action}`, body, fn: `portal_family_${action}` }]);
      await this.load();
      return out[0];
    }
    const db = this.backend.read();
    const account = this.familyAccount();
    const mine = new Set(account.pupilIds || []);
    if (body.pupilId && !mine.has(body.pupilId)) throw new Error("That is not one of your children.");
    if (body.key && body.key !== "notices" && !mine.has(body.key)) throw new Error("That is not one of your children.");

    if (action === "absence") {
      db.absences = db.absences || [];
      db.absences.unshift(Family.absenceNote({ id: this.uid("ab"), pupilId: body.pupilId, date: body.date, reason: body.reason, note: body.note, account }));
    } else if (action === "message") {
      const pupil = (db.pupils || []).find(p => p.id === body.pupilId);
      db.comms = db.comms || [];
      db.comms.unshift(Family.guardianMessage({ id: this.uid("cm"), pupilId: body.pupilId, classId: pupil ? pupil.classId : null, subject: body.subject, body: body.body, account }));
    } else if (action === "seen") {
      const g = (db.guardians || []).find(x => x.id === account.id);
      if (g) Object.assign(g, Family.markSeen(g, String(body.key || body.pupilId), new Date().toISOString()));
    } else if (action === "details") {
      const g = (db.guardians || []).find(x => x.id === account.id);
      if (g) { g.phone = String(body.phone || "").trim(); g.relationship = String(body.relationship || g.relationship); }
    }
    this.backend.write(null, [], db);
    await this.load();
    return { ok: true };
  },

  /* --- other people's changes ------------------------------------------- */
  /* Demo mode watches too — other tabs of this browser rather than other
     people — so a message sent on the staff side reaches the family side
     without a refresh, published site or not. */
  watch() {
    if (this.unwatch || !this.backend.watch) return;
    let timer = null;
    this.unwatch = this.backend.watch(this.session.token, (change) => {
      if (change.by && change.by === this.session.staffId) return;    // our own write, already applied
      clearTimeout(timer);
      timer = setTimeout(() => this.refresh(change), 400);            // several changes at once = one refresh
    });
  },

  async refresh(change) {
    if (this.pending) return;          // don't pull the rug from under a save in flight
    try {
      await this.load();
      if (typeof App !== "undefined" && (App.me() || this.isFamily)) {
        App.render();
        if (change) App.liveNotice(change);
      }
    } catch (_) { /* a failed refresh is not worth interrupting anyone for */ }
  },

  /* The whole school in one plain-JSON file: the roll, the registers, the
     marks, the fee accounts, the messages and the audit log. It is the only
     copy anybody gets out of a browser-held school, so it is readable without
     this software and stays that way. */
  exportJSON() { return JSON.stringify(this.db, null, 2); },

  async reset() {
    if (!this.shared) {
      /* backend.reset() clears the sign-ins along with the school, so there is
         nothing left to be signed in as. */
      this.backend.reset();
      this.logout();
      return;
    }
    throw new Error("Resetting a shared school is done on the server, not from a browser.");
  },

  /* ----------------------------------------------------------------------
     Issuing sign-ins in demo mode
     ----------------------------------------------------------------------
     On a shared backend the server does this and hands back the password.
     There is no server here, so the same two operations are done against the
     browser's own credential store — and the password is whatever the person
     issuing it typed or generated, exactly as it is on the server.
     ---------------------------------------------------------------------- */
  get demoNeedsSetup() { return !this.shared && !DemoCredentials.any(); },

  /* Who the setup panel offers on a first visit: the most senior account in
     whatever school this browser holds. */
  demoFirstAccount() {
    if (this.shared) return null;
    const db = this.backend.read();
    const staff = (db.staff || []).filter(s => s.active && s.email);
    if (!staff.length) return null;
    return staff.slice().sort((a, b) => (ROLES[a.role]?.tier ?? 99) - (ROLES[b.role]?.tier ?? 99))[0];
  },

  async demoIssue(accountId, password, { mustChange = false } = {}) {
    if (this.shared) throw new Error("A shared school issues its sign-ins on the server.");
    await this.backend.issue(accountId, password, { mustChange });
    return { ok: true, password };
  },

  /* --- lookups --- */
  staff(id) { return this.db.staff.find(s => s.id === id) || null; },
  staffName(id, opts = {}) {
    const s = this.staff(id); if (!s) return "Unknown";
    return opts.short ? `${s.first} ${s.last}` : `${s.title} ${s.first} ${s.last}`;
  },
  cls(id) { return this.db.classes.find(c => c.id === id) || null; },
  team(id) { return (this.db.teams || []).find(t => t.id === id) || null; },
  teamsOf(staffId) { return (this.db.teams || []).filter(t => t.teacherId === staffId || t.assistantId === staffId); },
  /* Classes a staff member teaches in, according to the timetable. */
  classesTaughtBy(staffId) {
    const ids = new Set(this.teamsOf(staffId).map(t => t.id));
    return this.db.classes.filter(c => DAYS.some(d => (this.db.timetable[c.id]?.[d] || []).some(cell => cell && ids.has(cell.t))));
  },
  pupil(id) { return this.db.pupils.find(p => p.id === id) || null; },
  pupilsIn(classId) { return this.db.pupils.filter(p => p.classId === classId && p.status === "active").sort((a, b) => a.last.localeCompare(b.last) || a.first.localeCompare(b.first)); },
  /* Attendance record for one pupil in one period ("reg" = morning registration). */
  att(date, pupilId, periodId = "reg") { return this.db.attendance[`${date}|${periodId}|${pupilId}`] || null; },
  attKey(date, periodId, pupilId) { return `${date}|${periodId}|${pupilId}`; },

  /* --- student information system --- */
  applicant(id) { return (this.db.applicants || []).find(a => a.id === id) || null; },
  intake(id) { return (this.db.intakes || []).find(i => i.id === id) || null; },
  /* Assessments for a class (optionally one subject), oldest first. */
  assessmentsFor(classId, subject) { return (this.db.assessments || []).filter(a => a.classId === classId && (!subject || a.subject === subject)).sort((a, b) => a.date.localeCompare(b.date)); },
  assessment(id) { return (this.db.assessments || []).find(a => a.id === id) || null; },
  /* Weighted percentage for one pupil in one subject this term, or null if unassessed. */
  subjectPct(pupilId, subject) {
    const p = this.pupil(pupilId); if (!p) return null;
    const list = this.assessmentsFor(p.classId, subject).filter(a => a.marks[pupilId] !== undefined);
    if (!list.length) return null;
    let num = 0, den = 0;
    list.forEach(a => { const w = (ASSESSMENT_KINDS.find(k => k.id === a.kind) || { weight: 1 }).weight; num += (a.marks[pupilId] / a.max) * w; den += w; });
    return Math.round((num / den) * 100);
  },
  subjectsFor(classId) { const c = this.cls(classId); return c ? ASSESSED[c.grade.startsWith("ECD") ? "ecd" : "grade"] : []; },
  grade(pct) { return (this.db.gradeScale || GRADE_SCALE).find(g => pct >= g.min) || GRADE_SCALE[GRADE_SCALE.length - 1]; },

  invoice(pupilId) { return (this.db.invoices || []).find(i => i.pupilId === pupilId) || null; },
  paymentsFor(pupilId) { return (this.db.payments || []).filter(p => p.pupilId === pupilId).sort((a, b) => a.date.localeCompare(b.date)); },
  /* Fee account for one pupil: billed, paid, balance and how much is overdue today. */
  account(pupilId) {
    const inv = this.invoice(pupilId); if (!inv) return null;
    const paid = this.paymentsFor(pupilId).reduce((n, p) => n + p.amount, 0);
    const today = this.today();
    const dueToDate = inv.instalments.filter(i => i.due <= today).reduce((n, i) => n + i.amount, 0);
    const overdue = Math.max(0, Math.round((dueToDate - paid) * 100) / 100);
    const next = inv.instalments.find(i => i.due > today) || null;
    return { inv, total: inv.total, paid: Math.round(paid * 100) / 100, balance: Math.round((inv.total - paid) * 100) / 100, overdue, next, status: paid >= inv.total ? "settled" : overdue > 0 ? "arrears" : "on track" };
  },
  commsFor(pupilId) { return (this.db.comms || []).filter(c => c.pupilId === pupilId).sort((a, b) => b.sentAt.localeCompare(a.sentAt)); },

  /* --- governance --- */
  meeting(id) { return (this.db.board || []).find(b => b.id === id) || null; },
  /* A statutory item is "due" inside 60 days and "expired" once the date has passed. */
  statutoryState(item) {
    if (!item.expires) return { key: "current", label: "No expiry", colour: "grey", days: null };
    const days = Math.round((new Date(item.expires + "T12:00:00") - new Date(this.today() + "T12:00:00")) / 864e5);
    if (days < 0) return { key: "expired", label: "Expired", colour: "red", days };
    if (days <= 60) return { key: "due", label: `Renew in ${days} day${days === 1 ? "" : "s"}`, colour: "amber", days };
    return { key: "current", label: "Current", colour: "green", days };
  },
  money(n) { return `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2 })}`; },

  /* The server writes its own audit entries for anything it does; this records
     what the browser initiated so the two read as one history. */
  audit(action) {
    const entry = { id: this.uid("au"), at: new Date().toISOString(), by: this.session?.staffId || null, action };
    this.db.audit.unshift(entry);
    this.db.audit = this.db.audit.slice(0, 300);
    return entry;
  },

  uid(prefix) { return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`; },
};

/* --- formatting helpers --- */
const Fmt = {
  date(isoStr, style = "medium") {
    if (!isoStr) return "";
    const d = new Date(isoStr.length === 10 ? isoStr + "T12:00:00" : isoStr);
    if (style === "short") return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    if (style === "long") return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    if (style === "weekday") return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  },
  time(isoStr) { if (!isoStr) return ""; return new Date(isoStr).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); },
  dateTime(isoStr) { return `${this.date(isoStr, "short")}, ${this.time(isoStr)}`; },
  age(dob) {
    if (!dob) return "";
    const b = new Date(dob), n = new Date();
    let y = n.getFullYear() - b.getFullYear(); let m = n.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && n.getDate() < b.getDate())) { y--; m += 12; }
    return `${y}y ${m}m`;
  },
  pct(n, d) { return d ? Math.round((n / d) * 100) : 0; },
  initials(s) { return s ? `${s.first[0]}${s.last[0]}` : "?"; },
  esc(str) { return String(str ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); },
};

const STATUS_LABEL = { P: "Present", A: "Absent", L: "Late", E: "Excused" };
const STATUS_PILL = { P: "green", A: "red", L: "amber", E: "blue" };
