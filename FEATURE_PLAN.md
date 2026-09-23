# WD Logistics — Feature Round (27 items): Tiers + Implementation Plan

## Context

The client sent 27 feature/fix requests (Notion export `WD Logistics Features ….md`). Several were "done" in earlier rounds but never actually worked: edit requests (asked for 3 rounds running), push notifications, and the maintenance fix-note. This plan was built by reading the real code. Every claim cites the file where the problem was found. The point is to ship each item **with acceptance criteria that get checked in a browser, per role**, not just to write the code.

**Why edit requests kept getting skipped:** `FIX_PLAN.md` → "Gotchas #4" tells every new session that edit requests are "a flag-and-reason system… intentional… don't fix it into a diff viewer". Each session obeyed it. The client has now asked for the real thing three times, so **that gotcha is overturned**. Step 0 rewrites it so the next session doesn't regress.

### Decisions already made with the user
- Website: merge `website-design-b` first. It adds `site/` only, and `git merge-tree` shows no conflicts.
- Edit requests: **admin is the only role that edits or deletes directly.** Supervisor and staff edits and deletes become requests with a real before/after diff. Creates stay direct for supervisor and staff.
- Money in: only the Accounts page's **"Money in" (deposit)** and transfers-in become admin-only. "Money out" stays available to supervisors. Supervisors keep creating invoices and payments.
- Push: fire on task assigned, task updated, and every other key event (full list in T4-C), plus a daily digest.
- Physical invoice image: the user will add it to `designs/photos/`. The invoice layout work (T4-D) is **blocked until it's there**.
- WhatsApp in production is the **agent's bot**. All driver messaging is consolidated onto it.
- Marquee: "DR CONGO".
- Driver-truck snapshots include trip costs, driver costs **and** truck-level costs dated inside the period.

---

## The 5 tiers

| Tier | Meaning | Items |
|---|---|---|
| **T1** Trivial | Copy, config, one-file changes, no schema | 6 (merge — **do first**), 7, 8, 9, 10, 20, 23 |
| **T2** Small | Contained UI plus light logic, no or trivial schema | 11, 12, 15, 17, 21 |
| **T3** Medium | Schema migration plus new pages/flows in one domain | 13, 14, 19, 22, 5, 24 |
| **T4** Large | Cross-cutting infrastructure touching many pages | 2 (site-wide filters), 16 (push), 1 + 18 (truck cost breakdown + report), 26 (invoice) |
| **T5** Hardest | Architectural; touches every entity/document or needs history backfill | 4 (real edit requests + money-in lock), 25 (driver-truck snapshots), 3 + 27 (unified branded document system + report audit) |

**Execution order.** Dependencies override tier order:

Step 0 → T1 (item 6 first) → T2 → T3 → T4-A filters → T5-C document kit (needed by 26 and 1/18) → T4-D invoice → T4-B truck breakdown → T4-C push → T5-A edit requests → T5-B driver snapshots → final audit.

Push goes before edit requests because edit requests rely on notifying the admin.

---

## Step 0 — Pre-flight (do not skip)

1. Run `git status` and `git log --oneline -20`. Other sessions commit concurrently.
2. `app/next.config.ts` has `typescript.ignoreBuildErrors: true`, so **type errors ship to prod silently**. The `tripNumber: undefined` WhatsApp bug is proof. Record a baseline with `bunx tsc --noEmit > baseline.txt`. After each item, diff against it: **zero new errors** is a hard gate.
3. Keep `reactCompiler: false` in `next.config.ts`. Turning it on crashes every page.
4. Keep the `accounts.ts` / `accounts-server.ts` split. Merging them leaks the pg driver into the client bundle.
5. Rewrite `FIX_PLAN.md` Gotcha #4 to say: "Overturned 2026-09 by client request: edit requests carry a real `proposedData` diff and are applied on admin approval."
6. Update `lessons/supervisor.md` and `lessons/staff.md`. The supervisor guide currently says "create and edit records directly — no approval needed".
7. Create 4 test logins: admin, supervisor, staff, workshop. **Every acceptance check below runs under each relevant role.**
8. Migrations: check `app/.env` `DATABASE_URL`. If a DB is reachable, run `bun run db:migrate`. Otherwise hand-write the SQL in the style of `prisma/migrations/*`. Every migration must be additive or come with a backfill.

---

# T1 — Trivial

### 6. Merge `website-design-b` into main (FIRST TASK)
- `git merge --no-ff website-design-b` from main. This adds `site/`, a separate Next 16 app with its own `package.json` and `Dockerfile` (`output: "standalone"`, context `site/`).
- **Do not merge `website-design-a`.** It conflicts on `.claude/launch.json` and was rejected.
- Pitfalls:
  - Coolify needs a **new, separate application** for `site/`, with base directory `site/`. It is not part of the root `docker-compose.yml`. Flag this to the user; it's an ops step.
  - Add `site/node_modules` and `site/.next` to the root `.dockerignore`, so they don't bloat the `app`/`agent` build contexts that use the repo root.
  - Add a `site` entry to `.claude/launch.json` (port 3002) so the site can be previewed.
- **Accept when:**
  - `git log` shows the merge commit.
  - `cd site && bun install && bun run build` succeeds.
  - Home, about and contact render in the preview.
  - `app/` still builds.

### 7. Hero text must not cover the trucks (`site/src/app/page.tsx:102-216`, `PhotoBlock.tsx`)
- Currently the H1, paragraph card, stats and a "same-day quote" card all sit **on top of** `fleet-lineup-yard.jpg`: top-left and bottom-right on desktop, stacked from the top on mobile.
- Fix:
  - Split the hero into (a) the photo block with **no overlaid content except, at most, a small pill** and (b) a text band directly **below** it.
  - Desktop: the photo is about 70vh with `object-position` tuned so the truck line sits centred. The motto H1, paragraph and CTAs go in a row beneath it, with stats to the right. The quote card moves below as well.
  - Mobile: image first, with `aspect-[4/3]` and `object-position` so the trucks are visible, then the text.
  - Remove the dark gradient overlay once nothing sits on the photo.
- Pitfall: `object-cover` crops differently at each aspect ratio. Check the actual truck positions in `designs/photos/fleet-lineup-yard.jpg` and set `object-position` per breakpoint.
- **Accept when:**
  - At 375, 414, 768, 1024, 1320 and 1920 px widths, a screenshot shows every truck cab fully visible with no text or card over any truck.
  - No horizontal scroll.
  - LCP image still has `priority`.

### 8. Copy: SADC, not "Zimbabwe" (the client wrote "SADZ", meaning SADC)
- Replace every Zimbabwe-limiting phrase found in:
  - `page.tsx` lines 12, 14, 19, 21, 46, 106, 116, 119, 127, 160, 446
  - `layout.tsx` lines 30, 33, 38-54
  - `about/page.tsx` lines 12, 19, 48, 85, 92, 154
  - `contact/page.tsx` lines 11-20
  - `CtaFooter.tsx:104`
  - `lib/site.ts:5, 34`
- Keep "Mutare" and "Nyakamete, Mutare, Zimbabwe" as the **address**: `addressFull`, the maps query at `contact/page.tsx:119` and the footer location. The home base stays.
- Rewrite the rest to region-wide wording:
  - "ZIMBABWE & SADC" becomes "ACROSS THE SADC REGION".
  - "Zimbabwean roads, Zimbabwean crew" becomes something like "SADC roads, experienced crew".
  - JSON-LD `areaServed` becomes the list of 5 countries.
  - SEO keywords add "SADC haulage", "cross-border trucking Zambia/Mozambique/DRC/South Africa".
