/* ==========================================================================
   Seed data for the demo. Replace with a real backend when going live.
   All dates are ISO (YYYY-MM-DD). Deterministic pseudo-random so the demo
   looks the same on every fresh load.
   ========================================================================== */

const SCHOOL = {
  name: "Ayanda Infant School",
  tagline: "Where Excellence Begins",
  address: "1 Chazzis Way, Manningdale, Bulawayo, Zimbabwe",
  phone: "+263 775111171",
  email: "info@ayandainfantschool.com",
  web: "www.ayandainfantschool.com",
  regNo: "",
  term: { name: "Term 3, 2026", start: "2026-09-01", end: "2026-12-03" },
  lockMinutes: 15,          // a register can be taken for this many minutes after a period starts, then it locks
  googleClientId: "",
  driveRootFolder: "",
};

/* One placeholder account so the school can get in and set itself up. Real
   staff are added in the portal; nothing about a real person ships in a file. */
const STAFF = [
  { id: "s01", first: "Head", last: "Teacher", title: "", role: "head", email: "head@ayandainfantschool.com", phone: "", started: "", pin: "1234" },
];

/* `capacity` is the number of children the school will put in that room. It
   ships empty on purpose: "small classes" is the first thing a parent wants a
   number for, and a number nobody at the school has confirmed is worse than
   no number at all. Set it in Settings and every public page starts quoting
   it; leave it null and the pages simply do not make the claim. */
const CLASSES = [
  { id: "c1", name: "ECD A — Sunbeams",  grade: "ECD A",   room: "Room 1", teacherId: null, assistantId: null, capacity: null },
  { id: "c2", name: "ECD B — Rainbows",  grade: "ECD B",   room: "Room 2", teacherId: null, assistantId: null, capacity: null },
  { id: "c3", name: "Grade 1 — Acacia",  grade: "Grade 1", room: "Room 3", teacherId: null, assistantId: null, capacity: null },
  { id: "c4", name: "Grade 2 — Baobab",  grade: "Grade 2", room: "Room 4", teacherId: null, assistantId: null, capacity: null },
];


/* Deterministic PRNG */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* No children ship with the software. The roll is entered by the school. */
function buildPupils() { return []; }

function isSchoolDay(d) { const w = d.getDay(); return w !== 0 && w !== 6; }
function iso(d) { return d.toISOString().slice(0, 10); }
function schoolDaysBetween(startIso, endIso) {
  const out = [];
  const d = new Date(startIso + "T12:00:00");
  const end = new Date(endIso + "T12:00:00");
  while (d <= end) { if (isSchoolDay(d)) out.push(iso(d)); d.setDate(d.getDate() + 1); }
  return out;
}

/* Attendance is taken per timetabled period. Keys are `${date}|${periodId}|${pupilId}`;
   periodId "reg" is the morning registration (the attendance of record for reports),
   p1–p6 are lesson registers taken by the team teaching that period.
   Seeds every school day up to today; today is seeded only for periods whose
   lock time has already passed, with a couple left unmarked to show the lock. */
function buildAttendance(pupils, todayIso, timetable) {
  if (!pupils.length) return {};
  const rnd = mulberry32(777);
  const days = schoolDaysBetween(SCHOOL.term.start, todayIso);
  const records = {};
  const chronic = new Set(pupils.filter(() => rnd() < 0.08).map(p => p.id));
  const now = new Date();
  const lockPassed = (date, start) => { const t = new Date(`${date}T${start}:00`); t.setMinutes(t.getMinutes() + SCHOOL.lockMinutes); return t < now; };
  const homeTeam = (cls) => TEAMS.find(t => t.teacherId === cls.teacherId) || TEAMS[0];
  days.forEach((date, di) => {
    const isToday = date === todayIso;
    const dayKey = DAYS[(new Date(date + "T12:00:00").getDay() + 6) % 7];
    CLASSES.forEach(cls => {
      const roll = pupils.filter(p => p.classId === cls.id);
      // morning status per pupil
      const morning = {};
      roll.forEach(p => {
        const r = rnd(); const pAbsent = chronic.has(p.id) ? 0.28 : 0.05;
        morning[p.id] = r < pAbsent ? "A" : r < pAbsent + 0.04 ? "L" : r < pAbsent + 0.055 ? "E" : "P";
      });
      const leavesEarly = roll.length && rnd() < 0.15 ? roll[Math.floor(rnd() * roll.length)].id : null;
      const periods = [{ id: "reg", start: PERIODS[0].start, team: homeTeam(cls) }, ...PERIODS.filter(x => !x.kind).map((x, k) => ({ id: x.id, start: x.start, team: TEAMS.find(t => t.id === timetable[cls.id][dayKey][k].t) }))];
      periods.forEach((per, pi) => {
        if (!per.team) return; // whole-school assembly has no register
        if (isToday && !lockPassed(date, per.start)) return;
        if (isToday && ((cls.id === "c2" && per.id === "reg") || (cls.id === "c3" && per.id === "p2"))) return; // left unmarked to show a missed register
        const mins = 3 + Math.floor(rnd() * 10);
        roll.forEach(p => {
          let status = morning[p.id];
          if (per.id !== "reg") { if (status === "L") status = "P"; if (leavesEarly === p.id && pi >= 5) status = "E"; }
          records[`${date}|${per.id}|${p.id}`] = {
            status,
            note: status === "E" ? (per.id === "reg" ? "Clinic appointment" : "Collected early") : status === "A" && per.id === "reg" && rnd() < 0.5 ? "No call from guardian" : "",
            markedBy: per.team.teacherId,
            markedAt: `${date}T${per.start.slice(0, 2)}:${String(Number(per.start.slice(3)) + mins).padStart(2, "0")}:00`,
          };
        });
      });
    });
  });
  return records;
}

