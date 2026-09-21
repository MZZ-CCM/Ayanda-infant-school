# Ayanda Infant School — Portal

A school management portal with two faces. The **staff portal** serves everyone from the Head Teacher to assistant teachers; the **family & student portal** gives each family a sign-in to their own children's records and nothing else. Built to the school's brand: navy `#16304f`, gold `#b08d34`, Georgia for headings and Calibri for body text, taken from the official letterhead.




## What ships, and what does not

This repository is safe to publish. It contains **no pupils and no staff** —
not real ones, and not invented ones either.

| Ships | Does not ship |
|---|---|
| The school's own details, classes, periods and subjects | Any child: no names, dates of birth, addresses, guardians or medical notes |
| The grading scale, fee items, admission stages, document categories | Any member of staff beyond one placeholder account |
| Blank Word and Excel templates | Registers, marks, invoices, payments, messages home, welfare notes |
| One placeholder **Head Teacher** account to sign in and set the school up | Board minutes, candidates, alumni, statutory reference numbers |

The portal therefore opens on an empty school: four classes with nobody
allocated, no roll, no timetable. That is the correct starting point — the Head
Teacher signs in, adds colleagues, and the school fills itself in from there.

`tools/build_documents.py` regenerates the Word and Excel documents from
whatever is on the system, so the consent register and CPD record print blank
now and print the real thing once the school has entered its roll.

### There is no demo data

There used to be: `js/demo-school.js`, an invented school of fifty-nine
children that Settings could pour into the browser, and later a second one of
five hundred. Both are gone, along with the `AYANDA_DEMO` server flag and the
file itself.

A system that holds real children should not ship with a way of filling itself
with fictional ones. The risk is not that somebody loads it by accident on
day one; it is that somebody loads it in year two, over a term's registers,
and "it was only the demo" is not a sentence anybody wants to say to a parent.
Test data belongs in a test database that somebody made on purpose.

So a fresh install is an empty school: the settings, the timetable shape, the
fee items, and one placeholder Head Teacher account to sign in with. Every
child and every member of staff is entered by the school.

The old demo is still in the git history if it is ever wanted for a
demonstration — `git show db228b0:js/demo-school.js` — but it is not part of
what gets published.

### Keeping a copy

**Settings → Records → Download a backup** writes the whole school to one
plain-JSON file: the roll, the registers, the marks, the fee accounts, the
messages and the audit log. It is readable in a text editor and openable by
anything, so it does not depend on this software still existing.

In the browser build that file is **the only copy there is**. Nothing is on a
server and nothing is backed up for anybody: clearing the browser's data, or
sitting at a different machine, and the school is gone. Take one at the end of
every term, and take one before anybody uses *Clear this browser*, which says
so on the way past.

**Changing the Head Teacher's account.** It ships as
`head@ayandainfantschool.com` with the name "Head Teacher". Sign in, change the
name and address on the Staff page, and change the password immediately.

### Issuing a one-time password

For a fresh install, or for anyone who has forgotten theirs:

```bash
node tools/reset-password.js head@ayandainfantschool.com
```

To choose the password rather than take the generated one — easier when it has
to be read down a telephone — give it as a second argument:

```bash
node tools/reset-password.js head@ayandainfantschool.com marula-hill-42
```

It prints the password once, marks it must-change so it stops working the
moment it is used, and signs out any session that account already had — which
matters when the reason for the reset is that somebody else knew the old one.
Hand it over in person or by telephone rather than by email. It reaches family
portal accounts as well as staff ones.

Inside the portal the same thing is done from the Staff page, and for families
from **Family portal** or a pupil's own record. Nobody, at any tier, can read
another person's password back: it is only ever replaced.


## Signing in

Staff sign in with their **school email address and a password**. There is no
list of names to pick from and no shared PIN, because both of those hand an
attacker most of what they need.

- **Nothing about the staff is public.** The sign-in page shows no names, no
  roles and no email addresses, and there is no endpoint that will list them
  without a session. Who works at the school is not public information.
- **The form gives nothing away.** A wrong password and an address that does
  not exist return the same message and take the same time — a decoy hash runs
  for unknown addresses — so the form cannot be used to find out who has an
  account.
- **Passwords** are hashed with scrypt, at least eight characters with a letter
  and a number, and never travel back to a browser in any form.
- **Attempts are throttled twice:** six failures locks that account for fifteen
  minutes, and twenty failures from one address in an hour stops that device.
  Locking one account is no use if a list can be worked through.
- **Nobody chooses anyone else's password.** HR and the Head Teacher can
  *reset* a colleague to a temporary one, shown once, which the colleague must
  then change. Changing your own needs your current one.
- Every sign-in, reset and failure is recorded in the audit log.



## On a phone

The portal installs. On Android or desktop Chrome the staff page offers an
**Install** button; on iPhone it is Share ▸ Add to Home Screen. Installed, it
opens without browser bars, with the school crest as its icon, and lands on
whichever portal you were last signed in to — one app for both, with shortcuts
to the register, to messages and to the family portal on a long press.

It is built for a teacher holding a phone in a classroom, which is where a
register actually gets taken:

- The sidebar becomes a drawer, and the four things reached for during a lesson
  — dashboard, attendance, pupils, marks — sit in a bar along the bottom, in
  reach of a thumb. Following any link closes the drawer behind you.
- Present / Absent / Late / Excused are 40px targets. Inputs are 16px, which is
  what stops iOS zooming the page every time a field is focused.
- Modals open as sheets from the bottom rather than boxes in the middle.
- Wide tables and the admissions board scroll inside themselves, so the page
  itself never slides sideways.
- Safe-area insets are respected, so nothing hides under a notch or a home bar,
  and nothing sits underneath the thumb bar at the bottom of the screen.
- Toolbars, card footers and modal buttons wrap instead of pushing the save
  button off the right-hand edge. Every tap target on a touch screen is at
  least 38px, and the register's marks are 40px.
- The family portal is built the same way: the same drawer, its own thumb bar
  (home, attendance, progress, messages) and the same sheet-style forms. A
  parent checking a fee balance at a bus stop is the case it was drawn for.
- The door code is a numeric field, so phones open the number pad for it.

**Offline.** A service worker caches the app shell — the page, stylesheet,
scripts and crest — so an installed copy opens instantly and still opens with
no signal. **Records are never cached.** A register or a pupil's details read
from a stale cache would be worse than no answer, so anything under `/api/`
goes to the network every time and fails honestly when it cannot.

**Updates.** The page, the service worker and the manifest are served
`no-cache`, so a deploy reaches people on the next visit rather than whenever a
five-minute cache happens to expire. When a new worker takes over, the page
reloads itself once — on an update, never on a first install, and never twice.
Without that, a phone keeps running yesterday's scripts against today's shell,
which is how a portal ends up half-broken for one person and fine for everyone
else.

One caveat, stated because I could not test it: service workers need HTTPS, so
offline works on GitHub Pages but not over plain `http://` on a local machine.
The browser I develop in refuses service workers outright, so registration is
unverified — the script is served with the right type and parses, but the first
install on a real phone is the real test. The manifest, the icons, the drawer,
the bottom bar, the layout at 375px and the install prompt are all verified.

## The public site

| Page | Answers | Address |
|---|---|---|
| The school | Which year would my child be in, and what is this place | `/` |
| What they learn | The curriculum, the enrichment subjects, how progress is reported, the timetable | `/#/learning` |
| Specialist support | The screening, the two specialists, what happens after | `/#/support` |
| Fees and places | Every figure for every year, the discounts, the places left | `/#/fees` |
| Joining us | How a place is offered, what to bring, the questions families ask | `/#/joining` |
| Book a visit | The one action the site is for | `/#/visit` |
| About | The values, how we work, where we are | `/#/about` |
| The family portal | Parents and guardians with a child here | `/#/families` |
| The staff portal | Teachers and office staff | `/#/staff` |

It was one page until recently — thirteen sections in a single scroll, which
meant a parent who only wanted the fees had to travel past the curriculum to
find them, and nothing could be linked to, bookmarked, or sent to a husband
except "the website". Each question now has an address.