- Pitfall: the stats "4,100+ loads" and "98% on-time" are placeholders. Ask the client to confirm real figures before launch, and don't invent new ones.
- **Accept when:** a grep for `Zimbabwe` in `site/src` returns only address and location lines. Each remaining hit is justified in the PR description.

### 9. Motto "Efficiency in Motion"
- It becomes the landing H1, replacing "Zimbabwe's load, moved on time". It is the first text on the page and the heading moved below the photo in item 7.
- Also use it in:
  - the `<title>` template (`WD Logistics — Efficiency in Motion`)
  - the OG/Twitter titles
  - the header or tagline next to the logo
  - `CtaFooterFull` and `CtaFooterSimple`
  - the about page intro
  - `COMPANY.motto` in `lib/site.ts`, as the single source
- Keep the italic-green accent styling on "in Motion".
- Also use the motto as the tagline on PDFs (T5-C), replacing "Fleet & Logistics Management" in `receipt-generator.ts`.
- **Accept when:**
  - The H1 on `/` reads exactly "Efficiency in Motion".
  - It appears in the footer and in `<title>`.
  - There is exactly one H1 per page.

### 10. Marquee → countries
- `ROUTES` (`page.tsx:50-61`) becomes `["ZIMBABWE","ZAMBIA","MOZAMBIQUE","DR CONGO","SOUTH AFRICA"]`.
- Pitfall: the loop animates `translateX(-50%)` over `[...ROUTES, ...ROUTES]`. With only 5 short items, one copy is narrower than a 1920 px viewport, which leaves a visible gap or jump. Repeat the list enough times that one half is wider than the widest viewport (e.g. 4 copies per half). Shorten the 28 s duration proportionally so the scroll speed stays the same.
- Keep the `prefers-reduced-motion` handling.
- **Accept when:** at 1920 px the marquee is seamless with no gap, and it is static under reduced motion.

### 20. Trailer — no cross-border permit
- The `Trailer` model and trailer form currently have **no** cross-border fields. Only `Truck` has them (`schema.prisma:201-202`, rendered via `EXPIRY_FIELDS.truck` in `lib/expiry-reminders.ts:16-17`).
- Before closing the item:
  - Ask the client where they saw it. The likely candidates are the truck form or an expiry-reminder dialog.
  - Check a trailer detail page and the reminders UI in the browser.
- If it appears through a shared component (e.g. an expiry-reminder settings list that iterates truck fields for trailers), gate it to `EXPIRY_FIELDS.trailer` only.
- **Do not remove it from trucks.**
- **Accept when:** the trailer create, edit and detail pages, trailer PDFs and the reminders UI show no cross-border field. The truck still has one.

### 23. Only admin creates expense categories
- Server:
  - `finance/expense-categories/actions.ts:16` (create), `:49` (update) and `:94` (delete) become `requireRole(["admin"])`.
  - Return a typed error rather than a redirect. `requireRole` redirects (`session.ts:69-79`), which a client action caller sees as a failed fetch, so add an `assertRole()` helper that returns `{success:false,error}`.
- UI: gate the "Add Category" button (`expense-categories-client.tsx:317`) and the edit/delete controls to admin.
- Delete the dead `expense-categories-section.tsx` and `expense-categories-table*.tsx` (they link to a non-existent `/[id]/edit`). Also delete the duplicate create/delete in `settings/actions.ts:47,72`, or restrict it to admin; it is already admin-only.
- Add the `isDriver` toggle that's missing from the form.
- **Accept when:**
  - Supervisor and staff see the category list (read) but no Add, Edit or Delete controls.
  - Calling the action directly as a supervisor returns an error and no row is created.

---

# T2 — Small

### 12. Maintenance fix-note not showing + the "success criteria" mandate
- Root cause: `fixedNotes`, `fixedAt` and `fixedBy.name` are saved (`maintenance/actions.ts:60-68`) and fetched (`page.tsx:12-20`) but **never rendered** in `maintenance-requests-client.tsx:253-323`.
- Fix:
  - Add "Fixed by / Assigned to" and "Fixed on" columns.
  - Show a notes preview with an expand control.
  - Link each row to the new details page (item 15).
  - Include `fixedNotes` and the fixer in the `notifyMaintenanceRequestFixed` payload (`notifications.ts:698-716`), with a deep link to `/maintenance/{id}` instead of `/maintenance`.
- Resolve-dialog validation: **make the fix note required**, at least 5 characters. An optional note is how "notes don't show" gets reported. Confirm this with the client and default to required.
- **The mandate — a per-feature success-criteria template.** Every item in this plan is implemented against a checklist before it counts as done:
  1. Data is written: check the DB row via `bun -e` script or Prisma Studio.
  2. Data is **displayed** everywhere a user would expect it: list, details, PDF export, notification.
  3. The server enforces role rules. Test the action directly, not just a hidden button.
  4. Org-scoped queries.
  5. Errors are surfaced to the user (toast or message). No `.catch(console.error)`-only paths for user-visible side effects.
  6. Empty, loading and long-text states.
  7. Mobile width at 375 px.
  8. No new `tsc` errors.
  9. Page actually loaded in the browser under each relevant role.
- **Accept when:**
  - A workshop user fixes a task with a note.
  - Admin sees the note, fixer and time in the list, on the details page and in the notification/push.
  - An empty note is rejected.

### 15. Maintenance task details page — `maintenance/[id]/page.tsx`
- Shows:
  - the target (truck or trailer, linked)
  - reported by and when
  - scheduled date
  - full notes (preserve line breaks with `whitespace-pre-wrap`)
  - status timeline: created → assigned (who, by whom) → fixed (who, when, full fix notes)
  - assignee, with a reassign control for admin/supervisor
  - a "Mark fixed" action for the assignee
- Access:
  - admin and supervisor can open any task
  - workshop can open **only tasks assigned to them that are not fixed**; anything else returns `notFound()`, not a redirect (item 21)
  - staff are denied, matching the nav
- Org-scope the `findFirst({ where:{ id, organizationId }})`.
- **Accept when:**
  - Every field is visible and long notes wrap.
  - A workshop user opening another worker's task ID by URL gets 404.

### 21. Workshop never sees fixed tasks; admin and supervisor do
- Today the status filter defaults to "open" in the client only, and fixed rows are still fetched (`client.tsx:88`, `page.tsx:12-20`).
- Fix it **server-side**: for workshop, `where: { organizationId, assignedToId: session.user.id, status: { not: "fixed" } }`.
- Hide the status dropdown for workshop.
- Admin and supervisor keep Open / In progress / Fixed / All, with default Open.
- Also exclude fixed tasks from any workshop push digest and counts.
- **Accept when:**
  - As workshop, a fixed task disappears immediately after "Mark fixed" (via `revalidatePath`).
  - It can't be reached by URL.
  - Admin still sees it under Fixed and All.

### 17. Maintenance history filter (admin/supervisor only)
- **Maintenance page:** add a "Most maintained" view (a tab or panel, admin/supervisor only). It ranks trucks and trailers by request count in the selected period, using the universal `PeriodSelector` + `getDateRangeFromParams`. Columns:
  - count
  - open vs fixed
  - total downtime days (`fixedAt - date`, open ones counted to now)
  - last request date
