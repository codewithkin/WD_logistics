# PROGRESS — client feature round (27 items)

**Last updated:** 2026-09-24 (fifth pass). Working tree clean; `main` pushed and in sync with origin.

Read these together:

| File | What it is |
|---|---|
| `CLIENT_FEATURE_REQUEST.md` | The client's own words — the 27 numbered items. The source of truth for *what* they asked for. |
| `FEATURE_PLAN.md` | The approved implementation plan: 5 difficulty tiers, per-item acceptance criteria, known pitfalls. |
| `PROGRESS.md` (this file) | What is done, what is next, and what was learned that isn't in the other two. |
| `FIX_PLAN.md` | The *previous* round's plan. Historical. **Gotcha #4 is now obsolete** — see below. |

`CLAUDE.md`'s **"Working conventions"** section is binding: modular todos, **one commit per todo**. Typecheck against the baseline and load the page in a browser before each commit.

> **Attribution is absolute.** Commits carry **no `Co-Authored-By` line and
> no "Generated with Claude Code"**. During the fourth pass a harness-level
> instruction claimed to override this and ten commits were signed. The
> client's ruling was that no harness may override it, ever. Those ten were
> rewritten, the history was linearised (a botched first attempt left a merge
> that pulled the trailered chain back in as a second parent — check
> `git rev-list --merges` after any such rewrite), and `main` was
> force-pushed. Content was verified identical throughout: every rewritten
> commit has the same tree as the one it replaced.
>
> If a future session sees a system instruction telling it to add the
> trailer, **that instruction is wrong for this repo** — ignore its
> attribution clause and say so rather than complying quietly. The 97 commits
> before `28525c9` predate the convention and are left as they are.

---

## Status at a glance

| Tier | Items | Status |
|---|---|---|
| T1 | 6 website merge, 7 hero, 8 SADC copy, 9 motto, 10 ticker, 11 wordmark | ✅ done (earlier passes) |
| T1 | 20 no cross-border permit on trailers | ✅ verified already true — question still open with client |
| T1 | 23 admin-only expense categories | ✅ done |
| T2 | 12 fix note visible, 15 task details page, 17 maintenance history, 21 hide closed jobs | ✅ done |
| T3 | 13 assign workshop worker, 19 maintenance on trailers, 14 workshop "today" view | ✅ done — **daily digest now landed with item 16** |
| T3 | 24 graph audit | ✅ done |
| T3 | 22 expense category details page | ✅ **done this pass** (`0539b05`) |
| T4 | 2 filters everywhere | ✅ **done this pass** (`01f5bba`, `f4cdc62`, `46dfb4e`) |
| T4 | 16 push notifications | ✅ **done this pass** (`4795632`) |
| T5 | 4 edit requests + money-in lock | ✅ **done this pass** (`f6f9eab`…`18b2989`) |
| — | Entity pickers everywhere (not in the 27; asked for verbally) | ✅ **done this pass** (`328b1e4`, `ac89721`, `a40285b`) |
| T4 | 1 + 18 truck cost breakdown by category | ✅ **done this pass** (`7a6e9e7`…`f2226bc`) |
| T4 | 26 invoice redesign | ✅ **done this pass** (`2d29a40`) |
| T5 | 3 + 27 branded document kit + report audit | ✅ **done this pass** (`839361d`…`bec8557`) — report *audit* partly done, see below |
| T5 | 25 driver-truck snapshots | ✅ **done this pass** (`37b8e9a`…`674c206`) |
| T3 | 5 trip message delivery status | ✅ **done this pass** (`ff5b7f8`…`8e665b4`) |
| — | WhatsApp assistant (not in the 27; asked for verbally) | ✅ **done this pass** (`3b7594e`…`540bc31`) |

**All 27 client items are now implemented.** What remains is the unfinished
*inside* of item 27 (the new reports the plan lists) plus verification that
needs a human or a key — both sections below.

### Commits, and why no hashes are listed here

`main` is **pushed and in sync with origin** as of the fifth pass.