const CHANNELS = [
  { id: "announcements", name: "Announcements", kind: "broadcast", desc: "Whole-school notices from the Head Teacher and HR" },
  { id: "staff-room",    name: "Staff Room",    kind: "channel",   desc: "General staff conversation" },
  { id: "ecd-team",      name: "ECD Team",      kind: "channel",   desc: "ECD A and ECD B teaching staff", members: ["s01", "s02", "s05", "s06", "s09", "s10"] },
  { id: "grade-team",    name: "Grades 1–2 Team", kind: "channel", desc: "Grade 1 and Grade 2 teaching staff", members: ["s01", "s02", "s07", "s08", "s11", "s12"] },
  { id: "admin-office",  name: "Admin Office",  kind: "channel",   desc: "Leadership, HR and finance", members: ["s01", "s02", "s03", "s04"] },
];

const MESSAGES = [];

const DOC_CATEGORIES = [
  { id: "policies",   name: "Policies & Procedures", desc: "Safeguarding, behaviour, health & safety", audience: ["*"] },
  { id: "curriculum", name: "Curriculum & Planning",  desc: "Schemes of work, weekly plans, assessment", audience: ["*"] },
  { id: "pupils",     name: "Pupil Records",          desc: "Admission forms, reports, consent", audience: ["head", "deputy", "hr", "bursar", "teacher"] },
  { id: "hr",         name: "HR & Staff",             desc: "Contracts, certificates, appraisals", audience: ["head", "hr"] },
  { id: "finance",    name: "Finance",                desc: "Fee schedules, budgets, invoices", audience: ["head", "deputy", "hr", "bursar"] },
  { id: "templates",  name: "Templates & Branding",   desc: "Letterhead, report card and letter templates", audience: ["*"] },
];

const DOCUMENTS = [
  { id: "d01", cat: "templates",  name: "Official Letterhead (PDF)",                 type: "pdf",   url: "assets/templates/Ayanda_Infant_School_Letterhead.pdf",           owner: "s01", updated: "2026-08-20", source: "local" },
  { id: "d02", cat: "templates",  name: "Letter to Parents — template",              type: "doc",   url: "assets/documents/Letter_to_Parents_Template.docx",              owner: "s01", updated: "2026-09-14", source: "local" },
  { id: "d03", cat: "templates",  name: "End-of-Term Progress Report Card",          type: "doc",   url: "assets/documents/End_of_Term_Report_Card.docx",                 owner: "s01", updated: "2026-09-14", source: "local" },
  { id: "d04", cat: "policies",   name: "Child Protection & Safeguarding Policy 2026", type: "pdf", url: "https://drive.google.com/file/d/EXAMPLE-safeguarding/view",     owner: "s01", updated: "2026-09-03", source: "drive" },
  { id: "d05", cat: "policies",   name: "Attendance & Punctuality Policy",           type: "pdf",   url: "https://drive.google.com/file/d/EXAMPLE-attendance/view",       owner: "s01", updated: "2026-01-15", source: "drive" },
  { id: "d06", cat: "policies",   name: "Health & Safety and First Aid Procedures",  type: "doc",   url: "https://docs.google.com/document/d/EXAMPLE-hs",                 owner: "s01", updated: "2026-05-12", source: "drive" },
  { id: "d07", cat: "policies",   name: "Staff Code of Conduct",                     type: "pdf",   url: "https://drive.google.com/file/d/EXAMPLE-conduct/view",          owner: "s01", updated: "2026-01-15", source: "drive" },
  { id: "d08", cat: "curriculum", name: "ECD A Scheme of Work — Term 3, 2026",       type: "sheet", url: "assets/documents/ECD_A_Scheme_of_Work_Term_3_2026.xlsx",        owner: "s01", updated: "2026-09-14", source: "local" },
  { id: "d09", cat: "curriculum", name: "ECD B Scheme of Work — Term 3, 2026",       type: "sheet", url: "assets/documents/ECD_B_Scheme_of_Work_Term_3_2026.xlsx",        owner: "s01", updated: "2026-09-14", source: "local" },
  { id: "d10", cat: "curriculum", name: "Grade 1 Weekly Lesson Plan — template",     type: "doc",   url: "assets/documents/Grade_1_Weekly_Lesson_Plan_Template.docx",     owner: "s01", updated: "2026-09-14", source: "local" },
  { id: "d11", cat: "curriculum", name: "Grade 2 Reading Assessment Rubric",         type: "doc",   url: "assets/documents/Grade_2_Reading_Assessment_Rubric.docx",       owner: "s01", updated: "2026-09-14", source: "local" },
  { id: "d12", cat: "pupils",     name: "Application for Admission form",            type: "doc",   url: "assets/documents/Admission_Form.docx",                          owner: "s01", updated: "2026-09-14", source: "local" },
  { id: "d13", cat: "pupils",     name: "Photo & Trip Consent Register 2026",        type: "sheet", url: "assets/documents/Photo_and_Trip_Consent_Register_2026.xlsx",    owner: "s01", updated: "2026-09-14", source: "local" },
  { id: "d14", cat: "hr",         name: "Contract of Employment — template",         type: "doc",   url: "assets/documents/Staff_Employment_Contract_Template.docx",      owner: "s01", updated: "2026-09-14", source: "local" },
  { id: "d15", cat: "hr",         name: "Staff Certificates & CPD Record 2026",      type: "sheet", url: "assets/documents/Staff_CPD_and_Certificates_Record_2026.xlsx",  owner: "s01", updated: "2026-09-14", source: "local" },
  { id: "d16", cat: "hr",         name: "Staff Appraisal Form 2026",                 type: "doc",   url: "assets/documents/Staff_Appraisal_Form_2026.docx",               owner: "s01", updated: "2026-09-14", source: "local" },
  { id: "d19", cat: "hr",         name: "Teacher Recruitment & Interview Pack",      type: "doc",   url: "assets/documents/Teacher_Recruitment_and_Interview_Pack.docx",  owner: "s01", updated: "2026-09-14", source: "local" },
  { id: "d17", cat: "finance",    name: "Term 3, 2026 Fee Schedule",                 type: "sheet", url: "assets/documents/Term_3_2026_Fee_Schedule.xlsx",                owner: "s01", updated: "2026-09-14", source: "local" },
  { id: "d18", cat: "finance",    name: "Budget vs Actual 2026",                     type: "sheet", url: "assets/documents/Budget_vs_Actual_2026.xlsx",                   owner: "s01", updated: "2026-09-14", source: "local" },
];

