/* ==========================================================================
   The family & student portal — what a guardian is allowed to see
   --------------------------------------------------------------------------
   One builder, used twice. The Node server calls it to answer
   GET /api/portal/state; the browser calls it in demo mode, where there is no
   server to ask. Both get the same payload, so the portal cannot behave one
   way published and another way locally.

   The rule this file exists to enforce: a guardian's account reaches their own
   children and nothing else. It is not a filtered view of the school — the
   school is never assembled in the first place. Everything below is built out
   of a named list of pupil ids, so there is no query a signed-in parent can
   make that reaches another family's child.
   ========================================================================== */

const FAMILY_NODE = typeof module === "object" && !!module.exports;
const FD = FAMILY_NODE ? require("./data.js") : {
  PERIODS, DAYS, DAY_LABELS, ASSESSED, ASSESSMENT_KINDS, GRADE_SCALE, SUBJECTS, schoolDaysBetween,
};

const Family = {
  /* Fields of a pupil record a guardian sees. Everything else — the school's
     own notes, the admission source, the enrolment trail — stays behind. */
  PUPIL_FIELDS: ["id", "first", "last", "admissionNo", "gender", "dob", "classId", "status", "enrolled"],

  /* ----------------------------------------------------------------------
     build(source, account, todayIso)

     `source` is the school as plain arrays and objects: the shape the demo
     database already has, and the shape the server assembles from SQLite.
     ---------------------------------------------------------------------- */
  build(source, account, todayIso) {
    const today = todayIso || new Date().toISOString().slice(0, 10);
    const classes = source.classes || [];
    const staff = source.staff || [];
    const pupils = source.pupils || [];
    const wanted = new Set(account.pupilIds || []);
    const mine = pupils.filter(p => wanted.has(p.id));

    const staffName = (id) => {
      const s = staff.find(x => x.id === id);
      return s ? `${s.title ? s.title + " " : ""}${s.first} ${s.last}`.trim() : "";
    };

    return {
      kind: "family",
      now: new Date().toISOString(),
      today,
      account: {
        id: account.id, name: account.name, relationship: account.relationship || "Guardian",
        email: account.email, phone: account.phone || "",
        pupilIds: [...wanted],
      },
      school: this.publicSchool(source.school || {}),
      gradeScale: source.gradeScale || FD.GRADE_SCALE,
      periods: FD.PERIODS,
      dayLabels: FD.DAY_LABELS,
      children: mine.map(p => this.child(p, source, account, today, staffName)),
      /* School-wide, and the same for every family. */
      events: (source.events || []).slice().sort((a, b) => a.date.localeCompare(b.date)),
      documents: (source.documents || []).filter(d => this.forGuardians(d)),
      notices: (source.comms || [])
        .filter(c => !c.pupilId && (!c.classId || mine.some(p => p.classId === c.classId)))
        .sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)))
        .slice(0, 30)
        .map(c => this.notice(c, staffName)),
      noticesSeen: (account.seen || {}).notices || "1970-01-01",
    };
  },

  /* The school's own details are public anyway — they are on the website. The
     integration keys and the register lock are not. */
  publicSchool(s) {
    return {
      name: s.name, tagline: s.tagline, address: s.address, phone: s.phone,
      email: s.email, web: s.web, term: s.term || { name: "", start: "", end: "" },
    };
  },

  forGuardians(doc) {
    const aud = doc.audience || [];
    return aud.includes("guardian") || aud.includes("families") || aud.includes("public");
  },

  notice(c, staffName) {
    return {
      id: c.id, at: c.sentAt, channel: c.channel, subject: c.subject || "",
      body: c.body, from: staffName(c.sentBy) || "The school office", direction: "out",
    };
  },

  /* ----------------------------------------------------------------------
     One child, assembled
     ---------------------------------------------------------------------- */
  child(p, source, account, today, staffName) {
    const cls = (source.classes || []).find(c => c.id === p.classId) || { id: p.classId, name: "—", grade: "" };
    const out = {};
    for (const k of this.PUPIL_FIELDS) out[k] = p[k];
    out.className = cls.name;
    out.grade = cls.grade;
    out.room = cls.room || "";
    out.teacher = staffName(cls.teacherId);
    out.assistant = staffName(cls.assistantId);
    /* A family sees their own child's medical record. It is theirs; they gave
       it to the school, and getting it wrong is what the allergy line is for. */
    out.medical = p.medical || { allergies: "", conditions: "", doctor: "" };
    out.guardian = p.guardian || {};
    out.emergency = p.emergency || { name: "", phone: "" };
    out.attendance = this.attendance(p, source, today);
    out.subjects = this.subjects(p, cls, source);
    out.fees = this.fees(p, source, today);
    out.week = this.week(p, cls, source, staffName);
    out.messages = (source.comms || [])
      .filter(c => c.pupilId === p.id)
      .sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)))
      .slice(0, 60)
      .map(c => c.fromGuardian
        ? { id: c.id, at: c.sentAt, channel: "portal", subject: c.subject || "", body: c.body,
            from: c.fromName || account.name, direction: "in",
            /* so a parent can see their message landed, not just that it sent */
            read: !!c.readAt, readBy: c.readBy ? staffName(c.readBy) : "", readAt: c.readAt || "" }
        : this.notice(c, staffName));
    /* Unread, from the family's side: anything the school has sent since they
       last had this child's thread open. */
    const seen = (account.seen || {})[p.id] || "1970-01-01";
    out.unread = out.messages.filter(m => m.direction === "out" && String(m.at) > seen).length;
    out.lastSeen = seen;
    out.absenceNotes = (source.absences || [])
      .filter(a => a.pupilId === p.id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 40);
    return out;
  },

  /* Attendance this term. The headline is morning registration, because that
     is the figure the school reports; the list underneath is every period a
     child was not marked present, which is the one a parent asks about. */
  attendance(p, source, today) {
    const term = (source.school || {}).term || {};
    const att = source.attendance || {};
    const days = term.start ? FD.schoolDaysBetween(term.start, today) : [];
    let present = 0, total = 0;
    const counts = { P: 0, A: 0, L: 0, E: 0 };
    for (const d of days) {
      const r = att[`${d}|reg|${p.id}`];
      if (!r) continue;
      total++;
      counts[r.status] = (counts[r.status] || 0) + 1;
      if (r.status === "P" || r.status === "L") present++;
    }
    const marks = [];
    for (const [key, r] of Object.entries(att)) {
      const [date, periodId, pupilId] = key.split("|");
      if (pupilId !== p.id || r.status === "P") continue;
      if (term.start && date < term.start) continue;
      const period = FD.PERIODS.find(x => x.id === periodId);
      marks.push({ date, periodId, period: period ? period.label : periodId, time: period ? period.start : "", status: r.status, note: r.note || "" });
    }
    marks.sort((a, b) => b.date.localeCompare(a.date) || String(a.time).localeCompare(String(b.time)));
    return {
      present, total, counts, schoolDays: days.length,
      pct: total ? Math.round((present / total) * 100) : 0,
      marks: marks.slice(0, 60),
    };
  },

  /* Marks, weighted the same way the gradebook weights them, with every
     assessment behind the figure rather than only the figure. */
  subjects(p, cls, source) {
    const list = FD.ASSESSED[String(cls.grade || "").startsWith("ECD") ? "ecd" : "grade"] || [];
    const scale = source.gradeScale || FD.GRADE_SCALE;
    const all = (source.assessments || []).filter(a => a.classId === p.classId);
    return list.map(subject => {
      const done = all
        .filter(a => a.subject === subject && a.marks && a.marks[p.id] !== undefined)
        .sort((a, b) => a.date.localeCompare(b.date));
      let num = 0, den = 0;
      const pieces = done.map(a => {
        const kind = FD.ASSESSMENT_KINDS.find(k => k.id === a.kind) || { weight: 1, label: a.kind };
        num += (a.marks[p.id] / a.max) * kind.weight; den += kind.weight;
        return { id: a.id, name: a.name, date: a.date, kind: kind.label, mark: a.marks[p.id], max: a.max, pct: Math.round((a.marks[p.id] / a.max) * 100) };
      });
      const pct = den ? Math.round((num / den) * 100) : null;
      const band = pct === null ? null : (scale.find(g => pct >= g.min) || scale[scale.length - 1]);
      return { subject, pct, grade: band, assessments: pieces };
    });
  },

  /* The fee account, exactly as the office sees it. Families are shown what
     they owe and when — a balance a parent cannot check is a balance the
     office ends up explaining on the telephone. */
  fees(p, source, today) {
    const inv = (source.invoices || []).find(i => i.pupilId === p.id);
    if (!inv) return null;
    const payments = (source.payments || []).filter(x => x.pupilId === p.id).sort((a, b) => a.date.localeCompare(b.date));
    const paid = Math.round(payments.reduce((n, x) => n + x.amount, 0) * 100) / 100;
    const dueToDate = inv.instalments.filter(i => i.due <= today).reduce((n, i) => n + i.amount, 0);
    const overdue = Math.max(0, Math.round((dueToDate - paid) * 100) / 100);
    const next = inv.instalments.find(i => i.due > today) || null;
    return {
      term: inv.term, issued: inv.issued, items: inv.items, discount: inv.discount,
      discountReason: inv.discountReason, total: inv.total, instalments: inv.instalments,
      paid, balance: Math.round((inv.total - paid) * 100) / 100, overdue, next,
      status: paid >= inv.total ? "settled" : overdue > 0 ? "arrears" : "on track",
      payments: payments.map(x => ({ date: x.date, amount: x.amount, method: x.method, ref: x.ref })),
    };
  },

  /* The week as the child has it. Subject, time and who teaches it — not the
     staff timetable, which is the school's business. */
  week(p, cls, source, staffName) {
    const tt = (source.timetable || {})[cls.id] || {};
    const teams = source.teams || [];
    const lessons = FD.PERIODS.filter(x => !x.kind);
    const out = {};
    for (const day of FD.DAYS) {
      out[day] = lessons.map((period, i) => {
        const cell = (tt[day] || [])[i];
        if (!cell) return { time: period.start, subject: "", teacher: "" };
        const team = teams.find(t => t.id === cell.t);
        return { time: period.start, subject: cell.s, teacher: team ? staffName(team.teacherId) : "" };
      });
    }
    return out;
  },

  /* ----------------------------------------------------------------------
     Writing back. A guardian may do exactly three things, and each one is
     built here so the server and the demo agree on what it produces.
     ---------------------------------------------------------------------- */
  absenceNote({ id, pupilId, date, reason, note, account, at }) {
    return {
      id, pupilId, date,
      reason: String(reason || "Absent").slice(0, 60),
      note: String(note || "").slice(0, 600),
      reportedBy: account.id, reportedName: account.name,
      at: at || new Date().toISOString(),
      status: "reported",
    };
  },

  /* What a family has caught up with. One flat map on the account, so marking
     a thread read is one small write rather than a row per message. */
  markSeen(account, key, at) {
    const seen = { ...(account.seen || {}) };
    seen[key] = at || new Date().toISOString();
    return { ...account, seen };
  },

  /* `threadId` is the id of whichever message started the exchange, carried
     by every reply to it. A message that starts one is its own thread, which
     is why it is set to the message's own id rather than left empty — so
     there is no such thing as a message outside a thread, and grouping never
     has to special-case the first one. Anything written before threads
     existed has no threadId and falls back to its own id, which puts it in a
     thread of one: exactly what it was. */
  guardianMessage({ id, pupilId, classId, subject, body, account, at }) {
    return {
      id, threadId: id, pupilId, classId, channel: "portal",
      subject: String(subject || "").slice(0, 200),
      body: String(body || "").slice(0, 4000),
      fromGuardian: true, fromName: account.name, fromAccount: account.id,
      sentBy: null, sentAt: at || new Date().toISOString(),
      recipients: 1, status: "received", to: "The school office",
    };
  },

  /* Turning the guardian already on a pupil record into a portal account, so
     the office is not asked to type a name and an address it already holds. */
  /* `portion` is how many of the eligible families already have an account.
     It defaults to all of them, which is what a migration wants. A demo wants
     less: a school with every family already signed up is a school where the
     job of signing families up cannot be seen, let alone tried — the page
     that does it renders with nothing on it. Real schools are always part of
     the way through. */
  fromPupils(pupils, portion = 1) {
    const byEmail = new Map();
    for (const p of pupils) {
      const g = p.guardian || {};
      const email = String(g.email || "").trim().toLowerCase();
      if (!email) continue;
      if (!byEmail.has(email)) {
        byEmail.set(email, {
          id: `g_${email.replace(/[^a-z0-9]+/g, "_").slice(0, 40)}`,
          name: g.name || "Guardian", relationship: g.relationship || "Guardian",
          email: g.email, phone: g.phone || "", pupilIds: [], active: true,
          createdBy: null, createdAt: new Date().toISOString(), lastSeen: null,
        });
      }
      byEmail.get(email).pupilIds.push(p.id);
    }
    const all = [...byEmail.values()];
    if (portion >= 1) return all;
    /* Deterministic, so the demo is the same school every time it is loaded. */
    return all.filter((_, i) => (i * 2654435761 % 1000) / 1000 < portion);
  },
};

if (typeof module === "object" && module.exports) module.exports = Family;
