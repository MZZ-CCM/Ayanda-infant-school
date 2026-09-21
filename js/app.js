/* ==========================================================================
   Ayanda Infant School — Staff Portal
   Router, shell and views. No framework, no build step.
   ========================================================================== */

const esc = (s) => Fmt.esc(s);

/* --- icons (Feather-style, 24px viewBox) ------------------------------- */
const ICONS = {
  home: '<path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  left: '<polyline points="15 18 9 12 15 6"/>',
  right: '<polyline points="9 18 15 12 9 6"/>',
  alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  cloud: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  print: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15 9a3 3 0 0 1 0 6"/><path d="M18 6a7 7 0 0 1 0 12"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  award: '<circle cx="12" cy="8" r="6"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
  wallet: '<path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
  send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  cap: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  plug: '<path d="M9 2v6"/><path d="M15 2v6"/><path d="M6 8h12v3a6 6 0 0 1-6 6 6 6 0 0 1-6-6z"/><line x1="12" y1="17" x2="12" y2="22"/>',
  clipboard: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22 6 12 13 2 6"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  family: '<circle cx="8" cy="7" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 21v-1.6A4.4 4.4 0 0 1 6.4 15h3.2a4.4 4.4 0 0 1 4.4 4.4V21"/><path d="M16 21v-1.5a4 4 0 0 1 2.5-3.7"/>',
  bank: '<line x1="3" y1="21" x2="21" y2="21"/><polygon points="12 3 21 8 3 8"/><line x1="6" y1="11" x2="6" y2="18"/><line x1="10" y1="11" x2="10" y2="18"/><line x1="14" y1="11" x2="14" y2="18"/><line x1="18" y1="11" x2="18" y2="18"/>',
};
const icon = (name, cls = "ico") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;

/* --- navigation definition --------------------------------------------- */
const NAV = [
  { section: "Daily" },
  { id: "dashboard",   label: "Dashboard",     icon: "home",     perm: null },
  { id: "attendance",  label: "Attendance",    icon: "check",    perm: "attendance.view" },
  { id: "messages",    label: "Messages",      icon: "chat",     perm: "messages.view", badge: "unread" },
  { id: "calendar",    label: "Calendar",      icon: "calendar", perm: "calendar.view" },
  { id: "timetable",   label: "Timetable",     icon: "grid",     perm: "timetable.view" },
  { section: "Pupil record" },
  { id: "pupils",      label: "Pupils",        icon: "users",    perm: "pupils.view" },
  { id: "admissions",  label: "Admissions",    icon: "inbox",    perm: "admissions.view", badge: "admissions", badgeNeeds: "admissions.manage", needs: "vAdmissions" },
  { id: "gradebook",   label: "Gradebook",     icon: "award",    perm: "gradebook.view", needs: "vGradebook" },
  { id: "billing",     label: "Fees & billing", icon: "wallet",  perm: "billing.view", needs: "vBilling" },
  { id: "comms",       label: "Guardians",     icon: "send",     perm: "comms.view", badge: "families", needs: "vComms" },
  { id: "alumni",      label: "Leavers",       icon: "cap",      perm: "alumni.view", needs: "vAlumni" },
  { id: "families",    label: "Family portal", icon: "family",   perm: "portal.view", badge: "families", badgeNeeds: "portal.messages", needs: "vFamilies" },
  { section: "School" },
  { id: "staff",       label: "Staff",         icon: "user",     perm: "staff.view" },
  { id: "documents",   label: "Documents",     icon: "folder",   perm: "documents.view" },
  { id: "welfare",     label: "Welfare",       icon: "heart",    perm: ["welfare.view", "welfare.log"] },
  { id: "reports",     label: "Reports",       icon: "chart",    perm: "reports.view" },
  { id: "recruitment", label: "Recruitment",   icon: "briefcase", perm: "recruitment.view" },
  { section: "Governance" },
  { id: "governance",  label: "Board & statutory", icon: "bank", perm: "governance.view", badge: "statutory", needs: "vGovernance" },
  { id: "integrations", label: "Integrations", icon: "plug",     perm: "integrations.manage", needs: "vIntegrations" },
  { section: "Administration" },
  { id: "permissions", label: "Permissions",   icon: "shield",   perm: "permissions.manage" },
  { id: "config",      label: "Configuration", icon: "sliders",  perm: "config.manage", needs: "vConfig" },
  { id: "audit",       label: "Audit & compliance", icon: "clipboard", perm: "audit.view", needs: "vAudit" },
  { id: "settings",    label: "Settings",      icon: "settings", perm: "settings.manage" },
  { id: "access",      label: "My access",     icon: "key",      perm: null },
  /* `needs` is doing real work here: js/guide.js is not loaded with the rest
     of the application, so until somebody has signed in and it has been
     fetched this entry does not exist. */
  { id: "guide",       label: "How to use the portal", icon: "info", perm: null, needs: "vGuide" },
];

/* --- where you were ------------------------------------------------------
   A refresh should put you back on the page you were reading, with the class
   you had chosen and the term you were looking at — and with the data as it
   is now, not as it was. The hash carries the page; this carries everything
   underneath it, per account, so two people sharing a laptop do not inherit
   each other's place. Only navigation is kept: never a draft, never a record.
   ------------------------------------------------------------------------ */
const PLACE_KEY = "ayanda.portal.place";
const PLACE_FIELDS = {
  attendance:  ["date", "classId", "periodId"],
  messages:    ["channel"],
  docs:        ["cat", "q"],
  pupils:      ["q", "classId"],
  staff:       ["q"],
  families:    ["q"],
  calendar:    ["y", "m"],
  perms:       ["target"],
  welfare:     ["filter"],
  timetable:   ["classId", "weekOffset", "mode", "staffId"],
  admissions:  ["intakeId", "stage", "q"],
  gradebook:   ["classId", "subject", "assessmentId", "mode"],
  billing:     ["classId", "filter", "q"],
  comms:       ["scope", "q"],
  config:      ["tab"],
  governance:  ["tab"],
  recruitment: ["vacancyId"],
  portal:      ["childId"],
};