/* --- Weekly timetable -------------------------------------------------------
   Every class keeps the same teaching pair (main teacher + assistant) for every
   period, so the timetable is per class. Days are mon..fri; each day lists the
   subject for periods 1–6 in order. */
const PERIODS = [
  { id: "reg", label: "Registration", start: "08:30", end: "08:45", kind: "admin" },
  { id: "p1",  label: "Period 1",     start: "08:45", end: "09:25" },
  { id: "p2",  label: "Period 2",     start: "09:25", end: "10:05" },
  { id: "br",  label: "Break",        start: "10:05", end: "10:25", kind: "break" },
  { id: "p3",  label: "Period 3",     start: "10:25", end: "11:05" },
  { id: "p4",  label: "Period 4",     start: "11:05", end: "11:45" },
  { id: "lu",  label: "Lunch",        start: "11:45", end: "12:15", kind: "break" },
  { id: "p5",  label: "Period 5",     start: "12:15", end: "12:55" },
  { id: "p6",  label: "Period 6",     start: "12:55", end: "13:35" },
];
const DAYS = ["mon", "tue", "wed", "thu", "fri"];
const DAY_LABELS = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday" };
const SUBJECTS = {
  "Language & Communication": "blue", "Mathematics & Science": "green", "Physical Education & Health": "amber", "Visual & Performing Arts": "gold",
  "Heritage & Social": "navy", "Story & Rest": "grey", "Outdoor Play": "amber", "Indigenous Language": "blue",
  "English": "blue", "isiNdebele": "navy", "Mathematics": "green", "Science & Technology": "green", "Heritage-Social Studies": "navy",
  "VPA": "gold", "PE": "amber", "ICT": "grey", "FAREME": "gold", "Guided Reading": "blue", "Library": "grey", "Assembly": "red",
};
/* Teaching teams: a main teacher + assistant who always teach the subjects listed
   below, for every class. So a class meets the same pair every time it has a
   given subject, and each pair moves between classes through the day. */
/* A teaching team is a main teacher and an assistant who together cover a set
   of subjects across every class. They are created once the school has staff. */
const TEAMS = [];

/* Builds a clash-free week: in every period each of the four teams is with a
   different class (a rotating Latin square), Monday period 1 is whole-school
   assembly, and ECD classes end the day with Story & Rest led by their home team. */
function buildTimetable() {
  /* Nothing to timetable until there are teams to timetable. */
  if (!TEAMS.length) return Object.fromEntries(CLASSES.map(c => [c.id, Object.fromEntries(DAYS.map(d => [d, []]))]));
  const tt = {}; const counters = {};
  const next = (cls, team, band) => { const key = cls.id + team.id; counters[key] = (counters[key] || 0) + 1; const list = team[band]; return list[(counters[key] - 1) % list.length]; };
  CLASSES.forEach((cls, i) => {
    tt[cls.id] = {}; const band = cls.grade.startsWith("ECD") ? "ecd" : "grade";
    DAYS.forEach((d, di) => {
      const row = [];
      for (let k = 0; k < 6; k++) {
        if (di === 0 && k === 0) { row.push({ s: "Assembly", t: null }); continue; }
        if (k === 5) {
          if (band === "ecd") { row.push({ s: "Story & Rest", t: TEAMS[i].id }); continue; }
          const team = TEAMS[(i === 2) === (di % 2 === 0) ? 2 : 3]; // t3 / t4 alternate between the two Grade classes
          row.push({ s: next(cls, team, band), t: team.id }); continue;
        }
        const team = TEAMS[(i + k + di) % 4];
        row.push({ s: next(cls, team, band), t: team.id });
      }
      tt[cls.id][d] = row;
    });
  });
  return tt;
}

/* --- Recruitment -------------------------------------------------------------- */
const STAGES = [
  { id: "applied",      label: "Applied",            desc: "Application logged; documents saved to Drive" },
  { id: "shortlisted",  label: "Shortlisted",        desc: "Meets all essential criteria" },
  { id: "interview",    label: "Interview",          desc: "Panel interview scheduled or held" },
  { id: "demo",         label: "Demo lesson",        desc: "Observed lesson with the class" },
  { id: "checks",       label: "References & checks", desc: "Two references, police clearance, qualification verified" },
  { id: "offer",        label: "Offer made",         desc: "Offer letter sent; contract being prepared" },
  { id: "appointed",    label: "Appointed",          desc: "Contract signed; portal account to be created by HR" },
  { id: "unsuccessful", label: "Unsuccessful",       desc: "Informed within 5 working days" },
];
const SCORE_CRITERIA = [
  { key: "qual",          label: "Qualifications & experience" },
  { key: "pedagogy",      label: "Early-years pedagogy" },
  { key: "assessment",    label: "Assessment & progress" },
  { key: "management",    label: "Classroom management & inclusion" },
  { key: "safeguarding",  label: "Safeguarding awareness" },
  { key: "communication", label: "Communication & parents" },
  { key: "demo",          label: "Demo lesson" },
];
const VACANCIES = [];
const CANDIDATES = [];

const EVENTS = [
  { id: "e01", date: "2026-09-01", title: "Term 3 opens",                    kind: "term",    colour: "gold" },
  { id: "e02", date: "2026-09-09", title: "ECD planning meeting 14:30",      kind: "meeting", colour: "" },
  { id: "e03", date: "2026-09-14", title: "Leadership meeting 10:00",        kind: "meeting", colour: "" },
  { id: "e04", date: "2026-09-18", title: "Safeguarding policy sign-off due", kind: "deadline", colour: "red" },
  { id: "e05", date: "2026-09-21", title: "Grade 2 reading assessments begin", kind: "academic", colour: "green" },
  { id: "e06", date: "2026-09-25", title: "Parents' Consultation Afternoon", kind: "event",   colour: "gold" },
  { id: "e07", date: "2026-10-09", title: "Sports Day",                      kind: "event",   colour: "gold" },
  { id: "e08", date: "2026-10-19", title: "Mid-term break (19–23 Oct)",      kind: "term",    colour: "" },
  { id: "e09", date: "2026-11-27", title: "Prize Giving & Concert",          kind: "event",   colour: "gold" },
  { id: "e10", date: "2026-12-03", title: "Term 3 closes",                   kind: "term",    colour: "gold" },
  { id: "e11", date: "2026-09-16", title: "Staff meeting 15:00",             kind: "meeting", colour: "" },
  { id: "e12", date: "2026-09-30", title: "Fire drill 10:30",                kind: "event",   colour: "red" },
];

