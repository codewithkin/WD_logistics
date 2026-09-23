# PROGRESS — client feature round (27 items)

**Last updated:** 2026-09-23 (second pass), handing off from a local Claude Code session to a cloud session.

Read these three files together:

| File | What it is |
|---|---|
| `CLIENT_FEATURE_REQUEST.md` | The client's own words — the 27 numbered items. The source of truth for *what* they asked for. |
| `FEATURE_PLAN.md` | The approved implementation plan: 5 difficulty tiers, per-item acceptance criteria, known pitfalls. Follow it. |
| `PROGRESS.md` (this file) | What is done, what is next, and everything learned along the way that isn't in the other two. |
| `FIX_PLAN.md` | The *previous* round's plan. Historical, but its "Gotchas" section is still valuable — except gotcha #4, which this round deliberately overturns (see below). |

`CLAUDE.md` has the architecture writeup and is accurate.

---

## Status at a glance

| Tier | Items | Status |
|---|---|---|
| T1 | 6 merge website | ✅ done (`f6133b8`) |
| T1 | 7 hero, 8 SADC copy, 9 motto, 10 country ticker, 11 footer wordmark | ✅ done (`b340dee`) |
| T1 | 20 no cross-border permit on trailers | ✅ verified already true — **see question for client below** |
| T1 | 23 admin-only expense categories | ✅ done (`17d6a8d`) |
| T2 | 12 fix note visible, 15 task details page, 17 maintenance history, 21 hide closed jobs from workshop | ✅ done (`17d6a8d`) |
| T3 | 13 assign a workshop worker, 19 maintenance on trailers, 14 workshop "today" view | ✅ done (`17d6a8d`) — **except the daily push digest (needs T4-C)** |
| T3 | 24 graph audit | ✅ done (`0b3b075`) |
| T3 | 5 trip message delivery status, 22 expense category details page | ❌ not started |
| T4 | 2 filters everywhere, 16 push notifications, 1+18 truck cost breakdown, 26 invoice | ❌ not started |
| T5 | 4 edit requests + money-in lock, 25 driver-truck snapshots, 3+27 branded documents | ❌ not started |

Five commits so far, all on `main`, **not pushed**:

```
0b3b075 fix(charts): one definition of revenue, and graphs that say what they mean
ec61ae0 docs: session handoff — PROGRESS.md, the feature plan and the client's list
17d6a8d feat(maintenance): trailers, assignment, task details and visible fix notes
b340dee feat(site): SADC-wide copy, motto hero, country ticker, logo wordmark
f6133b8 Merge website-design-b: client chose Design B (v2) for the website
```

---

## Decisions the client already made (don't re-ask)

1. **Website**: Design B (`website-design-b`) is the chosen one, merged into `main`. `website-design-a` is rejected — do not merge it (it also conflicts on `.claude/launch.json`).
2. **Edit requests (item 4)**: admin is the **only** role that edits or deletes directly. Supervisor and staff edits *and* deletes become requests carrying a real before/after diff. Creating records stays direct for supervisor and staff.
3. **Money in (item 4)**: only the **"Money in" (deposit)** action on the Accounts page and transfers-in become admin-only. **"Money out" stays available to supervisors.** Supervisors keep creating invoices and customer payments — those don't touch the three accounts.
4. **Push (item 16)**: fire on task assigned, task updated, **and every other key event worth notifying** (the list is in FEATURE_PLAN T4-C), plus a daily digest for workshop.
5. **WhatsApp (item 5)**: production runs the **agent's** bot (`agent/src/index.ts`), not the app's in-process client. Consolidate all driver messaging onto the agent.
6. **Marquee (item 10)**: "DR CONGO".
7. **Driver snapshots (item 25)**: a driver's per-truck period includes trip costs, driver costs **and** truck-level costs dated inside that period.
8. **Invoice (item 26)**: the client is adding a photo of their physical invoice to `designs/photos/`. **T4-D is blocked until that image exists** — check for it before starting item 26. If it still isn't there, ask; don't guess the field list.

---

## What changed in this session, in detail

