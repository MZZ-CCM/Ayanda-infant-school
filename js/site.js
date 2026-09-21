/* ==========================================================================
   The public site
   --------------------------------------------------------------------------
   Until now everything a family could read was one page: thirteen sections,
   one after another, and a single enquiry form at the bottom of all of them.
   That page had to be a prospectus, a fee schedule, an admissions policy and
   a contact form at once, so each of those was a paragraph rather than an
   answer — and a parent who only wanted the fees had to scroll past the
   curriculum to find them.

   This file makes it a site. Each question a family arrives with gets its own
   address, so it can be linked to, sent to a husband, bookmarked, printed,
   and found again. The routes are:

     #/            the school, and the year your child would be in
     #/learning    what is taught, and when
     #/support     the two specialists, and what screening actually is
     #/fees        every figure, for every year, before anyone asks for it
     #/joining     how a place is offered, and the questions families ask
     #/visit       the one action the site is for
     #/about       who we are, and where

   One shell holds all of them, so the header, the drawer and the footer are
   written once and cannot drift apart. Nothing here is behind a sign-in; the
   two portal pages keep their own shell because they are a different
   audience with a different first question.
   ========================================================================== */

Object.assign(App, {

  /* The pages, in the order the header shows them. `visit` is deliberately
     absent: it is the action, and it lives in the button beside the nav
     rather than competing with the other links for the same attention. */
  PUBLIC_NAV: [
    /* An explicit way home. The crest in the middle of the bar is a link, but
       a wordmark is not a button and nobody should have to guess that it is
       one — particularly on a phone, where the crest is all that is left of
       it. `href` resolves to "#/", and the empty id matches the front page's
       own route, so it marks itself as the current page there. */
    { id: "",         label: "Home", short: "Home" },
    { id: "learning", label: "What they learn", short: "Learning" },
    { id: "support",  label: "Specialist support", short: "Support" },
    { id: "fees",     label: "Fees &amp; places", short: "Fees" },
    { id: "joining",  label: "Joining us", short: "Joining" },
    { id: "about",    label: "About", short: "About" },
  ],

  PUBLIC_PAGES: ["", "learning", "support", "fees", "joining", "visit", "about"],

  /* Which public page the address bar is asking for. Anything unrecognised —
     including a portal route left behind by signing out — is the school's
     front page, which is the right place for somebody who is lost. */
  publicRoute() {
    const raw = (location.hash || "").replace(/^#\/?/, "").split(/[/?#]/)[0].toLowerCase();
    return this.PUBLIC_PAGES.includes(raw) ? raw : "";
  },

  /* ------------------------------------------------------------------------
     Reaching the school without filling anything in
     ------------------------------------------------------------------------
     A telephone number printed as text is a telephone number a parent has to
     copy out by hand, and most of them are reading this on a phone. In this
     city WhatsApp is how people actually make first contact, so it is offered
     beside the call rather than buried — it is the lowest-commitment action
     the site has, and the one a hesitant family will take first.
     ------------------------------------------------------------------------ */
  /* ------------------------------------------------------------------------
     One place the public pages get the school's own figures
     ------------------------------------------------------------------------
     Three sources, in order of how current they are:

       Store.db      signed in — the live school, as the office sees it
       Store.facts   signed out — the slice the office publishes, fetched once
       the constant   neither has arrived yet, or the fetch failed

     The last is a starting position, not an answer, which is why it is last:
     a fee or an intake the office has since changed should never win over
     what the office is saying now.
     ------------------------------------------------------------------------ */
  pub(key, fallback) {
    if (Store.db && Store.db[key] != null) return Store.db[key];
    if (Store.facts && Store.facts[key] != null) return Store.facts[key];
    return fallback;
  },

  school() { return this.pub("school", SCHOOL); },
  telHref() { return `tel:${String(this.school().phone || "").replace(/[^\d+]/g, "")}`; },
  waHref(text) {
    const digits = String(this.school().phone || "").replace(/\D/g, "");
    if (!digits) return "";
    return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
  },
  waText() {
    const y = this.chosen();
    return y
      ? `Hello, I would like to ask about a place in ${y.grade} at Ayanda Infant School.`
      : `Hello, I would like to ask about a place at Ayanda Infant School.`;
  },

  /* ------------------------------------------------------------------------
     The shell
     ------------------------------------------------------------------------ */
  siteShell(route, inner) {
    const s = this.school();
    const rail = (route === "" || route === "fees") ? this.answerRail() : "";
    return `
    <div class="site ${route ? "site-page" : "site-home"}">
      ${this.siteHeader(route)}
      ${rail}
      ${this.siteDrawer(route)}
      <main id="content">${inner}</main>
      ${this.siteFooter()}
    </div>`;
  },

  siteHeader(route) {
    const s = this.school();
    return `
      <header class="site-bar">
        <a class="site-brand" href="#/">
          <img src="assets/logo.png" alt="">
          <span><span class="n">${esc(s.name)}</span><span class="t">${esc(s.tagline)}</span></span>
        </a>
        <nav class="site-nav" aria-label="The school">
          ${this.PUBLIC_NAV.map(n => `
            <a href="#/${n.id}" ${route === n.id ? 'aria-current="page" class="on"' : ""}
               ><span class="nav-long">${n.label}</span><span class="nav-short" aria-hidden="true">${n.short}</span></a>`).join("")}
        </nav>
        <div class="flex site-actions" style="gap:8px">
          <a class="btn sm magnetic" href="#/visit">Book a visit</a>
          <span class="site-sign">
            <a href="#/families" class="quiet-link">${icon("family")} Families</a>
            <a href="#/staff" class="quiet-link">${icon("key")} Staff</a>
          </span>
        </div>
        <button type="button" class="menu-btn" data-action="landing-menu" aria-label="Menu"><span></span><span></span><span></span></button>
      </header>`;
  },

  siteDrawer(route) {
    const s = this.school();
    return `
      <div class="site-drawer" data-action="landing-close-menu">
        <nav>
          ${this.PUBLIC_NAV.map(n => `<a href="#/${n.id}" ${route === n.id ? 'aria-current="page"' : ""}>${n.label}</a>`).join("")}
          <a class="strong" href="#/visit">Book a visit</a>
          <a href="${this.telHref()}">Telephone ${esc(s.phone)}</a>
          <a class="strong" href="#/families">Family portal</a>
          <a class="strong" href="#/staff">Staff portal</a>
        </nav>
      </div>`;
  },

  siteFooter() {
    const s = this.school();
    const day = PERIODS;
    return `
      <footer class="site-foot">
        <div class="wrap foot-grid">
          <div>
            <div class="flex" style="gap:12px"><img src="assets/logo.png" alt="" width="46" height="46">
              <div><div class="bold">${esc(s.name)}</div><div class="tiny">${esc(s.tagline)}</div></div></div>
            <p class="tiny mt-16">${esc(s.address)}</p>
            <p class="tiny mt-8"><a href="${this.telHref()}">${esc(s.phone)}</a> · <a href="mailto:${esc(s.email)}">${esc(s.email)}</a></p>
            <p class="tiny mt-8">Office open ${day[0].start} to 15:30, Monday to Friday.</p>
            ${s.regNo ? `<p class="tiny mt-8">Registered with the Ministry of Primary and Secondary Education, no. ${esc(s.regNo)}.</p>` : ""}
          </div>
          <div class="tiny foot-links">
            <div class="bold">The school</div>
            ${this.PUBLIC_NAV.map(n => `<a href="#/${n.id}">${n.label}</a>`).join("")}
            <a href="#/visit">Book a visit</a>
          </div>
          <div class="tiny foot-links">
            <div class="bold">Signing in</div>
            <a href="#/families">Family portal</a>
            <a href="#/staff">Staff portal</a>
          </div>
          <div class="tiny">
            <div class="bold">Your child's information</div>
            <p class="mt-8">Pupil records are confidential and held only as long as they are needed. Each member of staff sees only what their work requires, and every change is logged. Guardians may ask the office to see what we hold about their child at any time.</p>
          </div>
        </div>
      </footer>`;
  },

  /* ------------------------------------------------------------------------
     The head of an inside page
     ------------------------------------------------------------------------
     Every page that is not the front page opens the same way: where you are,
     what the page answers, and — because a parent reading the fees page has
     already decided the fees matter — the action, immediately, rather than
     eight screens further down.
     ------------------------------------------------------------------------ */
  pageHead(eyebrow, title, lead, action) {
    return `
      <section class="page-head">
        <div class="wrap">
          <div class="eyebrow lift">${eyebrow}</div>
          <h1 class="lift" style="--d:90ms">${this.splitWords(title)}</h1>
          <p class="page-lead lift" style="--d:240ms">${lead}</p>
          ${action === false ? "" : `
            <div class="page-act lift" style="--d:380ms">
              <a class="btn magnetic" href="#/visit">${action || "Book a visit"}</a>
              <a class="btn ghost magnetic" href="${this.telHref()}">${icon("phone")} Telephone the office</a>
            </div>`}
        </div>
      </section>`;
  },

  /* ------------------------------------------------------------------------
     The close of every page
     ------------------------------------------------------------------------
     The same offer, in the same words, at the foot of whichever page somebody
     happens to have read. The three lines under it are the school's real risk
     reversal and are worth more than any of the adjectives above them: a
     family sees the school, and the school sees the child, before a place is
     offered and before anything is paid. That is the order the admission
     stages are in — visit, then offer — so the page is describing the
     process, not making a promise on top of it.
     ------------------------------------------------------------------------ */
  ctaBand(opts = {}) {
    const s = this.school();
    const y = this.chosen();
    const wa = this.waHref(this.waText());
    return `
      <section class="band cta-band" id="next">
        <div class="wrap narrow">
          <div class="eyebrow center" data-reveal>Come and see</div>
          <h2 class="center" style="max-width:19ch;margin:12px auto 0" data-reveal>${esc(opts.title || "See an ordinary morning, not a performance")}</h2>
          <p class="center lead mt-24" style="max-width:60ch;margin-inline:auto" data-reveal>${esc(opts.lead ||
            "Come on a normal Tuesday and watch a register being taken. Nothing is decided from a form — we would rather meet you, and we would rather you met us before you decide anything.")}</p>

          <div class="cta-acts mt-24" data-reveal>
            <a class="btn lg magnetic" href="#/visit">${y ? `Ask about ${esc(y.grade)}` : "Book a visit"}</a>
            <a class="btn lg ghost magnetic" href="${this.telHref()}">Telephone ${esc(s.phone)}</a>
            ${wa ? `<a class="btn lg ghost magnetic" href="${wa}" target="_blank" rel="noopener">WhatsApp the office</a>` : ""}
          </div>

          <ul class="cta-assure" data-reveal>
            <li>${icon("check")}<span><strong>You see us before we decide anything.</strong> The settling-in visit and the baseline observation come <em>before</em> a place is offered, not after.</span></li>
            <li>${icon("check")}<span><strong>Nothing to pay to ask.</strong> The application fee falls due at the application step, and only if you choose to go ahead.</span></li>
            <li>${icon("check")}<span><strong>Every figure is already on this site.</strong> The fees are printed in full, for every year, before you enquire — not quoted afterwards.</span></li>
          </ul>
        </div>
      </section>`;
  },

  /* ========================================================================
     What they learn
     ======================================================================== */
  pageLearning() {
    const day = PERIODS;
    const scale = this.pub("gradeScale", GRADE_SCALE);
    const stages = [
      { name: "ECD A and ECD B", ages: "3 to 5 years old", subjects: ASSESSED.ecd,
        note: "Play-led, with structured time set aside every day for language, number and early writing. Story and rest end the day." },
      { name: "Grade 1 and Grade 2", ages: "5 to 8 years old", subjects: ASSESSED.grade,
        note: "Formal lessons across the national curriculum, with guided reading and library time each week." },
    ];
    return this.siteShell("learning", `
      ${this.pageHead("What they learn", "Everything on one timetable",
        "The national curriculum, taught by subject specialists rather than by one teacher covering everything — and alongside it, in the same ordinary week, the four things most schools sell after three o'clock.",
        "Come and watch a lesson")}

      <section class="band">
        <div class="wrap">
          <div class="offset-head" data-reveal>
            <div><div class="eyebrow">The two stages</div><h2 style="margin-top:14px">Three years old to eight</h2></div>
            <p class="muted lead">A child joining in ECD A stays with the same four teaching pairs for five years. The adult teaching your child to read in Grade 1 is the one who watched them learn their letters in ECD B.</p>
          </div>
          <div class="grid cols-2 mt-24">
            ${stages.map(st => `
              <div class="card stage-card" data-reveal>
                <div class="card-head"><div><h3>${esc(st.name)}</h3><div class="tiny muted">${esc(st.ages)}</div></div></div>
                <div class="card-body">
                  <div class="flex wrap" style="gap:6px">${st.subjects.map(sj => `<span class="pill ${SUBJECTS[sj] || "grey"}">${esc(sj)}</span>`).join("")}</div>
                  <p class="small muted mt-16">${esc(st.note)}</p>
                  <div class="stage-plus">
                    <span class="ans-plus-k">and on the same timetable</span>
                    <span class="flex wrap" style="gap:6px">${ENRICHMENT.map(e => `<span class="pill gold">${esc(e.name)}</span>`).join("")}</span>
                  </div>
                </div>
              </div>`).join("")}
          </div>
        </div>
      </section>

      ${this.enrichmentSection()}

      <section class="band" id="progress">
        <div class="wrap">
          <div class="offset-head" data-reveal>
            <div><div class="eyebrow">How progress is reported</div><h2 style="margin-top:14px">Described, never ranked</h2></div>
            <p class="muted lead">Every subject, every term, in words you can act on. A report that says your child is fourth in the class tells you about the other children. This one tells you about yours.</p>
          </div>
          <div class="card mt-24" data-reveal>
            <div class="card-body tight table-wrap"><table>
              <thead><tr><th style="width:150px">Standard</th><th>What it means</th></tr></thead>
              <tbody>${scale.map(g => `<tr><td><span class="pill ${g.colour}">${esc(g.label)}</span></td><td class="small muted">${esc(g.desc)}</td></tr>`).join("")}</tbody>
            </table></div>
            <div class="card-foot tiny muted">We do not publish positions in class. In the family portal you can open the grade and see every mark behind it — each piece of work, with its date.</div>
          </div>
        </div>
      </section>

      <section class="band alt" id="timetable">
        <div class="wrap">
          <div class="offset-head" data-reveal>
            <div><div class="eyebrow">The shape of the day</div><h2 style="margin-top:14px">${day[0].start} to ${day[day.length - 1].end}</h2></div>
            <p class="muted lead">Registration, ${day.filter(p => !p.kind).length} lessons, a morning break and lunch. A register is taken at the start of every single one of them, and it locks fifteen minutes later.</p>
          </div>
          <div class="card mt-24" data-reveal>
            <div class="card-body tight table-wrap"><table class="day-table">
              <thead><tr><th style="width:110px">Time</th><th>What is happening</th><th style="width:150px">Register</th></tr></thead>
              <tbody>${day.map((p, i) => `
                <tr class="${p.kind || "lesson"}">
                  <td class="mono small">${p.start}–${p.end}</td>
                  <td class="small"><strong>${esc(p.label)}</strong></td>
                  <td class="tiny muted">${p.kind === "break" ? "—" : (p.id === "reg" ? "Attendance of record" : "Taken by the teaching pair")}</td>
                </tr>`).join("")}</tbody>
            </table></div>
          </div>
          <p class="tiny muted mt-16" data-reveal>Children should arrive by ${day[0].start}. If a child is not where they should be at eleven o'clock, somebody knows at eleven o'clock — and so do you.</p>
        </div>
      </section>

      ${this.ctaBand({ title: "Watch a lesson, not a showcase",
        lead: "Ask to come mid-morning on an ordinary day. You will see a register being taken, two adults in the room, and Sign Language being used by children who are not deaf." })}
    `);
  },

  /* ========================================================================
     Specialist support
     ======================================================================== */
  pageSupport() {
    const inclusivity = this.copy.values.find(v => v.title === "Inclusivity");
    return this.siteShell("support", `
      ${this.pageHead("Specialist support", "Screened in the first term. All of them.",
        "Not only the children somebody has already worried about. Two specialists are on the staff, so what the screening finds is acted on by somebody who is already here — in the classroom your child is already in.",
        "Talk to us about your child")}

      ${this.supportSection()}

      <section class="band alt">
        <div class="wrap">
          <div class="offset-head" data-reveal>
            <div><div class="eyebrow">What happens</div><h2 style="margin-top:14px">From the screening to the ordinary Tuesday after it</h2></div>
            <p class="muted lead">Screening on its own changes nothing. What matters is what happens in the four weeks afterwards, and who it happens with.</p>
          </div>
          <ol class="steps-line mt-24">
            <li data-reveal><span class="n">1</span><div><strong>Standardised screening, first term</strong><p class="tiny muted">Every mainstream learner, led by the Learning Disabilities Specialist. Hearing screening and acoustic observation follow for any child flagged by it.</p></div></li>
            <li data-reveal><span class="n">2</span><div><strong>An Individualised Education Plan, if one is needed</strong><p class="tiny muted">Written by the specialist, not by a form. It says what this child needs, in this room, this term.</p></div></li>
            <li data-reveal><span class="n">3</span><div><strong>Weekly co-planning with the class teachers</strong><p class="tiny muted">The plan is built into the lessons the class is having anyway, which is why it survives past week three.</p></div></li>
            <li data-reveal><span class="n">4</span><div><strong>On the record, visible to you</strong><p class="tiny muted">Attendance, marks and welfare notes sit on one record. A subject slipping shows up in the same week, not in the end-of-term report.</p></div></li>
          </ol>
          <p class="tiny muted mt-24" data-reveal style="max-width:68ch">Screening identifies what a child needs support with. It is not a diagnosis, and we do not promise an outcome — what we commit to is that it happens early, that it happens for everyone, and that what it finds is acted on where your child already sits.</p>
        </div>
      </section>

      <section class="band ink">
        <div class="wrap narrow" data-reveal>
          <div class="eyebrow center">${esc(inclusivity ? inclusivity.title : "Inclusivity")}</div>
          <h2 class="center" style="max-width:22ch;margin:12px auto 0">${esc(inclusivity ? inclusivity.line : "Equal access and opportunity for every learner")}</h2>
          <p class="center lead mt-24" style="max-width:62ch;margin-inline:auto">${esc(inclusivity ? inclusivity.body : "")}</p>
          <p class="center small muted mt-24" style="max-width:62ch;margin-inline:auto">This is also why Sign Language is taught to every child in the school rather than to a few. A deaf child in a room where nobody signs is included on paper only.</p>
        </div>
      </section>

      ${this.ctaBand({ title: "Bring us what you already know",
        lead: "If your child has been assessed before, or if something has been worrying you and nobody has put a name to it, say so when you visit. It is far better to start there than to have us find it in term one." })}
    `);
  },

  /* ========================================================================
     Fees and places
     ------------------------------------------------------------------------
     Every figure for every year, on one page, before anybody asks for it. A
     fee schedule "available on request" is a fee schedule a parent assumes
     they cannot afford — and the request itself is a step most families will
     not take on a school they are still only curious about.
     ======================================================================== */
  pageFees() {
    const years = this.years();
    const rules = this.pub("feeRules", FEE_RULES);
    const intakes = this.pub("intakes", INTAKES);
    const optional = this.pub("feeItems", FEE_ITEMS).filter(f => !f.compulsory);
    /* Rows in the order the school keeps its fee items, not in the order the
       year groups happen to mention them — otherwise "Meals", which every year
       pays, landed between the two tuition lines because ECD comes first. */
    const items = this.pub("feeItems", FEE_ITEMS);
    const rows = items.filter(f => f.compulsory).map(f => f.name);

    const cell = (grade, name) => {
      const f = this.feesFor(grade).required.find(x => x.name === name);
      return f ? this.money(f.amount) : "—";
    };

    return this.siteShell("fees", `
      ${this.pageHead("Fees and places", "Every figure, before you ask",
        "A term, item by item, for each of the four years — and how many places are actually left in each. The daily meal is in the figure, not beside it. Nothing here is available on request, because a fee schedule you have to ask for is one a family assumes they cannot afford.",
        "Ask about a place")}

      <section class="band tight-band"><div class="wrap chooser-light">${this.chooserBlock("your-year")}</div></section>

      ${(() => {
        const y = this.chosen();
        if (!y) return "";
        const f = this.feesFor(y.grade);
        const place = this.intakeFor(y.grade);
        return `
        <section class="band" id="your-year">
          <div class="wrap">
            <div class="offset-head" data-reveal>
              <div><div class="eyebrow">Your answer</div><h2 style="margin-top:14px">${esc(y.name)}</h2></div>
              <p class="muted lead">${esc(y.agesLabel)}. ${place && place.places !== null
                ? (place.places === 0
                    ? `No places left for ${esc(place.intake.name)} — ask the office for the waiting list.`
                    : `${place.places} place${place.places === 1 ? "" : "s"} for <strong>${esc(place.intake.name)}</strong>, closing ${Fmt.date(place.intake.closes)}.`)
                : "Ask the office about the next intake."}</p>
            </div>
            <div class="grid cols-2 mt-24">
              <div class="ans ans-cost" data-reveal>
                <div class="ans-k">What a term costs</div>
                <div class="ans-fig">${this.money(f.total)}</div>
                <div class="ans-sub">per term, payable in ${f.instalments} instalments of ${this.money(f.perInstalment)}</div>
                <table class="ans-table mt-16"><tbody>
                  ${f.required.map(x => `<tr><td>${esc(x.name)}</td><td class="right">${this.money(x.amount)}</td></tr>`).join("")}
                  <tr class="tot"><td>Per term</td><td class="right">${this.money(f.total)}</td></tr>
                </tbody></table>
              </div>
              <div class="ans" data-reveal>
                <div class="ans-k">A year at this school</div>
                <div class="ans-fig">${this.money(f.total * 3)}</div>
                <div class="ans-sub">three terms, before any discount</div>
                <dl class="ans-dl">
                  <dt>With a second child here</dt><dd>${this.money((f.total - f.sibling) * 3)} a year</dd>
                  <dt>Each term settled early</dt><dd>saves ${this.money(Math.round(f.total * (f.rules.earlySettlement || 0)) * 3)} a year</dd>
                  <dt>Optional, on top</dt><dd>${f.optional.length ? f.optional.map(x => `${esc(x.name.replace(/\s*\(optional\)/, ""))} ${this.money(x.amount)}`).join(" · ") : "nothing"}</dd>
                </dl>
                <p class="tiny muted mt-16">Nothing else is invoiced. The daily meal, Sign Language, digital literacy, creative technology and heritage are all inside the figure above.</p>
              </div>
            </div>
          </div>
        </section>`;
      })()}

      <section class="band alt" id="table">
        <div class="wrap">
          <div class="offset-head" data-reveal>
            <div><div class="eyebrow">A term</div><h2 style="margin-top:14px">What it costs, all four years</h2></div>
            <p class="muted lead">Payable in ${rules.instalments} instalments a term, and this is the whole of it — the daily meal included, because a meal is not something we charge extra for. Transport is the one thing priced separately, below.</p>
          </div>
          <div class="card mt-24" data-reveal>
            <div class="card-body tight table-wrap"><table class="fee-table">
              <thead><tr><th>Per term</th>${years.map(y => `<th class="right">${esc(y.grade)}</th>`).join("")}</tr></thead>
              <tbody>
                ${rows.map(name => `<tr><td class="small">${esc(name)}</td>${years.map(y => `<td class="right small">${cell(y.grade, name)}</td>`).join("")}</tr>`).join("")}
                <tr class="tot"><td>Total per term</td>${years.map(y => `<td class="right">${this.money(this.feesFor(y.grade).total)}</td>`).join("")}</tr>
                <tr><td class="tiny muted">Each instalment (×${rules.instalments})</td>${years.map(y => `<td class="right tiny muted">${this.money(this.feesFor(y.grade).perInstalment)}</td>`).join("")}</tr>
              </tbody>
            </table></div>
          </div>

          <div class="grid cols-3 mt-24">
            <div class="card" data-reveal><div class="card-body">
              <div class="eyebrow">Second child</div><div class="ans-fig">${Math.round((rules.siblingDiscount || 0) * 100)}%</div>
              <p class="small muted">off the whole bill for a family with more than one child here, for as long as both are enrolled.</p></div></div>
            <div class="card" data-reveal><div class="card-body">
              <div class="eyebrow">Settled early</div><div class="ans-fig">${Math.round((rules.earlySettlement || 0) * 100)}%</div>
              <p class="small muted">off for a term paid in full before it starts, on top of any sibling discount.</p></div></div>
            <div class="card" data-reveal><div class="card-body">
              <div class="eyebrow">Paid late</div><div class="ans-fig">${Math.round((rules.lateSurcharge || 0) * 100)}%</div>
              <p class="small muted">added to an overdue instalment. If a term is going to be difficult, speak to the bursar before the due date rather than after it.</p></div></div>
          </div>

          <div class="card mt-24" data-reveal>
            <div class="card-head"><div><h3>The one thing that is optional</h3><div class="tiny muted">A family doing their own lift pays nothing for it</div></div></div>
            <div class="card-body tight table-wrap"><table><tbody>
              ${optional.map(f => `<tr><td class="small">${esc(f.name.replace(/\s*\(optional\)/, ""))}</td><td class="right small">${this.money(f.amount)} <span class="tiny muted">per term</span></td></tr>`).join("")}
            </tbody></table></div>
          </div>
        </div>
      </section>

      <section class="band" id="places">
        <div class="wrap">
          <div class="offset-head" data-reveal>
            <div><div class="eyebrow">Places</div><h2 style="margin-top:14px">How many are actually left</h2></div>
            <p class="muted lead">The real numbers, updated by the office as places go. When a year is full it says so here rather than in a letter three weeks after you applied.</p>
          </div>
          <div class="card mt-24" data-reveal>
            <div class="card-body tight table-wrap"><table>
              <thead><tr><th>Intake</th>${years.map(y => `<th class="right">${esc(y.grade)}</th>`).join("")}<th class="right" style="width:150px">Applications close</th></tr></thead>
              <tbody>${intakes.map(i => `
                <tr>
                  <td class="small"><strong>${esc(i.name)}</strong> <span class="pill ${i.status === "open" ? "green" : "grey"} tiny">${esc(i.status)}</span></td>
                  ${years.map(y => { const n = (i.places || {})[y.grade]; return `<td class="right small ${n === 0 ? "none" : ""}">${n === undefined || n === null ? "—" : n}</td>`; }).join("")}
                  <td class="right tiny muted">${Fmt.date(i.closes)}</td>
                </tr>`).join("")}</tbody>
            </table></div>
            <div class="card-foot tiny muted">A year showing nought is full for that intake. Ask the office to put you on the waiting list — places do come back when families move.</div>
          </div>
        </div>
      </section>

      ${this.ctaBand({ title: "The figures do not change when you telephone",
        lead: "What is printed above is what you will be invoiced. Come and see where your child is building — two adults in every lesson, a meal every day, and four things on the timetable that other schools charge extra for after three o'clock." })}
    `);
  },

  /* ========================================================================
     Joining us — and the questions families actually ask
     ======================================================================== */
  pageJoining() {
    const steps = ADMISSION_STAGES.filter(x => !["declined", "enrolled"].includes(x.id));
    const intake = (this.pub("intakes", INTAKES).find(i => i.status === "open")) || null;
    return this.siteShell("joining", `
      ${this.pageHead("Joining us", "The same steps, in the same order",
        "For every family, so you always know where you stand and what comes next. You will have seen the school, and we will have met your child, before a place is offered either way.",
        "Start with a visit")}

      ${intake ? `
      <section class="band tight-band">
        <div class="wrap">
          <div class="intake-strip" data-reveal>
            <span><b>${esc(intake.name)} intake</b><i>open now</i></span>
            <span><b>${Fmt.date(intake.closes)}</b><i>applications close</i></span>
            <span><b>${Fmt.date(intake.starts)}</b><i>term starts</i></span>
            <a class="btn sm magnetic" href="#/fees#places">See places left</a>
          </div>
        </div>
      </section>` : ""}

      <section class="band">
        <div class="wrap">
          <div class="offset-head" data-reveal>
            <div><div class="eyebrow">Six steps</div><h2 style="margin-top:14px">How a place is offered</h2></div>
            <p class="muted lead">Notice where the visit sits: before the offer. You are not asked to accept a school you have only read about, and we are not asked to offer a place to a child we have never met.</p>
          </div>
          <ol class="steps-line mt-24">
            ${steps.map((st, i) => `
              <li data-reveal><span class="n">${i + 1}</span><div><strong>${esc(st.label)}</strong><p class="tiny muted">${esc(st.desc)}</p></div></li>`).join("")}
          </ol>
          <div class="grid cols-2 mt-24">
            <div class="card" data-reveal><div class="card-head"><h3>What to bring</h3></div><div class="card-body">
              <ul class="ticks">${REQUIRED_DOCS.map(d => `<li>${icon("check")}${esc(d.label)}</li>`).join("")}</ul>
              <p class="tiny muted mt-16">Originals are seen at the visit and returned the same day; we keep copies only. Nothing is needed to enquire — this is for the application step.</p>
            </div></div>
            <div class="card" data-reveal><div class="card-head"><h3>What it costs to find out</h3></div><div class="card-body">
              <p class="small muted">Nothing. The enquiry is free, the visit is free, and the fees for every year are printed on this site in full before you ask for them.</p>
              <p class="small mt-16">The application fee falls due at step two, and only if you have seen the school and decided you would like to go ahead.</p>
              <a class="btn ghost sm mt-16" href="#/fees">See every figure</a>
            </div></div>
          </div>
        </div>
      </section>

      ${this.faqSection()}

      ${this.ctaBand()}
    `);
  },

  /* The questions, grouped as a family asks them: what it costs before what
     it teaches, because that is the order the worry arrives in. Written as
     <details> so the page is short enough to scan and every answer is still
     there for a reader who wants all of it — and still there for a search
     engine, which an accordion built out of JavaScript would not be. */
  faqSection() {
    return `
      <section class="band alt" id="questions">
        <div class="wrap">
          <div class="offset-head" data-reveal>
            <div><div class="eyebrow">Straight answers</div><h2 style="margin-top:14px">The questions families ask</h2></div>
            <p class="muted lead">Including the awkward ones. If yours is not here, telephone and ask it — you will get the same answer on the telephone as you would get here.</p>
          </div>
          ${SITE_FAQ.map(g => `
            <div class="faq-group" data-reveal>
              <h3 class="faq-group-h">${esc(g.group)}</h3>
              ${g.items.map(it => `
                <details class="faq">
                  <summary><span>${esc(it.q)}</span><i aria-hidden="true"></i></summary>
                  <div class="faq-a">${it.a}</div>
                </details>`).join("")}
            </div>`).join("")}
        </div>
      </section>`;
  },

  /* ========================================================================
     About
     ======================================================================== */
  pageAbout() {
    const s = this.school();
    const copy = this.copy;
    const day = PERIODS;
    return this.siteShell("about", `
      ${this.pageHead("About the school", "What we will not compromise on",
        esc(copy.intro), "Come and see for yourself")}

      <section class="band ink" id="values">
        <div class="wrap" data-reveal>
          <div class="eyebrow center">Our values</div>
          <h2 class="center" style="max-width:20ch;margin:10px auto 0">Four things, and what each one costs us</h2>
          <div class="grid cols-4 mt-24" style="margin-top:56px">
            ${copy.values.map((v, i) => `
              <div class="card pillar" data-reveal>
                <div class="eyebrow" style="margin-bottom:14px">${String(i + 1).padStart(2, "0")}</div>
                <h3>${esc(v.title)}</h3><p class="lead">${esc(v.line)}</p><p class="small muted">${esc(v.body)}</p></div>`).join("")}
          </div>
        </div>
      </section>

      <section class="band" id="working">
        <div class="wrap" data-reveal>
          <div class="eyebrow center">How we work</div>
          <h2 class="center" style="max-width:18ch;margin:10px auto 0">The arrangements you can check on any ordinary Tuesday</h2>
          <p class="center muted lead" style="max-width:660px;margin:10px auto 0">Not a philosophy. Six things that are either happening in the building or they are not — and you are welcome to come and find out which.</p>
          <div class="grid cols-2 mt-24 work-grid">
            ${copy.working.map(w => `
              <div class="work" data-reveal>
                <span class="work-ico">${icon(w.icon)}</span>
                <div><h3>${esc(w.title)}</h3><p class="small muted">${esc(w.body)}</p></div>
              </div>`).join("")}
          </div>
        </div>
      </section>

      <section class="band alt" id="find-us">
        <div class="wrap">
          <div class="offset-head" data-reveal>
            <div><div class="eyebrow">Find us</div><h2 style="margin-top:14px">Manningdale, Bulawayo</h2></div>
            <p class="muted lead">The office is open through the school day. You do not need an appointment to telephone, and you do not need to fill in anything to ask a question.</p>
          </div>
          <div class="grid cols-2 mt-24">
            <div class="card" data-reveal><div class="card-body">
              <div class="eyebrow">The school</div>
              <p class="lead mt-8">${esc(s.address)}</p>
              <ul class="contact-list mt-16">
                <li>${icon("clock")}<span>Office ${day[0].start} to 15:30, Monday to Friday</span></li>
                <li>${icon("phone")}<a href="${this.telHref()}">${esc(s.phone)}</a></li>
                <li>${icon("mail")}<a href="mailto:${esc(s.email)}">${esc(s.email)}</a></li>
              </ul>
              ${this.waHref(this.waText()) ? `<a class="btn ghost sm mt-16" href="${this.waHref(this.waText())}" target="_blank" rel="noopener">Message the office on WhatsApp</a>` : ""}
            </div></div>
            <div class="card" data-reveal><div class="card-body">
              <div class="eyebrow">The school day</div>
              <p class="lead mt-8">${day[0].start} to ${day[day.length - 1].end}</p>
              <p class="small muted mt-16">Children should arrive by ${day[0].start}; the register closes fifteen minutes later, and then again at the start of every lesson. ${day.filter(p => !p.kind).length} lessons, a morning break and lunch.</p>
              <a class="btn ghost sm mt-16" href="#/learning#timetable">See the full timetable</a>
            </div></div>
          </div>
        </div>
      </section>

      ${this.ctaBand()}
    `);
  },

  /* ========================================================================
     Book a visit
     ------------------------------------------------------------------------
     The one page the whole site is for, so it asks for as little as it can.
     The old form wanted twelve things including the child's date of birth and
     sex before the office had so much as telephoned — an application form
     wearing an enquiry form's label. What the office genuinely needs in order
     to ring back is a name, a year and one way of reaching you. Everything
     else has moved behind a disclosure for the families who would rather fill
     it in now, and is optional for everybody else.
     ======================================================================== */
  pageVisit() {
    const s = this.school();
    const ui = this.ui.login;
    const steps = ADMISSION_STAGES.filter(x => !["declined", "enrolled"].includes(x.id));
    const y = this.chosen();
    const wa = this.waHref(this.waText());
    const classes = (Store.db ? Store.db.classes : CLASSES);

    return this.siteShell("visit", `
      ${this.pageHead("Book a visit", "Come and see a morning",
        "Three things and we can telephone you: your child's year, your name, and one way of reaching you. Everything else can wait until we speak.",
        false)}

      <section class="band">
        <div class="wrap">
          <div class="grid visit-grid">
            <div class="card" data-reveal>
              <div class="card-body">
                ${ui.enquired
                  ? `<div class="notice ok">${icon("check")} <strong>Thank you.</strong> Your enquiry has reached the school office. Somebody will telephone you to arrange a time to visit. If it is urgent, please ring <a href="${this.telHref()}">${esc(s.phone)}</a>.</div>
                     <button class="btn ghost mt-16" data-action="landing-enquire-again">Send another enquiry</button>`
                  : this.enquiryForm(classes, y, ui)}
              </div>
            </div>

            <div class="visit-side">
              <div class="card" data-reveal>
                <div class="card-body">
                  <div class="eyebrow">Rather just talk?</div>
                  <p class="small muted mt-8">Perfectly reasonable. The office answers through the school day and you do not have to fill in anything first.</p>
                  <a class="btn mt-16" style="width:100%;justify-content:center" href="${this.telHref()}">Telephone ${esc(s.phone)}</a>
                  ${wa ? `<a class="btn ghost mt-8" style="width:100%;justify-content:center" href="${wa}" target="_blank" rel="noopener">WhatsApp the office</a>` : ""}
                  <p class="tiny muted mt-16">${PERIODS[0].start} to 15:30, Monday to Friday.</p>
                </div>
              </div>

              <div class="card" data-reveal>
                <div class="card-body">
                  <div class="eyebrow">What happens next</div>
                  <ol class="after-steps mt-16">
                    ${steps.slice(0, 4).map((st, i) => `<li><span class="n">${i + 1}</span><span><strong>${esc(st.label)}</strong> ${esc(st.desc)}</span></li>`).join("")}
                  </ol>
                  <ul class="after-assure">
                    <li>${icon("check")}<span>You see the school, and we see your child, <strong>before</strong> a place is offered.</span></li>
                    <li>${icon("check")}<span>Nothing to pay to enquire or to visit.</span></li>
                    <li>${icon("check")}<span>Your details are used to contact you about a place and for nothing else.</span></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      ${this.faqSection()}
    `);
  },

  enquiryForm(classes, y, ui) {
    return `
      <form data-form="enquiry">
        <div class="eyebrow">The three things we need</div>

        <label class="field mt-16">Which year are you asking about?</label>
        <select class="input" name="targetGrade">${classes.map(c => `<option ${y && y.grade === c.grade ? "selected" : ""}>${esc(c.grade)}</option>`).join("")}</select>

        <div class="grid cols-2 mt-16">
          <div><label class="field">Your name</label><input class="input" name="guardianName" autocomplete="name" required></div>
          <div><label class="field">Telephone or WhatsApp</label><input class="input" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+263 …"></div>
        </div>
        <div class="help mt-8">A telephone number is enough. Leave an email instead if you would rather we wrote.</div>

        <details class="more-fields mt-16">
          <summary><span>Tell us about your child now, if you would rather</span><i aria-hidden="true"></i></summary>
          <div class="more-body">
            <p class="tiny muted">All optional. It saves a question or two when we ring, and nothing here changes whether you are offered a place.</p>
            <div class="grid cols-2 mt-16">
              <div><label class="field">Child's first name</label><input class="input" name="childFirst"></div>
              <div><label class="field">Child's surname</label><input class="input" name="childLast"></div>
              <div><label class="field">Date of birth</label><input class="input" type="date" name="dob"></div>
              <div><label class="field">Girl or boy</label><select class="input" name="gender"><option value="">Rather not say</option><option value="F">Girl</option><option value="M">Boy</option></select></div>
              <div><label class="field">Your email address</label><input class="input" type="email" name="email" inputmode="email" autocomplete="email"></div>
              <div><label class="field">You are the child's</label><select class="input" name="relationship">${["Mother","Father","Grandmother","Grandfather","Aunt","Uncle","Guardian"].map(r => `<option>${r}</option>`).join("")}</select></div>
              <div><label class="field">Brother or sister already here</label><select class="input" name="sibling"><option value="">No</option><option value="yes">Yes</option></select></div>
            </div>
            <label class="field mt-16">Anything you would like us to know</label>
            <textarea class="input" name="message" rows="3" placeholder="When you would like to start, questions about the day, anything your child needs from us…"></textarea>
          </div>
        </details>

        <!-- The one question worth more than the rest of this form. Nobody
             here has exit surveys or analytics, so what stops a family
             enquiring is currently guesswork. Asking the people who *did*
             enquire what nearly stopped them is the cheapest honest way to
             find out, and it costs one optional field. -->
        <label class="field mt-16">Is there anything that would make you hesitate? <span class="opt">optional</span></label>
        <input class="input" name="hesitation" placeholder="Fees, the distance, the class size, anything at all — it helps us answer honestly.">

        ${ui.enquireError ? `<div class="notice err mt-16">${icon("alert")} ${esc(ui.enquireError)}</div>` : ""}
        <button class="btn lg mt-16" type="submit" style="width:100%;justify-content:center" ${ui.enquiring ? "disabled" : ""}>${ui.enquiring ? "Sending…" : "Ask the office to telephone me"}</button>
        <div class="help mt-8">Your details are used to contact you about a place and for nothing else. Nothing is decided from a form — we would rather meet you.</div>
      </form>`;
  },
});
