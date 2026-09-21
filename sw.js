/* ==========================================================================
   Service worker — so the portal opens on a phone with no signal
   --------------------------------------------------------------------------
   The app shell (page, stylesheet, scripts, crest) is cached on install and
   served from the cache, which is what makes the installed app start instantly
   and work in a classroom with no bars.

   Records are never cached. A register or a pupil's details read from a stale
   cache would be worse than no answer at all, so anything under /api/ goes to
   the network every time and fails honestly when it cannot.
   ========================================================================== */

const VERSION = "v98";
const SHELL = `ayanda-shell-${VERSION}`;

/* Relative, because the site may be served from a subdirectory on GitHub Pages. */
const FILES = [
  "./", "./index.html", "./manifest.webmanifest",
  `./css/styles.css?v=${VERSION.slice(1)}`,
  `./js/config.js?v=${VERSION.slice(1)}`, `./js/api.js?v=${VERSION.slice(1)}`,
  `./js/permissions.js?v=${VERSION.slice(1)}`, `./js/credentials.js?v=${VERSION.slice(1)}`,
  `./js/data.js?v=${VERSION.slice(1)}`,
  `./js/family.js?v=${VERSION.slice(1)}`, `./js/store.js?v=${VERSION.slice(1)}`,
  `./js/drive.js?v=${VERSION.slice(1)}`,
  `./js/app.js?v=${VERSION.slice(1)}`, `./js/sis.js?v=${VERSION.slice(1)}`,
  `./js/governance.js?v=${VERSION.slice(1)}`, `./js/portal.js?v=${VERSION.slice(1)}`,
  `./js/landing.js?v=${VERSION.slice(1)}`, `./js/site.js?v=${VERSION.slice(1)}`,
  "./assets/logo.png", "./assets/banner-sm.jpg", "./assets/icons/icon-192.png",
];

self.addEventListener("install", (e) => {
  /* addAll fails the whole install if one file is missing; add them singly so a
     renamed asset degrades to "not cached" rather than "no offline at all". */
  e.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await Promise.all(FILES.map(f => cache.add(f).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith("ayanda-shell-") && k !== SHELL).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (e) => { if (e.data === "skip-waiting") self.skipWaiting(); });

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return;                 // leave other origins alone
  if (url.pathname.includes("/api/")) return;                 // records always come from the server

  /* Navigations: try the network so a new version is picked up, fall back to
     the cached shell when there is nothing to reach. */
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try { return await fetch(req); }
      catch (_) { return (await caches.match("./index.html")) || (await caches.match("./")) || Response.error(); }
    })());
    return;
  }

  /* Everything else: cache first, and quietly refresh it for next time. */
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreVary: true });
    const fresh = fetch(req).then(async (res) => {
      if (res && res.ok) (await caches.open(SHELL)).put(req, res.clone());
      return res;
    }).catch(() => null);
    return hit || (await fresh) || Response.error();
  })());
});
