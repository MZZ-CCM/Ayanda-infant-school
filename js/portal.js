/* ==========================================================================
   The family & student portal
   --------------------------------------------------------------------------
   The same application, wearing the other face. A guardian signs in with the
   address the school holds for them and sees one thing: their own children —
   attendance as it was actually taken, marks as they were actually entered,
   the fee account as the office holds it, and the thread of messages between
   the two of them.

   It reads Store.db, but Store.db is not the school here: on a family sign-in
   it is the narrow payload js/family.js built, so there is nothing in memory
   to leak even if a view asked for it.
   ========================================================================== */

const PORTAL_NAV = [
  { id: "home",       label: "Home",        icon: "home" },
  { id: "attendance", label: "Attendance",  icon: "check" },
  { id: "progress",   label: "Progress",    icon: "award" },
  { id: "fees",       label: "Fees",        icon: "wallet" },
  { id: "messages",   label: "Messages",    icon: "chat" },
  { id: "diary",      label: "School diary", icon: "calendar" },
  { id: "account",    label: "Your account", icon: "key" },
];

/* Unread, as a family counts it: what the school has sent since this thread
   was last open. */
function portalUnread(child) { return child ? (child.unread || 0) : 0; }

const ABSENCE_REASONS = ["Unwell", "Medical appointment", "Family matter", "Travelling", "Religious observance", "Other"];