Six of those pages share one shell (`js/site.js`: `siteShell`, `siteHeader`,
`siteDrawer`, `siteFooter`), so the header, the drawer and the footer are
written once and cannot drift apart. Each of them opens with the same kind of
head — where you are, what the page answers, the action — and closes with the
same call to action, `ctaBand()`. The two portal pages keep a shell of their
own because they are a different audience with a different first question.

Nothing about the staff, and nothing about any child, appears anywhere on the
public site.

**Routing.** `App.publicRoute()` reads the address bar; `renderLogin()` in
`js/landing.js` is the router. A route is `#/name`; anything after a second
hash is an in-page anchor, so `#/learning#timetable` works as a link. Changing
page scrolls to the top — but only on a genuine change of page, so a re-render
after choosing a year, or after a form error, leaves the reader where they
were.

Neither portal page has a sign-up form. A staff account is requested and
approved; a family account is created by the office, in person, having checked
who the person is. A portal account reaches a child's medical record and fee
account, so it is not something anybody gets to claim for themselves.

### The door code

The **sign-in form** on each portal page sits behind a code, set from
**Settings → Door codes**: one for staff, a different one for families. Until
it is entered there is no sign-in box on the page at all, so a stranger who
finds the school's website never sees a field asking for a teacher's email
address.

The code guards the sign-in and nothing else. The rest of both pages stays
open, on purpose: a parent who has not been given the code yet still needs to
read how to get a sign-in, and a teacher who is new still needs the form that
asks HR for an account. Neither of those reaches a single record, and hiding
them only turned people towards the telephone.

It is a door code, not a password, and the portal says so on the screen:
everybody on one side of the school has the same one, so it proves nothing
about who is at the keyboard. **The password behind it is still the lock.**
What it buys is that the sign-in form is not on the open web, and that a code
can be changed the week somebody leaves.

- **Setting one.** Settings → Door codes has a **Suggest one** button beside
  each field: six digits drawn from `crypto.getRandomValues`, re-drawn if it
  lands on a run, a repeat, a year or a date. A code the school types itself
  is the year, or the telephone number, and then stays for six years.
- **It is shown once.** Because it is hashed the moment it is set, there is no
  screen anywhere that can tell you later what it is — so the one moment it
  can be read is the moment it is set, and it is put in front of you then,
  with a Copy button and who to give it to. Somebody who sets a code without
  writing it down has locked a door and dropped the key.
- Four to ten digits, hashed with scrypt, never readable back.
- Checked on an open endpoint that answers only *yes* or *no*, rate-limited to
  fifteen attempts an hour per address.
- Remembered for the browser tab, not the browser: close it and the school
  asks again.
- The address bar is not a way round it — the check runs when the page is
  drawn, not when the link is followed.
- Set no code and that door stays open, which is what a fresh install does.
  The Settings card says so in amber — and, because Settings is exactly the
  page somebody who has never heard of door codes does not open, the
  **dashboard** says so too, to anybody holding `settings.manage`, until both
  doors are shut.

### Keeping the password you were given

A password issued by the office used to be `mustChange: true` everywhere: the
portal stopped at a "choose your own" screen before it would open. It does not
any more. What the office hands you is yours to keep for as long as you like,
and yours to change whenever you want to, from **My access → Your password**
or **Your account → Your password**.

The forced change still exists, as the issuer's choice rather than the
software's rule — a checkbox on the issuing form, unticked by default:
*"Make them choose their own the first time they sign in."* It is worth
ticking when the password has been written down or passed through more hands
than it should have.

There is a real argument on the other side, and it is worth stating: a
password the office chose is a password the office knows, and until it is
replaced, "signed in as Miss Dube" means "somebody who has Miss Dube's
password". Per account, that is the school's call to make. The audit log
records who issued what, either way.

Defaults changed in all three backends: `DemoCredentials.set`,
`ServerBackend.issue`, `Store.demoIssue`, `auth.setPassword` call sites in
`server/routes.js`, and the five `must_change` inserts in
`supabase/schema.sql`, which gained a `p_must_change` argument on
`portal_set_password`, `portal_family_invite` and `portal_family_reset`.

### Forgotten passwords

Three separate things, often confused with the door code:

| Who | What they can do | Where |
|---|---|---|
| Any member of staff | Change their own password | **My access → Your password** |
| Any guardian | Change their own password | **Your account → Your password** |
| Head Teacher and above | Reset a colleague's password when they are locked out | **Staff → Reset sign-in** |
| Anyone with `portal.manage` | Reset a family's password | **Family portal → Reset** |

A reset issues a **one-time password**, shown once and never again, which the
person is made to replace the moment they sign in with it. Nobody — including
the Head Teacher — can read an existing password; it is stored hashed.

Who may reset whom is decided by tier, not by job title: `canIssueAccount()`
in `js/permissions.js` lets you reset an account at your own tier or below and
no higher. So a Head Teacher (tier 3) can reset a Deputy, HR, the Bursar, a
teacher or an assistant, and cannot touch the Director or the Board Secretary.
Nobody can reset their own account this way — that is what the change-password
form is for, and it asks for the current password first.

### The guide to the portal, and why it is not on the public page

**How to use the portal** is ten steps, one per screen, each with a line about
what it is for and a rendering of that screen. It plays itself through or can
be stepped around, and it is meant to be come back to rather than watched
once. It is built from the portal's own stylesheet rather than from
screenshots, which keeps it true as the interface changes.

It used to sit on the public staff page. That made it the most useful thing on
the site to somebody who does not work here: a labelled map of every page in
the system, what each one holds, who may see it, and what the sign-in box
looks like. It is written for people who already have an account, so it now
lives where they are — in the portal's own menu, under **How to use the
portal**.

Moving the panel would have been cosmetic on its own, because the text would
still have been sitting in a script the public page loads. So it is a separate
file that the application does not ship:

- `index.html` does not reference `js/guide.js`, and the service worker does
  not cache it. It is not in the source of the page a stranger can open.
- The portal fetches it after sign-in, with the session token on the request,
  and runs it from a blob — which is why it is fetched rather than pointed at
  with a `<script src>`, since a script tag cannot carry the header.
- `server/server.js` refuses `/js/guide.js` to anybody without a **staff**
  session, and answers `404` rather than `403` so the reply does not confirm
  the file exists. A guardian's token is not enough. Measured: `200` with a
  staff session, `404` without one, `404` with a bogus token.
- The menu entry uses `needs: "vGuide"`, so until the fetch lands there is no
  entry at all rather than a link to nothing.

**Know which of the two you have.** On the Node server, and on Supabase behind
the same application, that is a lock. Published as static files to GitHub
Pages there is nobody to check a token, so the file is merely unadvertised —
anybody who guesses the address can still read it. If the school needs it
genuinely closed, it needs a host that can run the check.

If the school would rather have a real screen capture than the written guide,
save it as `assets/tour.mp4`; note that the `<video>` element that used to
show it was on the public page and has gone with the rest, so it would need
adding to `vGuide()`.

## The public page

The public pages are set in the idiom of an independent-school prospectus: one
serif doing all the work — Georgia, which the school already uses — headlines
large and light with the leading pulled tight, square corners throughout,
hairline rules in place of most buttons, wide alternating bands of navy and
paper, and a great deal of air. The gold is almost entirely a hairline now: a
rule, a bracket, a number. Restraint is the whole effect.

`index.html` opens on the school's own page, not on a sign-in box. It covers
what a family would want to know before they telephone:

- **Our values** — the four the school stands on, each written out rather than
  left as a slogan.
- **How we work** — the practical arrangements a parent can check on an
  ordinary Tuesday: two adults in every lesson, subject specialists rather than
  one teacher for everything, registers every period, parents told the same
  day, progress described rather than ranked, records kept properly.
- **The school day** — drawn from the timetable the children actually follow,
  so the page cannot drift away from it.
- **What they learn** — the curriculum by stage, and the four words the school
  reports progress in.