const WELFARE = [];


/* ==========================================================================
   STUDENT INFORMATION SYSTEM
   One pupil record, from first enquiry through to alumni: admissions,
   assessment, billing, guardian communication and configuration.
   ========================================================================== */

/* --- Configuration (changed in the portal, not in code) ------------------- */
const GRADE_SCALE = [
  { code: "E", label: "Exceeding",  desc: "Working above the expected standard", min: 80, colour: "green" },
  { code: "S", label: "Secure",     desc: "Working at the expected standard",    min: 65, colour: "blue"  },
  { code: "D", label: "Developing", desc: "Working towards the standard",        min: 50, colour: "amber" },
  { code: "B", label: "Beginning",  desc: "Needs significant support",           min: 0,  colour: "red"   },
];
function gradeFor(pct) { return GRADE_SCALE.find(g => pct >= g.min) || GRADE_SCALE[GRADE_SCALE.length - 1]; }

const INTAKES = [
  { id: "i1", name: "January 2027", opens: "2026-08-03", closes: "2026-10-30", starts: "2027-01-12", places: { "ECD A": 16, "ECD B": 4, "Grade 1": 3, "Grade 2": 2 }, status: "open" },
  { id: "i2", name: "May 2027",     opens: "2027-01-19", closes: "2027-03-26", starts: "2027-05-04", places: { "ECD A": 6, "ECD B": 2, "Grade 1": 1, "Grade 2": 1 }, status: "planned" },
];

const FEE_ITEMS = [
  { id: "f_tuition_ecd",   name: "Tuition — ECD",          amount: 380, compulsory: true,  grades: ["ECD A", "ECD B"] },
  { id: "f_tuition_grade", name: "Tuition — Grade 1 & 2",  amount: 420, compulsory: true,  grades: ["Grade 1", "Grade 2"] },
  { id: "f_levy",          name: "Development levy",       amount: 40,  compulsory: true,  grades: ["ECD A", "ECD B", "Grade 1", "Grade 2"] },
  { id: "f_mat_ecd",       name: "Learning materials — ECD", amount: 25, compulsory: true, grades: ["ECD A", "ECD B"] },
  { id: "f_mat_grade",     name: "Learning materials — Grade", amount: 35, compulsory: true, grades: ["Grade 1", "Grade 2"] },
  /* Meals are not an extra. The school's position is that no child goes
     through a day here without eating, so the meal is billed with the tuition
     and every figure quoted on the public pages already contains it. */
  { id: "f_meals",         name: "Meals",                  amount: 90,  compulsory: true,  grades: ["ECD A", "ECD B", "Grade 1", "Grade 2"] },
  { id: "f_transport",     name: "Transport (optional)",   amount: 120, compulsory: false, grades: ["ECD A", "ECD B", "Grade 1", "Grade 2"] },
];
const FEE_RULES = { siblingDiscount: 0.10, earlySettlement: 0.05, lateSurcharge: 0.05, instalments: 3, currency: "USD" };

/* Subjects that carry a mark, by band. Attendance and conduct are reported separately. */
const ASSESSED = {
  ecd:   ["Language & Communication", "Mathematics & Science", "Heritage & Social", "Visual & Performing Arts", "Physical Education & Health"],
  grade: ["English", "Mathematics", "Science & Technology", "isiNdebele", "Heritage-Social Studies", "VPA", "PE", "ICT"],
};
/* --- the enrichment curriculum -------------------------------------------
   From the school's own Strategic Plan Vol 2. The point the plan makes, and
   the point the public page has to make, is that none of this is an
   after-school club: the action steps put every one of these inside mainstream
   lessons, for every learner, as part of the ordinary week.

   Kept separate from ASSESSED on purpose. ASSESSED drives the gradebook, and
   whether these carry a mark is the school's decision to make — move any of
   them across when it has been made. */
const ENRICHMENT = [
  {
    id: "sign",
    name: "Sign Language",
    line: "Every child, not only the deaf ones",
    when: "Daily routines, assemblies and greetings, plus vocabulary inside ordinary lessons",
    body: "Basic Sign Language vocabulary — tied to local culture, stories and the themes of the week — is embedded in mainstream lessons for all learners, and practised every day in registration, assembly and greetings. It is taught as a language worth having, not as a provision for a few.",
    who: "Hearing Impairment Specialist with the class teachers",
  },
  {
    id: "digital",
    name: "Digital literacy",
    line: "Play-based, from the infant years",
    when: "Timetabled modules across all infant classrooms",
    body: "Play-based digital literacy runs across every infant classroom rather than in a computer club. The aim at this age is early fluency and visual logic — knowing what a machine is for and how to think in steps — not software training.",
    who: "ICT Lead Teacher with the class teachers",
  },
  {
    id: "ai",
    name: "Creative technology and AI",
    line: "Introductory, and hands-on",
    when: "Timetabled modules across all infant classrooms",
    body: "Introductory creative-technology and AI modules, using visual creation tools alongside tactile materials and local heritage narratives. Children make things with it; the point is confidence and curiosity, not code.",
    who: "ICT Lead Teacher with the curriculum lead",
  },
  {
    id: "heritage",
    name: "Heritage and local languages",
    line: "Taught and assessed like any other subject",
    when: "On the timetable every week",
    body: "isiNdebele, Heritage and Social Studies and religious and moral education are timetabled, taught by specialists and assessed like any other subject. Local heritage narratives are combined with digital media and tactile materials rather than kept to one lesson a week.",
    who: "Heritage and Languages teaching pair",
  },
];

/* The specialists named in the Strategic Plan. Kept as data so the public page
   cannot claim a post the school has not filled. */
