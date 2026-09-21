/* ==========================================================================
   The public page
   --------------------------------------------------------------------------
   What anyone sees before they sign in: what the portal is, what it looks
   like from the inside, who gets to see what, and the two ways in — sign in,
   or ask the school for an account.

   It replaces App.renderLogin(), so the whole site is still one index.html
   and one application; signing in swaps this page for the portal.
   ========================================================================== */

Object.assign(App, {


  /* ------------------------------------------------------------------------
     The school's own words. Everything a governor or head would want to change
     is here, in one place, so nobody has to go hunting through markup.
     ------------------------------------------------------------------------ */
  copy: {
    /* "We keep classes small" used to open this paragraph. It was the only
       sentence here that a parent could not check and the school could not
       evidence — no class size is recorded anywhere in the system — so it has
       gone. Everything left is something you could verify by standing in the
       building for a morning. */
    intro: "Ayanda Infant School is in Manningdale, Bulawayo, and takes children from three years old through to the end of Grade 2. Two adults teach every lesson. A register is taken at the start of each one. And the four things most schools sell after three o'clock — Sign Language, digital literacy, creative technology, and heritage and local languages — are on the ordinary timetable here, for every child, with no line for any of them on your invoice.",
    values: [
      { title: "Inclusivity", line: "Equal access and opportunity for every learner",
        body: "Every child is taught in the same room, by the same teachers, to the same expectations. Where a child needs something different to reach those expectations, they get it — not a lower standard, but a different route to the same one." },
      { title: "Heritage curriculum", line: "Enriched, culturally rooted learning from day one",
        body: "isiNdebele, Heritage and Social Studies and religious and moral education are timetabled, taught by specialists and assessed like any other subject. A child should not have to leave their language at the school gate." },
      { title: "Specialised support", line: "Early identification and targeted intervention",
        body: "Attendance, marks and welfare notes sit on one record for each child. A pattern — a run of absences, a subject slipping, a worry noted at break — is visible to the class teacher in the same week, not in the end-of-term report." },
      { title: "Innovation", line: "Technology and industrialisation in teaching and learning",
        body: "ICT is a taught subject from Grade 1, and the school runs on its own record system rather than on paper registers and filing cabinets, which is why we can answer a parent's question about their child in a minute rather than a week." },
    ],
    working: [
      { icon: "users", title: "Two adults in every lesson",
        body: "Each class is taught by a main teacher and an assistant teacher together — never one adult to a room. One leads, one works with the children who need a second explanation or a harder question." },
      { icon: "grid", title: "Subject specialists, not one teacher for everything",
        body: "Four teaching pairs cover the school between them: Language and Literacy, Numeracy and Science, Heritage and Languages, and Arts, PE and ICT. A class meets the same pair every time it has that subject, all year, so the adult teaching your child to read knows exactly where they are with it." },
      { icon: "check", title: "Registers taken every period",
        body: "Attendance is taken at the start of the day and again in every lesson, within fifteen minutes of the period beginning. If a child is not where they should be at eleven o'clock, somebody knows at eleven o'clock." },
      { icon: "send", title: "Parents told the same day",
        body: "An unexplained absence at morning registration sends a message to the guardian on file that morning. Fee accounts, progress and anything the school needs to raise come from the child's own record, so what you are told matches what we hold." },
      { icon: "award", title: "Progress described, not ranked",
        body: "Reports say whether a child is exceeding, secure, developing or beginning against the expected standard for their year. We do not publish positions in class. A seven-year-old is not competing with the child next to them." },
      { icon: "shield", title: "Records kept properly",
        body: "Each member of staff sees exactly what their work requires and no more — medical details, welfare notes and fee accounts are restricted. Every change to a record is logged with who made it and when." },
    ],
  },

  /* ========================================================================
     The question the site is built around
     ------------------------------------------------------------------------
     A parent does not arrive wanting a brochure. They arrive with one child,
     of one age, and three questions: is there a place, what would the day be,
     and what does it cost. The old page answered those in generic prose in
     the tenth section, and never gave a figure at all.

     So the page asks first. Choosing a year is the opening interaction, and
     everything below it then answers for that child. The choice is kept for
     the tab, shown back in a rail that follows you down, and reversible at
     any point.

     With JavaScript off nothing is chosen, and every section simply shows all
     four years — which is the page as it was.
     ======================================================================== */

  /* Ages are the school's own: ECD A takes threes, Grade 2 finishes at eight. */
  years() {
    const band = (g) => (g.startsWith("ECD") ? "ecd" : "grade");
    const ages = { "ECD A": [3, 4], "ECD B": [4, 5], "Grade 1": [5, 6], "Grade 2": [6, 8] };
    const classes = this.pub("classes", CLASSES);
    return classes.map(c => ({
      grade: c.grade, name: c.name, room: c.room, id: c.id,
      band: band(c.grade),
      ages: ages[c.grade] || [3, 8],
      agesLabel: ages[c.grade] ? `${ages[c.grade][0]} to ${ages[c.grade][1]} years old` : "",
    }));
  },

  chosen() {
    if (this.ui.chooser.grade) return this.years().find(y => y.grade === this.ui.chooser.grade) || null;
    try {
      const kept = sessionStorage.getItem("ayanda.year");
      if (kept) { this.ui.chooser.grade = kept; return this.years().find(y => y.grade === kept) || null; }
    } catch (_) {}
    return null;
  },

  choose(grade, scrollTo) {
    this.ui.chooser.grade = grade || null;
    try {
      if (grade) sessionStorage.setItem("ayanda.year", grade);
      else sessionStorage.removeItem("ayanda.year");
    } catch (_) {}
    this._landing.jumped = true;          // do not fight the hash on re-render
    this.render();
    if (scrollTo) {
      const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
      setTimeout(() => {
        const el = document.getElementById(scrollTo);
        if (el) el.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
      }, 60);
    }
  },

  /* What a term actually costs for one year group, from the school's own fee
     items rather than a sentence saying the schedule is available on request.
     A parent who cannot find the price assumes the worst. */
  feesFor(grade) {
    const items = this.pub("feeItems", FEE_ITEMS);
    const rules = this.pub("feeRules", FEE_RULES);
    const mine = items.filter(f => f.grades.includes(grade));
    const required = mine.filter(f => f.compulsory);
    const optional = mine.filter(f => !f.compulsory);
    const total = required.reduce((n, f) => n + f.amount, 0);
    return {
      required, optional, total, rules,
      instalments: rules.instalments || 3,
      perInstalment: Math.round((total / (rules.instalments || 3)) * 100) / 100,
      sibling: Math.round(total * (rules.siblingDiscount || 0)),
    };
  },

  /* The next intake that is actually open, and how many places are left in
     that year — the question behind every enquiry. */
  intakeFor(grade) {
    const intakes = this.pub("intakes", INTAKES);
    const open = intakes.find(i => i.status === "open") || intakes[0];
    if (!open) return null;
    const planned = intakes.find(i => i.id !== open.id && i.status === "planned") || null;
    return {
      intake: open, next: planned,
      places: (open.places || {})[grade] ?? null,
      plannedPlaces: planned ? (planned.places || {})[grade] ?? null : null,
    };
  },

  money(n) { return `$${Number(n || 0).toLocaleString("en-US")}`; },

  /* ------------------------------------------------------------------------
     Splitting a headline into words so they can arrive one at a time.

     Each word gets a mask with the word inside it, translated below the
     mask's own edge — so what slides is the word, and what clips it is the
     line box. The alternative, fading a whole headline in as a block, reads
     as a page that has loaded rather than one that has been set.

     Escaped first, then wrapped: the text is school copy, but it goes through
     esc() like everything else here.
     ------------------------------------------------------------------------ */
  splitWords(text) {
    /* Splits on ordinary spaces only, so a non-breaking space inside the
       headline keeps two words in one mask and therefore on one line. At this
       size a line break is a design decision, not something to leave to the
       browser. */
    return String(text).trim().split(/[ \t\r\n]+/)
      .map((w, i) => `<span class="mask" style="--i:${i}"><i>${esc(w)}</i></span>`)
      .join(" ");
  },

  /* One line per period, so the day reads as a sequence of decisions rather
     than a timetable. Read from the period itself, so a school that changes
     its day does not end up with copy describing the old one. */
  dayNote(period, i, total) {
    if (period.id === "reg") return "The register opens. Fifteen minutes later it locks.";
    if (period.kind === "break") return period.label === "Lunch" ? "Lunch, outside when the weather allows." : "Break. The yard, and someone watching it.";
    if (i === total - 1) return "The last register of the day, taken like all the others.";
    return "A register is taken here too, by the pair teaching the lesson.";
  },

  /* The opening interaction. Four buttons, one question, and the whole page
     below re-answers. Before anything is chosen it is an invitation; after,
     it is the control that changes the answer. */
  chooserBlock(target = "answer") {
    const picked = this.chosen();
    const years = this.years();
    return `
      <div class="chooser lift" style="--d:820ms">
        <div class="chooser-q">${picked
          ? `You are asking about <strong>${esc(picked.grade)}</strong>. Everything below is for that year.`
          : `How old is your child? The rest of this page will answer for them.`}</div>
        <div class="chooser-row" role="group" aria-label="Choose your child's year">
          ${years.map(y => `
            <button type="button" class="year ${picked && picked.grade === y.grade ? "on" : ""}"
                    data-action="choose-year" data-grade="${esc(y.grade)}"
                    aria-pressed="${picked && picked.grade === y.grade}">
              <span class="y-age">${y.ages[0]}–${y.ages[1]}</span>
              <span class="y-grade">${esc(y.grade)}</span>
            </button>`).join("")}
          ${picked ? `<button type="button" class="year clear" data-action="choose-year" data-grade="">Show all years</button>` : ""}
        </div>
        ${picked ? `<a class="chooser-go" href="#${esc(target)}" data-action="scroll-to" data-target="${esc(target)}">See ${esc(picked.grade)} in full <span aria-hidden="true">&darr;</span></a>` : ""}
      </div>`;
  },

  /* Once a year is chosen the answer follows you down the page: which class,
     how many places are left in it, and what a term costs — with the one
     action that matters always within reach. */
  answerRail() {
    const picked = this.chosen();
    if (!picked) return "";
    const fees = this.feesFor(picked.grade);
    const place = this.intakeFor(picked.grade);
    return `
      <div class="answer-rail">
        <div class="wrap">
          <!-- The cells scroll on a narrow screen; the action sits outside the
               scroller so it can never come to rest on top of a label. -->
          <div class="rail-cells">
            <button type="button" class="rail-year" data-action="scroll-to" data-target="top">
              <span class="k">Asking about</span><span class="v">${esc(picked.grade)}</span>
            </button>
            <span class="rail-cell"><span class="k">Class</span><span class="v">${esc(picked.name.split("—").pop().trim())}</span></span>
            <span class="rail-cell"><span class="k">Places left</span><span class="v ${place && place.places === 0 ? "none" : ""}">${place && place.places !== null ? place.places : "—"}</span></span>
            <span class="rail-cell"><span class="k">A term</span><span class="v">${this.money(fees.total)}</span></span>
          </div>
          <a class="btn sm magnetic rail-cta" href="#/visit">Book a visit</a>
        </div>
      </div>`;
  },

  /* ------------------------------------------------------------------------
     The answer
     ------------------------------------------------------------------------
     Chosen: one year, answered in the order a parent asks — which class, what
     they would learn, whether there is a place, what it costs.
     Not chosen: the same four questions across all four years, so the page
     still works as a brochure and so nothing is hidden behind an interaction.
     ------------------------------------------------------------------------ */
  answerSection() {
    const picked = this.chosen();
    return `
      <section class="band answer-band" id="answer">
        <div class="wrap">
          ${picked ? this.answerOne(picked) : this.answerAll()}
        </div>
      </section>`;
  },

  answerOne(y) {
    const fees = this.feesFor(y.grade);
    const place = this.intakeFor(y.grade);
    const subjects = ASSESSED[y.band] || [];
    const full = place && place.places === 0;
    return `
      <div class="offset-head" data-reveal>
        <div>
          <div class="eyebrow">Your answer</div>
          <h2 style="margin-top:14px">${esc(y.name)}</h2>
        </div>
        <p class="muted lead">${esc(y.agesLabel)} &middot; ${esc(y.room)}. Two adults in every lesson, a register at the start of each one, and the subjects below taught by specialists.</p>
      </div>

      <div class="answer-grid mt-24">
        <div class="ans ans-learn" data-reveal>
          <div class="ans-k">What they would learn</div>
          <div class="flex wrap mt-16" style="gap:6px">
            ${subjects.map(sj => `<span class="pill ${SUBJECTS[sj] || "grey"}">${esc(sj)}</span>`).join("")}
          </div>
          <p class="small muted mt-16">${y.band === "ecd"
            ? "Play-led, with structured time for language, number and early writing. Story and rest end the day."
            : "Formal lessons across the national curriculum, with guided reading and library time each week."}</p>
          <div class="ans-plus">
            <span class="ans-plus-k">and on the same timetable</span>
            <span class="flex wrap" style="gap:6px">${ENRICHMENT.map(e => `<span class="pill gold">${esc(e.name)}</span>`).join("")}</span>
            <span class="tiny muted">Taught in class to every child in ${esc(y.grade)}, not offered as an after-school club.</span>
          </div>
        </div>

        <div class="ans ans-place ${full ? "ans-full" : ""}" data-reveal>
          <div class="ans-k">Is there a place</div>
          ${place ? `
            <div class="ans-fig">${place.places !== null ? place.places : "—"}</div>
            <div class="ans-sub">${full
              ? `No places left for ${esc(y.grade)} in ${esc(place.intake.name)}.`
              : `place${place.places === 1 ? "" : "s"} in ${esc(y.grade)} for <strong>${esc(place.intake.name)}</strong>`}</div>
            <dl class="ans-dl">
              <dt>Applications close</dt><dd>${Fmt.date(place.intake.closes)}</dd>
              <dt>Term starts</dt><dd>${Fmt.date(place.intake.starts)}</dd>
              ${place.next ? `<dt>After that</dt><dd>${esc(place.next.name)}${place.plannedPlaces !== null ? ` &middot; ${place.plannedPlaces} place${place.plannedPlaces === 1 ? "" : "s"} planned` : ""}</dd>` : ""}
            </dl>` : `<p class="small muted mt-16">Intake dates are confirmed each term. Ask the office.</p>`}
        </div>

        <div class="ans ans-cost" data-reveal>
          <div class="ans-k">What a term costs</div>
          <div class="ans-fig">${this.money(fees.total)}</div>
          <div class="ans-sub">per term, payable in ${fees.instalments} instalments of ${this.money(fees.perInstalment)}</div>
          <table class="ans-table mt-16"><tbody>
            ${fees.required.map(f => `<tr><td>${esc(f.name)}</td><td class="right">${this.money(f.amount)}</td></tr>`).join("")}
            <tr class="tot"><td>Per term</td><td class="right">${this.money(fees.total)}</td></tr>
          </tbody></table>
          <div class="tiny muted mt-16">Includes the daily meal.${fees.optional.length ? ` Optional on top: ${fees.optional.map(f => `${esc(f.name.replace(/\s*\(optional\)/, ""))} ${this.money(f.amount)}`).join(" &middot; ")}` : ""}</div>
          <div class="tiny muted mt-8">A second child at the school takes ${this.money(fees.sibling)} off this. Settling the term early is discounted again.</div>
        </div>
      </div>

      <div class="answer-act mt-24" data-reveal>
        <a class="btn lg magnetic" href="#/visit">${full ? `Join the waiting list for ${esc(y.grade)}` : `Ask about a place in ${esc(y.grade)}`}</a>
        <a class="btn lg ghost magnetic" href="#/fees">Compare all four years</a>
      </div>`;
  },

  answerAll() {
    const years = this.years();
    return `
      <div class="offset-head" data-reveal>
        <div>
          <div class="eyebrow">Every year</div>
          <h2 style="margin-top:14px">Four classes, from three years old to eight</h2>
        </div>
        <p class="muted lead">Choose a year above and this page answers for that child alone — the class, the places left in it, and what a term costs. Until then, here are all four.</p>
      </div>

      <div class="year-grid mt-24">
        ${years.map(y => {
          const fees = this.feesFor(y.grade);
          const place = this.intakeFor(y.grade);
          return `
          <button type="button" class="year-card" data-action="choose-year" data-grade="${esc(y.grade)}" data-scroll="answer" data-reveal>
            <span class="yc-age">${y.ages[0]}–${y.ages[1]} years</span>
            <span class="yc-name">${esc(y.name)}</span>
            <span class="yc-row"><span>Places for ${esc(place ? place.intake.name : "the next intake")}</span><b class="${place && place.places === 0 ? "none" : ""}">${place && place.places !== null ? place.places : "—"}</b></span>
            <span class="yc-row"><span>A term</span><b>${this.money(fees.total)}</b></span>
            <span class="yc-go">Answer for this year <span aria-hidden="true">&rarr;</span></span>
          </button>`;
        }).join("")}
      </div>`;
  },

  /* ------------------------------------------------------------------------
     The enrichment curriculum
     ------------------------------------------------------------------------
     The persuasion here is one true contrast and nothing else: most schools
     sell these as after-school clubs, at extra cost, to whoever signs up.
     This school's own Strategic Plan puts them inside mainstream lessons for
     every learner. That is a real difference, it costs a parent nothing extra,
     and it needs no embellishment — so the section states it plainly and lets
     the timetable do the arguing.
     ------------------------------------------------------------------------ */
  enrichmentSection() {
    const picked = this.chosen();
    return `
      <section class="band alt" id="enrichment">
        <div class="wrap">
          <div class="offset-head" data-reveal>
            <div>
              <div class="eyebrow">On the timetable</div>
              <h2 style="margin-top:14px">Not after school. Not an extra. On the timetable.</h2>
            </div>
            <p class="muted lead">Sign Language, digital literacy and creative technology are taught inside ordinary lessons to every child in the school${picked ? `, ${esc(picked.grade)} included` : ""} — not sold as clubs to the families who can stay late and pay more.</p>
          </div>

          <div class="enrich-grid mt-24">
            ${ENRICHMENT.map(e => `
              <div class="enrich" data-reveal>
                <div class="enrich-head">
                  <h3>${esc(e.name)}</h3>
                  <span class="enrich-when">${esc(e.when)}</span>
                </div>
                <p class="enrich-line">${esc(e.line)}</p>
                <p class="small muted">${esc(e.body)}</p>
                <p class="tiny enrich-who">Taught by the ${esc(e.who)}</p>
              </div>`).join("")}
          </div>

          <p class="enrich-note" data-reveal>Every child does all of it. There is no set that gets the technology and another set that gets the extra reading, and no invoice line for any of it.</p>
        </div>
      </section>`;
  },

  /* Authority, and the only kind this page can honestly carry: two named
     posts the school actually staffs, and what they do in a week. No outcome
     is claimed — a parent of a child with a learning difference is making a
     large decision on this paragraph, and it says what happens, not what
     results. */
  supportSection() {
    return `
      <section class="band" id="support">
        <div class="wrap">
          <div class="offset-head" data-reveal>
            <div>
              <div class="eyebrow">Specialist support</div>
              <h2 style="margin-top:14px">Two specialists on the staff, not on a waiting list</h2>
            </div>
            <p class="muted lead">Every child is screened in their first term — not only the ones somebody has already worried about. What follows happens inside the mainstream classroom, with the class teacher, rather than by taking a child out of it.</p>
          </div>

          <div class="grid cols-2 mt-24">
            ${SPECIALISTS.map(sp => `
              <div class="spec" data-reveal>
                <div class="spec-head"><h3>${esc(sp.role)}</h3><span class="pill ${sp.basis === "Full-time" ? "green" : "grey"}">${esc(sp.basis)}</span></div>
                <p class="small muted mt-16">${esc(sp.does)}</p>
              </div>`).join("")}
          </div>

          <p class="tiny muted mt-24" data-reveal style="max-width:68ch">Screening identifies what a child needs support with. It is not a diagnosis, and we do not promise an outcome — what we commit to is that it happens early, that it happens for everyone, and that what it finds is acted on in the room your child is already in.</p>
        </div>
      </section>`;
  },

  /* ------------------------------------------------------------------------
     The router for everything a family can read
     ------------------------------------------------------------------------
     The site is no longer one page. This decides which of them the address
     bar is asking for, and hands back the whole document for it. The two
     portal pages come first because they sit behind a door code, and that
     check has to happen here rather than on the link that got you here —
     otherwise typing the address would be a way round it.
     ------------------------------------------------------------------------ */
  renderLogin() {
    const hash = location.hash || "";
    if (hash.startsWith("#/staff")) return this.renderStaffPage();
    if (hash.startsWith("#/families")) return this.renderFamilyPage();

    switch (this.publicRoute()) {
      case "learning": return this.pageLearning();
      case "support":  return this.pageSupport();
      case "fees":     return this.pageFees();
      case "joining":  return this.pageJoining();
      case "visit":    return this.pageVisit();
      case "about":    return this.pageAbout();
      default:         return this.pageHome();
    }
  },

  /* ------------------------------------------------------------------------
     The front page
     ------------------------------------------------------------------------
     One job: get a parent to the year their own child would be in, show them
     that the school's central claim is something it does rather than
     something it says, and hand them to whichever of the inside pages holds
     their real question. Everything that used to sit below the fold in
     thirteen sections now has an address of its own.
     ------------------------------------------------------------------------ */
  pageHome() {
    const s = this.school();
    const day = PERIODS;
    const dayStart = day[0].start, dayEnd = day[day.length - 1].end;
    const lessons = day.filter(p => !p.kind).length;
    const scale = this.pub("gradeScale", GRADE_SCALE);
    const years = this.years();
    const wa = this.waHref(this.waText());

    return this.siteShell("", `
      <section class="hero" id="top">
        <div class="hero-crest" aria-hidden="true"></div>
        <div class="hero-copy">
          <div class="hero-rule"></div>
          <!-- The five-second test: a parent arriving cold from a shared link
               has to learn where this is and who it is for before the
               headline asks them to feel anything about it. -->
          <div class="hero-kicker lift">Manningdale, Bulawayo &middot; ECD A to Grade 2 &middot; ages three to eight</div>
          <h1>${this.splitWords("AIS — a place where excellence is built")}</h1>
          <p class="hero-proof lift" style="--d:680ms">Two adults in every lesson. A register at the start of each one. If your child is not where they should be at eleven o'clock, you hear from us at eleven o'clock &mdash; not at the end of term.</p>
          ${this.chooserBlock()}
          <div class="hero-note flex lift" style="--d:1040ms">
            ${icon("clock")} <a href="${this.telHref()}">${esc(s.phone)}</a>
            ${wa ? `<span class="dot">&middot;</span><a href="${wa}" target="_blank" rel="noopener">WhatsApp the office</a>` : ""}
            <span class="dot">&middot;</span><span>${esc(s.address)}</span>
          </div>
        </div>
        <div class="scroll-cue lift" style="--d:1150ms" aria-hidden="true"><span>Scroll</span><i></i></div>
      </section>

      <!-- The school's own banner, shown as the lockup it is rather than used
           as a background for someone else's type. -->
      <section class="banner-band">
        <img src="assets/banner.jpg" srcset="assets/banner-sm.jpg 900w, assets/banner.jpg 1900w" sizes="100vw"
             alt="${esc(s.name)} — ${esc(s.tagline)}. Inclusivity, heritage curriculum, specialised support, innovation."
             width="1900" height="683" loading="lazy" decoding="async">
      </section>

${this.answerSection()}

      <!-- The school day, scrolled rather than listed. The register is the
           school's whole argument, so the day is the one thing on this page
           you move through instead of reading. Without JavaScript the same
           markup is a plain ordered list, which is what .day-seq is. -->
      <section class="band alt day-section" id="day">
        <div class="wrap">
          <div class="offset-head" data-reveal>
            <div>
              <div class="eyebrow">The school day</div>
              <h2 style="margin-top:14px">${dayStart} to ${dayEnd}</h2>
            </div>
            <p class="muted lead">Registration, ${lessons} lessons, a morning break and lunch. Children should arrive by ${dayStart}; the register closes fifteen minutes later — and then again at the start of every lesson.</p>
          </div>
        </div>

        <div class="day-track" data-day-track style="--slides:${day.length}">
          <div class="day-stage">
            <div class="wrap day-stage-inner">
              <div class="day-standing"><b>${this.chosen() ? esc(this.chosen().name) : "The school day"}</b><span>${dayStart} to ${dayEnd} &middot; ${lessons} lessons &middot; a register in every one</span></div>
              <ol class="day-seq" aria-label="The school day, period by period">
                ${day.map((p, i) => `
                  <li class="day-slide ${p.kind || "lesson"}" data-slide="${i}">
                    <span class="day-time">${p.start}</span>
                    <span class="day-label">${esc(p.label)}</span>
                    <span class="day-note">${esc(this.dayNote(p, i, day.length))}</span>
                  </li>`).join("")}
              </ol>
              <div class="day-rail" aria-hidden="true">
                ${day.map((p, i) => `<i data-rail="${i}" class="${p.kind || "lesson"}"></i>`).join("")}
              </div>
            </div>
          </div>
        </div>

        <div class="wrap">
          <p class="day-close" data-reveal>If a child is not where they should be at eleven o'clock, somebody knows at eleven o'clock.</p>
        </div>
      </section>

      <!-- Three doors. A parent's real question is almost always one of these
           three, and each of them now has a page rather than a paragraph. -->
      <section class="band" id="more">
        <div class="wrap">
          <div class="offset-head" data-reveal>
            <div><div class="eyebrow">Where to go next</div><h2 style="margin-top:14px">Whichever question you actually came with</h2></div>
            <p class="muted lead">Three pages, each answering one of them properly rather than in a paragraph you have to scroll past the other two to reach.</p>
          </div>
          <div class="grid cols-3 mt-24 door-grid">
            ${[
              { href: "#/learning", k: "What they learn",
                h: "Four things other schools charge extra for, on the ordinary timetable",
                b: "Sign Language, digital literacy, creative technology and heritage — taught in class to every child, with no line for any of them on your invoice.",
                go: "See the curriculum and the timetable" },
              { href: "#/support", k: "Specialist support",
                h: "Every child screened in their first term, not only the worried-about ones",
                b: "A Learning Disabilities Specialist on the staff full-time and a Hearing Impairment Specialist part-time — so what screening finds is acted on here, not added to a waiting list.",
                go: "See how support actually works" },
              { href: "#/fees", k: "Fees and places",
                h: "Every figure printed before you ask for it",
                b: `A term, item by item, for each of the four years, and how many places are genuinely left in each. ${this.money(Math.min(...years.map(y => this.feesFor(y.grade).total)))} to ${this.money(Math.max(...years.map(y => this.feesFor(y.grade).total)))} a term.`,
                go: "See every figure" },
            ].map(d => `
              <a class="door" href="${d.href}" data-reveal>
                <span class="door-k">${esc(d.k)}</span>
                <span class="door-h">${esc(d.h)}</span>
                <span class="door-b">${esc(d.b)}</span>
                <span class="door-go">${esc(d.go)} <span aria-hidden="true">&rarr;</span></span>
              </a>`).join("")}
          </div>
        </div>
      </section>

      <section class="strip" data-reveal>
        <div class="wrap">
          ${[["", String(Store.db ? Store.db.classes.length : 4), "classes", "from ECD A to Grade 2"],
             ["", "2", "teachers", "in every single lesson"],
             ["", String(lessons), "lessons a day", `${dayStart} to ${dayEnd}`],
             ["", String(ENRICHMENT.length), "enrichment subjects", "timetabled, not after school"]].map(([prefix, n, label, sub]) => `
            <div class="fact"><div class="n">${prefix}<span data-count="${n}">0</span></div>
              <div class="l">${label}</div><div class="s">${esc(sub)}</div></div>`).join("")}
        </div>
      </section>

      ${this.ctaBand()}

      <section class="band ink" id="portals">
        <div class="wrap" data-reveal>
          <div class="eyebrow center">Already with us</div>
          <h2 class="center" style="max-width:22ch;margin:10px auto 0">Signing in, for families and for staff</h2>
          <div class="grid cols-2 mt-24" style="margin-top:48px">
            <div class="card pillar" data-reveal>
              <div class="eyebrow" style="margin-bottom:14px">For parents and guardians</div>
              <h3>The family portal</h3>
              <p class="lead">Your child's record, as the school holds it</p>
              <p class="small muted">Attendance taken period by period, marks as the teachers enter them, your fee account, and the messages between you and the school — all in one place, all about your own child and nobody else's.</p>
              <ul class="ticks mt-16">
                <li>${icon("check")}Tell us about an absence before the register</li>
                <li>${icon("check")}See every mark behind a grade, not just the grade</li>
                <li>${icon("check")}Check what is owed and when, without telephoning</li>
              </ul>
              <a class="btn mt-16" href="#/families">${icon("lock")} Enter the family portal</a>
              <p class="tiny muted mt-8">You will be asked for the school code, then for your own password. The office gives out both — if you have not been given them, ask at the office.</p>
            </div>
            <div class="card pillar" data-reveal>
              <div class="eyebrow" style="margin-bottom:14px">For teachers and office staff</div>
              <h3>The staff portal</h3>
              <p class="lead">Registers, marks, fees and guardian messages</p>
              <p class="small muted">The record system the school runs on. Signing in is on its own page, away from here; the guide to using it is inside the portal.</p>
              <a class="btn ghost mt-16" href="#/staff">${icon("lock")} Enter the staff portal</a>
              <p class="tiny muted mt-8">The school code, then your own sign-in. Ask HR for either.</p>
            </div>
          </div>
        </div>
      </section>
    `);
  },
});