### Website (`site/`, commits `f6133b8`, `b340dee`)
- `site/` is a **separate Next.js 16 app** with its own `package.json` and `Dockerfile` (standalone output, build context `site/`). It is not part of the root `docker-compose.yml`.
- Hero rebuilt: `site/src/app/page.tsx` — the photo block now carries **no copy** except the small pill in the sky; headline, paragraph, CTAs, stats and quote card moved into a band below it. `imgClassName="object-[50%_36%] sm:object-[50%_38%] lg:object-[50%_40%]"` keeps the truck cabs in frame. Verified by script at 375/440/1440 px: nothing but the pill overlaps the image, no horizontal scroll.
- H1 is "Efficiency / in Motion." The motto lives in `COMPANY.motto` (`site/src/lib/site.ts`) and flows into titles, OG/Twitter and the JSON-LD `slogan`.
- Region copy is SADC-wide; Mutare stays as the base and postal address. `COUNTRIES` in `site/src/lib/site.ts` is the single source for the ticker and `areaServed`.
- Ticker: the list is repeated 4× per half (`TICKER` in `page.tsx`) so one half stays wider than a 1920 px viewport, and `globals.css` animation was slowed 28s → 56s to keep the old scroll speed.
- Footer wordmark: **`site/public/images/wd-mark.svg` was generated by me**, by tracing the W and D out of `app/public/logo.png` (connected-component extraction, then Douglas-Peucker simplification). The Africa outline and the "LOGISTICS" lockup are dropped. It renders on a white plate because the brand green would vanish on the green footer card.
  - ⚠️ **Get the client's real vector if they have one** and swap the file. The trace is faithful but it is a trace of a 512px raster.
- Stats "4,100+ loads" and "98% on-time" are **placeholders inherited from the design**. Ask the client for real figures before launch.
- Ops item: `site/` needs its **own Coolify application** (base directory `site/`). Not done — it's a hosting task.

### Maintenance (commit `17d6a8d`)
Migration `app/prisma/migrations/20260922183121_maintenance_trailers_and_assignment/`:
- `truckId` nullable, `trailerId` added, plus `assignedToId` / `assignedById` / `assignedAt`.
- A hand-appended `CHECK (("truckId" IS NULL) <> ("trailerId" IS NULL))` — Prisma can't express "exactly one of", so **if you regenerate this migration you will lose the CHECK**.
- Status values are now `open | assigned | in_progress | fixed` (plain strings, per repo convention; badge config in `src/components/ui/status-badge.tsx`).

Code:
- `app/src/app/(dashboard)/maintenance/actions.ts` — create (truck **or** trailer, optional assignee), `assignMaintenanceRequest`, `startMaintenanceWork`, `markMaintenanceRequestFixed` (fix note now **required**, min 5 chars), `updateMaintenanceRequest`, `getWorkshopMembers`, `getMaintenanceVehicles`.
- `_lib/status.ts` holds `UNFINISHED_STATUSES` and `MaintenanceVehicleType`. **They cannot live in `actions.ts`** — see the pitfalls section.
- `_lib/history.ts` — `buildMaintenanceHistory()` and `downtimeDaysFor()`, shared by the maintenance screen and the truck page.
- `_components/workshop-task-cards.tsx` — Today / Overdue / Coming up, with "today" computed in **Africa/Harare**, not server UTC.
- `_components/maintenance-history-panel.tsx` — the admin/supervisor ranking.
- `_components/maintenance-detail-actions.tsx` and `[id]/page.tsx` — the new task details page.
- `src/lib/notifications.ts` — new `notifyUsers()` for addressing **named individuals**; `notifyMaintenanceRequestAssigned`, `notifyMaintenanceRequestUpdated`; `notifyMaintenanceRequestFixed` now carries the fix note and also tells whoever logged the issue.

Verified in a real browser, logged in as each role:
- Workshop sees only their own unfinished jobs, with cards reading Today 2 / Overdue 1 / Coming up 1 against the seeded fixtures. Another worker's job and their own closed job both 404 by URL.
- Closing a job with a note works; the note, the fixer and the date then show on the admin list under the "Fixed" filter and on the details page.
- Admin sees trucks and trailers, assignees, and the history ranking with downtime days.

All three items that were unverified at the first handoff have since been exercised in the browser:
- **Truck detail maintenance card** — shows 3 jobs / 2 open / 10.6 days out of service for KCA 456B, with the work-done note inline.
- **Assign flow** — the assignee list contains only workshop users; saving updates the record, adds a timeline entry, toasts, and writes a `UserNotification` addressed to that one person with a deep link (checked in the database).
- **Redirect after close** — a workshop user closing a job now lands back on their task list instead of the 404 the first attempt produced (they can no longer see a closed job). Fixed in `maintenance-detail-actions.tsx`.