const SPECIALISTS = [
  { role: "Learning Disabilities Specialist", basis: "Full-time",
    does: "Leads standardised screening for every mainstream learner in their first term, designs Individualised Education Plans, and co-plans weekly with the class teachers." },
  { role: "Hearing Impairment Specialist", basis: "Part-time",
    does: "Targeted hearing screening and acoustic observation for flagged learners, auditory accommodations, and the Sign Language embedded across the school." },
];

const ASSESSMENT_KINDS = [
  { id: "continuous", label: "Continuous", weight: 0.4, desc: "Class work, observation and short checks through the term" },
  { id: "topic",      label: "Topic test", weight: 0.3, desc: "End of a unit of work" },
  { id: "endterm",    label: "End of term", weight: 0.3, desc: "Formal end-of-term assessment" },
];

const INTEGRATIONS = [
  { id: "gdrive",   name: "Google Drive",        cat: "Documents",     status: "connected", note: "Document library and admission files" },
  { id: "gmail",    name: "Gmail / Workspace",   cat: "Communication", status: "connected", note: "Guardian email sent from the pupil record" },
  { id: "gcal",     name: "Google Calendar",     cat: "Calendar",      status: "available", note: "Two-way sync of the school calendar" },
  { id: "sms",      name: "Econet Bulk SMS",     cat: "Communication", status: "connected", note: "SMS to guardians; delivery receipts logged" },
  { id: "ecocash",  name: "EcoCash Business",    cat: "Payments",      status: "available", note: "Mobile money fee collection with automatic receipting" },
  { id: "paynow",   name: "Paynow",              cat: "Payments",      status: "available", note: "Card and mobile payment gateway" },
  { id: "sheets",   name: "Google Sheets export", cat: "Reporting",    status: "connected", note: "Scheduled export of attendance and fee data" },
  { id: "api",      name: "Portal REST API",     cat: "Platform",      status: "available", note: "Read/write access for anything not covered above" },
];

/* --- Admissions ----------------------------------------------------------- */
const ADMISSION_STAGES = [
  { id: "enquiry",     label: "Enquiry",        desc: "Interest registered; prospectus sent" },
  { id: "application", label: "Application",    desc: "Form completed and fee paid" },
  { id: "documents",   label: "Documents",      desc: "Birth certificate, clinic card, photo, previous report" },
  { id: "visit",       label: "Visit & baseline", desc: "Settling-in visit and baseline observation" },
  { id: "offer",       label: "Offer made",     desc: "Place offered; acceptance and deposit awaited" },
  { id: "accepted",    label: "Accepted",       desc: "Place accepted and deposit received" },
  { id: "enrolled",    label: "Enrolled",       desc: "Pupil record created; class allocated" },
  { id: "declined",    label: "Not proceeding", desc: "Withdrawn by the family or place not offered" },
];
const REQUIRED_DOCS = [
  { key: "birth",  label: "Birth certificate" },
  { key: "clinic", label: "Clinic / immunisation card" },
  { key: "photo",  label: "Passport photograph" },
  { key: "report", label: "Previous school report" },
  { key: "consent", label: "Signed consent & data form" },
];
/* --- the questions a family actually asks ---------------------------------
   Every answer below is grounded in something this system already does or
   holds: the admission stages, the fee rules, the timetable, the grade scale,
   the specialist posts. Nothing here is an outcome the school has promised on
   a parent's behalf, and nothing claims a result.

   Two questions a family will ask that are NOT answered here, because only
   the school can answer them, are listed in the README: how many children are
   in a class (set `capacity` on each class and the pages will quote it), and
   which schools recent leavers have gone on to.
   ------------------------------------------------------------------------ */
const SITE_FAQ = [
  {
    group: "Before you decide anything",
    items: [
      { q: "Can we see the school first, before we commit to anything?",
        a: "Yes — and it is a step in the process rather than a favour. A settling-in visit and a baseline observation happen <strong>before</strong> a place is offered, not after. You watch an ordinary morning, your child spends time in the room they would be in, and we see them before either side decides. It costs nothing to enquire and nothing to visit." },
      { q: "What will it actually cost us?",
        a: "Every figure is printed on the fees page for every year group, item by item, before you ask for it. A term is payable in three instalments. A second child takes ten per cent off, and settling a term early takes five per cent off again. The figure includes the daily meal, because the meal is not an extra here. Transport is the one thing priced separately, and it is genuinely optional." },
      { q: "How do we get in touch without filling in a form?",
        a: "Telephone the office, or send a WhatsApp message. Somebody answers between half past eight and half past three, Monday to Friday. You do not have to fill in anything to ask a question." },
    ],
  },
  {
    group: "The teaching",
    items: [
      { q: "Two adults in every lesson — is that really every lesson?",
        a: "Every lesson. Each class has a main teacher and an assistant teacher together; one leads and one works with the children who need a second explanation or a harder question. The register at the start of the period is taken by that pair, which is how the school can tell you it happened." },
      { q: "Is this the national curriculum, or something of your own?",
        a: "The national curriculum, taught by subject specialists rather than one teacher covering everything. Progress is reported every term against four standards — exceeding, secure, developing, beginning — in writing, for every subject. We do not publish positions in class. A seven-year-old is not competing with the child sitting next to them." },
      { q: "Sign Language, digital literacy, creative technology — are those extras we pay for?",
        a: "No. They are on the ordinary timetable, taught in class to every child in the school, and there is no line for any of them on your invoice. Most schools sell these after three o'clock to the families who can stay late and pay more. That is the difference, and it is the whole reason they are on the timetable here." },
      { q: "What if our child needs more help than the others?",
        a: "Every child is screened in their first term — not only the ones somebody has already worried about. The school employs a Learning Disabilities Specialist full-time and a Hearing Impairment Specialist part-time, so what the screening finds is acted on by somebody already on the staff, in the classroom your child is already in, rather than added to a waiting list. Screening identifies what a child needs. It is not a diagnosis and we do not promise an outcome." },
    ],
  },
  {
    group: "The practical things",
    items: [
      { q: "What happens after Grade 2?",
        a: "Ayanda takes children to the end of Grade 2 and then they move on — so it is a fair question to ask now, at the start. What you leave with is the complete record: every termly report, the attendance history, every mark behind every grade. The next school begins with evidence about your child instead of a blank page. Ask the office where recent leavers have gone; they will tell you." },
      { q: "Can we pay in instalments, and what if we fall behind?",
        a: "Three instalments a term, and the dates are on your fee account in the family portal from the day your child starts. A late instalment carries a five per cent surcharge. If money is going to be tight in a particular term, speak to the bursar <strong>before</strong> the due date rather than after it — that conversation is far easier to have early." },
      { q: "Are meals included?",
        a: "Yes, and they are not optional. A child here eats every school day, and the meal is billed with the tuition rather than offered as an extra — so there is no arrangement under which one child eats and the child beside them does not. It is already inside every figure printed on the fees page. Transport is the one thing priced separately, and that one is genuinely optional: a family doing their own lift pays nothing for it." },
      { q: "How will we know what is happening, day to day?",
        a: "Through the family portal, on your phone. Attendance as it was actually taken — period by period, not a monthly summary — marks as the teachers enter them, your fee account as the office holds it, and messages both ways. An unexplained absence at morning registration sends you a message that morning, not a note at the end of term." },
      { q: "Is the school registered?",
        a: "Ask to see the certificate of registration when you visit, along with the fire safety certificate and the public liability cover. Any school should be able to put all three in front of you inside a minute, and you should ask that of every school you look at — including this one." },
    ],
  },
];