/* --- the public page's own handlers -------------------------------------- */
Object.assign(App, {
  /* Marking a form busy must not redraw it — a parent who has typed out their
     child's details should not lose them because the office was slow to
     answer, or because the request failed. */
  landingBusy(form, label) {
    const button = form.querySelector('button[type="submit"]');
    if (!button) return () => {};
    const was = button.innerHTML;
    button.disabled = true; button.innerHTML = label;
    return () => { button.disabled = false; button.innerHTML = was; };
  },

  landingFormError(form, message) {
    form.querySelectorAll(".notice.err").forEach(n => n.remove());
    const box = document.createElement("div");
    box.className = "notice err mt-16";
    box.textContent = message;
    form.querySelector('button[type="submit"]').before(box);
    box.scrollIntoView({ block: "nearest" });
  },

  landingActions(d) {
    return {
      "choose-year": () => this.choose(d.grade || null, d.scroll || null),
      "scroll-to": () => {
        const el = document.getElementById(d.target);
        if (!el) return;
        const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
        el.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
      },
      "landing-menu": () => document.querySelector(".site")?.classList.toggle("menu-open"),
      "landing-close-menu": () => document.querySelector(".site")?.classList.remove("menu-open"),
      "landing-request-again": () => { this.ui.login.requested = false; this.ui.login.requestError = ""; this.render(); },
      "landing-enquire-again": () => { this.ui.login.enquired = false; this.ui.login.enquireError = ""; this.render(); },
      "install-app": () => this.installApp(),
      /* Toggling visibility must not redraw the page — that would throw away
         what has been typed and re-run every animation. */
      "landing-show-password": () => {
        const box = document.getElementById(d.target || "password");
        const button = d.target
          ? document.querySelector(`[data-action="landing-show-password"][data-target="${d.target}"]`)
          : document.querySelector('[data-action="landing-show-password"]:not([data-target])');
        if (!box || !button) return;
        const show = box.type === "password";
        box.type = show ? "text" : "password";
        button.textContent = show ? "Hide" : "Show";
        button.setAttribute("aria-label", show ? "Hide password" : "Show password");
        box.focus();
      },
    };
  },

  /* Anyone may ask for an account; nobody gets one without HR approving it. */
  landingSubmit(k, f, id, submitted) {
    if (k === "gate") {
      const ui = this.ui.gate;
      if (ui.busy) return true;
      const audience = submitted.dataset.audience;
      const form = submitted;
      ui.busy = true; ui.error = "";
      const done = this.landingBusy(form, "Checking…");
      Store.checkGate(audience, f.pin)
        .then(() => { ui.busy = false; ui.error = ""; this.render(); })
        .catch((e) => {
          ui.busy = false; done();
          this.landingFormError(form, e.message || "That code is not right.");
          const box = document.getElementById("gate-pin"); if (box) { box.value = ""; box.focus(); }
        });
      return true;
    }
    if (k === "demo-setup") return this.demoSetup(f);
    if (k === "enquiry") return this.landingEnquiry(f);
    if (k !== "access-request") return false;
    const ui = this.ui.login;
    if (ui.requesting) return true;
    const request = {
      first: String(f.first || "").trim(), last: String(f.last || "").trim(),
      email: String(f.email || "").trim(), phone: String(f.phone || "").trim(),
      role: f.role, note: String(f.note || "").trim().slice(0, 600),
    };
    const form = document.querySelector('[data-form="access-request"]');
    if (!request.first || !request.last || !request.email) { this.landingFormError(form, "Name and email are needed."); return true; }

    ui.requesting = true;
    const done = this.landingBusy(form, "Sending…");
    Store.requestAccess(request)
      .then(() => { ui.requesting = false; ui.requested = true; this.render(); })
      .catch((e) => { ui.requesting = false; done(); this.landingFormError(form, e.message || "Could not send the request."); });
    return true;
  },

  /* Choosing the first password, and signing in on it. It is not must-change:
     the person choosing it is the person who will use it. */
  demoSetup(f) {
    const form = document.querySelector('[data-form="demo-setup"]');
    const who = Store.demoFirstAccount();
    if (!who) return true;
    if (f.password !== f.confirm) { this.landingFormError(form, "The two passwords are not the same."); return true; }
    const problem = passwordProblem(f.password);
    if (problem) { this.landingFormError(form, problem); return true; }

    const done = this.landingBusy(form, "Setting up…");
    Store.demoIssue(who.id, f.password, { mustChange: false })
      .then(() => Store.login(who.email, f.password))
      .then(() => { this.view = "dashboard"; location.hash = "#/dashboard"; this.render(); })
      .catch((e) => { done(); this.landingFormError(form, e.message || "Could not set that password."); });
    return true;
  },

  /* A family asking about a place. It reaches the office as an enquiry at the
     head of the admissions list, which is where the work already happens. */
  landingEnquiry(f) {
    const ui = this.ui.login;
    if (ui.enquiring) return true;

    /* The form no longer asks for the child's name, because asking for it was
       costing more enquiries than the name was worth: the office rings back
       and asks. All three backends still record an applicant, and an
       applicant needs something to be called on the admissions board, so when
       the name has not been given it is filled from the family's own surname
       and the enquiry says plainly that it was. The office corrects it on the
       telephone call it was always going to make. */
    const guardian = String(f.guardianName || "").trim();
    const surname = guardian.split(/\s+/).filter(Boolean).pop() || "";
    const childFirst = String(f.childFirst || "").trim();
    const childLast = String(f.childLast || "").trim();
    const named = !!(childFirst || childLast);

    const enquiry = {
      childFirst: childFirst || "Child",
      childLast: childLast || surname,
      dob: f.dob || "", gender: ["F", "M"].includes(f.gender) ? f.gender : "F", targetGrade: f.targetGrade,
      sibling: f.sibling === "yes",
      guardianName: guardian, relationship: f.relationship,
      phone: String(f.phone || "").trim(), email: String(f.email || "").trim(),
      /* Appended to the note rather than added as a field, so it reaches the
         office on all three backends without a schema change on any of them. */
      message: [
        String(f.message || "").trim(),
        named ? "" : "The child's name was not given on the enquiry form — please confirm it when you telephone.",
        String(f.hesitation || "").trim() && `What might make them hesitate: ${String(f.hesitation).trim()}`,
      ].filter(Boolean).join("\n\n"),
    };
    const form = document.querySelector('[data-form="enquiry"]');
    if (!enquiry.guardianName) { this.landingFormError(form, "Please give your name, so we know who to ask for."); return true; }
    if (!enquiry.childLast) { this.landingFormError(form, "Please give your full name, so we know who to ask for."); return true; }
    if (!enquiry.phone && !enquiry.email) { this.landingFormError(form, "Please leave a telephone number or an email address so we can reply."); return true; }

    ui.enquiring = true;
    const done = this.landingBusy(form, "Sending…");
    Store.enquire(enquiry)
      .then(() => { ui.enquiring = false; ui.enquired = true; this.render(); window.scrollTo(0, 0); })
      .catch((e) => { ui.enquiring = false; done(); this.landingFormError(form, e.message || "Could not send the enquiry. Please telephone the school office on " + this.pub("school", SCHOOL).phone + "."); });
    return true;
  },
});

