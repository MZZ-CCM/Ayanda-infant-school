/* ==========================================================================
   Student Information System
   --------------------------------------------------------------------------
   One pupil record from first enquiry to alumni. These views extend the App
   object defined in app.js: admissions, gradebook, fees & billing, guardian
   communication, leavers, configuration, integrations and the audit log.
   ========================================================================== */

Object.assign(App, {

  /* ======================================================================
     SHARED HELPERS
     ====================================================================== */
  admissionsNeedingAction() {
    if (!this.me() || !this.can("admissions.view")) return 0;
    return (Store.db.applicants || []).filter(a => ["enquiry", "application", "documents"].includes(a.stage)).length;
  },
  docsComplete(a) { return REQUIRED_DOCS.every(d => a.docs[d.key]); },
  docsCount(a) { return REQUIRED_DOCS.filter(d => a.docs[d.key]).length; },
  /* Every class a person may see marks / fees / messages for. */
  sisClasses() { return this.myClasses(); },
  sisPupils() { return this.sisClasses().flatMap(c => Store.pupilsIn(c.id)); },
  /* The pupil's weighted mark across all assessed subjects, or null. */
  overallPct(pupilId) {
    const p = Store.pupil(pupilId); if (!p) return null;
    const vals = Store.subjectsFor(p.classId).map(sj => Store.subjectPct(pupilId, sj)).filter(v => v !== null);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  },
  gradePill(pct) {
    if (pct === null || pct === undefined) return `<span class="pill grey">—</span>`;
    const g = Store.grade(pct);
    return `<span class="pill ${g.colour}" title="${esc(g.label)} — ${esc(g.desc)}">${g.code} · ${pct}%</span>`;
  },
  accountPill(acc) {
    if (!acc) return `<span class="pill grey">No invoice</span>`;
    const m = { settled: ["green", "Settled"], "on track": ["blue", "On track"], arrears: ["red", "In arrears"] };
    const [c, l] = m[acc.status]; return `<span class="pill ${c}">${l}</span>`;
  },

  /* ======================================================================
     ADMISSIONS — enquiry through to an enrolled pupil record
     ====================================================================== */
  vAdmissions() {
    const ui = this.ui.admissions;
    const intakes = Store.db.intakes;
    if (!ui.intakeId || !intakes.some(i => i.id === ui.intakeId)) ui.intakeId = intakes[0].id;
    const intake = Store.intake(ui.intakeId);
    const manage = this.can("admissions.manage");
    let list = Store.db.applicants.filter(a => a.intakeId === intake.id);
    const q = ui.q.trim().toLowerCase();
    if (q) list = list.filter(a => `${a.first} ${a.last} ${a.guardian.name} ${a.targetGrade}`.toLowerCase().includes(q));

    const live = list.filter(a => a.stage !== "declined");
    const offered = list.filter(a => ["offer", "accepted", "enrolled"].includes(a.stage)).length;
    const placesTotal = Object.values(intake.places).reduce((a, b) => a + b, 0);
    const filled = list.filter(a => ["accepted", "enrolled"].includes(a.stage)).length;
    const stalled = list.filter(a => ["enquiry", "application", "documents"].includes(a.stage));

    const card = (a) => {
      const dc = this.docsCount(a);
      return `<div class="cand" data-action="applicant-open" data-id="${a.id}">
        <div class="bold small">${esc(a.first)} ${esc(a.last)}${a.sibling ? ` <span class="pill gold tiny">Sibling</span>` : ""}</div>
        <div class="tiny muted">${esc(a.targetGrade)} · ${Fmt.age(a.dob)} · ${esc(a.source)}</div>
        <div class="tiny muted mt-8">${esc(a.guardian.name)}</div>
        <div class="flex" style="gap:6px;margin-top:6px"><span class="pill ${dc === REQUIRED_DOCS.length ? "green" : dc ? "amber" : "grey"} tiny">Docs ${dc}/${REQUIRED_DOCS.length}</span>${a.offerExpires && a.stage === "offer" ? `<span class="pill ${a.offerExpires < Store.today() ? "red" : "blue"} tiny">${a.offerExpires < Store.today() ? "Offer expired" : "Replies by " + Fmt.date(a.offerExpires, "short")}</span>` : ""}</div>
      </div>`;
    };

    return `
    <div class="toolbar">
      <select class="input" data-change="adm-intake">${intakes.map(i => `<option value="${i.id}" ${i.id === intake.id ? "selected" : ""}>${esc(i.name)} intake</option>`).join("")}</select>
      <div class="search">${icon("search")}<input class="input" placeholder="Search applicants and guardians" value="${esc(ui.q)}" data-input="adm-q"></div>
      <div class="grow"></div>
      <span class="muted small">${live.length} live · ${list.length} total</span>
      ${manage ? `<button class="btn sm" data-action="applicant-new">${icon("plus")} Add applicant</button>` : ""}
    </div>
    <div class="grid cols-4 mb-16">
      <div class="card stat accent"><div class="label">Places this intake</div><div class="value">${filled} / ${placesTotal}</div><div class="sub">${Object.entries(intake.places).map(([g, n]) => `${g} ${n}`).join(" · ")}</div></div>
      <div class="card stat"><div class="label">Offers out</div><div class="value">${offered}</div><div class="sub">Applications close ${Fmt.date(intake.closes)}</div></div>
      <div class="card stat"><div class="label">Waiting on us</div><div class="value ${stalled.length ? "t-warn" : "t-good"}">${stalled.length}</div><div class="sub">Enquiries, forms and documents outstanding</div></div>
      <div class="card stat"><div class="label">Term starts</div><div class="value fig-sm">${Fmt.date(intake.starts, "short")}</div><div class="sub">${esc(intake.name)} intake</div></div>
    </div>
    <div class="card mb-16">
      <div class="card-head"><div><h3>Admissions pipeline</h3><div class="tiny muted">One record follows the child from first enquiry to an enrolled place — nothing is re-keyed.</div></div></div>
      <div class="card-body"><div class="board">${ADMISSION_STAGES.filter(st => st.id !== "declined").map(st => {
        const inStage = list.filter(a => a.stage === st.id);
        return `<div class="col">
          <div class="col-head"><span class="bold small">${st.label}</span><span class="pill grey tiny">${inStage.length}</span></div>
          <div class="tiny muted mb-8">${esc(st.desc)}</div>
          ${inStage.map(card).join("") || `<div class="tiny muted center" style="padding:12px 0">—</div>`}
        </div>`;
      }).join("")}</div></div>
    </div>
    <div class="grid side">
      <div class="card">
        <div class="card-head"><h3>All applicants</h3><span class="tiny muted">${esc(intake.name)}</span></div>
        <div class="card-body tight table-wrap"><table>
          <thead><tr><th>Child</th><th>For</th><th>Guardian</th><th>Stage</th><th>Documents</th><th>Applied</th></tr></thead>
          <tbody>${list.sort((a, b) => a.stage.localeCompare(b.stage) || a.last.localeCompare(b.last)).map(a => { const st = ADMISSION_STAGES.find(x => x.id === a.stage); const dc = this.docsCount(a); return `<tr class="clickable" data-action="applicant-open" data-id="${a.id}">
            <td><span class="bold">${esc(a.last)}, ${esc(a.first)}</span><br><span class="tiny muted">${Fmt.age(a.dob)} · ${a.gender === "F" ? "Girl" : "Boy"}</span></td>
            <td>${esc(a.targetGrade)}</td>
            <td>${esc(a.guardian.name)}<br><span class="tiny muted">${esc(a.guardian.phone)}</span></td>
            <td><span class="pill ${a.stage === "enrolled" ? "green" : a.stage === "declined" ? "red" : a.stage === "offer" || a.stage === "accepted" ? "gold" : "grey"}">${esc(st.label)}</span></td>
            <td><span class="pill ${dc === REQUIRED_DOCS.length ? "green" : dc ? "amber" : "grey"}">${dc}/${REQUIRED_DOCS.length}</span></td>
            <td class="tiny muted">${Fmt.date(a.appliedOn, "short")}</td>
          </tr>`; }).join("") || `<tr><td colspan="6" class="empty">No applicants for this intake yet.</td></tr>`}</tbody>
        </table></div>
      </div>
      <div class="stack" style="gap:18px">
        <div class="card"><div class="card-head"><h3>Places remaining</h3></div><div class="card-body tight table-wrap"><table><tbody>
          ${Object.entries(intake.places).map(([g, n]) => { const taken = list.filter(a => a.targetGrade === g && ["accepted", "enrolled"].includes(a.stage)).length; const pct = Fmt.pct(taken, n); return `<tr><td class="small bold">${esc(g)}</td><td style="width:50%"><div class="bar"><span style="width:${Math.min(100, pct)}%;background:${pct >= 100 ? "var(--red)" : "var(--navy)"}"></span></div></td><td class="right tiny bold">${taken}/${n}</td></tr>`; }).join("")}
        </tbody></table></div><div class="card-foot tiny muted">Counted from accepted and enrolled applicants only.</div></div>
        <div class="card"><div class="card-head"><h3>Where they heard about us</h3></div><div class="card-body flex wrap" style="gap:6px">
          ${Object.entries(list.reduce((m, a) => { m[a.source] = (m[a.source] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<span class="pill">${esc(k)} <span class="tiny" style="opacity:.7">×${n}</span></span>`).join("") || `<span class="empty small">No data yet.</span>`}
        </div></div>
        <div class="card"><div class="card-head"><h3>Required documents</h3></div><div class="card-body tight table-wrap"><table><tbody>
          ${REQUIRED_DOCS.map(d => { const have = live.filter(a => a.docs[d.key]).length; return `<tr><td class="small">${esc(d.label)}</td><td class="right"><span class="pill ${have === live.length ? "green" : "amber"}">${have}/${live.length}</span></td></tr>`; }).join("")}
        </tbody></table></div></div>
      </div>
    </div>`;
  },

  applicantModal(id) {
    const a = Store.applicant(id); if (!a) return;
    const manage = this.can("admissions.manage"); const canOffer = this.can("admissions.offer");
    const st = ADMISSION_STAGES.find(x => x.id === a.stage);
    const idx = ADMISSION_STAGES.findIndex(x => x.id === a.stage);
    const next = ADMISSION_STAGES[idx + 1];
    const body = `
      <div class="flex mb-16"><span class="avatar lg">${a.first[0]}${a.last[0]}</span>
        <div><h2>${esc(a.first)} ${esc(a.last)}</h2><div class="muted">${esc(a.targetGrade)} · ${Fmt.age(a.dob)} · ${a.gender === "F" ? "Girl" : "Boy"} · ${esc(Store.intake(a.intakeId).name)} intake</div></div>
        <div class="grow"></div><span class="pill ${a.stage === "enrolled" ? "green" : a.stage === "declined" ? "red" : "gold"}" style="font-size:14px">${esc(st.label)}</span></div>
      <div class="steps mb-16">${ADMISSION_STAGES.filter(x => x.id !== "declined").map((x, i) => `<span class="step ${x.id === a.stage ? "on" : i < idx ? "done" : ""}">${esc(x.label)}</span>`).join("")}</div>
      <div class="grid cols-2">
        <div><div class="eyebrow mb-8">Guardian</div><dl class="kv">
          <dt>Name</dt><dd>${esc(a.guardian.name)} (${esc(a.guardian.relationship)})</dd>
          <dt>Phone</dt><dd>${esc(a.guardian.phone)}</dd>
          <dt>Email</dt><dd>${esc(a.guardian.email || "—")}</dd>
          <dt>Heard via</dt><dd>${esc(a.source)}</dd>
          <dt>Applied</dt><dd>${Fmt.date(a.appliedOn)}</dd>
          ${a.offerSentOn ? `<dt>Offer sent</dt><dd>${Fmt.date(a.offerSentOn)} · replies by ${Fmt.date(a.offerExpires)}</dd>` : ""}
        </dl></div>
        <div><div class="eyebrow mb-8">Documents</div>
          <form data-form="applicant-docs" data-id="${a.id}"><div class="stack" style="gap:6px">
          ${REQUIRED_DOCS.map(d => `<label class="check"><input type="checkbox" name="${d.key}" ${a.docs[d.key] ? "checked" : ""} ${manage ? "" : "disabled"}> ${esc(d.label)}</label>`).join("")}
          </div>${manage ? `<button class="btn ghost sm mt-8" type="submit">Save checklist</button>` : ""}</form>
        </div>
      </div>
      ${a.baseline ? `<div class="eyebrow mt-24 mb-8">Visit & baseline</div><p class="small">${esc(a.baseline)}</p>` : ""}
      ${a.notes ? `<div class="eyebrow mt-24 mb-8">Notes</div><p class="small">${esc(a.notes)}</p>` : ""}
      ${a.stage === "accepted" && canOffer ? `<div class="notice gold mt-16">${icon("check")} Place accepted. Enrolling creates the pupil record, allocates a class and raises the first invoice — no re-keying.</div>` : ""}
      ${!this.docsComplete(a) && ["offer", "accepted"].includes(a.stage) ? `<div class="notice warn mt-16">${icon("alert")} ${REQUIRED_DOCS.length - this.docsCount(a)} document(s) still outstanding.</div>` : ""}`;
    const foot = `
      ${manage && a.stage !== "declined" && a.stage !== "enrolled" ? `<button class="btn ghost danger" data-action="applicant-stage" data-id="${a.id}" data-stage="declined">Not proceeding</button>` : ""}
      <div class="grow"></div>
      ${manage ? `<button class="btn ghost" data-action="applicant-edit" data-id="${a.id}">${icon("edit")} Edit</button>` : ""}
      ${this.can("comms.send") && a.guardian.email ? `<button class="btn ghost" data-action="comms-new" data-applicant="${a.id}">${icon("send")} Message guardian</button>` : ""}
      ${a.stage === "accepted" && canOffer ? `<button class="btn" data-action="applicant-enrol" data-id="${a.id}">${icon("check")} Enrol as pupil</button>`
        : next && next.id !== "declined" && manage && (next.id !== "offer" || canOffer) ? `<button class="btn" data-action="applicant-stage" data-id="${a.id}" data-stage="${next.id}">Move to ${esc(next.label)}</button>` : ""}`;
    this.modal({ title: "Applicant", body, foot, wide: true });
  },

  applicantForm(id) {
    const a = id ? Store.applicant(id) : { first: "", last: "", gender: "F", dob: "", targetGrade: "ECD A", intakeId: this.ui.admissions.intakeId, source: "Website", guardian: { name: "", relationship: "Mother", phone: "", email: "" }, notes: "", baseline: "", sibling: false };
    const body = `<form data-form="applicant-save" data-id="${id || ""}">
      <div class="grid cols-2">
        <div><label class="field">First name</label><input class="input" name="first" value="${esc(a.first)}" required></div>
        <div><label class="field">Surname</label><input class="input" name="last" value="${esc(a.last)}" required></div>
        <div><label class="field">Date of birth</label><input class="input" type="date" name="dob" value="${a.dob}" required></div>
        <div><label class="field">Sex</label><select class="input" name="gender"><option value="F" ${a.gender === "F" ? "selected" : ""}>Girl</option><option value="M" ${a.gender === "M" ? "selected" : ""}>Boy</option></select></div>
        <div><label class="field">Applying for</label><select class="input" name="targetGrade">${["ECD A", "ECD B", "Grade 1", "Grade 2"].map(g => `<option ${g === a.targetGrade ? "selected" : ""}>${g}</option>`).join("")}</select></div>
        <div><label class="field">Intake</label><select class="input" name="intakeId">${Store.db.intakes.map(i => `<option value="${i.id}" ${i.id === a.intakeId ? "selected" : ""}>${esc(i.name)}</option>`).join("")}</select></div>
      </div>
      <div class="eyebrow mt-24 mb-8">Guardian</div>
      <div class="grid cols-2">
        <div><label class="field">Name</label><input class="input" name="gname" value="${esc(a.guardian.name)}" required></div>
        <div><label class="field">Relationship</label><select class="input" name="grel">${["Mother", "Father", "Grandmother", "Grandfather", "Aunt", "Uncle", "Guardian"].map(r => `<option ${r === a.guardian.relationship ? "selected" : ""}>${r}</option>`).join("")}</select></div>
        <div><label class="field">Phone</label><input class="input" name="gphone" value="${esc(a.guardian.phone)}" required></div>
        <div><label class="field">Email</label><input class="input" type="email" name="gemail" value="${esc(a.guardian.email)}"></div>
      </div>
      <div class="grid cols-2 mt-16">
        <div><label class="field">How they heard about us</label><select class="input" name="source">${["Website", "Walk-in", "Word of mouth", "Sibling at the school", "Facebook", "Referral"].map(x => `<option ${x === a.source ? "selected" : ""}>${x}</option>`).join("")}</select></div>
        <div><label class="field">Sibling already at Ayanda</label><select class="input" name="sibling"><option value="no" ${!a.sibling ? "selected" : ""}>No</option><option value="yes" ${a.sibling ? "selected" : ""}>Yes — 10% discount</option></select></div>
      </div>
      <label class="field mt-16">Visit & baseline notes</label><textarea class="input" name="baseline" rows="2">${esc(a.baseline)}</textarea>
      <label class="field mt-16">Notes</label><textarea class="input" name="notes" rows="2">${esc(a.notes)}</textarea>
      <div class="modal-foot" style="padding:16px 0 0;border:0"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button class="btn" type="submit">${id ? "Save applicant" : "Add applicant"}</button></div></form>`;
    this.modal({ title: id ? "Edit applicant" : "New applicant", body, wide: true });
  },

  applicantStage(id, stage) {
    const a = Store.applicant(id); if (!a) return;
    if (stage === "offer") {
      if (!this.docsComplete(a) && !confirm(`${a.first} still has ${REQUIRED_DOCS.length - this.docsCount(a)} document(s) outstanding. Send the offer anyway?`)) return;
      a.offerSentOn = Store.today();
      const ex = new Date(); ex.setDate(ex.getDate() + 14); a.offerExpires = iso(ex);
    }
    a.stage = stage;
    Store.audit(`Admissions: ${a.first} ${a.last} moved to ${ADMISSION_STAGES.find(x => x.id === stage).label}`);
    Store.save(); this.closeModal(); this.toast(`${a.first} moved to ${ADMISSION_STAGES.find(x => x.id === stage).label}.`); this.render();
  },

  /* Turn an accepted applicant into a full pupil record: class, admission
     number, consents, timeline and the term's invoice. */
  applicantEnrol(id) {
    const a = Store.applicant(id); if (!a) return;
    const cls = Store.db.classes.find(c => c.grade === a.targetGrade);
    if (!cls) { this.toast(`No class exists for ${a.targetGrade}.`, "err"); return; }
    if (!confirm(`Enrol ${a.first} ${a.last} into ${cls.name}? This creates the pupil record and raises the Term invoice.`)) return;
    const nums = Store.db.pupils.map(p => Number(String(p.admissionNo).split("/")[1]) || 0);
    const no = Math.max(1040, ...nums) + 1;
    const pupil = {
      id: `p${no}`, admissionNo: `AIS/${no}`, first: a.first, last: a.last, gender: a.gender, dob: a.dob,
      classId: cls.id, address: "", stage: "enrolled", source: a.source,
      guardian: { ...a.guardian }, emergency: { name: "", phone: "" },
      medical: { allergies: "", conditions: "", doctor: "" },
      consents: { photo: !!a.docs.consent, trips: !!a.docs.consent, data: true },
      enrolled: Store.intake(a.intakeId).starts, status: "active", notes: a.notes,
      timeline: [
        { date: a.appliedOn, kind: "admission", text: `Applied for ${a.targetGrade} (${a.source})` },
        ...(a.offerSentOn ? [{ date: a.offerSentOn, kind: "admission", text: "Offer of a place sent" }] : []),
        { date: Store.today(), kind: "admission", text: `Enrolled into ${cls.name} by ${Store.staffName(this.me().id, { short: true })}` },
      ],
    };
    Store.db.pupils.push(pupil);
    this.raiseInvoice(pupil.id, a.sibling);
    a.stage = "enrolled"; a.pupilId = pupil.id;
    Store.audit(`Admissions: ${a.first} ${a.last} enrolled into ${cls.name} as ${pupil.admissionNo}`);
    Store.save(); this.closeModal(); this.toast(`${a.first} enrolled as ${pupil.admissionNo}.`); this.render();
  },

  /* ======================================================================
     GRADEBOOK & ASSESSMENT
     ====================================================================== */
  vGradebook() {
    const ui = this.ui.gradebook; const classes = this.sisClasses();
    if (!classes.length) return `<div class="card"><div class="empty">No class is in your scope.</div></div>`;
    if (!ui.classId || !classes.some(c => c.id === ui.classId)) ui.classId = classes[0].id;
    const cls = Store.cls(ui.classId);
    const subjects = Store.subjectsFor(cls.id);
    if (!ui.subject || !subjects.includes(ui.subject)) ui.subject = subjects[0];
    const pupils = Store.pupilsIn(cls.id);
    const canMark = this.can("gradebook.mark") && Store.classesTaughtBy(this.me().id).some(c => c.id === cls.id);
    const assessments = Store.assessmentsFor(cls.id, ui.subject);
    const all = Store.assessmentsFor(cls.id);
    const open = ui.assessmentId ? Store.assessment(ui.assessmentId) : null;
    const classAvg = (sj) => { const v = pupils.map(p => Store.subjectPct(p.id, sj)).filter(x => x !== null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };

    return `
    <div class="toolbar">
      <select class="input" data-change="gb-class">${classes.map(c => `<option value="${c.id}" ${c.id === cls.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
      <select class="input" data-change="gb-subject">${subjects.map(sj => `<option ${sj === ui.subject ? "selected" : ""}>${esc(sj)}</option>`).join("")}</select>
      <div class="grow"></div>
      <span class="muted small">${all.length} assessment${all.length === 1 ? "" : "s"} this term</span>
      ${this.can("gradebook.publish") ? `<button class="btn ghost sm" data-action="gb-reports">${icon("print")} Report cards</button>` : ""}
      ${canMark ? `<button class="btn sm" data-action="gb-new">${icon("plus")} New assessment</button>` : ""}
    </div>
    ${!canMark && this.can("gradebook.mark") ? `<div class="notice info mb-16">${icon("lock")} You can enter marks only for classes you teach. This one is read-only for you.</div>` : ""}
    <div class="grid side">
      <div class="stack" style="gap:18px">
        <div class="card">
          <div class="card-head"><div><h3>${esc(ui.subject)} — ${esc(cls.name)}</h3><div class="tiny muted">Weighted mark: ${ASSESSMENT_KINDS.map(k => `${k.label} ${Math.round(k.weight * 100)}%`).join(" · ")}</div></div>
          <span class="pill ${classAvg(ui.subject) === null ? "grey" : Store.grade(classAvg(ui.subject)).colour}">Class average ${classAvg(ui.subject) === null ? "—" : classAvg(ui.subject) + "%"}</span></div>
          <div class="card-body tight table-wrap"><table>
            <thead><tr><th>#</th><th>Pupil</th>${assessments.map(a => `<th class="right" title="${esc(a.title)} · ${Fmt.date(a.date)}"><span class="tiny">${esc(ASSESSMENT_KINDS.find(k => k.id === a.kind).label)}</span><br>${Fmt.date(a.date, "short")}<br><span class="tiny muted">/${a.max}</span></th>`).join("")}<th class="right">Term</th></tr></thead>
            <tbody>${pupils.map((p, i) => { const pct = Store.subjectPct(p.id, ui.subject); return `<tr>
              <td class="muted">${i + 1}</td>
              <td><span class="bold">${esc(p.last)}, ${esc(p.first)}</span></td>
              ${assessments.map(a => { const m = a.marks[p.id]; return `<td class="right">${m === undefined ? `<span class="faint">—</span>` : `${m}<span class="tiny muted">/${a.max}</span>`}</td>`; }).join("")}
              <td class="right">${this.gradePill(pct)}</td>
            </tr>`; }).join("")}</tbody>
          </table></div>
          <div class="card-foot tiny muted">${assessments.length ? `${assessments.length} assessment${assessments.length === 1 ? "" : "s"} recorded in ${esc(ui.subject)}. Click an assessment on the right to enter or amend marks.` : "No assessment has been recorded in this subject yet."}</div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Subject profile — ${esc(cls.name)}</h3><span class="tiny muted">term to date</span></div>
          <div class="card-body tight table-wrap"><table>
            <thead><tr><th>Pupil</th>${subjects.map(sj => `<th class="right tiny">${esc(sj.length > 14 ? sj.slice(0, 12) + "…" : sj)}</th>`).join("")}<th class="right">Overall</th></tr></thead>
            <tbody>${pupils.map(p => `<tr class="clickable" data-action="open-pupil" data-id="${p.id}"><td class="bold small">${esc(p.last)}, ${esc(p.first[0])}.</td>
              ${subjects.map(sj => { const v = Store.subjectPct(p.id, sj); return `<td class="right">${v === null ? `<span class="faint">—</span>` : `<span class="pill ${Store.grade(v).colour} tiny">${Store.grade(v).code}</span>`}</td>`; }).join("")}
              <td class="right">${this.gradePill(this.overallPct(p.id))}</td></tr>`).join("")}</tbody>
          </table></div>
        </div>
      </div>
      <div class="stack" style="gap:18px">
        <div class="card"><div class="card-head"><h3>Assessments</h3><span class="tiny muted">${esc(cls.name)}</span></div>
          <div class="card-body tight table-wrap"><table><tbody>${all.map(a => `<tr class="clickable ${open && open.id === a.id ? "sel-row" : ""}" data-action="gb-open" data-id="${a.id}">
            <td><span class="bold small">${esc(a.subject)}</span><br><span class="tiny muted">${esc(ASSESSMENT_KINDS.find(k => k.id === a.kind).label)} · ${Fmt.date(a.date, "short")}</span></td>
            <td class="right"><span class="pill ${Object.keys(a.marks).length >= Store.pupilsIn(a.classId).length ? "green" : "amber"} tiny">${Object.keys(a.marks).length}/${Store.pupilsIn(a.classId).length}</span></td>
          </tr>`).join("") || `<tr><td class="empty small">No assessments yet.</td></tr>`}</tbody></table></div>
        </div>
        <div class="card"><div class="card-head"><h3>Grading scale</h3>${this.can("gradebook.scale") ? `<a class="small" href="#/config">Edit</a>` : ""}</div>
          <div class="card-body tight table-wrap"><table><tbody>${Store.db.gradeScale.map(g => `<tr><td><span class="pill ${g.colour}">${g.code}</span></td><td class="small bold">${esc(g.label)}</td><td class="tiny muted">${g.min}%+</td></tr>`).join("")}</tbody></table></div>
          <div class="card-foot tiny muted">Reported to guardians as a word, not a rank. Numbers stay inside the school.</div>
        </div>
        <div class="card"><div class="card-head"><h3>Needs support</h3><span class="tiny muted">below ${Store.db.gradeScale[2].min}% overall</span></div>
          <div class="card-body tight table-wrap"><table><tbody>${pupils.map(p => ({ p, v: this.overallPct(p.id) })).filter(x => x.v !== null && x.v < Store.db.gradeScale[2].min).sort((a, b) => a.v - b.v).map(({ p, v }) => `<tr class="clickable" data-action="open-pupil" data-id="${p.id}"><td class="small">${esc(p.first)} ${esc(p.last)}</td><td class="right">${this.gradePill(v)}</td></tr>`).join("") || `<tr><td class="empty small">Everyone is at or above the expected standard.</td></tr>`}</tbody></table></div>
        </div>
      </div>
    </div>`;
  },

  assessmentModal(id) {
    const a = Store.assessment(id); if (!a) return;
    const cls = Store.cls(a.classId); const pupils = Store.pupilsIn(cls.id);
    const canMark = this.can("gradebook.mark") && Store.classesTaughtBy(this.me().id).some(c => c.id === cls.id);
    const kind = ASSESSMENT_KINDS.find(k => k.id === a.kind);
    const body = `<form data-form="gb-marks" data-id="${a.id}">
      <p class="small muted">${esc(cls.name)} · ${esc(a.subject)} · ${esc(kind.label)} (${Math.round(kind.weight * 100)}% of the term mark) · ${Fmt.date(a.date)} · out of ${a.max}</p>
      <div class="table-wrap mt-16"><table>
        <thead><tr><th>#</th><th>Pupil</th><th class="right" style="width:130px">Mark / ${a.max}</th><th class="right" style="width:110px">Grade</th></tr></thead>
        <tbody>${pupils.map((p, i) => { const m = a.marks[p.id]; const pct = m === undefined ? null : Math.round((m / a.max) * 100); return `<tr>
          <td class="muted">${i + 1}</td><td class="bold">${esc(p.last)}, ${esc(p.first)}</td>
          <td class="right"><input class="input right" type="number" min="0" max="${a.max}" step="1" name="m_${p.id}" value="${m === undefined ? "" : m}" ${canMark ? "" : "disabled"} style="width:90px;padding:5px 8px"></td>
          <td class="right">${this.gradePill(pct)}</td></tr>`; }).join("")}</tbody>
      </table></div>
      ${canMark ? `<div class="modal-foot" style="padding:16px 0 0;border:0"><button type="button" class="btn ghost danger" data-action="gb-delete" data-id="${a.id}">Delete</button><div class="grow"></div><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button class="btn" type="submit">${icon("check")} Save marks</button></div>`
        : `<div class="notice info mt-16">${icon("lock")} Read-only — marks are entered by the pair who teach this subject.</div>`}</form>`;
    this.modal({ title: esc(a.title), body, wide: true });
  },

  assessmentForm() {
    const ui = this.ui.gradebook; const cls = Store.cls(ui.classId);
    const body = `<form data-form="gb-save">
      <p class="small muted">${esc(cls.name)}</p>
      <div class="grid cols-2">
        <div><label class="field">Subject</label><select class="input" name="subject">${Store.subjectsFor(cls.id).map(sj => `<option ${sj === ui.subject ? "selected" : ""}>${esc(sj)}</option>`).join("")}</select></div>
        <div><label class="field">Type</label><select class="input" name="kind">${ASSESSMENT_KINDS.map(k => `<option value="${k.id}">${esc(k.label)} — ${Math.round(k.weight * 100)}%</option>`).join("")}</select></div>
        <div><label class="field">Date</label><input class="input" type="date" name="date" value="${Store.today()}" max="${Store.today()}"></div>
        <div><label class="field">Out of</label><input class="input" type="number" name="max" value="${cls.grade.startsWith("ECD") ? 20 : 30}" min="1" max="100"></div>
      </div>
      <label class="field mt-16">Title</label><input class="input" name="title" placeholder="e.g. Number bonds to 10 — topic test" required>
      <div class="help">Marks can be entered straight away or added later from the assessment list.</div>
      <div class="modal-foot" style="padding:16px 0 0;border:0"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button class="btn" type="submit">Create assessment</button></div></form>`;
    this.modal({ title: "New assessment", body });
  },

  /* End-of-term report card, straight from the marks and the register. */
  reportCard(pupilId) {
    const p = Store.pupil(pupilId); if (!p) return;
    const cls = Store.cls(p.classId); const subjects = Store.subjectsFor(cls.id);
    const att = this.termStats([p.id]); const overall = this.overallPct(p.id);
    const body = `
      <div class="report">
        <div class="report-head"><img src="assets/logo.png" alt=""><div><h2>${esc(Store.db.school.name)}</h2><div class="muted small">${esc(Store.db.school.tagline)} · ${esc(Store.db.school.address)}</div></div></div>
        <h3 class="mt-16">Progress report — ${esc(Store.db.school.term.name)}</h3>
        <dl class="kv cols2 mt-8"><dt>Pupil</dt><dd>${esc(p.first)} ${esc(p.last)}</dd><dt>Class</dt><dd>${esc(cls.name)}</dd><dt>Admission no.</dt><dd>${esc(p.admissionNo)}</dd><dt>Attendance</dt><dd>${att.pct}% (${att.present} of ${att.total} sessions)</dd></dl>
        <div class="table-wrap mt-16"><table>
          <thead><tr><th>Subject</th><th class="right">Mark</th><th class="right">Standard</th><th>Comment</th></tr></thead>
          <tbody>${subjects.map(sj => { const v = Store.subjectPct(p.id, sj); const g = v === null ? null : Store.grade(v);
            return `<tr><td class="bold">${esc(sj)}</td><td class="right">${v === null ? "—" : v + "%"}</td><td class="right">${g ? `<span class="pill ${g.colour}">${esc(g.label)}</span>` : `<span class="pill grey">Not assessed</span>`}</td><td class="tiny muted">${g ? esc(g.desc) : "No assessment recorded this term."}</td></tr>`; }).join("")}</tbody>
        </table></div>
        <div class="grid cols-2 mt-16">
          <div><div class="eyebrow mb-8">Overall</div><div class="flex">${this.gradePill(overall)}<span class="small muted">across ${subjects.length} subjects</span></div></div>
          <div><div class="eyebrow mb-8">Class teacher</div><div class="small">${Store.staffName(cls.teacherId)}<br><span class="tiny muted">with ${Store.staffName(cls.assistantId, { short: true })}</span></div></div>
        </div>
        <p class="tiny muted mt-24">Grades describe the standard reached, not a position in the class. Marks are held by the school and are available to guardians on request.</p>
      </div>`;
    const foot = `<div class="grow"></div><button class="btn ghost" onclick="window.print()">${icon("print")} Print</button>${this.can("comms.send") && p.guardian.email ? `<button class="btn" data-action="comms-new" data-pupil="${p.id}" data-template="ct4">${icon("send")} Email guardian</button>` : ""}`;
    this.modal({ title: "Report card", body, foot, wide: true });
  },

  reportCardPicker() {
    const cls = Store.cls(this.ui.gradebook.classId); const pupils = Store.pupilsIn(cls.id);
    const body = `<p class="small muted">${esc(cls.name)} · ${esc(Store.db.school.term.name)}. Every report is built from the marks already in the gradebook and the register — nothing is typed twice.</p>
      <div class="table-wrap mt-16"><table><thead><tr><th>Pupil</th><th class="right">Overall</th><th class="right">Attendance</th><th></th></tr></thead>
      <tbody>${pupils.map(p => { const v = this.overallPct(p.id); const a = this.termStats([p.id]); return `<tr><td class="bold">${esc(p.last)}, ${esc(p.first)}</td><td class="right">${this.gradePill(v)}</td><td class="right"><span class="pill ${a.pct >= 90 ? "green" : "amber"}">${a.pct}%</span></td><td class="right"><button class="btn xs ghost" data-action="gb-report" data-id="${p.id}">Open</button></td></tr>`; }).join("")}</tbody></table></div>`;
    this.modal({ title: "Report cards", body, wide: true });
  },

  /* ======================================================================
     FEES & BILLING
     ====================================================================== */
  vBilling() {
    const ui = this.ui.billing; const classes = this.sisClasses();
    let pupils = classes.flatMap(c => Store.pupilsIn(c.id));
    if (ui.classId !== "all") pupils = pupils.filter(p => p.classId === ui.classId);
    const q = ui.q.trim().toLowerCase();
    if (q) pupils = pupils.filter(p => `${p.first} ${p.last} ${p.admissionNo} ${p.guardian.name}`.toLowerCase().includes(q));
    const rows = pupils.map(p => ({ p, a: Store.account(p.id) })).filter(x => x.a);
    const shown = ui.filter === "all" ? rows : rows.filter(x => x.a.status === ui.filter);
    const billed = rows.reduce((n, x) => n + x.a.total, 0);
    const collected = rows.reduce((n, x) => n + x.a.paid, 0);
    const dueToDate = rows.reduce((n, x) => n + x.a.inv.instalments.filter(i => i.due <= Store.today()).reduce((m, i) => m + i.amount, 0), 0);
    const arrears = rows.reduce((n, x) => n + x.a.overdue, 0);
    const inArrears = rows.filter(x => x.a.status === "arrears");
    const manage = this.can("billing.manage");
    const recent = (Store.db.payments || []).slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

    return `
    <div class="toolbar">
      <select class="input" data-change="bill-class"><option value="all">All classes</option>${classes.map(c => `<option value="${c.id}" ${ui.classId === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
      <select class="input" data-change="bill-filter">${[["all", "Every account"], ["arrears", "In arrears"], ["on track", "On track"], ["settled", "Settled"]].map(([v, l]) => `<option value="${v}" ${ui.filter === v ? "selected" : ""}>${l}</option>`).join("")}</select>
      <div class="search">${icon("search")}<input class="input" placeholder="Search pupil or guardian" value="${esc(ui.q)}" data-input="bill-q"></div>
      <div class="grow"></div>
      ${this.can("attendance.export") ? `<button class="btn ghost sm" data-action="bill-export">${icon("download")} CSV</button>` : ""}
      ${manage ? `<button class="btn sm" data-action="pay-new">${icon("plus")} Record payment</button>` : ""}
    </div>
    <div class="grid cols-4 mb-16">
      <div class="card stat accent"><div class="label">Billed this term</div><div class="value">${Store.money(billed)}</div><div class="sub">${rows.length} account${rows.length === 1 ? "" : "s"} · ${esc(Store.db.school.term.name)}</div></div>
      <div class="card stat"><div class="label">Collected</div><div class="value t-good">${Store.money(collected)}</div><div class="sub">${Fmt.pct(collected, dueToDate)}% of the ${Store.money(dueToDate)} due so far</div></div>
      <div class="card stat"><div class="label">Overdue now</div><div class="value ${arrears ? "t-bad" : "t-good"}">${Store.money(arrears)}</div><div class="sub">${inArrears.length} account${inArrears.length === 1 ? "" : "s"} behind an instalment</div></div>
      <div class="card stat"><div class="label">Instalments</div><div class="value">${Store.db.feeRules.instalments}</div><div class="sub">${Store.db.invoices[0] ? Store.db.invoices[0].instalments.map(i => Fmt.date(i.due, "short")).join(" · ") : "—"}</div></div>
    </div>
    <div class="grid side">
      <div class="card">
        <div class="card-head"><div><h3>Fee accounts</h3><div class="tiny muted">One account per pupil, on the same record as their attendance and marks.</div></div><span class="muted small">${shown.length} shown</span></div>
        <div class="card-body tight table-wrap"><table>
          <thead><tr><th>Pupil</th><th>Class</th><th class="right">Billed</th><th class="right">Paid</th><th class="right">Balance</th><th>Status</th><th></th></tr></thead>
          <tbody>${shown.sort((a, b) => b.a.overdue - a.a.overdue || a.p.last.localeCompare(b.p.last)).map(({ p, a }) => `<tr class="clickable" data-action="bill-open" data-id="${p.id}">
            <td><span class="bold">${esc(p.last)}, ${esc(p.first)}</span><br><span class="tiny muted">${esc(p.guardian.name)}</span></td>
            <td class="small">${esc(Store.cls(p.classId).name)}</td>
            <td class="right">${Store.money(a.total)}</td>
            <td class="right">${Store.money(a.paid)}</td>
            <td class="right ${a.balance > 0 ? "bold" : "muted"}">${Store.money(a.balance)}</td>
            <td>${this.accountPill(a)}${a.overdue > 0 ? ` <span class="tiny t-bad">${Store.money(a.overdue)} overdue</span>` : ""}</td>
            <td class="right">${icon("right", "ico")}</td>
          </tr>`).join("") || `<tr><td colspan="7" class="empty">No accounts match.</td></tr>`}</tbody>
        </table></div>
        ${inArrears.length && this.can("billing.chase") ? `<div class="card-foot flex between"><span class="small muted">${inArrears.length} guardian${inArrears.length === 1 ? "" : "s"} could be reminded about an overdue instalment.</span><button class="btn sm" data-action="bill-chase">${icon("send")} Send fee reminders</button></div>` : ""}
      </div>
      <div class="stack" style="gap:18px">
        <div class="card"><div class="card-head"><h3>Collection by class</h3><span class="tiny muted">against what is due so far</span></div><div class="card-body tight table-wrap"><table><tbody>
          ${classes.map(c => { const r = Store.pupilsIn(c.id).map(p => Store.account(p.id)).filter(Boolean);
            const t = r.reduce((n, x) => n + x.inv.instalments.filter(i => i.due <= Store.today()).reduce((m, i) => m + i.amount, 0), 0);
            const pd = r.reduce((n, x) => n + Math.min(x.paid, x.inv.instalments.filter(i => i.due <= Store.today()).reduce((m, i) => m + i.amount, 0)), 0);
            const pct = Fmt.pct(pd, t); return `<tr><td class="small bold">${esc(c.grade)}</td><td style="width:46%"><div class="bar"><span style="width:${pct}%;background:${pct >= 90 ? "var(--green)" : pct >= 70 ? "var(--navy)" : "var(--red)"}"></span></div></td><td class="right tiny bold">${pct}%</td></tr>`; }).join("")}
        </tbody></table></div></div>
        <div class="card"><div class="card-head"><h3>Recent payments</h3></div><div class="card-body tight table-wrap"><table><tbody>
          ${recent.map(pm => { const p = Store.pupil(pm.pupilId); return `<tr><td><span class="small bold">${p ? esc(p.first + " " + p.last) : "—"}</span><br><span class="tiny muted">${esc(pm.method)} · ${esc(pm.ref)}</span></td><td class="right"><span class="bold small">${Store.money(pm.amount)}</span><br><span class="tiny muted">${Fmt.date(pm.date, "short")}</span></td></tr>`; }).join("") || `<tr><td class="empty small">No payments recorded.</td></tr>`}
        </tbody></table></div></div>
        <div class="card"><div class="card-head"><h3>Fee items</h3>${this.can("config.manage") ? `<a class="small" href="#/config">Edit</a>` : ""}</div><div class="card-body tight table-wrap"><table><tbody>
          ${Store.db.feeItems.map(f => `<tr><td class="small">${esc(f.name)}<br><span class="tiny muted">${f.compulsory ? "Compulsory" : "Optional"}</span></td><td class="right bold">${Store.money(f.amount)}</td></tr>`).join("")}
        </tbody></table></div><div class="card-foot tiny muted">Sibling discount ${Math.round(Store.db.feeRules.siblingDiscount * 100)}% · early settlement ${Math.round(Store.db.feeRules.earlySettlement * 100)}% · late surcharge ${Math.round(Store.db.feeRules.lateSurcharge * 100)}%.</div></div>
      </div>
    </div>`;
  },

  accountModal(pupilId) {
    const p = Store.pupil(pupilId); const acc = Store.account(pupilId); if (!p || !acc) return;
    const pays = Store.paymentsFor(pupilId); const manage = this.can("billing.manage");
    const body = `
      <div class="flex mb-16"><span class="avatar lg">${p.first[0]}${p.last[0]}</span><div><h2>${esc(p.first)} ${esc(p.last)}</h2><div class="muted">${esc(Store.cls(p.classId).name)} · ${esc(p.admissionNo)} · ${esc(p.guardian.name)}</div></div><div class="grow"></div>${this.accountPill(acc)}</div>
      <div class="grid cols-3 mb-16">
        <div class="card stat"><div class="label">Billed</div><div class="value fig-sm">${Store.money(acc.total)}</div></div>
        <div class="card stat"><div class="label">Paid</div><div class="value fig-sm t-good">${Store.money(acc.paid)}</div></div>
        <div class="card stat"><div class="label">Balance</div><div class="value fig-sm ${acc.balance > 0 ? "t-bad" : "t-good"}">${Store.money(acc.balance)}</div></div>
      </div>
      <div class="grid cols-2">
        <div><div class="eyebrow mb-8">Invoice — ${esc(acc.inv.term)}</div><div class="table-wrap"><table><tbody>
          ${acc.inv.items.map(it => `<tr><td class="small">${esc(it.name)}</td><td class="right">${Store.money(it.amount)}</td></tr>`).join("")}
          ${acc.inv.discount ? `<tr><td class="small t-good">${esc(acc.inv.discountReason)}</td><td class="right t-good">−${Store.money(acc.inv.discount)}</td></tr>` : ""}
          <tr><td class="bold">Total</td><td class="right bold">${Store.money(acc.total)}</td></tr>
        </tbody></table></div></div>
        <div><div class="eyebrow mb-8">Instalments</div><div class="table-wrap"><table><tbody>
          ${acc.inv.instalments.map((i, k) => { const paidTo = pays.slice(0, k + 1).reduce((n, x) => n + x.amount, 0); const dueTo = acc.inv.instalments.slice(0, k + 1).reduce((n, x) => n + x.amount, 0); const state = paidTo >= dueTo - 0.01 ? "paid" : i.due <= Store.today() ? "overdue" : "due";
            return `<tr><td class="small">Instalment ${i.n}<br><span class="tiny muted">due ${Fmt.date(i.due)}</span></td><td class="right">${Store.money(i.amount)}</td><td class="right"><span class="pill ${state === "paid" ? "green" : state === "overdue" ? "red" : "grey"} tiny">${state === "paid" ? "Paid" : state === "overdue" ? "Overdue" : "Due"}</span></td></tr>`; }).join("")}
        </tbody></table></div></div>
      </div>
      <div class="eyebrow mt-24 mb-8">Payments received</div>
      ${pays.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Method</th><th>Reference</th><th>Received by</th><th class="right">Amount</th></tr></thead><tbody>${pays.map(x => `<tr><td>${Fmt.date(x.date)}</td><td>${esc(x.method)}</td><td class="tiny muted">${esc(x.ref)}</td><td class="muted small">${Store.staffName(x.by, { short: true })}</td><td class="right bold">${Store.money(x.amount)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted small">Nothing received yet this term.</p>`}`;
    const foot = `<div class="grow"></div>
      ${this.can("billing.chase") && acc.overdue > 0 && p.guardian.email ? `<button class="btn ghost" data-action="comms-new" data-pupil="${p.id}" data-template="ct3">${icon("send")} Send reminder</button>` : ""}
      ${manage ? `<button class="btn" data-action="pay-new" data-pupil="${p.id}">${icon("plus")} Record payment</button>` : ""}`;
    this.modal({ title: "Fee account", body, foot, wide: true });
  },

  paymentForm(pupilId) {
    const pupils = this.sisPupils();
    const body = `<form data-form="pay-save">
      <div class="grid cols-2">
        <div><label class="field">Pupil</label><select class="input" name="pupilId">${pupils.map(p => `<option value="${p.id}" ${p.id === pupilId ? "selected" : ""}>${esc(p.last)}, ${esc(p.first)} — ${esc(Store.cls(p.classId).grade)}</option>`).join("")}</select></div>
        <div><label class="field">Amount (USD)</label><input class="input" type="number" name="amount" step="0.01" min="0.01" required></div>
        <div><label class="field">Date</label><input class="input" type="date" name="date" value="${Store.today()}" max="${Store.today()}"></div>
        <div><label class="field">Method</label><select class="input" name="method">${["EcoCash", "Bank transfer", "Cash", "Paynow", "Cheque"].map(m => `<option>${m}</option>`).join("")}</select></div>
      </div>
      <label class="field mt-16">Reference / receipt number</label><input class="input" name="ref" placeholder="e.g. EC482119">
      <div class="help">The payment posts straight onto the pupil's account and the term's collection figures.</div>
      <div class="modal-foot" style="padding:16px 0 0;border:0"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button class="btn" type="submit">Record payment</button></div></form>`;
    this.modal({ title: "Record a payment", body });
  },

  raiseInvoice(pupilId, sibling) {
    const p = Store.pupil(pupilId); const grade = Store.cls(p.classId).grade;
    const items = Store.db.feeItems.filter(f => f.grades.includes(grade) && f.compulsory).map(f => ({ id: f.id, name: f.name, amount: f.amount }));
    const gross = items.reduce((n, it) => n + it.amount, 0);
    const discount = sibling ? Math.round(gross * Store.db.feeRules.siblingDiscount) : 0;
    const total = gross - discount;
    const base = Store.db.invoices[0];
    const due = base ? base.instalments.map(i => i.due) : ["2026-09-04", "2026-10-09", "2026-11-13"];
    Store.db.invoices.push({ id: `inv_${p.id}`, pupilId: p.id, term: Store.db.school.term.name, issued: Store.today(), items, discount, discountReason: sibling ? `Sibling discount (${Math.round(Store.db.feeRules.siblingDiscount * 100)}%)` : "", total, instalments: due.map((d, k) => ({ n: k + 1, due: d, amount: Math.round((total / due.length) * 100) / 100 })) });
  },

  /* ======================================================================
     GUARDIAN COMMUNICATION
     ====================================================================== */
  vComms() {
    const ui = this.ui.comms; const me = this.me();
    const classIds = this.sisClasses().map(c => c.id);
    let list = (Store.db.comms || []).filter(c => !c.classId || classIds.includes(c.classId));
    if (ui.scope === "mine") list = list.filter(c => c.sentBy === me.id);
    if (ui.scope === "auto") list = list.filter(c => c.automatic);
    const q = ui.q.trim().toLowerCase();
    if (q) list = list.filter(c => `${c.subject} ${c.body} ${c.to}`.toLowerCase().includes(q));
    const reach = Store.db.pupils.filter(p => p.status === "active");
    const withEmail = reach.filter(p => p.guardian.email).length;
    const sent7 = (Store.db.comms || []).filter(c => c.sentAt >= new Date(Date.now() - 7 * 864e5).toISOString()).length;

    return `
    <div class="toolbar">
      <select class="input" data-change="comms-scope">${[["all", "Everything sent"], ["mine", "Sent by me"], ["auto", "Automatic"]].map(([v, l]) => `<option value="${v}" ${ui.scope === v ? "selected" : ""}>${l}</option>`).join("")}</select>
      <div class="search">${icon("search")}<input class="input" placeholder="Search messages" value="${esc(ui.q)}" data-input="comms-q"></div>
      <div class="grow"></div>
      ${this.can("comms.send") ? `<button class="btn sm" data-action="comms-new">${icon("send")} New message</button>` : ""}
    </div>
    <div class="grid cols-4 mb-16">
      <div class="card stat accent"><div class="label">Sent this week</div><div class="value">${sent7}</div><div class="sub">Email and SMS to guardians</div></div>
      <div class="card stat"><div class="label">Reachable by email</div><div class="value">${Fmt.pct(withEmail, reach.length)}%</div><div class="sub">${withEmail} of ${reach.length} guardians</div></div>
      <div class="card stat"><div class="label">Reachable by SMS</div><div class="value">100%</div><div class="sub">Every guardian has a phone number on file</div></div>
      <div class="card stat"><div class="label">Templates</div><div class="value">${Store.db.commTemplates.length}</div><div class="sub">Absence, fees, progress, offers</div></div>
    </div>
    <div class="grid side">
      <div class="card">
        <div class="card-head"><div><h3>Guardian communication</h3><div class="tiny muted">Everything is logged against the pupil's record, whoever sent it and however it went out.</div></div></div>
        <div class="card-body tight">${this.threads(list).map(t => this.threadRow(t)).join("") || `<div class="empty">Nothing sent yet.</div>`}</div>
      </div>
      <div class="stack" style="gap:18px">
        <div class="card"><div class="card-head"><h3>Templates</h3></div><div class="card-body tight table-wrap"><table><tbody>
          ${Store.db.commTemplates.map(t => `<tr class="clickable" data-action="comms-new" data-template="${t.id}"><td><span class="small bold">${esc(t.name)}</span><br><span class="tiny muted">${t.channel.toUpperCase()}</span></td><td class="right">${icon("right", "ico")}</td></tr>`).join("")}
        </tbody></table></div><div class="card-foot tiny muted">Placeholders like {pupil}, {guardian} and {balance} fill themselves in from the record.</div></div>
        <div class="card"><div class="card-head"><h3>Channels</h3>${this.can("integrations.manage") ? `<a class="small" href="#/integrations">Integrations</a>` : ""}</div><div class="card-body tight table-wrap"><table><tbody>
          ${Store.db.integrations.filter(i => i.cat === "Communication").map(i => `<tr><td class="small bold">${esc(i.name)}</td><td class="right"><span class="pill ${i.status === "connected" ? "green" : "grey"} tiny">${i.status === "connected" ? "Connected" : "Available"}</span></td></tr>`).join("")}
        </tbody></table></div></div>
      </div>
    </div>`;
  },

  /* ------------------------------------------------------------------------
     Replying to a family, rather than starting again
     ------------------------------------------------------------------------
     A message from the family portal could be read on the staff side, and
     then the only way to answer it was "New message": a blank compose with
     the channel defaulting to Email. So a reply to something a parent wrote
     in the portal went out by email, where the parent was not looking, with
     no subject and no sign of what it was about. Both halves worked; the
     turn between them did not.

     `replyTo` carries the message being answered. It fixes the channel to
     the one it arrived on, carries the subject across, and puts what they
     wrote above the box so whoever is replying can see it while they type.
     ------------------------------------------------------------------------ */
  commsForm(opts = {}) {
    const t = opts.templateId ? Store.db.commTemplates.find(x => x.id === opts.templateId) : null;
    const pupils = this.sisPupils();
    const replying = opts.replyTo ? (Store.db.comms || []).find(c => c.id === opts.replyTo) : null;
    const pupilId = opts.pupilId || (replying && replying.pupilId) || "";
    const p = pupilId ? Store.pupil(pupilId) : null;
    const filled = t ? this.fillTemplate(t.body, p) : "";
    const channel = replying ? "portal" : (t ? t.channel : "email");
    const subject = replying
      ? (/^re:/i.test(replying.subject || "") ? replying.subject : `Re: ${replying.subject || "your message"}`)
      : (t ? this.fillTemplate(t.subject, p) : "");
    const quoted = replying ? `
      <div class="notice info small mb-16">${icon("chat")}
        <div><strong>${esc(replying.fromName || "A guardian")} wrote${replying.sentAt ? ` on ${Fmt.date(replying.sentAt, "long")}` : ""}:</strong>
        <div class="mt-8">${esc(replying.body || "")}</div></div>
      </div>` : "";
    this._replyThread = replying ? this.threadKey(replying) : null;
    const body = `${quoted}<form data-form="comms-save">
      <div class="grid cols-2">
        <div><label class="field">Send to</label><select class="input" name="target" data-change="comms-target">
          <option value="pupil" ${pupilId ? "selected" : ""}>One pupil's guardian</option>
          <option value="class">A whole class</option>
          ${this.can("comms.broadcast") ? `<option value="all">Every guardian on the roll</option>` : ""}
        </select></div>
        <div><label class="field">Channel</label><select class="input" name="channel"><option value="email" ${channel === "email" ? "selected" : ""}>Email</option><option value="sms" ${channel === "sms" ? "selected" : ""}>SMS</option><option value="portal" ${channel === "portal" ? "selected" : ""}>Family portal</option></select>
          ${replying ? `<div class="help">They wrote from the family portal, so the reply goes back to it.</div>` : ""}</div>
        <div><label class="field">Pupil</label><select class="input" name="pupilId">${pupils.map(x => `<option value="${x.id}" ${x.id === pupilId ? "selected" : ""}>${esc(x.last)}, ${esc(x.first)} — ${esc(Store.cls(x.classId).grade)}</option>`).join("")}</select></div>
        <div><label class="field">Class</label><select class="input" name="classId" disabled>${this.sisClasses().map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select></div>
      </div>
      <label class="field mt-16">Subject <span class="tiny muted">(email only)</span></label><input class="input" name="subject" value="${esc(subject)}">
      <label class="field mt-16">Message</label><textarea class="input" name="body" rows="8" required>${esc(filled)}</textarea>
      <div class="help">Sent through ${Store.db.integrations.find(i => i.id === "gmail").status === "connected" ? "Google Workspace" : "the school mailbox"} and Econet Bulk SMS, and logged against the pupil's record.</div>
      <div class="modal-foot" style="padding:16px 0 0;border:0"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button class="btn" type="submit">${icon("send")} Send</button></div></form>`;
    this.modal({ title: replying ? `Reply to ${replying.fromName || "the family"}` : "Message guardians", body, wide: true });
  },

  fillTemplate(text, p) {
    if (!text) return "";
    const acc = p ? Store.account(p.id) : null;
    return text
      .replace(/\{pupil\}/g, p ? `${p.first} ${p.last}` : "{pupil}")
      .replace(/\{guardian\}/g, p ? p.guardian.name : "{guardian}")
      .replace(/\{class\}/g, p ? Store.cls(p.classId).name : "{class}")
      .replace(/\{balance\}/g, acc ? Store.money(acc.balance) : "{balance}")
      .replace(/\{due\}/g, acc && acc.inv.instalments.find(i => i.due <= Store.today()) ? Fmt.date(acc.inv.instalments.filter(i => i.due <= Store.today()).pop().due) : "{due}")
      .replace(/\{staff\}/g, Store.staffName(this.me().id))
      .replace(/\{grade\}/g, p ? Store.cls(p.classId).grade : "{grade}")
      .replace(/\{note\}/g, "[add a sentence of your own here]")
      .replace(/\{expires\}/g, "[date]");
  },

  /* ------------------------------------------------------------------------
     One exchange, not a pile of messages
     ------------------------------------------------------------------------
     The list used to be every message ever sent, flat and newest first, so a
     reply appeared above the thing it replied to with no sign they were
     related — two rows saying nearly the same thing, in the wrong order,
     with the subject repeated. It reads as an inbox now: one row per
     exchange, the subject once, the latest line showing, and the whole of it
     when you open it.
     ------------------------------------------------------------------------ */
  threadRow(t) {
    const c = t.last, p = c.pupilId ? Store.pupil(c.pupilId) : null;
    const open = this.ui.comms.open === t.key;
    const n = t.messages.length;
    const who = (m) => m.fromGuardian ? `${esc(m.fromName || "A guardian")} (family portal)` : Store.staffName(m.sentBy, { short: true });
    return `<div class="comm thread ${c.automatic ? "auto" : ""}${t.unanswered ? " unanswered" : ""}">
      <div class="thread-top clickable" data-action="thread-toggle" data-key="${esc(t.key)}">
        <div class="flex between wrap"><div class="flex" style="gap:8px">
          <span class="pill ${c.channel === "sms" ? "blue" : c.channel === "portal" ? "gold" : "navy"} tiny">${c.channel === "portal" ? "PORTAL" : c.channel.toUpperCase()}</span>
          <span class="bold small">${esc(t.subject || (p ? `${p.first} ${p.last}` : c.to))}</span>
          ${n > 1 ? `<span class="pill grey tiny">${n} messages</span>` : ""}
          ${t.unanswered ? `<span class="pill gold tiny">Awaiting a reply</span>` : ""}
          ${c.automatic ? `<span class="pill gold tiny">Automatic</span>` : ""}
        </div><span class="tiny muted">${Fmt.dateTime(c.sentAt)} · ${who(c)}</span></div>
        <div class="tiny muted mt-8">${p ? `${esc(p.first)} ${esc(p.last)} · ${esc(Store.cls(p.classId).name)}` : c.classId ? esc(Store.cls(c.classId).name) : esc(c.to)}${c.recipients > 1 ? ` · ${c.recipients} recipients` : ""}</div>
        ${open ? "" : `<p class="small mt-8 thread-peek">${esc(c.body)}</p>`}
      </div>
      ${open ? `<div class="thread-body">${t.messages.map(m => `
        <div class="thread-msg ${m.fromGuardian ? "in" : "out"}">
          <div class="flex between wrap"><span class="tiny bold">${who(m)}</span><span class="tiny muted">${Fmt.dateTime(m.sentAt)}</span></div>
          <p class="small mt-8" style="white-space:pre-wrap;margin:0">${esc(m.body)}</p>
        </div>`).join("")}</div>` : ""}
      ${this.can("comms.send") && (t.unanswered || open) ? `<div class="thread-act">
        <button class="btn xs" data-action="family-reply" data-id="${esc(t.last.id)}">${icon("send")} Reply${t.last.channel === "portal" || t.messages.some(m => m.fromGuardian) ? " in the portal" : ""}</button>
      </div>` : ""}
    </div>`;
  },

  logComm(o) {
    const id = Store.uid("cm");
    /* A reply joins the thread it answers; anything else starts its own. */
    Store.db.comms.unshift({ id, threadId: o.threadId || id, status: "delivered",
      sentBy: this.me().id, sentAt: new Date().toISOString(), recipients: 1, ...o, id });
  },

  /* Every message in the same exchange, oldest first — the way you read one.
     Falls back to the message's own id so anything written before threads
     existed is a thread of one. */
  threadKey(c) { return c.threadId || c.id; },
  threadOf(c) {
    const key = this.threadKey(c);
    return (Store.db.comms || []).filter(x => this.threadKey(x) === key)
      .sort((a, b) => String(a.sentAt).localeCompare(String(b.sentAt)));
  },
  /* One entry per exchange, newest exchange first, from a list of messages. */
  threads(list) {
    const seen = new Map();
    for (const c of list) {
      const key = this.threadKey(c);
      const t = seen.get(key) || { key, messages: [] };
      t.messages.push(c);
      seen.set(key, t);
    }
    return [...seen.values()].map(t => {
      t.messages.sort((a, b) => String(a.sentAt).localeCompare(String(b.sentAt)));
      t.first = t.messages[0];
      t.last = t.messages[t.messages.length - 1];
      t.subject = (t.messages.find(m => m.subject) || {}).subject || "";
      t.unanswered = t.last.fromGuardian;          // the family spoke last
      return t;
    }).sort((a, b) => String(b.last.sentAt).localeCompare(String(a.last.sentAt)));
  },

  /* ======================================================================
     LEAVERS & ALUMNI
     ====================================================================== */
  vAlumni() {
    const list = (Store.db.alumni || []).slice().sort((a, b) => b.left.localeCompare(a.left));
    const manage = this.can("alumni.manage");
    const leavers = Store.db.pupils.filter(p => p.status === "withdrawn");
    const byYear = list.reduce((m, a) => { const y = a.left.slice(0, 4); (m[y] = m[y] || []).push(a); return m; }, {});
    const dest = list.reduce((m, a) => { m[a.destination] = (m[a.destination] || 0) + 1; return m; }, {});
    const avgYears = list.length ? (list.reduce((n, a) => n + a.years, 0) / list.length).toFixed(1) : "—";
    return `
    <div class="toolbar">
      <div class="grow"></div>
      <span class="muted small">${list.length} on the alumni register</span>
      ${manage ? `<button class="btn sm" data-action="alumni-new">${icon("plus")} Move a leaver across</button>` : ""}
    </div>
    <div class="grid cols-4 mb-16">
      <div class="card stat accent"><div class="label">Alumni</div><div class="value">${list.length}</div><div class="sub">Since ${Object.keys(byYear).sort()[0] || "—"}</div></div>
      <div class="card stat"><div class="label">Average stay</div><div class="value">${avgYears}</div><div class="sub">years at Ayanda</div></div>
      <div class="card stat"><div class="label">Destinations</div><div class="value">${Object.keys(dest).length}</div><div class="sub">Junior and senior schools</div></div>
      <div class="card stat"><div class="label">Awaiting transfer</div><div class="value ${leavers.length ? "t-warn" : "t-good"}">${leavers.length}</div><div class="sub">Withdrawn pupils not yet on the register</div></div>
    </div>
    <div class="grid side">
      <div class="card">
        <div class="card-head"><div><h3>Alumni register</h3><div class="tiny muted">The record does not end at the last register — it follows the child out of the gate.</div></div></div>
        <div class="card-body tight table-wrap"><table>
          <thead><tr><th>Name</th><th>Admission no.</th><th>Left</th><th>Last class</th><th>Went on to</th><th>Guardian contact</th></tr></thead>
          <tbody>${list.map(a => `<tr>
            <td><span class="bold">${esc(a.last)}, ${esc(a.first)}</span>${a.note ? `<br><span class="tiny muted">${esc(a.note)}</span>` : ""}</td>
            <td class="tiny muted">${esc(a.admissionNo)}</td>
            <td>${Fmt.date(a.left)}<br><span class="tiny muted">${a.years} years here</span></td>
            <td class="small">${esc(a.lastClass)}</td>
            <td><span class="pill navy">${esc(a.destination)}</span></td>
            <td class="small">${esc(a.guardian)}<br><span class="tiny muted">${esc(a.contact)}</span></td>
          </tr>`).join("") || `<tr><td colspan="6" class="empty">Nobody on the register yet.</td></tr>`}</tbody>
        </table></div>
      </div>
      <div class="stack" style="gap:18px">
        <div class="card"><div class="card-head"><h3>Where they go</h3></div><div class="card-body tight table-wrap"><table><tbody>
          ${Object.entries(dest).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<tr><td class="small">${esc(k)}</td><td class="right"><span class="pill">${n}</span></td></tr>`).join("")}
        </tbody></table></div><div class="card-foot tiny muted">Useful for the prospectus and for keeping in touch about siblings.</div></div>
        <div class="card"><div class="card-head"><h3>By leaving year</h3></div><div class="card-body tight table-wrap"><table><tbody>
          ${Object.entries(byYear).sort((a, b) => b[0].localeCompare(a[0])).map(([y, l]) => `<tr><td class="small bold">${y}</td><td class="right"><span class="pill grey">${l.length} leaver${l.length === 1 ? "" : "s"}</span></td></tr>`).join("")}
        </tbody></table></div></div>
      </div>
    </div>`;
  },

  alumniForm() {
    const leavers = Store.db.pupils.filter(p => p.status === "withdrawn");
    const pool = leavers.length ? leavers : Store.pupilsIn("c4");
    const body = `<form data-form="alumni-save">
      <p class="small muted">${leavers.length ? "Withdrawn pupils waiting to be transferred." : "No withdrawn pupils — Grade 2 is shown so a leaver can be recorded early."}</p>
      <label class="field mt-16">Pupil</label><select class="input" name="pupilId">${pool.map(p => `<option value="${p.id}">${esc(p.last)}, ${esc(p.first)} — ${esc(Store.cls(p.classId).name)}</option>`).join("")}</select>
      <div class="grid cols-2 mt-16">
        <div><label class="field">Left on</label><input class="input" type="date" name="left" value="${Store.db.school.term.end}"></div>
        <div><label class="field">Going on to</label><input class="input" name="destination" placeholder="e.g. Petra Junior School" required></div>
      </div>
      <label class="field mt-16">Note</label><input class="input" name="note" placeholder="Optional">
      <div class="help">The pupil's attendance, marks and fee history stay on file; only their status changes.</div>
      <div class="modal-foot" style="padding:16px 0 0;border:0"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button class="btn" type="submit">Move to alumni</button></div></form>`;
    this.modal({ title: "Move a leaver to the alumni register", body });
  },

  /* ======================================================================
     CONFIGURATION — changed in the portal, not in code
     ====================================================================== */
  vConfig() {
    const tab = this.ui.config.tab;
    const tabs = [["intakes", "Intakes"], ["fees", "Fee items"], ["grading", "Grading scale"], ["subjects", "Subjects"]];
    const bodyFor = {
      intakes: () => `
        <div class="card"><div class="card-head"><div><h3>Admission intakes</h3><div class="tiny muted">Open a new intake and set how many places each year group has. Admissions counts against these numbers automatically.</div></div><button class="btn sm" data-action="intake-new">${icon("plus")} New intake</button></div>
        <div class="card-body tight table-wrap"><table>
          <thead><tr><th>Intake</th><th>Applications open</th><th>Close</th><th>Term starts</th><th>Places</th><th>Status</th><th></th></tr></thead>
          <tbody>${Store.db.intakes.map(i => `<tr>
            <td class="bold">${esc(i.name)}</td><td>${Fmt.date(i.opens)}</td><td>${Fmt.date(i.closes)}</td><td>${Fmt.date(i.starts)}</td>
            <td class="small">${Object.entries(i.places).map(([g, n]) => `${g} ${n}`).join(" · ")}</td>
            <td><span class="pill ${i.status === "open" ? "green" : "grey"}">${i.status === "open" ? "Open" : "Planned"}</span></td>
            <td class="right"><button class="btn xs ghost" data-action="intake-edit" data-id="${i.id}">${icon("edit")}</button></td>
          </tr>`).join("")}</tbody>
        </table></div></div>`,
      fees: () => `
        <div class="card"><div class="card-head"><div><h3>Fee items</h3><div class="tiny muted">Every invoice is built from these lines. Changing an amount affects invoices raised from now on.</div></div><button class="btn sm" data-action="fee-new">${icon("plus")} New fee item</button></div>
        <div class="card-body tight table-wrap"><table>
          <thead><tr><th>Item</th><th>Applies to</th><th>Type</th><th class="right">Amount</th><th></th></tr></thead>
          <tbody>${Store.db.feeItems.map(f => `<tr>
            <td class="bold">${esc(f.name)}</td><td class="small muted">${f.grades.join(", ")}</td>
            <td><span class="pill ${f.compulsory ? "navy" : "grey"}">${f.compulsory ? "Compulsory" : "Optional"}</span></td>
            <td class="right bold">${Store.money(f.amount)}</td>
            <td class="right"><button class="btn xs ghost" data-action="fee-edit" data-id="${f.id}">${icon("edit")}</button></td>
          </tr>`).join("")}</tbody>
        </table></div>
        <div class="card-foot"><form data-form="fee-rules" class="flex wrap" style="gap:12px;align-items:flex-end">
          <div><label class="field">Sibling discount %</label><input class="input sm" type="number" name="sibling" value="${Math.round(Store.db.feeRules.siblingDiscount * 100)}" min="0" max="50" style="width:110px"></div>
          <div><label class="field">Early settlement %</label><input class="input sm" type="number" name="early" value="${Math.round(Store.db.feeRules.earlySettlement * 100)}" min="0" max="50" style="width:110px"></div>
          <div><label class="field">Late surcharge %</label><input class="input sm" type="number" name="late" value="${Math.round(Store.db.feeRules.lateSurcharge * 100)}" min="0" max="50" style="width:110px"></div>
          <div><label class="field">Instalments</label><input class="input sm" type="number" name="instalments" value="${Store.db.feeRules.instalments}" min="1" max="6" style="width:90px"></div>
          <button class="btn sm" type="submit">Save rules</button>
        </form></div></div>`,
      grading: () => `
        <div class="card"><div class="card-head"><div><h3>Grading scale</h3><div class="tiny muted">Report cards and the gradebook use these boundaries. Marks below the lowest boundary take the last band.</div></div></div>
        <div class="card-body"><form data-form="grade-scale"><div class="table-wrap"><table>
          <thead><tr><th>Code</th><th>Label</th><th>Description on the report card</th><th class="right" style="width:130px">From</th></tr></thead>
          <tbody>${Store.db.gradeScale.map((g, i) => `<tr>
            <td><span class="pill ${g.colour}">${esc(g.code)}</span></td>
            <td><input class="input sm" name="label_${i}" value="${esc(g.label)}"></td>
            <td><input class="input sm" name="desc_${i}" value="${esc(g.desc)}"></td>
            <td class="right"><input class="input sm right" type="number" name="min_${i}" value="${g.min}" min="0" max="100" style="width:90px" ${i === Store.db.gradeScale.length - 1 ? "disabled" : ""}></td>
          </tr>`).join("")}</tbody>
        </table></div><button class="btn sm mt-16" type="submit">${icon("check")} Save scale</button></form></div>
        <div class="card-foot tiny muted">Assessment weightings: ${ASSESSMENT_KINDS.map(k => `${k.label} ${Math.round(k.weight * 100)}%`).join(" · ")}.</div></div>`,
      subjects: () => `
        <div class="card"><div class="card-head"><div><h3>Assessed subjects</h3><div class="tiny muted">What appears on the report card for each band. Timetabled subjects that carry no mark (Assembly, Story & Rest, Library) are left off.</div></div></div>
        <div class="card-body grid cols-2">
          <div><div class="eyebrow mb-8">ECD A and ECD B</div><div class="flex wrap" style="gap:6px">${ASSESSED.ecd.map(s => `<span class="pill ${SUBJECTS[s] || "grey"}">${esc(s)}</span>`).join("")}</div></div>
          <div><div class="eyebrow mb-8">Grade 1 and Grade 2</div><div class="flex wrap" style="gap:6px">${ASSESSED.grade.map(s => `<span class="pill ${SUBJECTS[s] || "grey"}">${esc(s)}</span>`).join("")}</div></div>
        </div>
        <div class="card-foot tiny muted">Teaching teams and who teaches what are set on the <a href="#/timetable">Timetable</a>.</div></div>`,
    };
    return `
    <div class="toolbar">
      <div class="flex" style="gap:4px">${tabs.map(([id, label]) => `<button class="btn ${tab === id ? "" : "ghost"} sm" data-action="config-tab" data-id="${id}">${label}</button>`).join("")}</div>
      <div class="grow"></div>
      <span class="tiny muted">Changed here by the school, not by a developer.</span>
    </div>
    ${bodyFor[tab]()}`;
  },

  intakeForm(id) {
    const i = id ? Store.intake(id) : { name: "", opens: Store.today(), closes: "", starts: "", places: { "ECD A": 16, "ECD B": 4, "Grade 1": 3, "Grade 2": 2 }, status: "planned" };
    const body = `<form data-form="intake-save" data-id="${id || ""}">
      <label class="field">Name</label><input class="input" name="name" value="${esc(i.name)}" placeholder="e.g. January 2027" required>
      <div class="grid cols-3 mt-16">
        <div><label class="field">Applications open</label><input class="input" type="date" name="opens" value="${i.opens}"></div>
        <div><label class="field">Close</label><input class="input" type="date" name="closes" value="${i.closes}"></div>
        <div><label class="field">Term starts</label><input class="input" type="date" name="starts" value="${i.starts}"></div>
      </div>
      <div class="eyebrow mt-24 mb-8">Places available</div>
      <div class="grid cols-4">${["ECD A", "ECD B", "Grade 1", "Grade 2"].map(g => `<div><label class="field">${g}</label><input class="input" type="number" name="pl_${g}" value="${i.places[g] ?? 0}" min="0" max="40"></div>`).join("")}</div>
      <label class="field mt-16">Status</label><select class="input" name="status"><option value="open" ${i.status === "open" ? "selected" : ""}>Open for applications</option><option value="planned" ${i.status === "planned" ? "selected" : ""}>Planned</option><option value="closed" ${i.status === "closed" ? "selected" : ""}>Closed</option></select>
      <div class="modal-foot" style="padding:16px 0 0;border:0"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button class="btn" type="submit">${id ? "Save intake" : "Create intake"}</button></div></form>`;
    this.modal({ title: id ? "Edit intake" : "New intake", body, wide: true });
  },

  feeForm(id) {
    const f = id ? Store.db.feeItems.find(x => x.id === id) : { id: "", name: "", amount: 0, compulsory: true, grades: ["ECD A", "ECD B", "Grade 1", "Grade 2"] };
    const body = `<form data-form="fee-save" data-id="${id || ""}">
      <label class="field">Item name</label><input class="input" name="name" value="${esc(f.name)}" required>
      <div class="grid cols-2 mt-16">
        <div><label class="field">Amount per term (USD)</label><input class="input" type="number" name="amount" step="1" min="0" value="${f.amount}" required></div>
        <div><label class="field">Type</label><select class="input" name="compulsory"><option value="yes" ${f.compulsory ? "selected" : ""}>Compulsory</option><option value="no" ${!f.compulsory ? "selected" : ""}>Optional</option></select></div>
      </div>
      <div class="eyebrow mt-24 mb-8">Applies to</div>
      <div class="flex wrap" style="gap:12px">${["ECD A", "ECD B", "Grade 1", "Grade 2"].map(g => `<label class="check"><input type="checkbox" name="g_${g}" ${f.grades.includes(g) ? "checked" : ""}> ${g}</label>`).join("")}</div>
      <div class="modal-foot" style="padding:16px 0 0;border:0"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button class="btn" type="submit">${id ? "Save item" : "Add item"}</button></div></form>`;
    this.modal({ title: id ? "Edit fee item" : "New fee item", body });
  },

  /* ======================================================================
     INTEGRATIONS
     ====================================================================== */
  vIntegrations() {
    const s = Store.db.school;
    const cats = [...new Set(Store.db.integrations.map(i => i.cat))];
    const connected = Store.db.integrations.filter(i => i.status === "connected").length;
    return `
    <div class="grid cols-3 mb-16">
      <div class="card stat accent"><div class="label">Connected</div><div class="value">${connected} / ${Store.db.integrations.length}</div><div class="sub">Services wired into the portal</div></div>
      <div class="card stat"><div class="label">Drive</div><div class="value fig-sm">${s.googleClientId ? "Signed in" : "Link only"}</div><div class="sub">${s.googleClientId ? "Browsing enabled" : "Paste share links — no setup needed"}</div></div>
      <div class="card stat"><div class="label">API</div><div class="value fig-sm">REST</div><div class="sub">For anything not covered here</div></div>
    </div>
    <div class="grid side">
      <div class="stack" style="gap:18px">
        ${cats.map(cat => `<div class="card">
          <div class="card-head"><h3>${esc(cat)}</h3></div>
          <div class="card-body tight table-wrap"><table><tbody>
            ${Store.db.integrations.filter(i => i.cat === cat).map(i => `<tr>
              <td><span class="bold">${esc(i.name)}</span><br><span class="tiny muted">${esc(i.note)}</span></td>
              <td class="right"><span class="pill ${i.status === "connected" ? "green" : "grey"}">${i.status === "connected" ? "Connected" : "Available"}</span></td>
              <td class="right"><button class="btn xs ghost" data-action="integration-toggle" data-id="${i.id}">${i.status === "connected" ? "Disconnect" : "Connect"}</button></td>
            </tr>`).join("")}
          </tbody></table></div>
        </div>`).join("")}
      </div>
      <div class="stack" style="gap:18px">
        <div class="card"><div class="card-head"><h3>Google Drive</h3></div><div class="card-body">
          <form data-form="drive-config">
            <label class="field">OAuth Client ID</label><input class="input" name="clientId" value="${esc(s.googleClientId)}" placeholder="xxxxx.apps.googleusercontent.com">
            <div class="help">Create a Web application OAuth client in Google Cloud Console, add this portal's address as an authorised JavaScript origin and enable the Drive API. Without it, pasted Drive share links still work.</div>
            <button class="btn sm mt-16" type="submit">Save</button>
          </form>
        </div></div>
        <div class="card"><div class="card-head"><h3>Portal API</h3></div><div class="card-body small">
          <p class="muted">Read and write the same records the portal uses, for anything the built-in connectors do not cover.</p>
          <div class="code mt-8">GET /api/v1/pupils<br>GET /api/v1/attendance?date=${Store.today()}<br>POST /api/v1/payments</div>
          <div class="help mt-8">Keys are issued per integration and appear in the audit log on every call. Available once the portal runs against a backend.</div>
        </div></div>
      </div>
    </div>`;
  },

  /* ======================================================================
     AUDIT & COMPLIANCE
     ====================================================================== */
  vAudit() {
    const log = Store.db.audit || [];
    const today = Store.today();
    const pupils = Store.db.pupils.filter(p => p.status === "active");
    const consent = (k) => pupils.filter(p => p.consents && p.consents[k]).length;
    const missingMedical = pupils.filter(p => !p.medical.doctor).length;
    return `
    <div class="grid cols-4 mb-16">
      <div class="card stat accent"><div class="label">Audit entries</div><div class="value">${log.length}</div><div class="sub">Most recent ${log[0] ? Fmt.dateTime(log[0].at) : "—"}</div></div>
      <div class="card stat"><div class="label">Photo consent</div><div class="value">${Fmt.pct(consent("photo"), pupils.length)}%</div><div class="sub">${consent("photo")} of ${pupils.length} pupils</div></div>
      <div class="card stat"><div class="label">Trip consent</div><div class="value">${Fmt.pct(consent("trips"), pupils.length)}%</div><div class="sub">${consent("trips")} of ${pupils.length} pupils</div></div>
      <div class="card stat"><div class="label">Records to complete</div><div class="value ${missingMedical ? "t-warn" : "t-good"}">${missingMedical}</div><div class="sub">Missing a doctor or clinic</div></div>
    </div>
    <div class="grid side">
      <div class="card">
        <div class="card-head"><div><h3>Audit log</h3><div class="tiny muted">Every permission change, amended register, admission decision and payment, with who and when.</div></div>
        <button class="btn ghost sm" data-action="audit-export">${icon("download")} CSV</button></div>
        <div class="card-body tight table-wrap"><table>
          <thead><tr><th style="width:150px">When</th><th style="width:170px">Who</th><th>What</th></tr></thead>
          <tbody>${log.slice(0, 120).map(a => `<tr><td class="tiny muted nowrap">${Fmt.dateTime(a.at)}</td><td class="small">${a.by ? Store.staffName(a.by) : "System"}</td><td class="small">${esc(a.action)}</td></tr>`).join("") || `<tr><td colspan="3" class="empty">Nothing logged yet.</td></tr>`}</tbody>
        </table></div>
      </div>
      <div class="stack" style="gap:18px">
        <div class="card"><div class="card-head"><h3>Inspection pack</h3></div><div class="card-body small">
          <p class="muted">A year's worth of data in one download, in the shape an inspector asks for.</p>
          <div class="stack mt-16" style="gap:8px">
            <button class="btn ghost sm" data-action="pack-export" data-kind="attendance">${icon("download")} Attendance register — full term</button>
            <button class="btn ghost sm" data-action="pack-export" data-kind="roll">${icon("download")} Admission & withdrawal roll</button>
            <button class="btn ghost sm" data-action="pack-export" data-kind="staff">${icon("download")} Staff list with start dates</button>
            <button class="btn ghost sm" data-action="pack-export" data-kind="welfare">${icon("download")} Welfare & incident log</button>
            <button class="btn ghost sm" data-action="pack-export" data-kind="consent">${icon("download")} Consent register</button>
          </div>
        </div></div>
        <div class="card"><div class="card-head"><h3>Data retention</h3></div><div class="card-body small">
          <dl class="kv"><dt>Pupil records</dt><dd>Held while on roll, then 7 years</dd><dt>Attendance</dt><dd>7 years from the end of the academic year</dd><dt>Welfare & safeguarding</dt><dd>Until the pupil's 25th birthday</dd><dt>Fee records</dt><dd>6 years for audit</dd><dt>Applicants not enrolled</dt><dd>12 months, then deleted</dd></dl>
        </div></div>
      </div>
    </div>`;
  },
});

/* ==========================================================================
   THE SINGLE PUPIL RECORD
   Replaces the simpler profile in app.js: personal details, academic profile,
   attendance, fees, guardian communication and the full timeline in one place.
   ========================================================================== */
Object.assign(App, {
  pupilProfile(id, tab) {
    const p = Store.pupil(id); if (!p) return;
    if (!this.myClasses().some(c => c.id === p.classId)) { this.toast("This pupil is outside your class scope.", "err"); return; }
    this.ui.record = this.ui.record || {};
    if (tab) this.ui.record[id] = tab;
    const active = this.ui.record[id] || "overview";
    const cls = Store.cls(p.classId);
    const att = this.termStats([p.id]);
    const acc = this.can("billing.view") ? Store.account(p.id) : null;
    const overall = this.can("gradebook.view") ? this.overallPct(p.id) : null;
    const med = this.can("pupils.view_medical");

    const tabs = [
      ["overview", "Overview", true],
      ["academic", "Academic", this.can("gradebook.view")],
      ["attendance", "Attendance", this.can("attendance.view")],
      ["fees", "Fees", this.can("billing.view")],
      ["comms", "Communication", this.can("comms.view")],
      ["timeline", "Timeline", true],
    ].filter(t => t[2]);

    const panes = {
      overview: () => `
        <div class="grid cols-2">
          <div><div class="eyebrow mb-8">Guardian</div><dl class="kv">
            <dt>Name</dt><dd>${esc(p.guardian.name)} (${esc(p.guardian.relationship)})</dd>
            <dt>Phone</dt><dd>${esc(p.guardian.phone)}</dd>
            <dt>Email</dt><dd>${esc(p.guardian.email || "—")}</dd>
            <dt>Address</dt><dd>${esc(p.address || "—")}</dd>
            <dt>Emergency</dt><dd>${esc(p.emergency.name || "—")}${p.emergency.phone ? ` · ${esc(p.emergency.phone)}` : ""}</dd>
          </dl></div>
          <div><div class="eyebrow mb-8">Medical & welfare</div>${med
            ? `<dl class="kv"><dt>Allergies</dt><dd>${p.medical.allergies ? `<span class="pill red">${esc(p.medical.allergies)}</span>` : "None recorded"}</dd><dt>Conditions</dt><dd>${esc(p.medical.conditions || "None recorded")}</dd><dt>Doctor</dt><dd>${esc(p.medical.doctor || "—")}</dd></dl>`
            : `<div class="notice info small">${icon("lock")} Medical details are restricted. Ask the class teacher or Head Teacher.</div>`}</div>
        </div>
        <div class="grid cols-2 mt-24">
          <div><div class="eyebrow mb-8">Admission</div><dl class="kv">
            <dt>Admission no.</dt><dd>${esc(p.admissionNo)}</dd>
            <dt>Date of birth</dt><dd>${Fmt.date(p.dob)} (${Fmt.age(p.dob)})</dd>
            <dt>Enrolled</dt><dd>${Fmt.date(p.enrolled)}</dd>
            <dt>Heard about us via</dt><dd>${esc(p.source || "—")}</dd>
            <dt>Status</dt><dd><span class="pill ${p.status === "active" ? "green" : "grey"}">${p.status === "active" ? "On roll" : "Withdrawn"}</span></dd>
          </dl></div>
          <div><div class="eyebrow mb-8">Consents</div><div class="stack" style="gap:6px">
            ${[["photo", "Photographs and school publicity"], ["trips", "Local trips and outings"], ["data", "Data processing & school records"]].map(([k, l]) => `<div class="flex"><span class="pill ${p.consents && p.consents[k] ? "green" : "red"} tiny">${p.consents && p.consents[k] ? "Given" : "Not given"}</span><span class="small">${l}</span></div>`).join("")}
          </div><div class="help mt-8">Recorded from the signed consent form and checked before any photograph or outing.</div></div>
        </div>
        ${this.familyCardFor ? this.familyCardFor(p) : ""}
        ${p.notes ? `<div class="eyebrow mt-24 mb-8">Notes</div><p class="small">${esc(p.notes)}</p>` : ""}`,

      academic: () => { const subjects = Store.subjectsFor(cls.id); return `
        <div class="flex between wrap mb-16"><div class="eyebrow">Term to date — ${esc(Store.db.school.term.name)}</div><div class="flex">${this.gradePill(overall)}${this.can("gradebook.publish") ? `<button class="btn xs ghost" data-action="gb-report" data-id="${p.id}">${icon("print")} Report card</button>` : ""}</div></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Subject</th><th>Assessments</th><th class="right">Mark</th><th class="right">Standard</th></tr></thead>
          <tbody>${subjects.map(sj => { const v = Store.subjectPct(p.id, sj); const list = Store.assessmentsFor(cls.id, sj).filter(a => a.marks[p.id] !== undefined);
            return `<tr><td class="bold">${esc(sj)}</td>
              <td>${list.map(a => `<span class="pill grey tiny" title="${esc(a.title)} · ${Fmt.date(a.date)}">${a.marks[p.id]}/${a.max}</span>`).join(" ") || `<span class="faint tiny">none yet</span>`}</td>
              <td class="right">${v === null ? "—" : v + "%"}</td><td class="right">${this.gradePill(v)}</td></tr>`; }).join("")}</tbody>
        </table></div>
        <div class="help mt-16">Marks are weighted: ${ASSESSMENT_KINDS.map(k => `${k.label} ${Math.round(k.weight * 100)}%`).join(", ")}.</div>`; },

      attendance: () => { const days = schoolDaysBetween(Store.db.school.term.start, Store.today());
        const absences = days.map(d => ({ d, r: Store.att(d, p.id) })).filter(x => x.r && x.r.status !== "P").reverse();
        return `
        <div class="grid cols-3 mb-16">
          <div class="card stat"><div class="label">This term</div><div class="value fig-sm ${att.pct >= 90 ? "t-good" : "t-bad"}">${att.pct}%</div><div class="sub">${att.present} of ${att.total} sessions</div></div>
          <div class="card stat"><div class="label">Absences</div><div class="value fig-sm">${absences.filter(x => x.r.status === "A").length}</div><div class="sub">unexplained or reported</div></div>
          <div class="card stat"><div class="label">Lates</div><div class="value fig-sm">${absences.filter(x => x.r.status === "L").length}</div><div class="sub">arrived after registration</div></div>
        </div>
        <div class="eyebrow mb-8">Morning registration — last 10 school days</div>
        <div class="heat mb-16">${days.slice(-10).map(d => { const r = Store.att(d, p.id); return `<span class="${r ? r.status : ""}" title="${Fmt.date(d, "weekday")}: ${r ? STATUS_LABEL[r.status] : "Not marked"}"></span>`; }).join("")}</div>
        ${absences.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Status</th><th>Note</th><th>Marked by</th></tr></thead><tbody>${absences.slice(0, 15).map(x => `<tr><td>${Fmt.date(x.d, "weekday")}</td><td><span class="pill ${STATUS_PILL[x.r.status]}">${STATUS_LABEL[x.r.status]}</span></td><td>${esc(x.r.note || "—")}</td><td class="muted small">${Store.staffName(x.r.markedBy, { short: true })}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted small">Full attendance so far this term.</p>`}`; },

      fees: () => acc ? `
        <div class="grid cols-3 mb-16">
          <div class="card stat"><div class="label">Billed</div><div class="value fig-sm">${Store.money(acc.total)}</div><div class="sub">${esc(acc.inv.term)}</div></div>
          <div class="card stat"><div class="label">Paid</div><div class="value fig-sm t-good">${Store.money(acc.paid)}</div><div class="sub">${Store.paymentsFor(p.id).length} payment(s)</div></div>
          <div class="card stat"><div class="label">Balance</div><div class="value fig-sm ${acc.balance > 0 ? "t-bad" : "t-good"}">${Store.money(acc.balance)}</div><div class="sub">${acc.overdue > 0 ? `${Store.money(acc.overdue)} overdue` : acc.next ? `next due ${Fmt.date(acc.next.due, "short")}` : "settled"}</div></div>
        </div>
        <div class="table-wrap"><table><thead><tr><th>Line</th><th class="right">Amount</th></tr></thead><tbody>
          ${acc.inv.items.map(it => `<tr><td>${esc(it.name)}</td><td class="right">${Store.money(it.amount)}</td></tr>`).join("")}
          ${acc.inv.discount ? `<tr><td class="t-good">${esc(acc.inv.discountReason)}</td><td class="right t-good">−${Store.money(acc.inv.discount)}</td></tr>` : ""}
          <tr><td class="bold">Total</td><td class="right bold">${Store.money(acc.total)}</td></tr>
        </tbody></table></div>
        <div class="flex mt-16">${this.can("billing.manage") ? `<button class="btn sm" data-action="pay-new" data-pupil="${p.id}">${icon("plus")} Record payment</button>` : ""}<button class="btn ghost sm" data-action="bill-open" data-id="${p.id}">Full account</button></div>`
        : `<div class="notice info">${icon("lock")} Fee accounts are restricted.</div>`,

      comms: () => { const list = Store.commsFor(p.id); return `
        <div class="flex between mb-16"><div class="eyebrow">Between the school and ${esc(p.guardian.name)}</div>${this.can("comms.send") ? `<button class="btn xs" data-action="comms-new" data-pupil="${p.id}">${icon("send")} New message</button>` : ""}</div>
        ${this.threads(list).map(t => this.threadRow(t)).join("") || `<div class="empty">Nothing has been sent to this guardian yet.</div>`}`; },

      timeline: () => { const items = [
          ...(p.timeline || []).map(t => ({ date: t.date, kind: t.kind, text: t.text })),
          ...Store.paymentsFor(p.id).map(x => ({ date: x.date, kind: "fees", text: `${Store.money(x.amount)} received — ${x.method}` })),
          ...Store.commsFor(p.id).map(c => ({ date: c.sentAt.slice(0, 10), kind: "comms", text: `${c.channel.toUpperCase()} to guardian — ${c.subject || c.body.slice(0, 48) + "…"}` })),
          ...(this.can("welfare.view") ? Store.db.welfare.filter(w => w.pupilId === p.id).map(w => ({ date: w.date, kind: "welfare", text: `${w.type} — ${w.summary}` })) : []),
          ...Store.assessmentsFor(p.classId).filter(a => a.marks[p.id] !== undefined).map(a => ({ date: a.date, kind: "academic", text: `${a.subject}: ${a.marks[p.id]}/${a.max}` })),
        ].sort((a, b) => b.date.localeCompare(a.date));
        const col = { admission: "gold", fees: "green", comms: "blue", welfare: "red", academic: "navy" };
        return `<div class="eyebrow mb-8">Everything on this record, newest first</div>
          <ul class="timeline full">${items.map(i => `<li><span class="t">${Fmt.date(i.date, "short")}</span><span class="pill ${col[i.kind] || "grey"} tiny">${i.kind}</span><span>${esc(i.text)}</span></li>`).join("") || `<li class="muted">Nothing recorded yet.</li>`}</ul>`; },
    };

    const body = `
      <div class="flex mb-16"><span class="avatar lg">${p.first[0]}${p.last[0]}</span>
        <div><h2>${esc(p.first)} ${esc(p.last)}</h2><div class="muted">${esc(cls.name)} · ${esc(p.admissionNo)} · ${p.gender === "F" ? "Girl" : "Boy"} · ${Fmt.age(p.dob)}</div></div>
        <div class="grow"></div>
        <div class="flex" style="gap:6px">
          <span class="pill ${att.pct >= 90 ? "green" : "red"}">${att.pct}% attendance</span>
          ${this.can("gradebook.view") ? this.gradePill(overall) : ""}
          ${acc ? this.accountPill(acc) : ""}
        </div></div>
      <div class="tabs mb-16">${tabs.map(([id, label]) => `<button type="button" class="tab ${active === id ? "on" : ""}" data-action="record-tab" data-id="${p.id}" data-tab="${id}">${label}</button>`).join("")}</div>
      ${panes[active]()}`;
    const foot = `${this.can("pupils.add") ? `<button class="btn ghost danger" data-action="pupil-withdraw" data-id="${p.id}">Withdraw</button>` : ""}
      <div class="grow"></div>
      ${this.can("welfare.log") ? `<button class="btn ghost" data-action="welfare-new" data-pupil="${p.id}">Log incident</button>` : ""}
      ${this.can("pupils.edit") ? `<button class="btn" data-action="pupil-edit" data-id="${p.id}">${icon("edit")} Edit details</button>` : ""}`;
    this.modal({ title: "Pupil record", body, foot, wide: true });
  },
});

/* ==========================================================================
   EVENT HANDLING for the modules above (hooked from app.js)
   ========================================================================== */
Object.assign(App, {
  sisActions(d, el, e) {
    return {
      /* --- admissions --- */
      "applicant-open": () => this.applicantModal(d.id),
      "applicant-new": () => this.applicantForm(null),
      "applicant-edit": () => this.applicantForm(d.id),
      "applicant-stage": () => this.applicantStage(d.id, d.stage),
      "applicant-enrol": () => this.applicantEnrol(d.id),
      /* --- gradebook --- */
      "gb-open": () => this.assessmentModal(d.id),
      "gb-new": () => this.assessmentForm(),
      "gb-reports": () => this.reportCardPicker(),
      "gb-report": () => this.reportCard(d.id),
      "gb-delete": () => {
        const a = Store.assessment(d.id); if (!a) return;
        const marks = Object.keys(a.marks || {}).length;
        this.closeModal();
        this.undoable(`"${a.title}" deleted${marks ? `, with ${marks} mark${marks === 1 ? "" : "s"}` : ""}.`, {
          audit: `Deleted assessment "${a.title}" (${Store.cls(a.classId).name})`,
          snapshot: () => { const at = Store.db.assessments.indexOf(a); Store.db.assessments.splice(at, 1); return at; },
          restore: (at) => Store.db.assessments.splice(at, 0, a),
        });
      },
      /* --- billing --- */
      "bill-open": () => this.accountModal(d.id),
      "pay-new": () => this.paymentForm(d.pupil || null),
      "bill-export": () => this.exportAccounts(),
      "bill-chase": () => this.chaseArrears(),
      /* --- communication --- */
      "comms-new": () => {
        if (d.applicant) { const a = Store.applicant(d.applicant); return this.applicantMessage(a); }
        this.commsForm({ pupilId: d.pupil || "", templateId: d.template || "" });
      },
      "family-reply": () => {
        /* Opening it is what tells the family it was read, so do that first. */
        if (this.openFamilyMessage) this.openFamilyMessage(d.id, { silent: true });
        this.commsForm({ replyTo: d.id });
      },
      "thread-toggle": () => {
        this.ui.comms.open = this.ui.comms.open === d.key ? null : d.key;
        this.render();
      },
      /* --- leavers --- */
      "alumni-new": () => this.alumniForm(),
      /* --- configuration --- */
      "config-tab": () => { this.ui.config.tab = d.id; this.render(); },
      "intake-new": () => this.intakeForm(null),
      "intake-edit": () => this.intakeForm(d.id),
      "fee-new": () => this.feeForm(null),
      "fee-edit": () => this.feeForm(d.id),
      /* --- integrations --- */
      "integration-toggle": () => {
        const i = Store.db.integrations.find(x => x.id === d.id);
        i.status = i.status === "connected" ? "available" : "connected";
        Store.audit(`${i.status === "connected" ? "Connected" : "Disconnected"} integration: ${i.name}`);
        Store.save(); this.toast(`${i.name} ${i.status === "connected" ? "connected" : "disconnected"}.`); this.render();
      },
      /* --- audit --- */
      "audit-export": () => this.downloadCSV(`audit_log_${Store.today()}.csv`, [["When", "Who", "Action"], ...Store.db.audit.map(a => [a.at, a.by ? Store.staffName(a.by) : "System", a.action])]),
      "pack-export": () => this.exportPack(d.kind),
      /* --- pupil record --- */
      "record-tab": () => this.pupilProfile(d.id, d.tab),
    };
  },

  sisChange(k, v, el) {
    const R = () => this.render();
    if (k === "adm-intake") { this.ui.admissions.intakeId = v; R(); return true; }
    if (k === "gb-class") { this.ui.gradebook.classId = v; this.ui.gradebook.subject = null; R(); return true; }
    if (k === "gb-subject") { this.ui.gradebook.subject = v; R(); return true; }
    if (k === "bill-class") { this.ui.billing.classId = v; R(); return true; }
    if (k === "bill-filter") { this.ui.billing.filter = v; R(); return true; }
    if (k === "comms-scope") { this.ui.comms.scope = v; R(); return true; }
    if (k === "comms-target") { const form = el.closest("form"); form.querySelector('[name="pupilId"]').disabled = v !== "pupil"; form.querySelector('[name="classId"]').disabled = v !== "class"; return true; }
    return false;
  },

  sisInput(k, v, el, rerender) {
    if (k === "adm-q") { rerender(() => this.ui.admissions.q = v); return true; }
    if (k === "bill-q") { rerender(() => this.ui.billing.q = v); return true; }
    if (k === "comms-q") { rerender(() => this.ui.comms.q = v); return true; }
    return false;
  },

  sisSubmit(k, f, id, form, raw) {
    /* --- admissions --- */
    if (k === "applicant-docs") {
      const a = Store.applicant(id);
      REQUIRED_DOCS.forEach(d => a.docs[d.key] = !!f[d.key]);
      Store.audit(`Admissions: document checklist updated for ${a.first} ${a.last} (${this.docsCount(a)}/${REQUIRED_DOCS.length})`);
      Store.save(); this.toast("Checklist saved."); this.applicantModal(a.id); return true;
    }
    if (k === "applicant-save") {
      const data = {
        first: f.first.trim(), last: f.last.trim(), gender: f.gender, dob: f.dob, targetGrade: f.targetGrade,
        intakeId: f.intakeId, source: f.source, sibling: f.sibling === "yes",
        guardian: { name: f.gname.trim(), relationship: f.grel, phone: f.gphone.trim(), email: f.gemail.trim() },
        baseline: f.baseline.trim(), notes: f.notes.trim(),
      };
      if (id) { Object.assign(Store.applicant(id), data); Store.audit(`Admissions: updated ${data.first} ${data.last}`); }
      else {
        Store.db.applicants.push({ id: Store.uid("a"), stage: "enquiry", appliedOn: Store.today(), docs: { birth: false, clinic: false, photo: false, report: false, consent: false }, offerSentOn: "", offerExpires: "", ...data });
        Store.audit(`Admissions: new enquiry logged for ${data.first} ${data.last} (${data.targetGrade})`);
      }
      Store.save(); this.closeModal(); this.toast("Applicant saved."); this.render(); return true;
    }
    /* --- gradebook --- */
    if (k === "gb-save") {
      const ui = this.ui.gradebook;
      const a = { id: Store.uid("as"), classId: ui.classId, subject: f.subject, kind: f.kind, max: Number(f.max) || 20, date: f.date, title: f.title.trim(), by: this.me().id, marks: {}, published: false };
      Store.db.assessments.push(a);
      Store.audit(`Created assessment "${a.title}" for ${Store.cls(a.classId).name}`);
      Store.save(); this.closeModal(); this.toast("Assessment created — enter the marks now."); this.assessmentModal(a.id); return true;
    }
    if (k === "gb-marks") {
      const a = Store.assessment(id); let n = 0;
      Store.pupilsIn(a.classId).forEach(p => {
        const v = f[`m_${p.id}`];
        if (v === "" || v === undefined) { delete a.marks[p.id]; return; }
        const m = Math.max(0, Math.min(a.max, Number(v)));
        if (a.marks[p.id] !== m) n++;
        a.marks[p.id] = m;
      });
      Store.audit(`Recorded ${Object.keys(a.marks).length} mark(s) for "${a.title}" (${Store.cls(a.classId).name})`);
      Store.save(); this.closeModal(); this.toast(`Marks saved${n ? ` — ${n} changed` : ""}.`); this.render(); return true;
    }
    /* --- billing --- */
    if (k === "pay-save") {
      const amount = Math.round(Number(f.amount) * 100) / 100;
      if (!(amount > 0)) { this.toast("Enter an amount greater than zero.", "err"); return true; }
      const p = Store.pupil(f.pupilId);
      const inv = Store.invoice(f.pupilId);
      if (!inv) { this.toast("That pupil has no invoice for this term.", "err"); return true; }
      Store.db.payments.push({ id: Store.uid("pay"), invoiceId: inv.id, pupilId: p.id, date: f.date, amount, method: f.method, ref: f.ref.trim() || "—", by: this.me().id });
      Store.audit(`Payment of ${Store.money(amount)} recorded for ${p.first} ${p.last} (${f.method})`);
      Store.save(); this.closeModal(); this.toast(`${Store.money(amount)} recorded for ${p.first}.`); this.render(); return true;
    }
    /* --- communication --- */
    if (k === "comms-save") {
      const channel = f.channel; const bodyText = f.body.trim();
      if (!bodyText) { this.toast("The message is empty.", "err"); return true; }
      if (f.target === "applicant") {
        const a = Store.applicant(this._applicantComm); if (!a) { this.toast("Applicant not found.", "err"); return true; }
        const to = channel === "sms" ? a.guardian.phone : a.guardian.email;
        if (!to) { this.toast(`No ${channel === "sms" ? "phone number" : "email address"} on file for ${a.guardian.name}.`, "err"); return true; }
        this.logComm({ pupilId: null, classId: null, applicantId: a.id, channel, to, subject: channel === "email" ? f.subject.trim() : "", body: bodyText, recipients: 1 });
        Store.audit(`${channel.toUpperCase()} sent to ${a.guardian.name} about applicant ${a.first} ${a.last}`);
        this.toast(`Sent to ${a.guardian.name}.`);
        Store.save(); this.closeModal(); this.render(); return true;
      }
      if (f.target === "pupil") {
        const p = Store.pupil(f.pupilId);
        let to, recipients = 1;
        if (channel === "portal") {
          const accounts = (Store.db.guardians || []).filter(g => g.active && (g.pupilIds || []).includes(p.id));
          if (!accounts.length) { this.toast(`${p.first} ${p.last}'s family has no portal sign-in yet. Give them one from the pupil's record, or send by email or SMS.`, "err"); return true; }
          to = accounts.map(g => g.name).join(", "); recipients = accounts.length;
        } else {
          to = channel === "sms" ? p.guardian.phone : p.guardian.email;
          if (!to) { this.toast(`No ${channel === "sms" ? "phone number" : "email address"} on file for ${p.guardian.name}.`, "err"); return true; }
        }
        this.logComm({ pupilId: p.id, classId: p.classId, channel, to, subject: channel === "sms" ? "" : f.subject.trim(), body: bodyText, recipients,
          threadId: this._replyThread || null });
        Store.audit(`${channel.toUpperCase()} sent to ${p.guardian.name} about ${p.first} ${p.last}`);
        this.toast(`Sent to ${p.guardian.name}.`);
      } else if (f.target === "class") {
        const c = Store.cls(f.classId); const n = Store.pupilsIn(c.id).length;
        this.logComm({ pupilId: null, classId: c.id, channel, to: `${c.name} guardians`, subject: channel === "sms" ? "" : f.subject.trim(), body: bodyText, recipients: n });
        Store.audit(`${channel.toUpperCase()} sent to all ${n} ${c.name} guardians`);
        this.toast(`Sent to ${n} guardians.`);
      } else {
        const n = Store.db.pupils.filter(p => p.status === "active").length;
        this.logComm({ pupilId: null, classId: null, channel, to: "All guardians", subject: channel === "sms" ? "" : f.subject.trim(), body: bodyText, recipients: n });
        Store.audit(`${channel.toUpperCase()} sent to all ${n} guardians`);
        this.toast(`Sent to ${n} guardians.`);
      }
      Store.save(); this.closeModal(); this.render(); return true;
    }
    /* --- leavers --- */
    if (k === "alumni-save") {
      const p = Store.pupil(f.pupilId); const cls = Store.cls(p.classId);
      const years = Math.max(1, new Date(f.left).getFullYear() - new Date(p.enrolled).getFullYear() + 1);
      Store.db.alumni.push({ id: Store.uid("al"), first: p.first, last: p.last, admissionNo: p.admissionNo, left: f.left, lastClass: cls.name, destination: f.destination.trim(), years, guardian: p.guardian.name, contact: p.guardian.phone, note: f.note.trim() });
      p.status = "withdrawn"; p.stage = "alumni";
      (p.timeline = p.timeline || []).push({ date: f.left, kind: "admission", text: `Left for ${f.destination.trim()}` });
      Store.audit(`${p.first} ${p.last} moved to the alumni register (${f.destination.trim()})`);
      Store.save(); this.closeModal(); this.toast(`${p.first} is now on the alumni register.`); this.render(); return true;
    }
    /* --- configuration --- */
    if (k === "intake-save") {
      const places = {}; ["ECD A", "ECD B", "Grade 1", "Grade 2"].forEach(g => places[g] = Number(f[`pl_${g}`]) || 0);
      const data = { name: f.name.trim(), opens: f.opens, closes: f.closes, starts: f.starts, places, status: f.status };
      if (id) { Object.assign(Store.intake(id), data); Store.audit(`Configuration: intake "${data.name}" updated`); }
      else { Store.db.intakes.push({ id: Store.uid("i"), ...data }); Store.audit(`Configuration: intake "${data.name}" created`); }
      Store.save(); this.closeModal(); this.toast("Intake saved."); this.render(); return true;
    }
    if (k === "fee-save") {
      const grades = ["ECD A", "ECD B", "Grade 1", "Grade 2"].filter(g => f[`g_${g}`]);
      const data = { name: f.name.trim(), amount: Number(f.amount) || 0, compulsory: f.compulsory === "yes", grades };
      if (id) { Object.assign(Store.db.feeItems.find(x => x.id === id), data); Store.audit(`Configuration: fee item "${data.name}" updated to ${Store.money(data.amount)}`); }
      else { Store.db.feeItems.push({ id: Store.uid("f"), ...data }); Store.audit(`Configuration: fee item "${data.name}" added at ${Store.money(data.amount)}`); }
      Store.save(); this.closeModal(); this.toast("Fee item saved."); this.render(); return true;
    }
    if (k === "fee-rules") {
      Store.db.feeRules.siblingDiscount = (Number(f.sibling) || 0) / 100;
      Store.db.feeRules.earlySettlement = (Number(f.early) || 0) / 100;
      Store.db.feeRules.lateSurcharge = (Number(f.late) || 0) / 100;
      Store.db.feeRules.instalments = Math.max(1, Number(f.instalments) || 3);
      Store.audit("Configuration: fee rules updated"); Store.save(); this.toast("Fee rules saved."); this.render(); return true;
    }
    if (k === "grade-scale") {
      Store.db.gradeScale.forEach((g, i) => {
        g.label = (f[`label_${i}`] || g.label).trim();
        g.desc = (f[`desc_${i}`] || g.desc).trim();
        if (f[`min_${i}`] !== undefined) g.min = Math.max(0, Math.min(100, Number(f[`min_${i}`])));
      });
      Store.db.gradeScale.sort((a, b) => b.min - a.min);
      Store.audit("Configuration: grading scale updated"); Store.save(); this.toast("Grading scale saved."); this.render(); return true;
    }
    /* --- integrations --- */
    if (k === "drive-config") {
      Store.db.school.googleClientId = f.clientId.trim();
      Store.audit("Integrations: Google Drive client ID updated"); Store.save(); this.toast("Saved."); this.render(); return true;
    }
    return false;
  },

  /* --- small helpers used by the handlers --- */
  applicantMessage(a) {
    const body = `<form data-form="comms-save">
      <p class="small muted">To ${esc(a.guardian.name)} about ${esc(a.first)} ${esc(a.last)} (${esc(a.targetGrade)}).</p>
      <input type="hidden" name="target" value="applicant">
      <div class="grid cols-2 mt-16">
        <div><label class="field">Channel</label><select class="input" name="channel"><option value="email" ${a.guardian.email ? "selected" : ""}>Email</option><option value="sms">SMS</option></select></div>
        <div><label class="field">To</label><input class="input" value="${esc(a.guardian.email || a.guardian.phone)}" disabled></div>
      </div>
      <label class="field mt-16">Subject</label><input class="input" name="subject" value="Ayanda Infant School — ${esc(a.first)} ${esc(a.last)}">
      <label class="field mt-16">Message</label><textarea class="input" name="body" rows="8">Dear ${esc(a.guardian.name)},\n\n</textarea>
      <div class="modal-foot" style="padding:16px 0 0;border:0"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button class="btn" type="submit">${icon("send")} Send</button></div></form>`;
    this.modal({ title: "Message applicant's guardian", body, wide: true });
    this._applicantComm = a.id;
  },

  chaseArrears() {
    const rows = this.sisPupils().map(p => ({ p, a: Store.account(p.id) })).filter(x => x.a && x.a.status === "arrears");
    const withEmail = rows.filter(x => x.p.guardian.email);
    if (!rows.length) { this.toast("No account is in arrears."); return; }
    if (!confirm(`Send a fee reminder to ${rows.length} guardian${rows.length === 1 ? "" : "s"}? ${withEmail.length} by email, ${rows.length - withEmail.length} by SMS.`)) return;
    const t = Store.db.commTemplates.find(x => x.id === "ct3");
    rows.forEach(({ p, a }) => {
      const byEmail = !!p.guardian.email;
      this.logComm({
        pupilId: p.id, classId: p.classId, channel: byEmail ? "email" : "sms",
        to: byEmail ? p.guardian.email : p.guardian.phone,
        subject: byEmail ? this.fillTemplate(t.subject, p) : "",
        body: byEmail ? this.fillTemplate(t.body, p) : `Good day. The Term 3 account for ${p.first} shows ${Store.money(a.overdue)} overdue. Please contact the Bursar. — Ayanda Infant School`,
        recipients: 1, automatic: true,
      });
    });
    Store.audit(`Fee reminders sent to ${rows.length} guardian(s) in arrears`);
    Store.save(); this.toast(`Reminders sent to ${rows.length} guardian(s).`); this.render();
  },

  exportAccounts() {
    const rows = [["Admission No", "Surname", "First name", "Class", "Guardian", "Billed", "Paid", "Balance", "Overdue", "Status"]];
    this.sisPupils().forEach(p => { const a = Store.account(p.id); if (!a) return; rows.push([p.admissionNo, p.last, p.first, Store.cls(p.classId).name, p.guardian.name, a.total, a.paid, a.balance, a.overdue, a.status]); });
    this.downloadCSV(`fee_accounts_${Store.today()}.csv`, rows);
  },

  exportPack(kind) {
    const s = Store.db.school;
    if (kind === "attendance") {
      const days = schoolDaysBetween(s.term.start, Store.today());
      const rows = [["Admission No", "Surname", "First name", "Class", ...days]];
      Store.db.pupils.filter(p => p.status === "active").forEach(p => rows.push([p.admissionNo, p.last, p.first, Store.cls(p.classId).name, ...days.map(d => { const r = Store.att(d, p.id); return r ? r.status : ""; })]));
      return this.downloadCSV(`attendance_register_${s.term.name.replace(/\W+/g, "_")}.csv`, rows);
    }
    if (kind === "roll") {
      const rows = [["Admission No", "Surname", "First name", "Sex", "Date of birth", "Class", "Enrolled", "Status", "Guardian", "Phone"]];
      Store.db.pupils.forEach(p => rows.push([p.admissionNo, p.last, p.first, p.gender, p.dob, Store.cls(p.classId).name, p.enrolled, p.status, p.guardian.name, p.guardian.phone]));
      Store.db.alumni.forEach(a => rows.push([a.admissionNo, a.last, a.first, "", "", a.lastClass, "", `left ${a.left} → ${a.destination}`, a.guardian, a.contact]));
      return this.downloadCSV(`admission_withdrawal_roll_${Store.today()}.csv`, rows);
    }
    if (kind === "staff") {
      const rows = [["Name", "Role", "Email", "Phone", "Started", "Active"]];
      Store.db.staff.forEach(x => rows.push([`${x.title} ${x.first} ${x.last}`, ROLES[x.role].label, x.email, x.phone, x.started, x.active ? "Yes" : "No"]));
      return this.downloadCSV(`staff_list_${Store.today()}.csv`, rows);
    }
    if (kind === "welfare") {
      const rows = [["Date", "Time", "Class", "Type", "Severity", "Reported by", "Summary", "Actions", "Status"]];
      Store.db.welfare.forEach(w => rows.push([w.date, w.time, Store.cls(w.classId)?.name || "", w.type, w.severity, Store.staffName(w.reportedBy), w.summary, w.actions, w.status]));
      return this.downloadCSV(`welfare_log_${Store.today()}.csv`, rows);
    }
    if (kind === "consent") {
      const rows = [["Admission No", "Surname", "First name", "Class", "Photographs", "Trips", "Data processing"]];
      Store.db.pupils.filter(p => p.status === "active").forEach(p => rows.push([p.admissionNo, p.last, p.first, Store.cls(p.classId).name, p.consents?.photo ? "Yes" : "No", p.consents?.trips ? "Yes" : "No", p.consents?.data ? "Yes" : "No"]));
      return this.downloadCSV(`consent_register_${Store.today()}.csv`, rows);
    }
  },
});