Object.assign(App, {

  /* --- where we are ------------------------------------------------------ */
  portalView() {
    const want = (location.hash || "").replace(/^#\/?/, "").split("/")[0];
    return PORTAL_NAV.some(n => n.id === want) ? want : "home";
  },
  /* Which child is being looked at. Most families have one; the switcher only
     appears when there is a choice to make. */
  portalChild() {
    const kids = (Store.db && Store.db.children) || [];
    if (!kids.length) return null;
    const want = this.ui.portal.childId;
    return kids.find(c => c.id === want) || kids[0];
  },
  portalGo(view) { location.hash = `#/${view}`; this.render(); },

  /* --- the shell --------------------------------------------------------- */
  renderPortal() {
    const db = Store.db, a = db.account, view = this.portalView();
    const kids = db.children || [];
    const child = this.portalChild();
    const nav = PORTAL_NAV.find(n => n.id === view) || PORTAL_NAV[0];
    const unreadAll = kids.reduce((n, c) => n + portalUnread(c), 0);
    const noticesUnread = (db.notices || []).filter(n => String(n.at) > (db.noticesSeen || "")).length;
    const views = {
      home: () => this.pHome(), attendance: () => this.pAttendance(child), progress: () => this.pProgress(child),
      fees: () => this.pFees(child), messages: () => this.pMessages(child), diary: () => this.pDiary(),
      account: () => this.pAccount(),
    };

    /* Opening a thread is what marks it read — not loading the page it is on,
       and never a timer. The write goes out after this render, so it cannot
       pull the screen out from under the person reading it. */
    if (view === "messages" && child && portalUnread(child)) this.portalCatchUp(child.id);
    if (view === "diary" && noticesUnread) this.portalCatchUp("notices");

    return `
    <div class="shell portal-shell ${this.ui.drawer ? "drawer-open" : ""}">
      <div class="scrim" data-action="drawer-close" aria-hidden="true"></div>
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-brand">
          <img src="assets/logo.png" alt="">
          <div><div class="school">${esc(db.school.name)}</div><div class="tag">Family portal</div></div>
        </div>
        <nav class="nav">
          ${PORTAL_NAV.map(n => {
            const badge = n.id === "messages" ? unreadAll : n.id === "diary" ? noticesUnread : 0;
            return `<a href="#/${n.id}" class="${view === n.id ? "active" : ""}">${icon(n.icon)}<span>${esc(n.label)}</span>${badge ? `<span class="badge">${badge}</span>` : ""}</a>`;
          }).join("")}
        </nav>
        <div class="sidebar-user">
          <span class="avatar navy">${esc(this.portalInitials(a.name))}</span>
          <div><div class="name">${esc(a.name)}</div><div class="role">${esc(a.relationship)}</div></div>
          <button class="iconbtn" data-action="logout" title="Sign out" style="color:#fff">${icon("logout")}</button>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <button type="button" class="drawer-btn" data-action="drawer-open" aria-label="Menu" aria-controls="sidebar" aria-expanded="${!!this.ui.drawer}">
            <span></span><span></span><span></span>
          </button>
          <div class="grow" style="min-width:0">
            <div class="crumbs">${esc(db.school.term.name || "")}${db.school.term.name ? " · " : ""}${Fmt.date(db.today, "long")}</div>
            <h1>${esc(nav.label)}</h1>
          </div>
          <div class="spacer"></div>
          ${kids.length > 1 && view !== "home" && view !== "diary" && view !== "account" ? `
            <select class="input sm topbar-act" data-change="portal-child" aria-label="Which child">
              ${kids.map(c => `<option value="${c.id}" ${child && c.id === child.id ? "selected" : ""}>${esc(c.first)} ${esc(c.last)}</option>`).join("")}
            </select>` : ""}
          <button type="button" class="btn ghost sm topbar-act" data-action="portal-absence">${icon("alert")} Report an absence</button>
          <button type="button" class="iconbtn topbar-mobile" data-action="logout" aria-label="Sign out">${icon("logout")}</button>
        </header>
        <main class="content" id="content">${kids.length ? (views[view] || views.home)() : this.pNoChildren()}</main>
        ${this.portalBar(view, unreadAll)}
      </div>
    </div>`;
  },

  /* Fire-and-forget: if it fails the thread simply stays bold, which is the
     harmless direction to fail in. */
  portalCatchUp(key) {
    if (this._catchingUp === key) return;
    this._catchingUp = key;
    setTimeout(() => {
      Store.portal("seen", { key })
        .then(() => { this._catchingUp = null; this.render(); })
        .catch(() => { this._catchingUp = null; });
    }, 900);
  },

  portalInitials(name) {
    const bits = String(name || "").trim().split(/\s+/);
    return ((bits[0] || "?")[0] + (bits.length > 1 ? bits[bits.length - 1][0] : "")).toUpperCase();
  },

  portalBar(view, unread) {
    const items = PORTAL_NAV.filter(n => ["home", "attendance", "progress", "messages"].includes(n.id));
    return `<nav class="tabbar" aria-label="Main">
      ${items.map(n => `<a href="#/${n.id}" class="${view === n.id ? "on" : ""}">${icon(n.icon)}<span>${esc(n.label)}</span>${n.id === "messages" && unread ? `<i class="dot"></i>` : ""}</a>`).join("")}
      <button type="button" class="${this.ui.drawer ? "on" : ""}" data-action="drawer-open"><span class="more">${icon("grid")}</span><span>More</span></button>
    </nav>`;
  },

  pNoChildren() {
    return `<div class="card"><div class="forbidden">${icon("info")}
      <h2>No child is linked to this sign-in yet</h2>
      <p class="muted mt-8">The school office links a portal account to a child's record. Please telephone ${esc(Store.db.school.phone || "the school office")} and they will put it right.</p></div></div>`;
  },

  /* ======================================================================
     HOME — every child, at a glance
     ====================================================================== */
  pHome() {
    const db = Store.db, kids = db.children;
    const first = (Store.whoami() || {}).first || "";
    return `
      ${this.installBanner()}
      <div class="portal-hello">
        <h2>Good day${first ? `, ${esc(first)}` : ""}.</h2>
        <p class="muted">${kids.length === 1 ? `Here is how ${esc(kids[0].first)} is getting on.` : `Here is how your ${kids.length} children are getting on.`} Everything below is what the school itself holds — the same records, not a summary of them.</p>
      </div>

      ${kids.map(c => this.pChildCard(c)).join("")}

      ${db.notices.length ? `
      <div class="card mt-24">
        <div class="card-head"><div><h3>From the school</h3><div class="tiny muted">Sent to every family, or to your child's class</div></div></div>
        <div class="card-body tight">
          ${db.notices.slice(0, 6).map(n => `
            <div class="notice-row${String(n.at) > (db.noticesSeen || "") ? " fresh" : ""}">
              <div><div class="bold small">${esc(n.subject || "Message from the school")}${String(n.at) > (db.noticesSeen || "") ? ` <span class="pill gold tiny">New</span>` : ""}</div>
                <div class="small muted">${esc(n.body)}</div></div>
              <div class="tiny muted nowrap">${Fmt.date(n.at, "short")}</div>
            </div>`).join("")}
        </div>
      </div>` : ""}

      ${this.pDiaryStrip()}`;
  },

  pChildCard(c) {
    const att = c.attendance, fees = c.fees;
    const todayMark = (c.attendance.marks || []).find(m => m.date === Store.db.today && m.periodId === "reg");
    const best = c.subjects.filter(s => s.pct !== null).sort((a, b) => b.pct - a.pct)[0];
    const watch = c.subjects.filter(s => s.pct !== null).sort((a, b) => a.pct - b.pct)[0];
    const pending = (c.absenceNotes || []).filter(a => a.status === "reported" && a.date >= Store.db.today);
    return `
    <div class="card child-card mt-16">
      <div class="card-head">
        <span class="avatar lg navy">${esc(c.first[0] + c.last[0])}</span>
        <div><h3>${esc(c.first)} ${esc(c.last)}</h3>
          <div class="tiny muted">${esc(c.className)}${c.room ? ` · ${esc(c.room)}` : ""}${c.teacher ? ` · ${esc(c.teacher)}` : ""}</div></div>
        <div class="grow"></div>
        ${todayMark
          ? `<span class="pill ${STATUS_PILL[todayMark.status]}">Today: ${STATUS_LABEL[todayMark.status]}</span>`
          : `<span class="pill green">Today: Present</span>`}
      </div>
      <div class="card-body">
        <div class="tiles">
          <a class="tile" href="#/attendance" data-action="portal-pick" data-child="${c.id}" data-view="attendance">
            <div class="k">Attendance this term</div>
            <div class="v ${att.pct >= 95 ? "good" : att.pct >= 90 ? "" : "bad"}">${att.total ? att.pct + "%" : "—"}</div>
            <div class="s">${att.total ? `${att.present} of ${att.total} registers` : "No registers taken yet"}</div>
          </a>
          <a class="tile" href="#/progress" data-action="portal-pick" data-child="${c.id}" data-view="progress">
            <div class="k">Progress</div>
            <div class="v">${best && best.grade ? esc(best.grade.label) : "—"}</div>
            <div class="s">${best ? `Strongest: ${esc(best.subject)}${watch && watch.subject !== best.subject ? ` · watch ${esc(watch.subject)}` : ""}` : "No marks recorded yet"}</div>
          </a>
          <a class="tile" href="#/fees" data-action="portal-pick" data-child="${c.id}" data-view="fees">
            <div class="k">Fee account</div>
            <div class="v ${fees ? (fees.overdue > 0 ? "bad" : "good") : ""}">${fees ? this.money(fees.balance) : "—"}</div>
            <div class="s">${fees ? (fees.overdue > 0 ? `${this.money(fees.overdue)} overdue` : fees.next ? `Next ${this.money(fees.next.amount)} on ${Fmt.date(fees.next.due, "short")}` : "Settled in full") : "No invoice this term"}</div>
          </a>
          <a class="tile" href="#/messages" data-action="portal-pick" data-child="${c.id}" data-view="messages">
            <div class="k">Messages</div>
            <div class="v ${c.unread ? "alert" : ""}">${c.messages.length}${c.unread ? ` <span class="pill gold">${c.unread} new</span>` : ""}</div>
            <div class="s">${c.messages.length ? `Latest ${Fmt.date(c.messages[0].at, "short")}` : "Nothing yet"}</div>
          </a>
        </div>
        ${pending.length ? `<div class="notice info small mt-16">${icon("info")} You have told the school ${esc(c.first)} will be away on ${pending.map(a => Fmt.date(a.date, "short")).join(", ")}.</div>` : ""}
        ${c.medical && c.medical.allergies ? `<div class="notice warn small mt-16">${icon("alert")} <strong>Allergy on file:</strong> ${esc(c.medical.allergies)}. If this is wrong or out of date, tell the office today.</div>` : ""}
      </div>
      <div class="card-foot">
        <span class="tiny muted">${esc(c.admissionNo)}</span>
        <div class="grow"></div>
        <button class="btn ghost sm" data-action="portal-absence" data-child="${c.id}">Report an absence</button>
        <button class="btn sm" data-action="portal-write" data-child="${c.id}">${icon("send")} Message the school</button>
      </div>
    </div>`;
  },

  /* ======================================================================
     ATTENDANCE
     ====================================================================== */
  pAttendance(c) {
    const a = c.attendance;
    const notes = c.absenceNotes || [];
    return `
      ${this.pChildHead(c, `${a.total ? a.pct + "%" : "—"} this term`)}
      <div class="grid side">
        <div class="stack" style="gap:18px">
          <div class="card">
            <div class="card-head"><div><h3>Every mark this term</h3><div class="tiny muted">Registration and each lesson. Only days ${esc(c.first)} was not marked present are listed.</div></div></div>
            <div class="card-body tight table-wrap">
              ${a.marks.length ? `<table>
                <thead><tr><th>Date</th><th>Period</th><th>Mark</th><th>Note from the school</th></tr></thead>
                <tbody>${a.marks.map(m => `<tr>
                  <td class="nowrap">${Fmt.date(m.date, "weekday")}</td>
                  <td class="small muted">${esc(m.period)}${m.time ? ` · ${esc(m.time)}` : ""}</td>
                  <td><span class="pill ${STATUS_PILL[m.status]}">${STATUS_LABEL[m.status]}</span></td>
                  <td class="small">${esc(m.note || "—")}</td></tr>`).join("")}</tbody>
              </table>` : `<div class="empty">Full attendance so far this term. Nothing to show here is good news.</div>`}
            </div>
          </div>

          <div class="card">
            <div class="card-head"><div><h3>Absences you have told us about</h3><div class="tiny muted">A note here does not mark the register — it puts your reason in front of the teacher who does.</div></div>
              <button class="btn sm" data-action="portal-absence" data-child="${c.id}">${icon("plus")} Report an absence</button></div>
            <div class="card-body tight table-wrap">
              ${notes.length ? `<table>
                <thead><tr><th>Date</th><th>Reason</th><th>What you told us</th><th class="right">Status</th></tr></thead>
                <tbody>${notes.map(n => `<tr>
                  <td class="nowrap">${Fmt.date(n.date, "weekday")}</td><td>${esc(n.reason)}</td>
                  <td class="small muted">${esc(n.note || "—")}</td>
                  <td class="right"><span class="pill ${n.status === "acknowledged" ? "green" : "grey"}">${n.status === "acknowledged" ? "Seen by the school" : "Sent"}</span></td></tr>`).join("")}</tbody>
              </table>` : `<div class="empty">You have not reported any absences.</div>`}
            </div>
          </div>
        </div>

        <div class="stack" style="gap:18px">
          <div class="card"><div class="card-head"><h3>This term</h3></div><div class="card-body">
            <div class="donut-line"><span class="bar big"><span style="width:${a.pct}%;background:var(--${a.pct >= 95 ? "green" : a.pct >= 90 ? "navy" : "red"})"></span></span></div>
            <dl class="kv mt-16">
              <dt>Present</dt><dd>${a.counts.P || 0} day${(a.counts.P || 0) === 1 ? "" : "s"}</dd>
              <dt>Late</dt><dd>${a.counts.L || 0}</dd>
              <dt>Absent</dt><dd>${a.counts.A || 0}</dd>
              <dt>Excused</dt><dd>${a.counts.E || 0}</dd>
              <dt>Registers taken</dt><dd>${a.total} of ${a.schoolDays} school days</dd>
            </dl>
            <p class="tiny muted mt-16">Lateness counts as present for the figure above, and is shown separately because the school looks at both.</p>
          </div></div>
          <div class="card"><div class="card-head"><h3>How registers work here</h3></div><div class="card-body small muted">
            <p>The register is taken at ${esc((Store.db.periods[0] || {}).start || "08:30")} and again at the start of every lesson, within fifteen minutes of it beginning. A child who arrives after that is marked late, not absent.</p>
            <p class="mt-8">If a mark looks wrong to you, say so — use the message button and the class teacher will check it against the register.</p>
          </div></div>
        </div>
      </div>`;
  },

  /* ======================================================================
     PROGRESS
     ====================================================================== */
  pProgress(c) {
    const marked = c.subjects.filter(s => s.pct !== null);
    const scale = Store.db.gradeScale || [];
    return `
      ${this.pChildHead(c, marked.length ? `${marked.length} of ${c.subjects.length} subjects assessed` : "Not yet assessed")}
      ${!marked.length ? `<div class="card"><div class="empty">No marks have been entered for ${esc(c.first)} this term yet. They appear here as the teachers enter them — you do not have to wait for a report.</div></div>` : ""}
      <div class="grid cols-2">
        ${c.subjects.map(s => `
          <div class="card subject-card">
            <div class="card-head">
              <div><h3>${esc(s.subject)}</h3>
                <div class="tiny muted">${s.assessments.length} assessment${s.assessments.length === 1 ? "" : "s"} this term</div></div>
              <div class="grow"></div>
              ${s.pct === null ? `<span class="pill grey">Not yet assessed</span>`
                : `<span class="pill ${s.grade.colour}" style="font-size:13px">${esc(s.grade.label)}</span>`}
            </div>
            ${s.pct === null ? "" : `<div class="card-body">
              <div class="flex between"><span class="tiny muted">${esc(s.grade.desc)}</span><span class="bold">${s.pct}%</span></div>
              <div class="bar mt-8"><span style="width:${s.pct}%;background:var(--${s.grade.colour === "blue" ? "navy" : s.grade.colour})"></span></div>
              <div class="table-wrap mt-16"><table class="mini"><tbody>
                ${s.assessments.map(a => `<tr>
                  <td class="small">${esc(a.name)}<br><span class="tiny muted">${esc(a.kind)} · ${Fmt.date(a.date, "short")}</span></td>
                  <td class="right nowrap"><span class="bold">${a.mark}</span><span class="muted">/${a.max}</span><br><span class="tiny muted">${a.pct}%</span></td>
                </tr>`).join("")}
              </tbody></table></div>
            </div>`}
          </div>`).join("")}
      </div>

      <div class="card mt-24">
        <div class="card-head"><div><h3>What the standards mean</h3><div class="tiny muted">We describe the standard a child has reached. We do not publish positions in class.</div></div></div>
        <div class="card-body tight table-wrap"><table>
          <thead><tr><th style="width:140px">Standard</th><th>What it means</th></tr></thead>
          <tbody>${scale.map(g => `<tr><td><span class="pill ${g.colour}">${esc(g.label)}</span></td><td class="small muted">${esc(g.desc)}</td></tr>`).join("")}</tbody>
        </table></div>
      </div>

      ${this.pWeek(c)}`;
  },

  pWeek(c) {
    const days = Object.keys(c.week);
    const labels = Store.db.dayLabels || {};
    if (!days.length) return "";
    const rows = (c.week[days[0]] || []).length;
    if (!rows) return "";
    return `
      <div class="card mt-24">
        <div class="card-head"><div><h3>${esc(c.first)}'s week</h3><div class="tiny muted">Which subject, at what time, and who teaches it</div></div></div>
        <div class="card-body tight table-wrap"><table class="week">
          <thead><tr><th style="width:70px">Time</th>${days.map(d => `<th>${esc(labels[d] || d)}</th>`).join("")}</tr></thead>
          <tbody>${Array.from({ length: rows }, (_, i) => `<tr>
            <td class="tiny muted nowrap">${esc((c.week[days[0]][i] || {}).time || "")}</td>
            ${days.map(d => { const cell = (c.week[d] || [])[i] || {}; return `<td>${cell.subject
              ? `<span class="pill ${SUBJECTS[cell.subject] || "grey"}">${esc(cell.subject)}</span>${cell.teacher ? `<br><span class="tiny muted">${esc(cell.teacher)}</span>` : ""}`
              : `<span class="tiny muted">—</span>`}</td>`; }).join("")}
          </tr>`).join("")}</tbody>
        </table></div>
      </div>`;
  },

  /* ======================================================================
     FEES
     ====================================================================== */
  pFees(c) {
    const f = c.fees;
    if (!f) return `${this.pChildHead(c, "")}<div class="card"><div class="empty">No invoice has been raised for ${esc(c.first)} this term. The office will be in touch when it is.</div></div>`;
    const today = Store.db.today;
    return `
      ${this.pChildHead(c, f.status === "settled" ? "Settled in full" : f.overdue > 0 ? `${this.money(f.overdue)} overdue` : "Up to date")}
      <div class="grid side">
        <div class="stack" style="gap:18px">
          <div class="card">
            <div class="card-head"><div><h3>This term's invoice</h3><div class="tiny muted">${esc(f.term)} · issued ${Fmt.date(f.issued)}</div></div></div>
            <div class="card-body tight table-wrap"><table>
              <tbody>
                ${f.items.map(i => `<tr><td>${esc(i.name)}</td><td class="right nowrap">${this.money(i.amount)}</td></tr>`).join("")}
                ${f.discount ? `<tr><td class="small t-good">${esc(f.discountReason || "Discount")}</td><td class="right nowrap t-good">−${this.money(f.discount)}</td></tr>` : ""}
                <tr><td class="bold">Total for the term</td><td class="right bold nowrap">${this.money(f.total)}</td></tr>
              </tbody>
            </table></div>
          </div>

          <div class="card">
            <div class="card-head"><div><h3>Instalments</h3><div class="tiny muted">Payable in ${f.instalments.length}, on the dates below</div></div></div>
            <div class="card-body tight table-wrap"><table>
              <thead><tr><th>Instalment</th><th>Due</th><th class="right">Amount</th><th class="right">State</th></tr></thead>
              <tbody>${f.instalments.map(i => {
                const covered = f.paid >= f.instalments.filter(x => x.n <= i.n).reduce((n, x) => n + x.amount, 0);
                const late = !covered && i.due <= today;
                return `<tr><td>Instalment ${i.n}</td><td class="nowrap">${Fmt.date(i.due)}</td>
                  <td class="right nowrap">${this.money(i.amount)}</td>
                  <td class="right"><span class="pill ${covered ? "green" : late ? "red" : "grey"}">${covered ? "Paid" : late ? "Overdue" : "Due"}</span></td></tr>`;
              }).join("")}</tbody>
            </table></div>
          </div>

          <div class="card">
            <div class="card-head"><div><h3>Payments received</h3><div class="tiny muted">Everything the office has recorded against this account</div></div></div>
            <div class="card-body tight table-wrap">
              ${f.payments.length ? `<table>
                <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th class="right">Amount</th></tr></thead>
                <tbody>${f.payments.slice().reverse().map(p => `<tr><td class="nowrap">${Fmt.date(p.date)}</td><td>${esc(p.method)}</td><td class="small muted">${esc(p.ref || "—")}</td><td class="right nowrap bold">${this.money(p.amount)}</td></tr>`).join("")}</tbody>
              </table>` : `<div class="empty">No payments recorded yet.</div>`}
            </div>
            <div class="card-foot tiny muted">If you have paid something that is not listed here, tell the office — bring the reference and they will trace it.</div>
          </div>
        </div>

        <div class="stack" style="gap:18px">
          <div class="card"><div class="card-head"><h3>Where you stand</h3></div><div class="card-body">
            <div class="big-figure ${f.overdue > 0 ? "bad" : "good"}">${this.money(f.balance)}</div>
            <div class="tiny muted center">outstanding on this account</div>
            <dl class="kv mt-16">
              <dt>Billed</dt><dd>${this.money(f.total)}</dd>
              <dt>Received</dt><dd>${this.money(f.paid)}</dd>
              <dt>Overdue today</dt><dd>${f.overdue > 0 ? `<span class="pill red">${this.money(f.overdue)}</span>` : `<span class="pill green">None</span>`}</dd>
              <dt>Next due</dt><dd>${f.next ? `${this.money(f.next.amount)} on ${Fmt.date(f.next.due)}` : "—"}</dd>
            </dl>
          </div>
          <div class="card-foot"><button class="btn ghost sm grow" data-action="portal-write" data-child="${c.id}" data-subject="Fee account">${icon("send")} Ask about this account</button></div>
          </div>
          <div class="card"><div class="card-head"><h3>Paying</h3></div><div class="card-body small muted">
            <p>Payments are made at the school office, or by EcoCash and bank transfer using the details on your invoice. Always quote ${esc(c.admissionNo)} so it reaches the right account.</p>
            <p class="mt-8">If an instalment is going to be difficult, speak to the office before the date rather than after it. Arrangements are normal and are made quietly.</p>
          </div></div>
        </div>
      </div>`;
  },

  /* ======================================================================
     MESSAGES
     ====================================================================== */
  pMessages(c) {
    const list = c.messages.slice().reverse();     // oldest first, like a conversation
    return `
      ${this.pChildHead(c, `${c.messages.length} message${c.messages.length === 1 ? "" : "s"}`)}
      <div class="card">
        <div class="card-head"><div><h3>You and the school</h3><div class="tiny muted">Everything sent about ${esc(c.first)}, both ways, in one place</div></div></div>
        <div class="card-body thread-body portal-thread">
          ${list.length ? list.map(m => `
            <div class="msg ${m.direction === "in" ? "mine" : ""}">
              <div class="msg-head"><span class="bold">${esc(m.direction === "in" ? "You" : m.from)}</span>
                <span class="tiny muted">${Fmt.dateTime(m.at)}${m.channel && m.channel !== "portal" ? ` · ${esc(String(m.channel).toUpperCase())}` : ""}</span></div>
              ${m.subject ? `<div class="msg-subject">${esc(m.subject)}</div>` : ""}
              <div class="msg-body">${esc(m.body)}</div>
              ${m.direction === "in" ? `<div class="msg-state tiny ${m.read ? "read" : ""}">${m.read
                ? `${icon("check")} Read by ${esc(m.readBy || "the school")}${m.readAt ? ` · ${Fmt.dateTime(m.readAt)}` : ""}`
                : `${icon("clock")} Sent — waiting for the school to open it`}</div>` : ""}
            </div>`).join("") : `<div class="empty">Nothing has been sent yet. Anything the school sends about ${esc(c.first)} will appear here as well as by SMS or email.</div>`}
        </div>
        <form class="card-foot portal-compose" data-form="portal-message" data-id="${c.id}">
          <input class="input" name="subject" placeholder="Subject (optional)" maxlength="200">
          <textarea class="input" name="body" rows="2" placeholder="Write to ${esc(c.teacher || "the school office")}…" required></textarea>
          <button class="btn" type="submit">${icon("send")} Send</button>
        </form>
      </div>
      <p class="tiny muted mt-16">Messages reach the school office and ${esc(c.first)}'s class teacher. For anything urgent during the day, telephone ${esc(Store.db.school.phone || "the office")} — this is not a pager.</p>`;
  },

  /* ======================================================================
     SCHOOL DIARY
     ====================================================================== */
  pDiary() {
    const db = Store.db;
    const upcoming = db.events.filter(e => e.date >= db.today);
    const past = db.events.filter(e => e.date < db.today).reverse().slice(0, 6);
    const docs = db.documents || [];
    return `
      <div class="grid side">
        <div class="card">
          <div class="card-head"><div><h3>What is coming up</h3><div class="tiny muted">Term dates, events and meetings</div></div></div>
          <div class="card-body tight">
            ${upcoming.length ? upcoming.map(e => `
              <div class="notice-row">
                <div class="flex" style="gap:12px"><span class="pill ${e.colour || "grey"}">${Fmt.date(e.date, "short")}</span>
                  <div><div class="bold small">${esc(e.title)}</div><div class="tiny muted">${esc(e.kind || "")}</div></div></div>
                <div class="tiny muted nowrap">${Fmt.date(e.date, "weekday")}</div>
              </div>`).join("") : `<div class="empty">Nothing in the diary at the moment.</div>`}
            ${past.length ? `<div class="eyebrow mt-24 mb-8" style="padding:0 16px">Recently</div>
              ${past.map(e => `<div class="notice-row muted"><div class="small">${esc(e.title)}</div><div class="tiny nowrap">${Fmt.date(e.date, "short")}</div></div>`).join("")}` : ""}
          </div>
        </div>

        <div class="stack" style="gap:18px">
          <div class="card"><div class="card-head"><h3>The term</h3></div><div class="card-body">
            <dl class="kv">
              <dt>Term</dt><dd>${esc(Store.db.school.term.name || "—")}</dd>
              <dt>Begins</dt><dd>${Store.db.school.term.start ? Fmt.date(Store.db.school.term.start) : "—"}</dd>
              <dt>Ends</dt><dd>${Store.db.school.term.end ? Fmt.date(Store.db.school.term.end) : "—"}</dd>
            </dl>
          </div></div>
          ${docs.length ? `<div class="card"><div class="card-head"><h3>For families</h3></div><div class="card-body tight">
            ${docs.map(d => `<a class="notice-row" href="${esc(d.url || "#")}" target="_blank" rel="noopener">
              <div class="small bold">${esc(d.name)}</div><div class="tiny muted nowrap">${icon("external")}</div></a>`).join("")}
          </div></div>` : ""}
          <div class="card"><div class="card-head"><h3>The school day</h3></div><div class="card-body tight">
            <table class="mini"><tbody>${(Store.db.periods || []).map(p => `<tr><td class="tiny muted nowrap">${esc(p.start)}</td><td class="small">${esc(p.label)}</td></tr>`).join("")}</tbody></table>
          </div></div>
        </div>
      </div>`;
  },

  pDiaryStrip() {
    const db = Store.db;
    const next = db.events.filter(e => e.date >= db.today).slice(0, 4);
    if (!next.length) return "";
    return `
      <div class="card mt-24">
        <div class="card-head"><div><h3>Coming up</h3></div><a class="btn ghost sm" href="#/diary">The whole diary</a></div>
        <div class="card-body tight">
          ${next.map(e => `<div class="notice-row"><div class="flex" style="gap:12px">
            <span class="pill ${e.colour || "grey"}">${Fmt.date(e.date, "short")}</span>
            <span class="small bold">${esc(e.title)}</span></div>
            <span class="tiny muted nowrap">${Fmt.date(e.date, "weekday")}</span></div>`).join("")}
        </div>
      </div>`;
  },

  /* ======================================================================
     ACCOUNT
     ====================================================================== */
  pAccount() {
    const a = Store.db.account, pw = this.ui.setPassword, kids = Store.db.children;
    return `<div class="grid side">
      <div class="stack" style="gap:18px">
        <div class="card">
          <div class="card-head"><span class="avatar lg navy">${esc(this.portalInitials(a.name))}</span>
            <div><h2>${esc(a.name)}</h2><div class="muted">${esc(a.relationship)} · family portal</div></div></div>
          <div class="card-body">
            <form data-form="portal-details">
              <div class="form-row">
                <div><label class="field">Sign-in address</label><input class="input" value="${esc(a.email)}" disabled>
                  <div class="help">To change the address you sign in with, telephone the office. It is how we know it is you.</div></div>
                <div><label class="field">Telephone</label><input class="input" name="phone" value="${esc(a.phone)}" placeholder="+263 …">
                  <div class="help">Kept up to date here, and it is the number the school rings.</div></div>
              </div>
              <label class="field mt-16">You are the child's</label>
              <select class="input" name="relationship">${["Mother", "Father", "Grandmother", "Grandfather", "Aunt", "Uncle", "Guardian"].map(r => `<option ${a.relationship === r ? "selected" : ""}>${r}</option>`).join("")}</select>
              <button class="btn sm mt-16" type="submit">Save my details</button>
            </form>
          </div>
        </div>

        ${this.installAlways()}

        <div class="card"><div class="card-head"><h3>Your password</h3></div><div class="card-body">
          ${pw.done ? `<div class="notice ok">${icon("check")} Password changed. Nobody at the school can see it — if you forget it, the office issues a new temporary one.</div>
            <button class="btn ghost sm mt-16" data-action="pw-again">Change it again</button>`
          : `<form data-form="set-password">
            <label class="field" for="cur">Current password</label>
            <input class="input" id="cur" name="currentPassword" type="password" autocomplete="current-password" required>
            <label class="field mt-16" for="new1">New password</label>
            <input class="input" id="new1" name="password" type="password" autocomplete="new-password" required minlength="8">
            <label class="field mt-16" for="new2">Type it again</label>
            <input class="input" id="new2" name="confirm" type="password" autocomplete="new-password" required>
            <div class="help mt-8">At least eight characters, with a letter and a number.</div>
            ${pw.error ? `<div class="notice err mt-16">${icon("alert")} ${esc(pw.error)}</div>` : ""}
            <button class="btn sm mt-16" type="submit" ${pw.busy ? "disabled" : ""}>${pw.busy ? "Saving…" : "Change password"}</button>
          </form>`}
        </div></div>
      </div>

      <div class="stack" style="gap:18px">
        <div class="card"><div class="card-head"><h3>Children on this sign-in</h3></div><div class="card-body tight">
          ${kids.map(c => `<div class="notice-row"><div><div class="bold small">${esc(c.first)} ${esc(c.last)}</div>
            <div class="tiny muted">${esc(c.className)} · ${esc(c.admissionNo)}</div></div>
            <span class="pill ${c.status === "active" ? "green" : "grey"}">${esc(c.status || "active")}</span></div>`).join("")}
        </div>
        <div class="card-foot tiny muted">A brother or sister missing from this list? The office can add them to the same sign-in.</div></div>

        <div class="card"><div class="card-head"><h3>What this account can see</h3></div><div class="card-body small muted">
          <p>Your own children's records, and nothing else. There is no page here that reaches another family's child, another class, or the staff side of the portal.</p>
          <p class="mt-8">The school keeps your child's record confidential and logs every change to it. You may ask the office at any time to see everything we hold about your child.</p>
        </div></div>

        <div class="card"><div class="card-head"><h3>The office</h3></div><div class="card-body">
          <dl class="kv"><dt>Telephone</dt><dd>${esc(Store.db.school.phone || "—")}</dd>
            <dt>Email</dt><dd>${esc(Store.db.school.email || "—")}</dd>
            <dt>Address</dt><dd>${esc(Store.db.school.address || "—")}</dd></dl>
        </div></div>
      </div>
    </div>`;
  },

  /* --- shared bits ------------------------------------------------------- */
  pChildHead(c, right) {
    return `<div class="child-head">
      <span class="avatar lg navy">${esc(c.first[0] + c.last[0])}</span>
      <div><h2>${esc(c.first)} ${esc(c.last)}</h2>
        <div class="muted">${esc(c.className)}${c.teacher ? ` · ${esc(c.teacher)}` : ""}${c.assistant ? ` and ${esc(c.assistant)}` : ""}</div></div>
      <div class="grow"></div>
      ${right ? `<span class="pill navy" style="font-size:13px">${esc(right)}</span>` : ""}
    </div>`;
  },

  money(n) { return `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2 })}`; },

  /* ======================================================================
     FORMS AND ACTIONS
     ====================================================================== */
  portalAbsenceForm(childId) {
    const kids = Store.db.children;
    const c = kids.find(x => x.id === childId) || this.portalChild();
    if (!c) return;
    const body = `<form data-form="portal-absence">
      ${kids.length > 1 ? `<label class="field">Which child</label>
        <select class="input" name="pupilId">${kids.map(k => `<option value="${k.id}" ${k.id === c.id ? "selected" : ""}>${esc(k.first)} ${esc(k.last)} · ${esc(k.className)}</option>`).join("")}</select>`
        : `<input type="hidden" name="pupilId" value="${c.id}">`}
      <div class="form-row ${kids.length > 1 ? "mt-16" : ""}">
        <div><label class="field">Date away</label><input class="input" type="date" name="date" value="${Store.db.today}" required></div>
        <div><label class="field">Reason</label><select class="input" name="reason">${ABSENCE_REASONS.map(r => `<option>${r}</option>`).join("")}</select></div>
      </div>
      <label class="field mt-16">Anything the teacher should know</label>
      <textarea class="input" name="note" rows="3" placeholder="When you expect them back, whether they need to take it gently…"></textarea>
      <div class="help mt-8">This does not mark the register — only a teacher does that. It puts your reason in front of whoever takes it, the same morning.</div>
      <div class="modal-foot" style="padding:16px 0 0;border:0">
        <button type="button" class="btn ghost" data-action="close-modal">Cancel</button>
        <button class="btn" type="submit">Tell the school</button>
      </div>
    </form>`;
    this.modal({ title: "Report an absence", body });
  },

  portalWriteForm(childId, subject) {
    const kids = Store.db.children;
    const c = kids.find(x => x.id === childId) || this.portalChild();
    if (!c) return;
    const body = `<form data-form="portal-message" data-id="${c.id}">
      <p class="muted small">This goes to the school office and to ${esc(c.teacher || "the class teacher")}, and is kept on ${esc(c.first)}'s record alongside everything the school has sent you.</p>
      <label class="field mt-16">Subject</label>
      <input class="input" name="subject" maxlength="200" value="${esc(subject || "")}" placeholder="What it is about">
      <label class="field mt-16">Your message</label>
      <textarea class="input" name="body" rows="5" required></textarea>
      <div class="modal-foot" style="padding:16px 0 0;border:0">
        <button type="button" class="btn ghost" data-action="close-modal">Cancel</button>
        <button class="btn" type="submit">${icon("send")} Send</button>
      </div>
    </form>`;
    this.modal({ title: `Message the school about ${c.first}`, body });
  },

  portalActions(d, el, e) {
    if (!Store.isFamily) return this.officeActions ? this.officeActions(d, el, e) : {};
    return {
      "portal-absence": () => this.portalAbsenceForm(d.child),
      "portal-write": () => this.portalWriteForm(d.child, d.subject),
      "portal-pick": () => { this.ui.portal.childId = d.child; this.portalGo(d.view); },
    };
  },

  portalChange(k, v) {
    if (k !== "portal-child") return false;
    this.ui.portal.childId = v; this.render(); return true;
  },

  portalSubmit(k, f, id, form) {
    if (!Store.isFamily) return this.officeSubmit ? this.officeSubmit(k, f, id, form) : false;

    if (k === "portal-absence") {
      const done = this.landingBusy(form, "Sending…");
      Store.portal("absence", { pupilId: f.pupilId, date: f.date, reason: f.reason, note: f.body || f.note })
        .then(() => { this.closeModal(); this.toast("The school has been told."); this.render(); })
        .catch(e => { done(); this.landingFormError(form, e.message || "Could not send that."); });
      return true;
    }

    if (k === "portal-message") {
      if (!String(f.body || "").trim()) { this.landingFormError(form, "The message is empty."); return true; }
      const done = this.landingBusy(form, "Sending…");
      Store.portal("message", { pupilId: id || (this.portalChild() || {}).id, subject: f.subject, body: f.body })
        .then(() => { this.closeModal(); this.toast("Message sent to the school."); this.render(); })
        .catch(e => { done(); this.landingFormError(form, e.message || "Could not send the message."); });
      return true;
    }

    if (k === "portal-details") {
      const done = this.landingBusy(form, "Saving…");
      Store.portal("details", { phone: f.phone, relationship: f.relationship })
        .then(() => { this.toast("Your details are saved."); this.render(); })
        .catch(e => { done(); this.landingFormError(form, e.message || "Could not save your details."); });
      return true;
    }
    return false;
  },
});

/* ==========================================================================
   The office's side of the portal
   --------------------------------------------------------------------------
   Giving a family a way in, and taking it back. This half runs inside the
   staff portal, so everything here is behind "portal.view" / "portal.manage"
   and none of it is reachable from a family sign-in.
   ========================================================================== */
Object.assign(App, {

  vFamilies() {
    const q = (this.ui.families.q || "").trim().toLowerCase();
    const accounts = (Store.db.guardians || []).slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const byPupil = new Map();
    accounts.forEach(g => (g.pupilIds || []).forEach(id => byPupil.set(id, g)));
    const pupils = this.myClasses().flatMap(c => Store.pupilsIn(c.id));
    const without = pupils.filter(p => !byPupil.has(p.id));
    const shown = accounts.filter(g => !q || `${g.name} ${g.email} ${(g.pupilIds || []).map(id => { const p = Store.pupil(id); return p ? p.first + " " + p.last : ""; }).join(" ")}`.toLowerCase().includes(q));
    const manage = this.can("portal.manage");

    return `
    <div class="toolbar">
      <div class="search">${icon("search")}<input class="input" placeholder="Search families, children, email" value="${esc(this.ui.families.q || "")}" data-input="families-q"></div>
      <div class="grow"></div>
      <span class="muted small">${accounts.filter(g => g.active).length} account${accounts.filter(g => g.active).length === 1 ? "" : "s"} · ${without.length} child${without.length === 1 ? "" : "ren"} not yet covered</span>
    </div>

    <div class="grid cols-3 mb-16">
      ${[["Accounts", accounts.filter(g => g.active).length, "families with a sign-in"],
         ["Have used it", accounts.filter(g => g.lastSeen).length, "have signed in at least once"],
         ["Not yet invited", without.length, "children in your classes whose family has no account"]].map(([k, v, s]) => `
        <div class="card stat"><div class="card-body"><div class="k">${k}</div><div class="v">${v}</div><div class="s tiny muted">${esc(s)}</div></div></div>`).join("")}
    </div>

    <div class="card mb-16">
      <div class="card-head"><div><h3>Family accounts</h3><div class="tiny muted">One account per family. A guardian with two children here signs in once and sees both.</div></div></div>
      <div class="card-body tight table-wrap"><table>
        <thead><tr><th>Guardian</th><th>Children</th><th>Email</th><th>Last signed in</th><th></th></tr></thead>
        <tbody>${shown.length ? shown.map(g => `<tr class="${g.active ? "" : "muted"}">
          <td><div class="flex"><span class="avatar sm">${esc(this.portalInitials(g.name))}</span>
            <span><span class="bold">${esc(g.name)}</span><br><span class="tiny muted">${esc(g.relationship || "Guardian")}${g.phone ? ` · ${esc(g.phone)}` : ""}</span></span></div></td>
          <td class="small">${(g.pupilIds || []).map(id => { const p = Store.pupil(id); return p ? `${esc(p.first)} ${esc(p.last)}` : `<span class="muted">not in your classes</span>`; }).join("<br>")}</td>
          <td class="small">${esc(g.email)}</td>
          <td class="small ${g.lastSeen ? "" : "muted"}">${g.lastSeen ? Fmt.dateTime(g.lastSeen) : "Never"}</td>
          <td class="right nowrap">${!g.active ? `<span class="pill grey">Closed</span>` : manage ? `
            <button class="btn xs ghost" data-action="family-close" data-id="${g.id}">Close</button>
            <button class="btn xs" data-action="family-reset" data-id="${g.id}">Reset sign-in</button>` : ""}</td>
        </tr>`).join("") : `<tr><td colspan="5" class="empty">No family accounts yet. Invite one from the list below, or from a pupil's record.</td></tr>`}</tbody>
      </table></div>
    </div>

    ${without.length ? `<div class="card">
      <div class="card-head"><div><h3>Children whose family has no sign-in</h3><div class="tiny muted">Inviting one creates the account from the guardian already on the pupil record, and issues a temporary password to hand over.</div></div>
        ${manage && without.filter(p => p.guardian.email).length > 1
          ? `<button class="btn sm" data-action="family-invite-all">${icon("family")} Invite all ${without.filter(p => p.guardian.email).length}</button>` : ""}</div>
      <div class="card-body tight table-wrap"><table>
        <thead><tr><th>Pupil</th><th>Class</th><th>Guardian on file</th><th>Email</th><th></th></tr></thead>
        <tbody>${without.map(p => `<tr>
          <td><span class="bold">${esc(p.first)} ${esc(p.last)}</span><br><span class="tiny muted">${esc(p.admissionNo)}</span></td>
          <td>${esc(Store.cls(p.classId).name)}</td>
          <td class="small">${esc(p.guardian.name)}<br><span class="tiny muted">${esc(p.guardian.relationship)}</span></td>
          <td class="small ${p.guardian.email ? "" : "muted"}">${esc(p.guardian.email || "none on file")}</td>
          <td class="right">${manage ? `<button class="btn xs" data-action="family-invite" data-pupil="${p.id}">Give them a sign-in</button>` : ""}</td>
        </tr>`).join("")}</tbody>
      </table></div>
    </div>` : ""}`;
  },

  /* ------------------------------------------------------------------------
     Inviting a school, rather than a child at a time
     ------------------------------------------------------------------------
     One at a time is right for one at a time: a child arrives in March and
     the office gives their family a sign-in. It is the wrong shape entirely
     for the job that actually has to happen — getting a whole school online
     at the start of a year. Two hundred families is two hundred modals, each
     with a password shown once that somebody has to write down before they
     close it, which is not a task anybody finishes.

     So: one pass, one list. Every family that can have an account gets one,
     and the passwords come back as a table to print or take away as a CSV —
     because a password shown once and never again has to leave the screen
     somehow, and two hundred of them leave on paper.

     A guardian with no email address on file is skipped rather than guessed
     at: the email is the sign-in, so inventing one would create an account
     nobody can use and quietly hide the fact that the record is incomplete.
     They are listed by name so the office knows who to go and ask.
     ------------------------------------------------------------------------ */
  familyInviteAll() {
    if (!this.can("portal.manage")) return;
    const accounts = Store.db.guardians || [];
    const covered = new Set(accounts.flatMap(g => g.pupilIds || []));
    const without = this.myClasses().flatMap(c => Store.pupilsIn(c.id)).filter(p => !covered.has(p.id));
    const can = without.filter(p => p.guardian && p.guardian.email);
    const cannot = without.filter(p => !(p.guardian && p.guardian.email));

    /* One account per family: two children with the same guardian email get
       one sign-in that opens both, which is what the portal promises. */
    const families = new Map();
    for (const p of can) {
      const key = String(p.guardian.email).toLowerCase();
      const f = families.get(key) || { email: p.guardian.email, name: p.guardian.name,
        relationship: p.guardian.relationship || "Guardian", phone: p.guardian.phone || "", pupils: [] };
      f.pupils.push(p);
      families.set(key, f);
    }
    const list = [...families.values()];

    if (!list.length) {
      return this.modal({ title: "Nobody to invite", body: `<p class="small">Every child in your classes already has a family account, or their guardian has no email address on file. ${cannot.length ? `${cannot.length} ${cannot.length === 1 ? "record has" : "records have"} no email — add one on the pupil's record first.` : ""}</p>` });
    }

    this.modal({
      title: `Give ${list.length} famil${list.length === 1 ? "y" : "ies"} a sign-in`,
      wide: true,
      body: `
        <p class="small">One account each, built from the guardian already on the record. A guardian with two children here gets one sign-in that opens both.</p>
        <div class="grid cols-3 mt-16">
          <div class="card stat"><div class="card-body"><div class="k">Accounts</div><div class="v">${list.length}</div><div class="s tiny muted">for ${can.length} child${can.length === 1 ? "" : "ren"}</div></div></div>
          <div class="card stat"><div class="card-body"><div class="k">Skipped</div><div class="v ${cannot.length ? "t-warn" : "t-good"}">${cannot.length}</div><div class="s tiny muted">no email on the record</div></div></div>
          <div class="card stat"><div class="card-body"><div class="k">Passwords</div><div class="v">${list.length}</div><div class="s tiny muted">shown once, on the next screen</div></div></div>
        </div>
        ${cannot.length ? `<div class="notice warn small mt-16">${icon("alert")}
          <div><strong>${cannot.length} skipped for want of an email address.</strong> The email is the sign-in, so these need one adding to the pupil's record first:
          <div class="tiny mt-8">${cannot.slice(0, 12).map(p => esc(`${p.first} ${p.last}`)).join(" · ")}${cannot.length > 12 ? ` · and ${cannot.length - 12} more` : ""}</div></div></div>` : ""}
        <div class="notice info small mt-16">${icon("lock")} Each password is shown once and cannot be looked up afterwards. Print the list or download it before you close it — that is the only copy.</div>`,
      foot: `<button type="button" class="btn ghost" data-action="close-modal">Cancel</button>
             <div class="grow"></div>
             <button type="button" class="btn" data-action="family-invite-all-go">${icon("key")} Create ${list.length} sign-in${list.length === 1 ? "" : "s"}</button>`,
    });
    this._bulkInvite = list;
  },

  async familyInviteAllGo() {
    const list = this._bulkInvite || [];
    if (!list.length) return;
    const button = document.querySelector('[data-action="family-invite-all-go"]');
    if (button) { button.disabled = true; button.textContent = "Creating…"; }

    const done = [], failed = [];
    for (const f of list) {
      const password = temporaryPassword();
      try {
        if (Store.shared) {
          const out = await Store.request("portal/invite", { pupilId: f.pupils[0].id, name: f.name,
            relationship: f.relationship, email: f.email, phone: f.phone, password });
          /* A second child on the same account is added by inviting again. */
          for (const extra of f.pupils.slice(1)) {
            await Store.request("portal/invite", { pupilId: extra.id, name: f.name,
              relationship: f.relationship, email: f.email, phone: f.phone, password });
          }
          done.push({ ...f, password: (out && out.temporaryPassword) || password });
        } else {
          const account = { id: Store.uid("g"), name: f.name, relationship: f.relationship,
            email: f.email, phone: f.phone, pupilIds: f.pupils.map(p => p.id), active: true,
            createdBy: this.me().id, createdAt: new Date().toISOString(), lastSeen: null };
          Store.db.guardians = Store.db.guardians || [];
          Store.db.guardians.push(account);
          await Store.demoIssue(account.id, password);
          done.push({ ...f, password });
        }
      } catch (e) { failed.push({ ...f, why: e.message || "Could not create it" }); }
    }
    if (!Store.shared) { Store.audit(`Family portal: created ${done.length} sign-ins in one pass`); Store.save(); }
    this._bulkInvite = null;
    this._bulkIssued = done;
    this.render();
    this.bulkInviteResult(done, failed);
  },

  bulkInviteResult(done, failed) {
    const rows = done.map(f => `<tr>
      <td class="small"><strong>${esc(f.name)}</strong><br><span class="tiny muted">${f.pupils.map(p => esc(`${p.first} ${p.last}`)).join(", ")}</span></td>
      <td class="small">${esc(f.email)}</td>
      <td class="mono small">${esc(f.password)}</td>
    </tr>`).join("");
    this.modal({
      title: `${done.length} sign-in${done.length === 1 ? "" : "s"} created`,
      wide: true,
      body: `
        <div class="notice gold small">${icon("alert")} <strong>This is the only time these are shown.</strong> They are stored hashed, so nobody — not HR, not the Head Teacher — can read them back. Print this or download it now; anything lost has to be reset one family at a time.</div>
        ${failed.length ? `<div class="notice err small mt-16">${icon("alert")} ${failed.length} could not be created: ${failed.slice(0, 5).map(f => esc(f.name)).join(", ")}${failed.length > 5 ? "…" : ""}</div>` : ""}
        <div class="card-body tight table-wrap mt-16" style="max-height:46vh">
          <table><thead><tr><th>Family</th><th>Signs in with</th><th>Password</th></tr></thead><tbody>${rows}</tbody></table>
        </div>
        <p class="tiny muted mt-16">Hand each one over in person or by telephone, never by email — the email address is half of the sign-in. They may keep the password or change it themselves whenever they like.</p>`,
      foot: `<button type="button" class="btn ghost" data-action="bulk-invite-csv">${icon("download")} Download as CSV</button>
             <button type="button" class="btn ghost" onclick="window.print()">${icon("print")} Print</button>
             <div class="grow"></div>
             <button type="button" class="btn" data-action="close-modal">I have a copy</button>`,
    });
  },

  /* The family portal card on a pupil's record, so the office can do this
     where it already is rather than going somewhere else for it. */
  familyCardFor(p) {
    if (!this.can("portal.view")) return "";
    const g = (Store.db.guardians || []).find(x => (x.pupilIds || []).includes(p.id));
    const manage = this.can("portal.manage");
    return `<div class="eyebrow mt-24 mb-8">Family portal</div>
      ${g ? `<div class="flex between" style="gap:12px;align-items:flex-start">
        <div class="small"><strong>${esc(g.name)}</strong> signs in as <code>${esc(g.email)}</code>.<br>
          <span class="tiny muted">${g.active ? (g.lastSeen ? `Last signed in ${Fmt.dateTime(g.lastSeen)}.` : "Has never signed in yet.") : "This account is closed."}</span></div>
        ${manage && g.active ? `<button class="btn xs ghost" data-action="family-reset" data-id="${g.id}">Reset sign-in</button>` : ""}
      </div>`
      : `<div class="flex between" style="gap:12px;align-items:flex-start">
        <div class="small muted">${esc(p.guardian.name)} has no portal sign-in. ${p.guardian.email ? `They would sign in as <code>${esc(p.guardian.email)}</code>.` : "There is no email address on this record to sign in with."}</div>
        ${manage ? `<button class="btn xs" data-action="family-invite" data-pupil="${p.id}">Give them a sign-in</button>` : ""}
      </div>`}`;
  },

  familyInviteForm(pupilId) {
    const p = Store.pupil(pupilId); if (!p) return;
    const g = p.guardian || {};
    const body = `<form data-form="family-invite" data-id="${p.id}">
      <p class="muted small">This gives ${esc(g.name || "the guardian")} a sign-in to ${esc(p.first)}'s record — attendance, marks, the fee account and the messages between you. It shows them nothing else.</p>
      <div class="form-row mt-16">
        <div><label class="field">Guardian's name</label><input class="input" name="name" required value="${esc(g.name || "")}"></div>
        <div><label class="field">Relationship</label><input class="input" name="relationship" value="${esc(g.relationship || "Guardian")}"></div>
      </div>
      <div class="form-row mt-8">
        <div><label class="field">Email they will sign in with</label><input class="input" type="email" name="email" required value="${esc(g.email || "")}" placeholder="name@example.com"></div>
        <div><label class="field">Telephone</label><input class="input" name="phone" value="${esc(g.phone || "")}"></div>
      </div>
      <div class="eyebrow mt-24 mb-8">Their first password</div>
      ${this.passwordField("Password to give them")}
      <div class="notice info small mt-16">${icon("lock")} Hand it over in person or by telephone — never by email. It is shown once on the next screen and cannot be looked up afterwards.</div>
      <div class="modal-foot" style="padding:16px 0 0;border:0">
        <button type="button" class="btn ghost" data-action="close-modal">Cancel</button>
        <button class="btn" type="submit">Create the sign-in</button>
      </div>
    </form>`;
    this.modal({ title: `Family portal — ${p.first} ${p.last}`, body });
  },

  /* ----------------------------------------------------------------------
     The password field the office fills in
     ----------------------------------------------------------------------
     It starts with a generated one, because a generated one is better than
     most people would choose. But it is a plain, editable, visible field: the
     office frequently has to read it down a telephone or say it across a desk,
     and a password they picked is one they can say. Either way it is
     must-change, so it lives only until its first use.
     ---------------------------------------------------------------------- */
  passwordField(label = "Password to give them", help = "") {
    const id = `pw_${Math.random().toString(36).slice(2, 8)}`;
    return `
      <label class="field" for="${id}">${esc(label)}</label>
      <div class="pw">
        <input class="input mono" id="${id}" name="password" type="text" autocomplete="off"
               spellcheck="false" autocapitalize="off" minlength="8" required value="${esc(temporaryPassword())}">
        <button type="button" class="pw-toggle" data-action="pw-generate" data-target="${id}">Generate</button>
      </div>
      <div class="help mt-8">${help || "Type over it if you would rather choose one. At least eight characters, with a letter and a number. They may keep it for as long as they like, and change it themselves whenever they want to."}</div>
      <label class="check mt-16">
        <input type="checkbox" name="mustChange" value="1">
        <span>Make them choose their own the first time they sign in<span class="tiny muted"> — tick this if the password above has been written down anywhere, or passed through more hands than it should have.</span></span>
      </label>`;
  },

  /* ----------------------------------------------------------------------
     A temporary password, shown once
     ----------------------------------------------------------------------
     It is never stored in readable form and cannot be looked up again, so
     this screen says so plainly and tells the holder how to pass it on.
     ---------------------------------------------------------------------- */
  credentialModal({ title, who, email, password, note }) {
    this.modal({
      title,
      body: `<p class="small">${esc(who)} signs in with the address below and this password, once.</p>
        <div class="cred mt-16">
          <div><div class="k">Sign in with</div><div class="v">${esc(email)}</div></div>
          <div><div class="k">Temporary password</div><div class="v big">${esc(password)}</div></div>
        </div>
        <div class="notice gold mt-16 small">${icon("alert")} <strong>This is the only time it is shown.</strong> It is stored hashed, so nobody — not HR, not the Head Teacher, not the Director — can read it back. If it is lost, issue another.</div>
        <p class="tiny muted mt-16">${esc(note || "Hand it over in person or by telephone, not by email. They may keep it, or change it themselves at any time from their own account page.")}</p>`,
      foot: `<button class="btn ghost" data-action="copy-credential" data-text="${esc(password)}">Copy password</button><div class="grow"></div><button class="btn" data-action="close-modal">Done</button>`,
    });
  },

  /* --- office actions ---------------------------------------------------- */
  officeActions(d) {
    return {
      "copy-credential": () => {
        navigator.clipboard?.writeText(d.text).then(() => this.toast("Copied. Paste it somewhere it will not linger."))
          .catch(() => this.toast("Could not copy — read it off the screen.", "err"));
      },
      "family-invite": () => this.familyInviteForm(d.pupil),
      "family-invite-all": () => this.familyInviteAll(),
      "family-invite-all-go": () => this.familyInviteAllGo(),
      "bulk-invite-csv": () => {
        const rows = [["Family", "Children", "Signs in with", "Password"],
          ...(this._bulkIssued || []).map(f => [f.name, f.pupils.map(p => `${p.first} ${p.last}`).join("; "), f.email, f.password])];
        /* Quoted, because a guardian called "Ncube, Sipho" would otherwise
           split into two columns and the list would silently go wrong. */
        const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
        a.download = `ayanda_family_signins_${Store.today()}.csv`;
        a.click();
        this.toast("Downloaded. It has passwords in it — keep it as carefully as you would keep them.");
      },
      "pw-generate": () => {
        const box = document.getElementById(d.target);
        if (!box) return;
        box.value = temporaryPassword();
        box.focus(); box.select();
      },
      "family-reset": () => this.resetForm("family", d.id),
      "family-close": () => this.familyClose(d.id),
      "staff-reset": () => this.staffReset(d.id),
    };
  },

  /* One form for both kinds of account: choose the new password or take the
     generated one, and say plainly what it costs the holder. */
  resetForm(kind, id) {
    const who = kind === "family"
      ? (Store.db.guardians || []).find(x => x.id === id)
      : Store.staff(id);
    if (!who) return;
    const name = kind === "family" ? who.name : `${who.first} ${who.last}`;
    const body = `<form data-form="reset-signin" data-id="${id}" data-kind="${kind}">
      <p class="muted small">This replaces ${esc(name)}'s password straight away. The one they have now stops working, and they are signed out everywhere they are signed in.</p>
      <div class="mt-16">${this.passwordField("New password to give them")}</div>
      <div class="modal-foot" style="padding:16px 0 0;border:0">
        <button type="button" class="btn ghost" data-action="close-modal">Cancel</button>
        <button class="btn" type="submit">${icon("key")} Issue it</button>
      </div>
    </form>`;
    this.modal({ title: `Reset ${name}'s sign-in`, body });
  },

  async issueReset(kind, id, password, form, mustChange = false) {
    const who = kind === "family" ? (Store.db.guardians || []).find(x => x.id === id) : Store.staff(id);
    if (!who) return;
    const name = kind === "family" ? who.name : `${who.first} ${who.last}`;
    const done = form ? this.landingBusy(form, "Issuing…") : () => {};
    try {
      if (Store.shared) {
        const path = kind === "family" ? `portal/accounts/${id}/reset` : `auth/password/${id}`;
        const out = await Store.request(path, { password, mustChange });
        this.closeModal();
        this.credentialModal({ title: "New sign-in issued", who: out.name || name, email: out.email || who.email, password: out.temporaryPassword });
      } else {
        await Store.demoIssue(id, password, { mustChange });
        this.closeModal();
        this.credentialModal({ title: "New sign-in issued", who: name, email: who.email, password });
      }
      this.render();
    } catch (e) {
      done();
      if (form) this.landingFormError(form, e.message || "Could not reset that sign-in.");
      else this.toast(e.message || "Could not reset that sign-in.", "err");
    }
  },

  async familyClose(id) {
    const g = (Store.db.guardians || []).find(x => x.id === id); if (!g) return;
    try {
      if (Store.shared) {
        /* The server owns the account, so the way back is to open it again
           rather than to put a value back. */
        await Store.request(`portal/accounts/${id}/close`, {});
        this.render();
        this.toast(`${g.name} is signed out and cannot sign in again.`, "", {
          undo: () => Store.request(`portal/accounts/${id}/reopen`, {})
            .then(() => { this.render(); this.toast("Account open again."); })
            .catch(e => this.toast(e.message || "Could not reopen it — give them a new sign-in instead.", "err")),
        });
        return;
      }
      this.undoable(`${g.name} is signed out and cannot sign in again. Nothing on the children's records changed.`, {
        audit: `Family portal: closed the account for ${g.name}`,
        snapshot: () => { const was = g.active; g.active = false; return was; },
        restore: (was) => { g.active = was; },
      });
    } catch (e) { this.toast(e.message || "Could not close that account.", "err"); }
  },

  /* --- resetting a colleague's sign-in ----------------------------------- */
  staffReset(id) {
    const s = Store.staff(id); if (!s) return;
    if (!canIssueAccount(this.me(), s)) return this.toast(`${s.first} ${s.last} is ${ROLES[s.role].label}, which sits above your own level.`, "err");
    this.resetForm("staff", id);
  },

  officeSubmit(k, f, id, form) {
    if (k === "reset-signin") {
      this.issueReset(form.dataset.kind, id, f.password, form, !!f.mustChange);
      return true;
    }
    if (k !== "family-invite") return false;

    const p = Store.pupil(id);
    const done = this.landingBusy(form, "Creating…");
    const password = String(f.password || "").trim();
    const mustChange = !!f.mustChange;
    const body = { pupilId: id, name: f.name.trim(), relationship: f.relationship.trim(), email: f.email.trim(), phone: (f.phone || "").trim(), password, mustChange };

    const finish = (issued) => {
      this.closeModal();
      this.credentialModal({ title: "Family sign-in created", who: body.name, email: body.email, password: issued });
      this.render();
    };

    if (Store.shared) {
      Store.request("portal/invite", body)
        .then(out => finish((out && out.temporaryPassword) || password))
        .catch(e => { done(); this.landingFormError(form, e.message || "Could not create that sign-in."); });
      return true;
    }

    /* Demo mode: the same record, and a real credential in this browser. */
    const taken = (Store.db.guardians || []).find(g => String(g.email).toLowerCase() === body.email.toLowerCase());
    const account = taken || { ...body, id: Store.uid("g"), pupilIds: [], active: true, createdBy: this.me().id, createdAt: new Date().toISOString(), lastSeen: null };
    delete account.password;
    delete account.pupilId;
    if (taken) { account.pupilIds = [...new Set([...(account.pupilIds || []), id])]; account.active = true; }
    else { account.pupilIds = [id]; Store.db.guardians = Store.db.guardians || []; Store.db.guardians.push(account); }

    Store.demoIssue(account.id, password, { mustChange })
      .then(() => {
        Store.audit(`Family portal: gave ${body.name} a sign-in for ${p.first} ${p.last}`);
        Store.save();
        finish(password);
      })
      .catch(e => { done(); this.landingFormError(form, e.message || "Could not create that sign-in."); });
    return true;
  },
});