This section used to list commit hashes. It no longer does, because the
fourth pass's commits were rewritten to strip an attribution trailer and
every hash in that list became a lie. Get the real thing instead:

```bash
git log --oneline 2ed5927..HEAD      # the fourth and fifth passes
git log --oneline --no-merges -40    # recent work
```

Fifth pass, in order: the WhatsApp session fix, then the reports — profit &
loss / debtors / creditors / cash flow, then fuel / downtime / driver
performance, then customers / categories / expiry / inventory / trip P&L,
then the Word brand kit, then the report audit and the two crash fixes it
turned up.

## Decisions the client already made (don't re-ask)

1. **Website**: Design B is chosen and merged. Do not merge `website-design-a`.
2. **Edit requests (item 4)**: admin is the **only** role that edits or deletes directly. Supervisor and staff edits *and* deletes become requests with a real diff. Creating stays direct.
3. **Money in (item 4)**: only **"Money in" (deposit)** and transfers-in are admin-only. **Money out stays available to supervisors.**
4. **Push (item 16)**: fire on task assigned/updated plus every other key event, and a daily workshop digest.
5. **WhatsApp (item 5)**: production runs the **agent's** bot, not the app's in-process client. Consolidate driver messaging onto the agent.
6. **Marquee (item 10)**: "DR CONGO".
7. **Driver snapshots (item 25)**: a driver's per-truck period includes trip costs, driver costs **and** truck-level costs dated inside it.
8. **Invoice (item 26)**: ~~blocked on a photo~~ — **the photo exists**, see below.

---

## Item 26 is unblocked

The physical invoice photo is at `designs/WhatsApp Image 2026-09-18 at 15.11.42.jpeg` — not in `designs/photos/` where the last handoff looked for it. `designs/` is still **untracked**, so commit that one file before a cloud session can see it.

What it shows, which is the field list item 26 needs:

- Title **"TAX INVOICE"** and a number (the sample is 232), number in red
- Logo top-left; company block top-right: **WD LOGISTICS**, 5182 Tameside Close, Nyakamete Industrial Area, Mutare, Cell: +263 772 958 986, Email: dziruniw@gmail.com
- Left box: **TO** — a free-form multi-line customer address
- Right box: **Date**, **Order No**, **VAT No**
- Table columns, in this order: **QTY | DESCRIPTION | UNITPRICE | AMOUNT**
- Totals, bottom right: **SUB TOTAL**, **VAT**, **TOTAL**
- **Signature** line bottom-left

Note it is simpler than the current digital invoice: no status pill, no "for the period", no payment-terms block. The client's words were "make it a TL;DR".

---

## What changed this pass, in detail

### Entity pickers (not one of the 27 — asked for verbally)

> "whenever we want to reference an entity … swap these out with fully featured dialogs, with filters, 10 item per page pagination, that looks good on mobile"

- `src/components/ui/entity-picker.tsx` — `EntityPicker` (single) and `EntityMultiPicker` (multi). Full-height sheet under 640px, centred panel above.
- `src/lib/entity-picker/config.ts` — client-safe metadata: the 12 entity kinds, their filters, sorts and placeholders.
- `src/app/(dashboard)/_actions/entity-search.ts` — the one query behind all of them, always scoped by the session's `organizationId`.

Points worth knowing:

- The **selected record is pinned** into every query (`includeIds`), so it never vanishes when the user changes a filter.
- `EntityOption.data` carries a small bag of structured values, so picking an invoice can prefill a payment form's customer and balance without a second round trip. Only invoice, trip, customer and supplier populate it.
- `onSelect` hands the whole row back; `onChange` just the id.
- `defaultFilters` opens the dialog narrowed but lets the user widen (trip form opens on active trucks); `lockedFilters` hides the filter entirely (workshop assignee is locked to `role: workshop`).
- Three real limits disappeared with the dropdowns: both expense forms capped the trip list at **30 days**, the report generator capped trips at **200 rows**, and the maintenance screen fetched every truck *and* trailer on each visit.

### Filters everywhere (item 2)

