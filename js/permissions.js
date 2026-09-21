/* ==========================================================================
   Roles, permission catalogue and access checks
   --------------------------------------------------------------------------
   Tiers (highest first). Each role has a set of default permissions.
   Head Teacher and HR can additionally grant/revoke individual permissions
   per person from the Permissions portal. Those overrides are stored on the
   staff record as { grants: [...], revokes: [...] }.
   ========================================================================== */

const ROLES = {
  director:  { tier: 1, label: "School Director",         short: "Director",  scope: "all", governance: true },
  secretary: { tier: 2, label: "Board Secretary",         short: "Secretary", scope: "all", governance: true },
  head:      { tier: 3, label: "Head Teacher",            short: "Head",      scope: "all" },
  deputy:    { tier: 4, label: "Deputy Head",             short: "Deputy",    scope: "all" },
  hr:        { tier: 5, label: "HR & Administration",     short: "HR",        scope: "all" },
  bursar:    { tier: 6, label: "Bursar / Office Admin",   short: "Bursar",    scope: "all" },
  teacher:   { tier: 7, label: "Class Teacher",           short: "Teacher",   scope: "own_class" },
  assistant: { tier: 8, label: "Assistant Teacher",       short: "Assistant", scope: "own_class" },
};

/* The governance tier. The Director and the Board Secretary hold identical
   access: everything the Head Teacher has, plus the board, statutory and
   financial-oversight work that belongs to the two of them alone. */
const GOVERNANCE_ROLES = ["director", "secretary"];