- **Joining us** — the admissions steps in order, what to bring, and how fees
  work, with an enquiry form.

**The enquiry form is wired to admissions.** A family who fills it in becomes
an enquiry at the head of the admissions pipeline — the same list the office
already works from, with the same stages — rather than an email somebody has to
remember to re-type. It is open by necessity and rate-limited.

The staff portal sits at the bottom of the page, deliberately quieter than the
rest: a look at four of its screens, a sign-in card and a way to ask HR for an
account.

There is no public sign-up for staff accounts. A form that hands out accounts
to whoever fills it in has no business in front of children's records, so the
request goes to HR and the Head Teacher. They see it on the Staff page, approve
it, and only then does a staff record exist. Approving shows a temporary
password once, to be passed on in person or by telephone.

Signing in swaps the public page for the portal — still one `index.html`, still
one application.

### The site quotes the office, not this repository

Fees, intakes, places left, class names, the grading words and the school's
own contact details are the office's to change, and the website has to follow
— a family who arrives at a visit with a number in their head that nobody at
the school recognises has been misled by the website.

Signed in, the public pages read `Store.db`, which is the live school. Signed
out there is no `Store.db` at all, and until now they fell back to the
constants in `js/data.js`: the office could move an intake or change a fee and
the site would go on advertising the old one.

There is now one open read, `Store.loadPublic()`, fetched once per page load:

| Backend | Where it comes from |
|---|---|
| Demo | the same browser's own blob, narrowed |
| Node | `GET /api/public` — the only endpoint that needs no session |
| Supabase | `portal_public_facts()`, granted to `anon` |

All three project through the same function, `publicFacts()` in `js/data.js`,
which **names the fields it will publish** rather than excluding the ones it
will not — so a column added to a setting later does not become public by
accident. A class's `teacherId` and `assistantId` are staff identifiers and
are not in it; neither is the `gate` setting, in any form.

`App.pub(key, fallback)` resolves in that order: `Store.db` first, then
`Store.facts`, then the constant — which is a starting position, not an
answer, and so comes last.

Measured: with the office's ECD A intake moved from 16 places to 22 and the
development levy from $40 to $45, the public fees page showed 22 places and
$45, and the term totals moved with it.

### Changing the words

The prose lives in one object, `App.copy`, at the top of `js/landing.js`:
`intro`, `values` and `working`. The questions families ask live in `SITE_FAQ`
in `js/data.js`. Everything else across the site — the day, the subjects, the
grading words, the admissions steps, the class names, every fee figure and
every number of places left — is read from the school's own configuration, so
changing the timetable, the fees or the intakes in the portal changes the
public site with it.

The current wording was drafted from how the system is set up. **Read it before
it goes public** and put it in the school's own voice; it describes real
practice and should be signed off by the Head Teacher.

## One record, from enquiry to alumni

When a family first enquires, a record opens. It follows the child through application, documents, the settling-in visit, the offer, acceptance, enrolment, every register, every mark, every invoice and every message home, and on into the alumni register when they leave. Nothing is exported, re-keyed, or kept in a second spreadsheet.

- **Admissions** — a seven-stage pipeline (Enquiry → Application → Documents → Visit & baseline → Offer → Accepted → Enrolled) with a required-document checklist, places tracked against the intake, and where each family heard about the school. Enrolling an accepted applicant creates the pupil record, allocates the class, writes the timeline and raises the term's invoice in one action.
- **Gradebook & assessments** — assessments per class and subject, weighted Continuous 40% / Topic test 30% / End of term 30%, with a subject profile grid for the whole class and printable report cards built straight from the marks and the register. Marks can only be entered by the pair who teach that subject.
- **Fees & billing** — an invoice per pupil per term built from configurable fee items, three instalments, payments by EcoCash / bank / cash / Paynow, live arrears, collection by class, and one-click fee reminders to every guardian behind an instalment.
- **Guardian communication** — email and SMS from inside the record, template-driven with `{pupil}`, `{guardian}` and `{balance}` filled in automatically, every message logged against the pupil. Absence at morning registration triggers an automatic SMS.
- **The pupil record** — one page with tabs for Overview, Academic, Attendance, Fees, Communication and a full Timeline that merges admissions, marks, payments, messages and welfare into a single chronology.
- **Leavers & alumni** — destinations, years at the school and guardian contact, kept after the last register.
- **Configuration** — intakes and places, fee items and discount rules, the grading scale and the assessed subjects, all changed in the portal rather than in code.
- **Governance** — a Director and a Board Secretary tier above the Head Teacher: board meetings and resolutions, the statutory register with renewal dates, budget against actual, and capital projects. See below.
- **Integrations** — Drive, Gmail/Workspace, Google Calendar, Econet Bulk SMS, EcoCash, Paynow, Sheets export and a REST API. **Governance tier only.**
- **Audit & compliance** — every permission change, amended register, admission decision and payment with who and when, consent coverage, a five-document inspection export pack and the school's data-retention schedule.



## What it costs to run

Nothing. There is no licence, no per-pupil charge and no per-member-of-staff
charge, and every piece of it runs on a free tier:

| Piece | Where it runs | Cost |
|---|---|---|
| The site — landing page and portal | GitHub Pages, from this repository | free |
| Shared database, if you want accounts to see the same records | Supabase free tier | free |
| Self-hosted alternative | any machine the school already owns | free |
| Demo mode | the visitor's own browser | free |

The free Supabase tier gives 500 MB of database and 5 GB of traffic a month.
This school's whole record — 59 pupils, a term of registers, invoices, marks
and messages — is a few megabytes, so a primary school is nowhere near the
limits. One thing to know: a free project pauses after a week with no traffic
and takes a few seconds to wake. A school using it daily will never see that.

If the school would rather not depend on a hosted service at all, `server/`
runs the same portal from one Node process on a laptop or an office machine,
and costs nothing either.

**Deliberately not used:** anything with a trial that expires, a per-seat price,
or a card on file.

## Where the data lives

Until now every browser kept its own copy in `localStorage`, so two members of
staff never saw the same thing. There are now three ways to run the portal,
chosen in `js/config.js`:

| `backend` | What it means | Shared between accounts |
|---|---|---|
| `"demo"` | this browser only | no |
| `"server"` | the Node server in `server/` | yes |
| `"supabase"` | hosted Postgres | yes |
| `"auto"` *(default)* | use a server if one answers on this origin, then Supabase if configured, otherwise demo | — |

`auto` is why the published GitHub Pages site still works with no setup at all:
it finds no server, finds no Supabase project, and falls back to the demo.

**GitHub Pages serves files, not programs.** A site published from a branch
cannot run a database of its own, so sharing data between accounts means
pointing the page at one that runs somewhere else. `supabase/README.md` covers
that path — the site stays exactly as it is, published from `main`.
`server/README.md` covers running it on a machine the school controls instead.

### What "interactive" means here

With a shared backend, one person's change reaches everyone else's screen
without anybody refreshing. HR enrols an applicant; the class teacher's roll
grows by one and a quiet note says who did it. A teacher marks a register; the
Head Teacher's dashboard stops showing it as outstanding. The server keeps a
change feed and pushes each entry down a live connection; each browser then
re-reads what *it* is allowed to see, so no one is ever handed data over the
wire that their role would have hidden on screen.

### Permissions are enforced twice, on purpose

`js/permissions.js` is loaded by the browser *and* required by the server, so
roles and permissions have a single definition. The browser uses them to decide
what to draw. The server uses them to decide what is allowed — because anything
only the browser checks can be edited by whoever is sitting in front of it.

Three things the server will not take the browser's word for:

- **The fifteen-minute register.** Checked against the timetable and the clock,
  whichever way the request arrives.
- **Scope and medical detail.** A teacher is sent the pupils in the classes
  they teach; allergies and conditions are removed from the response entirely
  for anyone without *View medical & welfare*.
- **The governance tier.** *Integrations & API* and the statutory register
  follow the role and cannot be granted sideways, not even by the Director.

