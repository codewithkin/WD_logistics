# Access control

**The single source of truth for who can see and do what.** Decided with the
client on 2026-09-24, question by question, after the same access rules were
guessed wrong twice, and **narrowed again on 2026-09-30** — the supervisor
rules below marked *(30 Sep)* replace what was agreed the first time. If the
code and this file disagree, **this file is right** — fix the code.

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

**Narrowed on 30 Sep, and this is the half that gets missed:**

> **A supervisor sees what they spend. They do not see what it adds up to.**

An expense they record, and what a trip cost — theirs. What a *truck* has cost
over its life, what the business spends *by category*, what sits in the
accounts, what the workshop costs to run: those are the same totals the owner
runs the business on, reached by a different door. A supervisor keeps the
*physical* side of all of them — litres, parts fitted, days in the workshop,
km per litre — because that is what running a fleet needs.

The test to apply to a new screen: **could a supervisor read a total off it
that they did not themselves enter?** If yes, it is the owner's.

---

## Pages

`✅` full access · `👁` view only · `💰` visible but money hidden · `—` no access
(redirected to a *no-access* page, see "Denied access")

### Operations

| Page | admin | supervisor | staff | workshop |
|---|---|---|---|---|
| Dashboard | ✅ | 💰 no revenue/profit | 💰 | — |
| Fleet — trucks, trailers, drivers (list) | ✅ | ✅ | 👁 + create | — |
| Fleet — detail pages | ✅ | *(30 Sep)* quantities yes — litres, parts fitted, km/litre, downtime. **No amounts, no totals, no P&L** | 👁 💰 | — |
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
| Expenses — analytics tab | ✅ | *(30 Sep)* **—** | — | — |
| Expenses by **trip** | ✅ | ✅ including amounts | — | — |
| Expenses by **truck** | ✅ | *(30 Sep)* **quantities only** — litres, parts, counts. No amounts | — | — |
| Costs by category, anywhere | ✅ | *(30 Sep)* **—** | — | — |
| Truck P&L, cost per km, fuel *spend* | ✅ | *(30 Sep)* **—** | — | — |
| Fuel economy (km/litre, litres) | ✅ | *(30 Sep)* ✅ | — | — |
| Days in the workshop, downtime, job counts | ✅ | ✅ | — | — |
| Workshop **spend** | ✅ | *(30 Sep)* **—** | — | — |
| Accounts — balances | ✅ | *(30 Sep)* **—** | — | — |
| Accounts — money **in**, even as a line in the history | ✅ | *(30 Sep)* **—** | — | — |
| Accounts — money **out** (spend, transfer out) | ✅ | ✅ records it, and sees the money-out entries | — | — |
| Accounts — starting balance | ✅ | **—** | — | — |
| Invoices | ✅ | ✅ | — | — |
| Customer payments | ✅ | ✅ | — | — |
| Supplier payments | ✅ | ✅ | — | — |
| Revenue, profit, margin — anywhere | ✅ | **—** | — | — |

> **Accounts is the subtle one, and it changed on 30 Sep.** A supervisor
> records money *out* and can see the money-out entries, so they can check
> their own work. They never see a balance, a total, or a money-**in** line —
> because a list of everything in and out *is* the balance, arrived at with a
> calculator.
>
> **An overspend goes through.** Recording more than the account holds is
> accepted and the admin is notified. Refusing it with "that is more than the
> account holds" would tell the supervisor the balance, and refusing it
> silently would stop the work; the client chose to let it through and tell
> the owner.

### Admin-only, no exceptions

| Page | Note |
|---|---|
| Edit Requests | **Admin only.** Not even one's own. This was the bug that started this document: the page used `requireAuth`, so every signed-in user could open it. |
| Reports — all 23 | Including every export button on every list page, **and the assistant** *(30 Sep)*: a supervisor who asks for one over WhatsApp is refused like any other over-level request. The two exceptions are documents a *customer* receives — an invoice PDF and a payment receipt — which a supervisor issues as part of billing. |
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

## The one direct edit a non-admin has

Everything a non-admin changes becomes a request, on every entity, however
small — with exactly one exception: **a trip's status**.

| Change | Supervisor / staff |
| --- | --- |
| Trip status, and nothing else in the same change | **Direct** |
| Trip status together with any other field | Edit request |
| Any other field on a trip, on its own | Edit request |
| Anything on any other entity | Edit request |

Moving a trip along — scheduled, in progress, completed — is what operations
does all day, from a yard, usually on a phone. Sending each of those to an
admin would either stop the work or train everyone to approve without
reading, which is worse than not asking at all.

"Status only" is literal: the status must be the single field the change
carries. Send a mileage or a note with it and the whole change becomes a
request, the status included. Workshop and readonly are not in this table —
they have no access to trips at all.

Enforced by `canChangeTripStatusDirectly` in `lib/permissions.ts` and the
check at the top of `updateTrip`; every other update and delete action goes
through `gateChange`.

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

**A contact is a user of this system, at their own level.** A WhatsApp
contact must be linked to a dashboard account, and its level *is* that
account's role — there is no level to choose, and no way for the contact list
to grant access the person's own login does not carry. A `workshop` account
cannot use the assistant at all. Contacts created before this rule keep
working until they are next edited.

The assistant's own four contact levels map straight across:

| Assistant level | Equivalent |
|---|---|
| `admin` | admin |
| `supervisor` | supervisor |
| `staff` | staff |
| `readonly` | below staff — fleet and trip *facts* only, **no money of any kind** |

Money splits the same way it does on the web, and this is where it was got
wrong once: a single "not readonly" check handed every supervisor and staff
member each trip's revenue through `list_trips`.

| Figure | Who |
|---|---|
| Trip revenue, profit, margin, financial summary, fleet ranking | **admin** |
| Per-truck cost totals, costs by category, account balances, any report | **admin** *(30 Sep)* |
| What a trip cost, an expense amount they recorded | admin, supervisor |
| Litres, parts fitted, km/litre, days in the workshop | admin, supervisor |
| Invoices, payments, what a customer owes | admin, supervisor |
| Anything at all | not staff, not readonly |

**Refusals say one thing.** Anyone asking for something above their level
gets exactly: *"You cannot access this information. Ask an admin if you need
it."* Not the tool name, not the level needed, not a hint at the figure. The
model is instructed to repeat that sentence and nothing else — a refusal that
is reworded each time tells the reader what exists.

**A change over WhatsApp is a change.** The edit-request rule above applies
identically: a non-admin updating a truck, a driver, a customer, a supplier,
a stock item or a trip through the assistant files a request an admin
accepts or refuses, carrying the reason they gave and stamped with the fact
it came over WhatsApp. Only a trip's status is direct, as on the web.

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

## Checking it

Six scripts verify the code against this file rather than against memory.
Run them all from `app/` after touching any role:

```bash
python scripts/audit-access.py         # every page's guard matches the matrix above
python scripts/audit-nav.py            # no role is shown a link the page will refuse
python scripts/audit-action-guards.py  # no server action runs without knowing the caller
python scripts/audit-export-access.py  # every export and document action is gated
python scripts/audit-assistant-parity.py # everything the web app does is reachable from the assistant
bun --preload ./scripts/_stub-server-only.ts scripts/audit-assistant-access.ts
```

The last one calls the assistant's own operations as each level and fails on
any earnings figure that comes back, because hiding a financial *tool* is not
enough — an operational tool must not carry money either.

They exist because reading the code and believing it is how the rules drifted
in the first place. `audit-access.py` carries the matrix as data — when the
client changes a rule, change it there in the same commit as the code.
