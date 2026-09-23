# PROGRESS — client feature round (27 items)

**Last updated:** 2026-09-23 (third pass). Working tree clean; nothing pushed.

Read these together:

| File | What it is |
|---|---|
| `CLIENT_FEATURE_REQUEST.md` | The client's own words — the 27 numbered items. The source of truth for *what* they asked for. |
| `FEATURE_PLAN.md` | The approved implementation plan: 5 difficulty tiers, per-item acceptance criteria, known pitfalls. |
| `PROGRESS.md` (this file) | What is done, what is next, and what was learned that isn't in the other two. |
| `FIX_PLAN.md` | The *previous* round's plan. Historical. **Gotcha #4 is now obsolete** — see below. |

`CLAUDE.md`'s **"Working conventions"** section is binding: modular todos, **one commit per todo**, **no `Co-Authored-By` or "Generated with Claude Code" lines**. Typecheck against the baseline and load the page in a browser before each commit.

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
| T4 | 1 + 18 truck cost breakdown by category | ❌ not started |
| T4 | 26 invoice redesign | ❌ not started — **now unblocked**, see below |
| T5 | 3 + 27 branded document kit + report audit | ❌ not started |
| T5 | 25 driver-truck snapshots | ❌ not started |
| T3 | 5 trip message delivery status | ❌ not started |

### Commits this pass (all on `main`, not pushed)

```
18b2989 fix(settings): "wipe all data" wiped every organisation
7d7e642 feat(accounts): only an admin records money into an account (item 4)
0becfb4 feat(edit-requests): tell the user their save is a request, and ask why
698e995 feat(edit-requests): route every update and delete through the gate
cd54bab feat(edit-requests): approve and refuse against a real before/after diff
0ff619e feat(edit-requests): one registry and one gate for every editable record
5e147b3 feat(permissions): only the admin edits a record directly
f6f9eab feat(edit-requests): give the table an organisation, an action and a diff
4795632 fix(notifications): push that works, and says why when it doesn't (item 16)
0539b05 feat(expenses): an expense category details page (item 22)
46dfb4e fix(exports): reports cover the period asked for, and only admin can pull them
f4cdc62 feat(filters): period filters on the detail pages, and totals that stop lying
01f5bba feat(filters): every list page filters by period, and exports follow it
a40285b feat(ui): entity pickers on the fleet, workshop, inventory and report forms
ac89721 feat(finance): entity pickers on the expense, invoice and payment forms
328b1e4 feat(ui): searchable entity picker, starting with the trip form
```

---

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

## Pitfalls hit this pass

1. **The dev server caches the Prisma client.** After `prisma migrate dev`, `prisma.pushDelivery` was `undefined` at runtime until the server was restarted, even though `bunx prisma generate` had run and typecheck was clean. Restart after every migration.
2. **`server-only` breaks throwaway `bun` scripts.** Any module importing it (`lib/period-range.ts`, the registry) throws "cannot be imported from a Client Component" when run outside Next. Either stub `node_modules/server-only/index.js` for the run and restore it, or copy the logic into the script.
3. **The typecheck baseline moved.** It is **85** after this pass, down from 88 — a pre-existing `Uint8Array` error in `use-push-notifications.ts` was fixed along the way. Record 85 as the new floor. `next.config.ts` still sets `ignoreBuildErrors: true`, so type errors ship.
4. **Python `re.sub` replacement strings eat backslashes.** A batch edit across 13 forms wrote `\"` into the source and broke every one of them. Use a plain `str.replace` for anything containing quotes.
5. **Prisma rejects an index signature as `orderBy`.** A helper returning `Record<string, "asc"|"desc">` fails to typecheck, and — worse — the resulting error silently degrades `include` inference for the whole query, producing a cascade of "property does not exist" errors that look unrelated. Give the helper a generic and name the Prisma input type at the call site.
6. **`take` + totals is a recurring bug shape in this codebase.** Three separate places (customer detail, single truck report, single driver report) summed a truncated list. When you see a `take:` near a total, check it.

---

## What is left, in the order recommended

1. **T5-C (items 3 + 27) — the branded document kit.** Do this *before* item 26 and before the truck cost report, so every PDF changes once. `lib/reports/receipt-generator.ts` is the gold standard to extract from; everything else still uses the black-and-white Times `PDFReportGenerator`.
2. **T4-D (item 26) — invoice redesign.** Unblocked; the field list is above. Built on the kit from step 1.
3. **T4-B (items 1 + 18) — truck cost breakdown by category.** Needs a new optional `ExpenseCategory.kind` (`fuel | maintenance | tyres | tolls | permits | salaries | other`) so fuel economics can be computed without matching on category names. Reuse `lib/metrics/revenue.ts` and the `some`-not-join-scan rule from item 22 — the category detail page's `_lib/category-detail.ts` is the closest existing model.
4. **T5-B (item 25) — driver-truck snapshots.** Needs the `DriverTruckAssignment` table and the backfill script. `getEarnedRevenue` already takes a `RevenueScope` (`{ customerId, truckId, driverId }`) added this pass, which is what the per-snapshot figures need.
5. **T3 item 5 — trip message delivery status.** Needs the agent running to verify end to end. Note `api/agent/workflows/route.ts` writes two columns that don't exist (`responseAt`, `responseData`) — two of the remaining baseline type errors.

---

## Verification actually done this pass

Be precise about this in the next handoff. What was checked:

- `bunx tsc --noEmit` after every commit; never above the baseline.
- `bunx eslint` on every file touched; no new errors.
- Pages loaded over HTTP as a signed-in admin (200 + content assertions) for: every converted form page, the category detail page across three filter combinations, all five newly-filtered list pages, and the four detail pages across `7d`/`3m`/`all`.
- **Role checks**: staff sees zero money figures on the category list and gets no financial content on the category detail page; supervisor sees the approval banner on the truck edit form.
- **Database-level**: the partial unique index genuinely refuses a second pending request and allows one after the first is refused; the record stays unchanged while a request is pending; every entity-search query shape runs; every registry snapshot that has seeded data returns correctly-labelled fields; the digest cron reached 2 workshop workers and wrote their notifications; a push attempt with no subscription logs a readable reason.
- Period filtering demonstrably changes figures (7d → 1y moves trips 7 → 240 and revenue $793k → $20.0M).

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

## Ops the client must do

- New Coolify application for `site/` (base directory `site/`).
- **Generate a new VAPID pair** and set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` as runtime env vars.
- Schedule `GET /api/cron/maintenance-digest` daily at 05:00 UTC (07:00 CAT), with the `CRON_SECRET` bearer token.
- Apply migrations (`20260923104139_push_delivery_log_and_preferences`, `20260923110348_edit_requests_org_scope_and_diff`).
- Commit `designs/WhatsApp Image 2026-09-18 at 15.11.42.jpeg` so item 26 can be worked on remotely.
