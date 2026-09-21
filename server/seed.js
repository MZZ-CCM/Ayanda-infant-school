/* ==========================================================================
   Seeding — writes the empty school: the settings, the timetable shape, the
   fee items and one placeholder Head Teacher account to sign in with. No
   children and no staff, because none exist until the school enters them.
   Run once on first start; safe to call again (it does nothing if seeded).

   There was an AYANDA_DEMO flag here that filled a fresh database with an
   invented school instead. It has gone, along with the invented school: a
   system that holds real children should not ship with a way of pouring five
   hundred fictional ones into it, and "it was only the demo" is not a thing
   anybody wants to say afterwards. Test data belongs in a test database that
   somebody made on purpose.
   ========================================================================== */

const path = require("node:path");
const db = require("./db");
const auth = require("./auth");

const ROOT = path.resolve(__dirname, "..");
const data = require(path.join(ROOT, "js", "data.js"));

/* Every seeded account gets its own temporary password, printed once when the
   database is created. There is no shared default, because a shared default is
   the password everybody keeps. */

function isSeeded() { return db.meta("seeded_at") !== null; }

function seed({ today = new Date().toISOString().slice(0, 10), force = false } = {}) {
  if (isSeeded() && !force) return { seeded: false };

  const s = data.buildSeed(today);
  const issued = [];

  /* A school starts with no family accounts: the office invites each family
     by hand, having checked who they are. */

  db.transaction(() => {
    /* single documents */
    for (const key of db.SETTINGS) if (s[key] !== undefined) db.setSetting(key, s[key], null, { silent: true });

    /* record collections */
    for (const [collection, spec] of Object.entries(db.COLLECTIONS)) {
      const value = s[collection];
      if (!value) continue;

      if (Array.isArray(value)) {
        value.forEach((row, i) => {
          const id = spec.idKey ? row[spec.idKey] : `${collection}_${String(i).padStart(5, "0")}`;
          const clean = { ...row };
          delete clean.pin;                 // credentials never live in the record
          db.put(collection, String(id), clean, null, { silent: true });
        });
      } else {
        /* keyed objects — attendance is `${date}|${periodId}|${pupilId}` */
        for (const [id, row] of Object.entries(value)) db.put(collection, id, row, null, { silent: true });
      }
    }

    /* credentials — one per account in whichever school was loaded */
    for (const member of s.staff) {
      const password = process.env.AYANDA_SEED_PASSWORD || auth.temporaryPassword();
      auth.setPassword(member.id, password, { mustChange: false, check: false });
      issued.push({ email: member.email, name: `${member.title} ${member.first} ${member.last}`, password, kind: "staff" });
    }
    for (const family of s.guardians || []) {
      const password = process.env.AYANDA_SEED_PASSWORD || auth.temporaryPassword();
      auth.setPassword(family.id, password, { mustChange: false, check: false });
      issued.push({ email: family.email, name: `${family.name} (family portal)`, password, kind: "family" });
    }

    db.setMeta("seeded_at", db.now());
    db.setMeta("seed_version", String(data.SEED_VERSION));
    db.setMeta("school_year", today.slice(0, 4));
  });

  return {
    seeded: true,
    issued,
    counts: Object.fromEntries(Object.keys(db.COLLECTIONS).map(c => [c, db.count(c)])),
  };
}

/* Wipe everything and re-seed. Used by `npm run reset` and the Settings page. */
function reset(today) {
  db.transaction(() => {
    for (const t of ["records", "settings", "changes", "sessions", "credentials", "meta"]) db.handle().exec(`DELETE FROM ${t}`);
  });
  return seed({ today, force: true });
}

module.exports = { seed, reset, isSeeded };