const APPLICANTS = [];

/* --- Alumni --------------------------------------------------------------- */
const ALUMNI = [];

/* --- Guardian communication ---------------------------------------------- */
const COMM_TEMPLATES = [
  { id: "ct1", name: "Absence — same day",     channel: "sms",   subject: "", body: "Good morning. {pupil} has been marked absent at registration today. Please reply to confirm the reason. — Ayanda Infant School" },
  { id: "ct2", name: "Late collection",        channel: "sms",   subject: "", body: "Good afternoon. {pupil} is still waiting to be collected. Please let the office know your expected time. — Ayanda Infant School" },
  { id: "ct3", name: "Fee reminder",           channel: "email", subject: "Term 3 fees — {pupil}", body: "Dear {guardian},\n\nOur records show an outstanding balance of {balance} on the Term 3 account for {pupil}. The next instalment was due on {due}.\n\nPlease contact the Bursar if you would like to discuss a payment plan.\n\nKind regards,\nAyanda Infant School" },
  { id: "ct4", name: "Progress update",        channel: "email", subject: "Progress update — {pupil}", body: "Dear {guardian},\n\n{pupil} is making good progress this term. {note}\n\nWe look forward to seeing you at the Parents' Consultation Afternoon.\n\nKind regards,\n{staff}" },
  { id: "ct5", name: "Offer of a place",       channel: "email", subject: "Offer of a place — {pupil}", body: "Dear {guardian},\n\nWe are pleased to offer {pupil} a place in {grade} for the January 2027 intake. Please confirm acceptance and pay the deposit by {expires} to secure the place.\n\nKind regards,\nAyanda Infant School" },
  { id: "ct6", name: "Whole-class notice",     channel: "email", subject: "{class} — notice", body: "Dear parents and guardians,\n\n{note}\n\nKind regards,\n{staff}" },
];

/* Assessments so far this term: two per assessed subject per class, with marks
   for every pupil. Deterministic, and each pupil keeps a consistent ability so
   the report card and the analytics agree. */
function buildAssessments(pupils, todayIso) {
  if (!pupils.length) return [];
  const rnd = mulberry32(4242);
  const out = [];
  const ability = {};
  pupils.forEach(p => { ability[p.id] = 0.45 + rnd() * 0.5; });
  const weeks = [0, 1];  // term is two weeks old; one early check and one topic test per subject
  CLASSES.forEach(cls => {
    const band = cls.grade.startsWith("ECD") ? "ecd" : "grade";
    ASSESSED[band].forEach((subject, si) => {
      weeks.forEach((wk, wi) => {
        const d = new Date(SCHOOL.term.start + "T12:00:00");
        d.setDate(d.getDate() + wk * 7 + (si % 5));
        while (!isSchoolDay(d)) d.setDate(d.getDate() + 1);
        const date = iso(d);
        if (date > todayIso) return;
        const kind = wi === 0 ? "continuous" : "topic";
        const max = band === "ecd" ? 20 : 30;
        const marks = {};
        Store_pupilsOf(pupils, cls.id).forEach(p => {
          const noise = (rnd() - 0.5) * 0.22;
          const pct = Math.max(0.28, Math.min(1, ability[p.id] + noise + (si % 3 === 0 ? 0.05 : 0)));
          marks[p.id] = Math.round(pct * max);
        });
        out.push({ id: `as_${cls.id}_${si}_${wi}`, classId: cls.id, subject, kind, max, date, title: `${subject} — ${kind === "continuous" ? "class work check" : "topic test"} ${wi + 1}`, by: cls.teacherId, marks, published: true });
      });
    });
  });
  return out;
}
function Store_pupilsOf(pupils, classId) { return pupils.filter(p => p.classId === classId && p.status === "active"); }

/* Term 3 invoices: one per pupil, three instalments, with payments recorded
   against most of them. A handful are deliberately left in arrears. */
