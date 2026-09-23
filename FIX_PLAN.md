# WD Logistics — Fix & Feature Plan

**Written:** 2026-09-18, by Claude (Sonnet 5) at the end of a long session, handing off to a fresh AI session because the current one is nearly out of budget.

**Purpose of this document:** a citation-backed plan for the issues below. **No code is included on purpose** — the next session should read the cited files, understand the actual current implementation (it may have shifted slightly since this was written — other people/AI sessions are actively committing to this repo), and write the fix itself. Everything below was verified by reading the real code, not guessed.

---

## 0. Status snapshot — updated 2026-09-18 (a later session worked the plan)

Every issue below was picked up in one session. Five are **done**, one is **half done and blocked on ops**, one was **deliberately partial**. Commits, oldest first:

| Issue | Title | Status | Commit |
|---|---|---|---|
| A | Expense creation crashes on `expense_supplierId_fkey` | ✅ **Done** | `cbd47c5` |
| B | Emails aren't sending (two layered problems) | ⚠️ **Code half done; infra half still open** | `5727081` |
| C | Workshop role's dashboard is irrelevant | ✅ **Done** | `b70a12a` |
| F | Inventory movements need a monetary value | ✅ **Done** | `d172d61` |
| D | Errors should speak plain English | 🟡 **Helper built, rolled out to 7 of ~25 action files** | `ec9a2c3` |
| E1 | Reports "Generate" button isn't tab-aware | ✅ **Done** | `1f92a20` |
| E2 | Export buttons missing in several places | ✅ **Done** | `086966b` |
| E3 | Expenses-only report variants (truck/trip/trailer) | ✅ **Done** | `1d44359` |

Each section below carries its own status note. Every "may have shifted since this was written" caveat in this document was re-verified against the live code before the fix was written — the citations below were all still accurate.

---

## 1. Project overview (read this first if you have no prior context)

**WD Logistics** is a fleet/logistics management system for a Zimbabwe-based trucking company. Two independent services in one repo:

- **`app/`** — Next.js 16 (App Router, Turbopack) web app. Dashboard, fleet/trip/finance management, auth, reporting. Source of truth for the database. This is almost certainly the only part relevant to everything in this document.
- **`agent/`** — a standalone Hono + Mastra.ai server for an AI chat/WhatsApp assistant. No direct DB access; talks to `app` over HTTP. Not touched by anything below.

Read `app/CLAUDE.md` (or the repo-root `CLAUDE.md` if one exists) for the full architecture writeup — auth model, Server-Actions-not-REST convention, Prisma schema shape, deployment notes. It's accurate and detailed; don't skip it.

### Stack quick-reference
- Next.js 16 App Router, Turbopack, React (with `reactCompiler` **currently disabled** — see Gotcha below), TypeScript, Tailwind v4, shadcn/ui, Radix.
- Prisma 7, custom client output at `app/src/generated/prisma` (import via `@/lib/prisma`, never `@prisma/client` directly). Postgres via `@prisma/adapter-pg` (the `prisma-client` generator has no bundled engine, so a plain `postgresql://` URL requires the adapter — already wired in `src/lib/prisma.ts`).
- `better-auth` with the `organization` plugin, single-org (`organizationLimit: 1`). Authorization is driven by `Member.role`, a plain string, **not** better-auth's own roles.
- No test runner configured in `app/`. Don't invent one; verify by reading code + running the dev server + hitting real DB queries directly with small scripts (see "How to verify" below).
- Deployed via **Coolify** (self-hosted PaaS) — "production" environment. The Coolify UI has Deployments, Git Source, webhooks, etc. Deploys are presumably triggered by pushing to whatever branch Coolify's Git Source is configured to watch — check the Coolify "Git Source"/"Deployments" tab before assuming how to ship a fix.

### Roles (4, not 3 — this changed recently)
`admin` / `supervisor` / `staff` / `workshop`. `workshop` is new and very narrow (see Issue 3). Role type: `app/src/lib/types.ts`. Permission predicates: `app/src/lib/permissions.ts`. Nav gating: `app/src/config/navigation.ts` (each nav item has its own `roles: Role[]` array — this is the *only* thing that hides a link; it does **not** block direct URL access, see Issue 3).