### Expense categories (item 23)
- `finance/expense-categories/actions.ts` is admin-only via the new `assertRole`; UI controls gated with `canManageExpenseCategories()` (`src/lib/permissions.ts`).
- Added the `isDriver` flag the form never exposed.
- Deleted three dead components (`expense-categories-section.tsx`, `expense-categories-table.tsx`, `expense-categories-table-client.tsx`) — one of them linked to a route that doesn't exist.

### Graph audit, item 24 (commit `0b3b075`)

Two new shared modules, both worth reusing for items 1, 18, 22, 25 and 27:

- **`src/lib/metrics/revenue.ts`** — the single definition of revenue. Read its header comment before touching any money figure. `getEarnedRevenue` / `getMonthlyPerformance` (completed trips, dated by `endDate` with a fallback to `scheduledDate`) and `getCashCollected` (payments). The dashboard card, both dashboard charts and the driver table now all read from it.
- **`src/lib/metrics/monthly.ts`** — `groupByMonth` / `lastMonths` / `shortMonthLabel`.

What was actually wrong, all confirmed against seeded data:

| Chart | Was | Now |
|---|---|---|
| Dashboard stat card vs both charts | Three different revenue numbers on one screen — the card read $1,526,071 while the chart header beside it read $0 | All three read the same figure; each chart's header is summed from the buckets it plots. Cash collected is shown separately and labelled |
| Trips + expenses "Last 6 months" bars | `slice(-6)` over newest-first rows took the six **oldest** months and drew them backwards | Grouped by sortable key, sorted, then sliced. Unit-checked: newest-first input yields Apr→Sep in order |
| Month labels | "Jan" with no year, so a 1y period looked like a repeating list | "Sep '26" everywhere, one shared formatter |
| Performance-trend tooltip | Formatted by magnitude: a trip count over 1000 got a "$", a $40 expense didn't | Formats by series. Left axis relabelled "Amount ($)" since expenses share it |
| Operations expenses Pending/Paid | Hardcoded "nothing pending, everything paid" in **two** places (page **and** `expenses-client.tsx`, which silently recomputes analytics client-side and overrides the server's) | Reads `isPaid`. Flipped correctly from 0/821 to 821/0 against the seed |
| Driver table rating | Five stars fed by a hardcoded `4.5` for every driver | Real on-time count; efficiency divides by completed trips, not by trips still scheduled |
| Trip revenue vs expenses | A pie, which claims expenses are a slice of revenue — and can't draw a loss at all | Horizontal bars: revenue, expenses, profit/loss |
| Drivers licence chart | Fed a hardcoded `[]`, so it never rendered | Licence expiry buckets (expired / ≤30 days / valid / none recorded) |
| Drivers status pie | No "suspended" slice, though drivers can be suspended | Added |
| Trips monthly revenue | Counted cancelled and scheduled trips | Completed only |

**Trap worth knowing:** `operations/expenses/_components/expenses-client.tsx` recomputes the analytics object in a `useMemo` and ignores the one the server page passes. I fixed the server page first and the screen didn't budge — the client copy was the one being rendered. Check for a client-side recomputation before concluding that a server change "didn't take".

### New shared helper
`assertRole(roles)` in `src/lib/session.ts` — **use this in server actions called from client components**. `requireRole` redirects, which a dialog caller sees as a dead request with no message. `assertRole` throws a `UserFacingError` that `handleActionError`/`toUserMessage` pass straight through.

---

## Pitfalls hit this session (these cost real time — don't repeat them)

1. **A `"use server"` module may only export async functions.** Exporting a `const` from `actions.ts` throws `A "use server" file can only export async functions, found object` at runtime — and `bunx tsc` does **not** catch it. Worse, even `export type { X }` fails with `Export X doesn't exist in target module`. Put constants and types in a sibling `_lib/` module. Both mistakes were made and fixed here.
2. **`typescript.ignoreBuildErrors: true` in `app/next.config.ts`** means type errors ship. The baseline is **88 pre-existing `error TS` lines** — record it with `bunx tsc --noEmit 2>&1 | grep -c "error TS"` before you start and require the number not to grow.
3. **Typechecking is not enough.** Both of the failures above typechecked cleanly and broke the page at runtime. Load every page you touch in a browser, as each role.
4. **`prisma migrate dev` does regenerate the client, but if types look stale run `bunx prisma generate`** — the client output is the custom path `src/generated/prisma`.
5. **Period filters and future-dated records.** `getDateRangeFromParams` ends at *now*, so a job scheduled for next week fell off the admin list. The maintenance query now matches `date in range OR fixedAt in range OR status unfinished`. Watch for the same trap in items 2, 17 and 22.
6. **A server change that "doesn't take" may be overridden client-side.** `operations/expenses/_components/expenses-client.tsx` recomputes its analytics in a `useMemo`, so the server page's numbers never reach the screen. Grep for a client recomputation before restarting the dev server (I restarted it for nothing).
7. **Notification tier keys can't target the workshop role at all** (`notification-tiers.ts` has its own `Role` type without it) and the tier map is keyed `${entityType}_${eventType}` — a mismatched key silently falls through to a supervisor-only default. That's why assignment notices had nowhere to go, hence `notifyUsers()`. Item 16 should fix the `Role` type properly.
8. **Don't re-enable `reactCompiler`** in `app/next.config.ts`, and **don't merge `accounts.ts` into `accounts-server.ts`** — both have crashed this app before (documented in FIX_PLAN.md gotchas 1 and 5).
9. **FIX_PLAN.md gotcha #4 is overturned.** It tells every new session that edit requests are "a flag-and-reason system… don't fix it into a diff viewer". Obeying it is why item 4 has now been skipped three rounds running. The client wants the real diff-and-approve flow. **Rewrite that gotcha when you do item 4**, so the next session doesn't regress it.

---

## Local environment notes (mostly for a human, not the cloud box)

- A local Postgres at `localhost:5432/wdlogistics` was reachable and **all migrations are applied** there. A cloud session will have no such database — for anything data-shaped, either provision one or verify by reading code plus a throwaway script, and say plainly in the handoff which checks you could not run.
- `bun run db:seed` wipes and regenerates demo data. `app/prisma/dev-fixtures.ts` (added this session, run with `bun prisma/dev-fixtures.ts` from `app/`) adds **one user per role** plus trailers and a spread of maintenance jobs on top:
  - `supervisor@wd.test`, `staff@wd.test`, `workshop@wd.test`, `workshop2@wd.test`, all with password `Test@12345`
  - admin is `dziruniw@gmail.com` / `@logisticswd` (from `prisma/ensure-admin.mjs`)
  - These are **local test credentials only.** Never create them against production.
- Preview servers are configured in `.claude/launch.json`: `wd-logistics-app` (port 3000) and `wd-logistics-site` (port 3002, added this session).

---

## Open questions for the client

1. **Item 20** — trailers already have **no** cross-border permit field anywhere: not in the schema, the form, the detail page, the PDFs or the expiry-reminder registry (only trucks have `crossBorderInsuranceExpiration` / `crossBorderPermitExpiration`). Where did they see it? Likely candidates are the truck form or a reminders dialog.
2. **Item 26** — the physical invoice photo is still missing from `designs/photos/`.
3. **Website stats** — are "4,100+ loads" and "98% on-time" real numbers?
4. **Item 12's fix note is now mandatory** (min 5 characters). Confirm that's what they want, since it's a change in behaviour for the workshop.
5. **Logo vector** — do they have the WD mark as SVG/AI/PDF? Would replace my traced `wd-mark.svg`.

---

## Recommended next steps, in order

1. **T4-A (filters everywhere)** — big but mechanical, and items 1, 18, 22 and 25 all sit on top of it. The list of pages missing a period filter, and of exports that ignore it, is already enumerated in FEATURE_PLAN T4-A.
2. **T3 item 22 (expense category details page)** — small, and it slots straight into the drill-down item 18 needs.
3. **T5-C (the branded document kit)** before item 26 and before the truck cost report, so every PDF changes once.
4. **T4-C (push)** before **T5-A (edit requests)** — the approval flow needs working notifications. It also closes the one gap left in item 14 (the workshop's daily digest).
5. **T5-A (edit requests)** — the item the client has asked for three times. Do not defer it again. Note the two pre-existing type errors in `edit-requests/actions.ts` (`licenseExpiry`, `city` — both fields that don't exist) are in the baseline and are exactly the bugs that flow rewrite removes.
6. **T3 item 5 (trip message delivery)** — needs the agent running to verify end to end.
7. **T5-B (driver-truck snapshots)** last; it needs the assignment-history backfill, which needs a real database and the client's sign-off on the derived history.

When picking up items 1 and 18, reuse `src/lib/metrics/revenue.ts` rather than writing a fourth revenue calculation.

Work one item (or one tightly coupled pair) per commit, and keep this file updated as you go.
