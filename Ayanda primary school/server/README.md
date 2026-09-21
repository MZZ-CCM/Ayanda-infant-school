# The portal server

Node 22 or newer and nothing else — no `npm install`, no build step, no
dependencies. SQLite comes from `node:sqlite`, hashing from `node:crypto`,
the HTTP server from `node:http`.

```bash
node server/server.js            # http://localhost:4000
PORT=8080 node server/server.js
```

The first run creates `server/data/ayanda.db`, fills it with the same demo
school the browser build uses, and prints a **temporary password for each
account, once**. Hand them over in person; everyone is asked to change theirs
on first sign-in. Delete the file to start again.

Sign-in is by school email address and password. There is no staff directory
endpoint: nothing about who works here is reachable without a session.

| File | What it holds |
|---|---|
| `db.js` | SQLite: records, settings, the change feed, sessions |
| `auth.js` | scrypt passwords, opaque session tokens, per-account and per-address throttling |
| `api.js` | who may see and do what — the rules, applied to requests |
| `routes.js` | the endpoints, thin over `api.js` |
| `server.js` | HTTP, static files, and the live stream |
| `seed.js` | first-run data, from `js/data.js` |

## Why the rules live here as well as in the browser

`js/permissions.js` is `require`d by the server, so roles and permissions have
one definition. The browser uses them to decide what to draw; the server uses
them to decide what is allowed. A request typed by hand gets the same answer as
the interface — which is the whole point, since anything the browser enforces
can be edited by whoever is sitting in front of it.

Three things are enforced here that a browser cannot be trusted with:

- **The fifteen-minute register.** A register opens when its period starts and
  locks fifteen minutes later. Only holders of *Amend locked registers* can
  change it afterwards, and the amendment is written to the audit log.
- **Scope.** A teacher is sent the pupils in the classes they teach and no
  others; medical details are stripped out entirely for anyone without
  *View medical & welfare*, so there is nothing to hide in the first place.
- **The governance tier.** *Integrations & API* and the statutory register
  follow the role and cannot be granted sideways, not even by the Director.

## Environment

| Variable | Default | |
|---|---|---|
| `PORT` | `4000` | |
| `AYANDA_DB` | `server/data/ayanda.db` | where the database file lives |
| `AYANDA_ORIGINS` | *(any)* | comma-separated origins allowed to call the API |
| `AYANDA_SEED_PASSWORD` | *(random each)* | one password for every seeded account, for local testing only |

Set `AYANDA_ORIGINS` in production — for example to the GitHub Pages address —
so only the school's own site can call the API.

## Backing up

The database is one file. Stop the server, copy `server/data/ayanda.db`, start
it again. While it is running, `sqlite3 server/data/ayanda.db ".backup out.db"`
takes a consistent copy without stopping anything.