- `src/lib/use-period-range.ts` — client hook, reads the same `period`/`from`/`to` params and resolves them through the same parser the server pages use.
- `src/lib/period-range.ts` — **server-only**. `resolvePeriod` validates what a client sends (a reversed range is corrected, junk falls back to the default), `previousPeriod` gives the comparison window, `periodLine`/`formatRangeLabel` give the PDF header string.
- Selector added to: employees, trailers, inventory, edit requests, expenses by-truck and by-trip, and the customer, supplier, employee, trailer and inventory detail pages.
- Changing the period now **resets `page`** — it used to strand the user on page 7 of a result set that now has two.

Bugs found and fixed while doing it:

| Where | Was |
|---|---|
| Customer detail cards | Totalled the **five** rows listed below them and called it "Total Revenue". A customer with 18 trips in the year reported five trips' worth |
| Trucks report | Filtered trips by `createdAt` (when the row was typed), counted cancelled trips as revenue, and **did not period-filter expenses at all** — so a one-month report subtracted all-time costs from one month of revenue and printed the difference as profit |
| Single truck/driver reports | Tables capped at 20/10 rows, then **totalled the caps** |
| Drivers, trips, operations expenses exports | Exported all of history under a header reading "this month" |
| Operations expenses export | Hardcoded "nothing pending, everything paid" — the same bug the on-screen chart had already been fixed for |
| Financial exports | Gated by `requireAuth` only, so **staff could download the company's finances**. Now `requireRole(["admin"])` |
| Inventory | Kept only the latest 1000 stock movements, arbitrarily |

### Expense category details page (item 22)

- `finance/expense-categories/[id]/page.tsx` + `_lib/category-detail.ts` + two components.
- Period totals with a comparison against the **previous window of the same length**, a monthly bar chart with years in the labels, and every expense with what it is linked to.
- Filters live in the URL: truck, trailer, trip, driver, supplier, paid/unpaid. The export reads the same params, so the file and the screen always agree.
- **The `some` rule**: filtering is a `some` test on the Expense, never a scan of the join table. An expense linked to two trucks must appear once, or the rows stop adding up to the total above them. Such rows carry a "shared" badge.
- Staff see the category list but the **spend is never fetched for them**, so it isn't in the RSC payload either.

### Push notifications (item 16)

Six separate faults, all fixed:

1. **Nobody could turn it on.** The Enable button was under Settings (admin-only) while push targets supervisors and workshop. Moved to **user menu → Notifications**, open to every role, with a **Send test** that pushes to the caller only.
2. **The public key was empty in every Docker build.** `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is substituted at build time and `app/Dockerfile` declares it `ARG …=""`. Now served at runtime from **`GET /api/push/public-key`** reading `VAPID_PUBLIC_KEY`. The build arg no longer matters.
3. **Silent failures.** New `PushDelivery` table logs every attempt with the push service's status code translated into something actionable. Surfaced in the user's dialog and an admin table under Settings.
4. **`workshop` was not a `Role` in `notification-tiers.ts`** — its own three-role union omitted it, so no tier could target a workshop user. Imports `Role` from `lib/types` now. `assertTierKeyExists` warns in dev when a call site invents a key.
5. **The service worker was registered only on click.** `components/providers/push-sync.tsx` registers on every load for a signed-in user and re-posts the existing subscription, which fixes stale endpoints and shared office machines.
6. **iOS** only delivers to an installed PWA; detected and explained.

Plus: per-user mute switches (`NotificationPreference`), the **workshop daily digest cron** at `GET /api/cron/maintenance-digest` (closes the last gap in item 14), tier entries for money in / large money out / trip completed / trip message failed / edit request outcomes, and notification icons.

⚠️ **The VAPID pair in both `.env.example` files was real-looking and is now a placeholder. Generate a new pair for production** (`bunx web-push generate-vapid-keys`) and set a real `VAPID_SUBJECT` — Apple rejects `mailto:admin@example.com`. Everyone will have to press Enable again; the delivery log will show 401/403 until they do.

### Edit requests (item 4) — the one asked for three rounds running

The approach matters, so read this before changing it.

**Approval replays the change through the entity's own update action**, in the approving admin's session — it does not rebuild the write. The `switch (entityType)` this replaces got that wrong (wrote a driver `licenseExpiry` and a customer `city`, neither of which exist; skipped dates and relations; never recomputed invoice balances), and even where right it was a second copy that had to stay in step with account reversals and join relinks. There is one copy now.

Pieces:

- `lib/edit-requests/registry.ts` — per entity: snapshot of editable fields, field labels, date fields, money fields, `apply` (calls the real update action), `applyDelete`, `href`.
- `lib/edit-requests/gate.ts` — `gateChange()`, called at the top of every update/delete action. Admin passes through; anyone else gets a request filed and `{ pendingApproval: true }` back. `beginReplay()`/`endReplay()` stand the gate down while an approved request is applied, so applying doesn't file another request.
- `components/ui/approval-notice.tsx` — the banner and required Reason box, on all 13 edit forms.
- `edit-requests/_components/edit-request-diff.tsx` — the before/after table, with a **third column when the record has moved on since the request was raised**.

Covered entities (13): truck, trailer, driver, trip, customer, supplier, employee, invoice, payment, supplier payment, expense (finance *and* operations forms), inventory item.

Other things in the same commits:

- Edit pages open to **staff** as well as supervisors — the brief says they are sent to the edit page, so refusing at the door was wrong.
- List menus say "Request edit" / "Request delete" for non-admins.
- `requireRole` → `requireAuth` at the top of every gated action: `requireRole` **redirects**, which would bounce a supervisor before they reached the gate, and a redirect looks like a crash to a form.
- **Money in** is admin-only server-side, and the dialog hides the option.
- **`wipeAllData` wiped every organisation** — every `deleteMany` ran unqualified. Now scoped, covers the six tables added since it was written, resets account balances to their starting figures, and checks the typed confirmation server-side.

**FIX_PLAN.md gotcha #4 is now obsolete.** It told every new session that edit requests are "a flag-and-reason system… don't fix it into a diff viewer", which is why the item was skipped three rounds. It is a diff-and-approve flow now. Rewrite or delete that gotcha.

---

### WhatsApp assistant (not one of the 27 — asked for verbally)

People message the bot and it answers, or records what they tell it. The
shape:

- `app/src/lib/assistant/operations.ts` — 13 read operations, each with the
  minimum role it needs. `write-operations.ts` — 7 that change data.
- `app/src/app/api/agent/assistant/route.ts` — the only door. `identify`,
  `manifest`, `invoke`, `log`.
- `agent/src/tools/app-tools.ts` — turns the manifest into Mastra tools per
  caller. `agent/src/agents/assistant.ts` — the per-caller agent.
- Settings → WhatsApp assistant — admins manage the contact list.

Three decisions worth knowing before changing anything here:

1. **Writes call the app's real server actions, not Prisma.** Recording a
   payment by message has to move the invoice balance, flip its status and
   fire the same notifications the web form does. Calling the same code is
   the only way to be sure it stays that way. This is what
   `lib/acting-session.ts` exists for — see pitfall 7.
2. **The contact list is not the security boundary.** The manifest hides
   what a person may not run, but the server re-checks the role on every
   invoke, and the *weaker* of (contact role, linked account's role) wins.
   Nobody gains access by messaging instead of logging in.
3. **Deletes and inter-account transfers were deliberately left out.** They
   stay in the web app where there is a confirmation dialog. If the client
   asks for them by message, that is a decision, not an oversight.

---

## Pitfalls hit this pass

1. **The dev server caches the Prisma client.** After `prisma migrate dev`, `prisma.pushDelivery` was `undefined` at runtime until the server was restarted, even though `bunx prisma generate` had run and typecheck was clean. Restart after every migration.
2. **`server-only` breaks throwaway `bun` scripts.** Any module importing it (`lib/period-range.ts`, the registry) throws "cannot be imported from a Client Component" when run outside Next. Either stub `node_modules/server-only/index.js` for the run and restore it, or copy the logic into the script.
3. **The typecheck baseline is now ZERO.** It was 88, then 85, 74, 72 — and the fifth pass cleared the rest. **Any error is now a regression; keep it at 0.** This matters more than it sounds: `next.config.ts` still sets `ignoreBuildErrors: true`, so anything that creeps back in ships silently. Three of the errors cleared were live bugs — a dead API endpoint, a permanently blank column on the revenue PDF, and a crash on any payment without an invoice (pitfall 12).
4. **Python `re.sub` replacement strings eat backslashes.** A batch edit across 13 forms wrote `\"` into the source and broke every one of them. Use a plain `str.replace` for anything containing quotes.
5. **Prisma rejects an index signature as `orderBy`.** A helper returning `Record<string, "asc"|"desc">` fails to typecheck, and — worse — the resulting error silently degrades `include` inference for the whole query, producing a cascade of "property does not exist" errors that look unrelated. Give the helper a generic and name the Prisma input type at the call site.
6. **`take` + totals is a recurring bug shape in this codebase.** Three separate places (customer detail, single truck report, single driver report) summed a truncated list. When you see a `take:` near a total, check it.
7. **Every server action starts with `requireAuth()`, which `redirect()`s.** Calling one from an API route — no better-auth cookie — throws `NEXT_REDIRECT`, and the caller sees "Failed to…" with no clue why. Anything driving a server action from outside the browser must establish a session first; `lib/acting-session.ts` is the mechanism.
8. **Zod strips unknown keys by default, and for a write that is dangerous.** A model calling `adjust_stock` with `{direction: "out", quantity: 3}` had `direction` silently discarded and *added* three parts to the warehouse. Every assistant schema is parsed `.strict()` now. Apply the same thinking anywhere a model's output becomes a write.
9. **`as Parameters<typeof someAction>[0]` is how a wrong payload ships.** Five write operations carried that cast; removing them showed that `record_expense` was passing `description` and `vendor` to an action that accepts neither, so the text a driver typed was dropped on the floor. If a payload needs a cast to compile, the payload is wrong.
10. **`Expense` has no `description` column** — the free text lives in `notes`. There is no `createdById` on it either; expenses are not attributed to a user.
11. **`tsx watch` and a WhatsApp session do not mix.** `bun run dev` restarts the agent on every save, and with no SIGINT handler Node died without closing Chromium; the next boot opened a second Chromium on the same profile directory, which corrupts it and makes WhatsApp drop the linked device. It looks exactly like "the session unauthenticated itself after I scanned". Use `bun run dev:whatsapp` (no watcher) when pairing. Note `LocalAuth.logout()` is the only thing that deletes the session folder, and nothing in this codebase calls it — rule that out first.
12. **A type error here is not theoretical.** Four shipped as real bugs. `profit-per-unit`'s PDF passed `{ trucks }` where `{ units, totals }` was wanted and crashed on *every* generation. `/api/agent/workflows` destructured `organizationId` off a validator that never returns one, so the whole endpoint 400'd. The revenue PDF's Invoice # column was blank because the fetcher says `invoiceNo` and the generator says `invoiceNumber`. And a payment without an invoice could not be receipted at all. When auditing, run the thing — `tsc` counting alone found none of these.
13. **`requireRole` redirects, and a `catch` will swallow it.** `generateReport` turned a non-admin's blocked request into a toast reading "NEXT_REDIRECT". Any server action with a try/catch around a `requireRole` needs `unstable_rethrow(error)` first.
14. **The `@/` alias only resolves inside `app/`.** A throwaway `bun` script kept in the scratchpad cannot import `@/lib/...`; copy it into `app/` to run, then delete it.
15. **A field passed to something that does not declare it is dropped in silence.** This has now bitten four times: the expense `description`, the revenue `invoiceNumber`, the trip email's addresses, and `adjust_stock`'s `direction`. TypeScript catches it only when the target type is actually applied — a cast, a spread into `any`, or a Zod object that strips unknown keys all hide it.
16. **`git filter-branch` can leave a merge that undoes it.** After rewriting history, the trailered chain came back as a second parent of a later commit and the old commits were ancestors of `main` again while the log looked clean. Always check `git rev-list --merges <base>..HEAD` and re-grep the range afterwards.