/* Every permission the portal understands, grouped by module. */
const PERMISSION_GROUPS = [
  { key: "attendance", label: "Attendance", perms: [
    { key: "attendance.view",      label: "View registers",           desc: "See attendance for classes in scope" },
    { key: "attendance.mark",      label: "Mark today's register",    desc: "Record present / absent / late / excused" },
    { key: "attendance.edit_past", label: "Amend locked registers",   desc: "Change a register after its 15-minute window has closed, or on a previous day" },
    { key: "attendance.export",    label: "Export attendance",        desc: "Download CSV registers and summaries" },
  ]},
  { key: "pupils", label: "Pupils", perms: [
    { key: "pupils.view",         label: "View pupil profiles",       desc: "Names, class, guardian contact" },
    { key: "pupils.edit",         label: "Edit pupil details",        desc: "Update contact and personal details" },
    { key: "pupils.add",          label: "Enrol / withdraw pupils",   desc: "Add new admissions or remove leavers" },
    { key: "pupils.view_medical", label: "View medical & welfare",    desc: "Sensitive: allergies, conditions, welfare notes", sensitive: true },
  ]},
  { key: "staff", label: "Staff", perms: [
    { key: "staff.view",   label: "View staff directory", desc: "Contact details and class allocations" },
    { key: "staff.manage", label: "Manage staff records", desc: "Add staff, change roles and allocations" },
  ]},
  { key: "messages", label: "Internal communication", perms: [
    { key: "messages.view",      label: "Read channels & messages", desc: "Staff room, team channels and direct messages" },
    { key: "messages.send",      label: "Send messages",            desc: "Post in channels and direct messages" },
    { key: "messages.broadcast", label: "Send announcements",       desc: "Post to the whole-school announcements channel" },
  ]},
  { key: "documents", label: "Documents (Google Drive)", perms: [
    { key: "documents.view",   label: "View documents",           desc: "Open shared documents from Google Drive" },
    { key: "documents.upload", label: "Link / upload documents",  desc: "Add documents to a category" },
    { key: "documents.manage", label: "Manage document library",  desc: "Edit categories, remove documents, set audiences" },
  ]},
  { key: "calendar", label: "Calendar", perms: [
    { key: "calendar.view",   label: "View school calendar", desc: "Term dates, events and meetings" },
    { key: "calendar.manage", label: "Manage events",        desc: "Create, edit and cancel events" },
  ]},
  { key: "welfare", label: "Welfare & incidents", perms: [
    { key: "welfare.view", label: "View welfare log", desc: "Incidents, first aid and safeguarding notes", sensitive: true },
    { key: "welfare.log",  label: "Log an incident",  desc: "Record an incident or welfare concern" },
  ]},
  { key: "timetable", label: "Timetable", perms: [
    { key: "timetable.view",   label: "View class timetables", desc: "Weekly periods for classes in scope, with the teaching pair" },
    { key: "timetable.manage", label: "Edit timetables",       desc: "Change periods and subjects for any class" },
  ]},
  { key: "reports", label: "Reports", perms: [
    { key: "reports.view", label: "View reports", desc: "Attendance analytics and school summaries" },
  ]},
  { key: "recruitment", label: "Recruitment", perms: [
    { key: "recruitment.view",   label: "View recruitment",   desc: "Vacancies, candidates and interview outcomes", sensitive: true },
    { key: "recruitment.manage", label: "Run recruitment",    desc: "Add vacancies and candidates, record interview scores, move candidates between stages" },
  ]},
  { key: "admissions", label: "Admissions", perms: [
    { key: "admissions.view",   label: "View admissions",      desc: "Enquiries, applications and the admissions pipeline" },
    { key: "admissions.manage", label: "Run admissions",       desc: "Add applicants, move them between stages, record documents and baselines" },
    { key: "admissions.offer",  label: "Offer and enrol",      desc: "Send an offer of a place and turn an accepted applicant into a pupil record" },
  ]},
  { key: "gradebook", label: "Assessment & gradebook", perms: [
    { key: "gradebook.view",    label: "View marks",           desc: "Assessments and marks for classes in scope" },
    { key: "gradebook.mark",    label: "Enter marks",          desc: "Create assessments and record marks for classes taught" },
    { key: "gradebook.publish", label: "Publish reports",      desc: "Release end-of-term report cards to guardians" },
    { key: "gradebook.scale",   label: "Edit grading scale",   desc: "Change grade boundaries and assessment weightings" },
  ]},
  { key: "billing", label: "Fees & billing", perms: [
    { key: "billing.view",      label: "View fee accounts",    desc: "Invoices, payments and balances", sensitive: true },
    { key: "billing.manage",    label: "Manage billing",       desc: "Raise invoices, record payments, apply discounts" },
    { key: "billing.chase",     label: "Send fee reminders",   desc: "Email or SMS guardians about an outstanding balance" },
  ]},
  { key: "comms", label: "Guardian communication", perms: [
    { key: "comms.view",        label: "View guardian messages", desc: "Everything sent to guardians, logged against the pupil" },
    { key: "comms.send",        label: "Message guardians",    desc: "Send email or SMS to a guardian or a whole class" },
    { key: "comms.broadcast",   label: "Message the whole school", desc: "Send to every guardian on the roll" },
  ]},
  { key: "alumni", label: "Leavers & alumni", perms: [
    { key: "alumni.view",       label: "View alumni",          desc: "Leavers, destinations and contact details" },
    { key: "alumni.manage",     label: "Manage leavers",       desc: "Move a pupil to the alumni register and record their destination" },
  ]},
  { key: "governance", label: "Governance & statutory", perms: [
    { key: "governance.view",      label: "Board & governance",       desc: "Board meetings, minutes and resolutions. Director and Board Secretary only.", sensitive: true },
    { key: "governance.manage",    label: "Record board business",    desc: "Minute a meeting, log a resolution and set the board calendar" },
    { key: "governance.statutory", label: "Statutory register",       desc: "Registration certificate, licences, insurance and statutory returns. Director and Board Secretary only.", sensitive: true, locked: true },
    { key: "finance.oversight",    label: "Financial oversight",      desc: "Budget against actual, payroll cost, fee-setting and banking. Above the Bursar's day-to-day billing.", sensitive: true },
    { key: "strategy.manage",      label: "Strategy & capital projects", desc: "Roll targets, capital projects and reporting to the board" },
  ]},
  { key: "portal", label: "Family & student portal", perms: [
    { key: "portal.view",     label: "See family portal accounts", desc: "Which families have a sign-in, and when they last used it" },
    { key: "portal.manage",   label: "Invite and reset families",  desc: "Give a guardian a sign-in for their child's record, and reset one for a family who has been locked out" },
    { key: "portal.messages", label: "Answer the portal",          desc: "Read messages and absence notes families send from the portal, and reply to them" },
  ]},
  { key: "admin", label: "Administration", perms: [
    { key: "permissions.manage", label: "Manage permissions", desc: "Grant or revoke access for other staff. Head Teacher and HR only.", locked: true },
    { key: "accounts.manage",    label: "Set up and reset sign-ins", desc: "Create a colleague's account and issue a temporary password, and reset one for somebody who is locked out. Deliberately narrower than managing permissions: it hands over a way in, not a change to what anyone may do." },
    { key: "settings.manage",    label: "School settings",    desc: "School profile, term dates, integrations" },
    { key: "config.manage",      label: "Configuration",      desc: "Intakes, fee items, subjects and grading scales — changed in the portal, not in code" },
    { key: "integrations.manage", label: "Integrations & API", desc: "Connect Drive, mail, SMS and payment providers; issue API keys. Director and Board Secretary only — these are contracts with outside suppliers.", locked: true },
    { key: "audit.view",         label: "Audit log & compliance", desc: "Full change history and inspection export pack", sensitive: true },
  ]},
];