function buildBilling(pupils, todayIso) {
  if (!pupils.length) return { invoices: [], payments: [] };
  const rnd = mulberry32(31337);
  const invoices = []; const payments = [];
  const due = ["2026-09-04", "2026-10-09", "2026-11-13"];
  pupils.forEach((p, i) => {
    const grade = CLASSES.find(c => c.id === p.classId).grade;
    const items = FEE_ITEMS.filter(f => f.grades.includes(grade) && f.compulsory).map(f => ({ id: f.id, name: f.name, amount: f.amount }));
    const takesTransport = rnd() < 0.25;
    items.push({ id: "f_meals", name: "Meals", amount: 90 });
    if (takesTransport) items.push({ id: "f_transport", name: "Transport (optional)", amount: 120 });
    const gross = items.reduce((n, it) => n + it.amount, 0);
    const sibling = rnd() < 0.18;
    const discount = sibling ? Math.round(gross * FEE_RULES.siblingDiscount) : 0;
    const total = gross - discount;
    const inv = { id: `inv_${p.id}`, pupilId: p.id, term: SCHOOL.term.name, issued: "2026-08-24", items, discount, discountReason: sibling ? "Sibling discount (10%)" : "", total, instalments: due.map((d, k) => ({ n: k + 1, due: d, amount: Math.round((total / 3) * 100) / 100 })) };
    invoices.push(inv);
    /* payment behaviour: most families are up to date, a few part-paid, a few not yet */
    const r = rnd();
    const dueSoFar = due.filter(d => d <= todayIso).length;
    const part = r > 0.84 && r <= 0.92;      // paid roughly half of the instalment
    const nothing = r > 0.92;                 // nothing received yet
    const payFor = nothing ? 0 : dueSoFar;
    for (let k = 0; k < payFor; k++) {
      let amt = inv.instalments[k].amount;
      if (part && k === payFor - 1) amt = Math.round(amt * 0.5 * 100) / 100;
      const pd = new Date(due[k] + "T12:00:00"); pd.setDate(pd.getDate() - Math.floor(rnd() * 6));
      const method = rnd() < 0.5 ? "EcoCash" : rnd() < 0.6 ? "Bank transfer" : "Cash";
      payments.push({ id: `pay_${p.id}_${k}`, invoiceId: inv.id, pupilId: p.id, date: iso(pd), amount: amt, method, ref: `${method === "EcoCash" ? "EC" : method === "Cash" ? "RC" : "BT"}${String(100000 + Math.floor(rnd() * 899999))}`, by: "s04" });
    }
  });
  return { invoices, payments };
}

/* Guardian communication already sent this term, logged against the pupil. */
function buildComms(pupils, attendance, todayIso) {
  if (!pupils.length) return [];
  const out = [];
  const push = (o) => out.push({ id: `cm${String(out.length + 1).padStart(3, "0")}`, status: "delivered", ...o });
  const byClass = (cid) => pupils.filter(p => p.classId === cid);
  push({ pupilId: null, classId: null, channel: "email", to: "All guardians", subject: "Term 3 opens Monday 1 September", body: "Dear parents and guardians,\n\nTerm 3 opens on Monday 1 September. The school day now runs 08:30 to 13:35. Registration closes fifteen minutes after the start of the day.\n\nKind regards,\nThe Head Teacher", sentBy: "s01", sentAt: "2026-08-28T16:10:00", recipients: pupils.length });
  push({ pupilId: null, classId: null, channel: "sms", to: "All guardians", subject: "", body: "Reminder: Parents' Consultation Afternoon is on Friday 25 September, 14:00-16:30. Book a slot with the office. — Ayanda Infant School", sentBy: "s03", sentAt: "2026-09-10T11:02:00", recipients: pupils.length });
  push({ pupilId: null, classId: "c4", channel: "email", to: "Grade 2 — Baobab guardians", subject: "Grade 2 — reading assessments from 21 September", body: "Dear parents and guardians,\n\nGrade 2 reading assessments begin on 21 September. Please continue to hear your child read for ten minutes each evening and sign the reading record.\n\nKind regards,\nThe class teacher", sentBy: "s08", sentAt: "2026-09-11T15:40:00", recipients: byClass("c4").length });
  /* today's absentees at registration got an automatic SMS */
  Object.entries(attendance).forEach(([k, v]) => {
    const [date, period, pupilId] = k.split("|");
    if (date !== todayIso || period !== "reg" || v.status !== "A") return;
    const p = pupils.find(x => x.id === pupilId); if (!p) return;
    push({ pupilId: p.id, classId: p.classId, channel: "sms", to: p.guardian.phone, subject: "", body: `Good morning. ${p.first} has been marked absent at registration today. Please reply to confirm the reason. — Ayanda Infant School`, sentBy: "s03", sentAt: `${todayIso}T08:52:00`, recipients: 1, automatic: true });
  });
  return out.sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}


/* ==========================================================================
   GOVERNANCE — the Director and Board Secretary's tier
   The Head Teacher runs the school day to day; these two answer for it to the
   board, to the Ministry and to the bank.
   ========================================================================== */

const BOARD = [];

/* Everything the school must hold, be able to produce, and renew on time. */
/* What the school must hold to open its doors. Reference numbers and dates are
   filled in from the certificates themselves. */
const STATUTORY = [
  { id: "st1", name: "Certificate of Registration",       ref: "", authority: "Ministry of Primary and Secondary Education", issued: "", expires: "", owner: "s01" },
  { id: "st2", name: "Council premises & health licence", ref: "", authority: "Bulawayo City Council",                       issued: "", expires: "", owner: "s01" },
  { id: "st3", name: "Public liability insurance",        ref: "", authority: "",                                            issued: "", expires: "", owner: "s01" },
  { id: "st4", name: "Tax clearance (ITF263)",            ref: "", authority: "ZIMRA",                                       issued: "", expires: "", owner: "s01" },
  { id: "st5", name: "Fire safety certificate",           ref: "", authority: "Bulawayo Fire Brigade",                       issued: "", expires: "", owner: "s01" },
  { id: "st6", name: "NSSA employer registration",        ref: "", authority: "National Social Security Authority",          issued: "", expires: "", owner: "s01" },
  { id: "st7", name: "Data protection registration",      ref: "", authority: "POTRAZ",                                      issued: "", expires: "", owner: "s01" },
];

/* Board-level view of the money. The Bursar works the invoices; the Director
   and Secretary watch the year against budget. Figures are placeholders. */