- Add filters: vehicle type (truck/trailer), specific vehicle, status, assignee.
- **Truck details page:** add a "Maintenance history" card with count, downtime and a list linking to task details. This feeds item 1's "is it spending a lot of time in repairs?".
- Pitfall: `groupBy` on nullable `truckId`/`trailerId` after item 19. Group each separately and then merge.
- **Accept when:**
  - The ranking matches a hand count for a seeded period.
  - Changing the period changes the numbers.
  - Workshop and staff can't see the panel (server-checked).

### 11. Footer wordmark: WD from the logo + "LOGISTICS" as text
- Currently `WD LOGISTICS` is plain text (`CtaFooter.tsx:98-100`). The only logo assets are raster: `app/public/logo.png` 512², `logo-mark.png` (WD plus the Africa outline), `site/public/images/logo.jpg` 532×296. **No SVG exists.**
- Need a "WD-only" asset without the Africa outline. The Africa outline sits behind the letters, so a simple crop won't remove it cleanly.
- Plan:
  1. Check the embedded base64 logo in `designs/Design B - Signature/index.html` for a higher-res or vector source.
  2. If none, ask the client for the original vector (AI/SVG/PDF). This is the correct fix.
  3. Fallback: trace W (green) and D (blue) into `site/public/images/wd-mark.svg` with potrace or a hand-drawn path, and have the user sign off on the result.
- Render as `<img src=wd-mark.svg>` sized to the old text cap-height (118 px at lg, `8vw` on mobile), followed by "LOGISTICS" in the existing heading font and colour, on the same baseline.
- Pitfall: the green footer card is `#63C32E`, and a green W on a green background disappears. Use a white or dark-ink variant of the mark on that card, or place it on a white inset. Show the options to the user.
- **Accept when:** the footer reads [WD mark][LOGISTICS] on one line at lg, wraps cleanly at 375 px, the mark is crisp at 2× DPR, and there is no Africa outline.

---

# T3 — Medium

### 19 + 13. Maintenance on trailers; assign a workshop worker (one migration)
Schema, `MaintenanceRequest`:
- `truckId String?`
- add `trailerId String?` plus a relation (add `maintenanceRequests` back-relation on `Trailer`)
- add `assignedToId String?` → `User` relation `"MaintenanceRequestAssigned"`
- add `assignedById String?`, `assignedAt DateTime?`
- `status` becomes `open | assigned | in_progress | fixed`. It stays a plain string; update the comment, `status-badge.tsx:279-291` and any Zod enum.
- Add a raw-SQL `CHECK ((truck_id IS NULL) <> (trailer_id IS NULL))` in the migration. Prisma can't express it.
- Index `[organizationId, assignedToId, status]`.

Create form:
- a truck/trailer toggle, then a vehicle selector
- an optional "Assign to" selector listing `member.findMany({ where:{ organizationId, role:"workshop" }, include:{user} })`, via a new helper `getWorkshopMembers()` in `lib/`
- the scheduled date (`date`) is the "task day"

Actions:
- `assignMaintenanceRequest(id, userId)`, admin/supervisor only. **Validate the target is a workshop member of the same org.** Record `assignedById/At` and set status `assigned`. On reassign, notify both the old and new worker.
- `markFixed` becomes allowed only for the assignee (workshop), or admin/supervisor.
- Optional `startWork` (→ `in_progress`).

The "Fixed by" column shows `fixedBy` when fixed, otherwise "Assigned: {name}" or "Unassigned".

Update every consumer of `truck` on a maintenance request so a null truck doesn't crash:
- the list
- the details page
- notifications (`notifyMaintenanceRequestFixed` uses `truckRegistrationNo`)
- PDF exports

Pitfalls:
- Existing rows all have `truckId`, so the CHECK is safe.
- A workshop user deleted or role-changed while holding tasks: show "Unassigned (user removed)" and surface those tasks to admin.
- A trailer attached to a truck: the task belongs to the trailer only.

**Accept when:**
- Admin creates a trailer task and assigns worker A. A sees it and gets a push (T4-C). B doesn't see it.
- Reassigning to B moves it and notifies both.
- The DB rejects a row with both or neither vehicle.

### 14. Workshop "today" view, only their tasks
- The maintenance page for workshop gets summary cards at the top:
  - Today's tasks (`date` within today in CAT)
  - Overdue (`date` < today and not fixed)
  - Upcoming
  - Each card lists vehicle, short note and a link to the details page.
- The table below is server-filtered to their open assigned tasks (item 21).
- Push:
  - assignment and updates (T4-C)
  - a **daily digest cron** `api/cron/maintenance-digest` at 07:00 Africa/Harare sends each worker "You have N tasks today (M overdue)". Protect it the same way as `api/cron/invoice-reminders`, and register it wherever the existing crons are scheduled (Coolify scheduled task).
- Pitfall: timezones. Compute "today" in `Africa/Harare` (UTC+2) and not the server's UTC, or tasks created after 22:00 land on the wrong day.
- **Accept when:**
  - A worker with 2 today, 1 overdue and 1 tomorrow sees the cards with counts 2/1/1.
  - Triggering the cron with the secret produces one push per worker with a task.
  - A worker with zero tasks gets no push.

### 5. Trip message delivery status — no silent failures
Current state:
- Auto-send on trip creation (`operations/trips/actions.ts:97-100` → `lib/whatsapp-notifications.ts:411-487`) ignores the send result and always logs ✅.
- It writes no `Notification` row and never sets `driverNotified`.
- The manual button uses a **different** client, the app's in-process one, and has a `tripNumber: undefined` bug (`trips/[id]/actions.ts:39`).
- The agent `/sendMessage` route drops the returned message id (`agent/src/index.ts:103-106`).
- `api/agent/workflows/route.ts:120-138` writes non-existent columns `responseAt` and `responseData`.

Decision: use the agent bot for everything.

Schema: extend `Notification` with
- `organizationId String?`
- `tripId String?` (relation to `Trip`, indexed)
- `recipientName String?`
- `waMessageId String?`
- `deliveredAt DateTime?`, `readAt DateTime?`
- `status`: `pending | sent | delivered | read | failed`
- fix or add the fields the workflows route expects, or change that route to match

Flow:
1. Insert a `Notification(status:"pending")`.
2. Call the agent.
3. The agent returns `{success, messageId}` (fix `index.ts:103`) and fails with a clear error when the WhatsApp client isn't ready.
4. Update the row to `sent` with `waMessageId` and `sentAt`, or to `failed` with `error`.
5. Set `trip.driverNotified` only on success.

Delivery receipts:
- Add a `message_ack` listener in `agent/src/lib/whatsapp.ts`.
- On ack ≥ 2 (delivered) or 3 (read), POST to a new `app` endpoint `POST /api/agent/notifications` with `{action:"ack", waMessageId, ack}`, authenticated by `withAgentAuth` and the same `AGENT_API_KEY`.
- The app updates `deliveredAt`/`readAt`.
- This follows the repo's action-dispatch protocol. Add the matching `notificationsApi` in `agent/src/lib/api-client.ts`.

Point the manual "Notify driver" button (`notify-driver-button.tsx`) at the same agent-backed function, and delete the unused `notify-driver-button-new.tsx`. Fix the message template to use real trip fields (origin → destination, scheduled date, truck reg, customer).