const App = {
  view: "dashboard",
  ui: {
    drawer: false,
    login: { email: "", error: "", busy: false, showPassword: false, preview: "attendance",
             requested: false, requesting: false, requestError: "",
             enquired: false, enquiring: false, enquireError: "",
             tourStep: 0, tourPlaying: false },
    guide: { step: 0, playing: false },
    attendance: { date: null, classId: null, periodId: null, draft: {} },
    find: { q: "" },
    messages: { channel: "announcements" },
    docs: { cat: "all", q: "" },
    pupils: { q: "", classId: "all" },
    staff: { q: "" },
    calendar: { y: null, m: null },
    perms: { target: null },
    welfare: { filter: "open" },
    drive: { files: [], q: "", loading: false, error: "" },
    timetable: { classId: null, weekOffset: 0, mode: null, staffId: null },
    admissions: { intakeId: null, stage: "all", q: "" },
    gradebook: { classId: null, subject: null, assessmentId: null, draft: {}, mode: "subject" },
    billing: { classId: "all", filter: "all", q: "" },
    comms: { scope: "all", q: "", open: null },
    config: { tab: "intakes" },
    setPassword: { error: "", busy: false, done: false },
    portal: { childId: null },
    families: { q: "" },
    gate: { status: null, loading: false, error: "", busy: false },
    chooser: { grade: null },
    governance: { tab: "board" },
    recruitment: { vacancyId: null },
  },

  /* ---------------------------------------------------------------------- */
  async init() {
    const t = Store.today();
    this.ui.attendance.date = t;
    const d = new Date();
    this.ui.calendar.y = d.getFullYear(); this.ui.calendar.m = d.getMonth();
    window.addEventListener("hashchange", () => {
      /* A route is "#/something". Anything else is an in-page anchor — a nav
         link, or the skip link — and re-rendering on those threw the whole
         document away mid-jump: the browser had just moved focus to the
         target, and the element it had moved to no longer existed. Let the
         browser do what it was already doing. */
      const hash = location.hash || "";
      if (hash && !hash.startsWith("#/")) return;
      if (!this.me()) { this.ui.drawer = false; return this.render(); }
      this.syncFromHash();
    });
    document.addEventListener("click", (e) => this.onClick(e));
    document.addEventListener("submit", (e) => this.onSubmit(e));
    document.addEventListener("change", (e) => this.onChange(e));
    document.addEventListener("input", (e) => this.onInput(e));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.closeModal();
      this.modalKeydown(e);
      this.findKeydown(e);
    });

    try {
      await Store.init();
    } catch (e) {
      document.getElementById("app").innerHTML = this.startupFailure(e);
      return;
    }
    if (Store.session) { this.restorePlace(); Store.watch(); }
    this.syncFromHash();
  },

  startupFailure(err) {
    return `<div class="login"><section class="login-panel" style="grid-column:1/-1">
      <div class="login-card"><div class="eyebrow">Ayanda Infant School</div>
      <h2>The portal could not start</h2>
      <div class="notice err mt-16">${esc(err.message || String(err))}</div>
      <p class="muted small mt-16">If the school runs its own server, check that it is switched on. Otherwise check <code>js/config.js</code>.</p>
      <button class="btn mt-16" onclick="location.reload()">Try again</button></div></section></div>`;
  },

  /* Someone else changed something — say so quietly rather than just moving
     the page under the reader's eyes. */
  liveNotice(change) {
    /* A family has no staff directory to name anybody from, and would not
       recognise a collection name if it had. They get told what it means. */
    if (Store.isFamily) {
      const what = { comms: "The school has sent you something.", attendance: "A register has been taken.",
        assessments: "New marks have been entered.", payments: "A payment has been recorded.",
        invoices: "Your fee account has changed.", events: "The school diary has changed.",
        absences: "The school has looked at your absence note." }[change.collection];
      if (what) this.toast(what, "live");
      return;
    }
    const who = Store.staff(change.by);
    const what = { attendance: "a register", pupils: "a pupil record", applicants: "an admission", payments: "a payment",
      assessments: "marks", comms: "a message to guardians", welfare: "the welfare log", board: "board minutes",
      statutory: "the statutory register", staff: "a staff record", timetable: "the timetable",
      absences: "an absence reported by a family", guardians: "a family portal account",
      school: "the school" }[change.collection] || "something";
    /* A guardian's write carries no staff id, because there is no colleague
       behind it — say so rather than calling a parent "someone". */
    const by = who ? `${who.title} ${who.last}` : change.by ? "Someone" : "A family";
    this.toast(`${by} updated ${what}.`, "live");
  },
  placeKey() { return `${PLACE_KEY}:${(Store.session && Store.session.staffId) || "none"}`; },

  savePlace() {
    if (!Store.session) return;
    const place = { view: this.view, at: Date.now(), scroll: Math.round(window.scrollY || 0) };
    for (const [group, fields] of Object.entries(PLACE_FIELDS)) {
      const from = this.ui[group]; if (!from) continue;
      const kept = {};
      for (const f of fields) if (from[f] !== undefined && from[f] !== null) kept[f] = from[f];
      if (Object.keys(kept).length) place[group] = kept;
    }
    try { localStorage.setItem(this.placeKey(), JSON.stringify(place)); } catch (_) {}
  },

  /* Restores the sub-state always, and the page itself only when the address
     bar has nothing to say — a link somebody was sent must still win. */
  restorePlace() {
    let place = null;
    try { place = JSON.parse(localStorage.getItem(this.placeKey()) || "null"); } catch (_) {}
    if (!place) return;
    for (const [group, fields] of Object.entries(PLACE_FIELDS)) {
      if (!place[group] || !this.ui[group]) continue;
      for (const f of fields) if (place[group][f] !== undefined) this.ui[group][f] = place[group][f];
    }
    const hash = (location.hash || "").replace(/^#\/?/, "").split("/")[0];
    if (!hash && place.view) {
      this.view = place.view;
      location.replace(`#/${place.view}`);
    }
    this._restoreScroll = place.scroll || 0;
  },

  /* Once, after the first render following a reload. Any navigation after that
     goes to the top of the page, as navigation should. */
  applyRestoredScroll() {
    const y = this._restoreScroll;
    this._restoreScroll = null;
    if (!y) return;
    requestAnimationFrame(() => window.scrollTo(0, y));
    setTimeout(() => window.scrollTo(0, y), 120);      // again once tables have laid out
  },

  syncFromHash() {
    const h = (location.hash || "").replace(/^#\/?/, "").split("/")[0];
    if (h && NAV.some(n => n.id === h)) this.view = h;
    this.ui.drawer = false;      // following a link closes the drawer behind you
    /* "Password changed" is the answer to something you did a moment ago, not
       a state of the account. Leaving it set meant somebody who had just been
       made to choose a password arrived at their account page to be told they
       had changed it — with no form to change it again without asking for
       one. It lasts as long as the page you did it on. */
    this.ui.setPassword = { error: "", busy: false, done: false };
    this.render();
  },
  go(view) {
    this.ui.drawer = false;
    this.view = view;
    if (location.hash !== `#/${view}`) location.hash = `#/${view}`; else this.render();
    window.scrollTo(0, 0);
  },
  me() { return Store.me(); },
  can(p) { return can(this.me(), p); },
  canAny(ps) { return (Array.isArray(ps) ? ps : [ps]).some(p => this.can(p)); },
  myClasses() { return classesInScope(this.me(), Store.db.classes); },

  /* ------------------------------------------------------------------------
     Give every field a name a screen reader can read
     ------------------------------------------------------------------------
     The portal writes forms as `<label class="field">Phone</label><input>`,
     which looks right and is read as "edit text, blank": the label is never
     associated with the control, so the name never reaches the accessibility
     tree. Twelve fields on the enquiry form alone, and the same pattern
     throughout the portal.

     Doing this once after each render, rather than adding for/id to every
     pair by hand, means forms written later are covered too and none can
     regress. It only ever fills a gap — anything already associated, wrapped,
     or carrying aria-label is left exactly as it is.
     ------------------------------------------------------------------------ */
  linkLabels(root) {
    const CONTROLS = "input:not([type=hidden]), select, textarea";
    let n = 0;
    for (const label of root.querySelectorAll("label:not([for])")) {
      if (label.querySelector(CONTROLS)) continue;          // already wraps its control

      /* The control is either the next element or the first one inside it —
         the markup uses both shapes. */
      let scope = label.nextElementSibling;
      while (scope && !scope.matches(CONTROLS) && !scope.querySelector(CONTROLS)) {
        scope = scope.nextElementSibling;
      }
      if (!scope) continue;
      const found = scope.matches(CONTROLS) ? [scope] : [...scope.querySelectorAll(CONTROLS)];
      if (!found.length) continue;

      const [first, ...rest] = found;
      if (!first.id) first.id = `f_${++n}_${Math.random().toString(36).slice(2, 7)}`;
      if (!first.getAttribute("aria-label") && !first.getAttribute("aria-labelledby")) {
        label.setAttribute("for", first.id);
      }
      /* One label over two boxes — "Emergency contact (name · phone)" — cannot
         name both, so the rest take their placeholder as a name. */
      for (const extra of rest) {
        if (!extra.getAttribute("aria-label") && !extra.getAttribute("aria-labelledby")) {
          const own = extra.getAttribute("placeholder") || extra.name || "";
          if (own) extra.setAttribute("aria-label", `${label.textContent.trim()} — ${own}`);
        }
      }
    }
  },

  /* ------------------------------------------------------------------------
     Saying what happened, and leaving the way back open
     ------------------------------------------------------------------------
     Fifteen destructive actions used to be guarded by the browser's own
     confirm() box. People click through those without reading them — that is
     the whole finding behind "undo beats are-you-sure" — and a dialog nobody
     reads is not a safeguard, it is a speed bump with a false sense of
     security. Worse, once past it there was no way back at all.

     So a toast can carry an action. Do the thing, say it is done, and leave
     Undo sitting there for a few seconds. It is the safer arrangement and the
     faster one: nobody is stopped on the way in, and everybody has a way out.

     Confirmation is kept for the two kinds of thing undo cannot reach —
     something that has already left the building (forty messages sent to
     guardians) and something the system genuinely cannot restore.
     ------------------------------------------------------------------------ */
  toast(msg, kind = "", opts = {}) {
    const el = document.createElement("div");
    el.className = `toast ${kind}${opts.undo ? " with-undo" : ""}`;
    el.setAttribute("role", "status");
    const text = document.createElement("span");
    text.textContent = msg;
    el.appendChild(text);

    let timer = null;
    const close = () => { clearTimeout(timer); el.remove(); };

    if (opts.undo) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "toast-undo";
      button.textContent = opts.label || "Undo";
      button.addEventListener("click", () => { close(); opts.undo(); });
      el.appendChild(button);
      /* Hovering or tabbing to it means somebody is deciding — stop the clock. */
      el.addEventListener("mouseenter", () => clearTimeout(timer));
      el.addEventListener("focusin", () => clearTimeout(timer));
      el.addEventListener("mouseleave", () => { timer = setTimeout(close, 4000); });
    }

    document.getElementById("toasts").appendChild(el);
    timer = setTimeout(close, opts.undo ? 9000 : kind === "live" ? 4200 : 3200);
  },

  /* Where undo cannot reach — something already sent, or something the
     system genuinely cannot put back — a confirmation is still right. It
     belongs in the interface rather than in a browser dialog: the same
     typography as everything else, a Tab trap and focus returned, room to
     say what will actually happen, and a named button rather than "OK". */
  confirmAction({ title, body, confirmLabel = "Yes, do it", danger = false, onConfirm }) {
    this._confirming = onConfirm;
    this.modal({
      title,
      body: `<p class="small">${body}</p>`,
      foot: `<button type="button" class="btn ghost" data-action="close-modal">Cancel</button>
             <div class="grow"></div>
             <button type="button" class="btn${danger ? " danger" : ""}" data-action="confirm-yes">${esc(confirmLabel)}</button>`,
    });
  },

  /* Do it, say so, and hold the door. `snapshot` is whatever putting it back
     needs; `restore` is given it. Both run against the live database, so an
     undo is an ordinary write and is audited like one. */
  undoable(message, { snapshot, restore, audit }) {
    const state = snapshot();
    if (audit) Store.audit(audit);
    Store.save();
    this.render();
    this.toast(message, "", {
      undo: () => {
        restore(state);
        if (audit) Store.audit(`Undid: ${audit}`);
        Store.save();
        this.render();
        this.toast("Put back.");
      },
    });
  },

  /* ---------------------------------------------------------------------- */
  render() {
    const root = document.getElementById("app");

    /* A guardian's session holds a different database — their own children,
       not the school — so it takes a different application entirely. This sits
       above everything below it, which all assumes Store.db is the school. */
    if (Store.isFamily && Store.db) {
      if (this._landing && this._landing.teardown) this._landing.teardown();
      this.view = this.portalView();
      root.innerHTML = Store.mustChangePassword ? this.renderSetPassword() : this.renderPortal();
      this.linkLabels(root);
      if (this.portalView() === "messages") { const b = root.querySelector(".thread-body"); if (b) b.scrollTop = b.scrollHeight; }
      this.savePlace();
      this.applyRestoredScroll();
      return;
    }

    const me = this.me();
    if (!me || !me.active) {
      if (Store.session) Store.logout();
      /* The office's own figures, rather than the constants this file shipped
         with. It arrives a moment after the first paint and draws again. */
      if (!Store._factsAsked) Store.loadPublic().then(() => { if (!this.me()) this.render(); });
      root.innerHTML = this.renderLogin();
      this.linkLabels(root);
      if (this.landingEnhance) this.landingEnhance();
      return;
    }
    /* Signed in: the public page is gone, so let go of its scroll listener. */
    if (this._landing && this._landing.teardown) this._landing.teardown();

    /* The guide is fetched now rather than shipped with the application. */
    this.loadGuide();

    /* A temporary password is one somebody else chose and may have written
       down. Nothing else in the portal opens until it has been replaced. */
    if (Store.mustChangePassword) { root.innerHTML = this.renderSetPassword(); return; }

    const nav = NAV.find(n => n.id === this.view);
    if (nav && nav.perm && !this.canAny(nav.perm)) { root.innerHTML = this.shell(this.forbidden(nav), nav.label); return; }
    const views = {
      dashboard: () => this.vDashboard(), attendance: () => this.vAttendance(), messages: () => this.vMessages(),
      calendar: () => this.vCalendar(), pupils: () => this.vPupils(), staff: () => this.vStaff(), documents: () => this.vDocuments(),
      welfare: () => this.vWelfare(), reports: () => this.vReports(), permissions: () => this.vPermissions(),
      settings: () => this.vSettings(), access: () => this.vAccess(),
      guide: () => (typeof this.vGuide === "function" ? this.vGuide() : this.guideLoading()),
      timetable: () => this.vTimetable(), recruitment: () => this.vRecruitment(),
    };
    if (typeof this.vFamilies === "function") views.families = () => this.vFamilies();   // js/portal.js
    if (typeof this.vAdmissions === "function") Object.assign(views, {   // js/sis.js
      admissions: () => this.vAdmissions(), gradebook: () => this.vGradebook(), billing: () => this.vBilling(),
      comms: () => this.vComms(), alumni: () => this.vAlumni(), config: () => this.vConfig(),
      integrations: () => this.vIntegrations(), audit: () => this.vAudit(),
    });
    if (typeof this.vGovernance === "function") views.governance = () => this.vGovernance();   // js/governance.js
    if (!views[this.view]) this.view = "dashboard";   // unknown hash, or a script that failed to load
    const navNow = NAV.find(n => n.id === this.view);
    root.innerHTML = this.shell(views[this.view](), navNow ? navNow.label : "Dashboard");
    this.linkLabels(root);
    // After render hooks
    if (this.view === "messages") { const b = root.querySelector(".thread-body"); if (b) b.scrollTop = b.scrollHeight; }
    if (this.view === "comms" && this.can("portal.messages") && this.familyUnread()) this.markRead("portal");
    this.savePlace();
    this.applyRestoredScroll();
  },

  /* ------------------------------------------------------------------------
     Fetching the guide
     ------------------------------------------------------------------------
     js/guide.js is a labelled map of every page in the portal — what each one
     holds and who may see it — so it is not shipped with the public site. It
     is not in index.html, not in the service worker's shell, and not in the
     source of the page a stranger can open. It is asked for here, once
     somebody has signed in.

     The request carries the session token, so the Node server can refuse it
     to anybody without one and does. Served as plain static files there is
     nobody to check a token: the file is then merely unadvertised rather than
     closed, which is worth being honest about — see the README.
     ------------------------------------------------------------------------ */
  async loadGuide() {
    if (this._guideAsked || typeof this.vGuide === "function") return;
    this._guideAsked = true;                     // one attempt per page load
    const tag = document.querySelector('script[src*="js/app.js"]');
    const version = ((tag && tag.getAttribute("src")) || "").match(/\?v=[\w.-]+/);
    const headers = (Store.shared && Store.session && Store.session.token)
      ? { Authorization: `Bearer ${Store.session.token}` } : {};
    try {
      const res = await fetch(`js/guide.js${version ? version[0] : ""}`, { headers, credentials: "omit" });
      if (!res.ok) return;
      /* Run it from a blob rather than pointing a <script> at the address, so
         the token travels on the request that fetches it. */
      const url = URL.createObjectURL(new Blob([await res.text()], { type: "text/javascript" }));
      await new Promise((done, fail) => {
        const el = document.createElement("script");
        el.src = url; el.onload = done; el.onerror = fail;
        document.head.appendChild(el);
      });
      URL.revokeObjectURL(url);
      if (this.me()) this.render();
    } catch (_) { /* the menu entry simply does not appear */ }
  },

  /* Between the first render and the fetch landing — a second, usually. */
  guideLoading() {
    return `<div class="empty">${icon("info")}<p>Fetching the guide…</p>
      <p class="tiny muted">It is not part of the application; it is asked for once you are signed in.</p></div>`;
  },

  shell(inner, title) {
    const me = this.me();
    const unread = this.unreadCount();
    /* An item shows if the role allows it and its module loaded;
       a section heading shows only when something under it survives that test. */
    const visible = (n) => !n.section && (!n.perm || this.canAny(n.perm)) && (!n.needs || typeof this[n.needs] === "function");
    const sectionHasItems = (i) => {
      for (let j = i + 1; j < NAV.length && !NAV[j].section; j++) if (visible(NAV[j])) return true;
      return false;
    };
    const navHtml = NAV.map((n, i) => {
      if (n.section) return sectionHasItems(i) ? `<div class="nav-section">${n.section}</div>` : "";
      if (!visible(n)) return "";
      /* A badge is a call to action, so it only appears to somebody who can
         answer it. A class teacher may look at the admissions list, but
         cannot move anybody through it — a red 4 beside it every morning is
         four things they are being asked to do nothing about. */
      const n2 = (n.badgeNeeds && !this.canAny(n.badgeNeeds)) ? 0
        : n.badge === "unread" ? unread
        : n.badge === "admissions" ? this.admissionsNeedingAction()
        : n.badge === "statutory" ? (this.statutoryDue ? this.statutoryDue() : 0)
        : n.badge === "families" ? this.familyUnread()
        : 0;
      const badge = n2 ? `<span class="badge">${n2}</span>` : "";
      return `<a href="#/${n.id}" class="${this.view === n.id ? "active" : ""}">${icon(n.icon)}<span>${n.label}</span>${badge}</a>`;
    }).join("");
    return `
    <div class="shell ${this.ui.drawer ? "drawer-open" : ""}">
      <div class="scrim" data-action="drawer-close" aria-hidden="true"></div>
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-brand">
          <img src="assets/logo.png" alt="">
          <div><div class="school">Ayanda Infant School</div><div class="tag">Staff Portal</div></div>
        </div>
        <nav class="nav">${navHtml}</nav>
        <div class="sidebar-user">
          <span class="avatar navy">${Fmt.initials(me)}</span>
          <div><div class="name">${esc(me.title)} ${esc(me.last)}</div><div class="role">${ROLES[me.role].label}</div></div>
          <button class="iconbtn" data-action="logout" title="Sign out" style="color:#fff">${icon("logout")}</button>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <button type="button" class="drawer-btn" data-action="drawer-open" aria-label="Menu" aria-controls="sidebar" aria-expanded="${!!this.ui.drawer}">
            <span></span><span></span><span></span>
          </button>
          <div class="grow" style="min-width:0">
            <div class="crumbs">${esc(Store.db.school.term.name)} · ${Fmt.date(Store.today(), "long")}</div>
            <h1>${esc(title)}</h1>
          </div>
          <div class="spacer"></div>
          ${this.findBox()}
          ${this.registerAction()}
          ${this.can("messages.send") ? `<a class="btn ghost sm topbar-act" href="#/messages">${icon("chat")} Messages ${unread ? `<span class="pill gold">${unread}</span>` : ""}</a>` : ""}
          <button type="button" class="iconbtn topbar-mobile" data-action="logout" aria-label="Sign out">${icon("logout")}</button>
        </header>
        <main class="content" id="content">${inner}</main>
        ${this.bottomBar(unread)}
      </div>
    </div>`;
  },

  /* Approving gives the new colleague a PIN, which HR then has to pass on. */
  async decideAccess(id, decision) {
    const r = (Store.db.accessRequests || []).find(x => x.id === id);
    if (!r) return;
    if (!this._confirmedRequest) {
      const approve = decision === "approve";
      return this.confirmAction({
        title: approve ? `Approve ${r.first} ${r.last}?` : `Decline ${r.first} ${r.last}?`,
        body: approve
          ? `This creates an account for ${esc(r.first)} ${esc(r.last)} as ${esc(ROLES[r.role].label)}, and issues a password for you to hand over. They can sign in as soon as you give it to them.`
          : `The request is closed and ${esc(r.first)} is not given an account. They can ask again; nothing is recorded against them.`,
        confirmLabel: approve ? "Approve and create the account" : "Decline the request",
        danger: !approve,
        onConfirm: () => { this._confirmedRequest = true; this.decideRequest(id, decision); this._confirmedRequest = false; },
      });
    }
    try {
      if (Store.shared) {
        const out = await Store.request(`access-requests/${id}/${decision}`, { role: r.role });
        /* The server issues the password; this is the only place it is ever
           readable, so it goes on the screen and nowhere else. */
        if (out && out.password) this.credentialModal({
          title: `${r.first} ${r.last} can now sign in`,
          who: `${r.first} ${r.last} (${ROLES[r.role].label})`,
          email: out.email || r.email, password: out.password,
        });
        else this.toast(`Request ${decision === "approve" ? "approved" : "declined"}.`);
      } else {
        r.status = decision === "approve" ? "approved" : "declined";
        Store.save(); this.toast(`Request ${r.status}. In demo mode no account is created.`);
      }
      this.render();
    } catch (e) { this.toast(e.message || "Could not update the request.", "err"); }
  },

  /* On a phone the sidebar is behind a drawer, so the four or five things
     actually used in a lesson sit along the bottom, within reach of a thumb. */
  /* ------------------------------------------------------------------------
     Finding a child from wherever you are
     ------------------------------------------------------------------------
     Every search box in the portal searched one page: to look a child up you
     first had to be on Pupils, which means knowing that a child is found
     under Pupils rather than under Attendance or Guardians. For the single
     most common thing anybody does here — a parent on the telephone, a child
     at the office door — that is a page of navigation before you can start
     typing.

     One box, top right, where every other site keeps it, reachable from any
     page with "/" without touching the mouse. It searches what the person is
     allowed to see and nothing else, and it says which kind each result is so
     nobody has to guess why a name appeared.
     ------------------------------------------------------------------------ */
  /* "/" is the convention for jump-to-search, and costs nothing to learn
     because the box is visible anyway. It is ignored while somebody is
     typing into anything else, which is the whole reason single-key
     shortcuts usually go wrong. */
  findKeydown(e) {
    const box = document.getElementById("find-input");
    if (!box) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || "")) || e.target.isContentEditable;
    if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); box.focus(); box.select(); return; }
    if (e.key === "Escape" && this.ui.find.q) { this.ui.find.q = ""; this.render(); }
  },

  findBox() {
    const q = this.ui.find.q;
    return `<div class="find topbar-act" role="search">
      ${icon("search")}
      <input class="input sm" type="search" id="find-input" data-input="find-q" autocomplete="off"
             placeholder="Find a child, a class, a colleague" aria-label="Find a child, a class or a colleague"
             value="${esc(q)}" aria-expanded="${!!q}" aria-controls="find-results">
      ${q ? `<button type="button" class="find-clear" data-action="find-clear" aria-label="Clear">${icon("x")}</button>` : ""}
      ${q ? this.findResults(q) : ""}
    </div>`;
  },

  findResults(q) {
    const hits = this.findMatches(q);
    if (!hits.length) {
      return `<div class="find-menu" id="find-results"><div class="find-empty">
        Nothing matches “${esc(q)}”. Try a surname, a class, or an admission number.</div></div>`;
    }
    return `<div class="find-menu" id="find-results" role="listbox">
      ${hits.map(h => `<button type="button" role="option" aria-selected="false" class="find-hit"
        data-action="${h.action}" ${h.data}>
        <span class="find-kind">${esc(h.kind)}</span>
        <span class="find-name">${esc(h.name)}</span>
        <span class="find-note">${esc(h.note)}</span>
      </button>`).join("")}
    </div>`;
  },

  /* Only what this person may already open — the box is a shortcut to pages
     they can reach, never a way around a permission. */
  findMatches(query) {
    const q = String(query).trim().toLowerCase();
    if (q.length < 2) return [];
    const out = [];
    const has = (s) => String(s || "").toLowerCase().includes(q);

    if (this.can("pupils.view")) {
      for (const p of this.myClasses().flatMap(c => Store.pupilsIn(c.id))) {
        if (has(p.first) || has(p.last) || has(p.admissionNo) || has(`${p.first} ${p.last}`)) {
          out.push({ kind: "Pupil", name: `${p.first} ${p.last}`,
            note: `${Store.cls(p.classId).name} · ${p.admissionNo}`,
            action: "find-pupil", data: `data-id="${p.id}"` });
        }
      }
    }
    if (this.can("staff.view")) {
      for (const m of Store.db.staff.filter(x => x.active)) {
        if (has(m.first) || has(m.last) || has(m.email) || has(`${m.first} ${m.last}`)) {
          out.push({ kind: "Colleague", name: `${m.title} ${m.first} ${m.last}`.trim(),
            note: ROLES[m.role] ? ROLES[m.role].label : "", action: "find-staff", data: `data-id="${m.id}"` });
        }
      }
    }
    for (const c of this.myClasses()) {
      if (has(c.name) || has(c.grade)) {
        out.push({ kind: "Class", name: c.name, note: `${Store.pupilsIn(c.id).length} on the roll`,
          action: "find-class", data: `data-id="${c.id}"` });
      }
    }
    /* Pages, so somebody who knows what they want by name can just type it. */
    for (const n of NAV) {
      if (n.section || !has(n.label)) continue;
      if (n.perm && !this.canAny(n.perm)) continue;
      if (n.needs && typeof this[n.needs] !== "function") continue;
      out.push({ kind: "Page", name: n.label, note: "Go there", action: "find-page", data: `data-view="${n.id}"` });
    }
    return out.slice(0, 8);
  },

  /* ------------------------------------------------------------------------
     Skipping the website next time
     ------------------------------------------------------------------------
     The offer to install was on the public staff page, which is the one place
     somebody sees before they have decided they are going to use this daily.
     The moment to ask is after they have signed in: they now know what it is,
     and the thing installing saves them is exactly the journey they have just
     made — website, portal page, door code, sign-in. Installed it opens on
     the portal.

     Shown once per person, dismissed for good, and still findable afterwards
     under My access or Your account, because a banner you dismissed is not a
     feature you should have to reinstall the browser to get back.
     ------------------------------------------------------------------------ */
  INSTALL_KEY: "ayanda.portal.install.asked",
  installDismissed() {
    try { return localStorage.getItem(this.INSTALL_KEY) === "1"; } catch (_) { return false; }
  },
  installAlways() {
    const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    if (standalone) return `<div class="card"><div class="card-head"><h3>On this device</h3></div>
      <div class="card-body small muted">You are using the installed app. It opens straight on the sign-in and the pages you have opened before still work with no signal.</div></div>`;
    const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (!this._installPrompt && !iOS) return "";
    return `<div class="card"><div class="card-head"><h3>Put it on this device</h3></div><div class="card-body">
      <p class="small muted">${this._installPrompt
        ? "It opens straight on the sign-in — no website, no door code to find again — without the browser bars, and what you have already opened still works with no signal."
        : "On iPhone, tap <strong>Share</strong> and then <strong>Add to Home Screen</strong>."}</p>
      ${this._installPrompt ? `<button class="btn sm mt-16" data-action="install-app">${icon("download")} Install</button>` : ""}
    </div></div>`;
  },

  installBanner() {
    if (this.installDismissed()) return "";
    const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    if (standalone) return "";
    const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (!this._installPrompt && !iOS) return "";
    return `<div class="install-card mb-16">
      <span class="install-ico"><img src="assets/icons/icon-192.png" alt="" width="40" height="40"></span>
      <div><strong>Open it straight from your home screen</strong>
        <p class="tiny muted">${this._installPrompt
          ? "Installed, it opens on the sign-in — no website, no door code to find again — without the browser bars, and the pages you have already opened still work with no signal."
          : "On iPhone, tap <strong>Share</strong> and then <strong>Add to Home Screen</strong>. It then opens straight on the sign-in, without the browser bars."}</p></div>
      <div class="flex" style="gap:8px">
        ${this._installPrompt ? `<button class="btn sm" data-action="install-app">Install</button>` : ""}
        <button class="btn ghost sm" data-action="install-dismiss">Not now</button>
      </div>
    </div>`;
  },

  /* ----------------------------------------------------------------------
     The one action the bar is for
     ----------------------------------------------------------------------
     It used to read "Mark register" whatever the state of the day: at ten
     past three, with all six taken, it said exactly what it said at half
     past eight with one open. A control that never changes is one nobody
     reads, and the question it was there to answer — is there a register
     waiting for me — went on being answered by going and looking.

     So it answers instead. Open now, and it names the period and the minute
     it locks, and goes straight to that register rather than to the page
     about registers. Missed, and it says how many. All taken, and it says
     so quietly and stops asking for attention.
     ---------------------------------------------------------------------- */
  registerAction() {
    if (!this.can("attendance.mark")) return "";
    const generic = `<a class="btn gold sm topbar-act" href="#/attendance">${icon("check")} Mark register</a>`;
    if (!this.isTeachingStaff()) return generic;

    const mine = this.myRegisters(Store.today());
    if (!mine.length) return generic;

    const open = mine.find(x => !x.status.marked && x.status.window.state === "open");
    if (open) {
      return `<button type="button" class="btn gold sm topbar-act" data-action="open-register"
        data-class="${open.classId}" data-period="${open.period.id}">${icon("check")}
        Take ${esc(open.period.label)} <span class="tiny">closes ${Fmt.time(open.status.window.lockAt)}</span></button>`;
    }

    const missed = mine.filter(x => x.status.missed).length;
    if (missed) {
      return `<a class="btn ghost sm topbar-act" href="#/attendance">${icon("alert")}
        ${missed} missed <span class="pill red">${missed}</span></a>`;
    }

    const later = mine.filter(x => !x.status.marked).length;
    if (later) {
      return `<a class="btn ghost sm topbar-act" href="#/attendance">${icon("clock")}
        ${later} still to take</a>`;
    }
    return `<a class="btn ghost sm topbar-act quiet-done" href="#/attendance">${icon("check")} All registers taken</a>`;
  },

  bottomBar(unread) {
    const wanted = ["dashboard", "attendance", "pupils", "gradebook", "messages"];
    const items = wanted
      .map(id => NAV.find(n => n.id === id))
      .filter(n => n && (!n.perm || this.canAny(n.perm)) && (!n.needs || typeof this[n.needs] === "function"))
      .slice(0, 4);
    if (!items.length) return "";
    return `<nav class="tabbar" aria-label="Main">
      ${items.map(n => `<a href="#/${n.id}" class="${this.view === n.id ? "on" : ""}">${icon(n.icon)}<span>${esc(n.label.split(" ")[0])}</span>${n.id === "messages" && unread ? `<i class="dot"></i>` : ""}</a>`).join("")}
      <button type="button" class="${this.ui.drawer ? "on" : ""}" data-action="drawer-open"><span class="more">${icon("grid")}</span><span>More</span></button>
    </nav>`;
  },

  renderSetPassword() {
    const who = Store.whoami() || { first: "" }; const ui = this.ui.setPassword;
    return `<div class="site"><section class="band alt" style="min-height:100vh;display:grid;place-items:center">
      <div class="wrap narrow" style="max-width:520px">
        <div class="card">
          <div class="card-head"><div><div class="eyebrow">Welcome, ${esc(who.first)}</div><h3>Choose your password</h3></div></div>
          <form class="card-body" data-form="set-password">
            <p class="muted small">You signed in with a temporary password that somebody else chose for you. Pick your own before you go any further — until you do, the old one still opens your account.</p>
            <label class="field mt-16" for="cur">The temporary password you just used</label>
            <input class="input" id="cur" name="currentPassword" type="password" autocomplete="current-password" required>
            <label class="field mt-16" for="new1">Your new password</label>
            <input class="input" id="new1" name="password" type="password" autocomplete="new-password" required minlength="8">
            <label class="field mt-16" for="new2">Type it again</label>
            <input class="input" id="new2" name="confirm" type="password" autocomplete="new-password" required>
            <div class="help mt-8">At least eight characters, with a letter and a number. Nobody at the school can see it, so make it one you will remember.</div>
            ${ui.error ? `<div class="notice err mt-16">${icon("alert")} ${esc(ui.error)}</div>` : ""}
            <div class="flex mt-16" style="gap:8px">
              <button class="btn grow" type="submit" style="justify-content:center" ${ui.busy ? "disabled" : ""}>${ui.busy ? "Saving…" : "Save and continue"}</button>
              <button class="btn ghost" type="button" data-action="logout">Sign out</button>
            </div>
          </form>
        </div>
      </div>
    </section></div>`;
  },

  forbidden(nav) {
    const perms = nav && nav.perm ? [].concat(nav.perm) : [];
    const locked = perms.some(k => PERMISSION_INFO[k]?.locked);
    const how = locked
      ? "This area is reserved for the School Director and the Board Secretary, and cannot be granted to another role."
      : "The Director, Board Secretary, Head Teacher or HR can grant it from the Permissions portal.";
    return `<div class="card"><div class="forbidden">${icon("lock")}<h2>You don't have access to this area</h2><p class="muted mt-8">Your role (${ROLES[this.me().role].label}) does not include this permission. ${how}</p><a class="btn ghost mt-16" href="#/dashboard">Back to dashboard</a></div></div>`;
  },

  /* ======================================================================
     LOGIN
     ====================================================================== */
  /* The public page — banner, what the portal does, and the way in — lives in
     js/landing.js, which defines renderLogin(). Nothing about the staff is
     published there: signing in takes a school email address and a password. */

  /* ======================================================================
     DASHBOARD
     ====================================================================== */
  /* ---------- attendance helpers (registers follow the timetable) ---------- */
  lockMinutes() { return Number(Store.db.school.lockMinutes ?? 15); },
  registerPeriods() { return PERIODS.filter(p => !p.kind || p.kind === "admin"); },
  dayKey(date) { const w = new Date(date + "T12:00:00").getDay(); return w === 0 || w === 6 ? null : DAYS[w - 1]; },
  homeTeamOf(cls) { return Store.db.teams.find(t => t.teacherId === cls.teacherId) || null; },
  /* Who is with a class in a period: { subject, team, teacherId, assistantId }. Registration belongs to the class's home pair. */
  slot(classId, date, periodId) {
    const cls = Store.cls(classId); const dk = this.dayKey(date); if (!cls || !dk) return null;
    if (periodId === "reg") return { subject: "Registration", team: this.homeTeamOf(cls), teacherId: cls.teacherId, assistantId: cls.assistantId };
    const idx = PERIODS.filter(p => !p.kind).findIndex(p => p.id === periodId);
    const cell = (Store.db.timetable[classId]?.[dk] || [])[idx]; if (!cell) return null;
    const team = cell.t ? Store.team(cell.t) : null;
    return { subject: cell.s, team, teacherId: team?.teacherId || null, assistantId: team?.assistantId || null };
  },
  periodWindow(date, periodId) {
    const p = this.registerPeriods().find(x => x.id === periodId); const start = new Date(`${date}T${p.start}:00`);
    const lockAt = new Date(start.getTime() + this.lockMinutes() * 60000); const now = new Date();
    return { start, lockAt, state: now < start ? "upcoming" : now <= lockAt ? "open" : "locked" };
  },
  registerStatus(classId, date, periodId = "reg") {
    const pupils = Store.pupilsIn(classId); const recs = pupils.map(p => Store.att(date, p.id, periodId)).filter(Boolean);
    const counts = { P: 0, A: 0, L: 0, E: 0 }; recs.forEach(r => counts[r.status]++);
    const marked = recs.length === pupils.length && pupils.length > 0; const partial = recs.length > 0 && !marked;
    const last = recs.reduce((m, r) => (!m || r.markedAt > m.markedAt) ? r : m, null);
    const window = this.periodWindow(date, periodId); const slot = this.slot(classId, date, periodId);
    const applies = !!(slot && (slot.teacherId || slot.assistantId)); // whole-school assembly has no register
    return { pupils: pupils.length, marked, partial, counts, markedBy: last?.markedBy, markedAt: last?.markedAt, present: counts.P + counts.L, window, slot, applies, missed: applies && window.state === "locked" && !marked };
  },
  /* May this user take or amend this register right now? */
  markability(classId, date, periodId) {
    const me = this.me(); if (!this.can("attendance.mark")) return { ok: false, reason: "Your role cannot mark registers." };
    const st = this.registerStatus(classId, date, periodId); if (!st.applies) return { ok: false, reason: "No register is taken for this period." };
    const onTeam = st.slot.teacherId === me.id || st.slot.assistantId === me.id;
    const scopeAll = ROLES[me.role].scope === "all" || (me.grants || []).includes("scope.all");
    if (!onTeam && !scopeAll) return { ok: false, reason: `This register is taken by ${Store.staffName(st.slot.teacherId, { short: true })} and ${Store.staffName(st.slot.assistantId, { short: true })}.` };
    if (st.window.state === "upcoming") return { ok: false, reason: `Opens at ${Fmt.time(st.window.start)}.` };
    if (st.window.state === "locked" && !this.can("attendance.edit_past")) return { ok: false, reason: `Locked at ${Fmt.time(st.window.lockAt)}. Only holders of "Amend locked registers" can change it now.` };
    return { ok: true, reason: st.window.state === "locked" ? `Locked at ${Fmt.time(st.window.lockAt)} — you are amending it; the change is recorded in the audit log.` : `Open until ${Fmt.time(st.window.lockAt)}.` };
  },
  /* Registers a person is responsible for on a date, in time order. */
  myRegisters(date) {
    const me = this.me(); const out = [];
    Store.db.classes.forEach(c => this.registerPeriods().forEach(p => { const sl = this.slot(c.id, date, p.id); if (sl && (sl.teacherId === me.id || sl.assistantId === me.id)) out.push({ classId: c.id, period: p, slot: sl, status: this.registerStatus(c.id, date, p.id) }); }));
    return out.sort((a, b) => a.period.start.localeCompare(b.period.start));
  },
  missedRegisters(classIds, fromIso, toIso) {
    let n = 0; schoolDaysBetween(fromIso, toIso).forEach(d => classIds.forEach(cid => this.registerPeriods().forEach(p => { if (this.registerStatus(cid, d, p.id).missed) n++; }))); return n;
  },
  defaultPeriod(date) {
    if (date !== Store.today()) return "reg";
    const now = new Date(); let cur = "reg";
    this.registerPeriods().forEach(p => { if (new Date(`${date}T${p.start}:00`) <= now) cur = p.id; });
    return cur;
  },
  /* Classes whose registers this person can open: home-class scope plus every class they teach. */
  attendanceClasses() { const me = this.me(); const ids = new Set([...this.myClasses(), ...Store.classesTaughtBy(me.id)].map(c => c.id)); return Store.db.classes.filter(c => ids.has(c.id)); },
  isTeachingStaff() { const me = this.me(); return Store.teamsOf(me.id).length > 0 || Store.db.classes.some(c => c.teacherId === me.id || c.assistantId === me.id); },
  regState(st) { return !st.applies ? "none" : st.marked ? "done" : st.missed ? "missed" : st.window.state === "open" ? (st.partial ? "partial" : "open") : st.window.state === "upcoming" ? "upcoming" : "missed"; },
  regPill(st) { const m = { done: ["green", "Taken"], missed: ["red", "Missed"], open: ["gold", "Open"], partial: ["amber", "Partial"], upcoming: ["grey", "Upcoming"], none: ["grey", "—"] }; const [c, l] = m[this.regState(st)]; return `<span class="pill ${c}">${l}</span>`; },
  termStats(pupilIds) {
    const days = schoolDaysBetween(Store.db.school.term.start, Store.today());
    let present = 0, total = 0;
    days.forEach(d => pupilIds.forEach(id => { const r = Store.att(d, id); if (r) { total++; if (r.status === "P" || r.status === "L") present++; } }));
    return { present, total, pct: Fmt.pct(present, total), days: days.length };
  },
  pupilAttendancePct(pupilId) { return this.termStats([pupilId]); },
  unreadCount() {
    const me = this.me(); if (!me || !can(me, "messages.view")) return 0;
    return this.visibleChannels().reduce((n, ch) => n + this.unreadIn(ch.id), 0);
  },

  vDashboard() {
    const me = this.me(); const today = Store.today(); const classes = this.myClasses();
    const inScopePupils = classes.flatMap(c => Store.pupilsIn(c.id));
    const teaching = this.isTeachingStaff();
    const mine = teaching ? this.myRegisters(today) : [];
    const mineDone = mine.filter(x => x.status.marked).length;
    const mineMissed = mine.filter(x => x.status.missed).length;
    const mineOpen = mine.filter(x => !x.status.marked && x.status.window.state === "open").length;
    const regs = classes.map(c => ({ c, r: this.registerStatus(c.id, today, "reg") }));
    const presentToday = regs.reduce((n, x) => n + x.r.present, 0);
    const markedPupils = regs.reduce((n, x) => n + Object.values(x.r.counts).reduce((a, b) => a + b, 0), 0);
    const outstanding = regs.filter(x => !x.r.marked).length;
    const missedToday = classes.reduce((n, c) => n + this.registerPeriods().filter(p => this.registerStatus(c.id, today, p.id).missed).length, 0);
    const openWelfare = Store.db.welfare.filter(w => w.status === "open").length;
    const upcoming = Store.db.events.filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
    const announcements = Store.db.messages.filter(m => m.channel === "announcements").sort((a, b) => b.at.localeCompare(a.at)).slice(0, 3);
    const followUp = this.can("pupils.view") ? inScopePupils.map(p => ({ p, s: this.pupilAttendancePct(p.id) })).filter(x => x.s.total >= 5 && x.s.pct < 90).sort((a, b) => a.s.pct - b.s.pct).slice(0, 6) : [];
    const hour = new Date().getHours();
    const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    const myTeams = Store.teamsOf(me.id);

    const regCard = mine.length ? `
        <div class="card">
          <div class="card-head"><div><h3>My registers today</h3><div class="tiny muted">Each register opens when the period starts and locks ${this.lockMinutes()} minutes later.</div></div><span class="muted small">${Fmt.date(today, "weekday")}</span></div>
          <div class="card-body tight table-wrap"><table>
            <thead><tr><th style="width:96px">Time</th><th>Class</th><th>Lesson</th><th>Status</th><th class="right">P / A</th><th></th></tr></thead>
            <tbody>${mine.map(({ classId, period, slot, status }) => `<tr class="${!status.marked && status.window.state === "open" ? "sel-row" : ""}">
              <td class="tiny muted">${period.start}<br>${period.end}</td>
              <td class="bold">${esc(Store.cls(classId).name)}</td>
              <td><span class="tt-sub ${SUBJECTS[slot.subject] || "grey"}">${esc(slot.subject)}</span><div class="tiny muted">${slot.teacherId === me.id ? "You lead" : "You assist"} · with ${Store.staffName(slot.teacherId === me.id ? slot.assistantId : slot.teacherId, { short: true })}</div></td>
              <td>${this.regPill(status)} ${status.marked ? `<span class="tiny muted">${Fmt.time(status.markedAt)}</span>` : status.window.state === "open" ? `<span class="tiny muted">closes ${Fmt.time(status.window.lockAt)}</span>` : ""}</td>
              <td class="right">${status.marked || status.partial ? `${status.present} / ${status.counts.A}` : "—"}</td>
              <td class="right"><button class="btn xs ${!status.marked && status.window.state === "open" ? "" : "ghost"}" data-action="open-register" data-class="${classId}" data-period="${period.id}">${!status.marked && status.window.state === "open" ? "Take now" : "Open"}</button></td>
            </tr>`).join("")}</tbody>
          </table></div>
          <div class="card-foot tiny muted">${mineOpen ? `${mineOpen} register${mineOpen === 1 ? "" : "s"} open now.` : "No register is open at the moment."}${mineMissed ? ` ${mineMissed} missed — ask the Head Teacher or Deputy to amend.` : ""}</div>
        </div>` : `
        <div class="card">
          <div class="card-head"><h3>Morning registration</h3><span class="muted small">${Fmt.date(today, "weekday")}</span></div>
          <div class="card-body tight table-wrap"><table>
            <thead><tr><th>Class</th><th>Teacher</th><th>Registration</th><th class="right">Present</th><th class="right">Absent</th><th class="right">Lessons</th><th></th></tr></thead>
            <tbody>${regs.map(({ c, r }) => { const lessons = PERIODS.filter(p => !p.kind).map(p => this.registerStatus(c.id, today, p.id)); const done = lessons.filter(x => x.marked).length; const missed = lessons.filter(x => x.missed).length; return `<tr>
              <td class="bold">${esc(c.name)}</td>
              <td class="muted">${Store.staffName(c.teacherId)}</td>
              <td>${this.regPill(r)} ${r.marked ? `<span class="tiny muted">${Fmt.time(r.markedAt)} · ${Store.staffName(r.markedBy, { short: true })}</span>` : ""}</td>
              <td class="right">${r.marked || r.partial ? r.present : "—"}</td>
              <td class="right">${r.marked || r.partial ? r.counts.A : "—"}</td>
              <td class="right"><span class="tiny ${missed ? "bold" : "muted"}" style="${missed ? "color:var(--red)" : ""}">${done}/${lessons.length}${missed ? ` · ${missed} missed` : ""}</span></td>
              <td class="right"><button class="btn xs ghost" data-action="open-register" data-class="${c.id}">Open</button></td>
            </tr>`; }).join("") || `<tr><td colspan="7" class="empty">No classes in your scope.</td></tr>`}</tbody>
          </table></div>
        </div>`;

    return `
    ${this.installBanner()}
    ${this.doorNudge()}
    <div class="flex between wrap mb-16">
      <div><h2 style="font-size:24px">${greet}, ${esc(me.title)} ${esc(me.last)}</h2><div class="muted">${ROLES[me.role].label}${myTeams.length ? ` · ${myTeams.map(t => esc(t.name)).join(", ")} team` : ""} · ${classes.length === Store.db.classes.length ? "Whole school" : classes.map(c => c.name).join(", ") || "No class allocated"}</div></div>
      <div class="pill gold">${esc(Store.db.school.term.name)} · Day ${schoolDaysBetween(Store.db.school.term.start, today).length} of ${schoolDaysBetween(Store.db.school.term.start, Store.db.school.term.end).length}</div>
    </div>
    <div class="grid cols-4 mb-16">
      <div class="card stat accent"><div class="label">Pupils on roll</div><div class="value">${inScopePupils.length}</div><div class="sub">${classes.length} class${classes.length === 1 ? "" : "es"} in your scope</div></div>
      <div class="card stat"><div class="label">Present today</div><div class="value">${markedPupils ? Fmt.pct(presentToday, markedPupils) + "%" : "—"}</div><div class="sub">${presentToday} of ${markedPupils} at registration</div></div>
      ${mine.length
        ? `<div class="card stat"><div class="label">My registers today</div><div class="value ${mineMissed ? "t-bad" : mineOpen ? "t-warn" : "t-good"}">${mineDone}/${mine.length}</div><div class="sub">${mineOpen ? `${mineOpen} open now` : mineMissed ? `${mineMissed} missed` : "All taken on time"}</div></div>`
        : `<div class="card stat"><div class="label">Registration outstanding</div><div class="value ${outstanding ? "t-bad" : "t-good"}">${outstanding}</div><div class="sub">${missedToday} register${missedToday === 1 ? "" : "s"} missed today</div></div>`}
      ${this.can("welfare.view") ? `<div class="card stat"><div class="label">Open welfare cases</div><div class="value">${openWelfare}</div><div class="sub">Across the school</div></div>` : `<div class="card stat"><div class="label">Unread messages</div><div class="value">${this.unreadCount()}</div><div class="sub">Channels and direct messages</div></div>`}
    </div>
    <div class="grid side">
      <div class="stack" style="gap:18px">
        ${this.familyInboxCard()}
        ${regCard}
        <div class="card">
          <div class="card-head"><h3>Announcements</h3>${this.can("messages.broadcast") ? `<button class="btn xs gold" data-action="go" data-view="messages" data-channel="announcements">${icon("megaphone")} Post</button>` : ""}</div>
          <div class="card-body">${announcements.map(m => `<div class="mb-16"><div class="flex"><span class="avatar sm navy">${Fmt.initials(Store.staff(m.from))}</span><span class="bold small">${Store.staffName(m.from)}</span><span class="tiny muted">${Fmt.dateTime(m.at)}</span></div><p class="mt-8" style="margin-left:38px">${esc(m.text)}</p></div>`).join("") || `<div class="empty">No announcements yet.</div>`}</div>
        </div>
      </div>
      <div class="stack" style="gap:18px">
        <div class="card">
          <div class="card-head"><h3>Upcoming</h3><a class="small" href="#/calendar">Calendar</a></div>
          <div class="card-body"><ul class="timeline">${upcoming.map(e => `<li><span class="t">${Fmt.date(e.date, "short")}</span><span>${esc(e.title)}</span></li>`).join("")}</ul></div>
        </div>
        ${this.can("pupils.view") ? `<div class="card">
          <div class="card-head"><h3>Attendance follow-up</h3><span class="tiny muted">Below 90% this term</span></div>
          <div class="card-body tight"><table><tbody>${followUp.map(({ p, s }) => `<tr class="clickable" data-action="open-pupil" data-id="${p.id}"><td><span class="bold">${esc(p.first)} ${esc(p.last)}</span><br><span class="tiny muted">${esc(Store.cls(p.classId).name)}</span></td><td class="right"><span class="pill ${s.pct < 80 ? "red" : "amber"}">${s.pct}%</span></td></tr>`).join("") || `<tr><td class="empty">Everyone is above 90%. Well done.</td></tr>`}</tbody></table></div>
        </div>` : ""}
        ${this.can("timetable.view") && mine.length ? `<div class="card">
          <div class="card-head"><h3>My day</h3><a class="small" href="#/timetable">Timetable</a></div>
          <div class="card-body tight">${mine.filter(x => x.period.id !== "reg").map(x => `<div class="flex" style="padding:6px 18px;border-bottom:1px dashed var(--line)"><span class="tiny muted" style="width:44px">${x.period.start}</span><span class="tt-sub ${SUBJECTS[x.slot.subject] || "grey"}">${esc(x.slot.subject)}</span><span class="tiny muted">${esc(Store.cls(x.classId).name)}</span></div>`).join("") || `<div class="empty small">No lessons today.</div>`}</div>
        </div>` : ""}
        <div class="card">
          <div class="card-head"><h3>Your access</h3><a class="small" href="#/access">Details</a></div>
          <div class="card-body small">
            <div class="flex wrap" style="gap:6px">${this.accessSummaryPills()}</div>
          </div>
        </div>
      </div>
    </div>`;
  },
  accessSummaryPills() {
    const me = this.me(); const e = effectivePerms(me);
    return PERMISSION_GROUPS.map(g => {
      const have = g.perms.filter(p => e.has(p.key)).length;
      if (!have) return "";
      return `<span class="pill ${have === g.perms.length ? "" : "grey"}">${g.label}${have < g.perms.length ? ` ${have}/${g.perms.length}` : ""}</span>`;
    }).join("");
  },

  /* ======================================================================
     ATTENDANCE — one register per timetabled period, open for 15 minutes
     ====================================================================== */
  vAttendance() {
    const ui = this.ui.attendance; const me = this.me(); const classes = this.attendanceClasses();
    if (!classes.length) return `<div class="card"><div class="empty">No class is allocated to you and you are not on a teaching team. Ask HR to update your allocation.</div></div>`;
    if (!ui.classId || !classes.some(c => c.id === ui.classId)) ui.classId = classes[0].id;
    const cls = Store.cls(ui.classId); const date = ui.date; const today = Store.today();
    const isToday = date === today;
    const d = new Date(date + "T12:00:00"); const schoolDay = isSchoolDay(d);
    const periods = this.registerPeriods();
    if (!ui.periodId || !periods.some(p => p.id === ui.periodId)) ui.periodId = this.defaultPeriod(date);
    const periodId = ui.periodId; const period = periods.find(p => p.id === periodId);
    const st = this.registerStatus(cls.id, date, periodId);
    const mk = schoolDay ? this.markability(cls.id, date, periodId) : { ok: false, reason: `${Fmt.date(date, "long")} is not a school day.` };
    const canMark = mk.ok;
    const pupils = Store.pupilsIn(cls.id);
    const draft = ui.draft;
    const val = (p) => draft[p.id]?.status ?? Store.att(date, p.id, periodId)?.status ?? "";
    const note = (p) => draft[p.id]?.note ?? Store.att(date, p.id, periodId)?.note ?? "";
    const dirty = Object.keys(draft).length > 0;
    const days = schoolDaysBetween(Store.db.school.term.start, today).slice(-10);
    const mine = this.myRegisters(date);
    const amending = canMark && st.window.state === "locked";

    const chips = periods.map(p => {
      const s = this.registerStatus(cls.id, date, p.id); const state = this.regState(s);
      const label = { done: "Taken", missed: "Missed", open: "Open now", partial: "Part-taken", upcoming: "Upcoming", none: "No register" }[state];
      return `<button type="button" class="reg-chip ${state} ${p.id === periodId ? "sel" : ""}" data-action="att-period" data-id="${p.id}">
        <span class="t">${p.start}</span>
        <span class="l">${esc(s.slot ? s.slot.subject : p.label)}</span>
        <span class="s">${label}</span>
      </button>`;
    }).join("");

    return `
    <div class="toolbar">
      <select class="input" data-change="att-class">${classes.map(c => `<option value="${c.id}" ${c.id === cls.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
      <div class="flex" style="gap:4px">
        <button class="btn ghost sm" data-action="att-day" data-delta="-1" title="Previous day">${icon("left")}</button>
        <input class="input" type="date" value="${date}" max="${today}" data-change="att-date" style="min-width:160px">
        <button class="btn ghost sm" data-action="att-day" data-delta="1" title="Next day" ${isToday ? "disabled" : ""}>${icon("right")}</button>
        ${!isToday ? `<button class="btn ghost sm" data-action="att-today">Today</button>` : ""}
      </div>
      <div class="grow"></div>
      <span class="pill green">P ${st.counts.P}</span><span class="pill red">A ${st.counts.A}</span><span class="pill amber">L ${st.counts.L}</span><span class="pill blue">E ${st.counts.E}</span>
      ${this.can("attendance.export") ? `<button class="btn ghost sm" data-action="export-register">${icon("download")} CSV</button>` : ""}
    </div>
    ${schoolDay ? `<div class="card mb-16"><div class="card-head"><div><h3>Registers for ${esc(cls.name)}</h3><div class="tiny muted">${Fmt.date(date, "long")} · each register is open for ${this.lockMinutes()} minutes from the start of the period</div></div>${isToday ? `<span class="pill gold">${Fmt.time(new Date())}</span>` : ""}</div>
      <div class="card-body"><div class="reg-chips">${chips}</div></div></div>`
      : `<div class="notice info mb-16">${Fmt.date(date, "long")} is not a school day.</div>`}
    ${this.familyInboxCard()}
    ${schoolDay ? `<div class="notice ${canMark ? (amending ? "warn" : "gold") : st.missed ? "err" : "info"} mb-16">${canMark ? (amending ? icon("lock") : icon("check")) : icon("lock")} ${esc(mk.reason)}${!canMark && st.missed ? " This register was not taken in time." : ""}</div>` : ""}
    <div class="grid side">
      <div class="card">
        <div class="card-head">
          <div><h3>${esc(period.label)}${st.slot && st.slot.subject !== period.label ? ` — ${esc(st.slot.subject)}` : ""} <span class="tiny muted" style="font-weight:400">${period.start} – ${period.end}</span></h3>
          <div class="tiny muted">${st.applies ? `Taken by ${Store.staffName(st.slot.teacherId)} and ${Store.staffName(st.slot.assistantId)} · ` : ""}${st.marked ? `complete — last marked ${Fmt.time(st.markedAt)} by ${Store.staffName(st.markedBy)}` : st.partial ? "partially complete" : st.missed ? "not taken" : "not yet taken"}</div></div>
          ${canMark ? `<button class="btn ghost sm" data-action="att-all-present">All present</button>` : ""}
        </div>
        <div class="card-body tight table-wrap"><table>
          <thead><tr><th>#</th><th>Pupil</th><th>Status</th><th>Note</th></tr></thead>
          <tbody>${pupils.map((p, i) => { const am = periodId !== "reg" ? Store.att(date, p.id, "reg") : null; const told = this.absenceNoteFor(p.id, date); return `<tr>
            <td class="muted">${i + 1}</td>
            <td><span class="bold">${esc(p.last)}, ${esc(p.first)}</span>${p.medical.allergies && this.can("pupils.view_medical") ? ` <span class="pill red" title="Allergy: ${esc(p.medical.allergies)}">!</span>` : ""}${am && (am.status === "A" || am.status === "E") ? ` <span class="pill ${STATUS_PILL[am.status]}" title="Morning registration: ${STATUS_LABEL[am.status]}">a.m. ${STATUS_LABEL[am.status].toLowerCase()}</span>` : ""}${told ? ` <span class="pill blue" title="${esc(told.reportedName || "A guardian")} told us: ${esc(told.note || told.reason)}">${esc(told.reason)}</span>` : ""}<br><span class="tiny muted">${esc(p.admissionNo)}</span></td>
            <td><div class="status-group" ${canMark ? "" : 'aria-disabled="true"'}>${["P", "A", "L", "E"].map(s => `<button type="button" class="${s} ${val(p) === s ? "on" : ""}" data-action="att-set" data-pupil="${p.id}" data-status="${s}" ${canMark ? "" : "disabled"} title="${STATUS_LABEL[s]}">${s}</button>`).join("")}</div></td>
            <td><input class="input" data-input="att-note" data-pupil="${p.id}" value="${esc(note(p))}" placeholder="—" ${canMark ? "" : "disabled"} style="padding:5px 8px;font-size:13px"></td>
          </tr>`; }).join("")}</tbody>
        </table></div>
        ${canMark ? `<div class="card-foot flex between"><span class="small muted">${dirty ? `${Object.keys(draft).length} unsaved change${Object.keys(draft).length === 1 ? "" : "s"}` : "No unsaved changes"}</span><div class="flex"><button class="btn ghost sm" data-action="att-discard" ${dirty ? "" : "disabled"}>Discard</button><button class="btn sm" data-action="att-save" ${dirty ? "" : "disabled"}>${icon("check")} ${amending ? "Save amendment" : "Save register"}</button></div></div>` : ""}
      </div>
      <div class="stack" style="gap:18px">
        ${mine.length ? `<div class="card">
          <div class="card-head"><h3>My registers</h3><span class="tiny muted">${Fmt.date(date, "weekday")}</span></div>
          <div class="card-body tight table-wrap"><table><tbody>${mine.map(x => `<tr class="clickable ${x.classId === cls.id && x.period.id === periodId ? "sel-row" : ""}" data-action="open-register" data-class="${x.classId}" data-period="${x.period.id}">
            <td class="tiny muted">${x.period.start}</td>
            <td><span class="bold small">${esc(Store.cls(x.classId).name)}</span><br><span class="tiny muted">${esc(x.slot.subject)}</span></td>
            <td class="right">${this.regPill(x.status)}</td>
          </tr>`).join("")}</tbody></table></div>
          <div class="card-foot tiny muted">Registration belongs to the class's own pair; lesson registers are taken by the team teaching that period.</div>
        </div>` : ""}
        <div class="card">
          <div class="card-head"><h3>Morning registration</h3><span class="tiny muted">Last 10 school days</span></div>
          <div class="card-body tight table-wrap"><table><tbody>${pupils.map(p => `<tr><td class="small">${esc(p.last)}, ${esc(p.first[0])}.</td><td><div class="heat">${days.map(dd => { const r = Store.att(dd, p.id); return `<span class="${r ? r.status : ""}" title="${Fmt.date(dd, "weekday")}: ${r ? STATUS_LABEL[r.status] : "Not marked"}"></span>`; }).join("")}</div></td><td class="right tiny bold">${this.pupilAttendancePct(p.id).pct}%</td></tr>`).join("")}</tbody></table></div>
          <div class="card-foot tiny muted flex wrap" style="gap:10px"><span><span class="dot" style="background:var(--green)"></span> Present</span><span><span class="dot" style="background:var(--red)"></span> Absent</span><span><span class="dot" style="background:var(--amber)"></span> Late</span><span><span class="dot" style="background:var(--blue)"></span> Excused</span></div>
        </div>
      </div>
    </div>`;
  },
  /* What families have sent in from the portal for this register. A note is
     not a mark — but a teacher about to mark a child absent should be able to
     see that the mother rang it in at seven. */
  absenceNotesFor(classId, date) {
    const ids = new Set(Store.pupilsIn(classId).map(p => p.id));
    return (Store.db.absences || []).filter(a => a.date === date && ids.has(a.pupilId));
  },
  absenceNoteFor(pupilId, date) {
    return (Store.db.absences || []).find(a => a.pupilId === pupilId && a.date === date) || null;
  },
  /* Everything families have sent about the classes this person works with,
     from today onwards, and not yet looked at. */
  familyInbox() {
    if (!this.can("portal.messages")) return { absences: [], messages: [] };
    const ids = new Set(this.myClasses().map(c => c.id));
    const pupilIds = new Set(Store.db.pupils.filter(p => ids.has(p.classId)).map(p => p.id));
    const today = Store.today();
    return {
      absences: (Store.db.absences || []).filter(a => pupilIds.has(a.pupilId) && a.date >= today && a.status === "reported")
        .sort((a, b) => a.date.localeCompare(b.date)),
      messages: (Store.db.comms || []).filter(c => c.fromGuardian && pupilIds.has(c.pupilId))
        .sort((a, b) => b.sentAt.localeCompare(a.sentAt)).slice(0, 8),
    };
  },

  /* What has come in from families and not been opened. Unread is per person,
     like every other read receipt in the portal, so one colleague reading a
     message does not clear it off everybody else's screen. */
  familyUnread() {
    if (!this.can("portal.messages") || !Store.db.reads) return 0;
    const inbox = this.familyInbox();
    const last = Store.db.reads[`${this.me().id}|portal`] || "1970-01-01";
    return inbox.messages.filter(m => m.sentAt > last).length
         + inbox.absences.filter(a => a.at > last).length;
  },

  /* Opening a family's message stamps it, so the parent can see it landed
     rather than only that it sent. */
  openFamilyMessage(id, { silent = false } = {}) {
    const m = (Store.db.comms || []).find(c => c.id === id);
    if (!m) return;
    if (!m.readAt && this.can("comms.send")) { m.readAt = new Date().toISOString(); m.readBy = this.me().id; Store.save(); }
    this.markRead("portal");
    /* `silent` marks it read and leaves the screen alone, for when opening it
       is a step on the way to replying rather than the whole intention. */
    if (silent) return;
    if (m.pupilId && this.pupilProfile) this.pupilProfile(m.pupilId, "comms");
    else this.render();
  },
  familyInboxCard() {
    const inbox = this.familyInbox();
    if (!inbox.absences.length && !inbox.messages.length) return "";
    const name = (id) => { const p = Store.pupil(id); return p ? `${p.first} ${p.last}` : "A pupil"; };
    return `<div class="card mb-16">
      <div class="card-head"><div><h3>From families</h3><div class="tiny muted">Sent in from the family portal. An absence note does not mark the register — it tells whoever does. Open a message and the family can see you have.</div></div>
        <span class="pill ${this.familyUnread() ? "gold" : "grey"}">${inbox.absences.length + inbox.messages.length}</span></div>
      <div class="card-body tight">
        ${inbox.absences.map(a => `<div class="notice-row">
          <div><div class="bold small">${esc(name(a.pupilId))} — away ${Fmt.date(a.date, "weekday")}</div>
            <div class="tiny muted">${esc(a.reason)}${a.note ? ` · ${esc(a.note)}` : ""} — ${esc(a.reportedName || "a guardian")}</div></div>
          <button class="btn xs ghost" data-action="absence-ack" data-id="${a.id}">Seen</button></div>`).join("")}
        ${inbox.messages.map(m => `<div class="notice-row${m.readAt ? "" : " fresh"}">
          <div class="clickable grow" data-action="family-message-open" data-id="${m.id}">
            <div class="bold small">${esc(m.subject || "Message")} — ${esc(name(m.pupilId))}${m.readAt ? "" : ` <span class="pill gold tiny">New</span>`}</div>
            <div class="tiny muted">${esc(m.body)}</div></div>
          <div class="tiny muted nowrap right">${esc(m.fromName || "Guardian")}<br>${Fmt.date(m.sentAt, "short")}
            <br><span class="pill ${m.readAt ? "green" : "grey"} tiny">${m.readAt ? "Opened" : "Unopened"}</span></div>
          ${this.can("comms.send") ? `<button class="btn xs" data-action="family-reply" data-id="${m.id}">${icon("send")} Reply</button>` : ""}</div>`).join("")}
      </div>
    </div>`;
  },

  attSet(pupilId, status) {
    const ui = this.ui.attendance; const cur = Store.att(ui.date, pupilId, ui.periodId);
    const d = ui.draft[pupilId] || {};
    d.status = status; if (d.note === undefined) d.note = cur?.note ?? "";
    if (cur && cur.status === status && (d.note === cur.note)) delete ui.draft[pupilId]; else ui.draft[pupilId] = d;
    this.render();
  },
  attSave() {
    const ui = this.ui.attendance; const me = this.me(); const now = new Date().toISOString();
    const mk = this.markability(ui.classId, ui.date, ui.periodId);
    if (!mk.ok) { this.toast(mk.reason, "err"); return; }
    const period = this.registerPeriods().find(p => p.id === ui.periodId);
    const late = this.periodWindow(ui.date, ui.periodId).state === "locked";
    let n = 0;
    Object.entries(ui.draft).forEach(([pid, d]) => {
      const cur = Store.att(ui.date, pid, ui.periodId);
      const status = d.status ?? cur?.status; if (!status) return;
      Store.db.attendance[Store.attKey(ui.date, ui.periodId, pid)] = { status, note: d.note ?? cur?.note ?? "", markedBy: me.id, markedAt: now, ...(late ? { amended: true } : {}) };
      n++;
    });
    if (late) Store.audit(`Amended ${n} attendance record(s) after lock — ${Store.cls(ui.classId).name}, ${period.label} on ${Fmt.date(ui.date)}`);
    ui.draft = {}; Store.save();
    this.toast(`${late ? "Amendment" : "Register"} saved (${n} pupil${n === 1 ? "" : "s"}).`);
    this.render();
  },
  exportRegister() {
    const ui = this.ui.attendance; const cls = Store.cls(ui.classId);
    const period = this.registerPeriods().find(p => p.id === ui.periodId);
    const slot = this.slot(cls.id, ui.date, ui.periodId);
    const rows = [["Admission No", "Surname", "First name", "Date", "Period", "Subject", "Status", "Note", "Marked by"]];
    Store.pupilsIn(cls.id).forEach(p => { const r = Store.att(ui.date, p.id, ui.periodId); rows.push([p.admissionNo, p.last, p.first, ui.date, period.label, slot?.subject || "", r ? STATUS_LABEL[r.status] : "Not marked", r?.note || "", r ? Store.staffName(r.markedBy) : ""]); });
    this.downloadCSV(`${cls.name.replace(/[^\w]+/g, "_")}_${ui.date}_${period.id}.csv`, rows);
  },
  downloadCSV(name, rows) {
    const csv = rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    this.toast(`Exported ${name}`);
  },

  /* ======================================================================
     PUPILS
     ====================================================================== */
  vPupils() {
    const ui = this.ui.pupils; const classes = this.myClasses();
    let list = classes.flatMap(c => Store.pupilsIn(c.id));
    if (ui.classId !== "all") list = list.filter(p => p.classId === ui.classId);
    const q = ui.q.trim().toLowerCase();
    if (q) list = list.filter(p => `${p.first} ${p.last} ${p.admissionNo} ${p.guardian.name}`.toLowerCase().includes(q));
    return `
    <div class="toolbar">
      <div class="search">${icon("search")}<input class="input" placeholder="Search pupils, guardians, admission no." value="${esc(ui.q)}" data-input="pupils-q"></div>
      <select class="input" data-change="pupils-class"><option value="all">All my classes</option>${classes.map(c => `<option value="${c.id}" ${ui.classId === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
      <div class="grow"></div>
      <span class="muted small">${list.length} pupil${list.length === 1 ? "" : "s"}</span>
      ${this.can("attendance.export") ? `<button class="btn ghost sm" data-action="export-pupils">${icon("download")} CSV</button>` : ""}
      ${this.can("pupils.add") ? `<button class="btn sm" data-action="pupil-new">${icon("plus")} Enrol pupil</button>` : ""}
    </div>
    <div class="card"><div class="card-body tight table-wrap"><table>
      <thead><tr><th>Pupil</th><th>Class</th><th>Age</th><th>Guardian</th><th>Phone</th><th class="right">Attendance</th><th></th></tr></thead>
      <tbody>${list.map(p => { const s = this.pupilAttendancePct(p.id); return `<tr class="clickable" data-action="open-pupil" data-id="${p.id}">
        <td><div class="flex"><span class="avatar sm">${p.first[0]}${p.last[0]}</span><span><span class="bold">${esc(p.first)} ${esc(p.last)}</span><br><span class="tiny muted">${esc(p.admissionNo)} · ${p.gender === "F" ? "Girl" : "Boy"}</span></span></div></td>
        <td>${esc(Store.cls(p.classId).name)}</td><td>${Fmt.age(p.dob)}</td>
        <td>${esc(p.guardian.name)}<br><span class="tiny muted">${esc(p.guardian.relationship)}</span></td><td class="nowrap">${esc(p.guardian.phone)}</td>
        <td class="right"><span class="pill ${s.pct >= 95 ? "green" : s.pct >= 90 ? "grey" : s.pct >= 80 ? "amber" : "red"}">${s.total ? s.pct + "%" : "—"}</span></td>
        <td class="right">${icon("right", "ico")}</td></tr>`; }).join("") || `<tr><td colspan="7" class="empty">No pupils match.</td></tr>`}</tbody>
    </table></div></div>`;
  },
  pupilProfile(id) {
    const p = Store.pupil(id); if (!p) return;
    if (!this.myClasses().some(c => c.id === p.classId)) { this.toast("This pupil is outside your class scope.", "err"); return; }
    const s = this.pupilAttendancePct(p.id);
    const days = schoolDaysBetween(Store.db.school.term.start, Store.today());
    const absences = days.map(d => ({ d, r: Store.att(d, p.id) })).filter(x => x.r && x.r.status !== "P").reverse();
    const welfare = this.can("welfare.view") ? Store.db.welfare.filter(w => w.pupilId === p.id) : [];
    const med = this.can("pupils.view_medical");
    const body = `
      <div class="flex mb-16"><span class="avatar lg">${p.first[0]}${p.last[0]}</span><div><h2>${esc(p.first)} ${esc(p.last)}</h2><div class="muted">${esc(Store.cls(p.classId).name)} · ${esc(p.admissionNo)} · ${p.gender === "F" ? "Girl" : "Boy"} · ${Fmt.age(p.dob)}</div></div><div class="grow"></div><span class="pill ${s.pct >= 90 ? "green" : "red"}" style="font-size:14px">${s.pct}% attendance</span></div>
      <div class="grid cols-2">
        <div><div class="eyebrow mb-8">Guardian</div><dl class="kv"><dt>Name</dt><dd>${esc(p.guardian.name)} (${esc(p.guardian.relationship)})</dd><dt>Phone</dt><dd>${esc(p.guardian.phone)}</dd><dt>Email</dt><dd>${esc(p.guardian.email || "—")}</dd><dt>Address</dt><dd>${esc(p.address)}</dd><dt>Emergency</dt><dd>${esc(p.emergency.name)} · ${esc(p.emergency.phone)}</dd></dl></div>
        <div><div class="eyebrow mb-8">Medical & welfare</div>${med ? `<dl class="kv"><dt>Allergies</dt><dd>${p.medical.allergies ? `<span class="pill red">${esc(p.medical.allergies)}</span>` : "None recorded"}</dd><dt>Conditions</dt><dd>${esc(p.medical.conditions || "None recorded")}</dd><dt>Doctor</dt><dd>${esc(p.medical.doctor)}</dd><dt>DOB</dt><dd>${Fmt.date(p.dob)}</dd><dt>Enrolled</dt><dd>${Fmt.date(p.enrolled)}</dd></dl>` : `<div class="notice info small">${icon("lock")} Medical details are restricted. Ask the class teacher or Head Teacher.</div>`}</div>
      </div>
      <div class="eyebrow mt-24 mb-8">Absences and lates this term</div>
      ${absences.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Status</th><th>Note</th><th>Marked by</th></tr></thead><tbody>${absences.slice(0, 12).map(x => `<tr><td>${Fmt.date(x.d, "weekday")}</td><td><span class="pill ${STATUS_PILL[x.r.status]}">${STATUS_LABEL[x.r.status]}</span></td><td>${esc(x.r.note || "—")}</td><td class="muted">${Store.staffName(x.r.markedBy, { short: true })}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted small">Full attendance so far this term.</p>`}
      ${welfare.length ? `<div class="eyebrow mt-24 mb-8">Welfare log</div>${welfare.map(w => `<div class="notice ${w.status === "open" ? "warn" : "info"} small mb-8"><strong>${esc(w.type)}</strong> · ${Fmt.date(w.date)} · ${esc(w.summary)}</div>`).join("")}` : ""}
      ${p.notes ? `<div class="eyebrow mt-24 mb-8">Notes</div><p class="small">${esc(p.notes)}</p>` : ""}
      ${this.familyCardFor ? this.familyCardFor(p) : ""}`;
    const foot = `${this.can("pupils.add") ? `<button class="btn ghost danger" data-action="pupil-withdraw" data-id="${p.id}">Withdraw</button>` : ""}<div class="grow"></div>${this.can("welfare.log") ? `<button class="btn ghost" data-action="welfare-new" data-pupil="${p.id}">Log incident</button>` : ""}${this.can("pupils.edit") ? `<button class="btn" data-action="pupil-edit" data-id="${p.id}">${icon("edit")} Edit details</button>` : ""}`;
    this.modal({ title: "Pupil profile", body, foot, wide: true });
  },
  pupilForm(id) {
    const p = id ? Store.pupil(id) : { first: "", last: "", gender: "F", dob: "", classId: this.myClasses()[0]?.id, address: "", guardian: { name: "", relationship: "Mother", phone: "", email: "" }, emergency: { name: "", phone: "" }, medical: { allergies: "", conditions: "", doctor: "" }, notes: "" };
    const classes = this.myClasses(); const med = this.can("pupils.view_medical") || !id;
    const body = `<form data-form="pupil-save" data-id="${id || ""}">
      <div class="form-row three">
        <div><label class="field">First name</label><input class="input" name="first" required value="${esc(p.first)}"></div>
        <div><label class="field">Surname</label><input class="input" name="last" required value="${esc(p.last)}"></div>
        <div><label class="field">Gender</label><select class="input" name="gender"><option value="F" ${p.gender === "F" ? "selected" : ""}>Girl</option><option value="M" ${p.gender === "M" ? "selected" : ""}>Boy</option></select></div>
      </div>
      <div class="form-row mt-8">
        <div><label class="field">Date of birth</label><input class="input" type="date" name="dob" required value="${p.dob}"></div>
        <div><label class="field">Class</label><select class="input" name="classId">${classes.map(c => `<option value="${c.id}" ${c.id === p.classId ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div>
      </div>
      <div class="mt-8"><label class="field">Home address</label><input class="input" name="address" value="${esc(p.address)}"></div>
      <div class="eyebrow mt-16 mb-8">Guardian</div>
      <div class="form-row three">
        <div><label class="field">Name</label><input class="input" name="gname" required value="${esc(p.guardian.name)}"></div>
        <div><label class="field">Relationship</label><input class="input" name="grel" value="${esc(p.guardian.relationship)}"></div>
        <div><label class="field">Phone</label><input class="input" name="gphone" required value="${esc(p.guardian.phone)}"></div>
      </div>
      <div class="form-row mt-8">
        <div><label class="field">Email</label><input class="input" name="gemail" type="email" value="${esc(p.guardian.email)}"></div>
        <div><label class="field">Emergency contact (name · phone)</label><div class="flex"><input class="input" name="ename" placeholder="Name" value="${esc(p.emergency.name)}"><input class="input" name="ephone" placeholder="Phone" value="${esc(p.emergency.phone)}"></div></div>
      </div>
      ${med ? `<div class="eyebrow mt-16 mb-8">Medical</div>
      <div class="form-row three">
        <div><label class="field">Allergies</label><input class="input" name="allergies" value="${esc(p.medical.allergies)}"></div>
        <div><label class="field">Conditions</label><input class="input" name="conditions" value="${esc(p.medical.conditions)}"></div>
        <div><label class="field">Doctor / clinic</label><input class="input" name="doctor" value="${esc(p.medical.doctor)}"></div>
      </div>` : ""}
      <div class="mt-8"><label class="field">Notes</label><textarea class="input" name="notes">${esc(p.notes)}</textarea></div>
      <div class="modal-foot" style="padding:16px 0 0;border:0"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button class="btn" type="submit">${id ? "Save changes" : "Enrol pupil"}</button></div>
    </form>`;
    this.modal({ title: id ? "Edit pupil" : "Enrol new pupil", body, wide: true });
  },
  pupilSave(id, f) {
    const me = this.me();
    let p = id ? Store.pupil(id) : null;
    if (!p) {
      const n = Store.db.pupils.length + 1041;
      p = { id: Store.uid("p"), admissionNo: `AIS/${n}`, enrolled: Store.today(), status: "active", guardian: {}, emergency: {}, medical: { allergies: "", conditions: "", doctor: "" } };
      Store.db.pupils.push(p);
    }
    Object.assign(p, { first: f.first.trim(), last: f.last.trim(), gender: f.gender, dob: f.dob, classId: f.classId, address: f.address.trim(), notes: f.notes.trim() });
    p.guardian = { name: f.gname.trim(), relationship: f.grel.trim(), phone: f.gphone.trim(), email: (f.gemail || "").trim() };
    p.emergency = { name: (f.ename || "").trim(), phone: (f.ephone || "").trim() };
    if (f.allergies !== undefined) p.medical = { allergies: f.allergies.trim(), conditions: f.conditions.trim(), doctor: f.doctor.trim() };
    Store.audit(`${id ? "Updated" : "Enrolled"} pupil ${p.first} ${p.last} (${p.admissionNo})`);
    Store.save(); this.closeModal(); this.toast(id ? "Pupil updated." : `${p.first} enrolled in ${Store.cls(p.classId).name}.`); this.render();
  },
  exportPupils() {
    const rows = [["Admission No", "Surname", "First name", "Gender", "DOB", "Class", "Guardian", "Relationship", "Phone", "Email", "Attendance %"]];
    this.myClasses().flatMap(c => Store.pupilsIn(c.id)).forEach(p => rows.push([p.admissionNo, p.last, p.first, p.gender, p.dob, Store.cls(p.classId).name, p.guardian.name, p.guardian.relationship, p.guardian.phone, p.guardian.email, this.pupilAttendancePct(p.id).pct]));
    this.downloadCSV(`pupils_${Store.today()}.csv`, rows);
  },

  /* ======================================================================
     STAFF
     ====================================================================== */
  /* People who have asked for an account from the public page. Nobody has one
     until HR or the Head Teacher says so. */
  accessRequestsCard() {
    if (!this.can("accounts.manage")) return "";
    const all = Store.db.accessRequests || [];
    const pending = all.filter(r => r.status === "pending");
    if (!all.length) return "";
    return `<div class="card mb-16">
      <div class="card-head"><div><h3>Requests for an account</h3><div class="tiny muted">Sent from the school's public page. Approving one creates the staff record and issues a temporary password, shown once.</div></div>
      ${pending.length ? `<span class="pill gold">${pending.length} waiting</span>` : `<span class="pill grey">All dealt with</span>`}</div>
      <div class="card-body tight table-wrap"><table>
        <thead><tr><th>Name</th><th>Asked for</th><th>Contact</th><th>Note</th><th>When</th><th></th></tr></thead>
        <tbody>${all.slice(0, 12).map(r => `<tr>
          <td><span class="bold">${esc(r.last)}, ${esc(r.first)}</span>${r.status !== "pending" ? `<br><span class="pill ${r.status === "approved" ? "green" : "grey"} tiny">${esc(r.status)}</span>` : ""}</td>
          <td class="small">${esc(ROLES[r.role]?.label || r.role)}</td>
          <td class="small">${esc(r.email)}${r.phone ? `<br><span class="tiny muted">${esc(r.phone)}</span>` : ""}</td>
          <td class="tiny muted">${esc(r.note || "—")}</td>
          <td class="tiny muted nowrap">${Fmt.date(r.at, "short")}</td>
          <td class="right nowrap">${r.status === "pending" ? `
            <button class="btn xs ghost" data-action="access-decide" data-id="${r.id}" data-decision="decline">Decline</button>
            <button class="btn xs" data-action="access-decide" data-id="${r.id}" data-decision="approve">Approve</button>` : ""}</td>
        </tr>`).join("")}</tbody>
      </table></div></div>`;
  },

  vStaff() {
    const q = this.ui.staff.q.trim().toLowerCase();
    const list = Store.db.staff.filter(s => s.active).filter(s => !q || `${s.first} ${s.last} ${ROLES[s.role].label} ${s.email}`.toLowerCase().includes(q)).sort((a, b) => ROLES[a.role].tier - ROLES[b.role].tier || a.last.localeCompare(b.last));
    const classOf = (s) => Store.db.classes.filter(c => c.teacherId === s.id || c.assistantId === s.id).map(c => c.name).join(", ");
    return `
    <div class="toolbar">
      <div class="search">${icon("search")}<input class="input" placeholder="Search staff" value="${esc(this.ui.staff.q)}" data-input="staff-q"></div>
      <div class="grow"></div>
      ${this.can("accounts.manage") ? `<button class="btn sm" data-action="staff-new">${icon("plus")} Add staff member</button>` : ""}
    </div>
    ${this.accessRequestsCard()}
    <div class="card"><div class="card-body tight table-wrap"><table>
      <thead><tr><th>Name</th><th>Role</th><th>Class</th><th>Email</th><th>Phone</th><th>Started</th>${this.canAny(["staff.manage", "accounts.manage"]) ? "<th></th>" : ""}</tr></thead>
      <tbody>${list.map(s => `<tr>
        <td><div class="flex"><span class="avatar sm ${ROLES[s.role].tier <= 3 ? "navy" : ""}">${Fmt.initials(s)}</span><span class="bold">${esc(s.title)} ${esc(s.first)} ${esc(s.last)}</span></div></td>
        <td><span class="pill ${ROLES[s.role].tier <= 2 ? "gold" : ""}">${ROLES[s.role].label}</span></td>
        <td>${esc(classOf(s) || "—")}</td><td><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></td><td class="nowrap">${esc(s.phone)}</td><td>${Fmt.date(s.started)}</td>
        ${this.canAny(["staff.manage", "accounts.manage"]) ? `<td class="right nowrap">
          ${canIssueAccount(this.me(), s) ? `<button class="btn xs ghost" data-action="staff-reset" data-id="${s.id}" title="Issue a new temporary password">${icon("key")} Reset sign-in</button>` : ""}
          ${this.can("staff.manage") ? `<button class="btn xs ghost" data-action="staff-edit" data-id="${s.id}">Edit</button>` : ""}
        </td>` : ""}
      </tr>`).join("")}</tbody>
    </table></div></div>`;
  },
  staffForm(id) {
    const s = id ? Store.staff(id) : { title: "Ms", first: "", last: "", role: "assistant", email: "", phone: "", started: Store.today(), pin: "1234" };
    const me = this.me();
    /* Creating an account can only reach your own level and below, so the list
       says so rather than offering a choice the server will refuse. */
    const allowed = id ? Object.keys(ROLES).filter(k => me.role === "head" || k !== "head") : issuableRoles(me);
    const roleOpts = allowed.map(k => `<option value="${k}" ${s.role === k ? "selected" : ""}>${ROLES[k].label}</option>`).join("");
    const classAlloc = Store.db.classes.map(c => `<div class="form-row"><div class="small" style="padding-top:8px">${esc(c.name)}</div><select class="input" name="alloc_${c.id}"><option value="">—</option><option value="teacher" ${c.teacherId === s.id ? "selected" : ""}>Class teacher</option><option value="assistant" ${c.assistantId === s.id ? "selected" : ""}>Assistant teacher</option></select></div>`).join("");
    const body = `<form data-form="staff-save" data-id="${id || ""}">
      <div class="form-row three">
        <div><label class="field">Title</label><select class="input" name="title">${["Mrs", "Ms", "Mr", "Dr", "Miss"].map(t => `<option ${s.title === t ? "selected" : ""}>${t}</option>`).join("")}</select></div>
        <div><label class="field">First name</label><input class="input" name="first" required value="${esc(s.first)}"></div>
        <div><label class="field">Surname</label><input class="input" name="last" required value="${esc(s.last)}"></div>
      </div>
      <div class="form-row mt-8">
        <div><label class="field">Role (tier)</label><select class="input" name="role" ${s.role === "head" && me.role !== "head" ? "disabled" : ""}>${roleOpts}</select><div class="help">Changing the role resets that person's permissions to the role defaults.</div></div>
        <div><label class="field">Start date</label><input class="input" type="date" name="started" value="${s.started}"></div>
      </div>
      <div class="form-row mt-8">
        <div><label class="field">Email</label><input class="input" type="email" name="email" required value="${esc(s.email)}"></div>
        <div><label class="field">Phone</label><input class="input" name="phone" value="${esc(s.phone)}"></div>
      </div>
      <div class="eyebrow mt-16 mb-8">Class allocation</div>${classAlloc}
      ${id ? `<div class="mt-16"><label class="flex small"><input type="checkbox" name="active" ${s.active ? "checked" : ""}> Active account (untick to deactivate; the person can no longer sign in)</label></div>`
           : `<div class="eyebrow mt-24 mb-8">Their first password</div>
              ${this.passwordField("Password to give them")}
              <div class="notice info small mt-16">${icon("key")} Shown once on the next screen and never again — it is stored hashed. They may keep it, or change it themselves at any time under <strong>My access</strong>.</div>`}
      <div class="modal-foot" style="padding:16px 0 0;border:0"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button class="btn" type="submit">${id ? "Save" : "Add staff member"}</button></div>
    </form>`;
    this.modal({ title: id ? "Edit staff member" : "Add staff member", body });
  },
  /* Allocations are a change to the classes list, not to the staff record, so
     they are applied separately whichever way the record itself was saved. */
  staffAllocate(staffId, f) {
    Store.db.classes.forEach(c => {
      const a = f[`alloc_${c.id}`];
      if (c.teacherId === staffId && a !== "teacher") c.teacherId = null;
      if (c.assistantId === staffId && a !== "assistant") c.assistantId = null;
      if (a === "teacher") c.teacherId = staffId;
      if (a === "assistant") c.assistantId = staffId;
    });
  },

  async staffSave(id, f, raw) {
    const me = this.me();
    const form = document.querySelector('[data-form="staff-save"]');

    /* --- a new colleague: the server creates the account and hands back a
       temporary password, which exists only on the screen that follows. --- */
    if (!id) {
      if (!canIssueRole(me, f.role)) return this.toast(`You cannot set up an account for ${ROLES[f.role] ? ROLES[f.role].label : f.role}. It sits above your own level.`, "err");
      const newId = Store.uid("s");
      const password = String(f.password || "").trim();
      const row = {
        id: newId, title: f.title, first: f.first.trim(), last: f.last.trim(), role: f.role,
        email: f.email.trim(), phone: f.phone.trim(), started: f.started,
        active: true, grants: [], revokes: [], extraClasses: [],
      };
      const done = form ? this.landingBusy(form, "Creating…") : () => {};
      const shown = (issued) => {
        this.closeModal();
        this.credentialModal({ title: `${row.first} ${row.last} can now sign in`, who: `${row.first} ${row.last}`, email: row.email, password: issued });
        this.render();
      };
      const failed = (e) => {
        done();
        if (form) this.landingFormError(form, e.message || "Could not create that account.");
        else this.toast(e.message || "Could not create that account.", "err");
      };

      try {
        if (Store.shared) {
          const out = await Store.request(`records/staff/${newId}`, { ...row, password }, "PUT");
          this.staffAllocate(newId, f);
          Store.save();
          shown((out && out.temporaryPassword) || password);
          return;
        }
        /* Demo mode: the record here, a real credential in this browser. */
        Store.db.staff.push(row);
        this.staffAllocate(newId, f);
        await Store.demoIssue(newId, password);
        Store.audit(`Added staff record for ${row.title} ${row.first} ${row.last} (${ROLES[row.role].label})`);
        Store.save();
        shown(password);
      } catch (e) { failed(e); }
      return;
    }

    /* --- an existing record --- */
    const s = Store.staff(id);
    if (!s) return;
    if (s.role === "head" && me.role !== "head") { this.toast("Only the Head Teacher can edit the Head Teacher's record.", "err"); return; }
    const roleChanged = f.role && f.role !== s.role;
    Object.assign(s, { title: f.title, first: f.first.trim(), last: f.last.trim(), email: f.email.trim(), phone: f.phone.trim(), started: f.started });
    if (f.role) s.role = f.role;
    if (roleChanged) { s.grants = []; s.revokes = []; }
    s.active = raw.has("active");
    this.staffAllocate(s.id, f);
    Store.audit(`Updated staff record for ${s.title} ${s.first} ${s.last}${roleChanged ? ` (role set to ${ROLES[s.role].label})` : ""}`);
    Store.save(); this.closeModal(); this.toast("Staff record saved."); this.render();
  },

  /* ======================================================================
     MESSAGES
     ====================================================================== */
  visibleChannels() {
    const me = this.me();
    return Store.db.channels.filter(c => !c.members || c.members.includes(me.id) || me.role === "head");
  },
  dmId(a, b) { return `dm:${[a, b].sort().join(":")}`; },
  unreadIn(channelId) {
    const me = this.me(); const last = Store.db.reads[`${me.id}|${channelId}`] || "1970-01-01";
    return Store.db.messages.filter(m => m.channel === channelId && m.from !== me.id && m.at > last).length;
  },
  markRead(channelId) { Store.db.reads[`${this.me().id}|${channelId}`] = new Date().toISOString(); Store.save(); },
  vMessages() {
    const me = this.me(); const ui = this.ui.messages;
    const channels = this.visibleChannels();
    const others = Store.db.staff.filter(s => s.active && s.id !== me.id).sort((a, b) => ROLES[a.role].tier - ROLES[b.role].tier);
    const isDm = ui.channel.startsWith("dm:");
    const ch = channels.find(c => c.id === ui.channel);
    if (!isDm && !ch) ui.channel = "announcements";
    const dmOther = isDm ? Store.staff(ui.channel.split(":").filter(x => x !== "dm" && x !== me.id)[0]) : null;
    const msgs = Store.db.messages.filter(m => m.channel === ui.channel).sort((a, b) => a.at.localeCompare(b.at));
    this.markRead(ui.channel);
    const canPost = isDm ? this.can("messages.send") : ch.kind === "broadcast" ? this.can("messages.broadcast") : this.can("messages.send");
    const title = isDm ? `${dmOther.title} ${dmOther.first} ${dmOther.last}` : ch.name;
    const sub = isDm ? `${ROLES[dmOther.role].label} · Direct message` : ch.desc;
    return `<div class="card"><div class="msg-layout">
      <div class="channel-list">
        <div class="nav-section" style="color:var(--gold-600);padding-left:10px">Channels</div>
        ${channels.map(c => `<div class="item ${ui.channel === c.id ? "active" : ""}" data-action="open-channel" data-id="${c.id}">${icon(c.kind === "broadcast" ? "megaphone" : "chat")}<span>${esc(c.name)}</span>${this.unreadIn(c.id) ? `<span class="badge">${this.unreadIn(c.id)}</span>` : ""}</div>`).join("")}
        <div class="nav-section" style="color:var(--gold-600);padding-left:10px">Direct messages</div>
        ${others.map(s => { const id = this.dmId(me.id, s.id); const u = this.unreadIn(id); return `<div class="item ${ui.channel === id ? "active" : ""}" data-action="open-channel" data-id="${id}"><span class="avatar sm ${ROLES[s.role].tier <= 3 ? "navy" : ""}">${Fmt.initials(s)}</span><span>${esc(s.first)} ${esc(s.last)}</span>${u ? `<span class="badge">${u}</span>` : ""}</div>`; }).join("")}
      </div>
      <div class="thread">
        <div class="thread-head"><h3>${esc(title)}</h3><div class="tiny muted">${esc(sub)}${!isDm && ch.members ? ` · ${ch.members.length} members` : ""}</div></div>
        <div class="thread-body">${msgs.map(m => { const mine = m.from === me.id; const s = Store.staff(m.from); return `<div class="msg ${mine ? "mine" : ""} ${!isDm && ch.kind === "broadcast" ? "broadcast" : ""}"><span class="avatar sm ${mine ? "navy" : ""}">${Fmt.initials(s)}</span><div class="bubble"><div class="meta">${mine ? "You" : Store.staffName(m.from)} · ${Fmt.dateTime(m.at)}</div>${esc(m.text)}</div></div>`; }).join("") || `<div class="empty">No messages yet.</div>`}</div>
        <form class="thread-compose" data-form="send-message">
          ${canPost ? `<textarea class="input" name="text" placeholder="${!isDm && ch.kind === "broadcast" ? "Write an announcement to all staff…" : "Write a message…"}" required></textarea><button class="btn" type="submit">Send</button>` : `<div class="notice info small grow">${icon("lock")} ${!isDm && ch.kind === "broadcast" ? "Only the Head Teacher and HR can post announcements. You can read them here." : "Your role does not include sending messages."}</div>`}
        </form>
      </div>
    </div></div>`;
  },
  sendMessage(text) {
    const me = this.me(); const ui = this.ui.messages; text = text.trim(); if (!text) return;
    Store.db.messages.push({ id: Store.uid("m"), channel: ui.channel, from: me.id, at: new Date().toISOString(), text });
    Store.save(); this.render();
  },

  /* ======================================================================
     DOCUMENTS
     ====================================================================== */
  visibleCategories() {
    const me = this.me();
    return Store.db.docCategories.filter(c => c.audience.includes("*") || c.audience.includes(me.role) || me.role === "head");
  },
  vDocuments() {
    const ui = this.ui.docs; const cats = this.visibleCategories();
    if (ui.cat !== "all" && !cats.some(c => c.id === ui.cat)) ui.cat = "all";
    const q = ui.q.trim().toLowerCase();
    let docs = Store.db.documents.filter(d => cats.some(c => c.id === d.cat));
    if (ui.cat !== "all") docs = docs.filter(d => d.cat === ui.cat);
    if (q) docs = docs.filter(d => d.name.toLowerCase().includes(q));
    docs.sort((a, b) => b.updated.localeCompare(a.updated));
    const typeLbl = { pdf: "PDF", doc: "DOC", sheet: "XLS", slide: "PPT", folder: "DIR", form: "FRM" };
    const driveState = Drive.connected() ? `<span class="pill green">${icon("cloud")} Drive connected</span><button class="btn ghost sm" data-action="drive-browse">Browse Drive</button><button class="btn ghost sm" data-action="drive-disconnect">Disconnect</button>` : Drive.configured() ? `<button class="btn ghost sm" data-action="drive-connect">${icon("cloud")} Connect Google Drive</button>` : this.can("settings.manage") ? `<a class="btn ghost sm" href="#/settings" title="Add a Google Client ID to browse Drive directly">${icon("cloud")} Set up Drive</a>` : "";
    return `
    <div class="toolbar">
      <div class="search">${icon("search")}<input class="input" placeholder="Search documents" value="${esc(ui.q)}" data-input="docs-q"></div>
      <div class="grow"></div>
      ${driveState}
      ${this.can("documents.upload") ? `<button class="btn sm" data-action="doc-new">${icon("link")} Link a document</button>` : ""}
    </div>
    <div class="tabs"><button class="${ui.cat === "all" ? "active" : ""}" data-action="docs-cat" data-id="all">All</button>${cats.map(c => `<button class="${ui.cat === c.id ? "active" : ""}" data-action="docs-cat" data-id="${c.id}">${esc(c.name)}</button>`).join("")}</div>
    ${ui.cat !== "all" ? `<p class="muted small mb-16">${esc(cats.find(c => c.id === ui.cat).desc)} · Visible to: ${this.audienceLabel(cats.find(c => c.id === ui.cat).audience)}</p>` : `<div class="notice gold small mb-16">${icon("info")} Documents live in the school's Google Drive. Opening one uses Drive's own sharing permissions, so make sure the file is shared with staff who need it.</div>`}
    <div class="doc-grid">${docs.map(d => `<div class="card doc">
      <div class="flex"><span class="type ${d.type}">${typeLbl[d.type] || "DOC"}</span><div class="grow"></div>${d.source === "drive" ? `<span class="pill grey tiny" title="Google Drive">${icon("cloud")}</span>` : ""}${this.can("documents.manage") ? `<button class="iconbtn" data-action="doc-remove" data-id="${d.id}" title="Remove from library">${icon("trash")}</button>` : ""}</div>
      <div class="name"><a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.name)}</a></div>
      <div class="tiny muted">${esc(Store.db.docCategories.find(c => c.id === d.cat)?.name || "")}<br>Updated ${Fmt.date(d.updated)} · ${Store.staffName(d.owner, { short: true })}</div>
      <a class="btn ghost xs" href="${esc(d.url)}" ${d.source === "local" && !/\.pdf$/i.test(d.url) ? "download" : 'target="_blank" rel="noopener"'} style="align-self:flex-start">${d.source === "local" && !/\.pdf$/i.test(d.url) ? icon("download") + " Download" : icon("external") + " Open"}</a>
    </div>`).join("") || `<div class="card" style="grid-column:1/-1"><div class="empty">${icon("folder")}<br>No documents here yet.</div></div>`}</div>`;
  },
  audienceLabel(aud) { return aud.includes("*") ? "All staff" : aud.map(r => ROLES[r]?.short || r).join(", "); },
  docForm(prefill = {}) {
    const cats = this.visibleCategories();
    const body = `<form data-form="doc-save">
      <div><label class="field">Document name</label><input class="input" name="name" required value="${esc(prefill.name || "")}"></div>
      <div class="mt-8"><label class="field">Google Drive link</label><input class="input" name="url" type="url" required placeholder="https://docs.google.com/… or https://drive.google.com/…" value="${esc(prefill.url || "")}"><div class="help">Paste the share link from Google Drive, Docs, Sheets, Slides or Forms. The document stays in Drive; the portal just files the link.</div></div>
      <div class="form-row mt-8">
        <div><label class="field">Category</label><select class="input" name="cat">${cats.map(c => `<option value="${c.id}" ${(prefill.cat || this.ui.docs.cat) === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div>
        <div><label class="field">Type</label><select class="input" name="type">${["doc", "sheet", "slide", "pdf", "form", "folder"].map(t => `<option value="${t}" ${(prefill.type || "doc") === t ? "selected" : ""}>${{ doc: "Document", sheet: "Spreadsheet", slide: "Presentation", pdf: "PDF", form: "Form", folder: "Folder" }[t]}</option>`).join("")}</select></div>
      </div>
      <div class="modal-foot" style="padding:16px 0 0;border:0"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button class="btn" type="submit">${icon("link")} File document</button></div>
    </form>`;
    this.modal({ title: "Link a Google Drive document", body });
  },
  docSave(f) {
    Store.db.documents.push({ id: Store.uid("d"), cat: f.cat, name: f.name.trim(), type: f.type, url: f.url.trim(), owner: this.me().id, updated: Store.today(), source: Drive.isDriveUrl(f.url) ? "drive" : "link" });
    Store.audit(`Filed document "${f.name.trim()}"`); Store.save(); this.closeModal(); this.toast("Document filed."); this.render();
  },
  async driveConnect() {
    try { await Drive.connect(); this.toast("Google Drive connected."); this.render(); this.driveBrowse(); }
    catch (e) { this.toast(e.message, "err"); }
  },
  async driveBrowse() {
    const ui = this.ui.drive;
    const renderList = () => {
      const body = `
        <div class="flex mb-16"><div class="search grow">${icon("search")}<input class="input" placeholder="Search your Drive" value="${esc(ui.q)}" data-input="drive-q" style="width:100%"></div><button class="btn ghost sm" data-action="drive-search">Search</button></div>
        ${ui.error ? `<div class="notice err mb-16">${esc(ui.error)}</div>` : ""}
        ${ui.loading ? `<div class="empty">Loading files from Google Drive…</div>` : `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Modified</th><th></th></tr></thead><tbody>${ui.files.map(f => `<tr><td><a href="${esc(f.webViewLink)}" target="_blank" rel="noopener">${esc(f.name)}</a><br><span class="tiny muted">${esc(f.mimeType.replace("application/vnd.google-apps.", "Google "))}</span></td><td class="small">${Fmt.date(f.modifiedTime)}</td><td class="right"><button class="btn xs" data-action="drive-file" data-name="${esc(f.name)}" data-url="${esc(f.webViewLink)}" data-type="${Drive.typeFromMime(f.mimeType)}">File in portal</button></td></tr>`).join("") || `<tr><td colspan="3" class="empty">No files found.</td></tr>`}</tbody></table></div>`}`;
      this.modal({ title: "Browse Google Drive", body, wide: true });
    };
    ui.loading = true; ui.error = ""; renderList();
    try { ui.files = await Drive.listFiles({ folderId: Store.db.school.driveRootFolder || undefined, query: ui.q || undefined }); }
    catch (e) { ui.error = e.message; ui.files = []; }
    ui.loading = false; renderList();
  },

  /* ======================================================================
     CALENDAR
     ====================================================================== */
  vCalendar() {
    const ui = this.ui.calendar; const today = Store.today();
    const first = new Date(ui.y, ui.m, 1); const startDow = (first.getDay() + 6) % 7; // Monday first
    const daysIn = new Date(ui.y, ui.m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysIn; d++) cells.push(d);
    while (cells.length % 7) cells.push(null);
    const evOn = (isoStr) => Store.db.events.filter(e => e.date === isoStr);
    const monthName = first.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    const upcoming = Store.db.events.filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
    return `
    <div class="toolbar">
      <button class="btn ghost sm" data-action="cal-nav" data-delta="-1">${icon("left")}</button>
      <h2 style="min-width:200px;text-align:center">${monthName}</h2>
      <button class="btn ghost sm" data-action="cal-nav" data-delta="1">${icon("right")}</button>
      <button class="btn ghost sm" data-action="cal-today">Today</button>
      <div class="grow"></div>
      ${this.can("calendar.manage") ? `<button class="btn sm" data-action="event-new">${icon("plus")} Add event</button>` : ""}
    </div>
    <div class="grid side">
      <div class="card"><div class="card-body tight"><div class="cal">
        ${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => `<div class="dow">${d}</div>`).join("")}
        ${cells.map(d => { if (!d) return `<div class="day other"></div>`; const isoStr = `${ui.y}-${String(ui.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; return `<div class="day ${isoStr === today ? "today" : ""}"><span class="num">${d}</span>${evOn(isoStr).map(e => `<span class="ev ${e.colour}" title="${esc(e.title)}" ${this.can("calendar.manage") ? `data-action="event-edit" data-id="${e.id}" style="cursor:pointer"` : ""}>${esc(e.title)}</span>`).join("")}</div>`; }).join("")}
      </div></div></div>
      <div class="card"><div class="card-head"><h3>Upcoming</h3></div><div class="card-body"><ul class="timeline">${upcoming.map(e => `<li><span class="t">${Fmt.date(e.date, "short")}</span><span><span class="bold">${esc(e.title)}</span><br><span class="tiny muted">${esc(e.kind)}</span></span></li>`).join("")}</ul></div>
        <div class="card-foot small muted">${esc(Store.db.school.term.name)}: ${Fmt.date(Store.db.school.term.start)} – ${Fmt.date(Store.db.school.term.end)}</div></div>
    </div>`;
  },
  eventForm(id) {
    const e = id ? Store.db.events.find(x => x.id === id) : { date: Store.today(), title: "", kind: "event", colour: "" };
    const body = `<form data-form="event-save" data-id="${id || ""}">
      <div><label class="field">Title</label><input class="input" name="title" required value="${esc(e.title)}"></div>
      <div class="form-row three mt-8">
        <div><label class="field">Date</label><input class="input" type="date" name="date" required value="${e.date}"></div>
        <div><label class="field">Kind</label><select class="input" name="kind">${["event", "meeting", "deadline", "academic", "term"].map(k => `<option ${e.kind === k ? "selected" : ""}>${k}</option>`).join("")}</select></div>
        <div><label class="field">Colour</label><select class="input" name="colour"><option value="" ${!e.colour ? "selected" : ""}>Navy</option><option value="gold" ${e.colour === "gold" ? "selected" : ""}>Gold</option><option value="red" ${e.colour === "red" ? "selected" : ""}>Red</option><option value="green" ${e.colour === "green" ? "selected" : ""}>Green</option></select></div>
      </div>
      <div class="modal-foot" style="padding:16px 0 0;border:0">${id ? `<button type="button" class="btn ghost" data-action="event-delete" data-id="${id}" class="t-bad">Delete</button>` : ""}<div class="grow"></div><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button class="btn" type="submit">Save</button></div>
    </form>`;
    this.modal({ title: id ? "Edit event" : "Add event", body });
  },

  /* ======================================================================
     WELFARE
     ====================================================================== */
  vWelfare() {
    const me = this.me(); const ui = this.ui.welfare;
    let list = Store.db.welfare.slice();
    if (!this.can("welfare.view")) list = list.filter(w => w.reportedBy === me.id); // log-only roles see their own entries
    else { const ids = this.myClasses().map(c => c.id); list = list.filter(w => ids.includes(w.classId) || w.reportedBy === me.id); }
    if (ui.filter !== "all") list = list.filter(w => w.status === ui.filter);
    list.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    const sev = { low: "grey", medium: "amber", high: "red" };
    return `
    <div class="toolbar">
      <div class="tabs" style="margin:0;border:0">${["open", "closed", "all"].map(f => `<button class="${ui.filter === f ? "active" : ""}" data-action="welfare-filter" data-id="${f}">${f[0].toUpperCase() + f.slice(1)}</button>`).join("")}</div>
      <div class="grow"></div>
      ${this.can("welfare.log") ? `<button class="btn sm" data-action="welfare-new">${icon("plus")} Log incident</button>` : ""}
    </div>
    ${!this.can("welfare.view") ? `<div class="notice info small mb-16">${icon("info")} You can log incidents and see the ones you reported. The full welfare log is restricted to class teachers and leadership.</div>` : ""}
    <div class="card"><div class="card-body tight table-wrap"><table>
      <thead><tr><th>Date</th><th>Pupil</th><th>Type</th><th>Severity</th><th>Summary</th><th>Reported by</th><th>Status</th></tr></thead>
      <tbody>${list.map(w => { const p = w.pupilId ? Store.pupil(w.pupilId) : null; return `<tr class="clickable" data-action="welfare-open" data-id="${w.id}">
        <td class="nowrap">${Fmt.date(w.date, "short")} ${esc(w.time)}</td>
        <td>${p ? `<span class="bold">${esc(p.first)} ${esc(p.last)}</span><br><span class="tiny muted">${esc(Store.cls(w.classId)?.name || "")}</span>` : esc(Store.cls(w.classId)?.name || "—")}</td>
        <td>${esc(w.type)}</td><td><span class="pill ${sev[w.severity]}">${w.severity}</span></td>
        <td class="small" style="max-width:360px">${esc(w.summary)}</td><td class="muted small">${Store.staffName(w.reportedBy, { short: true })}</td>
        <td><span class="pill ${w.status === "open" ? "amber" : "green"}">${w.status}</span></td></tr>`; }).join("") || `<tr><td colspan="7" class="empty">Nothing logged.</td></tr>`}</tbody>
    </table></div></div>`;
  },
  welfareForm(pupilId) {
    const pupils = this.myClasses().flatMap(c => Store.pupilsIn(c.id));
    const body = `<form data-form="welfare-save">
      <div class="form-row">
        <div><label class="field">Pupil</label><select class="input" name="pupilId"><option value="">— Not pupil-specific —</option>${pupils.map(p => `<option value="${p.id}" ${p.id === pupilId ? "selected" : ""}>${esc(p.last)}, ${esc(p.first)} (${esc(Store.cls(p.classId).grade)})</option>`).join("")}</select></div>
        <div><label class="field">Class</label><select class="input" name="classId">${this.myClasses().map(c => `<option value="${c.id}" ${pupilId && Store.pupil(pupilId)?.classId === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div>
      </div>
      <div class="form-row three mt-8">
        <div><label class="field">Type</label><select class="input" name="type">${["First aid", "Welfare concern", "Behaviour", "Safeguarding", "Accident", "Other"].map(t => `<option>${t}</option>`).join("")}</select></div>
        <div><label class="field">Severity</label><select class="input" name="severity"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
        <div><label class="field">Date · time</label><div class="flex"><input class="input" type="date" name="date" value="${Store.today()}" required><input class="input" type="time" name="time" value="${new Date().toTimeString().slice(0, 5)}" required></div></div>
      </div>
      <div class="mt-8"><label class="field">What happened</label><textarea class="input" name="summary" required></textarea></div>
      <div class="mt-8"><label class="field">Actions taken / follow-up</label><textarea class="input" name="actions"></textarea></div>
      <div class="notice warn small mt-8">Safeguarding concerns must also be reported to the Head Teacher in person the same day.</div>
      <div class="modal-foot" style="padding:16px 0 0;border:0"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button class="btn" type="submit">Log incident</button></div>
    </form>`;
    this.modal({ title: "Log an incident or welfare concern", body });
  },
  welfareOpen(id) {
    const w = Store.db.welfare.find(x => x.id === id); const p = w.pupilId ? Store.pupil(w.pupilId) : null;
    const canClose = this.can("welfare.view") && (this.me().role !== "assistant");
    const body = `<dl class="kv"><dt>Pupil</dt><dd>${p ? `${esc(p.first)} ${esc(p.last)}` : "—"}</dd><dt>Class</dt><dd>${esc(Store.cls(w.classId)?.name || "")}</dd><dt>When</dt><dd>${Fmt.date(w.date, "long")} at ${esc(w.time)}</dd><dt>Type</dt><dd>${esc(w.type)} · ${esc(w.severity)} severity</dd><dt>Reported by</dt><dd>${Store.staffName(w.reportedBy)}</dd><dt>Status</dt><dd>${w.status}${w.closedBy ? ` by ${Store.staffName(w.closedBy)} on ${Fmt.date(w.closedOn)}` : ""}</dd></dl>
      <div class="eyebrow mt-16 mb-8">Summary</div><p>${esc(w.summary)}</p><div class="eyebrow mt-16 mb-8">Actions</div><p>${esc(w.actions || "—")}</p>`;
    const foot = `<button class="btn ghost" data-action="close-modal">Close</button>${canClose && w.status === "open" ? `<button class="btn" data-action="welfare-close" data-id="${w.id}">Mark resolved</button>` : ""}`;
    this.modal({ title: "Welfare entry", body, foot });
  },

  /* ======================================================================
     REPORTS
     ====================================================================== */
  vReports() {
    const classes = this.myClasses(); const today = Store.today();
    const days = schoolDaysBetween(Store.db.school.term.start, today);
    const byClass = classes.map(c => ({ c, s: this.termStats(Store.pupilsIn(c.id).map(p => p.id)) }));
    const allIds = classes.flatMap(c => Store.pupilsIn(c.id).map(p => p.id));
    const trend = days.slice(-10).map(d => { let p = 0, t = 0; allIds.forEach(id => { const r = Store.att(d, id); if (r) { t++; if (r.status === "P" || r.status === "L") p++; } }); return { d, pct: Fmt.pct(p, t), t }; });
    const low = allIds.map(id => ({ p: Store.pupil(id), s: this.pupilAttendancePct(id) })).filter(x => x.s.total >= 3 && x.s.pct < 90).sort((a, b) => a.s.pct - b.s.pct);
    const lates = allIds.map(id => ({ p: Store.pupil(id), n: days.filter(d => Store.att(d, id)?.status === "L").length })).filter(x => x.n >= 2).sort((a, b) => b.n - a.n).slice(0, 8);
    const overall = this.termStats(allIds);
    const missed = this.missedRegisters(classes.map(c => c.id), Store.db.school.term.start, today);
    return `
    <div class="grid cols-4 mb-16">
      <div class="card stat"><div class="label">Registers missed</div><div class="value ${missed ? "t-bad" : "t-good"}">${missed}</div><div class="sub">not taken within ${this.lockMinutes()} minutes this term</div></div>
      <div class="card stat accent"><div class="label">Term attendance</div><div class="value">${overall.pct}%</div><div class="sub">${overall.days} school days · ${allIds.length} pupils</div></div>
      <div class="card stat"><div class="label">Below 90%</div><div class="value ${low.length ? "t-bad" : "t-good"}">${low.length}</div><div class="sub">pupils needing follow-up</div></div>
      <div class="card stat"><div class="label">Frequent lates</div><div class="value">${lates.length}</div><div class="sub">2+ late arrivals this term</div></div>
    </div>
    <div class="grid cols-2">
      <div class="card"><div class="card-head"><h3>Attendance by class (term to date)</h3>${this.can("attendance.export") ? `<button class="btn ghost xs" data-action="export-summary">${icon("download")} CSV</button>` : ""}</div>
        <div class="card-body"><div class="barchart">${byClass.map(({ c, s }) => `<div class="row"><span class="bold small">${esc(c.name)}</span><div class="bar ${s.pct >= 95 ? "green" : s.pct >= 90 ? "navy" : ""}"><span style="width:${s.pct}%"></span></div><span class="right bold">${s.pct}%</span></div>`).join("")}</div></div></div>
      <div class="card"><div class="card-head"><h3>Daily attendance — last 10 days</h3></div>
        <div class="card-body"><div class="cols">${trend.map(t => `<div class="col"><span class="val">${t.t ? t.pct + "%" : "–"}</span><span class="fill" style="height:${t.t ? Math.max(2, (t.pct - 60) / 40 * 100) : 2}%;background:${t.pct >= 95 ? "var(--green)" : t.pct >= 90 ? "var(--navy)" : "var(--gold)"}"></span><span class="lbl">${Fmt.date(t.d, "short")}</span></div>`).join("")}</div><div class="tiny muted mt-8">Bars scaled from 60% to 100%.</div></div></div>
      <div class="card"><div class="card-head"><h3>Pupils below 90%</h3></div><div class="card-body tight table-wrap"><table><thead><tr><th>Pupil</th><th>Class</th><th class="right">Present</th><th class="right">%</th></tr></thead><tbody>${low.map(({ p, s }) => `<tr class="clickable" data-action="open-pupil" data-id="${p.id}"><td class="bold">${esc(p.first)} ${esc(p.last)}</td><td class="small">${esc(Store.cls(p.classId).grade)}</td><td class="right">${s.present}/${s.total}</td><td class="right"><span class="pill ${s.pct < 80 ? "red" : "amber"}">${s.pct}%</span></td></tr>`).join("") || `<tr><td colspan="4" class="empty">None.</td></tr>`}</tbody></table></div></div>
      <div class="card"><div class="card-head"><h3>Frequent late arrivals</h3></div><div class="card-body tight table-wrap"><table><thead><tr><th>Pupil</th><th>Class</th><th class="right">Lates</th></tr></thead><tbody>${lates.map(({ p, n }) => `<tr class="clickable" data-action="open-pupil" data-id="${p.id}"><td class="bold">${esc(p.first)} ${esc(p.last)}</td><td class="small">${esc(Store.cls(p.classId).grade)}</td><td class="right"><span class="pill amber">${n}</span></td></tr>`).join("") || `<tr><td colspan="3" class="empty">None.</td></tr>`}</tbody></table></div></div>
    </div>`;
  },
  exportSummary() {
    const rows = [["Class", "Pupils", "Present", "Possible", "Attendance %"]];
    this.myClasses().forEach(c => { const ids = Store.pupilsIn(c.id).map(p => p.id); const s = this.termStats(ids); rows.push([c.name, ids.length, s.present, s.total, s.pct]); });
    this.downloadCSV(`attendance_summary_${Store.today()}.csv`, rows);
  },

  /* ======================================================================
     PERMISSIONS (Head Teacher & HR)
     ====================================================================== */
  vPermissions() {
    const me = this.me(); const ui = this.ui.perms;
    const people = Store.db.staff.filter(s => s.active && s.id !== me.id).sort((a, b) => ROLES[a.role].tier - ROLES[b.role].tier || a.last.localeCompare(b.last));
    if (!people.length) {
      return `<div class="notice gold mb-16">${icon("shield")} <strong>Permissions portal.</strong> Grant or revoke what a colleague may see and do. Every change is recorded in the audit log.</div>
        <div class="card"><div class="empty">
          <p>There is nobody else to administer yet.</p>
          <p class="small muted mt-8">Add your colleagues on the <a href="#/staff">Staff</a> page, or approve a request for an account, and their access will be set from here.</p>
        </div></div>`;
    }
    if (!ui.target || !people.some(p => p.id === ui.target)) ui.target = people[0]?.id;
    const t = Store.staff(ui.target);
    const editable = canAdminister(me, t);
    const eff = effectivePerms(t); const base = roleDefaultPerms(t.role);
    const overrides = (t.grants || []).length + (t.revokes || []).length;
    const tierRows = Object.entries(ROLES).map(([k, r]) => `<div class="role-tier"><span class="n">${r.tier}</span><span class="grow"><span class="bold small">${r.label}</span><br><span class="tiny muted">${r.scope === "all" ? "Whole-school scope" : "Own class only"} · ${roleDefaultPerms(k).size} permissions</span></span></div>`).join("");
    const audit = Store.db.audit.filter(a => /Granted|Revoked|Reset|role|scope|class access/i.test(a.action)).slice(0, 8);
    return `
    <div class="notice gold mb-16">${icon("shield")} <strong>Permissions portal.</strong> The Director, Board Secretary, Head Teacher and HR can change what colleagues may see and do. The governance tier can be edited only by the governance tier, and role-locked permissions follow the role and cannot be granted sideways. Every change is recorded in the audit log; overrides are marked with a gold ring.</div>
    <div class="grid side-left">
      <div class="stack" style="gap:18px">
        <div class="card"><div class="card-head"><h3>Staff</h3></div><div class="card-body tight">
          ${people.map(s => `<div class="channel-list" style="padding:4px 8px;border:0"><div class="item ${ui.target === s.id ? "active" : ""}" data-action="perm-target" data-id="${s.id}"><span class="avatar sm ${ROLES[s.role].governance ? "gold" : ROLES[s.role].tier <= 5 ? "navy" : ""}">${Fmt.initials(s)}</span><span><span class="small">${esc(s.first)} ${esc(s.last)}</span><br><span class="tiny muted">${ROLES[s.role].short}</span></span>${(s.grants?.length || s.revokes?.length) ? `<span class="pill gold" style="margin-left:auto">${(s.grants?.length || 0) + (s.revokes?.length || 0)}</span>` : ""}</div></div>`).join("")}
        </div></div>
        <div class="card"><div class="card-head"><h3>Role tiers</h3></div><div class="card-body tight">${tierRows}</div></div>
      </div>
      <div class="stack" style="gap:18px">
        <div class="card">
          <div class="card-head"><span class="avatar navy">${Fmt.initials(t)}</span><div class="grow"><h3>${esc(t.title)} ${esc(t.first)} ${esc(t.last)}</h3><div class="tiny muted">${ROLES[t.role].label} · tier ${ROLES[t.role].tier} · ${eff.size} of ${ALL_PERMISSIONS.length} permissions${overrides ? ` · ${overrides} override${overrides === 1 ? "" : "s"}` : ""}</div></div>
            ${editable ? `<button class="btn ghost sm" data-action="perm-reset" data-id="${t.id}" ${overrides ? "" : "disabled"}>Reset to role defaults</button>` : `<span class="pill grey">${icon("lock")} Read-only</span>`}</div>
          <div class="card-body">
            ${!editable ? `<div class="notice info small mb-16">${ROLES[t.role].governance ? "The Director and Board Secretary can only be edited by the governance tier." : t.role === "head" ? "Only the governance tier or the Head Teacher can change the Head Teacher's access." : "You cannot edit this person."}</div>` : ""}
            <div class="form-row mb-16">
              <div><label class="field">Role</label><select class="input" data-change="perm-role" data-id="${t.id}" ${editable && (isGovernance(me) || (t.role !== "head" && !ROLES[t.role].governance)) ? "" : "disabled"}>${Object.entries(ROLES).filter(([k]) => isGovernance(me) || (k !== "head" && !ROLES[k].governance)).map(([k, r]) => `<option value="${k}" ${t.role === k ? "selected" : ""}>${r.label}</option>`).join("")}</select><div class="help">Changing the role clears overrides.</div></div>
              <div><label class="field">Class scope</label>
                ${ROLES[t.role].scope === "all" ? `<div class="small" style="padding-top:8px">Whole school (by role)</div>` : `<div class="flex small" style="padding-top:6px"><button class="switch ${(t.grants || []).includes("scope.all") ? "on override" : ""}" data-action="perm-toggle" data-id="${t.id}" data-perm="scope.all" ${editable ? "" : "disabled"}></button> Access to all classes</div>
                <div class="flex wrap mt-8" style="gap:6px">${Store.db.classes.filter(c => c.teacherId !== t.id && c.assistantId !== t.id).map(c => `<label class="pill ${(t.extraClasses || []).includes(c.id) ? "gold" : "grey"}" style="cursor:pointer"><input type="checkbox" data-change="perm-extra" data-id="${t.id}" data-class="${c.id}" ${(t.extraClasses || []).includes(c.id) ? "checked" : ""} ${editable ? "" : "disabled"} style="margin:0"> ${esc(c.grade)}</label>`).join("")}</div>
                <div class="help">Own class: ${Store.db.classes.filter(c => c.teacherId === t.id || c.assistantId === t.id).map(c => c.name).join(", ") || "none allocated"}</div>`}
              </div>
            </div>
            ${PERMISSION_GROUPS.map(g => `<div class="perm-group"><div class="ph">${esc(g.label)}<span class="tiny muted" style="margin-left:auto">${g.perms.filter(p => eff.has(p.key)).length}/${g.perms.length}</span></div>
              ${g.perms.map(p => { const on = eff.has(p.key); const isOverride = on !== base.has(p.key); const locked = p.locked; return `<div class="perm-row"><div><span class="bold small">${esc(p.label)}</span>${p.sensitive ? ` <span class="pill red tiny">sensitive</span>` : ""}${locked ? ` <span class="pill grey tiny">${icon("lock")} role-locked</span>` : ""}${isOverride ? ` <span class="pill gold tiny">${on ? "granted" : "revoked"}</span>` : ""}<div class="desc">${esc(p.desc)}</div></div><button class="switch ${on ? "on" : ""} ${isOverride ? "override" : ""}" data-action="perm-toggle" data-id="${t.id}" data-perm="${p.key}" ${editable && !locked ? "" : "disabled"} title="${on ? "Revoke" : "Grant"}"></button></div>`; }).join("")}
            </div>`).join("")}
          </div>
        </div>
        <div class="card"><div class="card-head"><h3>Audit log</h3><span class="tiny muted">Access changes</span></div><div class="card-body"><ul class="timeline">${audit.map(a => `<li><span class="t">${Fmt.dateTime(a.at)}</span><span>${esc(a.action)}<br><span class="tiny muted">by ${a.by ? Store.staffName(a.by) : "system"}</span></span></li>`).join("") || `<li><span class="t"></span><span class="muted">No changes recorded yet.</span></li>`}</ul></div></div>
      </div>
    </div>`;
  },
  permToggle(targetId, perm) {
    const me = this.me(); const t = Store.staff(targetId);
    if (!canAdminister(me, t)) return this.toast("You cannot change this person's access.", "err");
    if (PERMISSION_INFO[perm]?.locked) return this.toast("That permission is fixed by role.", "err");
    t.grants = t.grants || []; t.revokes = t.revokes || [];
    const base = perm === "scope.all" ? false : roleDefaultPerms(t.role).has(perm);
    const currently = perm === "scope.all" ? t.grants.includes("scope.all") : effectivePerms(t).has(perm);
    const label = perm === "scope.all" ? "Access to all classes" : PERMISSION_INFO[perm].label;
    // remove any existing override, then add the opposite of base if needed
    t.grants = t.grants.filter(p => p !== perm); t.revokes = t.revokes.filter(p => p !== perm);
    const want = !currently;
    if (want && !base) t.grants.push(perm);
    if (!want && base) t.revokes.push(perm);
    Store.audit(`${want ? "Granted" : "Revoked"} "${label}" ${want ? "to" : "from"} ${t.title} ${t.first} ${t.last}`);
    Store.save(); this.toast(`${want ? "Granted" : "Revoked"}: ${label}`); this.render();
  },
  permReset(targetId) {
    const t = Store.staff(targetId); if (!canAdminister(this.me(), t)) return;
    t.grants = []; t.revokes = []; t.extraClasses = [];
    Store.audit(`Reset ${t.title} ${t.first} ${t.last} to ${ROLES[t.role].label} defaults`); Store.save(); this.toast("Reset to role defaults."); this.render();
  },
  permRole(targetId, role) {
    const me = this.me(); const t = Store.staff(targetId); if (!canAdminister(me, t)) return;
    if (role === "head" && me.role !== "head") return this.toast("Only the Head Teacher can appoint a Head Teacher.", "err");
    t.role = role; t.grants = []; t.revokes = []; t.extraClasses = [];
    Store.audit(`Changed role of ${t.title} ${t.first} ${t.last} to ${ROLES[role].label}`); Store.save(); this.toast(`Role set to ${ROLES[role].label}.`); this.render();
  },
  permExtra(targetId, classId, on) {
    const t = Store.staff(targetId); if (!canAdminister(this.me(), t)) return;
    t.extraClasses = (t.extraClasses || []).filter(c => c !== classId); if (on) t.extraClasses.push(classId);
    Store.audit(`${on ? "Granted" : "Removed"} class access to ${Store.cls(classId).name} for ${t.title} ${t.first} ${t.last}`); Store.save(); this.render();
  },

  /* ======================================================================
     MY ACCESS
     ====================================================================== */
  vAccess() {
    const me = this.me(); const eff = effectivePerms(me); const base = roleDefaultPerms(me.role);
    const classes = this.myClasses();
    const pw = this.ui.setPassword;
    return `<div class="grid side">
      <div class="card"><div class="card-head"><span class="avatar lg navy">${Fmt.initials(me)}</span><div><h2>${esc(me.title)} ${esc(me.first)} ${esc(me.last)}</h2><div class="muted">${ROLES[me.role].label} · tier ${ROLES[me.role].tier} of ${Object.keys(ROLES).length}</div></div></div>
        <div class="card-body">
          ${PERMISSION_GROUPS.map(g => `<div class="perm-group"><div class="ph">${esc(g.label)}</div>${g.perms.map(p => { const on = eff.has(p.key); const ov = on !== base.has(p.key); return `<div class="perm-row"><div><span class="small ${on ? "bold" : "muted"}">${esc(p.label)}</span>${ov ? ` <span class="pill gold tiny">${on ? "granted" : "revoked"}</span>` : ""}</div><span class="pill ${on ? "green" : "grey"}">${on ? "Yes" : "No"}</span></div>`; }).join("")}</div>`).join("")}
        </div></div>
      <div class="stack" style="gap:18px">
        <div class="card"><div class="card-head"><h3>Class scope</h3></div><div class="card-body small">${classes.length === Store.db.classes.length ? "You can see all classes in the school." : classes.length ? `You can see: ${classes.map(c => `<strong>${esc(c.name)}</strong>`).join(", ")}.` : "No class allocated."}</div></div>
        <div class="card"><div class="card-head"><h3>Need more access?</h3></div><div class="card-body small muted">Ask the Head Teacher or HR. They can grant individual permissions from the Permissions portal without changing your role.</div></div>
        <div class="card"><div class="card-head"><h3>Contact</h3></div><div class="card-body"><dl class="kv"><dt>Email</dt><dd>${esc(me.email)}</dd><dt>Phone</dt><dd>${esc(me.phone)}</dd><dt>Started</dt><dd>${me.started ? Fmt.date(me.started) : "—"}</dd></dl></div></div>
        ${this.installAlways()}
        <div class="card"><div class="card-head"><h3>Your password</h3></div><div class="card-body">
          ${pw.done ? `<div class="notice ok">${icon("check")} Password changed. It is not stored anywhere in readable form — not even the Head Teacher can see it.</div>
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
    </div>`;
  },

  /* ======================================================================
     SETTINGS
     ====================================================================== */
  /* ----------------------------------------------------------------------
     The two door codes
     ----------------------------------------------------------------------
     What they are is written on the card, because a school that thinks this
     is a password will use it like one. It keeps the sign-in forms off the
     open web; it is not a credential, and the card says so.
     ---------------------------------------------------------------------- */
  gateStatusNow() {
    if (!Store.shared) return (typeof DemoGate !== "undefined") ? DemoGate.status() : { staff: {}, family: {} };
    return Store.db.gateStatus || { staff: {}, family: {} };
  },

  /* ----------------------------------------------------------------------
     Saying so, on the page people actually look at
     ----------------------------------------------------------------------
     A door code that nobody has set is a security feature that does not
     exist, and the only place that said so was a card on the Settings page —
     which is exactly the page somebody who does not know about door codes
     never opens. It is said here instead, to the people who can act on it,
     and it goes away the moment both doors are shut.
     ---------------------------------------------------------------------- */
  doorNudge() {
    if (!this.can("settings.manage")) return "";
    const st = this.gateStatusNow();
    const open = ["staff", "family"].filter(a => !(st[a] && st[a].required));
    if (!open.length) return "";
    const name = { staff: "staff", family: "family" };
    return `<div class="notice warn mb-16">${icon("alert")}
      <div><strong>${open.length === 2 ? "Neither portal page has a door code." : `The ${name[open[0]]} portal page has no door code.`}</strong>
      <div class="small mt-8">Anyone who finds the address reaches a sign-in box asking for a school email. A code does not replace anybody's password — it keeps that box off the open web. Set one for each side and give it out the way a building's door code is given out.</div>
      <button class="btn sm mt-16" data-action="go" data-view="settings">Set the door codes</button></div>
    </div>`;
  },

  gateCard() {
    const st = this.gateStatusNow();
    const doors = [
      ["staff", "Staff portal", "Given to every teacher and every member of office staff."],
      ["family", "Family portal", "Given to every family, with their sign-in."],
    ];
    const none = doors.every(([k]) => !(st[k] && st[k].required));
    return `<div class="card"><div class="card-head"><div><h3>Door codes</h3>
        <div class="tiny muted">One for each portal page, asked for before anyone reaches a sign-in form</div></div>
        <span class="pill ${none ? "amber" : "green"}">${none ? "Both doors open" : `${doors.filter(([k]) => st[k] && st[k].required).length} of 2 set`}</span></div>
      <div class="card-body">
        <p class="small muted">Everybody on one side of the school gets the same code, the way a building's door code is given out. It proves nothing about who is at the keyboard — their own password does that — but it keeps a box asking for a teacher's email address off a page a stranger can find.</p>
        ${none ? `<div class="notice warn small mt-16">${icon("alert")} No code is set, so both portal pages are open to anyone who finds the address. Set one for each.</div>` : ""}
        ${doors.map(([key, label, note]) => `
          <form class="gate-set mt-16" data-form="gate-code" data-audience="${key}">
            <div class="flex between" style="align-items:baseline">
              <div><span class="bold small">${label}</span>
                <div class="tiny muted">${note}</div></div>
              <span class="pill ${st[key] && st[key].required ? "green" : "grey"}">${st[key] && st[key].required ? "Code set" : "Open"}</span>
            </div>
            <div class="flex mt-8" style="gap:8px">
              <input class="input mono grow" id="gate_${key}" name="pin" type="text" inputmode="numeric" pattern="[0-9]*"
                     maxlength="10" placeholder="${st[key] && st[key].required ? "New code — four to ten digits" : "Four to ten digits"}"
                     autocomplete="off" spellcheck="false">
              <button class="btn ghost sm" type="button" data-action="gate-suggest" data-target="gate_${key}">Suggest one</button>
              <button class="btn sm" type="submit">${st[key] && st[key].required ? "Change" : "Set"}</button>
              ${st[key] && st[key].required ? `<button class="btn ghost sm danger" type="button" data-action="gate-clear" data-audience="${key}">Remove</button>` : ""}
            </div>
            ${st[key] && st[key].setAt ? `<div class="tiny muted mt-8">Last changed ${Fmt.dateTime(st[key].setAt)}${st[key].setBy && Store.staff(st[key].setBy) ? ` by ${Store.staffName(st[key].setBy, { short: true })}` : ""}.</div>` : ""}
          </form>`).join("")}
        <div class="help mt-16">A code cannot be read back once set — it is hashed, like a password. If everyone has forgotten it, set a new one and tell people. Change it when somebody leaves.</div>
      </div>
    </div>`;
  },

  async saveGate(audience, pin) {
    try {
      await Store.setGate(audience, pin);
      if (Store.shared) await Store.load();
      this.render();
      if (!pin) return this.toast("Door code removed — that page is open to anyone again.");
      this.showGateCode(audience, pin);
    } catch (e) { this.toast(e.message || "Could not save that code.", "err"); }
  },

  /* ----------------------------------------------------------------------
     Shown once, and then never again
     ----------------------------------------------------------------------
     A code is hashed the moment it is set, so there is no screen anywhere
     that can tell you later what it is. That is the right way round, but it
     means the one moment it can be read is now — and somebody who sets a code
     without writing it down has locked a door and dropped the key. So it is
     put in front of them, with who it is for and what to do with it.
     ---------------------------------------------------------------------- */
  showGateCode(audience, pin) {
    const who = audience === "staff"
      ? { title: "Staff door code", give: "Give this to every teacher and every member of office staff — the same one for all of them.",
          page: "the staff portal page" }
      : { title: "Family door code", give: "Give this to every family, alongside their own sign-in.",
          page: "the family portal page" };
    this.modal({
      title: who.title,
      body: `<p class="small">It is now the code asked for before the sign-in form on ${who.page}.</p>
        <div class="cred mt-16">
          <div><div class="k">The code</div><div class="v big">${esc(pin)}</div></div>
        </div>
        <p class="small mt-16">${esc(who.give)}</p>
        <div class="notice gold mt-16 small">${icon("alert")} <strong>This is the only time it is shown.</strong> It is stored hashed, exactly as a password is, so nobody — including you — can read it back afterwards. Write it down now.</div>
        <p class="tiny muted mt-16">It proves nothing about who is at the keyboard; everybody on that side of the school has the same one, and their own password still decides what they can see. Change it the week somebody leaves.</p>`,
      foot: `<button class="btn ghost" data-action="copy-credential" data-text="${esc(pin)}">Copy code</button><div class="grow"></div><button class="btn" data-action="close-modal">I have written it down</button>`,
    });
  },

  vSettings() {
    const s = Store.db.school;
    return `<div class="grid cols-2">
      <form class="card" data-form="settings-school"><div class="card-head"><h3>School profile</h3></div><div class="card-body">
        <div><label class="field">School name</label><input class="input" name="name" value="${esc(s.name)}"></div>
        <div class="mt-8"><label class="field">Tagline</label><input class="input" name="tagline" value="${esc(s.tagline)}"></div>
        <div class="mt-8"><label class="field">Address</label><input class="input" name="address" value="${esc(s.address)}"></div>
        <div class="form-row mt-8"><div><label class="field">Phone</label><input class="input" name="phone" value="${esc(s.phone)}"></div><div><label class="field">Email</label><input class="input" name="email" value="${esc(s.email)}"></div></div>
        <div class="form-row mt-8"><div><label class="field">Website</label><input class="input" name="web" value="${esc(s.web)}"></div><div><label class="field">Registration no.</label><input class="input" name="regNo" value="${esc(s.regNo)}"></div></div>
      </div><div class="card-foot right"><button class="btn sm" type="submit">Save profile</button></div></form>
      <div class="stack" style="gap:18px">
        <form class="card" data-form="settings-term"><div class="card-head"><h3>Term & registers</h3></div><div class="card-body">
          <div><label class="field">Current term</label><input class="input" name="termName" value="${esc(s.term.name)}"></div>
          <div class="form-row mt-8"><div><label class="field">Term starts</label><input class="input" type="date" name="termStart" value="${s.term.start}"></div><div><label class="field">Term ends</label><input class="input" type="date" name="termEnd" value="${s.term.end}"></div></div>
          <div class="mt-8"><label class="field">Register window (minutes after a period starts)</label><input class="input" type="number" min="5" max="60" name="lockMinutes" value="${esc(s.lockMinutes ?? 15)}"><div class="help">Every register — morning registration at ${PERIODS[0].start} and each lesson — can be taken for this long after the period starts, then it locks. Only holders of "Amend locked registers" can change it afterwards.</div></div>
        </div><div class="card-foot right"><button class="btn sm" type="submit">Save</button></div></form>
        <form class="card" data-form="settings-drive"><div class="card-head"><h3>Google Drive integration</h3></div><div class="card-body">
          <div><label class="field">OAuth Client ID</label><input class="input" name="clientId" placeholder="xxxxxxxx.apps.googleusercontent.com" value="${esc(s.googleClientId)}"></div>
          <div class="mt-8"><label class="field">School Drive folder (link or ID)</label><input class="input" name="folder" placeholder="https://drive.google.com/drive/folders/…" value="${esc(s.driveRootFolder)}"></div>
          <div class="notice info small mt-8">Linking documents by pasting share links works without any setup. To browse Drive from inside the portal, create an OAuth Client ID in Google Cloud Console (Web application), add this portal's address as an authorised JavaScript origin, enable the Drive API, and paste the Client ID here.</div>
        </div><div class="card-foot right"><button class="btn sm" type="submit">Save integration</button></div></form>
        ${this.gateCard()}
        <div class="card"><div class="card-head"><div><h3>Records</h3><div class="tiny muted">Taking a copy, and starting over</div></div></div>
          <div class="card-body">
          <p class="small muted">The backup is everything this school holds — the roll, the registers, the marks, the fee accounts, the messages and the audit log — in one file. It is plain JSON: readable in a text editor, openable by anything, and not dependent on this software still existing. Take one before anybody clears this browser, and take one at the end of each term.</p>
          <div class="flex wrap mt-16">
          <button class="btn sm" data-action="export-backup">${icon("download")} Download a backup</button>
          <button class="btn ghost sm danger" data-action="reset-demo">Clear this browser</button>
          </div>
        </div><div class="card-foot tiny muted">This build keeps the school in this browser alone — nothing is on a server and nothing is backed up for you. Clearing the browser's data, or using a different one, and it is gone. Download a backup regularly, or run the school on the server where a database holds it.</div></div>

      </div>
    </div>`;
  },

  /* ======================================================================
     TIMETABLE
     ====================================================================== */
  weekDates(offset = 0) {
    const t = new Date(Store.today() + "T12:00:00");
    const dow = (t.getDay() + 6) % 7; // Mon = 0
    const mon = new Date(t); mon.setDate(t.getDate() - dow + offset * 7);
    return DAYS.map((d, i) => { const x = new Date(mon); x.setDate(mon.getDate() + i); return iso(x); });
  },
  vTimetable() {
    const ui = this.ui.timetable; const me = this.me(); const today = Store.today();
    const allClasses = Store.db.classes; const classes = this.myClasses().length ? this.myClasses() : allClasses;
    if (!ui.classId || !classes.some(c => c.id === ui.classId)) ui.classId = classes[0].id;
    const teachers = Store.db.staff.filter(x => x.active && Store.teamsOf(x.id).length).sort((a, b) => ROLES[a.role].tier - ROLES[b.role].tier || a.last.localeCompare(b.last));
    if (ui.mode === null) ui.mode = this.isTeachingStaff() ? "mine" : "class";
    if (!ui.staffId || !Store.staff(ui.staffId)) ui.staffId = this.isTeachingStaff() ? me.id : (teachers[0]?.id || me.id);
    const mode = ui.mode === "mine" && teachers.length ? "mine" : "class";
    const who = Store.staff(ui.staffId) || me;
    const cls = Store.cls(ui.classId); const tt = Store.db.timetable[cls.id] || {};
    const dates = this.weekDates(ui.weekOffset);
    const canEdit = this.can("timetable.manage");
    const evOn = (d) => Store.db.events.filter(e => e.date === d);
    const teacher = Store.staff(cls.teacherId), assistant = Store.staff(cls.assistantId);
    const weekLabel = ui.weekOffset === 0 ? "This week" : ui.weekOffset === 1 ? "Week ahead" : ui.weekOffset < 0 ? `${-ui.weekOffset} week${ui.weekOffset === -1 ? "" : "s"} ago` : `In ${ui.weekOffset} weeks`;
    const inTerm = dates[0] <= Store.db.school.term.end && dates[4] >= Store.db.school.term.start;
    const breakWeek = Store.db.events.some(e => /mid-term/i.test(e.title) && dates.includes(e.date));
    const lessonIds = PERIODS.filter(p => !p.kind).map(p => p.id);

    /* one timetable cell in the class view: subject plus the pair who teach it */
    const teamCell = (day, idx, dateIso) => {
      const cell = (tt[day] || [])[idx];
      if (!cell) return `<span class="tt-free">—</span>`;
      const team = cell.t ? Store.team(cell.t) : null;
      const col = SUBJECTS[cell.s] || "grey";
      const t = team ? Store.staff(team.teacherId) : null, a = team ? Store.staff(team.assistantId) : null;
      const who = team ? `${t ? esc(t.last) : "—"} · ${a ? esc(a.last) : "—"}` : "Whole school";
      const isMine = team && (team.teacherId === me.id || team.assistantId === me.id);
      return `<button type="button" class="tt-cell plain ${col}" ${canEdit ? `data-action="tt-edit" data-day="${day}" data-idx="${idx}"` : "disabled"} title="${esc(cell.s)}${team ? ` — ${esc(team.name)} team` : ""}" style="${isMine ? "outline:2px solid var(--navy);outline-offset:-2px" : ""}">
        <span class="tt-sub">${esc(cell.s)}</span><span class="tt-who">${who}</span></button>`;
    };

    /* one cell in "my week": which class this person is with, if any */
    const myTeamIds = new Set(Store.teamsOf(who.id).map(t => t.id));
    const mineAt = (day, idx) => {
      for (const c of allClasses) { const cell = (Store.db.timetable[c.id]?.[day] || [])[idx]; if (cell && cell.t && myTeamIds.has(cell.t)) return { c, cell, team: Store.team(cell.t) }; }
      return null;
    };
    const myRegClasses = allClasses.filter(c => c.teacherId === who.id || c.assistantId === who.id);
    const myLoad = allClasses.length ? DAYS.reduce((n, d) => n + lessonIds.reduce((m, _, i) => m + (mineAt(d, i) ? 1 : 0), 0), 0) : 0;
    const mySubjects = {};
    DAYS.forEach(d => lessonIds.forEach((_, i) => { const s = mineAt(d, i); if (s) mySubjects[s.cell.s] = (mySubjects[s.cell.s] || 0) + 1; }));

    const myWeek = `
      <div class="card">
        <div class="card-head"><div><h3>${who.id === me.id ? "My week" : `${Store.staffName(who.id)} — week`}</h3><div class="tiny muted">${Store.teamsOf(who.id).map(t => esc(t.name) + " team").join(", ") || "No teaching team"} · ${myLoad} teaching period${myLoad === 1 ? "" : "s"} a week</div></div>
        ${teachers.length > 1 && (this.can("staff.view") || ROLES[me.role].scope === "all") ? `<select class="input sm" data-change="tt-staff" style="max-width:220px">${teachers.map(t => `<option value="${t.id}" ${t.id === who.id ? "selected" : ""}>${esc(t.first)} ${esc(t.last)}</option>`).join("")}</select>` : ""}</div>
        <div class="card-body tight table-wrap"><table class="tt">
          <thead><tr><th style="width:120px">Period</th>${DAYS.map((d, i) => `<th class="${dates[i] === today ? "today" : ""}"><div>${DAY_LABELS[d]}</div><div class="tiny" style="font-weight:400;text-transform:none;letter-spacing:0">${Fmt.date(dates[i], "short")}${dates[i] === today ? " · today" : ""}</div>${evOn(dates[i]).map(e => `<div class="tt-ev ${e.colour}">${esc(e.title)}</div>`).join("")}</th>`).join("")}</tr></thead>
          <tbody>
            <tr class="tt-admin"><td><span class="bold small">${PERIODS[0].label}</span><br><span class="tiny muted">${PERIODS[0].start} – ${PERIODS[0].end}</span></td>${DAYS.map((d, i) => `<td class="${dates[i] === today ? "today" : ""}">${myRegClasses.length ? myRegClasses.map(c => `<button type="button" class="tt-cell plain navy" data-action="open-register-day" data-class="${c.id}" data-period="reg" data-date="${dates[i]}"><span class="tt-sub">${esc(c.name)}</span><span class="tt-who">Registration</span></button>`).join("") : `<span class="tt-free">Not a class register</span>`}</td>`).join("")}</tr>
            ${PERIODS.filter(p => p.kind !== "admin").map(p => {
              if (p.kind === "break") return `<tr class="tt-break"><td><span class="bold small">${p.label}</span><br><span class="tiny muted">${p.start} – ${p.end}</span></td><td colspan="5" class="center tiny muted">${p.label === "Lunch" ? "Lunch and supervised play — duty rota" : "Break — playground duty"}</td></tr>`;
              const idx = lessonIds.indexOf(p.id);
              return `<tr><td><span class="bold small">${p.label}</span><br><span class="tiny muted">${p.start} – ${p.end}</span></td>${DAYS.map((d, i) => { const s = mineAt(d, idx); return `<td class="${dates[i] === today ? "today" : ""}">${s ? `<button type="button" class="tt-cell plain ${SUBJECTS[s.cell.s] || "grey"}" data-action="open-register-day" data-class="${s.c.id}" data-period="${p.id}" data-date="${dates[i]}" title="Open this register"><span class="tt-sub">${esc(s.cell.s)}</span><span class="tt-who">${esc(s.c.name)}</span></button>` : `<span class="tt-free">Free / PPA</span>`}</td>`; }).join("")}</tr>`;
            }).join("")}
          </tbody>
        </table></div>
        <div class="card-foot tiny muted">School day ${PERIODS[0].start} – ${PERIODS[PERIODS.length - 1].end}. A class meets the same pair every time it has a given subject. Click a period to open its register — it can be taken for ${this.lockMinutes()} minutes from the start of the lesson.</div>
      </div>`;

    const classView = `
      <div class="card">
        <div class="card-head"><div><h3>${esc(cls.name)}</h3><div class="tiny muted">${esc(cls.room)} · Registration and pastoral care: ${teacher ? Store.staffName(teacher.id) : "—"} with ${assistant ? Store.staffName(assistant.id) : "—"}</div></div>
        <select class="input sm" data-change="tt-class" style="max-width:200px">${allClasses.map(c => `<option value="${c.id}" ${c.id === cls.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div>
        <div class="card-body tight table-wrap"><table class="tt">
          <thead><tr><th style="width:120px">Period</th>${DAYS.map((d, i) => `<th class="${dates[i] === today ? "today" : ""}"><div>${DAY_LABELS[d]}</div><div class="tiny" style="font-weight:400;text-transform:none;letter-spacing:0">${Fmt.date(dates[i], "short")}${dates[i] === today ? " · today" : ""}</div>${evOn(dates[i]).map(e => `<div class="tt-ev ${e.colour}">${esc(e.title)}</div>`).join("")}</th>`).join("")}</tr></thead>
          <tbody>${PERIODS.map(p => {
            if (p.kind === "break") return `<tr class="tt-break"><td><span class="bold small">${p.label}</span><br><span class="tiny muted">${p.start} – ${p.end}</span></td><td colspan="5" class="center tiny muted">${p.label === "Lunch" ? "Lunch and supervised play — both class staff on duty" : "Break — assistant teacher on playground duty"}</td></tr>`;
            if (p.kind === "admin") return `<tr class="tt-admin"><td><span class="bold small">${p.label}</span><br><span class="tiny muted">${p.start} – ${p.end}</span></td>${DAYS.map((d, i) => `<td class="${dates[i] === today ? "today" : ""}"><button type="button" class="tt-cell plain navy" data-action="open-register-day" data-class="${cls.id}" data-period="reg" data-date="${dates[i]}"><span class="tt-sub">Registration</span><span class="tt-who">${teacher ? esc(teacher.last) : "—"} · ${assistant ? esc(assistant.last) : "—"}</span></button></td>`).join("")}</tr>`;
            const idx = lessonIds.indexOf(p.id);
            return `<tr><td><span class="bold small">${p.label}</span><br><span class="tiny muted">${p.start} – ${p.end}</span></td>${DAYS.map((d, i) => `<td class="${dates[i] === today ? "today" : ""}">${teamCell(d, idx, dates[i])}</td>`).join("")}</tr>`;
          }).join("")}</tbody>
        </table></div>
        <div class="card-foot tiny muted">School day ${PERIODS[0].start} – ${PERIODS[PERIODS.length - 1].end}. Each subject is taught by the same pair all year; the pairs rotate between classes, so no team is ever in two rooms at once.${canEdit ? " Click a period to change it." : ""}</div>
      </div>`;

    /* who teaches what in the selected class */
    const bySubject = {};
    DAYS.forEach(d => lessonIds.forEach((_, i) => { const cell = (tt[d] || [])[i]; if (!cell) return; const k = cell.s; bySubject[k] = bySubject[k] || { n: 0, t: cell.t }; bySubject[k].n++; }));

    return `
    <div class="toolbar">
      <div class="flex" style="gap:4px">
        ${teachers.length ? `<button class="btn ${mode === "mine" ? "" : "ghost"} sm" data-action="tt-mode" data-id="mine">${icon("user")} My week</button>` : ""}
        <button class="btn ${mode === "class" ? "" : "ghost"} sm" data-action="tt-mode" data-id="class">${icon("grid")} By class</button>
      </div>
      <div class="flex" style="gap:4px">
        <button class="btn ghost sm" data-action="tt-week" data-delta="-1">${icon("left")}</button>
        <span class="pill" style="font-size:13px">${weekLabel} · ${Fmt.date(dates[0], "short")} – ${Fmt.date(dates[4])}</span>
        <button class="btn ghost sm" data-action="tt-week" data-delta="1">${icon("right")}</button>
        ${ui.weekOffset !== 1 ? `<button class="btn ghost sm" data-action="tt-week-set" data-offset="1">Week ahead</button>` : ""}
        ${ui.weekOffset !== 0 ? `<button class="btn ghost sm" data-action="tt-week-set" data-offset="0">This week</button>` : ""}
      </div>
      <div class="grow"></div>
      <button class="btn ghost sm" onclick="window.print()">${icon("print")} Print</button>
    </div>
    ${!inTerm ? `<div class="notice info mb-16">This week falls outside ${esc(Store.db.school.term.name)} (${Fmt.date(Store.db.school.term.start)} – ${Fmt.date(Store.db.school.term.end)}).</div>` : breakWeek ? `<div class="notice gold mb-16">Mid-term break falls this week — no lessons on break days.</div>` : ""}
    <div class="grid side">
      ${mode === "mine" ? myWeek : classView}
      <div class="stack" style="gap:18px">
        <div class="card"><div class="card-head"><h3>Teaching teams</h3><span class="tiny muted">main · assistant</span></div><div class="card-body" style="padding-top:4px">
          ${Store.db.teams.map(t => { const tt2 = Store.staff(t.teacherId), a2 = Store.staff(t.assistantId); const n = DAYS.reduce((m, d) => m + allClasses.reduce((k, c) => k + (Store.db.timetable[c.id]?.[d] || []).filter(x => x && x.t === t.id).length, 0), 0); const isMine = t.teacherId === who.id || t.assistantId === who.id;
            return `<div class="flex" style="padding:10px 0;border-bottom:1px dashed var(--line)"><div class="grow"><div class="bold small">${esc(t.name)}${isMine ? ` <span class="pill gold tiny">${who.id === me.id ? "You" : "Theirs"}</span>` : ""}</div><div class="tiny muted">${n} period${n === 1 ? "" : "s"} a week across ${allClasses.length} classes</div></div><div class="flex" style="gap:6px"><span class="avatar sm navy" title="Main teacher: ${tt2 ? esc(tt2.first + " " + tt2.last) : "—"}">${tt2 ? Fmt.initials(tt2) : "?"}</span><span class="avatar sm" title="Assistant: ${a2 ? esc(a2.first + " " + a2.last) : "—"}">${a2 ? Fmt.initials(a2) : "?"}</span></div></div>`; }).join("")}
        </div></div>
        ${mode === "mine" ? `<div class="card"><div class="card-head"><h3>Subjects taught</h3><span class="tiny muted">per week</span></div><div class="card-body flex wrap" style="gap:6px">${Object.entries(mySubjects).sort((a, b) => b[1] - a[1]).map(([s, n]) => `<span class="pill ${SUBJECTS[s] || "grey"}">${esc(s)} <span class="tiny" style="opacity:.7">×${n}</span></span>`).join("") || `<span class="empty small">No lessons timetabled.</span>`}</div>
          ${myRegClasses.length ? `<div class="card-foot tiny muted">Morning registration for ${myRegClasses.map(c => esc(c.name)).join(", ")}.</div>` : ""}</div>`
        : `<div class="card"><div class="card-head"><h3>Who teaches ${esc(cls.grade)}</h3></div><div class="card-body tight table-wrap"><table>
            <thead><tr><th>Subject</th><th>Pair</th><th class="right">/week</th></tr></thead>
            <tbody>${Object.entries(bySubject).sort((a, b) => b[1].n - a[1].n).map(([s, v]) => { const t = v.t ? Store.team(v.t) : null; return `<tr><td><span class="tt-sub ${SUBJECTS[s] || "grey"}">${esc(s)}</span></td><td class="tiny muted">${t ? `${Store.staffName(t.teacherId, { short: true })}<br>${Store.staffName(t.assistantId, { short: true })}` : "Whole school"}</td><td class="right bold">${v.n}</td></tr>`; }).join("")}</tbody>
          </table></div><div class="card-foot tiny muted">Every ${esc(cls.name)} lesson in a subject is taught by the pair shown, all year.</div></div>`}
      </div>
    </div>`;
  },
  ttEdit(day, idx) {
    const cls = Store.cls(this.ui.timetable.classId); const tt = Store.db.timetable[cls.id]; const cur = tt[day][idx] || { s: "", t: null };
    const period = PERIODS.filter(p => !p.kind)[idx];
    const body = `<form data-form="tt-save" data-day="${day}" data-idx="${idx}">
      <p class="small muted">${esc(cls.name)} · ${DAY_LABELS[day]} · ${period.label} (${period.start} – ${period.end})</p>
      <div class="grid cols-2">
        <div><label class="field">Subject</label><select class="input" name="subject">${Object.keys(SUBJECTS).map(sj => `<option ${sj === cur.s ? "selected" : ""}>${esc(sj)}</option>`).join("")}</select></div>
        <div><label class="field">Teaching pair</label><select class="input" name="team">${Store.db.teams.map(t => `<option value="${t.id}" ${t.id === cur.t ? "selected" : ""}>${esc(t.name)} — ${Store.staffName(t.teacherId, { short: true })} &amp; ${Store.staffName(t.assistantId, { short: true })}</option>`).join("")}<option value="" ${!cur.t ? "selected" : ""}>Whole school (no pair)</option></select></div>
      </div>
      <div class="help">A pair cannot be in two classes at once, and a subject in this class always keeps the same pair — both are checked on save.</div>
      <div class="modal-foot" style="padding:16px 0 0;border:0"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button class="btn" type="submit">Save period</button></div></form>`;
    this.modal({ title: "Change period", body });
  },

  /* ======================================================================
     RECRUITMENT
     ====================================================================== */
  candidateTotal(c) { return SCORE_CRITERIA.reduce((n, k) => n + (Number(c.scores?.[k.key]) || 0), 0); },
  candidateScored(c) { return SCORE_CRITERIA.filter(k => c.scores?.[k.key]).length; },
  vRecruitment() {
    const ui = this.ui.recruitment; const manage = this.can("recruitment.manage");
    const vacs = Store.db.vacancies.slice().sort((a, b) => b.opened.localeCompare(a.opened));
    if (!ui.vacancyId || !vacs.some(v => v.id === ui.vacancyId)) ui.vacancyId = vacs[0]?.id;
    const v = vacs.find(x => x.id === ui.vacancyId);
    const cands = v ? Store.db.candidates.filter(c => c.vacancyId === v.id) : [];
    const stageCount = (id) => cands.filter(c => c.stage === id).length;
    const pipeline = STAGES.filter(s => s.id !== "unsuccessful");
    const guide = [
      ["Vacancy approved", "Head & Board"], ["Advertise (2 weeks)", "HR"], ["Log applications", "HR"], ["Shortlist against criteria", "Head & HR"], ["Invite with 5 days' notice", "HR"],
      ["45-min panel interview", "Panel of 3"], ["Demo lesson (20 min)", "Panel + class teacher"], ["Score and decide same day", "Panel"], ["References, police clearance, qualification check", "HR"], ["Offer and contract", "Head & HR"], ["Induction and portal account", "HR"]];
    const pack = Store.db.documents.find(d => d.id === "d19");
    const card = (c) => { const total = this.candidateTotal(c); const scored = this.candidateScored(c); return `<div class="cand" data-action="cand-open" data-id="${c.id}">
      <div class="bold small">${esc(c.name)}</div><div class="tiny muted">${esc(c.qualification)}</div>
      <div class="flex wrap mt-8" style="gap:4px">${scored ? `<span class="pill ${total >= 28 ? "green" : total >= 21 ? "gold" : "amber"} tiny">${total}/35${scored < SCORE_CRITERIA.length ? ` · ${scored}/${SCORE_CRITERIA.length} scored` : ""}</span>` : ""}${c.interviewAt ? `<span class="pill grey tiny">${Fmt.dateTime(c.interviewAt)}</span>` : ""}${c.policeClearance === "received" ? `<span class="pill blue tiny">Police ✓</span>` : ""}${c.references === "received" ? `<span class="pill blue tiny">Refs ✓</span>` : ""}</div></div>`; };
    return `
    <div class="notice gold small mb-16">${icon("lock")} <strong>Confidential.</strong> Candidate details are visible only to the Head Teacher, Deputy Head and HR. Follow the <a href="${pack ? esc(pack.url) : "#/documents"}">Teacher Recruitment & Interview Pack</a> for the questions, scoring sheet and demo-lesson form.</div>
    <div class="toolbar">
      <div class="tabs" style="margin:0;border:0">${vacs.map(x => `<button class="${x.id === ui.vacancyId ? "active" : ""}" data-action="vac-select" data-id="${x.id}">${esc(x.title.split(" — ")[0])} <span class="pill ${x.status === "open" ? "green" : x.status === "interviewing" ? "gold" : "grey"} tiny">${x.status}</span></button>`).join("")}</div>
      <div class="grow"></div>
      ${manage ? `<button class="btn ghost sm" data-action="vac-new">${icon("plus")} Vacancy</button><button class="btn sm" data-action="cand-new" ${v ? "" : "disabled"}>${icon("plus")} Add candidate</button>` : ""}
    </div>
    ${v ? `
    <div class="grid side">
      <div class="stack" style="gap:18px">
        <div class="card">
          <div class="card-head"><div class="grow"><h3>${esc(v.title)}</h3><div class="tiny muted">${esc(Store.cls(v.classId)?.name || "")} · Opened ${Fmt.date(v.opened)} · Closes ${Fmt.date(v.closing)}${v.interviewDate ? ` · Interviews ${Fmt.date(v.interviewDate, "long")}` : ""}</div></div>
            ${manage ? `<button class="btn ghost xs" data-action="vac-edit" data-id="${v.id}">${icon("edit")} Edit</button>` : ""}</div>
          <div class="card-body small"><div class="flex wrap" style="gap:6px"><span class="muted">Panel:</span>${v.panel.map(id => `<span class="pill">${Store.staffName(id)}</span>`).join("")}</div>${v.notes ? `<p class="mt-8 muted">${esc(v.notes)}</p>` : ""}</div>
        </div>
        <div class="card"><div class="card-head"><h3>Pipeline</h3><span class="tiny muted">${cands.length} candidate${cands.length === 1 ? "" : "s"} · ${stageCount("unsuccessful")} unsuccessful</span></div>
          <div class="card-body tight"><div class="board">${pipeline.map(st => `<div class="col"><div class="col-head"><span>${esc(st.label)}</span><span class="pill grey tiny">${stageCount(st.id)}</span></div><div class="tiny muted mb-8">${esc(st.desc)}</div>${cands.filter(c => c.stage === st.id).map(card).join("") || `<div class="tiny faint center" style="padding:10px 0">—</div>`}</div>`).join("")}</div></div>
          ${stageCount("unsuccessful") ? `<div class="card-foot small"><span class="muted">Unsuccessful:</span> ${cands.filter(c => c.stage === "unsuccessful").map(c => `<a href="#" data-action="cand-open" data-id="${c.id}">${esc(c.name)}</a>`).join(", ")}</div>` : ""}
        </div>
      </div>
      <div class="stack" style="gap:18px">
        <div class="card"><div class="card-head"><h3>Interview process</h3></div><div class="card-body tight">${guide.map(([step, who], i) => `<div class="role-tier"><span class="n">${i + 1}</span><span class="grow small">${esc(step)}</span><span class="tiny muted nowrap">${esc(who)}</span></div>`).join("")}</div>
          <div class="card-foot tiny muted">No candidate starts work before both references and the police clearance are on file.</div></div>
        <div class="card"><div class="card-head"><h3>Scoring</h3></div><div class="card-body small">${SCORE_CRITERIA.map(k => `<div class="flex between" style="padding:3px 0;border-bottom:1px dashed var(--line)"><span>${esc(k.label)}</span><span class="tiny muted">1–5</span></div>`).join("")}<div class="tiny muted mt-8">28–35 appoint · 21–27 reserve · below 21 do not appoint</div></div></div>
      </div>
    </div>` : `<div class="card"><div class="empty">No vacancies yet.</div></div>`}`;
  },
  candidateModal(id) {
    const c = Store.db.candidates.find(x => x.id === id); if (!c) return;
    const manage = this.can("recruitment.manage"); const v = Store.db.vacancies.find(x => x.id === c.vacancyId);
    const total = this.candidateTotal(c);
    const dis = manage ? "" : "disabled";
    const body = `<form data-form="cand-save" data-id="${c.id}">
      <div class="flex mb-16"><span class="avatar lg navy">${esc(c.name.split(" ").map(w => w[0]).join("").slice(0, 2))}</span><div class="grow"><h2>${esc(c.name)}</h2><div class="muted small">${esc(v?.title || "")} · applied ${Fmt.date(c.appliedOn)}</div></div><span class="pill ${total >= 28 ? "green" : total >= 21 ? "gold" : "grey"}" style="font-size:14px">${total}/35</span></div>
      <div class="form-row three">
        <div><label class="field">Stage</label><select class="input" name="stage" ${dis}>${STAGES.map(s => `<option value="${s.id}" ${c.stage === s.id ? "selected" : ""}>${esc(s.label)}</option>`).join("")}</select></div>
        <div><label class="field">Interview date & time</label><input class="input" type="datetime-local" name="interviewAt" value="${esc(c.interviewAt)}" ${dis}></div>
        <div><label class="field">Phone</label><input class="input" name="phone" value="${esc(c.phone)}" ${dis}></div>
      </div>
      <div class="form-row mt-8">
        <div><label class="field">Qualification</label><input class="input" name="qualification" value="${esc(c.qualification)}" ${dis}></div>
        <div><label class="field">Experience</label><input class="input" name="experience" value="${esc(c.experience)}" ${dis}></div>
      </div>
      <div class="form-row three mt-8">
        <div><label class="field">Email</label><input class="input" name="email" value="${esc(c.email)}" ${dis}></div>
        <div><label class="field">References</label><select class="input" name="references" ${dis}>${["pending", "one received", "received"].map(x => `<option ${c.references === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
        <div><label class="field">Police clearance</label><select class="input" name="policeClearance" ${dis}>${["pending", "requested", "received"].map(x => `<option ${c.policeClearance === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
      </div>
      <div class="eyebrow mt-16 mb-8">Interview scores (1–5)</div>
      <div class="table-wrap"><table><tbody>${SCORE_CRITERIA.map(k => `<tr><td class="small">${esc(k.label)}</td><td class="right" style="width:220px"><div class="status-group">${[1, 2, 3, 4, 5].map(n => `<label style="margin:0"><input type="radio" name="score_${k.key}" value="${n}" ${Number(c.scores?.[k.key]) === n ? "checked" : ""} ${dis} style="display:none"><span class="score ${Number(c.scores?.[k.key]) === n ? "on" : ""}">${n}</span></label>`).join("")}</div></td></tr>`).join("")}</tbody></table></div>
      <div class="mt-8"><label class="field">Panel notes</label><textarea class="input" name="notes" ${dis}>${esc(c.notes)}</textarea></div>
      <div class="modal-foot" style="padding:16px 0 0;border:0">${manage ? `<button type="button" class="btn ghost" data-action="cand-delete" data-id="${c.id}" class="t-bad">Delete</button>` : ""}<div class="grow"></div><button type="button" class="btn ghost" data-action="close-modal">Close</button>${manage ? `<button class="btn" type="submit">Save</button>` : ""}</div>
    </form>`;
    this.modal({ title: "Candidate", body, wide: true });
  },
  candidateForm() {
    const v = Store.db.vacancies.find(x => x.id === this.ui.recruitment.vacancyId); if (!v) return;
    const body = `<form data-form="cand-new">
      <p class="small muted">${esc(v.title)}</p>
      <div class="form-row"><div><label class="field">Full name</label><input class="input" name="name" required></div><div><label class="field">Phone</label><input class="input" name="phone"></div></div>
      <div class="form-row mt-8"><div><label class="field">Email</label><input class="input" name="email" type="email"></div><div><label class="field">Applied on</label><input class="input" type="date" name="appliedOn" value="${Store.today()}"></div></div>
      <div class="form-row mt-8"><div><label class="field">Qualification</label><input class="input" name="qualification"></div><div><label class="field">Experience</label><input class="input" name="experience"></div></div>
      <div class="help mt-8">Save the CV, certificates and cover letter to Drive under HR & Staff → Recruitment.</div>
      <div class="modal-foot" style="padding:16px 0 0;border:0"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button class="btn" type="submit">Add candidate</button></div></form>`;
    this.modal({ title: "Add candidate", body });
  },
  vacancyForm(id) {
    const v = id ? Store.db.vacancies.find(x => x.id === id) : { title: "", type: "assistant", classId: Store.db.classes[0].id, opened: Store.today(), closing: "", status: "open", panel: [this.me().id], interviewDate: "", notes: "" };
    const leaders = Store.db.staff.filter(s => s.active && ROLES[s.role].tier <= 5);
    const body = `<form data-form="vac-save" data-id="${id || ""}">
      <div><label class="field">Title</label><input class="input" name="title" required value="${esc(v.title)}" placeholder="e.g. Assistant Teacher — ECD B (Rainbows)"></div>
      <div class="form-row three mt-8">
        <div><label class="field">Post</label><select class="input" name="type"><option value="teacher" ${v.type === "teacher" ? "selected" : ""}>Class Teacher (main)</option><option value="assistant" ${v.type === "assistant" ? "selected" : ""}>Assistant Teacher</option></select></div>
        <div><label class="field">Class</label><select class="input" name="classId">${Store.db.classes.map(c => `<option value="${c.id}" ${c.id === v.classId ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div>
        <div><label class="field">Status</label><select class="input" name="status">${["open", "interviewing", "closed"].map(x => `<option ${v.status === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
      </div>
      <div class="form-row three mt-8">
        <div><label class="field">Opened</label><input class="input" type="date" name="opened" value="${v.opened}"></div>
        <div><label class="field">Closing date</label><input class="input" type="date" name="closing" value="${v.closing}"></div>
        <div><label class="field">Interview date</label><input class="input" type="date" name="interviewDate" value="${v.interviewDate}"></div>
      </div>
      <div class="mt-8"><label class="field">Panel (choose 3)</label><div class="flex wrap" style="gap:6px">${leaders.map(s => `<label class="pill ${v.panel.includes(s.id) ? "gold" : "grey"}" style="cursor:pointer"><input type="checkbox" name="panel" value="${s.id}" ${v.panel.includes(s.id) ? "checked" : ""} style="margin:0"> ${esc(s.first)} ${esc(s.last)}</label>`).join("")}</div></div>
      <div class="mt-8"><label class="field">Notes / demo-lesson brief</label><textarea class="input" name="notes">${esc(v.notes)}</textarea></div>
      <div class="modal-foot" style="padding:16px 0 0;border:0"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button class="btn" type="submit">${id ? "Save" : "Create vacancy"}</button></div></form>`;
    this.modal({ title: id ? "Edit vacancy" : "New vacancy", body });
  },

  /* ======================================================================
     MODAL
     ====================================================================== */
  modal({ title, body, foot, wide }) {
    const host = document.getElementById("modal-root");
    /* Where focus was, so it can be given back when the dialog closes — a
       keyboard user should not be returned to the top of the page. */
    this._modalReturn = document.activeElement;
    const titleId = `md_${Math.random().toString(36).slice(2, 8)}`;
    host.innerHTML = `<div class="modal-backdrop" data-action="close-modal-backdrop"><div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="${titleId}"><div class="modal-head"><h2 id="${titleId}">${esc(title)}</h2><button class="iconbtn" data-action="close-modal" aria-label="Close dialog">${icon("x")}</button></div><div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ""}</div></div>`;
    this.linkLabels(host);

    /* Into the dialog, not left behind it. The first field if there is one,
       otherwise the dialog itself. */
    const dialog = host.querySelector(".modal");
    const first = host.querySelector("input:not([type=hidden]), select, textarea, button:not([data-action='close-modal'])");
    if (first) first.focus();
    else if (dialog) { dialog.setAttribute("tabindex", "-1"); dialog.focus(); }
  },

  /* Tab stays inside an open dialog. Without this the next Tab walks off into
     the page behind it, which for a screen reader reads as the dialog having
     closed when it has not. */
  modalKeydown(e) {
    if (e.key !== "Tab") return;
    const dialog = document.querySelector("#modal-root .modal");
    if (!dialog) return;
    const stops = [...dialog.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter(el => !el.disabled && el.offsetParent !== null);
    if (!stops.length) return;
    const first = stops[0], last = stops[stops.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  },

  closeModal() {
    document.getElementById("modal-root").innerHTML = "";
    const back = this._modalReturn;
    this._modalReturn = null;
    if (back && document.contains(back)) { try { back.focus(); } catch (_) {} }
  },

  /* ======================================================================
     EVENT HANDLING
     ====================================================================== */
  onClick(e) {
    const el = e.target.closest("[data-action]"); if (!el) return;
    const a = el.dataset.action; const d = el.dataset;
    const H = {
      "pw-again": () => { this.ui.setPassword = { error: "", busy: false, done: false }; this.render(); },
      "drawer-open": () => { this.ui.drawer = true; this.render(); },
      "drawer-close": () => { this.ui.drawer = false; this.render(); },
      "logout": () => {
        try { localStorage.removeItem(this.placeKey()); } catch (_) {}
        Store.logout();
        this.ui.login = { email: "", error: "", busy: false, preview: "attendance" };
        this.ui.portal = { childId: null }; this.ui.setPassword = { error: "", busy: false, done: false };
        this.view = "dashboard"; location.hash = ""; this.render();
      },
      "go": () => { if (d.channel) this.ui.messages.channel = d.channel; this.go(d.view); },
      "open-register": () => { const ui = this.ui.attendance; ui.classId = d.class; if (this.view !== "attendance") ui.date = Store.today(); ui.periodId = d.period || null; ui.draft = {}; this.go("attendance"); },
      "att-period": () => { this.ui.attendance.periodId = d.id; this.ui.attendance.draft = {}; this.render(); },
      "att-day": () => { const dt = new Date(this.ui.attendance.date + "T12:00:00"); dt.setDate(dt.getDate() + Number(d.delta)); const n = iso(dt); if (n > Store.today()) return; this.ui.attendance.date = n; this.ui.attendance.periodId = null; this.ui.attendance.draft = {}; this.render(); },
      "att-today": () => { this.ui.attendance.date = Store.today(); this.ui.attendance.periodId = null; this.ui.attendance.draft = {}; this.render(); },
      "att-set": () => this.attSet(d.pupil, d.status),
      "att-all-present": () => { const ui = this.ui.attendance; Store.pupilsIn(ui.classId).forEach(p => { const cur = Store.att(ui.date, p.id, ui.periodId); if (!cur || cur.status !== "P") ui.draft[p.id] = { status: "P", note: ui.draft[p.id]?.note ?? cur?.note ?? "" }; }); this.render(); },
      "att-save": () => this.attSave(),
      "att-discard": () => { this.ui.attendance.draft = {}; this.render(); },
      "export-register": () => this.exportRegister(),
      "export-pupils": () => this.exportPupils(),
      "export-summary": () => this.exportSummary(),
      "open-pupil": () => this.pupilProfile(d.id),
      "pupil-new": () => this.pupilForm(null),
      "pupil-edit": () => this.pupilForm(d.id),
      "pupil-withdraw": () => {
        const p = Store.pupil(d.id);
        this.closeModal();
        this.undoable(`${p.first} ${p.last} withdrawn — off the registers from today. Records kept.`, {
          audit: `Withdrew pupil ${p.first} ${p.last} (${p.admissionNo})`,
          snapshot: () => { const was = p.status; p.status = "withdrawn"; return was; },
          restore: (was) => { p.status = was; },
        });
      },
      "staff-new": () => this.staffForm(null),
      "staff-edit": () => this.staffForm(d.id),
      "open-channel": () => { this.ui.messages.channel = d.id; this.render(); },
      "docs-cat": () => { this.ui.docs.cat = d.id; this.render(); },
      "doc-new": () => this.docForm(),
      "doc-remove": () => {
        const doc = Store.db.documents.find(x => x.id === d.id);
        this.undoable(`"${doc.name}" removed from the library. The file itself is still in Drive.`, {
          audit: `Removed document "${doc.name}" from library`,
          snapshot: () => { const at = Store.db.documents.indexOf(doc); Store.db.documents.splice(at, 1); return at; },
          restore: (at) => Store.db.documents.splice(at, 0, doc),
        });
      },
      "drive-connect": () => this.driveConnect(),
      "drive-disconnect": () => { Drive.disconnect(); this.toast("Google Drive disconnected."); this.render(); },
      "drive-browse": () => this.driveBrowse(),
      "drive-search": () => this.driveBrowse(),
      "drive-file": () => this.docForm({ name: d.name, url: d.url, type: d.type }),
      "cal-nav": () => { const ui = this.ui.calendar; ui.m += Number(d.delta); if (ui.m < 0) { ui.m = 11; ui.y--; } if (ui.m > 11) { ui.m = 0; ui.y++; } this.render(); },
      "cal-today": () => { const n = new Date(); this.ui.calendar = { y: n.getFullYear(), m: n.getMonth() }; this.render(); },
      "event-new": () => this.eventForm(null),
      "event-edit": () => this.eventForm(d.id),
      "event-delete": () => { Store.db.events = Store.db.events.filter(x => x.id !== d.id); Store.save(); this.closeModal(); this.toast("Event deleted."); this.render(); },
      "welfare-filter": () => { this.ui.welfare.filter = d.id; this.render(); },
      "welfare-new": () => this.welfareForm(d.pupil || null),
      "welfare-open": () => this.welfareOpen(d.id),
      "welfare-close": () => { const w = Store.db.welfare.find(x => x.id === d.id); w.status = "closed"; w.closedBy = this.me().id; w.closedOn = Store.today(); Store.save(); this.closeModal(); this.toast("Marked resolved."); this.render(); },
      "perm-target": () => { this.ui.perms.target = d.id; this.render(); },
      "perm-toggle": () => this.permToggle(d.id, d.perm),
      "perm-reset": () => this.permReset(d.id),
      "export-backup": () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([Store.exportJSON()], { type: "application/json" })); a.download = `ayanda_portal_backup_${Store.today()}.json`; a.click(); },
      "reset-demo": () => {
        if (Store.shared) return this.toast("This school runs on a shared database. Clearing it is done on the server, not from a browser.", "err");
        return this.confirmAction({
          title: "Clear everything in this browser?",
          body: "The whole school goes — the roll, every register, every mark, the fee accounts, the messages and the audit log — along with every sign-in. You would set the school up again from scratch. There is no undo and no copy kept: if you have not downloaded a backup, download one first and come back.",
          confirmLabel: "Clear it", danger: true,
          onConfirm: () => Store.reset().then(() => {
            this.ui.login = { email: "", error: "", busy: false, preview: "attendance" };
            location.hash = "#/staff"; this.render();
            this.toast("Cleared. Choose a password to set the school up again.");
          }),
        });
      },
      "tt-week": () => { this.ui.timetable.weekOffset += Number(d.delta); this.render(); },
      "tt-week-set": () => { this.ui.timetable.weekOffset = Number(d.offset); this.render(); },
      "tt-edit": () => this.ttEdit(d.day, Number(d.idx)),
      "tt-mode": () => { this.ui.timetable.mode = d.id; if (d.id === "mine" && !this.isTeachingStaff() && !this.ui.timetable.staffId) this.ui.timetable.staffId = Store.db.staff.find(x => Store.teamsOf(x.id).length)?.id; this.render(); },
      "open-register-day": () => { const ui = this.ui.attendance; ui.classId = d.class; ui.periodId = d.period; ui.date = d.date <= Store.today() ? d.date : Store.today(); ui.draft = {}; if (d.date > Store.today()) this.toast("That register opens on the day."); this.go("attendance"); },
      "vac-select": () => { this.ui.recruitment.vacancyId = d.id; this.render(); },
      "vac-new": () => this.vacancyForm(null),
      "vac-edit": () => this.vacancyForm(d.id),
      "cand-new": () => this.candidateForm(),
      "cand-open": () => this.candidateModal(d.id),
      "cand-delete": () => {
        const c = Store.db.candidates.find(x => x.id === d.id);
        this.closeModal();
        this.undoable(`${c.name}'s record deleted.`, {
          audit: `Deleted candidate record for ${c.name}`,
          snapshot: () => { const at = Store.db.candidates.indexOf(c); Store.db.candidates.splice(at, 1); return at; },
          restore: (at) => Store.db.candidates.splice(at, 0, c),
        });
      },
      "access-decide": () => this.decideAccess(d.id, d.decision),
      "family-message-open": () => this.openFamilyMessage(d.id),
      "gate-suggest": () => {
        const box = document.getElementById(d.target);
        if (!box) return;
        box.type = "text"; box.value = suggestCode(6); box.focus(); box.select();
      },
      "gate-clear": () => this.confirmAction({
        title: "Remove this door code?",
        body: "That portal page becomes reachable by anyone who has the address. Sign-ins still need a password, so no record opens without one — but the box asking for an email address is back on the open web. A code cannot be read back, so this one is gone for good; you would set a new one.",
        confirmLabel: "Remove the code", danger: true,
        onConfirm: () => this.saveGate(d.audience, ""),
      }),
      "absence-ack": () => {
        const a = (Store.db.absences || []).find(x => x.id === d.id); if (!a) return;
        a.status = "acknowledged"; a.seenBy = this.me().id; a.seenAt = new Date().toISOString();
        Store.db.reads[`${this.me().id}|portal`] = new Date().toISOString();
        Store.save(); this.toast("Marked as seen. The family can see that too."); this.render();
      },
      "install-dismiss": () => { try { localStorage.setItem(this.INSTALL_KEY, "1"); } catch (_) {} this.render(); this.toast("Hidden. It is still under My access if you change your mind."); },
      "find-clear": () => { this.ui.find.q = ""; this.render(); },
      "find-pupil": () => { this.ui.find.q = ""; if (this.pupilProfile) this.pupilProfile(d.id); else this.go("pupils"); },
      "find-staff": () => { this.ui.find.q = ""; this.go("staff"); this.ui.staff.q = Store.staffName(d.id, { short: true }); this.render(); },
      "find-class": () => { this.ui.find.q = ""; this.ui.attendance.classId = d.id; this.go("attendance"); },
      "find-page": () => { this.ui.find.q = ""; this.go(d.view); },
      "confirm-yes": () => { const go = this._confirming; this._confirming = null; this.closeModal(); if (go) go(); },
      "close-modal": () => this.closeModal(),
      "close-modal-backdrop": () => { if (e.target === el) this.closeModal(); },
    };
    Object.assign(H, this.sisActions ? this.sisActions(d, el, e) : {}, this.govActions ? this.govActions(d, el, e) : {},
      this.landingActions ? this.landingActions(d, el, e) : {}, this.portalActions ? this.portalActions(d, el, e) : {},
      this.guideActions ? this.guideActions(d, el, e) : {});

    /* Two elements carry an action and also contain the things that action is
       about, so closest() finds the wrapper from anything inside them — and
       the preventDefault below would then cancel a click that had nothing to
       do with the wrapper. A submit button's default action is to submit the
       form it is in; a link's is to go somewhere.

       The modal backdrop wants neither: a click inside the dialog is not a
       click on the backdrop, so it does nothing at all.

       The drawer is the opposite. Getting out of the way is its entire job,
       so a link inside it should close it AND travel — which is why the
       handler runs and the preventDefault does not. Without this, every link
       in the phone menu shut the menu and went nowhere. */
    if (e.target !== el) {
      if (a === "close-modal-backdrop") return;
      if (a === "landing-close-menu" && e.target.closest("a[href]")) { H[a](); return; }
    }

    if (H[a]) { e.preventDefault(); H[a](); }
  },
  onChange(e) {
    if (e.target.name && e.target.name.startsWith("score_")) { e.target.closest(".status-group").querySelectorAll(".score").forEach(sp => sp.classList.remove("on")); e.target.nextElementSibling.classList.add("on"); return; }
    const el = e.target.closest("[data-change]"); if (!el) return;
    const k = el.dataset.change; const v = el.value;
    if (this.portalChange && this.portalChange(k, v, el)) return;
    if (Store.isFamily) return;
    if (this.sisChange && this.sisChange(k, v, el)) return;
    if (k === "att-class") { this.ui.attendance.classId = v; this.ui.attendance.draft = {}; this.render(); }
    if (k === "att-date") { if (v && v <= Store.today()) { this.ui.attendance.date = v; this.ui.attendance.periodId = null; this.ui.attendance.draft = {}; this.render(); } }
    if (k === "tt-staff") { this.ui.timetable.staffId = v; this.render(); }
    if (k === "pupils-class") { this.ui.pupils.classId = v; this.render(); }
    if (k === "tt-class") { this.ui.timetable.classId = v; this.render(); }
    if (k === "perm-role") this.permRole(el.dataset.id, v);
    if (k === "perm-extra") this.permExtra(el.dataset.id, el.dataset.class, el.checked);
  },
  onInput(e) {
    const el = e.target.closest("[data-input]"); if (!el) return;
    const k = el.dataset.input; const v = el.value;
    const rerender = (fn) => { fn(); const pos = el.selectionStart; this.render(); const again = document.querySelector(`[data-input="${k}"]`); if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (_) {} } };
    if (this.sisInput && this.sisInput(k, v, el, rerender)) return;
    if (k === "find-q") rerender(() => this.ui.find.q = v);
    if (k === "pupils-q") rerender(() => this.ui.pupils.q = v);
    if (k === "staff-q") rerender(() => this.ui.staff.q = v);
    if (k === "families-q") rerender(() => this.ui.families.q = v);
    if (k === "docs-q") rerender(() => this.ui.docs.q = v);
    if (k === "drive-q") this.ui.drive.q = v;
    if (k === "att-note") { const pid = el.dataset.pupil; const cur = Store.att(this.ui.attendance.date, pid, this.ui.attendance.periodId); const dr = this.ui.attendance.draft[pid] || { status: cur?.status }; dr.note = v; this.ui.attendance.draft[pid] = dr; const foot = document.querySelector(".card-foot .small.muted"); if (foot) foot.textContent = `${Object.keys(this.ui.attendance.draft).length} unsaved change(s)`; document.querySelectorAll('[data-action="att-save"],[data-action="att-discard"]').forEach(b => b.disabled = false); }
  },
  onSubmit(e) {
    const form = e.target.closest("[data-form]"); if (!form) return;
    e.preventDefault();
    const raw = new FormData(form); const f = Object.fromEntries(raw.entries()); const k = form.dataset.form; const id = form.dataset.id || null;
    if (this.portalSubmit && this.portalSubmit(k, f, id, form, raw)) return;
    if (this.landingSubmit && this.landingSubmit(k, f, id, form, raw)) return;
    if (this.govSubmit && this.govSubmit(k, f, id, form, raw)) return;
    if (this.sisSubmit && this.sisSubmit(k, f, id, form, raw)) return;
    if (k === "login") {
      if (this.ui.login.busy) return;
      const email = String(f.email || "").trim();
      if (!email || !f.password) { this.ui.login.error = "Enter your school email address and your password."; return this.render(); }
      this.ui.login.busy = true; this.ui.login.error = ""; this.ui.login.email = email;
      const restore = this.landingBusy(form, "Signing in…");
      Store.login(email, f.password)
        .then(() => {
          this.ui.login.busy = false; this.ui.login.error = "";
          /* Whichever kind of account it turned out to be, land on its home. */
          if (Store.isFamily) { location.hash = "#/home"; }
          else { this.view = "dashboard"; location.hash = "#/dashboard"; }
          this.render();
        })
        .catch((err) => {
          this.ui.login.busy = false; restore();
          this.landingFormError(form, err.message || "Could not sign in.");
          const box = document.getElementById("password"); if (box) { box.value = ""; box.focus(); }
        });
      return;
    }
    if (k === "set-password") {
      const ui = this.ui.setPassword;
      if (ui.busy) return;
      if (f.password !== f.confirm) { ui.error = "The two new passwords are not the same."; return this.render(); }
      ui.busy = true; ui.error = ""; this.render();
      Store.setOwnPassword(f.currentPassword, f.password)
        .then(() => { ui.busy = false; ui.done = true; this.toast("Password changed."); this.render(); })
        .catch((e) => { ui.busy = false; ui.error = e.message || "Could not save the password."; this.render(); });
      return;
    }
    if (k === "send-message") { this.sendMessage(f.text); return; }
    if (k === "pupil-save") return this.pupilSave(id, f);
    if (k === "staff-save") return this.staffSave(id, f, raw);
    if (k === "doc-save") return this.docSave(f);
    if (k === "event-save") {
      if (id) Object.assign(Store.db.events.find(x => x.id === id), { title: f.title.trim(), date: f.date, kind: f.kind, colour: f.colour });
      else Store.db.events.push({ id: Store.uid("e"), title: f.title.trim(), date: f.date, kind: f.kind, colour: f.colour });
      Store.save(); this.closeModal(); this.toast("Event saved."); this.render(); return;
    }
    if (k === "welfare-save") {
      Store.db.welfare.unshift({ id: Store.uid("w"), date: f.date, time: f.time, pupilId: f.pupilId || null, classId: f.classId, type: f.type, severity: f.severity, reportedBy: this.me().id, summary: f.summary.trim(), actions: (f.actions || "").trim(), status: "open" });
      Store.audit(`Logged ${f.type.toLowerCase()} entry for ${Store.cls(f.classId).name}`); Store.save(); this.closeModal(); this.toast("Incident logged."); this.render(); return;
    }
    if (k === "tt-save") {
      const cls = Store.cls(this.ui.timetable.classId); const day = form.dataset.day, idx = Number(form.dataset.idx); const teamId = f.team || null;
      if (teamId) {
        const clash = Store.db.classes.find(c => c.id !== cls.id && (Store.db.timetable[c.id]?.[day] || [])[idx]?.t === teamId);
        if (clash) { this.toast(`${Store.team(teamId).name} team is already with ${clash.name} in that period.`, "err"); return; }
        const other = DAYS.flatMap(dk => (Store.db.timetable[cls.id]?.[dk] || []).filter((cell, i) => cell && cell.s === f.subject && cell.t && cell.t !== teamId && !(dk === day && i === idx)));
        if (other.length) { this.toast(`${f.subject} in ${cls.name} is taught by the ${Store.team(other[0].t).name} team — a subject keeps the same pair.`, "err"); return; }
      }
      Store.db.timetable[cls.id][day][idx] = { s: f.subject, t: teamId };
      Store.audit(`Timetable: ${cls.name} ${DAY_LABELS[day]} period ${idx + 1} set to ${f.subject}${teamId ? ` (${Store.team(teamId).name} team)` : ""}`); Store.save(); this.closeModal(); this.toast("Period updated."); this.render(); return;
    }
    if (k === "cand-new") {
      Store.db.candidates.push({ id: Store.uid("k"), vacancyId: this.ui.recruitment.vacancyId, name: f.name.trim(), phone: (f.phone || "").trim(), email: (f.email || "").trim(), qualification: (f.qualification || "").trim(), experience: (f.experience || "").trim(), stage: "applied", appliedOn: f.appliedOn, interviewAt: "", scores: {}, references: "pending", policeClearance: "pending", notes: "" });
      Store.audit(`Logged application from ${f.name.trim()}`); Store.save(); this.closeModal(); this.toast("Candidate added."); this.render(); return;
    }
    if (k === "cand-save") {
      if (!this.can("recruitment.manage")) return;
      const c = Store.db.candidates.find(x => x.id === id); const prev = c.stage;
      Object.assign(c, { stage: f.stage, interviewAt: f.interviewAt || "", phone: f.phone.trim(), qualification: f.qualification.trim(), experience: f.experience.trim(), email: f.email.trim(), references: f.references, policeClearance: f.policeClearance, notes: f.notes.trim() });
      c.scores = {}; SCORE_CRITERIA.forEach(k2 => { if (f[`score_${k2.key}`]) c.scores[k2.key] = Number(f[`score_${k2.key}`]); });
      if (f.stage !== prev) Store.audit(`Moved candidate ${c.name} to "${STAGES.find(s => s.id === f.stage).label}"`);
      Store.save(); this.closeModal(); this.toast("Candidate saved."); this.render(); return;
    }
    if (k === "vac-save") {
      const panel = raw.getAll("panel");
      const data = { title: f.title.trim(), type: f.type, classId: f.classId, status: f.status, opened: f.opened, closing: f.closing, interviewDate: f.interviewDate, panel, notes: f.notes.trim() };
      if (id) Object.assign(Store.db.vacancies.find(x => x.id === id), data); else { const nv = { id: Store.uid("v"), ...data }; Store.db.vacancies.push(nv); this.ui.recruitment.vacancyId = nv.id; }
      Store.audit(`${id ? "Updated" : "Opened"} vacancy "${data.title}"`); Store.save(); this.closeModal(); this.toast("Vacancy saved."); this.render(); return;
    }
    if (k === "gate-code") {
      const pin = String(f.pin || "").trim();
      if (!pin) { this.toast("Enter a code of four to ten digits.", "err"); return; }
      this.saveGate(form.dataset.audience, pin);
      return;
    }
    if (k === "settings-school") { Object.assign(Store.db.school, { name: f.name, tagline: f.tagline, address: f.address, phone: f.phone, email: f.email, web: f.web, regNo: f.regNo }); Store.save(); this.toast("School profile saved."); this.render(); return; }
    if (k === "settings-term") { Store.db.school.term = { name: f.termName, start: f.termStart, end: f.termEnd }; Store.db.school.lockMinutes = Math.max(5, Math.min(60, Number(f.lockMinutes) || 15)); Store.save(); this.toast("Term settings saved."); this.render(); return; }
    if (k === "settings-drive") { Store.db.school.googleClientId = f.clientId.trim(); Store.db.school.driveRootFolder = Drive.folderIdFromUrl(f.folder); Store.audit("Updated Google Drive integration settings"); Store.save(); this.toast("Integration settings saved."); this.render(); return; }
  },
};

document.addEventListener("DOMContentLoaded", () => { App.init(); });
