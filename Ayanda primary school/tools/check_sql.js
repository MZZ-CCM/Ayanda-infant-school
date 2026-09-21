#!/usr/bin/env node
/* ==========================================================================
   Checks supabase/schema.sql against js/api.js without a database
   --------------------------------------------------------------------------
   There is no Postgres in this repository's toolchain, so the SQL cannot be
   run here. These are the things that can still be checked from the text, and
   they are the ones that break silently:

     every portal_* function called is defined;
     every function is explicitly granted or revoked, so nothing is reachable
       from a browser by having been forgotten;
     every RPC call in js/api.js sends the argument names the function
       declares, which is the mismatch a browser reports as an unreadable
       PostgREST error.

   It proves nothing about semantics. Run the schema against a scratch project
   before trusting it.

       node tools/check_sql.js
   ========================================================================== */

const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");

const sql = fs.readFileSync(path.join(ROOT, "supabase", "schema.sql"), "utf8");
const api = fs.readFileSync(path.join(ROOT, "js", "api.js"), "utf8");

let problems = 0;
const fail = (m) => { problems++; console.error("  ✗ " + m); };
const ok = (m) => console.log("  ✓ " + m);

/* --- signatures ---------------------------------------------------------- */
const sigs = new Map();
for (const m of sql.matchAll(/create or replace function (\w+)\s*\(([\s\S]*?)\)\s*returns/g)) {
  const parts = []; let depth = 0, cur = "";
  for (const ch of m[2]) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { parts.push(cur); cur = ""; } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  sigs.set(m[1], parts.map(p => p.trim().split(/\s+/)[0]).filter(Boolean));
}
console.log(`\nsupabase/schema.sql — ${sigs.size} functions\n`);

/* --- every call resolves ------------------------------------------------- */
const called = new Set([...sql.matchAll(/\b(portal_\w+)\s*\(/g)].map(m => m[1]));
const undef = [...called].filter(n => !sigs.has(n));
undef.length ? fail(`called but not defined: ${undef.join(", ")}`) : ok("every portal_* called is defined");

/* --- nothing reachable by accident --------------------------------------- */
const names = (re) => { const m = sql.match(re); return m ? new Set([...m[1].matchAll(/\b(portal_\w+)\b/g)].map(x => x[1])) : new Set(); };
const granted = names(/grant execute on function([\s\S]*?)to anon, authenticated;/);
const revoked = names(/revoke execute on function([\s\S]*?)from anon, authenticated;/);
const uncovered = [...sigs.keys()].filter(n => !granted.has(n) && !revoked.has(n));
const both = [...granted].filter(n => revoked.has(n));
uncovered.length ? fail(`neither granted nor revoked: ${uncovered.join(", ")}`) : ok(`every function is explicitly granted (${granted.size}) or revoked (${revoked.size})`);
if (both.length) fail(`granted and revoked: ${both.join(", ")}`);
if (!/revoke execute on all functions in schema public from public;/.test(sql)) {
  fail("EXECUTE is not revoked from PUBLIC, which anon inherits — the grant list is not the whole surface");
} else ok("EXECUTE revoked from PUBLIC before the grant list");

/* --- js/api.js sends what the functions declare -------------------------- */
const sent = [];
const balanced = (src, from) => {
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(from + 1, i);
  }
  return "";
};
for (const re of [/fn:\s*"(portal_\w+)",\s*args:\s*\{/g, /this\.rpc\("(portal_\w+)",\s*\{/g]) {
  for (const m of api.matchAll(re)) sent.push([m[1], balanced(api, m.index + m[0].length - 1)]);
}
/* the family writes are returned as `fn: op.fn`, so they are named here */
const viaVariable = {
  portal_family_set_password: ["p_current", "p_password"],
  portal_family_absence: ["p_pupil_id", "p_date", "p_reason", "p_note"],
  portal_family_message: ["p_pupil_id", "p_subject", "p_body"],
  portal_family_details: ["p_phone", "p_relationship"],
  portal_family_seen: ["p_key"],
};
for (const [fn, args] of Object.entries(viaVariable)) sent.push([fn, args.map(a => `${a}: x`).join(",")]);

let checked = 0;
const seen = new Set();
for (const [fn, blob] of sent) {
  const args = [...new Set([...blob.matchAll(/\b(p_\w+)\s*:/g)].map(m => m[1]))].sort();
  const key = fn + "|" + args.join(",");
  if (seen.has(key)) continue;
  seen.add(key); checked++;
  const declared = sigs.get(fn);
  if (!declared) { fail(`${fn} is called from js/api.js but not defined in the schema`); continue; }
  const extra = args.filter(a => !declared.includes(a));
  if (extra.length) fail(`${fn} is sent ${extra.join(", ")}, which it does not declare`);
}
if (!problems) ok(`all ${checked} RPC call sites send argument names the schema declares`);

/* every family write the browser can make must be reachable */
for (const fn of Object.keys(viaVariable)) {
  if (!granted.has(fn)) fail(`${fn} is called by the portal but not granted to anon`);
}

console.log(problems ? `\n${problems} problem(s).\n` : "\nNo problems. Syntax and semantics still need a real Postgres.\n");
process.exit(problems ? 1 : 0);