UI on the trip details page, a "Driver notification" field:
- "✓ Sent to {driver name} (+263…) · 14:02" → "Delivered 14:03" → "Read 14:10"
- or "✗ Failed: WhatsApp not connected — [Resend]"
- or "Not sent — driver has no WhatsApp number"
- Also add a small status icon on the trips list.
- `createTrip` returns `{success:true, notify:{status,error}}`, and the create form toasts a warning on failure.

Failures also create a `UserNotification` and push to admins (T4-C), e.g. "Trip message to Tendai failed".

Pitfalls:
- A driver without `whatsappNumber` falls back to `phone`, normalised to E.164 (+263). Record which number was used.
- The agent being down must never block trip creation.
- Resending must not create duplicates: keep a history of attempts and show the latest.

**Accept when:**
- With the agent running and paired: create a trip, and within seconds the trip page shows Sent, then Delivered/Read once the phone receives it.
- With the agent stopped: trip creation succeeds, a toast warns, the trip page shows Failed with the reason and a working Resend, and admins get a notification.
- The message text contains no "undefined".

### 22. Expense category details page — `finance/expense-categories/[id]/page.tsx`
- Contents:
  - header totals for the period: total, count, average, and a trend vs the previous period
  - a monthly bar chart **with the year in its labels**
  - a table of every expense in the category: date, amount, description, vendor/supplier, linked truck(s)/trailer(s)/trip(s)/driver(s), paid status, account
- Filters (URL params, so the page can be shared or bookmarked): period (universal selector), truck, trailer, trip, driver, supplier, paid/unpaid.
- Export PDF/CSV using the T5-C kit, honouring the same filters.
- Visible to admin and supervisor (and staff read-only if the nav allows); only admin can edit or delete the category.
- Link to it from the category list rows and from item 18's drill-down.
- Pitfall: an expense linked to 2 trucks must appear once in the table, not once per link. Use `expense.findMany` with `some` filters, not a join-table scan.
- **Accept when:** the filter combinations return the same totals as a hand SQL query, and the export matches the screen.

### 24. Graph audit — fix each concrete defect
1. **One revenue definition.** Create `lib/metrics/revenue.ts`:
   - **Revenue (earned)** = `trip.revenue` of trips with status `completed`, dated by `endDate ?? scheduledDate`, excluding cancelled.
   - **Cash collected** = payments.
   - Use it on the dashboard stat cards, `performance-trend.ts`, `revenue-expenses.ts`, the trucks/drivers pages and reports.
   - Label each chart with which measure it shows. Today the dashboard mixes three definitions (`dashboard/page.tsx:70-80, 147-151, 214-220`).
2. Month labels on all charts include the year (`revenue-expenses.ts:31`, `performance-trend.ts:101`), e.g. "Jan '26".
3. `trips-analytics.tsx:81` and `expenses-analytics.tsx:92`: `.slice(-6)` over descending data takes the **oldest** 6 months, reversed. Sort ascending by month key and then take the last N. Replace the hardcoded "Last 6 months" with the selected period.
4. `performance-trend-chart.tsx`:
   - The tooltip adds "$" when value > 1000. Format by series instead: money vs count.
   - Remove the hardcoded "past 12 months" text.
   - The axis label becomes "Amount ($)".
5. `operations/expenses/page.tsx:71-78`: the Pending/Paid pie is hardcoded. Compute it from `isPaid`.
6. `driver-performance.ts:89`: rating is hardcoded to 4.5. Remove the stars, or replace them with real metrics (on-time %, revenue per trip). "Efficiency" becomes completed-on-time ÷ completed, not ÷ all.
7. `fleet-utilization-chart`: it's really "Fleet status". Rename it, drop the duplicate % bar, map `decommissioned` and exclude it from totals. Optional real utilisation = days on trips ÷ days in period.
8. `trip-revenue-expense-chart.tsx`: a pie of revenue vs expenses is meaningless. Make it a horizontal bar of revenue, expenses and profit, plus margin %.
9. `drivers/page.tsx:80`: `licenseBreakdown` is always `[]`. Compute it (valid / expiring ≤30d / expired) or remove the chart. Add `suspended` to the status pie.
10. `expense-charts.tsx`: its own 30-day selector ignores the page period, so wire it to the page period. The by-truck/by-trip/by-driver views double-count shared expenses. Split the amount evenly across linked entities, and document the rule in the UI tooltip.
- **Accept when:**
  - For a seeded dataset, every chart's total equals the matching stat card and report for the same period.
  - Axes have units, labels have years, there are no hardcoded values, and nothing changes shape unexpectedly between 1m and 1y.

---

# T4 — Large

### T4-A. Item 2 — Filters that work everywhere, and reports/exports follow them
Standard: every list, detail and analytics page uses `getDateRangeFromParams(params, default)` (`lib/period-utils.ts:95`) and `<PagePeriodSelector>`. Every export and generate button receives `{ from, to }` from the current URL, never its own hardcoded range.

Missing today (add the selector and apply it to the queries):
- `customers/[id]`
- `employees` and `employees/[id]`
- `fleet/trailers` and `trailers/[id]`
- `finance/expenses/by-trip`, `by-truck`
- `inventory` and `inventory/[id]` (stock movements)
- `maintenance`
- `operations/trips/[id]` (expenses list is fine; show period-independent data but no selector)
- `suppliers/[id]`
- `edit-requests` (by `createdAt`)
- the new pages in this plan

Exports that ignore the period, to fix:
- customers-table.tsx:117-121
- invoices-table.tsx:151-155
- payments-table.tsx:120-124
- employees-table.tsx:122
- trucks/actions.ts:374-416 (also filter expenses, and use scheduledDate rather than createdAt)
- `exportDriversPDF`
- `exportTripsPDF` (trips/actions.ts:321)
- `exportExpensesPDF` (finance/expenses/actions.ts:510)
- `exportOperationsExpensesPDF`
- by-truck export
- `reports-client.tsx:43-45` (quick Generate uses the previous month)
- `exportDashboardPDF` (reports/actions.ts:496-505)

Implementation:
- A client hook `usePeriodRange()` reads `period`/`from`/`to` from `useSearchParams` and resolves them through the same `period-utils` function. It must be client-safe; check `period-utils` has no server imports.
- Every export button passes the result to its server action.
- Server actions validate and default the range.
- Every PDF header prints "Period: 1 Jul 2026 – 30 Sep 2026" (or "All time").
- Also fix the **single-entity exports that truncate before totalling** (trucks/actions.ts:469-576 `take:20/10`, drivers/actions.ts:475-504). Totals must be computed from an un-truncated aggregate, and tables may paginate.

Pitfalls:
- Inclusive end-of-day: `to=2026-09-30` must include 30 Sep 23:59 in CAT.
- Reset `page` to 1 when the period changes; the selector currently keeps pagination params (`period-selector.tsx:217-230`).
- `all` must not produce `Invalid Date`.
- Defaults differ: 1m vs 3m. Keep each page's default but show it in the selector.
- Staff can currently export revenue PDFs (trucks, trips, customers, invoices, payments use only `requireAuth`). Gate financial exports with `canViewFinancialData` while touching them.

**Accept when:**
- Matrix test: for each page × {7d, 3m, custom range, all}, the table rows, the cards and the exported PDF/CSV row count and totals all agree.
- A spreadsheet checklist of every page is committed in the PR description.

### T4-B. Items 1 + 18 — Truck profit/loss paper trail by expense category
Goal: answer "is this truck losing money, and **where**: fuel, repairs/downtime, tyres, tolls…?"

