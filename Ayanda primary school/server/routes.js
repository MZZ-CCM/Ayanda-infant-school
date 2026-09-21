/* ==========================================================================
   Routes — the HTTP surface. Thin: every rule lives in api.js.
   ========================================================================== */

const db = require("./db");
const auth = require("./auth");
const api = require("./api");
const { fail, require_, ACCESS, SETTING_ACCESS, P } = api;

const uid = (p) => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

/* --- issuing a sign-in ----------------------------------------------------
   Whoever sets somebody up may type the password rather than take the
   generated one — the office often has to read it down a telephone, or hand
   it to a parent at the desk, and a password they chose is one they can say.
   It is held to the same rules either way, and it is always must-change, so
   whatever is chosen here lives only until its first use. Nobody can set a
   password somebody else will keep. */
/* Whether the person is made to replace what they were given. It is off
   unless the issuer asked for it: a password the office chose is one the
   office knows, which is a reason to replace it, but it is the school's call
   per account rather than a rule the software imposes on everyone. Anybody
   can change their own password whenever they like either way. */
function mustChangeFlag(body) { return body && (body.mustChange === true || body.mustChange === "1" || body.mustChange === 1); }

function issuedPassword(chosen) {
  const given = String(chosen || "").trim();
  if (!given) return auth.temporaryPassword();
  const problem = auth.passwordProblem(given);
  if (problem) fail(422, problem);
  return given;
}

/* --- auth ---------------------------------------------------------------- */
function login(body, ip) {
  const { email, password } = body || {};
  if (!email || !password) fail(400, "Enter your school email address and your password.");
  const result = auth.login(String(email), String(password), ip);
  if (!result.ok) fail(401, result.reason);
  const session = auth.createSession(result.account.id);

  if (result.kind === "family") {
    const g = result.account;
    db.put("guardians", g.id, { ...g, lastSeen: db.now() }, g.id);
    db.put("audit", `au_${uid("g")}`, { id: `au_${uid("g")}`, at: db.now(), by: null,
      action: `Family portal: ${g.name} signed in` }, null);
    return { token: session.token, expires: session.expires, kind: "family",
             account: api.publicGuardian(g), mustChange: result.mustChange };
  }

  api.audit(result.account, "Signed in");
  return { token: session.token, expires: session.expires, kind: "staff",
           staff: api.publicStaff(result.account), mustChange: result.mustChange };
}

function logout(staff, token) { auth.destroySession(token); return { ok: true }; }

/* --- asking for an account ----------------------------------------------- */
/* Open to anyone, because a new teacher has no account yet. It creates a
   request, never an account: HR or the Head Teacher approves it, and only then
   does a staff record and a PIN exist. Rate-limited per address so the form
   cannot be used to flood the school. */
const recentRequests = new Map();

