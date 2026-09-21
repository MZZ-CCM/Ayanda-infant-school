/* ==========================================================================
   Governance — the Director and Board Secretary's tier
   --------------------------------------------------------------------------
   The Head Teacher runs the school. These two answer for it: to the board, to
   the Ministry and to the bank. Board business, the statutory register,
   financial oversight and capital projects live here and nowhere else.
   ========================================================================== */

Object.assign(App, {

  /* ---------- helpers ---------- */
  isGovernance() { return isGovernance(this.me()); },
  statutoryDue() {
    if (!this.me() || !this.can("governance.statutory")) return 0;
    return (Store.db.statutory || []).filter(x => ["due", "expired"].includes(Store.statutoryState(x).key)).length;
  },
  /* Fees collected against what has actually fallen due — not against the whole
     term's billing, which always looks bad in week two. */
  collectionRate() {
    const accounts = Store.db.pupils.filter(p => p.status === "active").map(p => Store.account(p.id)).filter(Boolean);
    const due = accounts.reduce((n, a) => n + a.inv.instalments.filter(i => i.due <= Store.today()).reduce((m, i) => m + i.amount, 0), 0);
    const paid = accounts.reduce((n, a) => n + Math.min(a.paid, a.inv.instalments.filter(i => i.due <= Store.today()).reduce((m, i) => m + i.amount, 0)), 0);
    return { due, paid, pct: Fmt.pct(paid, due) };
  },
  budgetTotals() {
    const b = Store.db.budget || [];
    const sum = (kind, field) => b.filter(x => x.kind === kind).reduce((n, x) => n + x[field], 0);
    const income = { budget: sum("income", "budget"), actual: sum("income", "actual") };
    const cost = { budget: sum("cost", "budget"), actual: sum("cost", "actual") };
    return { income, cost, surplusBudget: income.budget - cost.budget, surplusActual: income.actual - cost.actual };
  },

  /* ======================================================================
     GOVERNANCE VIEW
     ====================================================================== */
  vGovernance() {
    this.ui.governance = this.ui.governance || { tab: "board" };
    const tab = this.ui.governance.tab;
    const manage = this.can("governance.manage");
    const tabs = [
      ["board", "Board & minutes", true],
      ["statutory", "Statutory register", this.can("governance.statutory")],
      ["finance", "Financial oversight", this.can("finance.oversight")],
      ["strategy", "Strategy & projects", this.can("strategy.manage")],
    ].filter(t => t[2]);
    if (!tabs.some(t => t[0] === tab)) this.ui.governance.tab = tabs[0][0];

    const pane = {
      board: () => {
        const meetings = (Store.db.board || []).slice().sort((a, b) => b.date.localeCompare(a.date));
        const next = meetings.filter(m => m.status === "scheduled" && m.date >= Store.today()).sort((a, b) => a.date.localeCompare(b.date))[0];
        const all = meetings.flatMap(m => m.resolutions.map(r => ({ ...r, date: m.date, meeting: m.id })));
        return `
        <div class="grid cols-4 mb-16">
          <div class="card stat accent"><div class="label">Meetings minuted</div><div class="value">${meetings.filter(m => m.status === "minuted").length}</div><div class="sub">This calendar year</div></div>
          <div class="card stat"><div class="label">Resolutions carried</div><div class="value">${all.filter(r => r.outcome === "carried").length}</div><div class="sub">${all.filter(r => r.outcome === "deferred").length} deferred</div></div>
          <div class="card stat"><div class="label">Next meeting</div><div class="value" style="font-size:22px">${next ? Fmt.date(next.date, "short") : "—"}</div><div class="sub">${next ? esc(next.type) + " · " + next.time : "Nothing in the diary"}</div></div>
          <div class="card stat"><div class="label">Board</div><div class="value">${new Set(meetings.flatMap(m => m.present)).size}</div><div class="sub">Members who have attended</div></div>
        </div>
        <div class="grid side">
          <div class="card">
            <div class="card-head"><div><h3>Board meetings</h3><div class="tiny muted">Minutes and resolutions. Visible to the Director and the Board Secretary only.</div></div>${manage ? `<button class="btn sm" data-action="board-new">${icon("plus")} Minute a meeting</button>` : ""}</div>
            <div class="card-body tight">${meetings.map(m => `<div class="comm">
              <div class="flex between wrap"><div class="flex" style="gap:8px">
                <span class="pill ${m.status === "minuted" ? "navy" : "gold"} tiny">${m.status === "minuted" ? "Minuted" : "Scheduled"}</span>
                <span class="bold small">${esc(m.type)} — ${Fmt.date(m.date, "long")}</span>
              </div><span class="tiny muted">${esc(m.time)} · chaired by ${Store.staffName(m.chair, { short: true })}${m.status === "minuted" ? ` · minuted by ${Store.staffName(m.minutedBy, { short: true })}` : ""}</span></div>
              <p class="small mt-8" style="margin:0">${esc(m.summary)}</p>
              ${m.present.length ? `<div class="tiny muted mt-8">Present: ${m.present.map(id => Store.staffName(id, { short: true })).join(", ")}${m.apologies.length ? ` · Apologies: ${m.apologies.map(id => Store.staffName(id, { short: true })).join(", ")}` : ""}</div>` : ""}
              ${m.resolutions.length ? `<div class="stack mt-8" style="gap:6px">${m.resolutions.map(r => `<div class="flex" style="gap:8px;align-items:flex-start">
                <span class="pill ${r.outcome === "carried" ? "green" : r.outcome === "deferred" ? "amber" : "red"} tiny" style="flex:none">${esc(r.outcome)}</span>
                <span class="small">${esc(r.text)}<br><span class="tiny muted">Proposed ${Store.staffName(r.proposedBy, { short: true })}, seconded ${Store.staffName(r.secondedBy, { short: true })}</span></span></div>`).join("")}</div>` : ""}
              ${manage && m.status === "scheduled" ? `<div class="mt-8"><button class="btn xs ghost" data-action="board-minute" data-id="${m.id}">${icon("edit")} Add the minutes</button></div>` : ""}
            </div>`).join("") || `<div class="empty">No board meetings recorded.</div>`}</div>
          </div>
          <div class="stack" style="gap:18px">
            <div class="card"><div class="card-head"><h3>Resolution register</h3><span class="tiny muted">newest first</span></div>
              <div class="card-body tight table-wrap"><table><tbody>${all.sort((a, b) => b.date.localeCompare(a.date)).map(r => `<tr><td class="tiny muted nowrap">${Fmt.date(r.date, "short")}</td><td class="small">${esc(r.text.length > 90 ? r.text.slice(0, 88) + "…" : r.text)}</td><td class="right"><span class="pill ${r.outcome === "carried" ? "green" : r.outcome === "deferred" ? "amber" : "red"} tiny">${esc(r.outcome)}</span></td></tr>`).join("")}</tbody></table></div>
              <div class="card-foot tiny muted">Every resolution the board has passed, in one place, for the minute book and for audit.</div></div>
            <div class="card"><div class="card-head"><h3>Standing items</h3></div><div class="card-body tight table-wrap"><table><tbody>
              <tr><td class="small">Head Teacher's report</td><td class="right tiny muted">every meeting</td></tr>
              <tr><td class="small">Management accounts</td><td class="right tiny muted">every meeting</td></tr>
              <tr><td class="small">Safeguarding & welfare</td><td class="right tiny muted">every meeting</td></tr>
              <tr><td class="small">Roll and admissions</td><td class="right tiny muted">every meeting</td></tr>
              <tr><td class="small">Statutory renewals</td><td class="right tiny muted">quarterly</td></tr>
              <tr><td class="small">Audited accounts</td><td class="right tiny muted">AGM</td></tr>
            </tbody></table></div></div>
          </div>
        </div>`;
      },

      statutory: () => {
        const list = (Store.db.statutory || []).map(x => ({ x, st: Store.statutoryState(x) }));
        const due = list.filter(l => l.st.key === "due").length;
        const expired = list.filter(l => l.st.key === "expired").length;
        return `
        <div class="grid cols-4 mb-16">
          <div class="card stat accent"><div class="label">Registrations held</div><div class="value">${list.length}</div><div class="sub">Ministry, council, revenue and insurers</div></div>
          <div class="card stat"><div class="label">Due for renewal</div><div class="value ${due ? "t-warn" : "t-good"}">${due}</div><div class="sub">Within 60 days</div></div>
          <div class="card stat"><div class="label">Expired</div><div class="value ${expired ? "t-bad" : "t-good"}">${expired}</div><div class="sub">Must be renewed immediately</div></div>
          <div class="card stat"><div class="label">Inspection ready</div><div class="value" style="font-size:22px">${expired ? "No" : "Yes"}</div><div class="sub">Every certificate produceable on the day</div></div>
        </div>
        <div class="card">
          <div class="card-head"><div><h3>Statutory register</h3><div class="tiny muted">What the school must hold to open its doors. The Board Secretary keeps it; the Director signs for it.</div></div>${manage ? `<button class="btn sm" data-action="statutory-new">${icon("plus")} Add a registration</button>` : ""}</div>
          <div class="card-body tight table-wrap"><table>
            <thead><tr><th>Registration</th><th>Reference</th><th>Authority</th><th>Issued</th><th>Expires</th><th>Status</th><th>Held by</th><th></th></tr></thead>
            <tbody>${list.sort((a, b) => (a.st.days ?? 99999) - (b.st.days ?? 99999)).map(({ x, st }) => `<tr>
              <td class="bold">${esc(x.name)}</td><td class="tiny muted">${esc(x.ref)}</td><td class="small">${esc(x.authority)}</td>
              <td class="small">${Fmt.date(x.issued, "short")}</td><td class="small">${x.expires ? Fmt.date(x.expires) : "—"}</td>
              <td><span class="pill ${st.colour}">${esc(st.label)}</span></td>
              <td class="small muted">${Store.staffName(x.owner, { short: true })}</td>
              <td class="right">${manage ? `<button class="btn xs ghost" data-action="statutory-edit" data-id="${x.id}">${icon("edit")}</button>` : ""}</td>
            </tr>`).join("")}</tbody>
          </table></div>
          <div class="card-foot flex between"><span class="tiny muted">Renewal reminders are the Board Secretary's standing item at every quarterly meeting.</span><button class="btn ghost sm" data-action="statutory-export">${icon("download")} CSV</button></div>
        </div>`;
      },

      finance: () => {
        const t = this.budgetTotals();
        const rows = Store.db.budget || [];
        const accounts = Store.db.pupils.filter(p => p.status === "active").map(p => Store.account(p.id)).filter(Boolean);
        const billed = accounts.reduce((n, a) => n + a.total, 0);
        const collected = accounts.reduce((n, a) => n + a.paid, 0);
        const arrears = accounts.reduce((n, a) => n + a.overdue, 0);
        const payroll = rows.find(r => r.id === "bu3");
        const staffCount = Store.db.staff.filter(x => x.active).length;
        const rollNow = Store.db.pupils.filter(p => p.status === "active").length;
        const bar = (actual, budget, invert) => { const pct = budget ? Math.round((actual / budget) * 100) : 0; const over = invert ? pct > 100 : pct < 80; return `<div class="bar"><span style="width:${Math.min(100, pct)}%;background:${over ? "var(--red)" : "var(--navy)"}"></span></div>`; };
        return `
        <div class="grid cols-4 mb-16">
          <div class="card stat accent"><div class="label">Income to date</div><div class="value">${Store.money(t.income.actual)}</div><div class="sub">${Fmt.pct(t.income.actual, t.income.budget)}% of the ${Store.money(t.income.budget)} budget</div></div>
          <div class="card stat"><div class="label">Costs to date</div><div class="value">${Store.money(t.cost.actual)}</div><div class="sub">${Fmt.pct(t.cost.actual, t.cost.budget)}% of the ${Store.money(t.cost.budget)} budget</div></div>
          <div class="card stat"><div class="label">Surplus to date</div><div class="value ${t.surplusActual >= 0 ? "t-good" : "t-bad"}">${Store.money(t.surplusActual)}</div><div class="sub">Full-year budget ${Store.money(t.surplusBudget)}</div></div>
          <div class="card stat"><div class="label">Payroll share of income</div><div class="value">${Fmt.pct(payroll ? payroll.actual : 0, t.income.actual)}%</div><div class="sub">${staffCount} staff · ${(rollNow / staffCount).toFixed(1)} pupils per member</div></div>
        </div>
        <div class="grid side">
          <div class="card">
            <div class="card-head"><div><h3>Budget against actual — 2026</h3><div class="tiny muted">Board view of the year. The Bursar works the invoices; this is what the board is shown.</div></div><span class="tiny muted">figures are placeholders for the board to confirm</span></div>
            <div class="card-body tight table-wrap"><table>
              <thead><tr><th>Line</th><th class="right">Full-year budget</th><th class="right">Actual to date</th><th style="width:22%"></th><th class="right">Variance</th></tr></thead>
              <tbody>
                ${["income", "cost"].map(kind => `
                  <tr><td colspan="5" class="eyebrow" style="padding-top:14px">${kind === "income" ? "Income" : "Costs"}</td></tr>
                  ${rows.filter(r => r.kind === kind).map(r => { const v = kind === "income" ? r.actual - r.budget : r.budget - r.actual; return `<tr>
                    <td class="bold">${esc(r.line)}</td><td class="right">${Store.money(r.budget)}</td><td class="right">${Store.money(r.actual)}</td>
                    <td>${bar(r.actual, r.budget, kind === "cost")}</td>
                    <td class="right ${v >= 0 ? "" : "bold"}" class="${v >= 0 ? "t-good" : "t-bad"}">${v >= 0 ? "+" : "−"}${Store.money(Math.abs(v))}</td></tr>`; }).join("")}
                  <tr><td class="bold">Total ${kind}</td><td class="right bold">${Store.money(t[kind].budget)}</td><td class="right bold">${Store.money(t[kind].actual)}</td><td></td><td></td></tr>`).join("")}
                <tr style="border-top:2px solid var(--navy)"><td class="bold">Surplus</td><td class="right bold">${Store.money(t.surplusBudget)}</td><td class="right bold ${t.surplusActual >= 0 ? "t-good" : "t-bad"}">${Store.money(t.surplusActual)}</td><td></td><td></td></tr>
              </tbody>
            </table></div>
            ${manage || this.can("finance.oversight") ? `<div class="card-foot flex between"><span class="tiny muted">Actuals are to date against the full-year budget — at ${Math.round((new Date(Store.today()) - new Date(Store.today().slice(0, 4) + "-01-01")) / 864e5 / 3.65)}% through 2026. Variance is shown in the school's favour.</span><div class="flex"><button class="btn ghost sm" data-action="budget-export">${icon("download")} CSV</button><button class="btn sm" data-action="budget-edit">${icon("edit")} Update actuals</button></div></div>` : ""}
          </div>
          <div class="stack" style="gap:18px">
            <div class="card"><div class="card-head"><h3>This term's fees</h3><a class="small" href="#/billing">Billing</a></div><div class="card-body tight table-wrap"><table><tbody>
              <tr><td class="small">Billed</td><td class="right bold">${Store.money(billed)}</td></tr>
              <tr><td class="small">Collected</td><td class="right bold t-good">${Store.money(collected)}</td></tr>
              <tr><td class="small">Overdue</td><td class="right bold ${arrears ? "t-bad" : "t-good"}">${Store.money(arrears)}</td></tr>
              <tr><td class="small">Collection rate</td><td class="right"><span class="pill ${this.collectionRate().pct >= Store.db.strategy.collectionTarget ? "green" : "amber"}">${this.collectionRate().pct}%</span></td></tr>
            </tbody></table></div><div class="card-foot tiny muted">Board target: ${Store.db.strategy.collectionTarget}% of what is due, collected in term.</div></div>
            <div class="card"><div class="card-head"><h3>Banking & signatories</h3></div><div class="card-body small">
              <dl class="kv"><dt>Operating account</dt><dd>As recorded with the bank</dd><dt>Signatories</dt><dd>Any two of: Director, Board Secretary, Bursar</dd><dt>Mobile money</dt><dd>Fees only</dd><dt>Auditors</dt><dd>Appointed by the Board</dd></dl>
              <div class="help mt-8">Recorded here so the board can see it. Account numbers are deliberately not held in the portal.</div>
            </div></div>
          </div>
        </div>`;
      },

      strategy: () => {
        const st = Store.db.strategy;
        const rollNow = Store.db.pupils.filter(p => p.status === "active").length;
        const projects = Store.db.projects || [];
        const committed = projects.filter(p => p.status !== "proposed").reduce((n, p) => n + p.budget, 0);
        const spent = projects.reduce((n, p) => n + p.spent, 0);
        const pupils = Store.db.pupils.filter(p => p.status === "active");
        const attendance = this.termStats(pupils.map(p => p.id));
        const collectionPct = this.collectionRate().pct;
        const kpi = (label, value, target, ok) => `<tr><td class="small bold">${label}</td><td class="right">${value}</td><td class="right tiny muted">target ${target}</td><td class="right"><span class="pill ${ok ? "green" : "amber"} tiny">${ok ? "On target" : "Below"}</span></td></tr>`;
        return `
        <div class="grid cols-4 mb-16">
          <div class="card stat accent"><div class="label">Roll today</div><div class="value">${rollNow}</div><div class="sub">Target ${st.rollTarget} by ${esc(st.targetYear)}</div></div>
          <div class="card stat"><div class="label">Toward target</div><div class="value">${Fmt.pct(rollNow, st.rollTarget)}%</div><div class="sub">${st.rollTarget - rollNow} places to fill</div></div>
          <div class="card stat"><div class="label">Capital committed</div><div class="value">${Store.money(committed)}</div><div class="sub">${Store.money(spent)} spent to date</div></div>
          <div class="card stat"><div class="label">Live projects</div><div class="value">${projects.filter(p => p.status === "in progress").length}</div><div class="sub">${projects.filter(p => p.status === "proposed").length} awaiting the board</div></div>
        </div>
        <div class="grid side">
          <div class="card">
            <div class="card-head"><div><h3>Capital projects</h3><div class="tiny muted">Everything the board has approved, is considering, or is paying for.</div></div>${this.can("strategy.manage") ? `<button class="btn sm" data-action="project-new">${icon("plus")} New project</button>` : ""}</div>
            <div class="card-body tight table-wrap"><table>
              <thead><tr><th>Project</th><th>Status</th><th class="right">Budget</th><th class="right">Spent</th><th style="width:16%"></th><th>Due</th><th>Owner</th><th></th></tr></thead>
              <tbody>${projects.map(p => { const pct = p.budget ? Math.round((p.spent / p.budget) * 100) : 0; return `<tr>
                <td><span class="bold">${esc(p.name)}</span>${p.note ? `<br><span class="tiny muted">${esc(p.note)}</span>` : ""}</td>
                <td><span class="pill ${p.status === "in progress" ? "blue" : p.status === "approved" ? "green" : p.status === "complete" ? "grey" : "gold"}">${esc(p.status)}</span></td>
                <td class="right">${Store.money(p.budget)}</td><td class="right">${Store.money(p.spent)}</td>
                <td><div class="bar"><span style="width:${Math.min(100, pct)}%;background:${pct > 100 ? "var(--red)" : "var(--navy)"}"></span></div></td>
                <td class="small">${Fmt.date(p.due, "short")}</td><td class="small muted">${Store.staffName(p.owner, { short: true })}</td>
                <td class="right">${this.can("strategy.manage") ? `<button class="btn xs ghost" data-action="project-edit" data-id="${p.id}">${icon("edit")}</button>` : ""}</td>
              </tr>`; }).join("")}</tbody>
            </table></div>
          </div>
          <div class="stack" style="gap:18px">
            <div class="card"><div class="card-head"><h3>Board KPIs</h3><span class="tiny muted">this term</span></div><div class="card-body tight table-wrap"><table><tbody>
              ${kpi("Attendance", attendance.pct + "%", st.attendanceTarget + "%", attendance.pct >= st.attendanceTarget)}
              ${kpi("Fee collection", collectionPct + "%", st.collectionTarget + "%", collectionPct >= st.collectionTarget)}
              ${kpi("Pupils per teacher", (rollNow / Store.db.staff.filter(x => x.active && ["teacher", "assistant"].includes(x.role)).length).toFixed(1), st.staffRatio, (rollNow / Store.db.staff.filter(x => x.active && ["teacher", "assistant"].includes(x.role)).length) <= st.staffRatio)}
              ${kpi("Roll", rollNow, st.rollTarget, rollNow >= st.rollTarget)}
            </tbody></table></div><div class="card-foot tiny muted">The four numbers reported to the board at every meeting.</div></div>
            <div class="card"><div class="card-head"><h3>Roll by year group</h3></div><div class="card-body tight table-wrap"><table><tbody>
              ${Store.db.classes.map(c => { const n = Store.pupilsIn(c.id).length; const cap = 20; return `<tr><td class="small bold">${esc(c.grade)}</td><td style="width:48%"><div class="bar"><span style="width:${Math.min(100, Fmt.pct(n, cap))}%;background:var(--navy)"></span></div></td><td class="right tiny bold">${n}/${cap}</td></tr>`; }).join("")}
            </tbody></table></div><div class="card-foot tiny muted">Capacity of 20 a class. The ECD C project would add a fifth room.</div></div>
          </div>
        </div>`;
      },
    };

    return `
    <div class="notice gold mb-16">${icon("shield")} <strong>Governance tier.</strong> This page is open to the School Director and the Board Secretary only — not to the Head Teacher or any other member of staff.</div>
    <div class="toolbar">
      <div class="flex" style="gap:4px">${tabs.map(([id, label]) => `<button class="btn ${this.ui.governance.tab === id ? "" : "ghost"} sm" data-action="gov-tab" data-id="${id}">${label}</button>`).join("")}</div>
      <div class="grow"></div>
      <button class="btn ghost sm" onclick="window.print()">${icon("print")} Print for the board</button>
    </div>
    ${pane[this.ui.governance.tab]()}`;
  },

  /* ======================================================================
     FORMS
     ====================================================================== */
  boardForm(id) {
    const m = id ? Store.meeting(id) : { date: Store.today(), time: "16:00", type: "Board meeting", chair: this.me().id, present: [], apologies: [], summary: "", resolutions: [], status: "minuted" };
    const staff = Store.db.staff.filter(x => x.active && ROLES[x.role].tier <= 6);
    const body = `<form data-form="board-save" data-id="${id || ""}">
      <div class="grid cols-3">
        <div><label class="field">Type</label><select class="input" name="type">${["Board meeting", "Annual general meeting", "Finance sub-committee", "Special meeting"].map(t => `<option ${t === m.type ? "selected" : ""}>${t}</option>`).join("")}</select></div>
        <div><label class="field">Date</label><input class="input" type="date" name="date" value="${m.date}" required></div>
        <div><label class="field">Time</label><input class="input" type="time" name="time" value="${m.time}"></div>
      </div>
      <div class="grid cols-2 mt-16">
        <div><label class="field">Chaired by</label><select class="input" name="chair">${staff.map(x => `<option value="${x.id}" ${x.id === m.chair ? "selected" : ""}>${esc(x.title)} ${esc(x.first)} ${esc(x.last)}</option>`).join("")}</select></div>
        <div><label class="field">Status</label><select class="input" name="status"><option value="minuted" ${m.status === "minuted" ? "selected" : ""}>Minuted</option><option value="scheduled" ${m.status === "scheduled" ? "selected" : ""}>Scheduled — minutes to follow</option></select></div>
      </div>
      <div class="eyebrow mt-24 mb-8">Present</div>
      <div class="grid cols-3">${staff.map(x => `<label class="check"><input type="checkbox" name="p_${x.id}" ${m.present.includes(x.id) ? "checked" : ""}> ${esc(x.first)} ${esc(x.last)}</label>`).join("")}</div>
      <div class="eyebrow mt-16 mb-8">Apologies</div>
      <div class="grid cols-3">${staff.map(x => `<label class="check"><input type="checkbox" name="a_${x.id}" ${m.apologies.includes(x.id) ? "checked" : ""}> ${esc(x.first)} ${esc(x.last)}</label>`).join("")}</div>
      <label class="field mt-16">Summary of business</label><textarea class="input" name="summary" rows="3">${esc(m.summary)}</textarea>
      <div class="eyebrow mt-24 mb-8">Resolutions</div>
      ${[0, 1, 2].map(i => { const r = m.resolutions[i] || { text: "", proposedBy: "", secondedBy: "", outcome: "carried" }; return `
        <div class="grid" style="grid-template-columns:1fr 150px 150px 120px;gap:8px;margin-bottom:8px">
          <input class="input" name="r${i}_text" value="${esc(r.text)}" placeholder="Resolution ${i + 1} — leave blank if not used">
          <select class="input" name="r${i}_prop"><option value="">Proposed by…</option>${staff.map(x => `<option value="${x.id}" ${x.id === r.proposedBy ? "selected" : ""}>${esc(x.last)}</option>`).join("")}</select>
          <select class="input" name="r${i}_sec"><option value="">Seconded by…</option>${staff.map(x => `<option value="${x.id}" ${x.id === r.secondedBy ? "selected" : ""}>${esc(x.last)}</option>`).join("")}</select>
          <select class="input" name="r${i}_out">${["carried", "deferred", "lost"].map(o => `<option ${o === r.outcome ? "selected" : ""}>${o}</option>`).join("")}</select>
        </div>`; }).join("")}
      <div class="help">Resolutions are written to the register the moment the minutes are saved, and cannot be edited away without an audit entry.</div>
      <div class="modal-foot" style="padding:16px 0 0;border:0"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button class="btn" type="submit">${id ? "Save minutes" : "Save meeting"}</button></div></form>`;
    this.modal({ title: id ? "Minutes" : "Minute a meeting", body, wide: true });
  },

  statutoryForm(id) {
    const x = id ? Store.db.statutory.find(y => y.id === id) : { name: "", ref: "", authority: "", issued: Store.today(), expires: "", owner: this.me().id };
    const gov = Store.db.staff.filter(s => isGovernance(s));
    const body = `<form data-form="statutory-save" data-id="${id || ""}">
      <label class="field">Registration, licence or certificate</label><input class="input" name="name" value="${esc(x.name)}" required>
      <div class="grid cols-2 mt-16">
        <div><label class="field">Reference number</label><input class="input" name="ref" value="${esc(x.ref)}"></div>
        <div><label class="field">Issuing authority</label><input class="input" name="authority" value="${esc(x.authority)}"></div>
        <div><label class="field">Issued</label><input class="input" type="date" name="issued" value="${x.issued}"></div>
        <div><label class="field">Expires <span class="tiny muted">(blank if it does not)</span></label><input class="input" type="date" name="expires" value="${x.expires}"></div>
      </div>
      <label class="field mt-16">Held by</label><select class="input" name="owner">${gov.map(s => `<option value="${s.id}" ${s.id === x.owner ? "selected" : ""}>${esc(s.title)} ${esc(s.first)} ${esc(s.last)} — ${ROLES[s.role].label}</option>`).join("")}</select>
      <div class="help">Anything expiring within 60 days is flagged on this page and at the next board meeting.</div>
      <div class="modal-foot" style="padding:16px 0 0;border:0">${id ? `<button type="button" class="btn ghost danger" data-action="statutory-delete" data-id="${id}">Remove</button>` : ""}<div class="grow"></div><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button class="btn" type="submit">Save</button></div></form>`;
    this.modal({ title: id ? "Edit registration" : "Add a registration", body });
  },

  budgetForm() {
    const rows = Store.db.budget || [];
    const body = `<form data-form="budget-save">
      <p class="small muted">2026 budget and the actual position to date. Figures are the board's, not the Bursar's ledger.</p>
      <div class="table-wrap mt-16"><table>
        <thead><tr><th>Line</th><th class="right" style="width:150px">Budget</th><th class="right" style="width:150px">Actual</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td class="bold">${esc(r.line)} <span class="pill ${r.kind === "income" ? "green" : "grey"} tiny">${r.kind}</span></td>
          <td class="right"><input class="input right" type="number" name="b_${r.id}" value="${r.budget}" step="100" style="width:120px;padding:5px 8px"></td>
          <td class="right"><input class="input right" type="number" name="a_${r.id}" value="${r.actual}" step="100" style="width:120px;padding:5px 8px"></td></tr>`).join("")}</tbody>
      </table></div>
      <div class="modal-foot" style="padding:16px 0 0;border:0"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button class="btn" type="submit">${icon("check")} Save</button></div></form>`;
    this.modal({ title: "Budget against actual", body, wide: true });
  },

  projectForm(id) {
    const p = id ? Store.db.projects.find(x => x.id === id) : { name: "", status: "proposed", budget: 0, spent: 0, due: "", owner: this.me().id, note: "" };
    const gov = Store.db.staff.filter(s => isGovernance(s));
    const body = `<form data-form="project-save" data-id="${id || ""}">
      <label class="field">Project</label><input class="input" name="name" value="${esc(p.name)}" required>
      <div class="grid cols-2 mt-16">
        <div><label class="field">Status</label><select class="input" name="status">${["proposed", "approved", "in progress", "complete"].map(x => `<option ${x === p.status ? "selected" : ""}>${x}</option>`).join("")}</select></div>
        <div><label class="field">Target date</label><input class="input" type="date" name="due" value="${p.due}"></div>
        <div><label class="field">Budget (USD)</label><input class="input" type="number" name="budget" value="${p.budget}" step="100" min="0"></div>
        <div><label class="field">Spent to date (USD)</label><input class="input" type="number" name="spent" value="${p.spent}" step="100" min="0"></div>
      </div>
      <label class="field mt-16">Owner</label><select class="input" name="owner">${gov.map(s => `<option value="${s.id}" ${s.id === p.owner ? "selected" : ""}>${esc(s.title)} ${esc(s.first)} ${esc(s.last)}</option>`).join("")}</select>
      <label class="field mt-16">Note for the board</label><textarea class="input" name="note" rows="2">${esc(p.note)}</textarea>
      <div class="modal-foot" style="padding:16px 0 0;border:0">${id ? `<button type="button" class="btn ghost danger" data-action="project-delete" data-id="${id}">Remove</button>` : ""}<div class="grow"></div><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button class="btn" type="submit">Save project</button></div></form>`;
    this.modal({ title: id ? "Edit project" : "New capital project", body });
  },

  /* ======================================================================
     HANDLERS (hooked from app.js alongside the SIS handlers)
     ====================================================================== */
  govActions(d) {
    return {
      "gov-tab": () => { this.ui.governance.tab = d.id; this.render(); },
      "board-new": () => this.boardForm(null),
      "board-minute": () => this.boardForm(d.id),
      "statutory-new": () => this.statutoryForm(null),
      "statutory-edit": () => this.statutoryForm(d.id),
      "statutory-delete": () => {
        const x = Store.db.statutory.find(y => y.id === d.id); if (!x) return;
        this.closeModal();
        this.undoable(`"${x.name}" removed from the statutory register.`, {
          audit: `Statutory register: removed "${x.name}"`,
          snapshot: () => { const at = Store.db.statutory.indexOf(x); Store.db.statutory.splice(at, 1); return at; },
          restore: (at) => Store.db.statutory.splice(at, 0, x),
        });
      },
      "statutory-export": () => this.downloadCSV(`statutory_register_${Store.today()}.csv`, [["Registration", "Reference", "Authority", "Issued", "Expires", "Status", "Held by"], ...Store.db.statutory.map(x => [x.name, x.ref, x.authority, x.issued, x.expires || "no expiry", Store.statutoryState(x).label, Store.staffName(x.owner)])]),
      "budget-edit": () => this.budgetForm(),
      "budget-export": () => { const t = this.budgetTotals(); this.downloadCSV(`budget_vs_actual_${Store.today()}.csv`, [["Line", "Type", "Budget", "Actual", "Variance"], ...Store.db.budget.map(r => [r.line, r.kind, r.budget, r.actual, r.kind === "income" ? r.actual - r.budget : r.budget - r.actual]), ["Surplus", "", t.surplusBudget, t.surplusActual, ""]]); },
      "project-new": () => this.projectForm(null),
      "project-edit": () => this.projectForm(d.id),
      "project-delete": () => {
        const p = Store.db.projects.find(x => x.id === d.id); if (!p) return;
        this.closeModal();
        this.undoable(`"${p.name}" removed.`, {
          audit: `Capital projects: removed "${p.name}"`,
          snapshot: () => { const at = Store.db.projects.indexOf(p); Store.db.projects.splice(at, 1); return at; },
          restore: (at) => Store.db.projects.splice(at, 0, p),
        });
      },
    };
  },

  govSubmit(k, f, id) {
    /* These forms only exist behind a sign-in; on the public page there is no
       database to read, so leave every other form alone. */
    if (!Store.db) return false;
    if (k === "board-save") {
      const staffIds = Store.db.staff.map(x => x.id);
      const resolutions = [0, 1, 2].map(i => ({ id: Store.uid("r"), text: (f[`r${i}_text`] || "").trim(), proposedBy: f[`r${i}_prop`] || "", secondedBy: f[`r${i}_sec`] || "", outcome: f[`r${i}_out`] })).filter(r => r.text);
      const data = {
        type: f.type, date: f.date, time: f.time, chair: f.chair, minutedBy: this.me().id, status: f.status,
        present: staffIds.filter(x => f[`p_${x}`]), apologies: staffIds.filter(x => f[`a_${x}`]),
        summary: f.summary.trim(), resolutions,
      };
      if (id) { const m = Store.meeting(id); Object.assign(m, data); Store.audit(`Board: minutes saved for the ${data.type.toLowerCase()} of ${Fmt.date(data.date)}; ${resolutions.length} resolution(s)`); }
      else { Store.db.board.push({ id: Store.uid("bm"), ...data }); Store.audit(`Board: ${data.type.toLowerCase()} of ${Fmt.date(data.date)} recorded; ${resolutions.length} resolution(s)`); }
      Store.save(); this.closeModal(); this.toast("Saved to the minute book."); this.render(); return true;
    }
    if (k === "statutory-save") {
      const data = { name: f.name.trim(), ref: f.ref.trim(), authority: f.authority.trim(), issued: f.issued, expires: f.expires || "", owner: f.owner };
      if (id) { Object.assign(Store.db.statutory.find(x => x.id === id), data); Store.audit(`Statutory register: "${data.name}" updated`); }
      else { Store.db.statutory.push({ id: Store.uid("st"), ...data }); Store.audit(`Statutory register: "${data.name}" added`); }
      Store.save(); this.closeModal(); this.toast("Register updated."); this.render(); return true;
    }
    if (k === "budget-save") {
      Store.db.budget.forEach(r => {
        if (f[`b_${r.id}`] !== undefined) r.budget = Number(f[`b_${r.id}`]) || 0;
        if (f[`a_${r.id}`] !== undefined) r.actual = Number(f[`a_${r.id}`]) || 0;
      });
      Store.audit("Financial oversight: 2026 budget and actuals updated");
      Store.save(); this.closeModal(); this.toast("Budget saved."); this.render(); return true;
    }
    if (k === "project-save") {
      const data = { name: f.name.trim(), status: f.status, budget: Number(f.budget) || 0, spent: Number(f.spent) || 0, due: f.due, owner: f.owner, note: f.note.trim() };
      if (id) { Object.assign(Store.db.projects.find(x => x.id === id), data); Store.audit(`Capital projects: "${data.name}" updated (${data.status})`); }
      else { Store.db.projects.push({ id: Store.uid("pj"), ...data }); Store.audit(`Capital projects: "${data.name}" added at ${Store.money(data.budget)}`); }
      Store.save(); this.closeModal(); this.toast("Project saved."); this.render(); return true;
    }
    return false;
  },
});
