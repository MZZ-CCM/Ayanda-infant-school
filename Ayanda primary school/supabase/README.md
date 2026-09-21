# Hosted database — the GitHub Pages path

GitHub Pages serves files, not programs, so a site published from a branch
cannot run a database of its own. This puts one in Supabase's free tier
instead: the site stays exactly as it is, published from `main`, and the page
talks to Postgres over HTTPS. Every account then sees the same school, and a
change made in one browser reaches the others within a second.

## Setting it up

1. Create a project at supabase.com and open the **SQL editor**.
2. Run `schema.sql`, then `seed.sql`. Regenerate the seed at any time with
   `node tools/build_sql.js > supabase/seed.sql`, which reads the same
   `js/permissions.js` and `js/data.js` the portal uses, so the database and
   the interface cannot drift apart.
3. In **Database → Replication**, make sure the `changes` table is published to
   `supabase_realtime`. That is what makes other people's changes appear.
4. Copy the project URL and the **anon** key from **Settings → API** into
   `js/config.js`, and set `backend: "supabase"`.
5. Commit and push. Pages redeploys and the school is shared.

The anon key belongs in the repository. It identifies the project and nothing
more: every table has row-level security on, the key can reach nothing directly,
and the only things it may call are the `portal_*` functions, each of which
resolves the caller's session and applies the same permission rules the portal
draws its menus from.

## How the rules are kept in one place

`role_permissions` and `locked_permissions` are generated from
`js/permissions.js`. Change a role there, regenerate the seed, and the database
changes with it. `portal_can()` then applies role defaults, per-person grants
and revokes, and the role-locked permissions the governance tier depends on.

`portal_state()` returns only what the caller may see — a teacher gets the
pupils in the classes they teach, with medical details stripped unless they
hold *View medical & welfare*, and nothing at all from the board or the
statutory register.

## What is verified and what is not

The Node server in `server/` is tested and working: two accounts signed in at
once, permissions refused server-side, the fifteen-minute register rule
enforced, live updates arriving.

**This Postgres translation has not been run.** It is a faithful port of the
same design, but it was written without a Supabase project to execute it
against, so treat the first run as the test. Expect to fix small things —
a function signature, a cast, a policy — rather than the shape of it. Run
`schema.sql` in the SQL editor and read the errors; they are specific.

If you would rather not depend on a hosted service at all, `server/` runs the
same portal from a single Node process on any machine the school controls, and
that path is known to work.
