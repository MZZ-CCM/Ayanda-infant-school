/* ==========================================================================
   Passwords — the rules, the generator, and the demo's credential store
   --------------------------------------------------------------------------
   The first two are shared: server/auth.js requires this file, so what counts
   as an acceptable password and what a generated one looks like are written
   once and cannot drift between the browser and the server.

   The third is the browser's own. Demo mode has no server to hash against, so
   it keeps real per-account credentials in localStorage — PBKDF2-SHA-256,
   must-change, a failed-attempt counter and a lockout, matching the policy in
   server/auth.js. It is not a security boundary, because anything in a
   browser's own storage belongs to whoever has the browser; it is here so the
   demo shows the real workflow — the office issues a password, the holder
   changes it — rather than a single published one that everybody shares.
   ========================================================================== */

const PASSWORD_POLICY = {
  MIN: 8,
  ITERATIONS: 150000,        // PBKDF2 rounds in the browser store below
  MAX_FAILED: 6,
  LOCKOUT_MINUTES: 15,
};

/* What a password has to be. Deliberately modest — a rule nobody can follow
   gets written on a sticky note. */
function passwordProblem(password) {
  const p = String(password || "");
  if (p.length < PASSWORD_POLICY.MIN) return `A password must be at least ${PASSWORD_POLICY.MIN} characters.`;
  if (!/[a-zA-Z]/.test(p) || !/[0-9]/.test(p)) return "A password needs at least one letter and one number.";
  if (/^(password|ayanda|school|123456)/i.test(p)) return "That password is too easy to guess.";
  return null;
}

/* Words chosen to be read aloud over a bad telephone line: no homophones, no
   letters that sound alike, nothing anyone has to spell twice. */
const WORDS = [
"acacia", "aloe", "baobab", "cedar", "ebony", "fig", "granite", "grass", "harvest", "hill",
  "ivory", "jacaranda", "kopje", "lantern", "marula", "mopane", "msasa", "olive", "orchid", "pebble",
  "quartz", "reed", "ridge", "river", "sable", "sandstone", "savanna", "silver", "sorghum", "sunrise",
  "sunset", "thatch", "thorn", "valley", "vlei", "willow", "amber", "anvil", "beacon", "bridge",
  "candle", "compass", "copper", "cotton", "delta", "ember", "falls", "garnet", "harbour", "indigo",
  "jasper", "kettle", "ladder", "lantana", "meadow", "nectar", "onyx", "papyrus", "quiver", "rafter",
  "saffron", "tamarind", "umber", "velvet",
];

/* Uniform, and without the modulo bias that makes a generator weaker than its
   word list suggests. */
function randomInt(max) {
  if (typeof module === "object" && module.exports) return require("node:crypto").randomInt(max);
  const limit = Math.floor(4294967296 / max) * max;
  const buf = new Uint32Array(1);
  let n;
  do { crypto.getRandomValues(buf); n = buf[0]; } while (n >= limit);
  return n % max;
}

/* Four words and two digits: readable enough to give over the telephone, and
   around 40 bits of entropy, which against six attempts per fifteen minutes is
   not worth anybody's time. Whoever issues one can type over it instead. */
function temporaryPassword() {
  const pick = () => WORDS[randomInt(WORDS.length)];
  return `${pick()}-${pick()}-${pick()}-${pick()}${randomInt(90) + 10}`;
}

/* A door code the school has not had to think up itself.

   Six digits, drawn one at a time from the same source as everything else
   here, and re-drawn if it lands on one of the patterns the checker rejects
   or on something a person would notice — all one digit, a straight run, or a
   date-shaped 0101. The point is not that a human could not have chosen it;
   it is that a human choosing under pressure picks the year, or the school's
   telephone number, and then gives the same one out for six years. */
function suggestCode(digits = 6) {
  const lazy = (c) =>
    /^(\d)\1+$/.test(c) ||                                   // 444444
    "0123456789".includes(c) || "9876543210".includes(c) ||   // 456789, 543210
    /^(19|20)\d{2}$/.test(c) ||                               // a year
    /^(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])/.test(c.slice(0, 4)); // a date
  for (let tries = 0; tries < 40; tries++) {
    let code = "";
    for (let i = 0; i < digits; i++) code += randomInt(10);
    if (!lazy(code)) return code;
  }
  return String(randomInt(900000) + 100000);
}

/* ==========================================================================
   The demo's credential store — browser only
   ========================================================================== */
const CREDENTIAL_KEY = "ayanda.portal.credentials";