Admin-only section on `fleet/trucks/[id]` (admin-gated today via `showFinancials`):

1. **P&L summary for the period.** Revenue (canonical, T3-24) − expenses = profit, plus margin %, revenue per km and cost per km (using trip mileage), and a comparison with the fleet average.
2. **Expenses by category.** A sorted bar list with amount, % of total and a fleet-average comparison, where the category share is above average by 20%+. Expense sources, each tagged with where it came from:
   - `TruckExpense` (direct)
   - `TripExpense` for this truck's trips
   - optionally the currently or historically assigned trailer's costs, shown separately and not in the truck total unless toggled
3. **Drill-down.** Clicking a category expands (or opens `?category=`) a dated list of every expense in that category: date, amount, description, supplier, trip link and source. It links to the category details page (item 22) pre-filtered to this truck.
4. **Downtime and maintenance** (from item 17): request count, days in repair, open tasks.
5. **Fuel economics.** Show fuel spend per km and per trip, plus a monthly trend.
   - Needs a way to identify fuel categories. Add an optional `ExpenseCategory.kind String?` (`fuel | maintenance | tyres | tolls | permits | salaries | other`), set by admin on the category form. It is a plain string with a comment, per repo convention.
   - Don't match on category names.
   - Seed or migrate: suggest kinds for existing categories by name, and let admin confirm.
6. Remove the leak where the root trucks page sends full `truckExpenses` to the client when `showFinancials` is false (`fleet/trucks/page.tsx:24-66`).

Allocation rule, applied everywhere: an expense linked to N trucks counts `amount / N` per truck. Show a "shared" badge. Document it in a tooltip and in the report footnote. This fixes the double counting on the truck pages.

**New report `truck-cost-breakdown`**, registered in `config/reports.ts`, `config/report-tabs.ts` (Fleet tab), `reports/actions.ts` and the CSV generator, built on the T5-C kit:
- a per-truck P&L page
- category table
- top 10 expenses
- a monthly category trend table
- downtime
- a fleet summary page ranking trucks by profit, with each one's worst-over-average category

It covers one truck or all trucks, for the period.

**Accept when:**
- For a truck with seeded expenses across 4 categories, the category sums equal the total expenses card and the report.
- The drill-down lists each expense with its date.
- A shared expense counts half on each of 2 trucks.
- Supervisor, staff and workshop never receive this data. Check the RSC payload in the network tab, not just the UI.

### T4-C. Item 16 — Push notifications that actually work (all roles, key events)
Root causes found (all must be fixed):

1. **Only admins can subscribe.** The "Enable" card lives in Settings, which is `requireRole(["admin"])` (`settings/page.tsx:14`). Most tiers target supervisors, who can't subscribe, and workshop can't subscribe or be targeted at all.
   - Fix: move `PushNotificationsCard` into a user-level place available to every role: the user menu → "Notifications" dialog, plus a one-time dismissible banner on first login.
   - Also add a "Send test push" button that calls a new `POST /api/push/test` which pushes to the caller only.
2. **The public key is empty in Docker builds.** `app/Dockerfile:82-83` `ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=""` means the value must be passed as a **build arg** in Coolify.
   - Fix: serve the key at runtime from a tiny `GET /api/push/public-key` route (reads `process.env.VAPID_PUBLIC_KEY ?? NEXT_PUBLIC_…`), so the build no longer matters.
   - Log a clear warning at server boot if keys are missing.
3. Silent failures (`push.ts:17-26, 67`; `notifications.ts` swallow).
   - Fix: add a `PushDelivery` log (or reuse `Notification` with `type:"push"`): userId, title, status, statusCode, error, at.
   - Show "Last push: delivered / failed (reason)" in the user's notification dialog, and an admin table under Settings.
4. The performer is excluded (`notifications.ts:~190`), which makes self-testing look broken. Keep the exclusion but document it in the UI ("you won't be notified of your own actions"). The test button covers testing.
5. **Workshop isn't a Role in `notification-tiers.ts:40`**, and recipients come only from admin/supervisor (`notifications.ts:53-60`).
   - Fix: import `Role` from `lib/types.ts`.
   - Add a **targeted-recipient** path, `sendUserNotification({ userIds, … })`, that writes a `UserNotification` and pushes to exactly those users (assignee, requester), separate from tier broadcasts.
6. The service worker is registered only on click.
   - Fix: register `/sw.js` on app load for signed-in users (in the dashboard layout client).
   - Re-sync the subscription (`pushManager.getSubscription()` → POST upsert) on each load, so rotated or expired subscriptions and user switches on a shared device are fixed. On sign-out, DELETE the subscription for that user.
7. `sw.js`:
   - add `icon: "/web-app-manifest-192x192.png"`, a `badge`, `tag` (for dedupe) and `data.url`
   - `notificationclick` focuses an existing tab or opens `data.url`
8. iOS: web push works only for the installed PWA (16.4+). Detect iOS Safari that isn't in standalone mode and show "Add to Home Screen first" instructions. Check the manifest `start_url`, `scope` and icons.
9. `VAPID_SUBJECT` defaults to `mailto:admin@example.com`. Apple may reject a placeholder subject, so set a real one (operations@wd-logistics.co.zw).
10. **Security:** `.env.example:60-61` contains a real-looking VAPID key pair. Replace it with placeholders, **generate a new pair for production** (`bunx web-push generate-vapid-keys`), and tell the user that existing subscriptions will need re-enabling.

Key events that push. Each needs a `notification-tiers.ts` entry keyed exactly `${entityType}_${eventType}`, or it silently falls to the supervisor-only default (this bug already happened once). Add a startup/dev assertion that every call-site key exists in the tier map.

| Event | Recipients |
|---|---|
| maintenance assigned, reassigned or updated | assignee (and previous assignee) |
| maintenance fixed | admin, supervisor, reporter |
| daily maintenance digest | each workshop worker |
| edit request created | admins |
| edit request approved or rejected | requester |
| trip created or assigned | admin, supervisor |
| trip message failed | admin, supervisor |
| trip completed | admin |
| invoice overdue (cron) | admin |
| payment recorded | admin |
| account "money in" and large "money out" | admin |
| low stock | admin, supervisor (exists) |
| document expiry | admin, supervisor (exists) |
| user invited or joined | admin |

Each push deep-links to the entity page.

Add a per-user preferences screen (mute categories). Keep it minimal: on/off per category, stored on `UserNotification` preferences or a small new `NotificationPreference` table.

**Accept when:**
- On Chrome desktop, Android Chrome and an iOS home-screen PWA, each of the 4 roles can enable push, and "Send test" arrives within 5 s.
- Assigning a maintenance task pushes only the assignee.
- A staff edit request pushes the admin.
- The approval pushes the staff user.
- With a wrong or missing private key, the UI shows a failed delivery with the reason instead of nothing.
- Clicking a notification opens the right page.

### T4-D. Item 26 — Invoice redesign (blocked on the physical invoice image)
- Why it looks like a statement: `generateSingleInvoicePDF` (`pdf-report-generator.ts:2104-2243`) reuses the black-and-white report class:
  - it prints "For the period: {issue} to {due}" (config at 2146-2149)
  - it uses Field/Value grids and a signature block
  - **it omits line items entirely.** `downloadSingleInvoicePDF` (`invoices/actions.ts:476+`) doesn't include `lineItems`.