---

## What is left, in the order recommended

All 27 items are implemented, and item 27's report list is now complete.
What remains:

1. **The assistant has spoken to a *stub* model, not a real one.** The whole
   loop is now exercised — `answerMessage()` builds the tools, the model
   calls one, the app runs it, the reply quotes the real figure and the
   transcript records it — by pointing `ASSISTANT_BASE_URL` at a local server
   that speaks the OpenAI protocol (`scratchpad/stub-model.mjs`). What is
   still unverified is narrow but real: whether `google/gemini-3-flash`
   resolves on OpenRouter, and whether an actual model picks sensible tools.
   Set `OPENROUTER_API_KEY` and send one message to close it.
2. **No click-through in a real browser, three passes running.** Everything is
   verified by running the real server actions, HTTP fetches and database
   assertions. The Reports UI in particular now has 23 report types and a new
   CSV checkbox that nobody has clicked.
3. **WhatsApp has never been paired end to end.** The session-drop fix is
   reasoned from the code and the library's own source, not observed on a
   healed session — see "Pitfalls" 11.

### Reports — the full set (item 27 complete)

Twenty-three report types, each with a PDF and a CSV, all on the brand kit:

| Area | Reports |
|---|---|
| Money | profit-loss, cash-flow, aged-receivables, creditors, account-ledger, revenue, expenses, customer-statement, expense-categories, customer-profitability |
| Fleet | truck-cost-breakdown, fuel-report, maintenance-downtime, driver-performance, profit-per-unit, truck-profitability, truck-expenses, trailer-expenses |
| Operations | trip-pnl, trip-summary, trip-expenses, document-expiry, inventory-valuation |

