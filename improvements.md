# Improvements — WhatsApp assistant

Written 28 Sep 2026. Three pieces of work, in the order they should be done.
Each carries its own success criteria, because "implemented" and "working"
have come apart on this project before.

**Status, 28 Sep 2026:** pieces 1 and 2 are built and their success criteria
are met. The cap is **200 messages**,
not the 120 first drafted — the client raised it before any of this shipped.
Piece 3 is a costing note and needs a month of real `costUsd` data, not code.

---

## 1. Fair-use cap: 200 messages a month — ✅ built

The client pays **$5/month flat**. At roughly **$0.012–0.015 per message**
(see the costing note at the end), 200 messages is about **$2.34–$2.86** of
model spend — still inside the ~330/month break-even, with room left over.

Built across three commits: `a1a1180` (counting and the endpoint),
`dcc212c` (enforcement in the agent), `37c094b` (the admin's view of it).
The limit reads from `WHATSAPP_MESSAGE_CAP` and defaults to 200.

### What to build

**Count it.** `whatsapp_message` already records every exchange with
`promptTokens`, `completionTokens`, `reasoningTokens` and `costUsd`. The
count is a query, not new plumbing:

```
SELECT count(*) FROM whatsapp_message
WHERE organization_id = $1
  AND direction = 'inbound'
  AND created_at >= date_trunc('month', now());
```

Decide and write down whether an *inbound* message or an inbound/outbound
*pair* is "a message". Inbound is the honest unit — it is what triggers the
cost — and it is what the customer-facing wording should describe.

**Show it** on Settings → WhatsApp, admin only, beside the connection card:
used, remaining, and the date it resets. Something like *"38 of 120 messages
used this month. Resets 1 October."*

**Stop at the limit.** Once the month's count reaches the cap the agent
replies to nothing at all:

- no model call
- no Jev decision call
- no tool/manifest call to the app
- **no reply of any kind**, including to approved contacts

Silence, not an explanation. A "you have hit your limit" reply is itself an
outbound WhatsApp message to every sender who keeps trying, and this service
has already been through a 122-message reply loop once.

**Where the check goes:** at the very top of the `message_create` handler in
`agent/src/index.ts`, before `buildToolsForCaller` and before anything is
transcribed. Transcribing a voice note costs money; it must sit behind the
cap too.

**Cache the count.** Do not query Postgres on every inbound message — hold it
in memory, increment locally, and re-read every few minutes or on a miss.

### Success criteria

- [x] At 199 messages the assistant answers normally.
- [x] At 200 an approved admin gets **no reply at all**. The handler returns
      before the model, and logs why.
- [x] At the limit, **zero** model calls are made — the check is the first
      thing in the handler, above the media branch.
- [x] A voice note past the limit is not transcribed. This is why the check
      sits above the media branch rather than next to the model call.
- [x] The page's number matches `SELECT count(*)` for the month — the card
      is a server component reading the same query.
- [x] The count resets at the start of the next calendar month by itself:
      the window is derived, not stored. Boundaries are Africa/Harare
      midnight, verified as 1 Sep 00:00 and 1 Oct 00:00 local.
- [x] The cap is per organisation, and `WHATSAPP_MESSAGE_CAP` changes the
      limit without a deploy.

**Decision, as the brief asked for it in writing:** a message is one
*inbound* message. It is what triggers the cost, and it is how a person
counts. The customer-facing wording says exactly that.

**One thing the brief did not specify:** what happens when the app cannot be
reached to read the count. It fails **closed** — the message is refused and
nothing is sent (`40a70f1`). Not knowing how many messages have gone out is
not evidence that there is room left. The cost: if the app is down when the
agent starts, every message is dropped in silence until it comes back. That
is tolerable because the app is also where the tools live, so a reply during
an outage would have been "I can't reach the system" anyway. A *stale* cache
still answers — it is a real count from minutes ago, not an absence of one.

---

## 2. Make the WhatsApp page tell the truth — ✅ done

Several statements on Settings → WhatsApp describe behaviour the system does
not have. Each is either a UI fix or a behaviour fix — decide which per line,
then make the page and the code agree.

### Confirmed false

**"A number that is not on this list gets no answer at all."**
`whatsapp-contacts.tsx:164`

Not true. `agent/src/agents/assistant.ts:171` replies to unknown numbers with
*"I don't have this number on my list, so I can't help. Ask an admin to add
you under Settings → Notifications → WhatsApp assistant."*

**Fix the behaviour, not the wording.** Silence is what the page promises and
what the client wants, and replying to strangers is what caused the 122-message
loop. Two extra faults in that sentence: it points at *Settings →
Notifications*, which is not where the list lives any more (it is on this
page), and it tells an unknown caller that this number belongs to a system
with an admin — which is more than a stranger needs to know.

**Fixed in `7bfc12b`.** Replies carry a `silent` flag; the handler returns
before the reply, the passed-on messages and the attachments. Verified: three
messages from an unlisted number produced no text, no tool call, no
transcript row.

### Needs verifying before it is called a bug

**"The role decides what the assistant will do for them"** and the four role
hints at `whatsapp-contacts.tsx:70-73`.

Reported: a staff member asked for reports and got them. The code says
otherwise — `operationManifest(effectiveRole)` at
`app/src/lib/assistant/operations.ts:757` filters the tool list by role, and
all three report operations require `admin`
(`app/src/lib/assistant/report-operations.ts`). So a staff contact should not
be offered them at all.

Three things to check before writing code:

1. **What role is that person's contact row set to?** Reads are answered at
   the *contact's* level, not their dashboard role. A staff member whose
   WhatsApp contact is set to `admin` correctly gets admin tools. This is the
   most likely explanation and is a data problem, not a code one.
2. **Was it observed before role filtering existed?**
3. **Does the model describe a report it could not generate?** Being refused
   the tool and then answering from figures it already has would look like
   the same failure from the outside.

**Checked, and it does not survive.** The per-role tool list, read straight
out of `operationManifest`:

| Role | Tools | Reads | Writes |
| --- | --- | --- | --- |
| readonly | 8 | trucks, drivers, trips, stock, customers, maintenance, expiring documents | own password only |
| staff | 9 | same | own password, log a fault |
| supervisor | 37 | + invoices, account balances, expense breakdown, truck costs | 25, incl. expenses, payments, trips, stock |
| admin | 53 | + revenue, profit, fleet ranking, reports, users | 33 |

`generate_report`, `create_pdf` and `list_reports` all require `admin`, and
the manifest filters before the model is ever handed a tool — so a staff
contact is not offered them. That leaves explanation 1 from the list above:
**that person's WhatsApp contact row is set to `admin`**, since reads are
answered at the contact's level, not their dashboard role. A question for the
client, not a code fix.

### Audit the rest — done, two were false

Checked against the table above, and corrected in `88a9a60`:

- *"...and seeing invoices"* (staff) — **false.** Invoices start at
  supervisor. Staff is read only plus logging a fault.
- *"Changes nothing, sees no money"* (readonly) — **half false.** Sees no
  money is right; it can always change its own password, which is the one
  write every role has.
- *"Can record expenses and payments, schedule trips and adjust stock"*
  (supervisor) — all four true, but it undersold a role with 25 writes and
  said nothing about where it stops. Now names the boundary: balances yes,
  revenue and profit no.
- *"their access there caps what the assistant will do"* (line 357) —
  **true, for reads as well as writes.** `effectiveRole` is
  `weakerRole(contact.role, actor.role)` and the manifest is built from it,
  so the weaker of the two governs everything the model is offered.

### Success criteria

- [x] An unknown number sends three messages and receives nothing. No
      transcript row is written, no model call is made. Three cases were
      added to `live-assistant-check.ts` — a greeting, a question and a
      prompt-injection attempt — each asserting silence.
- [x] The check's own allow-list guard now watches for the silent flag. It
      used to match the refusal wording, which no longer exists, so a run
      against an empty contact list would have gone green instead of saying
      why.
- [x] One live check case per role, asserting both what that role *can* do
      and one thing it *cannot* (`7c5ee39`). Staff and supervisor had none
      at all, which is how two false descriptions of them survived. Each
      role's manifest was also compared against what its cases claim, free
      and without the model: admin 53 tools, supervisor 37, staff 9,
      readonly 7, nothing offered that a case says is out of reach.
      **The full live run against the model has not been made** — it costs
      real tokens and writes LIVETEST rows.
- [x] Every sentence on the page is now backed by the per-role tool list
      above rather than by memory.

---

## 3. Costing note, for when 120 is renegotiated

Measured against `google/gemini-3.5-flash` at $1.50/M in, $9.00/M out:

| Component | Tokens | Cost |
| --- | --- | --- |
| Fixed prompt (system + tool definitions) | ~5,500 in | $0.00825 |
| Reply + reasoning | ~250 out | $0.00225 |
| Memory, 10 turns, text only | ~800 in | $0.0012 |
| Memory, if tool results are stored too | ~4,000 in | $0.0060 |

**$0.0117 shallow, ~$0.0143 deep.** Break-even on $5 is 330–430 messages;
120 leaves real margin.

Two things worth knowing:

- **5,500 of the 5,550 tokens are tool definitions, resent on every
  message.** The reply is tens of tokens. Halving that overhead — fewer
  tools exposed per role, shorter descriptions — roughly halves the cost of
  every message and would make a much higher cap affordable. It is the
  single highest-value optimisation available.
- **Whether tool results are persisted into memory** is the difference
  between $0.0117 and $0.0143 and has not been confirmed. A month of real
  `costUsd` data settles it — and should replace these estimates before the
  next price conversation.
