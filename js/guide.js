/* ==========================================================================
   The written guide to the portal
   --------------------------------------------------------------------------
   Ten steps, one per screen, each with a line about what it is for and a
   rendering of that screen.

   This used to sit on the public staff page, where it was the most useful
   thing on the site to somebody who did not work here: a labelled map of
   every page in the system, what each one holds, who can see it, and what the
   sign-in box looks like. It is a guide for the people who already have an
   account, so it now lives where they are — behind the sign-in, in the
   portal's own menu.

   It is also the reason this is a separate file. index.html does not load it,
   the service worker does not cache it, and the public page's source does not
   contain it: the portal fetches it after somebody has signed in. When the
   school runs the Node server that fetch carries the session token and the
   server refuses the file without one, so it is genuinely closed. Served as
   static files from GitHub Pages there is nobody to check a token, and
   anybody who knows the address can still ask for it — there it is obscurity
   rather than a lock, and it is worth knowing which of the two you have.
   ========================================================================== */

Object.assign(App, {

  /* Small, faithful pieces of the real interface, built from the same CSS the
     portal uses — so what is shown here is what a member of staff gets. */
  previews: {
    attendance: () => `
      <div class="shot-head"><span class="bold">Registers · ECD A — Sunbeams</span><span class="tiny muted">Mon 14 Sept</span></div>
      <div class="reg-chips mini">
        <span class="reg-chip done"><span class="t">08:30</span><span class="l">Registration</span><span class="s">Taken</span></span>
        <span class="reg-chip done"><span class="t">09:25</span><span class="l">Mathematics</span><span class="s">Taken</span></span>
        <span class="reg-chip open sel"><span class="t">10:25</span><span class="l">English</span><span class="s">Open now</span></span>
        <span class="reg-chip missed"><span class="t">11:05</span><span class="l">isiNdebele</span><span class="s">Missed</span></span>
        <span class="reg-chip upcoming"><span class="t">12:15</span><span class="l">VPA</span><span class="s">Upcoming</span></span>
      </div>
      <div class="notice gold mt-16 small">${icon("check")} Open until 10:40 — a register can be taken for fifteen minutes, then it locks.</div>`,

    admissions: () => `
      <div class="shot-head"><span class="bold">Admissions · January 2027 intake</span><span class="tiny muted">7 live</span></div>
      <div class="board mini">
        ${[["Enquiry", 2, "grey"], ["Documents", 1, "grey"], ["Visit", 1, "grey"], ["Offer", 1, "gold"], ["Accepted", 1, "green"]].map(([label, n, tone]) => `
          <div class="col"><div class="col-head"><span class="bold tiny">${label}</span><span class="pill ${tone} tiny">${n}</span></div>
          ${label === "Offer" ? `<div class="cand"><div class="bold tiny">Applicant</div><div class="tiny muted">ECD A · sibling at the school</div><div class="pill green tiny mt-8">Docs 5/5</div></div>` : ""}
          ${label === "Accepted" ? `<div class="cand"><div class="bold tiny">Applicant</div><div class="tiny muted">ECD B · deposit paid</div></div>` : ""}
          </div>`).join("")}
      </div>
      <div class="tiny muted mt-8">Enrolling an accepted child creates the pupil record, allocates the class and raises the term's invoice in one step.</div>`,

    record: () => `
      <div class="shot-head"><span class="bold">A pupil\u2019s record</span><span class="flex" style="gap:5px"><span class="pill green">100% attendance</span><span class="pill blue">E · 89%</span><span class="pill blue">On track</span></span></div>
      <div class="tabs mini"><span class="tab">Overview</span><span class="tab on">Timeline</span><span class="tab">Fees</span><span class="tab">Academic</span></div>
      <ul class="timeline full mini">
        <li><span class="t">14 Sept</span><span class="pill navy tiny">academic</span><span>Heritage-Social Studies: 23/30</span></li>
        <li><span class="t">11 Sept</span><span class="pill blue tiny">comms</span><span>SMS to guardian — absence at registration</span></li>
        <li><span class="t">2 Sept</span><span class="pill green tiny">fees</span><span>$165 received — EcoCash</span></li>
        <li><span class="t">9 Jan</span><span class="pill gold tiny">admission</span><span>Enrolled into Grade 1 — Acacia</span></li>
      </ul>`,

    governance: () => `
      <div class="shot-head"><span class="bold">Board &amp; statutory</span><span class="pill gold tiny">Director &amp; Secretary only</span></div>
      <table class="mini"><tbody>
        <tr><td class="small bold">Certificate of Registration</td><td class="right"><span class="pill green">Current</span></td></tr>
        <tr><td class="small bold">Fire safety certificate</td><td class="right"><span class="pill amber">Renew in 16 days</span></td></tr>
        <tr><td class="small bold">Public liability insurance</td><td class="right"><span class="pill green">Current</span></td></tr>
      </tbody></table>
      <div class="flex between mt-16"><span class="tiny muted">Surplus to date</span><span class="bold" style="color:var(--green)">$9,700</span></div>
      <div class="bar mt-8"><span style="width:77%;background:var(--navy)"></span></div>
      <div class="tiny muted mt-8">77% of the year's budget, with the board's four KPIs alongside.</div>`,
  },

  /* Each step is one screen with a line about what it is for. Together they
     are the tour; separately they are a reference to come back to. */
  tour: [
    { id: "signin", title: "Signing in",
      say: "Your school email address and the password you were given. Not a shared staff password — what you do is recorded against your name, so it has to be yours.",
      shot: () => `
        <div class="shot-head"><span class="bold">Sign in</span><span class="tiny muted">ayandainfantschool.com</span></div>
        <div style="max-width:320px">
          <label class="field">School email address</label><div class="input faux">name@ayandainfantschool.com</div>
          <label class="field mt-16">Password</label><div class="input faux">••••••••••••</div>
          <div class="btn mt-16" style="width:100%;justify-content:center">Sign in</div>
        </div>
        <p class="tiny muted mt-16">Forgotten it? HR or the Head Teacher resets it to a temporary one. Nobody, including them, can see what your password is.</p>` },

    { id: "dashboard", title: "The dashboard",
      say: "What is waiting for you today. A class teacher sees their own registers; the office sees the school. Everything on it is a link to the thing itself.",
      shot: () => `
        <div class="shot-head"><span class="bold">Good morning</span><span class="tiny muted">Monday</span></div>
        <div class="grid cols-4" style="gap:10px">
          ${[["Pupils in your classes", "—", ""], ["Present today", "—", ""], ["My registers", "0/6", "gold"], ["Unread messages", "—", ""]].map(([l, v, tone]) => `
            <div class="card stat"><div class="label">${l}</div><div class="value" style="font-size:22px;${tone ? "color:var(--gold-600)" : ""}">${v}</div></div>`).join("")}
        </div>
        <p class="tiny muted mt-16">The register that is open right now is highlighted. Click it and you are on it.</p>` },

    { id: "attendance", title: "Taking a register",
      say: "A register for morning registration and for every lesson. It opens when the period starts and closes fifteen minutes later — take it at the start of the lesson, not at the end of the day.",
      shot: () => App.previews.attendance() },

    { id: "timetable", title: "Your week",
      say: "Which class you are with, which period, and which room. Click any period to open that register. The whole school's timetable is there too if you need to find a colleague.",
      shot: () => `
        <div class="shot-head"><span class="bold">My week</span><span class="flex" style="gap:4px"><span class="pill navy tiny">My week</span><span class="pill grey tiny">By class</span></span></div>
        <table class="tt mini"><thead><tr><th style="width:84px">Period</th>${DAY_LABELS ? DAYS.map(d => `<th>${DAY_LABELS[d].slice(0, 3)}</th>`).join("") : ""}</tr></thead>
          <tbody>${PERIODS.filter(p => !p.kind).slice(0, 3).map(p => `<tr>
            <td><span class="bold small">${p.label}</span><br><span class="tiny muted">${p.start}</span></td>
            ${DAYS.map((d, i) => `<td>${i % 2 ? `<span class="tt-sub blue">A lesson</span><span class="tt-who">a class</span>` : `<span class="tt-free">Free / PPA</span>`}</td>`).join("")}
          </tr>`).join("")}</tbody></table>
        <p class="tiny muted mt-16">A class meets the same pair every time it has a subject, so your groups do not change week to week.</p>` },

    { id: "record", title: "One record for each child",
      say: "Attendance, marks, fees, messages home and welfare notes on one page, newest first. This is the page to open before you telephone a parent.",
      shot: () => App.previews.record() },

    { id: "gradebook", title: "Marks and reports",
      say: "Record an assessment once and it does the rest: the weighted term mark, the class picture, and the report card at the end of term. You can only enter marks for subjects you teach.",
      shot: () => `
        <div class="shot-head"><span class="bold">Gradebook · a class</span><span class="pill blue">Class average —</span></div>
        <table class="mini"><thead><tr><th>Pupil</th><th class="right">Check 1</th><th class="right">Topic test</th><th class="right">Term</th></tr></thead>
        <tbody>${[1, 2, 3].map(n => `<tr><td class="small bold">Pupil ${n}</td><td class="right small muted">—</td><td class="right small muted">—</td><td class="right"><span class="pill grey tiny">—</span></td></tr>`).join("")}</tbody></table>
        <p class="tiny muted mt-16">Reports say exceeding, secure, developing or beginning. We do not publish positions in class.</p>` },

    { id: "fees", title: "Fees",
      say: "Every account in one list: billed, paid, what is overdue. The Bursar records payments; teachers do not see fee accounts at all.",
      shot: () => `
        <div class="shot-head"><span class="bold">Fee accounts</span><span class="pill gold tiny">Bursar and office only</span></div>
        <table class="mini"><thead><tr><th>Pupil</th><th class="right">Billed</th><th class="right">Paid</th><th>Status</th></tr></thead>
        <tbody>${[["On track", "blue"], ["In arrears", "red"], ["Settled", "green"]].map(([l, c], i) => `<tr><td class="small bold">Pupil ${i + 1}</td><td class="right small">—</td><td class="right small">—</td><td><span class="pill ${c}">${l}</span></td></tr>`).join("")}</tbody></table>
        <p class="tiny muted mt-16">One button sends a reminder to every guardian behind an instalment, written from their own account.</p>` },

    { id: "guardians", title: "Messaging home",
      say: "Email or SMS from inside the child's record, so what you send is logged against them and the next person to open it can see what was said.",
      shot: () => `
        <div class="shot-head"><span class="bold">Guardian communication</span><span class="tiny muted">logged against the pupil</span></div>
        <div class="comm auto"><div class="flex between wrap"><div class="flex" style="gap:8px"><span class="pill blue tiny">SMS</span><span class="bold small">Absence at registration</span><span class="pill gold tiny">Automatic</span></div><span class="tiny muted">08:52</span></div>
          <p class="small mt-8" style="margin:0">Good morning. [Child] has been marked absent at registration today. Please reply to confirm the reason. — Ayanda Infant School</p></div>
        <div class="comm"><div class="flex between wrap"><div class="flex" style="gap:8px"><span class="pill navy tiny">EMAIL</span><span class="bold small">Progress update</span></div><span class="tiny muted">yesterday</span></div>
          <p class="small mt-8" style="margin:0">Templates fill in the child's name, the guardian's name and the balance for you.</p></div>` },

    { id: "admissions", title: "Admissions",
      say: "An enquiry from the school's website arrives here. Move it along the line as documents come in; enrolling an accepted child creates their record, allocates the class and raises the first invoice in one step.",
      shot: () => App.previews.admissions() },

    { id: "care", title: "What is restricted, and what is recorded",
      say: "Medical details, welfare notes, fee accounts and board papers are withheld from anyone whose work does not need them — not hidden on the screen, never sent at all. Every change is logged with your name against it.",
      shot: () => `
        <div class="shot-head"><span class="bold">Your access</span><span class="pill gold tiny">set by HR and the Head</span></div>
        <table class="mini"><tbody>
          ${[["Registers for your classes", "green", "Yes"], ["Marks for subjects you teach", "green", "Yes"],
             ["Medical and welfare details", "amber", "Class teachers"], ["Fee accounts", "grey", "Bursar and office"],
             ["Board and statutory papers", "grey", "Director and Secretary"]].map(([l, c, v]) => `
            <tr><td class="small">${l}</td><td class="right"><span class="pill ${c}">${v}</span></td></tr>`).join("")}
        </tbody></table>
        <p class="tiny muted mt-16">If you need access you do not have, ask HR rather than borrowing a colleague's sign-in.</p>` },
  ],

  tourGo(i) {
    const at = Math.max(0, Math.min(this.tour.length - 1, i));
    this.ui.guide.step = at;
    if (at === this.tour.length - 1) this.tourPlay(false);
    this.render();
    document.querySelector(".tour-step.on")?.scrollIntoView({ block: "nearest" });
  },

  /* Plays itself through, slowly enough to read the caption. Choosing a step
     stops it, because somebody has decided where they want to be. */
  tourPlay(on) {
    clearInterval(this._tourTimer);
    this.ui.guide.playing = on;
    if (!on) { this.render(); return; }
    this._tourTimer = setInterval(() => {
      const next = (this.ui.guide.step || 0) + 1;
      if (next >= this.tour.length) { this.tourPlay(false); return; }
      this.ui.guide.step = next;
      this.render();
    }, 7000);
  },

  /* ------------------------------------------------------------------------
     The guide, as a page of the portal
     ------------------------------------------------------------------------ */
  vGuide() {
    const ui = this.ui.guide;
    const step = Math.min(ui.step || 0, this.tour.length - 1);
    const current = this.tour[step];
    return `
      <div class="tour in-portal">
        <ol class="tour-list" role="tablist" aria-label="Guide to the portal">
          ${this.tour.map((t, i) => `
            <li><button type="button" role="tab" class="tour-step ${i === step ? "on" : ""}" aria-selected="${i === step}"
                data-action="tour-go" data-i="${i}"><span class="n">${i + 1}</span><span>${esc(t.title)}</span></button></li>`).join("")}
        </ol>

        <div class="tour-stage">
          <div class="tour-bar"><span style="width:${((step + 1) / this.tour.length) * 100}%"></span></div>
          <div class="tour-head">
            <div><div class="eyebrow">Step ${step + 1} of ${this.tour.length}</div><h3>${esc(current.title)}</h3></div>
            <div class="flex" style="gap:6px">
              <button class="btn ghost sm" data-action="tour-prev" ${step === 0 ? "disabled" : ""} aria-label="Previous step">${icon("left")}</button>
              <button class="btn ${ui.playing ? "ghost" : ""} sm" data-action="tour-play">${ui.playing ? "Pause" : "Play through"}</button>
              <button class="btn ghost sm" data-action="tour-next" ${step === this.tour.length - 1 ? "disabled" : ""} aria-label="Next step">${icon("right")}</button>
            </div>
          </div>
          <p class="tour-say">${esc(current.say)}</p>
          <div class="shot swap">${current.shot()}</div>
        </div>
      </div>

      <div class="card mt-24"><div class="card-body small muted">
        <p><strong>This guide is not public.</strong> It describes every page of the portal and what each one holds, which is useful to you and useful to somebody trying to work out how the school's records are arranged. It is only fetched once you have signed in.</p>
        <p class="mt-8">Take the same care with it that you take with the records themselves: do not screenshot it into a group chat, and do not send the address to anybody who has not been given an account.</p>
      </div></div>`;
  },

  guideActions(d) {
    return {
      "tour-go": () => this.tourGo(Number(d.i)),
      "tour-next": () => this.tourGo((this.ui.guide.step || 0) + 1),
      "tour-prev": () => this.tourGo((this.ui.guide.step || 0) - 1),
      "tour-play": () => this.tourPlay(!this.ui.guide.playing),
    };
  },
});