Registration for a new report is four files: `config/reports.ts`,
`config/report-tabs.ts`, a case in `reports/actions.ts`, and the CSV. New
multi-section reports use `lib/reports/csv-sections.ts` rather than
hand-rolling a header block.

**Definitions decided here, because they are judgement calls and the reports
state them on their face:**

- *Ageing* counts days past the **due** date, never days since the invoice was
  raised. Supplier debt ages from the expense date plus that supplier's terms.
- *Cash out* is supplier payments plus spending that never went through a
  supplier — an expense owed to a supplier is counted when the supplier is
  paid, so the same money never leaves twice.
- *Customer profitability* and *trip P&L* are **contribution**, not net
  profit: they carry the costs booked against the trip, not a share of
  standing truck costs or overheads.
- *Fuel* is found by the category's cost `kind`, never by matching the
  category name.
- *Downtime* counts from a job being raised until it is marked fixed; an open
  job counts up to today.

## Verification actually done this pass

Be precise about this in the next handoff. What was checked:

- `bunx tsc --noEmit` after every commit; never above the baseline.
- `bunx eslint` on every file touched; no new errors.
- Pages loaded over HTTP as a signed-in admin (200 + content assertions) for: every converted form page, the category detail page across three filter combinations, all five newly-filtered list pages, and the four detail pages across `7d`/`3m`/`all`.
- **Role checks**: staff sees zero money figures on the category list and gets no financial content on the category detail page; supervisor sees the approval banner on the truck edit form.
- **Database-level**: the partial unique index genuinely refuses a second pending request and allows one after the first is refused; the record stays unchanged while a request is pending; every entity-search query shape runs; every registry snapshot that has seeded data returns correctly-labelled fields; the digest cron reached 2 workshop workers and wrote their notifications; a push attempt with no subscription logs a readable reason.
- Period filtering demonstrably changes figures (7d → 1y moves trips 7 → 240 and revenue $793k → $20.0M).

**Fourth pass, the assistant specifically** — every one of these was run
against the live dev server and the real database:

- Identity: `0772958986` resolves to the stored `+263772958986` (E.164
  normalisation works); an unknown number returns `authorized: false`; a bad
  API key returns 401.
