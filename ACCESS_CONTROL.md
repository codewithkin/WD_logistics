# Access control

**The single source of truth for who can see and do what.** Decided with the
client on 2026-09-24, question by question, after the same access rules were
guessed wrong twice. If the code and this file disagree, **this file is
right** — fix the code.

Anything not covered here is a question for the client, not a judgement call.

---

## The four roles, in one line each

| Role | What it is for |
|---|---|
| **admin** | The owner's view. Everything, including all money. |
| **supervisor** | Runs operations. Records costs and handles billing, but never sees what the business *earns*. |
| **staff** | Data entry for fleet and trips. Creates records; cannot edit them. No money at all. |
| **workshop** | A mechanic. Sees only the maintenance jobs assigned to them that are still open. Nothing else exists. |

---

## The rule that catches most mistakes

> **A supervisor may see what things *cost*. A supervisor may never see what
> the business *earns*.**

Costs are operational — they need them to do the job. Revenue, profit and
margin are the owner's business. This is why a supervisor gets the Expenses
page in full but sees no revenue column on a truck's page.

---

## Pages

`✅` full access · `👁` view only · `💰` visible but money hidden · `—` no access
(redirected to a *no-access* page, see "Denied access")

### Operations

| Page | admin | supervisor | staff | workshop |
|---|---|---|---|---|
| Dashboard | ✅ | 💰 no revenue/profit | 💰 | — |
| Fleet — trucks, trailers, drivers (list) | ✅ | ✅ | 👁 + create | — |
| Fleet — detail pages | ✅ | 💰 costs yes, revenue/profit no | 👁 💰 | — |
| Driver performance | ✅ | — | — | — |
| Trips (list and detail) | ✅ | ✅ | 👁 + create | — |
| Maintenance | ✅ | ✅ | — | **only their own open jobs** |
| Inventory | ✅ | ✅ | — | — |

### People and relations

| Page | admin | supervisor | staff | workshop |
|---|---|---|---|---|
| Customers | ✅ | ✅ (no revenue figures) | — | — |
| Suppliers | ✅ | ✅ | — | — |
| Employees | ✅ | ✅ | — | — |
| Users | ✅ | — | — | — |

### Money

| Page | admin | supervisor | staff | workshop |
|---|---|---|---|---|
| Expenses — list, create, amounts | ✅ | ✅ **including amounts** | — | — |
| Expense analytics / by-truck / by-trip | ✅ | ✅ | — | — |
| Accounts — balances | ✅ | 👁 **can see balances** | — | — |
| Accounts — money **out** (spend, transfer out) | ✅ | ✅ | — | — |
| Accounts — money **in**, starting balance | ✅ | **—** | — | — |
| Invoices | ✅ | ✅ | — | — |
| Customer payments | ✅ | ✅ | — | — |
| Supplier payments | ✅ | ✅ | — | — |
| Revenue, profit, margin — anywhere | ✅ | **—** | — | — |

> **Accounts is the subtle one.** A supervisor can see what is in each account
> and take money *out* of it, because they spend. Only an admin puts money
> *in* or sets a starting balance.

### Admin-only, no exceptions

| Page | Note |
|---|---|
| Edit Requests | **Admin only.** Not even one's own. This was the bug that started this document: the page used `requireAuth`, so every signed-in user could open it. |
| Reports — all 23 | Including every export button on every list page. |
| Settings — all of it | Organisation, expense categories, WhatsApp pairing, assistant contacts, wipe data. `/settings/whatsapp` previously had **no role guard at all**. |
| Users | Invite, roles, passwords, removal. |
| AI chat | |

---

## Workshop, precisely

A workshop user sees **only maintenance requests that are both**:

1. assigned to them, **and**
2. not yet marked fixed.

Not other people's jobs. Not their own closed jobs. Not the trucks list. Every
other page redirects. Their landing page is Maintenance.

---

## Staff, precisely

Staff exist for typing in fleet and trip records.

- **See and create:** trucks, trailers, drivers, trips.
- **Cannot edit or delete** — an attempted change becomes an **edit request**
  for an admin, which they will never see the queue of.
- **No money anywhere**, and no customers, suppliers or employees.

---

## Denied access

When somebody reaches a page they should not — a typed URL, an old bookmark, a
role changed under them — show a **clear "no access" page** saying they do not
have access and who to ask. Not a silent redirect: a silent bounce looks like a
broken link and generates support questions.

The exception is the signed-out case, which still goes to `/sign-in`.

---

## The WhatsApp assistant

**The assistant mirrors these web rules exactly.** Whatever a supervisor can
see in the browser, a supervisor can ask the assistant, and nothing more.

The assistant's own four contact levels map straight across:

| Assistant level | Equivalent |
|---|---|
| `admin` | admin |
| `supervisor` | supervisor |
| `staff` | staff |
| `readonly` | below staff — fleet and trip *facts* only, **no money of any kind** |

Two rules that already hold and must keep holding:

- The effective level is the **weaker** of the contact's level and their
  dashboard account's role, so a generous contact entry can never grant more
  than the person's login does.
- Hiding a financial *tool* is not enough. An operational tool must not carry
  money either — `list_trips` used to return each trip's revenue, which let a
  readonly contact add up the month's earnings.

---

## Where this is enforced

Three layers, because one is not enough:

1. **The page** — a role guard on every server component. Missing or wrong
   here is what caused this document.
2. **The action** — every server action re-checks. A hidden button is not
   security; the action is what actually runs.
3. **The data** — money fields are omitted from the query result for roles
   that may not see them, not merely hidden in the markup. A value passed to a
   client component is in the RSC payload and readable in devtools whether or
   not it is rendered.

`src/lib/permissions.ts` is where the predicates live. Use them; do not
re-derive a role check inline.