- Rebuild it on the T5-C brand kit, modelled on the receipt:
  1. Header: logo, org name, motto, and "INVOICE" (or "CREDIT NOTE") in green. Right side: invoice #, issue date, due date and status pill.
  2. Amount band: "AMOUNT DUE" (balance) in large green type, and the due date.
  3. Two columns: Bill To (customer name, address, phone, email, tax no.) and From (company address, phones, email, VAT/BP no.).
  4. Optional reference row: trip (route, truck reg, date) and customer PO/reference.
  5. **Line items table:** Description, Qty, Unit price, Amount. Fall back to one line from the trip when no line items exist.
  6. Totals block, right-aligned: Subtotal, VAT (rate), Total, Paid, **Balance due** in bold.
  7. Payment details (bank name, account, branch, EcoCash/other), stored in org settings. Add fields if missing, and don't hardcode them.
  8. Notes and terms (short), then the footer: "Thank you for your business", generated on, and Page x of y.
- Match the **information** on the client's physical invoice once the image is in `designs/photos/` (fields, labels, order). Match the **structure** of the receipt.
- No "for the period" line, no signature block and no Field/Value grids.
- Credit invoices: title "CREDIT NOTE", with amounts shown as credits.
- Pitfalls:
  - Long descriptions wrap without overlapping.
  - More than 15 line items paginate with the header row repeated and totals only on the last page.
  - Currency formatting uses one helper.
  - The invoice's `balance` is denormalized and must match `total − payments`. Assert this, and show the computed value if they differ, logging a warning.
- **Accept when:**
  - Side by side with the receipt, the same visual system (logo, colours, type scale, spacing) is used.
  - Every field on the client's physical invoice has a place.
  - A 1-item invoice fits on one page.
  - A 40-item invoice paginates correctly.
  - The client signs off.

---

# T5 — Hardest