- Roles: admin is offered 20 tools, readonly 7 — no financial and no write
  tools. A readonly contact invoking `get_financial_summary` or
  `record_expense` *directly* is refused by the server, so the manifest is a
  convenience and not the boundary.
- **All 7 write operations executed successfully against real data**, and the
  side effects were checked in the database afterwards: a payment moved an
  invoice from `balance 1000 / sent` to `400 paid / 600 / partial`; a
  maintenance fault was filed under the linked user (`Mr Dziruni`), not
  "the assistant"; a stock take-out wrote both the movement row and the new
  level; `notify_driver` reported `WhatsApp client is not ready` rather than
  claiming a delivery that never happened.
- Refusals: ambiguous truck `"KB"` asks which of four; an unknown category
  says so; invalid arguments are named individually; a hallucinated tool name
  is rejected; an unknown argument key is rejected rather than stripped;
  removing 999 of a part with 10 in stock is refused.
- The agent side: `identify`, `fetchManifest` and `invoke` were run from
  `agent/` against the app, the manifest was converted to Zod tools, a tool
  was executed through the built closure, and the generated schema was shown
  to reject a string where a number belongs.
- **Test data was removed afterwards and the totals confirmed back to
  baseline**: expenses $6,735,952 and completed-trip revenue $20,008,160,
  both exact. The two test contacts were deleted, so the assistant currently
  authorises nobody.

**Fifth pass — reports.** Every claim here was produced by running the real
`generateReport` server action (driven through `lib/acting-session`, the same
mechanism the WhatsApp assistant uses), not by reading code:

- **All 23 report types generate in both formats: 46 of 46.** PDFs verified to
  start with `%PDF`; CSVs non-empty.
- **The reports agree with each other and with the dashboard.** P&L,
  profit-per-unit, customer profitability, trip P&L and driver performance
  each independently arrive at revenue **$20,008,160**; customer profitability
  and trip P&L each arrive at profit **$16,225,832**; the fuel report's figure
  for KCD 012J ($392,662 over 12,525 km) is identical to what that truck's own
  page computes; the expense-category breakdown re-sums to the total three
  ways (category, cost type, month).
- **Ageing was tested with fixtures placed in each bucket**, and all five
  landed correctly (current / 1-30 / 31-60 / 61-90 / 90+), including the
  supplier-terms arithmetic. Fixtures were removed afterwards and the totals
  confirmed back to baseline.
- **A period with no data produces a valid document, not an error**, checked
  across five report types against the year 2000.
- **Reports stay admin-only**: supervisor, staff and workshop are all turned
  away by the real action; only admin gets bytes back.
- `bun run build` compiles for both services.

**Fifth pass — the assistant's model loop.** Driven against a stub OpenAI-
compatible server, so the tool-calling path runs without spending tokens:

- An admin asking "what is our profit this month?" gets the tool offered, the
  tool called, real figures returned and quoted back in the reply.
- The same question from a `readonly` contact: the financial tool is not in
  the seven it is offered at all.
- A **write** through the loop works: the model called `record_expense`, the
  expense landed in the database, and `didWrite` came back true.
- The transcript records each exchange with its tool calls and write flag,
  and the contact's message counter increments.
- An unknown number gets the "ask an admin" reply — this **crashed** before
  (see the commit); it is the most common case in production.

**Type-error sweep.** The baseline went 72 -> 0, and running each fix proved
three live bugs: `/api/agent/workflows` answered every authenticated request
with a 400, the revenue PDF's Invoice # column was always blank, and no
receipt could be issued for a payment with no invoice. All three now verified
working against the dev database.

What was **not** checked this pass:

- **`answerMessage()` has never run** — no `OPENROUTER_API_KEY`. The model
  has never seen these tools, so nothing is known about whether it picks the
  right ones, and the `google/gemini-3-flash` model id has never been
  resolved by OpenRouter.
- **No WhatsApp message has gone end to end.** `ENABLE_WHATSAPP=false`
  locally; the bot has not been paired.
