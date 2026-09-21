#!/usr/bin/env node
/* ==========================================================================
   Static preview server
   --------------------------------------------------------------------------
   Serves the published site — index.html, css, js, assets — and nothing else.
   No API, so the portal runs in demo mode, which is what the public pages are
   previewed against.

   It exists because `python3 -m http.server` has two problems here.

   The first is fatal: it reads the working directory at import time, in the
   default for --directory, so a stale or deleted cwd kills it before it can
   parse a single argument. That is exactly what happened when this project
   moved to another folder and the old path went away. This script resolves
   the root from __dirname instead, so where it is started from cannot change
   what it serves, or whether it starts at all.

   The second is quieter: python serves everything with the same caching, and
   a stale service worker then keeps handing out an old shell long after a
   change. index.html, sw.js and the manifest are sent no-cache here, matching
   what server/server.js does, so a change is visible on the next reload.

       node tools/serve.js [port]
   ========================================================================== */

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.argv[2] || process.env.PORT) || 8765;
const HOST = process.env.HOST || "127.0.0.1";

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".pdf": "application/pdf", ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json", ".mp4": "video/mp4", ".webm": "video/webm",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/* The page, the worker and the manifest decide what version everyone else is
   on, so they are always revalidated. */
const ALWAYS_FRESH = /^(index\.html|sw\.js|manifest\.webmanifest)$/;

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", ...headers });
  res.end(body);
};

http.createServer((req, res) => {
  let url;
  try { url = new URL(req.url, `http://${req.headers.host || HOST}`); }
  catch (_) { return send(res, 400, "Bad request"); }

  let rel;
  try { rel = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname); }
  catch (_) { return send(res, 400, "Bad request"); }
  rel = rel.replace(/^\/+/, "");
  if (rel.includes("\0")) return send(res, 400, "Bad request");

  /* Resolve, then check — so "a/../../etc/passwd" is caught after the .. has
     been collapsed rather than before. */
  const file = path.resolve(ROOT, rel);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return send(res, 403, "Forbidden");
  if (/^(server|\.git|node_modules)(\/|$)/.test(rel)) return send(res, 404, "Not found");

  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) return send(res, 404, "Not found");
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": ALWAYS_FRESH.test(rel) ? "no-cache" : "public, max-age=60",
    });
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, HOST, () => {
  console.log(`\n  Ayanda Infant School — static preview`);
  console.log(`  -------------------------------------`);
  console.log(`  serving  ${ROOT}`);
  console.log(`  at       http://${HOST}:${PORT}\n`);
});