const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap(g => g.perms.map(p => p.key));

/* Permissions that belong to the governance tier alone. The Head Teacher runs
   the school; the Director and Board Secretary answer for it to the board and
   to the Ministry, so these sit with them. */
const GOVERNANCE_ONLY = ["governance.view", "governance.manage", "governance.statutory", "finance.oversight", "strategy.manage", "integrations.manage"];

/* Role defaults. "*" means everything. */
const ROLE_DEFAULTS = {
  director: ["*"],
  secretary: ["*"],
  head: ALL_PERMISSIONS.filter(p => !GOVERNANCE_ONLY.includes(p)),
  deputy: ALL_PERMISSIONS.filter(p => ![...GOVERNANCE_ONLY, "permissions.manage", "settings.manage", "config.manage", "recruitment.manage", "billing.manage"].includes(p)),
  hr: [
    "attendance.view", "attendance.export",
    "pupils.view", "pupils.edit", "pupils.add",
    "staff.view", "staff.manage",
    "messages.view", "messages.send", "messages.broadcast",
    "documents.view", "documents.upload", "documents.manage",
    "calendar.view", "calendar.manage",
    "welfare.view",
    "timetable.view", "timetable.manage",
    "reports.view",
    "recruitment.view", "recruitment.manage",
    "admissions.view", "admissions.manage", "admissions.offer",
    "gradebook.view", "gradebook.publish",
    "billing.view", "billing.chase",
    "comms.view", "comms.send", "comms.broadcast",
    "alumni.view", "alumni.manage",
    "portal.view", "portal.manage", "portal.messages",
    "permissions.manage", "accounts.manage", "settings.manage", "config.manage", "audit.view",
  ],
  bursar: [
    "attendance.view", "attendance.export",
    "pupils.view", "pupils.edit",
    "staff.view",
    "messages.view", "messages.send",
    "documents.view", "documents.upload",
    "calendar.view", "calendar.manage",
    "timetable.view",
    "reports.view",
    "admissions.view", "admissions.manage",
    "billing.view", "billing.manage", "billing.chase",
    "comms.view", "comms.send",
    "alumni.view",
    "portal.view", "portal.manage", "portal.messages",
    "accounts.manage",
    "audit.view",
  ],
  teacher: [
    "attendance.view", "attendance.mark",
    "pupils.view", "pupils.edit", "pupils.view_medical",
    "staff.view",
    "messages.view", "messages.send",
    "documents.view", "documents.upload",
    "calendar.view",
    "welfare.view", "welfare.log",
    "timetable.view",
    "reports.view",
    "gradebook.view", "gradebook.mark",
    "comms.view", "comms.send",
    "portal.messages",
    "admissions.view",
  ],
  assistant: [
    "attendance.view", "attendance.mark",
    "pupils.view",
    "staff.view",
    "messages.view", "messages.send",
    "documents.view",
    "calendar.view",
    "timetable.view",
    "welfare.log",
    "gradebook.view",
    "comms.view",
    "portal.view",
  ],
};

function roleDefaultPerms(roleKey) {
  const d = ROLE_DEFAULTS[roleKey] || [];
  return d.includes("*") ? new Set(ALL_PERMISSIONS) : new Set(d);
}

/* Effective permission set for a staff member = role defaults + grants - revokes.
   Locked permissions (permissions.manage) always follow the role and ignore overrides. */