const BUDGET = [
  { id: "bu1", line: "Fee income",              kind: "income", budget: 0, actual: 0 },
  { id: "bu2", line: "Registration & levies",   kind: "income", budget: 9600,   actual: 7920  },
  { id: "bu3", line: "Salaries & wages",        kind: "cost",   budget: 0, actual: 0 },
  { id: "bu4", line: "NSSA & statutory",        kind: "cost",   budget: 5200,  actual: 3870  },
  { id: "bu5", line: "Rent & rates",            kind: "cost",   budget: 12000, actual: 9000  },
  { id: "bu6", line: "Utilities & water",       kind: "cost",   budget: 7200,  actual: 6440  },
  { id: "bu7", line: "Learning materials",      kind: "cost",   budget: 6400,  actual: 5310  },
  { id: "bu8", line: "Meals & catering",        kind: "cost",   budget: 8800,  actual: 6980  },
  { id: "bu9", line: "Maintenance & grounds",   kind: "cost",   budget: 4800,  actual: 4120  },
  { id: "bu10", line: "Insurance & compliance", kind: "cost",   budget: 3600,  actual: 3600  },
  { id: "bu11", line: "Marketing & admissions", kind: "cost",   budget: 2400,  actual: 1180  },
];

const PROJECTS = [];

const STRATEGY = { rollTarget: 96, targetYear: "January 2029", staffRatio: 12, collectionTarget: 95, attendanceTarget: 95 };

const SEED_VERSION = 7;

function buildSeed(todayIso) {
  const pupils = buildPupils();
  const timetable = buildTimetable();
  const billing = buildBilling(pupils, todayIso);
  const attendance = buildAttendance(pupils, todayIso, timetable);
  return {
    version: SEED_VERSION,
    seededOn: todayIso,
    school: { ...SCHOOL },
    staff: STAFF.map(s => ({ ...s, grants: [], revokes: [], extraClasses: [], active: true })),
    classes: CLASSES.map(c => ({ ...c })),
    pupils,
    attendance,
    /* --- family & student portal --- */
    guardians: [],        // a guardian's sign-in, bound to their own children
    absences: [],         // absence notes families send in from the portal
    channels: CHANNELS.map(c => ({ ...c })),
    messages: MESSAGES.map(m => ({ ...m })),
    reads: {},            // `${staffId}|${channel}` -> ISO of last read
    docCategories: DOC_CATEGORIES.map(c => ({ ...c })),
    documents: DOCUMENTS.map(d => ({ ...d })),
    events: EVENTS.map(e => ({ ...e })),
    welfare: WELFARE.map(w => ({ ...w })),
    teams: TEAMS.map(t => ({ ...t, ecd: [...t.ecd], grade: [...t.grade] })),
    timetable,
    vacancies: VACANCIES.map(v => ({ ...v })),
    candidates: CANDIDATES.map(c => ({ ...c, scores: { ...c.scores } })),
    /* --- student information system --- */
    intakes: INTAKES.map(i => ({ ...i, places: { ...i.places } })),
    applicants: APPLICANTS.map(a => ({ ...a, guardian: { ...a.guardian }, docs: { ...a.docs } })),
    assessments: buildAssessments(pupils, todayIso),
    gradeScale: GRADE_SCALE.map(g => ({ ...g })),
    feeItems: FEE_ITEMS.map(f => ({ ...f, grades: [...f.grades] })),
    feeRules: { ...FEE_RULES },
    invoices: billing.invoices,
    payments: billing.payments,
    comms: buildComms(pupils, attendance, todayIso),
    commTemplates: COMM_TEMPLATES.map(t => ({ ...t })),
    alumni: ALUMNI.map(a => ({ ...a })),
    integrations: INTEGRATIONS.map(i => ({ ...i })),
    /* --- governance (Director and Board Secretary) --- */
    board: BOARD.map(b => ({ ...b, present: [...b.present], apologies: [...b.apologies], resolutions: b.resolutions.map(r => ({ ...r })) })),
    statutory: STATUTORY.map(x => ({ ...x })),
    budget: BUDGET.map(x => ({ ...x })),
    projects: PROJECTS.map(x => ({ ...x })),
    strategy: { ...STRATEGY },
    audit: [],
  };
}

/* --- what the public website may be told ---------------------------------
   The site quotes the school's own figures — the fees, the places left in
   each intake, the class names, the grading words — and until now it quoted
   them from the constants in this file. So the office could move an intake or
   change a fee in the portal and the website would go on advertising last
   term's, which is worse than saying nothing: a family arrives at the visit
   with a number in their head that nobody at the school recognises.

   This is the slice the office publishes. It is named field by field rather
   than by exclusion, so a column added to a setting later does not become
   public by accident — a class's teacher ids, for instance, are staff
   identifiers and are not here, and neither is the door code.
   ------------------------------------------------------------------------ */
function publicFacts(source) {
  const src = source || {};
  const s = src.school || {};
  return {
    school: {
      name: s.name || "", tagline: s.tagline || "", address: s.address || "",
      phone: s.phone || "", email: s.email || "", web: s.web || "", regNo: s.regNo || "",
      term: s.term ? { ...s.term } : null,
      lockMinutes: s.lockMinutes ?? 15,
    },
    classes: (src.classes || []).map(c => ({
      id: c.id, name: c.name, grade: c.grade, room: c.room, capacity: c.capacity ?? null,
    })),
    intakes: (src.intakes || []).map(i => ({
      id: i.id, name: i.name, opens: i.opens, closes: i.closes, starts: i.starts,
      status: i.status, places: { ...(i.places || {}) },
    })),
    feeItems: (src.feeItems || []).map(f => ({
      id: f.id, name: f.name, amount: f.amount, compulsory: !!f.compulsory, grades: [...(f.grades || [])],
    })),
    feeRules: { ...(src.feeRules || {}) },
    gradeScale: (src.gradeScale || []).map(g => ({ ...g })),
  };
}

/* Shared with the backend: server/seed.js requires this file to populate the
   database with the same demo school the browser build uses. */
if (typeof module === "object" && module.exports) module.exports = {
  SCHOOL, STAFF, CLASSES, PERIODS, DAYS, DAY_LABELS, SUBJECTS, TEAMS, ASSESSED, ASSESSMENT_KINDS,
  GRADE_SCALE, ADMISSION_STAGES, REQUIRED_DOCS, STAGES, SCORE_CRITERIA, SEED_VERSION,
  ENRICHMENT, SPECIALISTS, SITE_FAQ,
  publicFacts,
  buildSeed, buildPupils, buildTimetable, buildAttendance, isSchoolDay, iso, schoolDaysBetween, mulberry32,
};