If a write is refused, the screen reverts to what the server confirmed and says
why, rather than leaving a convincing but false state on the page.

## Running it

No build step and no dependencies. Serve the folder over HTTP and open it in a browser:

```bash
node tools/serve.js 8765         # demo mode — this browser only
node server/server.js            # the full portal, shared, on :4000
```

`tools/serve.js` replaces `python3 -m http.server`, which had two faults here.
It reads the working directory at import time, inside the default for
`--directory`, so a stale or deleted cwd killed it before it parsed a single
argument — which is what happened the first time this folder was moved. And it
served everything with one cache policy, so a stale service worker kept handing
out an old shell after a change. `tools/serve.js` resolves its root from its own
location, and sends `index.html`, `sw.js` and the manifest `no-cache`, the same
way `server/server.js` does.

The Node server needs Node 22 or newer and installs nothing. On its first run
it creates the database and prints a **temporary password for each account,
once** — hand those over in person; everyone is asked to change theirs on first
sign-in.

**Demo mode has no default password and none is published.** The first visit to
`/#/staff` offers a setup panel instead of a sign-in form: choose a password for
the Head Teacher, and from there you set everybody else up the way the office
would. Passwords are hashed with PBKDF2 in the browser's own storage, so demo
mode needs a secure page — `localhost` or https — and says so plainly if it is
opened straight off the disk.

The school day runs **08:30 – 13:35**: registration at 08:30, six 40-minute periods, break at 10:05 and lunch at 11:45.

## Role tiers

| Tier | Role | Scope | Notes |
|---|---|---|---|
| 1 | **School Director** | Whole school | Everything the Head has **plus the governance tier**: board & minutes, statutory register, financial oversight, capital projects and Integrations |
| 2 | **Board Secretary** | Whole school | Identical access to the Director — the two hold the governance tier jointly |
| 3 | Head Teacher | Whole school | Runs the school: everything except the governance tier. **No Integrations** |
| 4 | Deputy Head | Whole school | Everything except Permissions, Settings and the governance tier |
| 5 | HR & Administration | Whole school | Staff, admissions, guardian communication, documents, announcements, **Permissions**, **sign-ins**, **family portal**, Configuration, Settings |
| 6 | Bursar / Office Admin | Whole school | **Fees & billing**, admissions, attendance, pupils, calendar, audit log, **sign-ins**, **family portal** |
| 7 | Class Teacher | Own class + classes taught | Take registers for their own lessons, enter marks for subjects they teach, message guardians, medical details, welfare log |
| 8 | Assistant Teacher | Own class + classes taught | Take registers alongside the main teacher, view marks and pupils, log incidents |

### The governance tier

The Head Teacher runs the school. The **School Director** and the **Board Secretary** answer for it — to the board, to the Ministry and to the bank — and they sign in through their own group at the top of the sign-in screen. Their access is identical to each other's and covers everything the Head has, plus a **Board & statutory** page with four tabs:

- **Board & minutes** — meetings, who was present, and a resolution register with proposer, seconder and outcome.
- **Statutory register** — registration certificate, council licence, insurance, tax clearance, fire safety, NSSA and data-protection registration, each with its renewal date. Anything expiring within 60 days is badged in the sidebar.
- **Financial oversight** — the 2026 budget against actual, payroll as a share of income, this term's collection rate, and the banking and signatory record. This sits above the Bursar's day-to-day invoicing.
- **Strategy & projects** — roll against the 96-pupil target, capital projects with budget and spend, and the four KPIs reported to the board.

**Integrations moved here.** Connecting Drive, mail, SMS and payment providers means signing contracts with outside suppliers, so `integrations.manage` and `governance.statutory` are **role-locked**: they follow the role and cannot be granted to the Head Teacher or anyone else, not even by the Director. The Head Teacher's sidebar no longer shows Integrations at all, and typing the address by hand gives a plain explanation rather than the page.

Nobody outside the governance tier can edit the Director or the Board Secretary in the Permissions portal, and only the governance tier or the Head can edit the Head.

The Director, Board Secretary, Head Teacher and HR hold `permissions.manage`. From the Permissions page they can grant or revoke any individual permission for a colleague, widen a teacher's class scope, or change a role. Overrides are shown with a gold ring and every change is written to the audit log. HR cannot edit the Head Teacher or the governance tier; nobody can edit their own access.

### Setting people up, and resetting them

Creating a sign-in and deciding what a role may do are two different powers, and
the office needs the first without the second. They are two permissions:

| Permission | Who holds it | What it does |
|---|---|---|
| `permissions.manage` | Director, Board Secretary, Head, HR | Grant or revoke individual permissions, change a role, widen class scope |
| `accounts.manage` | Director, Board Secretary, Head, Deputy, HR, **Bursar / Office Admin** | Create a colleague's account and issue a temporary password; reset one for somebody locked out |

So the Bursar can set a new class teacher up on Monday morning without being
able to change anybody's access — and HR can reset a forgotten password without
going anywhere near the Permissions page.

**The limit is the tier.** You may issue or reset an account at your own level
or below it, never above. The Bursar (tier 6) can set up class and assistant
teachers; HR (tier 5) can reach the Bursar as well; the Head (tier 3) can reach
everyone below; and the governance tier stays sealed to the governance tier.
Nobody can reset their own password this way — that is the "change my password"
form, which asks for the current one.

The list of roles in **Add staff member** only ever shows what the person
signing in may actually issue, and the same rule is applied again on the server,
so a hand-written request gets the same answer as the form.

### A temporary password is shown once

Creating an account, approving a request, or resetting a sign-in all end on the
same screen: the address, the password, and a plain warning that this is the
only time it will be readable. Passwords are stored as a scrypt hash, so nobody
— not HR, not the Head Teacher, not the Director — can look one up afterwards.
If it is lost, issue another.

Every temporary password is marked must-change: the portal will not open until
the holder has chosen their own, and the temporary one stops working the moment
they do.

### Choosing it, or generating it

The password field on every one of those forms arrives already filled with a
generated one — four words and two digits, around forty bits, picked to be read
aloud over a bad telephone line. **Type over it if you would rather choose.**
The office often has to say a password across a desk or down a line, and one
they picked is one they can say; `Generate` puts a fresh one in if they change
their mind.

Either way it is held to the same rules — eight characters, a letter and a
number, nothing that starts with an obvious guess — and either way it is
must-change. So an administrator can choose a password somebody uses *once*,
and nobody can choose a password somebody will keep.

The full permission catalogue and role defaults live in `js/permissions.js`.

## Accessibility

Audited against WCAG 2.1 AA by measuring the live page rather than reading the
markup, and corrected. What the pass found and what was done:

| Finding | Criterion | Fix |
|---|---|---|
| **All 12 enquiry fields had no programmatic label** — `<label class="field">` was never associated with its input, so each read as "edit text, blank" | 3.3.2, 1.3.1, 4.1.2 | `App.linkLabels()` runs after every render and fills the gap for any form in the app, including ones written later |
| **68 contrast failures**, clustered on four tokens rather than 68 mistakes | 1.4.3 | `--muted`, `--faint` and `--gold-600` re-based; pill text given local values |
| Menu button 36×30 — the only way into navigation on a phone | 2.5.5 | 44×44, and coarse-pointer minimums across buttons, fields and nav links |
| Modal did not move focus in, trap Tab, or give focus back | 2.4.3, 2.1.2 | Focus moves to the first field, Tab cycles inside, focus returns to where it came from on close |
| Dialogs had no accessible name | 4.1.2 | `aria-labelledby` on the title; the close button has a label |
| The scroll-driven day exposed nine stacked periods with no context | 1.3.1 | The list is named, so a screen reader — which gets all nine at once — knows what it is reading |
| No `main` landmark on any of the four shells | 1.3.1 | Added |

The colour tokens were measured against all three grounds the site puts text
on — white, the warm band `#f6f5f1`, and the page `#faf9f6` — because the old
values passed on white and failed on the bands. Two levels of de-emphasis are
kept so the hierarchy survives the correction:

| Token | Was | Worst ratio | Now | Worst ratio |
|---|---|---|---|---|
| `--muted` | `#6b7280` | 4.43 | `#5d6472` | 5.45 |
| `--faint` | `#9ca3af` | 2.41 | `#666d7b` | 4.60 |
| `--gold-600` | `#96772a` | 4.01 | `#876a1e` | 4.68 |

Verified after the fixes: **0 contrast failures, 0 unlabelled inputs**, focus
rings visible at 7.6:1, no horizontal scroll at 200% zoom.

**One criterion is deliberately not met.** There is no skip link, so there is
no way for a keyboard user to get past the header and in-page navigation —
that is 2.4.1 Bypass Blocks, a Level A criterion. It was built and then removed
at the school's request. The `main` landmark remains, which gives screen-reader
users a way through; a sighted keyboard-only user has none. If it is ever
wanted back, it is one anchor to `#content`, which is already there and already
focusable in every shell.

**Not tested here:** a real screen reader. The accessibility tree is correct as
measured, but VoiceOver and NVDA surface things no script catches. Worth an
hour on a real machine before this is relied on.

## The words on the public page

The copy was audited against the CRE conversion methodology. The writing was
already specific and concrete — the problems were at the top of the page and in
what was missing.

**The headline.** It now reads:

> **AIS — a place where excellence is built**
> Two adults in every lesson. A register at the start of each one. If your child
> is not where they should be at eleven o'clock, you hear from us at eleven
> o'clock — not at the end of term.

The headline is the school's, chosen to carry the brand: it echoes the tagline
on the letterhead, "Where Excellence Begins". It is a claim rather than a
proof, which puts the whole burden of specificity on the line beneath it — so
that line stays, and every clause in it is something the system genuinely does.
The register rule is enforced in `server/api.js` rather than only asserted here.

Two consequences worth knowing if it is ever changed again. The wordmark in the
bar is no longer hidden at the top of the page: a headline opening on initials
needs the name above it, or a first-time visitor has a crest and three letters
to decode. And the tagline stays hidden until the bar is scrolled, because
"Where Excellence Begins" directly above a headline about excellence being
built is the same word three times in one screen.

**The loudest button was pointing the wrong way.** On a page whose purpose is
parent enquiries, "Staff" was the solid primary button and "Enquire" was a
ghost. Reversed.

**Counter-objections moved to the point of friction.** What happens after you
send an enquiry, and what it commits you to, now sit beside the send button
rather than in prose further up. One of those assurances contradicted the step
list directly above it — "no payment at this stage" over a step reading "fee
paid" — and is now precise about when the application fee falls due.

### What they learn, and when

The enrichment curriculum on the public page is taken from the school's own
**Strategic Plan Vol 2 (current)** and lives in `js/data.js` as `ENRICHMENT`
and `SPECIALISTS`, not in the markup — so it can be corrected in one place.

The persuasive weight rests on a single true contrast, which needs no
embellishment: most schools sell Sign Language, digital literacy and creative
technology as after-school clubs, at extra cost, to whoever can stay late. The
plan puts all of them **inside mainstream lessons for every learner**:

> "Embed basic Sign Language vocabulary … into mainstream lessons for all
> learners" · "Implement play-based digital literacy and introductory
> AI/creative technology modules across all infant classrooms" · "Practice
> basic Sign Language during daily routines, assemblies, and greetings across
> all mainstream classes"

So each subject on the page carries **when it happens**, because when it
happens is the entire argument, and the section closes on the thing a parent is
actually working out: there is no set that gets the technology and another set
that gets the extra reading, and no invoice line for any of it.

`ENRICHMENT` is kept separate from `ASSESSED` deliberately. `ASSESSED` drives
the gradebook, and whether these subjects carry a mark is the school's decision
to make — move any of them across once it has been.

**Two things to check before this page is published.**

The Strategic Plan is a forward-looking document: much of it is written as
action steps for the strategic cycle rather than as a description of this
term. Everything on the page is phrased as what the school teaches, so **each
line needs confirming as already running** — a parent reading "timetabled
modules across all infant classrooms" will expect it in January, not next year.

And the specialist section is the highest-stakes copy on the site. A parent of
a child with a learning difference may choose this school on that paragraph, so
it states what happens — screening for everyone in their first term, in-class
support, weekly co-planning — and claims no outcome. It says in as many words
that screening is not a diagnosis and that no result is promised. Keep it that
way.

### Nobody has asked the visitors anything

The methodology's first instruction is *don't guess, discover*, and there is
nothing here to discover from: no analytics, no exit survey, no chat logs, no
support tickets. Every objection this page answers was inferred from the
domain, which is exactly what the method warns against.

So the enquiry form now carries one optional question — *"Is there anything
that would make you hesitate?"* — appended to the enquiry note on whichever
backend is running. It costs one field and it is the cheapest honest way to
start finding out what actually stops families, rather than what I assumed
stops them. **Read those answers before changing anything else on this page.**

### Proof the school has to go and get

Nothing on this page is vouched for by anybody but the school. These are real
assets that do not exist yet, in the order they are worth acquiring — and none
of them should be written until they are true:

| Asset | Why it matters | Where it would sit |
|---|---|---|
| Three named parent testimonials, with photographs | The single strongest form of proof, and the page has none | Beside the enquiry form and under the values |
| The Ministry registration number | `SCHOOL.regNo` is empty; a registered school should say so | Footer, and the joining section |
| How long the school has been open | Answers "are you going to be here next year" | Hero proof line or the footer |
| Actual class sizes | "Small classes" is a claim; "16 in ECD A" is proof | The answer section, beside places — set `capacity` on each class in `js/data.js` and the pages start quoting it; left `null`, they make no claim at all |
| Staff qualifications, in the aggregate | Answers "who will actually teach my child" | How we work |

Until they exist, the page leans on what it can genuinely show: the fees in
full, the real number of places left, and a mechanism a parent can check on any
ordinary Tuesday.

### The second audit: what a page has to do, and where

The first audit fixed the words. The second one found that the words were in
the wrong shape — one page trying to be a prospectus, a fee schedule, an
admissions policy and a contact form at once, so each of those was a paragraph
rather than an answer.

**The five-second test was failing, and the headline could not fix it.** A
parent arriving cold from a shared link met "AIS — a place where excellence is
built" and learned nothing: not where the school is, not what ages it takes,
not what kind of school it is. The headline is the school's own and stays. The
fact now sits above it, in one line — *Manningdale, Bulawayo · ECD A to Grade 2
· ages three to eight* — so the claim lands on somebody who already knows what
is being claimed about.

**The enquiry form was an application form.** Twelve fields, including the
child's date of birth and sex, before the office had so much as telephoned. It
now asks three things — which year, your name, one way of reaching you — and
everything else has moved behind a disclosure, optional, for the families who
would rather fill it in now. The child's name is no longer required at all;
when it is not given the applicant is filed under the family's surname and the
enquiry says so in as many words, so the office corrects it on the telephone
call it was always going to make. All three backends still validate as before;
the relaxation is in `App.landingEnquiry()` only.

**There was no way to make contact without filling something in.** The
telephone number was printed as text, on a site most parents read on a phone.
There is now a `tel:` link wherever the number appears, and a WhatsApp link
beside it — in this city WhatsApp is how first contact is actually made, and it
is the lowest-commitment action the site has. Both are derived from
`SCHOOL.phone`; change the number in one place and every link follows.

**The risk reversal was sitting in the data, unsaid.** `ADMISSION_STAGES` puts
the settling-in visit and the baseline observation *before* the offer. That is
the single most reassuring fact about this admissions process and it was
nowhere in the copy. It now closes every page: you see the school, and the
school sees your child, before either side commits, and nothing is paid to
enquire or to visit.

**Meals are compulsory, and the price says so.** They shipped as an optional
extra, which meant the headline figure was a figure under which some children
ate and some did not. The school's position is that no child goes through a
day here without eating, so `f_meals` is `compulsory: true` in all three
backends and the meal is inside every figure the site prints: a term is $535
in ECD and $585 in Grade 1 and 2. Transport is the one thing still priced
separately, and the fees page now says so in those words rather than
advertising a cheaper number than anyone pays.