### Recently added features (last few sessions, for context — all already shipped and committed)
- **Trailers** (`app/src/app/(dashboard)/fleet/trailers/`) — mirrors Truck, attaches to a truck not a driver. **No expense tracking, no revenue, no PDF export at all** — this matters for Issue 5/6 below.
- **Three-account accounting** (Cash/Bank/Petty Cash) — `app/src/lib/accounts.ts` (client-safe constants/types) + `app/src/lib/accounts-server.ts` (Prisma mutations — split specifically because the un-split version leaked the Postgres driver into the client bundle and crashed the Accounts page; keep this split intact). Accounts page at `app/src/app/(dashboard)/finance/accounts/`.
- **Maintenance requests** (`app/src/app/(dashboard)/maintenance/`) — admin/supervisor log a truck issue, `workshop` role resolves it. This is `workshop`'s whole reason to exist.
- **Truck Profitability report**, **Account Ledger report** — added to the Reports pipeline (`app/src/config/reports.ts`, `app/src/lib/reports/`).
- **Notification tier system** (`app/src/lib/notification-tiers.ts`) — every notification type is classified into a tier (1–5) controlling which roles/channels get it. If you add a new notification call site (`sendAdminNotification` in `app/src/lib/notifications.ts`), you likely need a matching tier entry keyed as `${entityType}_${eventType}` or it silently falls through to a supervisor-only default tier. This exact bug already bit a previous session (edit-request notifications went to nobody because the tier key didn't match) — don't repeat it.
- **Web push notifications**, **Inventory/Warehouse** (with a `StockMovement` ledger — see Issue 7), **document-expiry reminders** for trucks/drivers, real logo/branding — all recently added by other work on this same repo. Check git log before assuming a file doesn't exist yet.

### Gotchas learned the hard way this session — read before touching anything
1. **`reactCompiler: true` in `app/next.config.ts` crashes the entire app.** Every single page threw `Failed to construct 'Image': Please use the 'new' operator` inside Next's compiled `<Image>` component — confirmed on unrelated pages (Dashboard, Reports), so it's a global React Compiler / Next 16 / Turbopack incompatibility, not a code bug in this repo. It is currently set to `false`. **Do not re-enable it** unless you've confirmed upstream has fixed the incompatibility — if you find it's `true` again, that's very likely why nothing renders.
2. **Migrations are sometimes hand-written**, not generated, because earlier sessions had no live database to run `prisma migrate dev` against. If you add a schema change (e.g. Issue 5's `TrailerExpense` model), check whether a real dev database is reachable (`app/.env`'s `DATABASE_URL`) before deciding whether to run `bun run db:migrate` normally or hand-write SQL matching the existing migration files' style (`app/prisma/migrations/*/migration.sql`).
3. **This repo has multiple people/AI sessions committing concurrently.** Before starting, run `git log --oneline -20` and `git status` to see what's actually there right now — several things described in this doc as "missing" may have been half-started by someone else since this was written. Verify, don't assume.
4. **The `EditRequest` workflow is a flag-and-reason system, not a diff/approval system**, by design, consistently across the whole app — staff describe *why* they want a change, admin reviews the reason and edits the record themselves afterward. `originalData`/`proposedData` are always saved empty and never rendered anywhere. This is intentional, not a bug — don't "fix" it into a diff viewer unless the user explicitly asks.
5. **Prefer Server Actions over API routes** for anything in `app/src/app/(dashboard)/**` — that's the established pattern (`actions.ts` colocated per feature folder). Only `api/agent/*`, `api/auth/*`, `api/upload`, `api/cron/*`, `api/whatsapp/*`, `api/push/*` are real API routes.

### How to verify a fix without a test runner
- `bunx tsc --noEmit` (run from `app/`) — catches real type errors; there is a baseline of ~54 pre-existing unrelated errors in files nobody's touching (payment nullability, whatsapp-notifications, use-push-notifications) — don't let those block you, just confirm your change doesn't add *new* ones (`grep` the output for your changed files).
- `bun run lint` (from `app/`) — has pre-existing warnings too; same approach.
- Start the dev server and actually click through the feature in a real browser. This repo has bitten multiple sessions with "typechecks fine, crashes at runtime" bugs (the React Compiler crash, the Prisma-in-client-bundle crash) — **typecheck passing is not sufficient**, load the page.
- For data-layer changes, a small throwaway script run via `bun -e "..."` or a scratch `.ts` file importing `@/lib/prisma` directly (delete it after) is the fastest way to verify Prisma logic without going through the UI. Clean up any test rows you create.

---

## 2. Issues, in suggested priority order

### Issue A — [Critical, production] Expense creation crashes: `expense_supplierId_fkey` violation

> **✅ DONE — commit `cbd47c5`.** `createExpense` and `updateExpense` in `finance/expenses/actions.ts` now look the supplier up by `{ id, organizationId }` before writing, exactly the way `categoryId` already was, and return a friendly error instead of letting Prisma throw the FK violation (step 1). Step 2 checked: `operations/expenses/actions.ts` has **no** supplier-linked create or update path (grep for `supplier` in that file returns nothing), so there was nothing to mirror. Step 3 (UI re-fetch on focus) was deliberately skipped — the server-side re-validation is the actual fix and the stale-option polish is cosmetic.

**Symptom (from production Coolify logs):**
```
Invalid prisma.expense.create() invocation:
Foreign key constraint violated on the constraint: expense_supplierId_fkey
```

**Root cause, fully confirmed:**
- `createExpense` in `app/src/app/(dashboard)/finance/expenses/actions.ts:29-116` validates `data.categoryId` exists (line 33-36) but **never validates `data.supplierId`** before passing it straight into `tx.expense.create()` (line 39-64, `supplierId` set at line 47). Same gap in `updateExpense` (line 118-269, supplierId used at ~180-185/197 with no existence check).
- The supplier picker is populated **once, server-side, at page load**: `app/src/app/(dashboard)/finance/expenses/new/page.tsx:103-115` fetches active suppliers and passes them as a static prop into `ExpenseForm` (`app/src/app/(dashboard)/finance/expenses/_components/expense-form.tsx:351-373`). There's no client-side refetch while the form is open.
- `deleteSupplier` (`app/src/app/(dashboard)/suppliers/actions.ts:105-142`) does block deleting a supplier that already has expenses (line 120-125), but that check only sees expenses that exist *at delete time* — it can't know about an in-flight "new expense" form open in someone else's browser tab.
- **Net result:** User A opens "New Expense" with a supplier pre-selected → User B deletes that supplier (it currently has zero expenses, so the guard passes) → User A submits → `createExpense` passes the now-nonexistent `supplierId` straight to Prisma → FK violation, expense lost, generic "Failed to create expense" shown to User A with no explanation.
- There is **no second entry point** for this — `app/src/app/api/agent/expenses/route.ts` doesn't exist, so the AI agent isn't a factor here (confirmed via grep across `api/agent/*`).

**What needs to change:**
1. In `createExpense` and `updateExpense` (`finance/expenses/actions.ts`), when `data.isBusinessExpense && data.supplierId` is set, look the supplier up (`prisma.supplier.findFirst({ where: { id, organizationId } })`) **before** attempting the expense create/update, exactly the way `categoryId` is already validated a few lines above. If not found, return a friendly error (ties into Issue B below) like *"The selected supplier no longer exists — it may have been deleted. Please pick another supplier."* instead of letting Prisma throw.
2. Consider the same fix for `app/src/app/(dashboard)/operations/expenses/actions.ts` if it has an equivalent supplier-linked path (wasn't in scope of this session's research — check it).
3. Optional but worth considering: make the supplier `<Select>` in `expense-form.tsx` re-fetch on dialog/page focus, or at minimum disable stale options gracefully — but the server-side re-validation in (1) is the actual fix; the UI polish is secondary.

---

### Issue B — [Critical, production] Emails aren't sending — two separate problems layered together

> **⚠️ HALF DONE — code half in `5727081`; the infra half is still open and is not a code problem.**
>
> **Problem 2 (the code bug) is fixed.** Rather than auditing every `.success` check (step 2's second option), `sendEmail` in `src/lib/email.ts` was changed to **throw** on failure — bad SMTP config, `ECONNREFUSED`, anything — and to throw when `SMTP_HOST` is unset instead of returning `{ success: false }`. That makes the *already correctly written* handlers work for free: the `.catch(...)` blocks in `finance/invoices/actions.ts` (lines ~121/137) and the `try/catch` in `finance/invoices/[id]/actions.ts` and `api/cron/invoice-reminders/route.ts` now actually fire, so "Invoice sent successfully" can no longer be shown for an email that never left. The four call sites that must survive a failed email because the account is already created (`users/actions.ts`'s `createSupervisor`/`resetUserPassword`, `settings/actions.ts`'s `inviteMember`, `api/users/invite/route.ts`) were each wrapped in a local `try/catch`, so they still create the account and fall back to "email failed, share this password manually". Verified live with no SMTP configured.
>
> **Still open (step 1, the actual production outage):** `ECONNREFUSED 84.247.140.218:587` is the Coolify container failing to reach `mail.wd-logistics.co.zw` at the TCP level. That needs someone with access to the Coolify host — check the mail server is up on 587, that outbound SMTP isn't firewalled, and that this hostname is even the intended production value (it still doesn't match `.env.example`'s Gmail defaults).
>
> **Still open (step 3):** there is no in-app signal for a failed email. Failures now propagate into existing error handling instead of vanishing, but the plan's suggestion of a dedicated `email_delivery_failed` tier-1 notification was not built.

**Symptom (from production Coolify logs):**
```
Attempting to send email to: kinzinzombe07@gmail.com
Using SMTP config: { host: 'mail.wd-logistics.co.zw', port: '587', secure: 'false', user: 'joash@wd-logistics.co.zw', hasPassword: true }
❌ Failed to send email: Error: connect ECONNREFUSED 84.247.140.218:587
```

**Problem 1 — infrastructure, not code.** `ECONNREFUSED` at the TCP level means the Coolify container cannot reach `mail.wd-logistics.co.zw` on port 587 at all (nothing listening, or blocked by a firewall/network policy between the Coolify host and that mail server). **This is not something a code fix can solve.** The next session should tell the user directly: confirm from the Coolify host itself (e.g. a shell into the running container, or `nc -zv mail.wd-logistics.co.zw 587` / `telnet`) whether that port is reachable; check whether the mail server is actually up and accepting connections on 587; check whether Coolify's network/firewall rules allow arbitrary outbound SMTP (some hosts block outbound 25/587 by default); consider whether `mail.wd-logistics.co.zw` is even the intended host — it doesn't match `.env.example`'s documented Gmail defaults, so confirm this is deliberate production config and not a leftover/wrong value.

**Problem 2 — real code bug: failures are completely invisible.** Confirmed by reading `app/src/lib/email.ts`:
- `sendEmail()` (lines 48-82) **never throws or rejects** on failure — the catch block (78-81) logs to console and returns `{ success: false, error: ... }`, but the promise itself always resolves successfully as far as `await` is concerned.
- Every caller either does `.catch(...)` (which will never fire, since nothing rejects) or `await`s the call and then unconditionally returns `{ success: true }` **without checking the returned `.success` field**. Confirmed call sites: `finance/invoices/actions.ts:101-122,125-138,459-473`, `finance/invoices/[id]/actions.ts:108-129`, `api/cron/invoice-reminders/route.ts:136-150` (even increments `results.emailSent++` on a silent failure), `users/actions.ts:272`, `settings/actions.ts:204`.
- **Consequence:** even once the infra problem is fixed, if SMTP fails again for any reason in the future (wrong password, mail server maintenance, rate limit), no admin will ever know — it only ever reaches `console.error`, nothing user-facing.

**What needs to change:**
1. Fix the infra issue first (see above — likely a Coolify/network/DNS conversation, not a PR).
2. In `email.ts`, decide whether `sendEmail` should reject on failure (so `try/catch` callers work as already written) or keep returning `{success,error}` but **audit every caller to actually check `.success`** and act on it. The second option is less invasive given how many call sites already assume the `{success,error}` shape.
3. Add *some* visible signal when an email fails — at minimum, log it distinctly enough to alert on; ideally, surface it in-app (e.g., a small "last invoice email failed to send" indicator on the invoice, or route it through the existing admin-notification system in `notifications.ts` as its own tier-1/tier-2 event) so this class of failure is never silent again. There's precedent for exactly this kind of urgent-alert tier already (`account_insufficient_funds`, `document_expired` in `notification-tiers.ts`) — a `email_delivery_failed` tier-1 entry would fit the existing pattern.

---

### Issue C — Workshop role's dashboard shows completely irrelevant information

> **✅ DONE — commit `b70a12a`.** All four steps landed:
> 1. `"workshop"` was removed from the Dashboard nav item's `roles` in `config/navigation.ts`.
> 2. `dashboard/page.tsx` no longer uses bare `requireAuth()` — it now gates with `requireRole(["admin", "supervisor", "staff"])`, so typing the URL directly is blocked too, not just the nav link.
> 3. Both post-login redirects are fixed *without* hardcoding a role check in two places: a new client-safe `src/lib/landing.ts` exports `getLandingPath(role)` (returns `/maintenance` for workshop, `/dashboard` otherwise). `sign-in/page.tsx` now pushes `/` instead of `/dashboard`, and `app/page.tsx` resolves `/` through that helper.
> 4. `requireRole`'s fallback redirect in `session.ts` also goes through `getLandingPath`, so a workshop user bounced off any role-gated page now lands on `/maintenance` rather than ping-ponging off `/dashboard`. `sidebar.tsx` uses the helper for its home link too.

**User's own words:** *"The maintenance role's dashboard is severely wrong, it has info that has nothing to do with the user at all... just show them the maintenance screen only in their sidebar, no dashboard screen at all, that's the only relevant screen to them."*

**Root cause, fully confirmed:**
- `app/src/config/navigation.ts:51` currently grants `workshop` the Dashboard nav item (`roles: ["admin", "supervisor", "staff", "workshop"]`). It should not.
- `app/src/app/(dashboard)/dashboard/page.tsx:30` gates with plain `requireAuth()` — **no role check at all**. Even if the nav link is removed, `workshop` can still load `/dashboard` directly by URL.
- What `workshop` currently sees there (confirmed by reading the whole file): stats cards (active trucks, trips, revenue, overdue invoices), and — because `canViewFinancialData(role)` (`permissions.ts:160-162`, admin-only) hides the financial charts — the fallback branch at lines 222-239 shows Trip Status Distribution, Fleet Utilization, and Recent Trips instead. None of this relates to maintenance work.
- Post-login landing is hardcoded to `/dashboard` for every role, in two places: `app/src/app/(auth)/sign-in/page.tsx:44` (`router.push("/dashboard")`, unconditional) and `app/src/app/page.tsx` (root route, unconditional `redirect("/dashboard")` when a session exists). No `middleware.ts` exists in the project to intercept this at a higher level.
- `app/src/lib/session.ts`'s `requireRole()` (line 68-76) redirects disallowed roles back to `/dashboard` on failure (line 72) — this matters because once Dashboard excludes `workshop`, that fallback target needs to not be `/dashboard` for a workshop user, or it'll bounce them somewhere they also can't see.
- `app/src/app/(dashboard)/maintenance/page.tsx:8` already correctly gates with `requireRole(["admin", "supervisor", "workshop"])` — it's a valid landing target.

**What needs to change:**
1. Remove `"workshop"` from the Dashboard nav item's `roles` array (`navigation.ts:51`).
2. Add an actual role gate to `dashboard/page.tsx` itself — swap `requireAuth()` for something that redirects `workshop` away (e.g., an explicit `if (session.role === "workshop") redirect("/maintenance")` right after the session check, or change the gate to `requireRole([...all roles except workshop])`). Hiding the nav link alone is not sufficient — direct URL access must also be blocked, per the gotcha above.
3. Update the two hardcoded post-login redirects (`sign-in/page.tsx:44` and `app/page.tsx`) to send `workshop` users to `/maintenance` instead of `/dashboard`, so they land somewhere useful immediately after signing in rather than bouncing through a page they can't see.
4. Double-check `requireRole`'s fallback-redirect target (`session.ts:72`, currently always `/dashboard`) doesn't strand a `workshop` user who hits some other role-gated page — either make the fallback role-aware, or accept it as an edge case if `workshop`'s nav is narrow enough that this rarely triggers.

---

### Issue D — Error messages should speak plain English

> **🟡 PARTLY DONE — commit `ec9a2c3`.** Step 1 is done: a new `src/lib/error-messages.ts` (214 lines) takes a caught `unknown`, recognises `PrismaClientKnownRequestError` by `.code` and translates it (`P2002` → duplicate, `P2003` → "references something that no longer exists", `P2025` → "could not be found, may already have been deleted", and the other codes the app actually hits), falling back to the caller's existing generic `"Failed to X"` wording for anything else.
>
> Step 2's rollout covers 7 of the ~25 action files: `customers`, `finance/expenses`, `finance/invoices`, `finance/payments`, `inventory`, `operations/expenses`, `suppliers` — i.e. the highest-traffic and deletion-guard flows the plan named, plus the matching table components that surface the messages. The remaining action files still use their hand-written generic strings.
>
> **Deliberately incomplete, not abandoned** — the plan explicitly said not to touch all 104 catch blocks in one pass. The helper takes an optional fallback message so remaining files can adopt it one at a time. The Issue A expense paths were done first, as step 3 asked.

**User's own words:** *"Make errors make sense and speak in plain English wherever possible."*

**Current state, confirmed by reading the code (not just grepping):**
- There is **no shared error-formatting helper anywhere** in `src/lib/` — this is greenfield work, not an extension of something partial. (`src/app/error.tsx` exists but is only the Next.js route-level render-error boundary, unrelated to action-layer error messages.)
- **No application code anywhere catches Prisma error codes** (`P2002` unique violation, `P2003` foreign key violation, etc.) — confirmed via grep, the only matches for those symbols are inside the generated Prisma client itself. Every `catch (error)` block across all 25 `actions.ts` files under `(dashboard)/` treats every error identically.
- The good news: most existing `{ success: false, error: "..." }` messages (243 occurrences across 24 files) already use static, human-written strings like `"Cannot delete customer with associated trips or invoices"` rather than raw stack traces — so this isn't as bad as "raw errors are shown everywhere." The real gap is: (a) the *specific* Prisma error (which record/constraint failed) never gets translated into a specific message, it just becomes a generic "Failed to X"; (b) the true underlying error only ever reaches `console.error`, never the user.

**What needs to change (this is genuinely broad — the next session should scope it, not attempt all 25 files in one pass):**
1. Build a small shared helper (e.g. `src/lib/error-messages.ts`) that takes a caught `error: unknown` and returns a friendly string — at minimum handling `PrismaClientKnownRequestError` by `.code` (P2002 → "A record with this [field] already exists"; P2003 → "This references something that no longer exists — it may have been deleted"; P2025 → "That record could not be found, it may have already been deleted"), falling back to the existing generic "Failed to X" pattern for anything else.
2. Roll it out incrementally, starting with the highest-traffic/highest-risk flows: expense creation (ties directly into Issue A), invoice/payment actions, supplier/customer deletion guards. Don't try to touch all 104 `catch` blocks in one PR.
3. Specifically revisit `finance/expenses/actions.ts`'s catch blocks (lines ~109-115 and similar in `updateExpense`) as part of the Issue A fix — that's the natural first place to apply this.

---

### Issue E — Reports page: "Generate" button should be aware of the active tab; report exports needed across the app; truck/trip/trailer reports need expenses-only + expenses-vs-income variants

This is the largest item and should probably be split into 2–3 separate work sessions. Three related but distinct asks, confirmed separately:

> **✅ ALL THREE SUB-PARTS DONE** — E1 `1f92a20`, E2 `086966b`, E3 `1d44359`. The plan's staging held: E1 first, then the schema-free E2, then E3 with its `TrailerExpense` migration. Each sub-section below has its own note.

#### E1 — Generate button isn't tab-aware

> **✅ DONE — commit `1f92a20`.** Built exactly the way the fix direction described. New `app/src/config/report-tabs.ts` is the single source of truth: `TAB_REPORT_TYPES` maps each tab to its report types (first entry = the tab's primary report), `reportTypesForTab()` filters out any report type that no longer exists, and `needsSelection()` flags the reports that can't be produced without picking a truck/customer first. The top-right dropdown was extracted into a new `ReportsGenerateMenu` component driven by that mapping, and a new `GenerateReportLink` component renders per-tab "generate this" links that navigate to `?tab=generate&type=<type>` using the established `router.push` pattern. The hardcoded `reportType: "revenue"` is gone from `reports-client.tsx`; `reports/page.tsx` reads `params.type` and threads it down as `initialReportType`, which `ReportGenerator` consumes to pre-select the report.
>
> Not carried over: the plan also floated an `initialTruckId` for pre-selecting an entity. That wasn't needed for tab-awareness — `needsSelection()` routes those reports through the Generate tab's own picker instead — so it was left out rather than built speculatively.

- `ReportsDashboard` (`app/src/components/reports/reports-dashboard.tsx`) has 4 tabs (Overview/Financial/Fleet/Generate, lines 128-131) plus a top-right "Generate" dropdown (lines 133-170) that sits *outside* the tab content and renders identically no matter which tab is active.
- That dropdown's handlers, wired in `app/src/components/reports/reports-client.tsx`, are **hardcoded**: `handleGenerateReport` (lines 36-74) always requests `reportType: "revenue"` (line 44) regardless of the active tab. There's no read of the current tab in this file at all.
- The separate "Generate" tab renders the full `ReportGenerator` form (`app/src/components/reports/report-generator.tsx`) with its own manual report-type/period/truck picker — but it has no way to be pre-filled from context; its defaults are always blank (lines 91-96).
- Tab state is already URL-synced (`app/src/components/reports/reports-tabs.tsx:17-21`, sets `?tab=...` via `router.push`) and read server-side in `app/src/app/(dashboard)/reports/page.tsx:195` (`currentTab = params.tab || "overview"`). This is the pattern to extend, not replace.
- **Fix direction:** add a similar URL param (e.g. `?type=...`) that the Generate tab reads to pre-select a report type/entity, and add "Generate this report" buttons inside the Overview/Financial/Fleet tab content that navigate to `?tab=generate&type=<relevant-report-type>` using the same `router.push` pattern already established in `reports-tabs.tsx`. `ReportGenerator` will need a new prop (e.g. `initialReportType`/`initialTruckId`) to actually consume that param on mount.

#### E2 — Export buttons missing in several places

> **✅ DONE — commit `086966b`.** The three gaps in the table are closed:
> - **Trailers** now have both exports — list *and* detail. `trailers-table.tsx` gained a full export button with PDF/CSV format choice and the existing `ExportOptionsDialog` scope picker (current page vs. all filtered), plus `exportTrailersPDF` in `fleet/trailers/actions.ts` and a new `export-trailer-button.tsx` for the detail page. As the plan predicted, it's a registration/license/status/assigned-truck summary with no revenue or expense sections.
> - **Customers** got the detail-page export — new `customers/[id]/_components/export-customer-button.tsx` and a matching action, mirroring the Trucks/Drivers pattern.
> - **Expenses by truck** got the per-truck export the user specifically asked for — new `finance/expenses/_components/export-truck-expenses-button.tsx`, wired into the by-truck page's per-truck table using the existing `finance/expenses` export machinery as the template.
>
> `pdf-report-generator.ts` grew ~274 lines of new generator functions to support these.

Full inventory (confirmed by reading every relevant folder):

| Entity | List export | Detail export | Notes |
|---|---|---|---|
| Trucks | ✅ `exportTrucksPDF` | ✅ `exportSingleTruckReport` | Reference pattern to copy |
| Drivers | ✅ `exportDriversPDF` | ✅ `exportSingleDriverReport` | Fine |
| Trips | ✅ `exportTripsPDF` | ✅ `exportSingleTripReport` + a dedicated `exportTripProfitLossPDF` | Most complete of all entities |
| Invoices | ✅ `exportInvoicesPDF` | ✅ `downloadSingleInvoicePDF` | Fine |
| Customers | ✅ `exportCustomersPDF` | ❌ **none** | Gap |
| **Trailers** | ❌ **none** | ❌ **none** | **Full gap — zero export capability anywhere** |
| Expenses (general) | ✅ `exportExpensesPDF` | n/a | Fine |
| **Expenses grouped by truck** (`finance/expenses/by-truck/page.tsx`) | ❌ **none** | n/a | This is the page that already lists each truck's expenses (lines 115-158) with per-truck totals — **the clearest, most direct target for "add an export button inside the table for a truck's expenses"** that the user asked for |

**Fix direction:** for Trailers, follow the exact pattern already used for Trucks (`fleet/trucks/actions.ts`'s `exportTrucksPDF`/`exportSingleTruckReport` + `pdf-report-generator.ts`'s `generateTruckReportPDF`/`generateSingleTruckReportPDF` + the `[id]/_components/export-truck-button.tsx` component) — trailers have no revenue/expense data at all (see E3), so a trailer export would just be a registration/license/status/assigned-truck summary, much simpler than the truck one. For the by-truck expenses page, add a PDF/CSV export button using the existing `finance/expenses` export machinery as a template. For Customers, add a detail-page export mirroring the Trucks/Drivers detail-export pattern.

#### E3 — Truck/Trip/Trailer reports: expenses-only vs. expenses-vs-income variants

> **✅ DONE — commit `1d44359`.** Worked in the order the plan laid out:
> 1. **Schema gap filled.** `model TrailerExpense` now exists in `prisma/schema.prisma:285` as a `TruckExpense` mirror (`trailerId`/`expenseId`, `onDelete: Cascade` both sides), with the back-relation on `Expense` and a hand-written migration in `app/prisma/migrations/` matching the existing files' style — the migration gotcha in section 1 applied, as expected.
> 2. **Expense entry extended.** `expense-form.tsx` (+138 lines) and both the new/edit expense pages now let you optionally attach a trailer to an expense, and `finance/expenses/actions.ts` writes the join rows.
> 3. **Three new report configs added to `config/reports.ts`:** `truck-expenses` (line 140), `trailer-expenses` (154), `trip-expenses` (168). Each has a data fetcher in `lib/reports/data-fetchers.ts`, a PDF/CSV generator entry, and `ReportGenerator` support. All three are expenses-only — no revenue section — and for `trailer-expenses` that's the only variant that will ever make sense, exactly as the plan predicted, since trailers have no revenue concept.
>
> On step 4/5's "or a mode flag instead" suggestion: the code went with **separate report configs** rather than a mode flag on `truck-profitability`, which fits the `ReportGenerator` UI once E1 made report types addressable by name — the better of the two options the plan left open.

**User's own words:** *"Update the truck, trailer, trip etc reports to have expenses only, then expenses vs income (for trucks and trips)."*

Confirmed current state:
- **Truck:** the existing `truck-profitability` report (`fetchTruckProfitabilityData` in `data-fetchers.ts:329-397`, `generateTruckProfitabilityPDF`/`CSV`, `reportConfigs["truck-profitability"]` in `config/reports.ts:119-133`) is **already** an expenses-vs-income report — revenue, expense-by-category, profit, margin, all combined. There is **no expenses-only variant** for a single truck. The org-wide "Expense Report" (`reportConfigs.expenses`, `fetchExpenseData`) is expenses-only but has **no truck/trip filter parameter at all** (`fetchExpenseData(organizationId, startDate, endDate)` — confirmed no `truckId` arg), so it can't be scoped to one truck today.
- **Trip:** both variants substantially already exist. `fetchTripSummaryData` gives revenue-vs-expense across many trips (feeds `trip-summary` report). A single trip's revenue-vs-expense is *also* already a rich, separate detail-page feature (`operations/trips/[id]/page.tsx`'s `TripProfitLossTable` + `exportTripProfitLossPDF`). There is **no dedicated trip-expenses-only report** yet.
- **Trailer:** **confirmed definitively that trailer expense tracking does not exist in the data model at all.** `model Trailer` in `prisma/schema.prisma` has no `revenue` field, no trips relation, and — critically — **no expense relation of any kind**. There is no `TrailerExpense` join model (compare `TruckExpense`, `TripExpense`, `DriverExpense`, all of which exist); `model Expense` has no `trailerExpenses` back-relation either. **A trailer expenses report cannot be built until this schema gap is filled.** And since trailers have no revenue concept, only an expenses-only variant will ever make sense for them (matches the user's own phrasing — they only said "expenses only" for trailers, not "expenses vs income").

**Fix direction, in order:**
1. Add a `TrailerExpense` join model to `prisma/schema.prisma`, mirroring `TruckExpense` exactly (`trailerId`/`expenseId`, unique constraint, cascade delete), add the back-relation on `Expense`, run a migration (see the migration gotcha above — check whether a live DB is reachable).
2. Extend wherever expenses are currently recorded against a truck (the expense-entry forms/actions under `finance/expenses/` and/or `operations/expenses/`) to optionally also link a trailer — this is a real feature addition, not just a report change.
3. Build a `fetchTrailerExpensesData` fetcher + PDF/CSV generator + `reportConfigs["trailer-expenses"]` entry, expenses-only (no revenue section, since none exists).
4. For Truck: add a new expenses-only fetcher/report (either a new `fetchTruckExpensesOnlyData` or extend `fetchExpenseData` with an optional `truckId` filter) and a corresponding `reportConfigs` entry, distinct from the existing combined `truck-profitability` report — or alternatively, add a "mode" flag to the existing report so one config produces either variant. Either approach works; pick whichever fits the `ReportGenerator` UI better once E1 is done.
5. For Trip: same idea — a new expenses-only trip report distinct from the existing combined `trip-summary`/`trip-profit-loss`.

---

### Issue F — Inventory add/remove should show the monetary value, not just quantity

> **✅ DONE — commit `d172d61`.** All four steps, and the plan's "small, additive, no schema changes needed" assessment held — `StockMovement` needed only two new fields (the migration is 2 lines), and no new ledger table was created.
> 1. `unitCost` was added to the `select`/`include` feeding `StockMovementsTable` in both `inventory/page.tsx` and `inventory/[id]/page.tsx`.
> 2. `StockMovementRow` in `stock-movements-table.tsx` now carries `unitCost`, with a `movementValue()` helper that prefers the movement's own `unitCost` and falls back to the item's.
> 3. The dollar figure is rendered as a new "Value" column in the history table and appended to the toasts in `stock-movement-dialog.tsx` ("Took out 18 L of Diesel — $55") and `allocate-part-dialog.tsx`.
> 4. Gated behind `canViewInventoryValue(role)` as asked — implemented as a `showValue` prop threaded from the server components (`inventory/page.tsx:45`, `inventory/[id]/page.tsx:53`) rather than an inline check in the client component, so the value never reaches a supervisor's payload. `stock-actions.tsx`/`inventory-table.tsx` pass it through consistently.

**User's own words:** *"When inventory is removed / added, show the admin the monetary value increase / decrease as well, not just that -18 litres, but how much came out, the amount, monetary value, that 18l taken out amounts to (for example) $55."*

**Good news — this is small, additive, well-scoped work.** Confirmed:
- `InventoryItem` already has a `unitCost Float?` field (`prisma/schema.prisma:728`).
- A full transaction ledger **already exists**: `StockMovement` model (`prisma/schema.prisma:745-764`, fields include `type`, `quantity`, `quantityBefore`, `quantityAfter`, `reason`, `performedById`). Every quantity-changing action already writes to it via a shared `recordMovement()` helper (`app/src/app/(dashboard)/inventory/actions.ts:50-65`), called from `createInventoryItem`, `updateInventoryItem`, `takeOutStock`, `addStock`, and `allocatePart`. **No new ledger table is needed** — this is purely a display change.
- Currently, nowhere shows a dollar figure for a movement: the toast messages (`stock-movement-dialog.tsx:85-89`, e.g. `"Took out 18 L of Diesel"`) have no $ amount; the allocation toast (`allocate-part-dialog.tsx:87`) doesn't even show quantity; and the history table (`stock-movements-table.tsx`, rendered on both `inventory/page.tsx` and `inventory/[id]/page.tsx`) only ever renders `{sign}{quantity} {unit}` (line 145) and `{quantityBefore} → {quantityAfter}` (line 150) — no cost anywhere, and the underlying Prisma queries feeding this table don't even `select` `unitCost` today.
- The rest of the Inventory feature already has a working "$ value" pattern to copy: `inventory/[id]/page.tsx:56` computes `totalValue = (item.unitCost ?? 0) * item.quantity`, displayed in a card gated by `canViewInventoryValue(role)` (`permissions.ts:205-207`, admin-only).

**Fix direction:**
1. Add `unitCost` to the Prisma `select`/`include` that feeds `StockMovementsTable` in both `inventory/page.tsx` (org-wide feed, ~lines 34-42) and `inventory/[id]/page.tsx` (per-item history, ~lines 42-45, 216-219).
2. Extend the `StockMovementRow`/`inventoryItem` type in `stock-movements-table.tsx:38` to carry `unitCost`.
3. Compute `quantity * unitCost` and render it alongside the existing quantity delta in the table (line ~145) and in the two toast messages (`stock-movement-dialog.tsx:85-89`, `allocate-part-dialog.tsx:87`).
4. Gate the dollar figure behind `canViewInventoryValue(role)` — same admin-only visibility rule the rest of the Inventory page already follows, for consistency (a supervisor can see quantities but not dollar values elsewhere on this page today).

---

## 3. Suggested order of work

> **Outcome (2026-09-18):** items 1–4 and 6 are **done**;
> item 5 is **partly done** (helper built, rolled out to the highest-traffic flows — see Issue D). The order below was followed as written, including the E1 → E2 → E3 staging, which is why the schema-free export work shipped before the `TrailerExpense` migration.

1. **Issue A** (expense/supplier FK crash) — small, well-scoped, actively losing user data in production right now.
2. **Issue B** (email) — the infra half needs the user/ops to act (not a code session); the code half (swallowed failures) is small and prevents this class of bug being invisible again.
3. **Issue C** (workshop dashboard) — small, high-impact UX/correctness fix, fully scoped above.
4. **Issue F** (inventory $ value) — small, additive, no schema changes needed.
5. **Issue D** (plain-English errors) — start with the Issue A code paths, then expand opportunistically; don't try to do all 104 catch blocks at once.
6. **Issue E** (reports/exports) — the biggest item, has a real schema dependency (TrailerExpense) blocking part of it; probably deserves its own dedicated session(s), split as E1 (tab-aware generate button) → E2 (missing export buttons, no schema changes needed, can ship immediately) → E3 (new report variants, needs the schema migration first for trailers).

---

*Generated by Claude (Sonnet 5) via three parallel research passes over the actual codebase — every file:line citation above was read directly, not inferred. If something looks stale by the time you read this, trust the live code over this document and update accordingly.*

*Status snapshot and per-issue notes added later the same day, after the plan was worked. Those notes cite commit hashes rather than file:line, since the line numbers in the original citations have shifted. The only items still genuinely open are **Issue B's infra half** (needs Coolify/mail-server access, not a code session) and **Issue D's remaining ~18 action files**.*