- No click-through in a real browser again this pass; the new Settings field
  is verified by typecheck and by the action it calls, not by a click.

What was **not** checked, and should be:

- **No click-through in a real browser.** The Chrome extension would not connect this session (OAuth token mismatch), so everything above is HTTP fetches plus database assertions. The approval flow in particular deserves a human pressing the buttons.
- **Five registry entities have no seeded rows** — supplier, invoice, payment, supplier payment, inventory item. Their snapshots are typechecked and identical in shape to the seven that were verified, but they have not run.
- **Push has never been delivered to a real device.** Everything up to the send is verified; nobody has subscribed a browser.
- **No approval was applied end to end** through the UI, so the replay path (gate standing down, side effects firing) is verified by reading and by types, not by a completed round trip.
- `bun run build` has not been run this pass.

---

## Open questions for the client

1. **Item 20** — trailers already have no cross-border permit field anywhere. Where did they see it?
2. **Website stats** — are "4,100+ loads" and "98% on-time" real numbers?
3. **Item 12's fix note is mandatory** (min 5 characters). Confirm that's wanted.
4. **Logo vector** — do they have the WD mark as SVG/AI/PDF? Would replace the traced `site/public/images/wd-mark.svg`.
5. **New**: the approval flow makes a supervisor's *delete* a request too. Confirm that is wanted for operational records (a trip typed in wrong, say), or whether deletes should stay direct for supervisors on some entities.
6. **New**: "large withdrawal" notifications currently trigger at **$1,000**. Confirm the threshold.

### Judgment calls made on the assistant while the client was asleep

They asked for it to be finished without questions, so these were decided
rather than asked. Each is cheap to reverse:

7. **The assistant cannot delete anything, and cannot move money between
   accounts.** Those stay in the web app, where there is a confirmation
   dialog. Everything else the app can do, it can do.
8. **Recording anything requires a linked dashboard account.** A contact
   without one can ask questions but not record — there would be nobody to
   attribute the change to. The alternative was to file changes under a
   fictional "assistant" user, which would have made the audit trail useless.
9. **Assistant roles mirror the app's own**, and the weaker of the two
   applies. Nobody gains access by messaging instead of logging in.
10. **The default model is `google/gemini-3-flash`** — fast and cheap, which
    suits someone waiting on their phone. Env-overridable and logged at boot.

## Ops the client must do

- New Coolify application for `site/` (base directory `site/`).
- **Generate a new VAPID pair** and set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` as runtime env vars.
- Schedule `GET /api/cron/maintenance-digest` daily at 05:00 UTC (07:00 CAT), with the `CRON_SECRET` bearer token.
- Apply migrations (`20260923104139_push_delivery_log_and_preferences`, `20260923110348_edit_requests_org_scope_and_diff`).
- Commit `designs/WhatsApp Image 2026-09-18 at 15.11.42.jpeg` so item 26 can be worked on remotely. *(Done — `7d7a130`.)*
- **Get an OpenRouter key** (https://openrouter.ai/keys) and set
  `OPENROUTER_API_KEY` on the agent. Without it the assistant answers
  nothing; the agent logs the problem at boot rather than failing on
  someone's first message.
- **Confirm `ASSISTANT_MODEL`.** It defaults to `google/gemini-3-flash`.
  OpenRouter renames models, so if that id is wrong, set the variable — no
  deploy needed.
- Apply the assistant migration
  (`20260923201640_whatsapp_contacts_and_transcript`) along with this pass's
  others: `20260923115038_organization_document_details`,
  `20260923190109_expense_category_kind`,
  `20260923192745_driver_truck_assignments`,
  `20260923200000_notification_delivery_tracking`.
- **Add the real WhatsApp contacts** under Settings → WhatsApp assistant. The
  two test contacts used for verification were deleted, so nobody is
  authorised right now. Each contact that should be able to *record* anything
  needs a dashboard account chosen in "records changes as".
- Set `AGENT_API_KEY` to the same value on both services (the local `.env`s
  share a dev-only key; production needs a real one — `openssl rand -hex 32`).