**"We keep classes small" has gone.** It was the only sentence in the school's
own summary that a parent could not check and the school could not evidence —
no class size is recorded anywhere in the system. See `capacity` above.

**Twelve questions, answered plainly** (`SITE_FAQ` in `js/data.js`), including
the one an infant school has to answer and this one never did: *what happens
after Grade 2?* Every answer is grounded in something the system already does
or holds — the admission stages, the fee rules, the timetable, the grade scale,
the specialist posts. None of them claims an outcome.

**Two questions in that list the school must answer itself**, because nobody
else can: how many children are in a class, and which schools recent leavers
have gone on to. The second is referred to the office in the answer, which is
honest but weaker than naming them.

## The family & student portal

Each family gets one sign-in, whatever the number of children. It opens onto
their own children and nothing else.

| Page | What a family sees |
|---|---|
| **Home** | Each child: today's mark, attendance this term, how they are getting on, what is owed, and anything the school has sent |
| **Attendance** | Every mark this term — registration and each lesson, with the teacher's note — and the absences the family has reported |
| **Progress** | Each subject, its standard, and **every assessment behind that standard**: what it was, when, and what the child scored |
| **Fees** | The invoice, the instalments and their dates, every payment received, and what is overdue today |
| **Messages** | One thread with the school about that child, both directions, on the child's record |
| **School diary** | Term dates, what is coming up, the school day, and documents published to families |
| **Your account** | Telephone and relationship, the children on the sign-in, and the password |

### What a family may write

Three things, and each one writes exactly one record:

- **Report an absence.** It does *not* mark the register — only a teacher does
  that. It puts the reason in front of whoever takes it: it appears on the
  teacher's dashboard, on the attendance page, and as a pill beside the child's
  name in the register itself. A teacher marks it seen and the family can see
  that too.
- **Message the school.** It lands in the child's communication log alongside
  everything the school has sent, attributed to the guardian and marked as
  coming from the portal, so one thread holds both halves of the conversation.
- **Correct their own telephone number and relationship.** The name on the
  account and the children it reaches are the school's to change, not theirs.

### Messages actually arrive

The two sides are one thread, and the plumbing is the same in both directions.

**School to family.** Alongside email and SMS there is now a **Family portal**
channel, because a family with a portal sign-in often has no working email
address and a phone number that changes. A message sent to it lands on the
child's record, which is where the family reads it. Sending to a class or to
the whole school reaches every family's portal as a notice.

**Family to school.** A message or an absence note appears on the class
teacher's dashboard and attendance page the same morning, with an unread badge
on **Guardians**. Opening it stamps it read — and the family can see that it
was opened, and by whom, rather than only that it sent.

**Unread is per person** on both sides, like every other read receipt here: one
colleague opening a message does not clear it off everybody else's screen, and
a family's thread is marked read when they open it, not when the page loads.

**Live.** On the Node server, changes arrive over the same event stream the
staff portal uses, so a message sent from the office appears on a parent's
phone without a refresh. The notice a family sees says what it means — "The
school has sent you something" — rather than naming a collection.

**In demo mode it still connects.** A published static site has no server, so
the live feed there is the browser's own `storage` event: write in one tab and
every other tab hears it. The session lives in `sessionStorage` rather than
`localStorage`, which is what lets one browser hold a teacher in one tab and a
parent in another — so the demo can actually show a message crossing from one
side to the other, rather than describing it. (On a real server the session
stays in `localStorage`, so closing the laptop does not mean signing in again.)

### Where you were

A refresh puts you back on the page you were reading, with the class you had
chosen, the term you were looking at and the place on the page you had scrolled
to — and with the data as it is now, not as it was.

The address bar carries the page, so a link somebody sends still wins. Everything
underneath it — which class, which subject, which tab, which search — is kept
per account, so two people sharing a laptop do not inherit each other's place.
Only navigation is stored: never a draft, never a record. Signing out forgets it.

### How the isolation works

A guardian's session never goes through the staff read at all. `api.state()`
starts from the whole school and removes what the person may not see; the family
read (`js/family.js`) starts from a named list of pupil ids and adds nothing
else. There is no query a signed-in parent can make that reaches another
family's child, because the school is never assembled in the first place.

On the server, a family token is diverted before it reaches any staff endpoint:

```
POST /api/portal/absence     tell the school a child will be away
POST /api/portal/message     write to the school about a child
POST /api/portal/details     correct your own telephone number
GET  /api/portal/state       your own children, and nothing else
POST /api/auth/password      change your own password
GET  /api/stream             the live feed (collection and id only)
```

Everything else answers *"The family portal does not reach that part of the
school."* Family accounts share the staff credential store, so the same scrypt
hashing, the same lockout after repeated failures, the same per-address
throttle and the same timing-safe answer protect both.

### Giving a family a sign-in

From **Family portal** in the sidebar, or from the Family portal card on a
pupil's own record. It reads the guardian already on the record — name,
relationship, email, telephone — so the office is not asked to type what the
school already holds, and it issues a temporary password on the screen that
follows. A family with two children here gets one account: inviting the second
child adds them to the existing sign-in rather than making another.

Needs `portal.manage`, which the Bursar and HR hold along with the Deputy, the
Head and the governance tier. A class teacher holds `portal.messages` — they
read and answer what families send, but do not hand out accounts.

Demo mode issues real ones too: the browser keeps a PBKDF2 hash per account,
with the same must-change, the same six-attempt lockout and the same
same-answer-either-way sign-in as the server. It is not a security boundary —
anything in a browser's own storage belongs to whoever has the browser — it is
there so the demo shows the actual workflow rather than a password everybody
already knows.

### On Supabase

`supabase/schema.sql` now carries the whole thing: guardian sign-in, the
child-scoped read, the three family writes, the office's invite and reset, and
both door codes. The isolation is the same shape as the Node server's —
`portal_family_state()` starts from the account's own `pupilIds` and adds
nothing else — and a guardian's token resolves to nothing in
`portal_require_staff()`, so it cannot reach a staff function by being passed
to one.

Two details worth knowing if you deploy it:

- **Only 22 functions are callable from a browser.** Postgres grants EXECUTE
  to PUBLIC on every function it creates and `anon` inherits PUBLIC, so the
  schema revokes that wholesale before granting the list back. The other 21 —
  session resolution, permission checks, the family-state helpers — are
  internal, and a check in the repository asserts every function is explicitly
  either granted or revoked.
- **The family portal is assembled in SQL**, so the handful of constants
  `js/family.js` reads out of `js/data.js` — the school day, the weekday names,
  which subjects carry a mark, how the kinds of assessment are weighted — are
  written into `settings` by `tools/build_sql.js` from that same source. The
  role tiers go in too, because the tier is what stops an account being issued
  upwards and that rule belongs in the database rather than only in the
  interface.

**What I could not do is run it.** There is no Postgres on this machine and no
Supabase project to point at, so none of this SQL has executed. What I did
instead, and what it is worth:

| Check | What it proves |
|---|---|
| `pglast` (libpg_query — PostgreSQL's own parser) over the whole file | 43 functions parse, both as SQL and as PL/pgSQL bodies |
| `node tools/check_sql.js` | every `portal_*` called is defined; every function is explicitly granted (22) or revoked (21) so none is reachable by having been forgotten; all 22 RPC call sites in `js/api.js` send argument names the SQL declares |

Syntax, references and the call interface are verified. **Semantics are not** —
a column misnamed inside a query, a join that returns the wrong row count, a
`jsonb` shape that differs by a key from what the portal expects, would all
survive every check above. Run `schema.sql` then `seed.sql` against a scratch
project and sign in once as a guardian before trusting it with a real school.

## The two portals, audited

A design-system pass over the staff portal and the family portal — thirty-six
views across four files.

**What was already right.** One component vocabulary, used consistently:
`card` with `card-head`/`card-body`/`card-foot`, `btn` with `ghost`/`sm`/`xs`,
`input`/`field`, `pill`, `stat`, `notice`, `empty`, `table-wrap`. Thirty of
thirty-six views carry an explicit empty state. Both portals share one shell,
one sidebar, one drawer and one thumb-reachable tab bar. Two hardcoded hex
values in eleven thousand lines.

**Four things it changed.**

*The topbar action never changed.* "Mark register" read the same at ten past
three with all six taken as it did at half past eight with one open, so the
question it existed to answer — is there a register waiting for me — went on
being answered by going and looking. It answers now: it names the open period
and the minute it locks and goes straight to that register, says how many were
missed, or says all are taken and goes quiet.

*Teachers were being badged for work they cannot do.* A class teacher may
look at the admissions list but cannot move anybody through it, and was the
only role seeing a red 4 beside it every morning. A badge is a call to action,
so it now needs the permission to answer it — `badgeNeeds` on the nav item.

*Status was a colour, not a state.* Sixty-eight `style="color:var(--red)"` and
friends, several of them conditional expressions writing a token out twice,
and eight destructive buttons each hand-coloured where they stood. They are
`t-good`, `t-bad`, `t-warn` and `.btn.danger` now — the meaning in the markup,
and one place to change if the school ever wants a different red, or a pattern
for people who cannot see red. All seven state colours measured against their
own backgrounds: 5.04 to 6.02, all passing.

*Replies started again from nothing.* A message from the family portal could
be read on the staff side, and the only way to answer was "New message": a
blank compose defaulting to Email — so a reply to something written in the
portal went out by a channel the parent was not watching, with no subject and
no sign of what it answered. **Reply** now sits beside every incoming message
on the dashboard, in Guardians and on the pupil's record; it fixes the channel
to the one it arrived on, carries the subject across, and puts what the family
wrote above the box.

### Messages are threads

`threadId` is the id of whichever message began an exchange, carried by every
reply to it. A message that starts one is its own thread, so there is no such
thing as a message outside a thread and grouping never special-cases the
first. Anything written before threads existed has no `threadId` and falls
back to its own id — a thread of one, which is exactly what it was.

Guardians and the pupil's Communication tab read as an inbox: one row per
exchange, the subject once, the latest line showing, the whole of it when you
open it, oldest first, the family's messages marked apart from the school's. A
gold edge and **Awaiting a reply** mark the threads where the family spoke
last and nobody has answered — the only rows on the page asking for anything.

Verified end to end: a parent writes, the thread appears awaiting a reply, the
office replies from the dashboard, the header becomes "2 messages" and stops
asking, and the parent sees the answer in their own thread with the read
receipt on what they wrote.

## The heuristic pass

Krug and Nielsen, against all three: the public site, the staff portal and the
family portal. **6.6 → 9.2 out of 10.** The public site and the family portal
came through nearly clean — the two severity-3 findings were both in the staff
portal, and both were about what happens *after* somebody acts.

### Undo, instead of "are you sure?"

Fifteen destructive actions were guarded by the browser's own `confirm()`.
People click through those without reading them, which is the whole finding
behind *undo beats are-you-sure*: a dialog nobody reads is not a safeguard,
it is a speed bump with a false sense of security. And once past it there was
no way back at all — no undo anywhere in the system.

A toast can carry an action now. Withdraw a pupil, remove a document, delete
an assessment and its marks, close a family's account: it happens, it says so,
and **Undo** sits there for nine seconds — longer if you hover or tab to it,
because that means somebody is deciding. Both the action and the undo are
audited.

Closing a family account needed somewhere for undo to go, so
`reopenFamily` / `portal_family_reopen` exist on both shared backends. The
password was never deleted, only refused, so reopening restores the sign-in
the family already had — previously a mis-click meant issuing a whole new one.

Four actions keep a confirmation, because undo cannot reach them: approving an
account, loading or resetting the demo, and removing a door code that cannot
be read back. Those are in the interface now rather than in a browser dialog —
same typography, Tab trapped, focus returned, room to say what will actually
happen, and a named button instead of "OK".

### Finding a child from wherever you are

Every search box searched one page, so looking a child up meant first knowing
that children live under Pupils rather than under Attendance or Guardians —
a page of navigation before you can start typing, for the most common thing
anybody does here.

One box, top right, on every page, with `/` to jump to it. It searches pupils,
colleagues, classes and pages, says which kind each result is, and **only ever
returns what that person can already open** — a shortcut to their own pages,
never a way around a permission. It shrinks to its icon on a phone rather than
disappearing, because a teacher at the classroom door with a parent in front
of them is exactly who needs it.

### What was already right

The public site passes the Trunk Test on every page: name, page title, "you
are here" in the nav, and the same header everywhere. Sign-in errors say the
same thing whether or not the account exists. Both portals label every icon.
Thirty of thirty-six views have an explicit empty state. No dark patterns: no
confirmshaming, no hidden costs — the fees are printed before anyone asks.

### Still open

Inline validation is on submit, not on blur. There is no bulk action anywhere
(marking twelve documents, messaging six families) — fine at this size, worth
revisiting at three hundred pupils. And none of this has been watched over a
real person's shoulder, which is the part no audit substitutes for: three
people, thirty minutes each, is the whole method.

## What a school four times the size showed

*The generator described here has since been deleted along with the rest of
the demo data. The findings stand, and one of them is still in the product,
so the measurement is kept.*

The demo used to ship at a real infant school's size — four classes, 59
children, 14 staff. Everything looks fine at that size, which is the problem
with judging an interface by it: a list of fourteen needs no search, no
filter and no way of doing something to several rows at once, so the absence
of all three is invisible.

So it was run once at **500 children, 250 staff, 20 classes** — 26,950
registers, 3.4MB. Not a plausible infant school; a load, for finding out which
screens stop being usable.

### What it showed

Rendering was never the problem — every screen draws in 60–95ms at either
size. **Length** is the problem:

| Screen | Rows | Page height |
|---|---|---|
| Fees & billing | 535 | 32,500px |
| Pupils | 500 | 31,400px |
| Family portal | 410 | 29,600px |
| Permissions | 250 staff | 21,300px |
| Staff | 250 | 16,300px |

Thirty screens of scrolling, and on the Family portal page **204 "Give them a
sign-in" buttons, each opening a modal with a password shown once that
somebody has to write down before closing it.** That is not a task anybody
finishes.

### The bulk action the numbers justified

One at a time is right for one at a time: a child arrives in March and the
office gives their family a sign-in. It is the wrong shape entirely for
getting a whole school online at the start of a year.

**Invite all** does it in one pass. One account per family — siblings share a
sign-in, which is what the portal promises — and the passwords come back as a
table to print or take away as a CSV, because a password shown once has to
leave the screen somehow and a hundred of them leave on paper. A guardian with
no email is skipped rather than guessed at (the email *is* the sign-in) and
named, so the office knows whose record to go and complete.

Measured on the large school: **123 accounts covering 173 children in one
pass**, 204 skipped and listed, and a bulk-created sign-in opens the portal
showing both of that family's children.

### Bulk actions still worth having, and not built

`bill-chase` messages every account in arrears — at 84 accounts you want to
pick the worst thirty. Permissions grants one person at a time; "every teacher
gets this" is a real job. Neither is as expensive as the invite was, and
neither is worth guessing at before somebody has been watched doing it.

## Installing it

Once somebody has signed in, both portals offer to put the app on the device.
That is the moment to ask: they now know what it is, and what installing saves
them is exactly the journey they have just made — website, portal page, door
code, sign-in. Installed, it opens on the sign-in.

Asked once, dismissed for good, and still there afterwards under **My access**
or **Your account**, because a banner you dismissed should not need a browser
reinstall to get back.

## Modules

- **Dashboard** — teaching staff see **My registers today**: every period they are responsible for, in time order, with the one that is open now highlighted. Office and leadership staff see morning registration by class instead, plus how many lesson registers each class has missed. Both get announcements, upcoming events and pupils below 90%.
- **Attendance** — registers follow the timetable. Every class has a register for **morning registration (08:30)** and for **each of the six lessons**, taken by whichever pair is teaching that period. A strip of period chips across the top shows the state of each one — taken, open now, missed, upcoming. A register can be taken for **15 minutes** from the moment its period starts and then locks; only holders of "Amend locked registers" (Head, Deputy, HR) can change it afterwards, and every amendment is written to the audit log. Lesson registers flag pupils who were already absent at morning registration. Also: 10-day heat strip and CSV export per period.
- **Pupils** — profiles, guardian and emergency contacts, medical details (restricted), enrol / edit / withdraw.
- **Staff** — directory and class allocation; HR and Head can add staff and change roles.
- **Messages** — announcements (Head and HR only), team channels with membership, direct messages, unread counts.
- **Documents** — library by category with per-role audiences. Fourteen working documents ship with the portal (see below); more can be linked from Google Drive, and with a Google OAuth Client ID set in Settings staff can browse Drive from inside the portal.
- **Timetable** — two views. **My week** shows the person's own week: which class they are with each period, which periods are free, and a click on any period opens that register. **By class** shows a class's full week with the pair who teach each subject. The school runs on **four subject teams** (Language & Literacy, Numeracy & Science, Heritage & Languages, Arts/PE & ICT), each a main teacher plus an assistant. A class meets the **same pair every time it has a given subject**, and the pairs rotate between classes through the day, so nobody is ever double-booked. Head, Deputy and HR can change a period; saving is refused if it would put a pair in two classes at once or give a subject a second pair.
- **Recruitment** — vacancies and a candidate pipeline (Applied → Shortlisted → Interview → Demo lesson → References & checks → Offer → Appointed) with interview scoring against seven criteria, reference and police-clearance tracking, and the 11-step interview process alongside. Visible to Head, Deputy and HR; Head and HR can run it.
- **Calendar** — month view and upcoming list; leadership can add events.
- **Welfare** — incident and welfare log with severity and status. Log-only roles see only their own entries.
- **Reports** — attendance by class, 10-day trend, pupils below 90%, frequent lates, CSV summary.
- **Board & statutory** — the governance tier described above. Director and Board Secretary only.
- **Settings** — school profile, term dates, the register window (15 minutes by default), Drive integration, backup and reset.

## Documents included

Generated by `tools/build_documents.py` into `assets/documents/` with the letterhead branding (run it again after editing the script; needs `python-docx` and `openpyxl`). Policies & Procedures are left as Drive links for the school to supply.

| Category | Document | Format |
|---|---|---|
| Templates & Branding | Official letterhead · Letter to Parents template · End-of-Term Progress Report Card | PDF · Word · Word |
| Curriculum & Planning | ECD A and ECD B Schemes of Work, Term 3 2026 (13 weeks) · Grade 1 Weekly Lesson Plan template (with a completed example week) · Grade 2 Reading Assessment Rubric with class record sheet | Excel · Word · Word |
| Pupil Records | Application for Admission form · Photo & Trip Consent Register (all 59 pupils, drop-downs and per-class summary) | Word · Excel |
| HR & Staff | Contract of Employment template · Staff Certificates & CPD Record (expiry status and CPD log) · Staff Appraisal Form 2026 · Teacher Recruitment & Interview Pack (process, shortlisting criteria, questions, scoring sheet, demo-lesson observation, reference check) | Word · Excel · Word · Word |
| Finance | Term 3 2026 Fee Schedule (inputs, discounts, instalments, expected income) · Budget vs Actual 2026 | Excel · Excel |

Figures in the finance and CPD workbooks are placeholders marked as such inside each file; blue cells are inputs and everything else is a formula.

## Google Drive

Pasting a Drive, Docs, Sheets, Slides or Forms share link works with no setup. To browse Drive inside the portal: create an OAuth 2.0 Client ID (Web application) in Google Cloud Console, add the portal's address as an authorised JavaScript origin, enable the Google Drive API, and paste the Client ID under Settings → Google Drive integration.


## Publishing to GitHub Pages

The portal is plain HTML, CSS and JavaScript with no build step and no server, so the repository can be published exactly as it stands. All paths are relative, so it works just as well at `user.github.io/repo/` as at the root of a domain, and routing is done with `#/` fragments, which need no server rewrite rules.

**Push the repository**

```bash
git remote add origin https://github.com/<your-account>/<your-repo>.git
git push -u origin main
```

**Turn on Pages**

In the repository, go to **Settings → Pages → Build and deployment** and set the source to **GitHub Actions**. The included workflow (`.github/workflows/pages.yml`) then publishes on every push to `main`, usually within a minute. The URL appears in the Actions run and under Settings → Pages.

Alternatively, set the source to **Deploy from a branch** → `main` → `/ (root)` and delete the workflow; `.nojekyll` makes that work too.

**After the first deploy**

1. The site is set to `noindex` — a staff portal holding pupil records has no business in search results. Remove the `<meta name="robots">` line from `index.html` if the school wants it indexed.
2. To browse Google Drive from inside the portal, add the Pages URL (`https://<account>.github.io`) as an authorised JavaScript origin on your OAuth client, then paste the client ID under **Integrations**. Pasted Drive share links work with no setup at all.
3. Data still lives in each browser's `localStorage`, so every visitor sees their own copy of the demo and nothing is shared between devices. See **Going live** below for what a real deployment needs.

**A caution before publishing.** The demo seed contains 59 invented pupils with invented guardians, addresses and medical notes, and the site will be publicly reachable. Keep it that way while the school evaluates the portal — do not load real pupil data into a Pages site, because Pages has no access control of any kind. Real data needs the backend and sign-in described under Going live, on hosting the school controls.

## Going live

This version stores all data in the browser (`localStorage`) so it can be tried without a server. Before real use it needs:

1. ~~A backend database and API~~ — done: `server/` or `supabase/`.
2. Single sign-on, ideally Google Workspace, so staff use the account they
   already have. Email and password with scrypt hashing, lockouts and revocable
   sessions is sound for a staff room, but SSO removes a password to forget.
3. Hosting the school controls, with access restricted to staff. GitHub Pages is fine for showing the portal to the board; it is not somewhere to put real pupil records, because anyone with the link can read them.

## Files

```
index.html            the portal — the only entry point
manifest.webmanifest  what makes it installable on a phone
sw.js                 caches the app shell so it opens with no signal
js/landing.js         the public router, the front page, and the two portal pages
js/guide.js           the written guide to the portal — fetched after sign-in, never shipped
js/site.js            the shell the public site shares, and the six inside pages
js/config.js          which backend to use
js/api.js             the three backends, behind one interface
server/               Node backend: SQLite, sessions, permissions, live stream
supabase/schema.sql   the same design in Postgres — staff portal, family portal and door codes
supabase/seed.sql     generated from js/permissions.js and js/data.js by tools/build_sql.js
.nojekyll             tells GitHub Pages to serve the files as they are
.github/workflows/    GitHub Pages deployment
css/styles.css        brand tokens and all styling
js/permissions.js     roles, permission catalogue, access checks
js/credentials.js     password rules and generator (shared with the server), and demo mode's credential store
js/data.js            demo seed data (staff, classes, pupils, attendance, documents…)
js/store.js           persistence, session, formatting helpers
js/drive.js           Google Drive integration
js/app.js             router, shell, dashboard, attendance, timetable, pupils, staff, messages, documents, calendar, welfare, reports, recruitment, permissions, settings
js/sis.js             admissions, gradebook, billing, guardian communication, alumni, the pupil record, configuration, integrations, audit
js/governance.js      the Director and Board Secretary's tier: board & minutes, statutory register, financial oversight, capital projects
js/family.js          what a guardian may see, built once and used by both the server and demo mode
js/portal.js          the family & student portal, and the office's side of it
assets/logo.png       school crest (extracted from the letterhead)
assets/banner.jpg     the school banner used on the public page
assets/templates/     official letterhead PDF
assets/documents/     generated Word and Excel documents
tools/                static preview server, document generator, SQL seed builder and checker, password reset
```