const DemoCredentials = {
  /* PBKDF2 needs SubtleCrypto, which browsers only expose in a secure context:
     https, or localhost. Opened straight off the disk as a file:// page there
     is no way to store a password honestly, so this says so rather than
     inventing a hash of its own. */
  get available() { return typeof crypto !== "undefined" && !!(crypto.subtle && crypto.subtle.importKey); },
  unavailable: "Passwords need a secure page. Open the portal over https, or from localhost, rather than from a file on the disk.",

  read() { try { return JSON.parse(localStorage.getItem(CREDENTIAL_KEY) || "{}"); } catch (_) { return {}; } },
  write(all) { try { localStorage.setItem(CREDENTIAL_KEY, JSON.stringify(all)); } catch (_) {} },

  /* Whether anybody at all can sign in to this browser's school. False on a
     first visit, which is what puts the setup panel on the sign-in page. */
  any() { return Object.keys(this.read()).length > 0; },
  has(accountId) { return !!this.read()[accountId]; },
  mustChange(accountId) { return !!(this.read()[accountId] || {}).mustChange; },
  forget(accountId) { const all = this.read(); delete all[accountId]; this.write(all); },
  clear() { try { localStorage.removeItem(CREDENTIAL_KEY); } catch (_) {} },

  async hash(password, salt) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(String(password)), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: enc.encode(salt), iterations: PASSWORD_POLICY.ITERATIONS, hash: "SHA-256" }, key, 256);
    return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, "0")).join("");
  },

  /* `mustChange` defaults to off. A password the office chose is one the
     office knows, which is an argument for making people replace it — but it
     is the school's argument to make, per account, not a rule the software
     imposes on everybody. Whoever issues one ticks the box if they want it. */
  async set(accountId, password, { mustChange = false, check = true } = {}) {
    if (!this.available) throw new Error(this.unavailable);
    if (check) { const problem = passwordProblem(password); if (problem) throw new Error(problem); }
    const salt = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, "0")).join("");
    const all = this.read();
    all[accountId] = { hash: await this.hash(password, salt), salt, mustChange: !!mustChange, failed: 0, lockedUntil: null };
    this.write(all);
    return true;
  },

  /* The same answer, and the same work, whether the account exists or not. */
  async verify(accountId, password) {
    if (!this.available) return { ok: false, reason: this.unavailable };
    const all = this.read();
    const cred = all[accountId];
    if (!cred) { await this.hash(password, "decoy-salt-for-an-unknown-account"); return { ok: false, reason: null }; }

    if (cred.lockedUntil && cred.lockedUntil > Date.now()) {
      const mins = Math.ceil((cred.lockedUntil - Date.now()) / 60000);
      return { ok: false, reason: `This account is locked for ${mins} more minute${mins === 1 ? "" : "s"} after repeated failed attempts.` };
    }
    const candidate = await this.hash(password, cred.salt);
    if (candidate !== cred.hash) {
      cred.failed = (cred.failed || 0) + 1;
      if (cred.failed >= PASSWORD_POLICY.MAX_FAILED) cred.lockedUntil = Date.now() + PASSWORD_POLICY.LOCKOUT_MINUTES * 60000;
      this.write(all);
      return { ok: false, reason: cred.lockedUntil ? `This account is now locked for ${PASSWORD_POLICY.LOCKOUT_MINUTES} minutes.` : null };
    }
    cred.failed = 0; cred.lockedUntil = null;
    this.write(all);
    return { ok: true, mustChange: !!cred.mustChange };
  },

  async clearMustChange(accountId) {
    const all = this.read();
    if (all[accountId]) { all[accountId].mustChange = false; this.write(all); }
  },
};

/* ==========================================================================
   The door code, in demo mode — browser only
   --------------------------------------------------------------------------
   Same shape as the server's: one code for staff, another for families,
   hashed, never readable back. A door code is not a password — everybody on
   one side of the school has the same one — so this is the outer door and the
   password behind it is still the lock.
   ========================================================================== */
const GATE_KEY = "ayanda.portal.gate";

const DemoGate = {
  read() { try { return JSON.parse(localStorage.getItem(GATE_KEY) || "{}"); } catch (_) { return {}; } },
  write(all) { try { localStorage.setItem(GATE_KEY, JSON.stringify(all)); } catch (_) {} },
  clear() { try { localStorage.removeItem(GATE_KEY); } catch (_) {} },

  status() {
    const g = this.read();
    return Object.fromEntries(["staff", "family"].map(a => [a, {
      required: !!(g[a] && g[a].hash), setAt: (g[a] && g[a].setAt) || null, setBy: (g[a] && g[a].setBy) || null,
    }]));
  },
  required(audience) { const e = this.read()[audience]; return !!(e && e.hash); },

  problem(pin) {
    const p = String(pin || "").trim();
    if (!/^[0-9]{4,10}$/.test(p)) return "A door code is between four and ten digits.";
    if (/^(0000|1234|1111|123456|000000)$/.test(p)) return "That code is too easy to guess.";
    return null;
  },

  async set(audience, pin, by) {
    const all = this.read();
    if (!String(pin || "").trim()) { delete all[audience]; this.write(all); return { ok: true }; }
    const problem = this.problem(pin);
    if (problem) throw new Error(problem);
    if (!DemoCredentials.available) throw new Error(DemoCredentials.unavailable);
    const salt = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, "0")).join("");
    all[audience] = { hash: await DemoCredentials.hash(pin, salt), salt, setAt: new Date().toISOString(), setBy: by || null };
    this.write(all);
    return { ok: true };
  },

  async check(audience, pin) {
    const entry = this.read()[audience];
    if (!entry || !entry.hash) return { ok: true, unset: true };
    if (!DemoCredentials.available) return { ok: false, reason: DemoCredentials.unavailable };
    const candidate = await DemoCredentials.hash(String(pin || ""), entry.salt);
    if (candidate !== entry.hash) return { ok: false, reason: "That code is not right. Ask the school office for the current one." };
    return { ok: true };
  },
};

/* Shared with server/auth.js, which takes the rules and the generator and
   leaves the browser store behind. */
if (typeof module === "object" && module.exports) module.exports = {
  PASSWORD_POLICY, passwordProblem, WORDS, randomInt, temporaryPassword, suggestCode,
};
