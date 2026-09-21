/* ==========================================================================
   Where the portal keeps its data.
   --------------------------------------------------------------------------
   GitHub Pages serves files, not programs, so a site published from a branch
   cannot run a database of its own. Point `backend` at one of these:

     "auto"      probe for a server on this origin, then fall back to demo
     "demo"      this browser only (localStorage) — nothing is shared
     "server"    the Node server in server/ — self-hosted, data stays put
     "supabase"  a hosted Postgres — works from GitHub Pages, shared by all

   The Supabase anon key below is meant to be public: it identifies the
   project, and row-level security in supabase/schema.sql decides what each
   signed-in member of staff may actually read or write.
   ========================================================================== */

window.AYANDA_CONFIG = {
  backend: "auto",

  /* used when backend is "server" — leave blank to use the current origin */
  serverUrl: "",

  /* used when backend is "supabase" */
  supabase: {
    url: "",
    anonKey: "",
  },

  /* how long to wait before asking the server for changes again, in ms.
     Only used where the live stream is unavailable. */
  pollInterval: 15000,
};