/* ==========================================================================
   Movement
   --------------------------------------------------------------------------
   Enough motion to make the page feel alive and to show where you are, and no
   more — this is a school's staff portal, not a product launch. Everything
   here is progressive: with JavaScript blocked or motion reduced, the page is
   simply the static one, fully readable.
   ========================================================================== */

Object.assign(App, {
  _landing: { revealed: false, teardown: null, jumped: false, page: null },

  landingEnhance() {
    const root = document.querySelector(".site");
    if (!root) return;
    if (this._landing.teardown) this._landing.teardown();

    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reveals = [...root.querySelectorAll("[data-reveal]")];
    const counters = [...root.querySelectorAll("[data-count]")];
    const bar = root.querySelector(".site-bar");
    /* Now that the header links are routes — "#/learning" — they are not
       selectors, and handing one to querySelector throws before anything else
       on this page gets a chance to run. Only an in-page anchor is spied on. */
    const links = [...root.querySelectorAll(".site-nav a")];
    const sections = links.map(a => {
      const href = a.getAttribute("href") || "";
      if (!href.startsWith("#") || href.startsWith("#/")) return null;
      let el = null;
      try { el = root.querySelector(href); } catch (_) {}
      return el ? { link: a, el } : null;
    }).filter(Boolean);
    const banner = root.querySelector(".hero-crest");
    /* The sticky bar's height is the one measurement CSS cannot take for
       itself, and the pinned stage has to sit under it. The answer rail used
       to be measured alongside it, because it was sticky too; it is not any
       more, so it takes up no space that anything else has to avoid. */
    const setBarHeight = () => {
      if (!bar) return;
      const h = `${Math.round(bar.getBoundingClientRect().height)}px`;
      root.style.setProperty("--bar-h", h);
      /* the scrolling element is <html>, so anchor offsets are read from there */
      document.documentElement.style.setProperty("--bar-h", h);
    };

    /* ----------------------------------------------------------------------
       Whether the links can be spelled out in full
       ----------------------------------------------------------------------
       The wordmark is centred on the bar rather than on what is left over
       beside it, which is the only way it stays in the middle — but it also
       means the navigation can run into it, and a breakpoint chosen by hand
       is wrong the day somebody renames a link or the crest changes size.

       So it is measured. The full names go on, the gap to the wordmark is
       read, and they come off again if they do not clear it. The page starts
       in the short state, so the worst case is a shorter word rather than two
       pieces of type on top of each other.
       ---------------------------------------------------------------------- */
    const navEl = root.querySelector(".site-nav");
    const brandEl = root.querySelector(".site-brand");
    let lastFitWidth = -1;
    const fitNav = () => {
      if (!navEl || !brandEl) return;
      if (window.innerWidth === lastFitWidth) return;      // only on a real resize
      lastFitWidth = window.innerWidth;
      if (navEl.offsetParent === null) return;             // collapsed to the menu button
      root.classList.add("nav-wide");
      const clear = brandEl.getBoundingClientRect().left - navEl.getBoundingClientRect().right;
      if (clear < 16) root.classList.remove("nav-wide");
    };
    const track = root.querySelector("[data-day-track]");
    const slides = track ? [...track.querySelectorAll(".day-slide")] : [];
    const rails = track ? [...track.querySelectorAll("[data-rail]")] : [];

    /* The load choreography starts on the next frame rather than this one, so
       the first paint has the words still below their masks — otherwise the
       transition has nothing to travel from and the headline simply appears. */
    setBarHeight();
    fitNav();

    /* A link somebody was sent — ayandainfantschool.com/#joining — arrives
       before this page exists, so the browser's own anchor jump has nothing
       to jump to. Once it does exist, honour it. */
    /* A link somebody was sent — #/learning#timetable — carries the section
       after the route, so the anchor is whatever follows the second hash. */
    const raw = location.hash || "";
    const wanted = raw.startsWith("#/") ? raw.split("#").slice(2).join("#") : raw.slice(1);

    /* Following a link to another page has to put you at the top of it. The
       browser does that for a document; it does not do it for a site that
       swaps its own contents, and landing three screens down a page you have
       never seen reads as a broken link. Only a genuine change of page counts
       — re-rendering after choosing a year, or after a form error, must leave
       the reader exactly where they were. */
    const pageKey = (raw || "#/").split("#").slice(0, 2).join("#");
    if (this._landing.page !== pageKey) {
      this._landing.page = pageKey;
      this._landing.jumped = false;
      this._landing.revealed = false;
      if (!wanted) window.scrollTo(0, 0);
    }

    if (wanted && !wanted.startsWith("/") && !this._landing.jumped) {
      const target = root.querySelector(`#${CSS.escape(wanted)}`);
      if (target) {
        this._landing.jumped = true;
        setTimeout(() => target.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" }), 90);
      }
    }

    if (still) root.classList.add("lit");
    else setTimeout(() => root.classList.add("lit"), 30);

    /* The day becomes a sequence only once it can be driven. With JavaScript
       off the same markup stays an ordered list, which is why the class goes
       on here rather than in the template. */
    if (track && slides.length) {
      track.classList.add("seq-on");
      slides[0].classList.add("on");
      if (rails[0]) rails[0].classList.add("on");
    }

    if (still || this._landing.revealed) {
      reveals.forEach(el => el.classList.add("in"));
      counters.forEach(el => el.textContent = el.dataset.count);
    }

    /* Which period the day has reached, from how far through the track the
       viewport has travelled. Nothing is pinned by script — the stage is a
       sticky element and the reader scrolls at their own pace. */
    let atSlide = -1;
    const runDay = (height) => {
      if (!track || !slides.length || still) return;
      const box = track.getBoundingClientRect();
      const travel = box.height - height;
      if (travel <= 0) return;
      const through = Math.min(1, Math.max(0, -box.top / travel));
      const i = Math.min(slides.length - 1, Math.floor(through * slides.length));
      if (i === atSlide) return;
      atSlide = i;
      slides.forEach((el, n) => el.classList.toggle("on", n === i));
      rails.forEach((el, n) => { el.classList.toggle("on", n === i); el.classList.toggle("past", n < i); });
    };

    /* One listener, read once a frame. IntersectionObserver would be tidier,
       but it is quietly missing in some embedded browsers, and a page that
       silently never appears is worse than a few pixels of arithmetic. */
    const measure = () => {
      const height = window.innerHeight || document.documentElement.clientHeight || 800;

      if (!this._landing.revealed && !still) {
        reveals.forEach((el) => {
          if (el.classList.contains("in")) return;
          /* Anything whose top has come above the line is shown — including
             what is already scrolled past, or a visitor who lands deep in the
             page would find it blank above them. */
          if (el.getBoundingClientRect().top < height * 0.88) el.classList.add("in");
        });
        if (reveals.every(el => el.classList.contains("in"))) this._landing.revealed = true;
      }

      if (!still) counters.forEach((el) => {
        if (el.dataset.done) return;
        const box = el.getBoundingClientRect();
        if (box.top < height * 0.9) { el.dataset.done = "1"; box.bottom > 0 ? this.landingCount(el) : (el.textContent = el.dataset.count); }
      });

      if (bar) { bar.classList.toggle("scrolled", (window.scrollY || 0) > 140); setBarHeight(); fitNav(); }

      /* Decorative only: the banner drifts, the words on top of it do not. */
      if (banner && !still) {
        const y = window.scrollY || 0;
        if (y < height * 1.2) banner.style.setProperty("--par", `${Math.round(y * 0.18)}px`);
      }
      runDay(height);

      /* the section whose top has most recently passed the middle of the screen */
      let current = null;
      sections.forEach(({ link, el }) => { if (el.getBoundingClientRect().top <= height * 0.45) current = link; });
      links.forEach(a => a.classList.toggle("on", a === current));
    };

    /* Throttled on the clock rather than on a frame. requestAnimationFrame is
       the usual choice, but it is paused in a hidden or unpainted tab, and a
       page that never catches up when it is shown again reads as broken. */
    let last = 0, timer = null;
    const onScroll = () => {
      const now = Date.now();
      if (now - last >= 80) { last = now; measure(); return; }
      clearTimeout(timer);
      timer = setTimeout(() => { last = Date.now(); measure(); }, 80);
    };

    /* Magnetic buttons: the target leans towards the pointer, which makes it
       feel caught rather than hovered. Pointer devices only — on a touch
       screen there is no cursor to lean towards, and the transform would
       just be a jump. transform only, so it stays on the compositor. */
    const magnets = [];
    if (!still && matchMedia("(hover: hover) and (pointer: fine)").matches) {
      for (const btn of root.querySelectorAll(".magnetic")) {
        const move = (e) => {
          const b = btn.getBoundingClientRect();
          const x = (e.clientX - b.left - b.width / 2) * 0.28;
          const y = (e.clientY - b.top - b.height / 2) * 0.34;
          btn.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        };
        const leave = () => { btn.style.transform = ""; };
        btn.addEventListener("pointermove", move);
        btn.addEventListener("pointerleave", leave);
        magnets.push(() => { btn.removeEventListener("pointermove", move); btn.removeEventListener("pointerleave", leave); leave(); });
      }
    }

    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll, { passive: true });
    document.addEventListener("visibilitychange", measure);
    this._landing.teardown = () => {
      clearTimeout(timer);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
      document.removeEventListener("visibilitychange", measure);
      magnets.forEach(off => off());
      this._landing.teardown = null;
    };
    measure();
    setTimeout(measure, 120);        // once more after the banner has laid out
  },

  landingCount(el) {
    const target = Number(el.dataset.count);
    if (document.hidden) { el.textContent = target; return; }
    const started = performance.now(), ms = 850;
    const tick = (now) => {
      const t = Math.min(1, (now - started) / ms);
      el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  },

  installCard() {
    const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    if (standalone) return "";
    const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (!this._installPrompt && !iOS) return "";
    return `<div class="install-card">
      <span class="install-ico"><img src="assets/icons/icon-192.png" alt="" width="40" height="40"></span>
      <div><strong>Put it on your phone</strong>
        <p class="tiny muted">${this._installPrompt
          ? "Installs as an app: opens without the browser bars, and the pages you have already visited still open with no signal."
          : "On iPhone, tap <strong>Share</strong> and then <strong>Add to Home Screen</strong>. It then opens like an app, without the browser bars."}</p></div>
      ${this._installPrompt ? `<button class="btn sm" data-action="install-app">Install</button>` : ""}
    </div>`;
  },

  async installApp() {
    const prompt = this._installPrompt;
    if (!prompt) return;
    this._installPrompt = null;
    prompt.prompt();
    await prompt.userChoice.catch(() => {});
    this.render();
  },



  /* ------------------------------------------------------------------------
     Setting this browser up
     ------------------------------------------------------------------------
     There is no default password and no published one. On a first visit — or
     after the demo school is loaded or reset — nobody can sign in at all, so
     this panel appears instead: choose a password for the most senior account
     in the school, and from there the office issues everybody else's exactly
     as it would on a real database.
     ------------------------------------------------------------------------ */
  demoSetupCard() {
    if (!Store.demoNeedsSetup) return "";
    const who = Store.demoFirstAccount();

    if (!DemoCredentials.available) {
      return `<div class="card access-card mb-16"><div class="card-head"><div><div class="eyebrow">Set up</div><h3>This page cannot hold a password</h3></div></div>
        <div class="card-body"><div class="notice warn small">${icon("alert")} ${esc(DemoCredentials.unavailable)}</div>
        <p class="tiny muted mt-16">Passwords here are hashed with PBKDF2, which browsers only offer on a secure page. Serve the folder with <code>python3 -m http.server</code> and open it at <code>localhost</code>, or use the published site.</p></div></div>`;
    }
    if (!who) {
      return `<div class="card access-card mb-16"><div class="card-head"><div><div class="eyebrow">Set up</div><h3>This school has no accounts</h3></div></div>
        <div class="card-body"><p class="muted small">There is nobody here to sign in as. Reset the demo data to start again.</p></div></div>`;
    }

    return `<div class="card access-card mb-16">
      <div class="card-head"><div><div class="eyebrow">First time here</div><h3>Set up this browser's school</h3></div></div>
      <div class="card-body">
        <p class="muted small">Nobody can sign in yet — there is no default password and none is published. Choose one for the ${esc(ROLES[who.role] ? ROLES[who.role].label : "first")} account below, and from there you can set up everybody else: staff from the <strong>Staff</strong> page, families from <strong>Family portal</strong>, each with a password you choose or generate.</p>
        <form data-form="demo-setup" class="mt-16">
          <label class="field">Signs in as</label>
          <input class="input mono" value="${esc(who.email)}" disabled>
          <div class="mt-16">
            <label class="field" for="setup-pw">Choose a password</label>
            <div class="pw">
              <input class="input" id="setup-pw" name="password" type="password" autocomplete="new-password" minlength="8" required>
              <button type="button" class="pw-toggle" data-action="landing-show-password" data-target="setup-pw" aria-label="Show password">Show</button>
            </div>
          </div>
          <label class="field mt-16" for="setup-pw2">Type it again</label>
          <input class="input" id="setup-pw2" name="confirm" type="password" autocomplete="new-password" required>
          <div class="help mt-8">At least eight characters, with a letter and a number. It is hashed before it is stored and cannot be read back — if you forget it, reset the demo data and start again.</div>
          <button class="btn mt-16" type="submit" style="width:100%;justify-content:center">${icon("key")} Set the password and sign in</button>
        </form>
      </div>
    </div>`;
  },

  /* ------------------------------------------------------------------------
     The door
     ------------------------------------------------------------------------
     Deliberately modest about what it is. Everybody on one side of the school
     has the same code, so it says nothing about who is at the keyboard; what
     it does is keep a box asking for a teacher's email address off a page a
     stranger can find. The password behind it is still the lock.
     ------------------------------------------------------------------------ */
  /* ------------------------------------------------------------------------
     The door code, and what it is allowed to hide
     ------------------------------------------------------------------------
     It used to stand in front of the whole page, which was too much: a parent
     who has not been given the code yet still needs to read how to get a
     sign-in, and a teacher who is new still needs the form that asks HR for
     an account. Neither of those reaches a single record.

     So the code now guards exactly one thing — the sign-in form — and the
     rest of both pages stays open. What is behind the door is the box that
     asks for a school email address; everything in front of it is public
     information about how to be let in.
     ------------------------------------------------------------------------ */

  /* "loading" until the school's answer arrives, so the page never flashes a
     sign-in form that is about to be replaced by a code box. */
  gateState(audience) {
    if (this.ui.gate.status === null) {
      if (!this.ui.gate.loading) {
        this.ui.gate.loading = true;
        Store.gateStatus().then((st) => { this.ui.gate.status = st; this.ui.gate.loading = false; this.render(); })
          .catch(() => { this.ui.gate.status = { staff: { required: false }, family: { required: false } }; this.ui.gate.loading = false; this.render(); });
      }
      return "loading";
    }
    const st = this.ui.gate.status[audience];
    if (!st || !st.required) return "open";
    return Store.gatePassed(audience) ? "open" : "locked";
  },

  /* The sign-in card, or the door in its place. Same slot either way, so the
     page does not reflow around it. */
  signInCard(audience, card) {
    const state = this.gateState(audience);
    if (state === "open") return card();
    if (state === "loading") {
      return `<div class="card access-card gate-card-slot">
        <div class="card-body center"><div class="gate-mark">${icon("lock")}</div>
        <p class="muted small center mt-16">One moment…</p></div></div>`;
    }
    return this.gateLockCard(audience);
  },

  gateLockCard(audience) {
    const s = this.pub("school", SCHOOL);
    const who = audience === "staff"
      ? { title: "Staff sign in", line: "Locked",
          say: "The school gives every member of staff the same code for this door. It is not your password — that comes next, and it is yours alone.",
          ask: "If you have not been given the code, ask the school office or HR." }
      : { title: "Family sign in", line: "Locked",
          say: "Every family here has the same code for this door. It is not your password — that comes next, and it is yours alone.",
          ask: `If you have not been given the code, telephone the school office on ${s.phone}.` };

    return `
      <div class="card access-card gate-card-slot">
        <div class="card-head"><div><div class="eyebrow">${esc(who.line)}</div><h3>${esc(who.title)}</h3></div>
          <span class="pill gold">${icon("lock")} Code</span></div>
        <div class="card-body">
          <div class="gate-mark">${icon("lock")}</div>
          <p class="muted small mt-16">${esc(who.say)}</p>

          <form data-form="gate" data-audience="${audience}" class="gate-form mt-16">
            <label class="field" for="gate-pin">School code</label>
            <input class="input gate-pin" id="gate-pin" name="pin" type="password"
                   inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*"
                   maxlength="10" minlength="4" required
                   aria-describedby="gate-help" placeholder="••••">
            <button class="btn mt-16" type="submit" style="width:100%;justify-content:center" ${this.ui.gate.busy ? "disabled" : ""}>
              ${this.ui.gate.busy ? "Checking…" : "Unlock the sign-in"}
            </button>
            <p class="tiny muted mt-16" id="gate-help">${esc(who.ask)}</p>
          </form>

          <p class="tiny muted mt-16">This code keeps the sign-in box off the open web. It does not identify you — everybody on this side of the school has the same one — so your own password still decides what you can see.</p>
        </div>
      </div>`;
  },

  renderStaffPage() {
    const s = this.pub("school", SCHOOL);
    const ui = this.ui.login;

    return `
    <div class="site staff-site">
      <header class="site-bar">
        <a class="site-brand" href="#/">
          <img src="assets/logo.png" alt="">
          <span><span class="n">${esc(s.name)}</span><span class="t">Staff portal</span></span>
        </a>
        <div class="flex site-actions" style="gap:8px;margin-left:auto">
          <a class="btn ghost sm" href="#/" aria-label="School website">${icon("left")}<span class="btn-lbl"> School website</span></a>
          <a class="btn sm" href="#signin">${icon("key")} Sign in</a>
        </div>
      </header>

      <main id="content">
      <section class="staff-hero">
        <div class="wrap">
          <div class="eyebrow">For teachers and office staff</div>
          <h1>The staff portal</h1>
          <p>Sign in with your school email address and the password you were given. The guide to the portal — every page, and what each one is for — is inside it, under <strong>How to use the portal</strong>. It is not on this page, because it is written for the people who already have an account.</p>
          ${this.installCard()}
        </div>
      </section>

      <section class="band alt" id="signin">
        <div class="wrap">
          ${this.demoSetupCard()}
          <div class="grid access-grid">
            ${this.signInCard("staff", () => `
            <div class="card access-card">
              <div class="card-head"><div><div class="eyebrow">Staff sign in</div><h3>Sign in to the portal</h3></div></div>
              <form class="card-body" data-form="login" autocomplete="on">
                <p class="muted small">Use the school email address and password you were given. If you have forgotten your password, HR or the Head Teacher can reset it for you.</p>
                <label class="field mt-16" for="email">School email address</label>
                <input class="input" id="email" name="email" type="email" inputmode="email" autocomplete="username"
                       spellcheck="false" placeholder="name@ayandainfantschool.com" value="${esc(ui.email || "")}" required>
                <label class="field mt-16" for="password">Password</label>
                <div class="pw">
                  <input class="input" id="password" name="password" type="password" autocomplete="current-password" placeholder="Your password" required>
                  <button type="button" class="pw-toggle" data-action="landing-show-password" aria-label="Show password">Show</button>
                </div>
                ${ui.error ? `<div class="notice err mt-16">${icon("alert")} ${esc(ui.error)}</div>` : ""}
                <button class="btn mt-16" type="submit" style="width:100%;justify-content:center" ${ui.busy ? "disabled" : ""}>${ui.busy ? "Signing in…" : "Sign in"}</button>
                <div class="tiny muted mt-16">${Store.shared
                  ? `${icon("cloud")} Shared school database — everyone sees the same records.`
                  : `${icon("info")} Demo mode. This browser holds its own school and its own sign-ins; nothing you do here leaves it.`}</div>
                <div class="tiny muted mt-8">${icon("lock")} Accounts are locked after repeated failed attempts. Every sign-in is recorded in the audit log.</div>
              </form>
            </div>`)}

            <div class="card access-card" id="request">
              <div class="card-head"><div><div class="eyebrow">New to the school</div><h3>Request an account</h3></div></div>
              <div class="card-body">
                ${ui.requested
                  ? `<div class="notice ok">${icon("check")} <strong>Request sent.</strong> HR will be in touch once the Head Teacher has approved it. You will be given a password to sign in with.</div>
                     <button class="btn ghost mt-16" data-action="landing-request-again">Send another request</button>`
                  : `<p class="muted small">Accounts are created by the school, not by signing up. Tell HR who you are and what you need, and they will set you up with the right access.</p>
                <form data-form="access-request" class="mt-16">
                  <div class="grid cols-2">
                    <div><label class="field">First name</label><input class="input" name="first" required></div>
                    <div><label class="field">Surname</label><input class="input" name="last" required></div>
                  </div>
                  <label class="field mt-16">Email</label><input class="input" type="email" name="email" required placeholder="you@ayandainfantschool.com">
                  <label class="field mt-16">Phone</label><input class="input" name="phone" placeholder="+263 …">
                  <label class="field mt-16">Role you need</label>
                  <select class="input" name="role">${Object.entries(ROLES).filter(([k]) => !ROLES[k].governance).map(([k, r]) => `<option value="${k}">${r.label}</option>`).join("")}</select>
                  <label class="field mt-16">Anything HR should know</label>
                  <textarea class="input" name="note" rows="2" placeholder="Which class you will be teaching, your start date…"></textarea>
                  <button class="btn mt-16" type="submit" style="width:100%;justify-content:center">Send request to HR</button>
                  <div class="help mt-8">Your details go to the Head Teacher and HR only. No account exists until one of them approves it.</div>
                </form>`}
              </div>
            </div>
          </div>
        </div>
      </section>

      </main>

      <footer class="site-foot">
        <div class="wrap flex between wrap" style="gap:24px">
          <div><div class="bold">${esc(s.name)} — staff portal</div>
            <p class="tiny mt-8">Trouble signing in? The school office on ${esc(s.phone)}, or ask HR.</p></div>
          <div class="tiny" style="max-width:420px">
            <div class="bold">Before you start</div>
            <p class="mt-8">You are looking at real children's records. Sign out on a shared machine, never sign in for somebody else, and do not take screenshots of a pupil's page. Everything you open is logged.</p>
          </div>
          <a class="tiny" href="#/">← Back to the school website</a>
        </div>
      </footer>
    </div>`;
  },
});

/* ==========================================================================
   The family portal's public page
   --------------------------------------------------------------------------
   Deliberately its own page, away from the school's prospectus and away from
   the staff one. A parent arriving here is not being sold the school; they
   have a child in it and want to know something specific.
   ========================================================================== */
Object.assign(App, {

  familyShows: [
    { icon: "check", title: "Attendance, mark by mark",
      body: "Registration and every lesson, exactly as the register was taken — not a monthly percentage. If your child was marked late on a Tuesday, you can see which lesson and what the teacher wrote." },
    { icon: "award", title: "Progress with the working shown",
      body: "Every assessment behind a grade: what it was, when it was, and what your child scored. We describe the standard reached — exceeding, secure, developing, beginning — and never a position in the class." },
    { icon: "wallet", title: "The fee account, as the office holds it",
      body: "What was billed, what has been received, what is due next and on which date. The same figures the office reads off its own screen, so there is nothing to reconcile on the telephone." },
    { icon: "chat", title: "One thread with the school",
      body: "Everything the school has sent you about your child, and everything you have sent back, kept together on their record rather than scattered across SMS, WhatsApp and the bottom of a school bag." },
    { icon: "alert", title: "Tell us before the register",
      body: "Report an absence from your phone and the reason is in front of the teacher who takes the register that morning. It does not mark the register — only a teacher does that — but it stops the automatic message asking where your child is." },
    { icon: "lock", title: "Your child, and only your child",
      body: "The account is bound to your own children. There is no page in it that reaches another family, another class, or the staff side of the portal — not filtered out, never sent." },
  ],

  renderFamilyPage() {
    const s = this.pub("school", SCHOOL);
    const ui = this.ui.login;

    return `
    <div class="site staff-site family-site">
      <header class="site-bar">
        <a class="site-brand" href="#/">
          <img src="assets/logo.png" alt="">
          <span><span class="n">${esc(s.name)}</span><span class="t">Family portal</span></span>
        </a>
        <div class="flex site-actions" style="gap:8px;margin-left:auto">
          <a class="btn ghost sm" href="#/" aria-label="School website">${icon("left")}<span class="btn-lbl"> School website</span></a>
          <a class="btn sm" href="#signin">${icon("key")} Sign in</a>
        </div>
      </header>

      <main id="content">
      <section class="staff-hero">
        <div class="wrap">
          <div class="eyebrow">For parents and guardians</div>
          <h1>Your child's record, not a newsletter</h1>
          <p>Attendance as it was actually taken, marks as the teachers actually entered them, and the fee account as the office actually holds it. If the school knows something about your child, this is where you can see it — the same day, without telephoning.</p>
          <div class="hero-cta" style="margin-top:28px">
            <a class="btn lg" href="#signin">${icon("key")} Sign in</a>
            <a class="btn lg ghost" href="#inside">What is inside</a>
          </div>
        </div>
      </section>

      <section class="band" id="inside">
        <div class="wrap">
          <div class="eyebrow center">What is inside</div>
          <h2 class="center" style="max-width:20ch;margin:10px auto 0">Six things, and nothing you have to chase</h2>
          <div class="grid cols-2 mt-24 work-grid">
            ${this.familyShows.map(w => `
              <div class="work">
                <span class="work-ico">${icon(w.icon)}</span>
                <div><h3>${esc(w.title)}</h3><p class="small muted">${esc(w.body)}</p></div>
              </div>`).join("")}
          </div>
        </div>
      </section>

      <section class="band alt" id="signin">
        <div class="wrap">
          <div class="grid access-grid">
            ${this.signInCard("family", () => `
            <div class="card access-card">
              <div class="card-head"><div><div class="eyebrow">Family sign in</div><h3>Sign in to the family portal</h3></div></div>
              <form class="card-body" data-form="login" autocomplete="on">
                <p class="muted small">Use the email address the school holds for you and the password the office gave you. Keep that password for as long as you like — you can change it yourself at any time, under <strong>Your account</strong>.</p>
                <label class="field mt-16" for="email">Your email address</label>
                <input class="input" id="email" name="email" type="email" inputmode="email" autocomplete="username"
                       spellcheck="false" placeholder="you@example.com" value="${esc(ui.email || "")}" required>
                <label class="field mt-16" for="password">Password</label>
                <div class="pw">
                  <input class="input" id="password" name="password" type="password" autocomplete="current-password" placeholder="Your password" required>
                  <button type="button" class="pw-toggle" data-action="landing-show-password" aria-label="Show password">Show</button>
                </div>
                ${ui.error ? `<div class="notice err mt-16">${icon("alert")} ${esc(ui.error)}</div>` : ""}
                <button class="btn mt-16" type="submit" style="width:100%;justify-content:center" ${ui.busy ? "disabled" : ""}>${ui.busy ? "Signing in…" : "Sign in"}</button>
                <div class="tiny muted mt-16">${Store.shared
                  ? `${icon("cloud")} Signed in, you see your own children's records and nothing else.`
                  : `${icon("info")} Demo mode. Family sign-ins are issued from the staff portal — under <strong>Family portal</strong>, or from a pupil's own record — exactly as the office would issue them.`}</div>
                <div class="tiny muted mt-8">${icon("lock")} Accounts are locked after repeated failed attempts, exactly as the staff ones are.</div>
              </form>
            </div>`)}

            <div class="card access-card">
              <div class="card-head"><div><div class="eyebrow">Not signed up</div><h3>Getting a sign-in</h3></div></div>
              <div class="card-body">
                <p class="muted small">There is no sign-up form here, and that is deliberate: a portal account reaches a child's medical record and fee account, so the school creates it rather than letting anybody claim it.</p>
                <ol class="steps-line mt-16" style="grid-template-columns:1fr">
                  <li><span class="n">1</span><div><strong>Ask at the office</strong><p class="tiny muted">In person, or telephone ${esc(s.phone)}. Bring the email address you want to use.</p></div></li>
                  <li><span class="n">2</span><div><strong>They check who you are</strong><p class="tiny muted">Against the guardian already on your child's record — which is the point of the step.</p></div></li>
                  <li><span class="n">3</span><div><strong>You are given a password</strong><p class="tiny muted">In person or by telephone, never by email. It is yours to keep, and yours to change whenever you want to.</p></div></li>
                </ol>
                <div class="notice info small mt-16">${icon("info")} <strong>Two children here?</strong> One sign-in covers the whole family — ask the office to add the second child to the same account rather than making a new one.</div>
                <p class="tiny muted mt-16">Forgotten your password? The office can issue a new temporary one. Nobody at the school can read your existing one — it is not stored in a form anyone can read.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="band statement">
        <div class="wrap narrow">
          <div class="eyebrow">What we hold about your child</div>
          <p class="mt-24">You may ask the office at any time to see everything the school holds about your child, and to have anything wrong put right. Every change to a record is logged with the name of whoever made it.</p>
        </div>
      </section>

      </main>

      <footer class="site-foot">
        <div class="wrap flex between wrap" style="gap:24px">
          <div><div class="bold">${esc(s.name)} — family portal</div>
            <p class="tiny mt-8">Trouble signing in? The school office on ${esc(s.phone)}.</p></div>
          <div class="tiny" style="max-width:420px">
            <div class="bold">Keeping it yours</div>
            <p class="mt-8">Your sign-in reaches your child's record. Do not share it — if somebody else needs access, the office will give them their own. Sign out on a shared machine or a borrowed phone.</p>
          </div>
          <a class="tiny" href="#/">← Back to the school website</a>
        </div>
      </footer>
    </div>`;
  },
});


/* Chrome and Edge offer to install the site; they hand us the prompt and let us
   choose the moment. The right moment is the staff page, where the person is
   already deciding to use it for work. Safari has no such event — iOS installs
   through Share ▸ Add to Home Screen — so the card says that instead. */
addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  App._installPrompt = e;
  if (typeof App.render === "function" && !App.me()) App.render();
});
addEventListener("appinstalled", () => { App._installPrompt = null; App.toast?.("Installed. It is on your home screen."); });