function effectivePerms(staff) {
  if (!staff) return new Set();
  const base = roleDefaultPerms(staff.role);
  const grants = staff.grants || [];
  const revokes = staff.revokes || [];
  const locked = new Set(PERMISSION_GROUPS.flatMap(g => g.perms.filter(p => p.locked).map(p => p.key)));
  const out = new Set(base);
  grants.forEach(p => { if (!locked.has(p)) out.add(p); });
  revokes.forEach(p => { if (!locked.has(p)) out.delete(p); });
  return out;
}

function can(staff, perm) {
  return effectivePerms(staff).has(perm);
}

/* Which staff members may this person administer in the Permissions portal?
   - Only holders of permissions.manage (Director, Board Secretary, Head, HR).
   - Nobody can edit their own permissions.
   - Nobody outside the governance tier may edit the Director or the Board
     Secretary; only the governance tier and the Head may edit the Head. */
function canAdminister(actor, target) {
  if (!actor || !target) return false;
  if (!can(actor, "permissions.manage")) return false;
  if (actor.id === target.id) return false;
  const actorGov = GOVERNANCE_ROLES.includes(actor.role);
  if (GOVERNANCE_ROLES.includes(target.role) && !actorGov) return false;
  if (target.role === "head" && !actorGov && actor.role !== "head") return false;
  return true;
}
function isGovernance(staff) { return !!staff && GOVERNANCE_ROLES.includes(staff.role); }
const tierOf = (roleKey) => ROLES[roleKey] ? ROLES[roleKey].tier : 99;

/* --- handing out a way in ------------------------------------------------
   Setting up a sign-in and deciding what a role may do are two different
   powers, and the office needs the first without the second. HR, the Bursar,
   the Deputy and the Head all hold "accounts.manage": they can create a
   teacher's account and reset one that has been forgotten.

   The limit is the tier. You may issue an account at your own level or below
   it and never above, so the Bursar can set up a class teacher but cannot
   reset the Head Teacher's password and sign in as her — and the governance
   tier stays sealed to the governance tier, as it is everywhere else. */
function canIssueRole(actor, roleKey) {
  const role = ROLES[roleKey];
  if (!actor || !role) return false;
  if (!can(actor, "accounts.manage")) return false;
  if (role.governance) return GOVERNANCE_ROLES.includes(actor.role);
  return role.tier >= tierOf(actor.role);
}

function canIssueAccount(actor, target) {
  if (!actor || !target) return false;
  if (actor.id === target.id) return false;          // your own password is changed, not reset
  return canIssueRole(actor, target.role);
}

/* Which roles this person may hand an account to, highest tier first. */
function issuableRoles(actor) {
  return Object.keys(ROLES).filter(k => canIssueRole(actor, k)).sort((a, b) => ROLES[a].tier - ROLES[b].tier);
}

/* --- family portal --------------------------------------------------------
   A guardian's account is not a staff account: it is bound to one or more
   pupils and can read nothing outside them. Nobody signs in to it on a
   family's behalf, so there is no equivalent of canAdminister here — only the
   right to create one and to reset it. */
function canIssueFamilyAccount(actor) { return can(actor, "portal.manage"); }

/* Classes a staff member may see / act on. */
function classesInScope(staff, classes) {
  if (!staff) return [];
  const scope = ROLES[staff.role]?.scope || "own_class";
  if (scope === "all" || (staff.grants || []).includes("scope.all")) return classes;
  return classes.filter(c => c.teacherId === staff.id || c.assistantId === staff.id || (staff.extraClasses || []).includes(c.id));
}

const PERMISSION_INFO = Object.fromEntries(PERMISSION_GROUPS.flatMap(g => g.perms.map(p => [p.key, { ...p, group: g.label }])));

/* Shared with the backend: server/ requires this same file so roles and
   permissions have exactly one definition. Harmless in the browser. */
if (typeof module === "object" && module.exports) module.exports = {
  ROLES, GOVERNANCE_ROLES, GOVERNANCE_ONLY, PERMISSION_GROUPS, ALL_PERMISSIONS, ROLE_DEFAULTS,
  PERMISSION_INFO, roleDefaultPerms, effectivePerms, can, canAdminister, isGovernance, classesInScope,
  canIssueRole, canIssueAccount, issuableRoles, canIssueFamilyAccount, tierOf,
};