### T5-A. Item 4 — Real edit requests + admin-only "money in"
Current state (why it's "not done"):
- **Every request is saved with `proposedData: {}`.** `requestEditTruck/Trailer/Driver/Trip` are one-click buttons, not forms (`trucks/actions.ts:322-364`, etc.), so approval applies nothing.
- The generic `createEditRequest` is never called.
- Only 4 entities have a request path.
- The approval switch (`edit-requests/actions.ts:51-194`) writes non-existent fields: driver `licenseExpiry`, customer `city`. It skips relations and dates, and doesn't recompute invoice balances.
- **Supervisors can approve and can edit directly.**
- Nothing is org-scoped: listing, badge count, approve/reject and the duplicate check.
- Admins aren't notified of new requests, and requesters never hear back.
- `canEditDirectly` and `canDeleteDirectly` exist in `permissions.ts:165-172` but are never used.
- The finance `updateExpense` action allows **staff** to mutate directly (`finance/expenses/actions.ts:154`), and supervisors can delete finance expenses and categories.

Design:
1. **Schema.** Add to `EditRequest`:
   - `organizationId` (backfill via `requestedBy → member.organizationId`)
   - `action String @default("update")` (`update | delete`)
   - `entityLabel String?` (e.g. "Truck ABC 222", for display)
   - `appliedAt DateTime?`
   - `applyError String?`
   - index `[organizationId, status]`
   - a partial unique index (raw SQL) on `(entity_type, entity_id) WHERE status='pending'`, so there's at most one pending request per record
2. **Permissions.**
   - `canEditDirectly` becomes `role === "admin"`, and `canDeleteDirectly` becomes `role === "admin"`.
   - `ROLE_PERMISSIONS.supervisor.canEdit` becomes false.
   - Approve and reject become admin-only (currently admin and supervisor at lines 197 and 253).
   - Use these predicates everywhere instead of inline role checks.
3. **One pattern for every editable entity:** truck, trailer, driver, trip, expense (finance and ops), invoice, payment, supplier payment, customer, supplier, employee, inventory item, expense category (admin-only anyway after item 23), maintenance request.
   - **Refactor** each `updateX(id, data)` into a pure core `applyXUpdate(tx, orgId, id, validatedData, actor)` that contains **all** side effects:
     - account reversals and re-debits for expenses
     - invoice `balance`/`amountPaid` recompute in the same transaction as payments
     - supplier balances
     - join-table relinks
     - driver-truck assignment events (T5-B)
   - The public `updateX` does: auth → Zod-validate `data` →
     - admin: `applyXUpdate` in `prisma.$transaction`
     - otherwise: create an `EditRequest` with `originalData` = a snapshot of **only the editable fields** of the current record, and `proposedData` = the validated payload (dates as ISO strings). Return `{ success:true, pendingApproval:true }`.
   - Deletes follow the same pattern via `applyXDelete`.
   - Edit pages open to supervisor **and staff** (the brief says "they are sent to the edit page"). Change `requireRole(["admin","supervisor"])` on the `[id]/edit/page.tsx` files, and replace the one-click "Request Edit" buttons with a normal **Edit** link.
   - The form shows a banner: "Your changes will be sent to an admin for approval". A required **Reason** field appears for non-admins. On submit: the toast "Sent to admin for approval", then redirect to the detail page, which shows a "Pending edit request" badge and disables a second edit.
4. **Approval** (`approveEditRequest`, admin only, org-scoped):
   - Load the request and the current record.
   - **Conflict check:** if any field in `originalData` differs from the current value, show "This record changed since the request was made" with a 3-way view (original / current / proposed). Admin can still approve (proposed wins) or reject.
   - Re-validate `proposedData` with the **same Zod schema**, rehydrating dates.
   - Call `applyXUpdate`/`applyXDelete` inside a transaction, and mark the request approved with `appliedAt`.
   - On failure, keep the request `pending` with `applyError` shown, and never half-apply.
   - `revalidatePath` for the entity pages.
   - Delete the old hand-written switch; the registry replaces it.
5. **Registry** `lib/edit-requests/registry.ts`: `entityType → { schema, loadSnapshot, apply, applyDelete, label, fieldLabels, formatters, href }`. It drives creation, the diff UI and application from one place, so new entities can't be forgotten. Add a dev assertion that every entity with an `[id]/edit` page has a registry entry.
6. **Reject:** admin only, with a required reason. The requester is notified and the request is cancelled; nothing changes.
7. **UI** (`edit-requests` page):
   - list scoped to the org, filterable by status, entity, requester and period
   - **diff view**: field label, current, proposed, with changed rows highlighted and money/dates formatted; delete requests show a "Delete this record" summary
   - Approve and Reject buttons
   - the org-scoped sidebar badge (`(dashboard)/layout.tsx:20-24`)
   - requesters get a "My requests" view
8. **Notifications:** created → admins (tier key `edit_request_created`; verify it matches the call site), approved or rejected → requester via targeted push and `UserNotification` (T4-C).
9. **Money in, admin-only:**
   - `finance/accounts/actions.ts:75-124` deposit: the server allows `"money in"` only for admin; `"money out"` stays admin and supervisor.
   - In the UI (`account-movement-dialog.tsx:91`, `permissions.ts:191`), hide the "Money in" option for non-admins.
   - Transfers (`:25-73`) and starting balance (`:132`) are already admin-only. Keep them that way and add server tests.
   - Expense reversals that credit an account happen only through admin edits or deletes, which follows automatically because non-admin edits become requests.
   - Customer payments and invoices stay creatable by supervisors; they don't touch accounts (`schema.prisma:575`).
10. **Fix alongside:**
    - `wipeAllData` (`settings/actions.ts:417-483`) deletes across **all orgs** and doesn't reset accounts. Scope it by org, include FinancialAccount and AccountTransaction, and require a typed confirmation.
    - Org-scope the category lookup in `finance/expenses/actions.ts:175`.
    - Validate that `defaultAccountId` belongs to the org.

Pitfalls:
- JSON can't hold `Date` or `Decimal`. Serialise as ISO strings and numbers, and rehydrate through Zod `coerce`.
- Relation fields (driverId, truckId, categoryId) must be re-validated as belonging to the org at approval time; they may have been deleted since the request.
- Image uploads in proposed data: the R2 file is uploaded at request time. If rejected, clean it up, or accept orphaned files and document that.
- The driver name is admin-only (`drivers/actions.ts:190`); the registry already makes that a request for everyone else.
- The trips table "Complete" button (`trips-table.tsx:151`) and inventory stock in/out/allocate are **operational actions, not edits**. Decide per action; the default is to keep them direct for supervisors, with the list noted in the PR. Status changes to a trip that affect money (revenue) go through a request.

**Accept when**, run for **each of the ~14 entities**:
- As supervisor, open Edit, change 2 fields, give a reason and submit. The record is **unchanged**, the admin gets a push, and the request shows the exact 2-field diff.
- Admin approves: the record now has the new values, all side effects are correct (account balance, invoice balance), and the supervisor is notified.
- Repeat with reject: nothing changes and the supervisor sees the reason.
- A second pending request on the same record is blocked.
- A staff or supervisor POST to the update action with a forged role or organisation fails.
- Supervisor delete creates a delete request, and approval deletes the record with cascades correct.
- Supervisor cannot see "Money in", and a direct call fails. Admin can.
- An admin in another org (simulate with a second org row) can't see or approve the request.

### T5-B. Item 25 — Driver revenue/profit with per-truck snapshots
- There's no assignment history today. Only `Driver.assignedTruckId` exists (`schema.prisma:325`), and it's set in three places: `assignDriverToTruck` (`trucks/actions.ts:203-252`), `assignTruckToDriver` (`drivers/actions.ts:283`) and `updateDriver` (`drivers/actions.ts:156-171`).
- The driver page shows no expenses, and its export truncates totals.

1. **Schema:**
   ```
   DriverTruckAssignment { id, organizationId, driverId, truckId, startDate DateTime, endDate DateTime?, startedById, endedById?, endReason String? /* reassigned|unassigned|driver_terminated|truck_decommissioned|backfill */, createdAt }
   ```
   - Index `[driverId, startDate]` and `[truckId, startDate]`.
   - Partial unique index for one open assignment per driver (`WHERE end_date IS NULL`) and one per truck.
2. **The "truck switch" event.** Create one service, `lib/assignments.ts` → `switchDriverTruck(tx, {driverId, truckId|null, at, actor})`, which:
   - closes the driver's open assignment
   - closes the truck's open assignment with a different driver
   - opens the new one
   - updates `Driver.assignedTruckId`
   - All three call sites and the edit-request apply path use it. Also call it on driver termination (status → terminated) and truck decommission or delete.
   - Allow an **effective date** (backdating, admin-only) in the assign dialog, because switches are often entered late. Validate no overlap with existing assignments.
   - Show a timeline event "Switched from ABC222 to AAD244 on 1 Apr 2026" on both the driver and truck pages.
3. **Backfill migration script** (`prisma/backfill-assignments.ts`, idempotent, dry-run flag):
   - Derive historical periods from trips: for each driver, order trips by `scheduledDate`, and group consecutive trips with the same `truckId` into a segment. Start = first trip date; end = the next segment's first trip date (or null for the current truck when it matches `assignedTruckId`).
   - Drivers with an `assignedTruckId` and no trips get an open assignment from `max(driver.startDate, truck.createdAt)`.
   - Tag `endReason:"backfill"`.
   - Print a report for admin review, and let the user confirm before it's applied to prod.
4. **Attribution** (the user chose to include truck costs). For a snapshot (driver D, truck T, window [s,e] clipped to the selected period):
   - **Revenue** = canonical revenue of trips where `driverId=D AND truckId=T` inside the window. Use the trip's own driver and truck, which is robust even if the assignment history is slightly off.
   - **Expenses:**
     - TripExpense of those trips
     - DriverExpense for D dated in the window
     - TruckExpense for T dated in the window (allocated `amount/N` when shared)
     - each shown as a separate line, so the admin sees what's driver-caused vs truck-caused
   - Profit = revenue − expenses, plus margin.
   - **Cumulative** (all snapshots in the period) = the sum of the snapshots plus any trips or expenses outside an assignment ("unassigned" bucket). That bucket makes totals reconcile. It shouldn't normally be needed, but it catches trips entered while the driver had another truck.
   - When a new snapshot starts, it begins at $0. The cumulative total continues.
5. **UI:**
   - The driver details page (admin sees financials) gets cards for the year to date or the selected period: revenue, expenses and profit, plus current truck and since when.
   - Link to a new **`fleet/drivers/[id]/performance`** page with the default period 3m and the universal selector:
     - a cumulative summary
     - a **timeline bar** of truck segments
     - a table with one row per snapshot: truck reg (linked), from–to, days, trips, revenue, trip expenses, driver expenses, truck expenses, profit, margin
     - expanding a row lists its trips and expenses
     - a cumulative line chart that resets per-truck colour bands, with an annotation marker at each switch
   - The truck details page gets the mirror view, "Drivers on this truck" snapshots.
   - Export: a new report `driver-performance`, driver-by-truck, in the T5-C kit plus CSV, and fix the driver export truncation (`drivers/actions.ts:475-504`).
6. Pitfalls:
   - Windows partially outside the period are clipped, and the table shows the clipped dates, e.g. "(from 1 Jul)".
   - A same-day switch: define windows as `[start, end)`.
   - A trip spanning a switch belongs to its own `truckId`, so no split is needed.
   - A driver re-assigned to the same truck later creates two separate snapshots, which is correct.
   - Timezone: store switch timestamps in UTC and display in CAT.
   - Admin-only financials: supervisors see the timeline without money. Check the payload.

**Accept when**, using the client's own example seeded (ABC222 Jan–Apr → AAD244 Apr–Jun → FEJ3874 Jul–Dec):
- The performance page for "1y" shows 3 snapshots with the correct date ranges and revenue per truck.
- The cumulative total equals the sum of the snapshots plus the unassigned bucket.
- For "3m" (Jul–Sep), only the FEJ3874 snapshot shows, clipped.
- Switching trucks in the UI closes and opens assignments, and the new snapshot starts at $0.
- The backfill run twice produces no duplicates.

### T5-C. Items 3 + 27 — One branded document system for every PDF, and a report audit
Current state:
- The **receipt** (`lib/reports/receipt-generator.ts`, jsPDF) is the gold standard: logo, green `#16A34A` / light `#DCF5E3` / blue `#2563EB` / ink `#1F2937` / muted `#6B7280` / border `#E5E7EB`, Helvetica, an amount band, light-green table headers and a footer.
- **Everything else** (all reports, the invoice and about 20 list or single-entity exports) uses the black-and-white Times `PDFReportGenerator` (`pdf-report-generator.ts:133-406`).
- The Word export (`word-report-generator.ts`) is plain.
- Three react-pdf files are dead: `pdf-generator.tsx`, `expense-report-template.tsx` and `financial-report-template.tsx`, plus `financial-data-fetchers.ts`.
- There's no shared theme module.

Plan:
1. **`lib/documents/brand.ts`:** colours, type scale, spacing and a cached logo loader, extracted from `receipt-generator.ts:24-43`. It is the single source; `receipt-generator` imports it. Company details (address, phones, email, VAT/BP no., bank details) come from the Organization/settings, falling back to `site/src/lib/site.ts`'s COMPANY values.
2. **`lib/documents/kit.ts`**, jsPDF primitives:
   - `drawHeader({title, docNo, date, statusPill})`
   - `drawHighlightBand`
   - `drawPartyBlocks`
   - `drawMetaGrid`
   - `drawTable` (an autoTable preset: light-green header, zebra rows, right-aligned numerics, repeated header on page break)
   - `drawTotals`
   - `drawNotes`
   - `drawFooter` (page x of y via a final pass, generated-by, doc number)
   - `drawPeriodLine`
   - `drawKpiRow` for reports
3. **Re-implement `PDFReportGenerator`'s renderers** (`renderHeader`, summary, sections, notes, footer, signature) on the kit, keeping its `ReportConfig` API. All ~25 existing callers restyle at once, with no per-caller rewrites.
   - Remove the signature block from reports, or keep it only where the client wants it, such as payment vouchers.
   - Reports use one structure: header → period line → KPI row → sections (tables) → notes → footer.
4. Delete the dead react-pdf files once nothing imports them (confirm with a grep).
5. **Word export:** apply the same header (logo image via `ImageRun`), colours and table header shading.
6. **CSV:** add a header row of metadata (report, period, generated) as an option. It is off by default for machine use.
7. Pitfalls:
   - The logo loader uses `fs` and `process.cwd()/public`. This works in the full-tree Docker image, but the kit must stay **server-only** (never import it in a client component; add `import "server-only"`).
   - jsPDF built-in Helvetica has no `₦`/special glyphs. That's fine for "$", "US$" and "ZWG", but check any non-ASCII customer names (é, ô). If they're garbled, embed a TTF (e.g. Inter or DM Sans to match the website) via `addFileToVFS`, subset it, and watch PDF size.
   - Page-count "of y" needs a two-pass render: draw footers after the content, then loop over the pages.
   - Wide tables (trip lists with 10 or more columns) switch to landscape automatically.
   - Keep each file's metadata (title, author).
8. **Report audit.** Existing: profit-per-unit, revenue, expenses, customer-statement, trip-summary, truck-profitability, account-ledger, truck/trailer/trip-expenses, dashboard summary. Add, so admin can make decisions:
   - **Profit & Loss statement** (period, by month, revenue by customer, expenses by category)
   - **Aged receivables / debtors** (current, 30, 60, 90+ days, per customer)
   - **Creditors / supplier payables** (unpaid expenses and supplier balances, aged)
   - **Cash flow by account** (Cash, Bank, Petty cash: opening, in, out, closing)
   - **Truck cost breakdown** (T4-B)
   - **Driver performance by truck** (T5-B)
   - **Fleet maintenance and downtime** (items 17 and 19)
   - **Fuel report** (fuel cost per km and per litre per truck, using category `kind`)
   - **Customer profitability** (revenue and trips per customer, average rate, outstanding)
   - **Expense category report** (item 22)
   - **Document expiry report** (next 90 days, trucks, trailers and drivers)
   - **Inventory valuation and stock movements**
   - **Trip P&L** (existing per-trip export; bring into Reports)

   Each new report is registered in `config/reports.ts`, `config/report-tabs.ts`, `reports/actions.ts` and `csv-generator.ts`, and honours the period (T4-A). Keep the whole Reports feature admin-only.

   Also audit each existing report for:
   - the correct revenue definition (T3-24)
   - no truncated totals
   - period applied
   - empty-state output ("No data for this period"), never a blank table

**Accept when:**
- Open one PDF of every type (receipt, invoice, credit note, customer statement, every report, and every list or single-entity export). All share the header, colours, fonts, table style and footer with page x of y.
- No Times font remains (grep for `"times"` in `lib/reports`).
- Nothing imports the dead files.
- Each report's totals match the in-app page for the same period.
- A 0-row period renders a clean empty state.
- Word export shows the logo.

---

## Things likely to be overlooked (cross-cutting checklist)
- **Type errors ship silently** (`ignoreBuildErrors: true`). Always diff `tsc` against the baseline.
- **Org scoping** is missing in several places: edit requests, `wipeAllData`, category lookups. Every new query has `organizationId`.
- **Server-side role enforcement, not just hidden buttons.** Test by invoking the action as the wrong role. `requireRole` redirects instead of returning an error, so use a returning helper inside actions called from client forms.
- **RSC payload leaks.** Financial data passed to client components for non-admins (the trucks page) is visible in devtools even if not rendered.
- **Notification tier keys** must match exactly, or they fall to the supervisor-only default.
- **Denormalized money** (`Invoice.balance/amountPaid`, account balances, supplier balances) is updated in the same transaction. `recordAccountMovement` checks the balance and decrements in separate steps (race). Wrap it in a transaction with `SELECT … FOR UPDATE` or a conditional `updateMany where balance >= amount`.
- **Payments without an invoice** (`invoiceId` nullable, no `organizationId` on Payment) never appear on the payments page or in revenue. Add `organizationId` to Payment, or require an invoice. Raise this with the user.
- **Timezone:** CAT (UTC+2) for "today", period boundaries, crons and PDFs.
- **Mobile:** every new page and dialog at 375 px, especially the workshop view, which will mostly be used on phones.
- **Docs:** update `CLAUDE.md` (edit-request design, push architecture, assignments model, document kit, `site/`), `FIX_PLAN.md` gotcha #4 and `lessons/*.md` for the new permissions.
- **Seed data:** extend `prisma/seed.ts` with a workshop user, trailer maintenance, assignment history (the ABC222/AAD244/FEJ3874 example), expenses across categories and kinds, and pending edit requests, so every acceptance test has data. `ensure-admin.mjs` stays untouched.
- **Coolify ops the user must do:**
  - new app for `site/`
  - new VAPID keys and a real `VAPID_SUBJECT`
  - the maintenance-digest cron
  - apply migrations
  - run the assignment backfill after review

## Verification (end-to-end)
1. After each item: `bunx tsc --noEmit` (no new errors vs the baseline), `bun run lint` (no new warnings), then `bun run build` for `app/` (and `site/` for T1).
2. Start `app` (`preview_start`), the `agent` (for items 5 and 16) and `site`. Click through each item's **Accept when** list under each role (admin, supervisor, staff, workshop). Check `read_console_messages` and `preview_logs` for errors, and `read_network_requests` for financial data in RSC payloads.
3. Check the data layer with throwaway `bun -e` scripts against `@/lib/prisma` (e.g. an edit request's `proposedData` is non-empty; assignment rows after a switch; `Notification` status transitions). Delete the scripts and test rows afterwards.
4. PDFs: generate every document type and view them side by side with the receipt. Take screenshots for the user.
5. Push: physical-device test on Android plus an iOS PWA, with the test button for each role, then real events (assign, edit request, approval).
6. Website: screenshots at 375, 768, 1320 and 1920 px of the hero, marquee and footer.
7. Commit one item (or tightly coupled pair) per commit, with messages referencing the item number. Summarise any skipped or partial work honestly in `FIX_PLAN.md`'s status table.