function requestAccess(body, ip) {
  const window = 60 * 60 * 1000, limit = 5;
  const seen = (recentRequests.get(ip) || []).filter(t => Date.now() - t < window);
  if (seen.length >= limit) fail(429, "Too many requests from here. Please telephone the school office instead.");
  recentRequests.set(ip, [...seen, Date.now()]);

  const first = String(body.first || "").trim(), last = String(body.last || "").trim();
  const email = String(body.email || "").trim();
  if (!first || !last) fail(422, "Please give your first name and surname.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(422, "Please give a valid email address.");
  if (P.ROLES[body.role]?.governance) fail(422, "Governance accounts are arranged directly with the Board.");

  const id = uid("ar");
  const request = {
    id, first: first.slice(0, 60), last: last.slice(0, 60), email: email.slice(0, 120),
    phone: String(body.phone || "").trim().slice(0, 40),
    role: P.ROLES[body.role] ? body.role : "assistant",
    note: String(body.note || "").trim().slice(0, 600),
    at: db.now(), status: "pending",
  };
  db.put("accessRequests", id, request, null);
  db.put("audit", `au_${id}`, { id: `au_${id}`, at: db.now(), by: null, action: `Access requested by ${first} ${last} (${P.ROLES[request.role].label})` }, null);
  return { ok: true };
}

/* Approving one creates the staff record and a starting PIN the person must change. */
function decideAccessRequest(actor, id, decision, body = {}) {
  require_(actor, "accounts.manage");
  const request = db.get("accessRequests", id);
  if (!request) fail(404, "Request not found.");
  if (request.status !== "pending") fail(422, "That request has already been dealt with.");

  if (decision !== "approve") {
    db.put("accessRequests", id, { ...request, status: "declined", decidedBy: actor.id, decidedAt: db.now() }, actor.id);
    api.audit(actor, `Declined the access request from ${request.first} ${request.last}`);
    return { ok: true, status: "declined" };
  }

  const role = body.role || request.role;
  if (!P.canIssueRole(actor, role)) {
    fail(403, P.ROLES[role]?.governance
      ? "Only the governance tier can appoint to the governance tier."
      : `You can set up an account for ${P.ROLES[role]?.label || role} only if it sits at or below your own level.`);
  }
  const staffId = `s${String(Date.now()).slice(-6)}`;
  const password = issuedPassword(body.password);
  const row = {
    id: staffId, first: request.first, last: request.last, title: body.title || "Mr",
    role, email: request.email, phone: request.phone, started: db.now().slice(0, 10),
    active: true, grants: [], revokes: [], extraClasses: [],
  };
  db.put("staff", staffId, row, actor.id);
  auth.setPassword(staffId, password, { mustChange: mustChangeFlag(body), check: false });
  db.put("accessRequests", id, { ...request, status: "approved", staffId, decidedBy: actor.id, decidedAt: db.now() }, actor.id);
  api.audit(actor, `Approved ${request.first} ${request.last} as ${P.ROLES[role].label}`);
  return { ok: true, status: "approved", staffId, email: row.email, password };
}

/* ==========================================================================
   The door code
   --------------------------------------------------------------------------
   One code for staff, a different one for families, given out the way a
   building's door code is given out. It is not a password and this file does
   not pretend it is: everybody on one side of the school has the same one, so
   it proves nothing about who is at the keyboard. What it does is keep the
   two sign-in forms off the open web, so a stranger who finds the school's
   website never sees a box asking for a teacher's email address.

   The real check is still the password behind it. This is the outer door.
   ========================================================================== */
const GATE_AUDIENCES = ["staff", "family"];
const gateAttempts = new Map();

function gateSettings() { return db.setting("gate") || {}; }

/* Which doors are locked. Nobody has signed in when this is asked, so it says
   the least that still lets the page know whether to ask for a code: yes or
   no, and not when or by whom. The Settings page gets the rest, from state(),
   where there is a session to check. */
function gateStatus() {
  const g = gateSettings();
  return Object.fromEntries(GATE_AUDIENCES.map(a => [a, { required: !!(g[a] && g[a].hash) }]));
}

function checkGate(body, ip) {
  const audience = GATE_AUDIENCES.includes(body.audience) ? body.audience : null;
  if (!audience) fail(400, "Which door?");

  const window = 60 * 60 * 1000, limit = 15;
  const key = `${ip}:${audience}`;
  const seen = (gateAttempts.get(key) || []).filter(t => Date.now() - t < window);
  if (seen.length >= limit) fail(429, "Too many attempts from this device. Try again in an hour, or telephone the school office.");
  gateAttempts.set(key, [...seen, Date.now()]);

  const entry = gateSettings()[audience];
  if (!entry || !entry.hash) return { ok: true, unset: true };     // no code set: the door is open

  const ok = auth.verifyPassword(String(body.pin || ""), entry.hash, entry.salt);
  if (!ok) fail(401, "That code is not right. Ask the school office for the current one.");
  gateAttempts.delete(key);
  return { ok: true };
}

/* Setting or clearing a code. Never readable afterwards — like every other
   secret here, it is replaced rather than looked up. */
function setGate(actor, body) {
  require_(actor, "settings.manage");
  const audience = GATE_AUDIENCES.includes(body.audience) ? body.audience : null;
  if (!audience) fail(400, "Which door?");
  const g = { ...gateSettings() };
  const pin = String(body.pin || "").trim();

  if (!pin) {
    delete g[audience];
    db.setSetting("gate", g, actor.id);
    api.audit(actor, `Removed the ${audience === "staff" ? "staff" : "family"} portal door code — that page is open to anyone again`);
    return { ok: true };
  }
  if (!/^[0-9]{4,10}$/.test(pin)) fail(422, "A door code is between four and ten digits.");
  if (/^(0000|1234|1111|123456|000000)$/.test(pin)) fail(422, "That code is too easy to guess.");

  const { hash, salt } = auth.hashPassword(pin);
  g[audience] = { hash, salt, setAt: db.now(), setBy: actor.id };
  db.setSetting("gate", g, actor.id);
  api.audit(actor, `Changed the ${audience === "staff" ? "staff" : "family"} portal door code`);
  return { ok: true };
}

/* --- enquiring about a place --------------------------------------------- */
/* The public page's enquiry form. It creates an applicant at the first stage
   of the admissions pipeline, exactly where one created by hand would sit, so
   the office works from a single list. Open by necessity, rate-limited, and it
   can never do more than add an enquiry. */
function enquire(body, ip) {
  const window = 60 * 60 * 1000, limit = 8;
  const seen = (recentRequests.get("enq:" + ip) || []).filter(t => Date.now() - t < window);
  if (seen.length >= limit) fail(429, "Too many enquiries from here. Please telephone the school office on " + (db.setting("school") || {}).phone + ".");
  recentRequests.set("enq:" + ip, [...seen, Date.now()]);

  const first = String(body.childFirst || "").trim(), last = String(body.childLast || "").trim();
  const guardian = String(body.guardianName || "").trim();
  const phone = String(body.phone || "").trim();
  if (!first || !last) fail(422, "Please give the child's first name and surname.");
  if (!guardian) fail(422, "Please give a parent or guardian's name.");
  if (!phone && !String(body.email || "").trim()) fail(422, "Please leave a telephone number or an email address so we can reply.");

  const grades = (db.setting("classes") || []).map(c => c.grade);
  const intakes = db.setting("intakes") || [];
  const intake = intakes.find(i => i.id === body.intakeId && i.status === "open") || intakes.find(i => i.status === "open") || intakes[0];

  const id = uid("a");
  const applicant = {
    id, first: first.slice(0, 60), last: last.slice(0, 60),
    gender: ["F", "M"].includes(body.gender) ? body.gender : "F",
    dob: /^\d{4}-\d{2}-\d{2}$/.test(body.dob || "") ? body.dob : "",
    targetGrade: grades.includes(body.targetGrade) ? body.targetGrade : grades[0],
    intakeId: intake ? intake.id : null,
    stage: "enquiry", appliedOn: db.now().slice(0, 10), source: "Website",
    guardian: {
      name: guardian.slice(0, 80),
      relationship: ["Mother", "Father", "Grandmother", "Grandfather", "Aunt", "Uncle", "Guardian"].includes(body.relationship) ? body.relationship : "Guardian",
      phone: phone.slice(0, 40), email: String(body.email || "").trim().slice(0, 120),
    },
    docs: { birth: false, clinic: false, photo: false, report: false, consent: false },
    baseline: "", offerSentOn: "", offerExpires: "", sibling: !!body.sibling,
    notes: String(body.message || "").trim().slice(0, 600),
  };
  db.put("applicants", id, applicant, null);
  db.put("audit", `au_${id}`, { id: `au_${id}`, at: db.now(), by: null,
    action: `Enquiry from the website about a place for ${applicant.first} ${applicant.last} (${applicant.targetGrade})` }, null);
  return { ok: true };
}

/* --- records ------------------------------------------------------------- */
function putRecord(staff, collection, id, body) {
  const rule = ACCESS[collection];
  if (!rule) fail(404, `Unknown collection "${collection}".`);
  if (collection === "audit") fail(403, "The audit log is written by the system, not by hand.");

  const existing = db.get(collection, id);
  require_(staff, existing ? rule.write : (rule.create || rule.write), collection);

  if (rule.scoped) {
    const ids = api.scopeIds(staff);
    /* An absence note names a pupil, not a class, so resolve it through the
       pupil rather than letting the check pass for want of a classId. */
    const viaPupil = collection === "absences" ? db.get("pupils", body.pupilId || existing?.pupilId) : null;
    const classId = (viaPupil && viaPupil.classId) || body.classId || existing?.classId;
    if (classId && !ids.has(classId)) fail(403, "That record is outside the classes you work with.");
    if (collection === "absences" && !classId) fail(422, "An absence note must name a pupil.");
  }
  if (collection === "staff") return putStaff(staff, id, body, existing);
  if (collection === "attendance") return putAttendance(staff, id, body);

  const row = { ...(existing || {}), ...body, id };
  db.put(collection, id, row, staff.id);
  return row;
}

/* Changing a colleague's role or overrides follows the same hierarchy the
   Permissions page draws — and the governance tier stays sealed. */
function putStaff(actor, id, body, existing) {
  if (!existing) {
    /* Setting somebody up is its own permission, which the office holds and
       which does not carry the right to change anyone's role afterwards. */
    require_(actor, "accounts.manage");
    if (!P.canIssueRole(actor, body.role)) {
      fail(403, P.ROLES[body.role]?.governance
        ? "Only the governance tier can create a Director or Board Secretary."
        : `You can set up an account for ${P.ROLES[body.role]?.label || body.role} only if it sits at or below your own level.`);
    }
    if (!String(body.email || "").trim()) fail(422, "A school email address is needed — it is how they sign in.");
    if (auth.accountByEmail(body.email)) fail(422, "That email address is already in use at the school.");
    const temporary = issuedPassword(body.password);
    const row = { ...body, id, active: true, grants: [], revokes: [], extraClasses: [] };
    delete row.password;                       // a credential never lives in a record
    db.put("staff", id, row, actor.id);
    auth.setPassword(id, temporary, { mustChange: mustChangeFlag(body), check: false });
    api.audit(actor, `Added ${row.title} ${row.first} ${row.last} as ${P.ROLES[row.role].label}`);
    return { ...api.publicStaff(row), temporaryPassword: temporary };
  }

  const changingAccess = body.role !== undefined && body.role !== existing.role
    || body.grants !== undefined || body.revokes !== undefined || body.extraClasses !== undefined;

  if (changingAccess) {
    if (!P.canAdminister(actor, existing)) fail(403, "You cannot change this person's access.");
    if (body.role && P.ROLES[body.role]?.governance && !P.isGovernance(actor)) fail(403, "Only the governance tier can appoint to the governance tier.");
    /* role-locked permissions follow the role and are not grantable */
    const locked = new Set(P.PERMISSION_GROUPS.flatMap(g => g.perms.filter(p => p.locked).map(p => p.key)));
    for (const k of [...(body.grants || []), ...(body.revokes || [])]) {
      if (locked.has(k)) fail(403, `"${P.PERMISSION_INFO[k].label}" follows the role and cannot be granted or revoked.`);
    }
  } else {
    require_(actor, "staff.manage");
  }

  const row = { ...existing, ...body, id };
  delete row.pin;
  db.put("staff", id, row, actor.id);
  if (changingAccess) {
    api.audit(actor, `Updated access for ${row.first} ${row.last} (${P.ROLES[row.role].label}; ${(row.grants || []).length} granted, ${(row.revokes || []).length} revoked)`);
    auth.destroyAllSessions(id);   // their next request re-reads the new access
  }
  return api.publicStaff(row);
}

function deleteRecord(staff, collection, id) {
  const rule = ACCESS[collection];
  if (!rule) fail(404, `Unknown collection "${collection}".`);
  require_(staff, rule.remove || rule.write, collection);
  const existing = db.get(collection, id);
  if (!existing) fail(404, "Not found.");
  if (collection === "staff") fail(400, "Staff are deactivated rather than deleted.");
  db.remove(collection, id, staff.id);
  api.audit(staff, `Deleted ${collection.replace(/s$/, "")} ${id}`);
  return { ok: true };
}

/* --- settings ------------------------------------------------------------ */
function putSetting(staff, key, body) {
  const rule = SETTING_ACCESS[key];
  if (!rule) fail(404, `Unknown setting "${key}".`);

  if (key === "reads") {          // each person writes only their own receipts
    const current = db.setting("reads") || {};
    for (const k of Object.keys(body)) if (!k.startsWith(staff.id + "|")) fail(403, "You can only mark your own messages as read.");
    db.setSetting("reads", { ...current, ...body }, staff.id);
    return body;
  }

  require_(staff, rule.write, key);
  if (key === "timetable") assertNoClash(body);
  db.setSetting(key, body, staff.id);
  api.audit(staff, `Updated ${key}`);
  return body;
}

/* A teaching pair cannot be in two rooms at once — checked on the server too,
   because the browser's check is only a courtesy. */
function assertNoClash(timetable) {
  const classes = db.setting("classes") || [];
  for (const day of api.D.DAYS) {
    for (let i = 0; i < 6; i++) {
      const seen = new Map();
      for (const c of classes) {
        const cell = (timetable[c.id]?.[day] || [])[i];
        if (!cell || !cell.t) continue;
        if (seen.has(cell.t)) fail(422, `A teaching pair is double-booked on ${day} in period ${i + 1} (${seen.get(cell.t)} and ${c.name}).`);
        seen.set(cell.t, c.name);
      }
    }
  }
}

/* One mark. The timing rule is applied here exactly as it is for a batch, so
   it makes no difference whether the browser saves a register in one request
   or in thirty. */
function putAttendance(staff, key, body) {
  const [date, periodId, pupilId] = String(key).split("|");
  if (!date || !periodId || !pupilId) fail(400, "An attendance key is `date|period|pupil`.");
  const pupil = db.get("pupils", pupilId);
  if (!pupil) fail(404, "Pupil not found.");
  if (!["P", "A", "L", "E"].includes(body.status)) fail(422, `"${body.status}" is not a valid mark.`);
  const { amending } = api.assertCanMark(staff, pupil.classId, date, periodId);
  const row = { status: body.status, note: String(body.note || "").slice(0, 400), markedBy: staff.id, markedAt: db.now(), ...(amending ? { amended: true } : {}) };
  db.put("attendance", key, row, staff.id);
  return row;
}

/* --- attendance ---------------------------------------------------------- */
/* One register, saved as a unit, with the timing rule applied server-side. */
function saveRegister(staff, body) {
  const { classId, date, periodId, marks } = body || {};
  if (!classId || !date || !periodId || !marks || typeof marks !== "object") fail(400, "classId, date, periodId and marks are required.");
  if (!api.scopeIds(staff).has(classId)) fail(403, "That class is outside the classes you work with.");

  const { slot, amending } = api.assertCanMark(staff, classId, date, periodId);
  const pupils = db.all("pupils", { k1: classId }).filter(p => p.status === "active");
  const allowed = new Set(pupils.map(p => p.id));
  const at = db.now();
  let saved = 0;

  db.transaction(() => {
    for (const [pupilId, entry] of Object.entries(marks)) {
      if (!allowed.has(pupilId)) fail(422, "A pupil in that register is not in the class.");
      const status = entry && entry.status;
      if (!["P", "A", "L", "E"].includes(status)) fail(422, `"${status}" is not a valid mark.`);
      const key = `${date}|${periodId}|${pupilId}`;
      db.put("attendance", key, {
        status, note: String(entry.note || "").slice(0, 400),
        markedBy: staff.id, markedAt: at, ...(amending ? { amended: true } : {}),
      }, staff.id);
      saved++;
    }
    if (amending) api.audit(staff, `Amended ${saved} attendance record(s) after lock — ${classId}, ${periodId} on ${date}`);
  });

  return { saved, amending, subject: slot.subject };
}

/* --- admissions: accepted applicant becomes a pupil ---------------------- */
function enrol(staff, applicantId) {
  require_(staff, "admissions.offer");
  const applicant = db.get("applicants", applicantId);
  if (!applicant) fail(404, "Applicant not found.");
  if (applicant.stage !== "accepted") fail(422, "Only an applicant who has accepted a place can be enrolled.");

  const classes = db.setting("classes") || [];
  const cls = classes.find(c => c.grade === applicant.targetGrade);
  if (!cls) fail(422, `No class exists for ${applicant.targetGrade}.`);

  return db.transaction(() => {
    const nums = db.all("pupils").map(p => Number(String(p.admissionNo).split("/")[1]) || 0);
    const no = Math.max(1040, ...nums) + 1;
    const pupil = {
      id: `p${no}`, admissionNo: `AIS/${no}`, first: applicant.first, last: applicant.last,
      gender: applicant.gender, dob: applicant.dob, classId: cls.id, address: "", stage: "enrolled",
      source: applicant.source, guardian: { ...applicant.guardian }, emergency: { name: "", phone: "" },
      medical: { allergies: "", conditions: "", doctor: "" },
      consents: { photo: !!applicant.docs.consent, trips: !!applicant.docs.consent, data: true },
      enrolled: (db.setting("intakes") || []).find(i => i.id === applicant.intakeId)?.starts || db.now().slice(0, 10),
      status: "active", notes: applicant.notes || "",
      timeline: [
        { date: applicant.appliedOn, kind: "admission", text: `Applied for ${applicant.targetGrade} (${applicant.source})` },
        ...(applicant.offerSentOn ? [{ date: applicant.offerSentOn, kind: "admission", text: "Offer of a place sent" }] : []),
        { date: db.now().slice(0, 10), kind: "admission", text: `Enrolled into ${cls.name} by ${staff.first} ${staff.last}` },
      ],
    };
    db.put("pupils", pupil.id, pupil, staff.id);
    raiseInvoice(pupil, cls.grade, applicant.sibling, staff);
    db.put("applicants", applicantId, { ...applicant, stage: "enrolled", pupilId: pupil.id }, staff.id);
    api.audit(staff, `Admissions: ${pupil.first} ${pupil.last} enrolled into ${cls.name} as ${pupil.admissionNo}`);
    return { pupil };
  });
}

function raiseInvoice(pupil, grade, sibling, staff) {
  const feeItems = db.setting("feeItems") || [];
  const rules = db.setting("feeRules") || { siblingDiscount: 0.1, instalments: 3 };
  const items = feeItems.filter(f => f.grades.includes(grade) && f.compulsory).map(f => ({ id: f.id, name: f.name, amount: f.amount }));
  const gross = items.reduce((n, it) => n + it.amount, 0);
  const discount = sibling ? Math.round(gross * rules.siblingDiscount) : 0;
  const total = gross - discount;
  const base = db.all("invoices")[0];
  const due = base ? base.instalments.map(i => i.due) : ["2026-09-04", "2026-10-09", "2026-11-13"];
  const inv = {
    id: `inv_${pupil.id}`, pupilId: pupil.id, term: (db.setting("school") || {}).term?.name || "", issued: db.now().slice(0, 10),
    items, discount, discountReason: sibling ? `Sibling discount (${Math.round(rules.siblingDiscount * 100)}%)` : "", total,
    instalments: due.map((d, k) => ({ n: k + 1, due: d, amount: Math.round((total / due.length) * 100) / 100 })),
  };
  db.put("invoices", inv.id, inv, staff.id);
  return inv;
}

/* --- payments ------------------------------------------------------------ */
function recordPayment(staff, body) {
  require_(staff, "billing.manage");
  const amount = Math.round(Number(body.amount) * 100) / 100;
  if (!(amount > 0)) fail(422, "Enter an amount greater than zero.");
  const pupil = db.get("pupils", body.pupilId);
  if (!pupil) fail(404, "Pupil not found.");
  const inv = db.all("invoices", { k1: body.pupilId })[0];
  if (!inv) fail(422, "That pupil has no invoice for this term.");
  const payment = {
    id: uid("pay"), invoiceId: inv.id, pupilId: pupil.id, date: body.date || db.now().slice(0, 10),
    amount, method: body.method || "Cash", ref: String(body.ref || "—").slice(0, 60), by: staff.id,
  };
  db.put("payments", payment.id, payment, staff.id);
  api.audit(staff, `Payment of $${amount} recorded for ${pupil.first} ${pupil.last} (${payment.method})`);
  return payment;
}

/* --- guardian communication --------------------------------------------- */
function sendComm(staff, body) {
  require_(staff, "comms.send");
  const { target, channel, subject, body: text } = body || {};
  if (!text || !String(text).trim()) fail(422, "The message is empty.");
  /* The family portal is a delivery channel like any other — often the only
     one, for a family with no email address and a phone that changes. A
     message sent to it is already on the child's record, which is where the
     family reads it. */
  if (!["email", "sms", "portal"].includes(channel)) fail(422, "Channel must be email, sms or portal.");
  if (target === "all") require_(staff, "comms.broadcast");

  let pupilId = null, classId = null, to = "", recipients = 1;
  if (target === "pupil") {
    const p = db.get("pupils", body.pupilId); if (!p) fail(404, "Pupil not found.");
    if (!api.scopeIds(staff).has(p.classId)) fail(403, "That pupil is outside the classes you work with.");
    if (channel === "portal") {
      const accounts = db.all("guardians").filter(g => g.active && (g.pupilIds || []).includes(p.id));
      if (!accounts.length) fail(422, `${p.first} ${p.last}'s family has no portal sign-in yet. Give them one from the pupil's record, or send by email or SMS.`);
      to = accounts.map(g => g.name).join(", ");
      recipients = accounts.length;
    } else {
      to = channel === "sms" ? p.guardian.phone : p.guardian.email;
      if (!to) fail(422, `No ${channel === "sms" ? "phone number" : "email address"} on file for ${p.guardian.name}.`);
    }
    pupilId = p.id; classId = p.classId;
  } else if (target === "class") {
    if (!api.scopeIds(staff).has(body.classId)) fail(403, "That class is outside the classes you work with.");
    const cls = (db.setting("classes") || []).find(c => c.id === body.classId);
    classId = cls.id; to = `${cls.name} guardians`;
    recipients = db.all("pupils", { k1: cls.id }).filter(p => p.status === "active").length;
  } else {
    to = "All guardians";
    recipients = db.all("pupils").filter(p => p.status === "active").length;
  }

  const comm = {
    id: uid("cm"), pupilId, classId, channel, to,
    subject: channel === "sms" ? "" : String(subject || "").slice(0, 200),
    body: String(text).slice(0, 4000), sentBy: staff.id, sentAt: db.now(), recipients, status: "delivered",
    ...(body.automatic ? { automatic: true } : {}),
  };
  db.put("comms", comm.id, comm, staff.id);
  api.audit(staff, `${channel.toUpperCase()} sent to ${to}${recipients > 1 ? ` (${recipients} recipients)` : ""}`);
  return comm;
}

/* --- credentials --------------------------------------------------------- */
/* Changing your own password needs the current one. A colleague's can only be
   reset to a temporary one — chosen or generated, but always must-change, so
   nobody gets to set a password somebody else will keep, and nobody can read
   an existing one back. */
function setPassword(actor, staffId, body) {
  const found = auth.accountById(staffId);
  const target = found ? found.account : null;
  if (!target) fail(404, "That account does not exist.");
  const self = actor.id === staffId;

  if (self) {
    if (!auth.login(target.email, String(body.currentPassword || ""), "self").ok) fail(403, "Your current password is not correct.");
    const problem = auth.passwordProblem(body.password);
    if (problem) fail(422, problem);
    auth.setPassword(staffId, body.password, { mustChange: false });
    if (found.kind === "staff") api.audit(actor, "Changed own password");
    return { ok: true };
  }

  if (found.kind === "family") fail(403, "A family's sign-in is reset from the pupil's record, not here.");

  /* Not canAdminister: resetting a sign-in is the office's job, and needs
     "accounts.manage" rather than the power to change what a role may do. The
     tier limit is what stops it travelling upwards. */
  if (!P.canIssueAccount(actor, target)) {
    const where = P.isGovernance(target) ? "Only the Director or the Board Secretary can." : "Ask somebody above that level.";
    fail(403, P.can(actor, "accounts.manage")
      ? `${target.first} ${target.last} is ${P.ROLES[target.role].label}, which sits above your own level. ${where}`
      : "Your role does not include setting up or resetting sign-ins.");
  }
  const temporary = issuedPassword(body.password);
  auth.setPassword(staffId, temporary, { mustChange: mustChangeFlag(body), check: false });
  auth.destroyAllSessions(staffId);
  api.audit(actor, `Reset the sign-in for ${target.first} ${target.last} (${P.ROLES[target.role].label})`);
  return { ok: true, temporaryPassword: temporary, email: target.email, name: `${target.first} ${target.last}` };
}

/* ==========================================================================
   The family & student portal
   --------------------------------------------------------------------------
   Two halves. The first is the office's: giving a family a way in, and taking
   it back. The second is the family's: the three things a guardian may do,
   each of which writes exactly one record and none of which can name a child
   the account is not bound to.
   ========================================================================== */

/* --- the office's half ---------------------------------------------------- */
function inviteFamily(actor, body) {
  require_(actor, "portal.manage");
  const pupil = db.get("pupils", body.pupilId);
  if (!pupil) fail(404, "Pupil not found.");
  if (!api.scopeIds(actor).has(pupil.classId)) fail(403, "That pupil is outside the classes you work with.");

  const email = String(body.email || pupil.guardian?.email || "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(422, "A working email address is needed — it is how the family signs in.");
  if (auth.staffByEmail(email)) fail(422, "That address belongs to a member of staff, who signs in to the staff portal instead.");

  /* A family with two children at the school gets one account, not two. */
  const existing = auth.guardianByEmail(email);
  if (existing) {
    const pupilIds = [...new Set([...(existing.pupilIds || []), pupil.id])];
    const row = { ...existing, pupilIds, active: true };
    db.put("guardians", row.id, row, actor.id);
    const temporary = issuedPassword(body.password);
    auth.setPassword(row.id, temporary, { mustChange: mustChangeFlag(body), check: false });
    auth.destroyAllSessions(row.id);
    api.audit(actor, `Family portal: added ${pupil.first} ${pupil.last} to ${row.name}'s account and issued a new password`);
    return { ok: true, guardian: api.publicGuardian(row), email, temporaryPassword: temporary, added: true };
  }

  const id = uid("g");
  const row = {
    id,
    name: String(body.name || pupil.guardian?.name || "").trim().slice(0, 80),
    relationship: String(body.relationship || pupil.guardian?.relationship || "Guardian").slice(0, 40),
    email, phone: String(body.phone || pupil.guardian?.phone || "").trim().slice(0, 40),
    pupilIds: [pupil.id], active: true,
    createdBy: actor.id, createdAt: db.now(), lastSeen: null,
  };
  if (!row.name) fail(422, "Please give the guardian's name.");
  db.put("guardians", id, row, actor.id);
  const temporary = issuedPassword(body.password);
  auth.setPassword(id, temporary, { mustChange: mustChangeFlag(body), check: false });
  api.audit(actor, `Family portal: gave ${row.name} a sign-in for ${pupil.first} ${pupil.last}`);
  return { ok: true, guardian: api.publicGuardian(row), email, temporaryPassword: temporary };
}

function resetFamily(actor, guardianId, body = {}) {
  require_(actor, "portal.manage");
  const g = db.get("guardians", guardianId);
  if (!g) fail(404, "That family account does not exist.");
  const temporary = issuedPassword(body.password);
  auth.setPassword(guardianId, temporary, { mustChange: mustChangeFlag(body), check: false });
  auth.destroyAllSessions(guardianId);
  api.audit(actor, `Family portal: reset the sign-in for ${g.name}`);
  return { ok: true, temporaryPassword: temporary, email: g.email, name: g.name };
}

function closeFamily(actor, guardianId) {
  require_(actor, "portal.manage");
  const g = db.get("guardians", guardianId);
  if (!g) fail(404, "That family account does not exist.");
  db.put("guardians", guardianId, { ...g, active: false }, actor.id);
  auth.destroyAllSessions(guardianId);
  api.audit(actor, `Family portal: closed the account for ${g.name}`);
  return { ok: true };
}

/* Closing an account is reversible, so the portal offers Undo rather than an
   "are you sure?" nobody reads. Undo needs somewhere to go: this is it. The
   password is untouched — it was never deleted, only refused — so reopening
   restores the sign-in they already had. */
function reopenFamily(actor, guardianId) {
  require_(actor, "portal.manage");
  const g = db.get("guardians", guardianId);
  if (!g) fail(404, "That family account does not exist.");
  db.put("guardians", guardianId, { ...g, active: true }, actor.id);
  api.audit(actor, `Family portal: reopened the account for ${g.name}`);
  return { ok: true };
}

/* --- the family's half ---------------------------------------------------- */
/* Every one of these starts by proving the child belongs to the account. It is
   the only check that matters here, so it is written once and called first. */
function ownChild(guardian, pupilId) {
  if (!(guardian.pupilIds || []).includes(pupilId)) fail(403, "That is not one of your children.");
  const pupil = db.get("pupils", pupilId);
  if (!pupil) fail(404, "Pupil not found.");
  return pupil;
}

const familyLimits = new Map();
function familyRateLimit(guardian, what, limit, windowMs) {
  const key = `${guardian.id}:${what}`;
  const seen = (familyLimits.get(key) || []).filter(t => Date.now() - t < windowMs);
  if (seen.length >= limit) fail(429, "That is a lot of messages in a short time. Please telephone the school office instead.");
  familyLimits.set(key, [...seen, Date.now()]);
}

/* Telling the school a child will be away. It does not mark the register —
   only a teacher does that — it puts a note in front of whoever does. */
function reportAbsence(guardian, body) {
  const pupil = ownChild(guardian, body.pupilId);
  familyRateLimit(guardian, "absence", 20, 24 * 60 * 60 * 1000);
  const date = String(body.date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(422, "Please give the date your child will be away.");
  const id = uid("ab");
  const row = api.Family.absenceNote({ id, pupilId: pupil.id, date, reason: body.reason, note: body.note, account: guardian, at: db.now() });
  db.put("absences", id, row, guardian.id);
  db.put("audit", `au_${id}`, { id: `au_${id}`, at: db.now(), by: null,
    action: `Family portal: ${guardian.name} reported ${pupil.first} ${pupil.last} away on ${date} (${row.reason})` }, null);
  return { ok: true, absence: row };
}

/* A message to the school, logged against the child exactly where the
   school's own messages to the family are logged, so one thread holds both. */
function familyMessage(guardian, body) {
  const pupil = ownChild(guardian, body.pupilId);
  familyRateLimit(guardian, "message", 20, 60 * 60 * 1000);
  if (!String(body.body || "").trim()) fail(422, "The message is empty.");
  const id = uid("cm");
  const row = api.Family.guardianMessage({ id, pupilId: pupil.id, classId: pupil.classId, subject: body.subject, body: body.body, account: guardian, at: db.now() });
  db.put("comms", id, row, guardian.id);
  return { ok: true, message: row };
}

/* A guardian's own contact details, which are theirs to correct. The name on
   the account and the children it reaches are the school's to change. */
function familyDetails(guardian, body) {
  const row = {
    ...guardian,
    phone: String(body.phone ?? guardian.phone ?? "").trim().slice(0, 40),
    relationship: String(body.relationship ?? guardian.relationship ?? "Guardian").slice(0, 40),
  };
  db.put("guardians", guardian.id, row, guardian.id);
  return { ok: true, account: api.publicGuardian(row) };
}

/* Catching up: which thread this family has just had open. It is the only
   guardian write that touches nothing but their own account record. */
function familySeen(guardian, body) {
  const key = String(body.key || body.pupilId || "").trim();
  if (!key) fail(422, "Which thread?");
  if (key !== "notices" && !(guardian.pupilIds || []).includes(key)) fail(403, "That is not one of your children.");
  const row = api.Family.markSeen(guardian, key, db.now());
  db.put("guardians", guardian.id, row, guardian.id);
  return { ok: true };
}

function familySetPassword(guardian, body) {
  if (!auth.login(guardian.email, String(body.currentPassword || ""), "self").ok) fail(403, "Your current password is not correct.");
  const problem = auth.passwordProblem(body.password);
  if (problem) fail(422, problem);
  auth.setPassword(guardian.id, body.password, { mustChange: false });
  return { ok: true };
}

module.exports = { login, logout, requestAccess, enquire, decideAccessRequest, issuedPassword,
  checkGate, setGate, gateStatus,
  inviteFamily, resetFamily, closeFamily, reopenFamily, reportAbsence, familyMessage, familyDetails, familySeen, familySetPassword, putRecord, deleteRecord, putSetting, saveRegister, enrol, recordPayment, sendComm, setPassword, uid };
