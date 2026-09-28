"""Checks every export and document action's role guard against ACCESS_CONTROL.md.

Run from app/:  python <this file>

ACCESS_CONTROL.md puts reports in the admin-only table, and is explicit that
this covers "every export button on every list page". That rule was being
broken in eleven places at once — an unguarded trip P&L endpoint, a customer
statement any signed-in user could take, an expense report a staff member could
pull — because each export was written next to the feature it exported and
nobody compared them.

The exceptions are the two documents a customer receives: an invoice and a
payment receipt. Issuing those is a supervisor's job (ACCESS_CONTROL.md,
"Invoices: supervisor yes"), so they are documents rather than reports.

A guard must also be `assertRole`, not `requireRole`: these actions are called
from a button in a client component, and `requireRole` redirects, which arrives
at the caller as a failed fetch with no message. The user sees nothing happen.
"""
import io
import os
import re

ADMIN = {"admin"}
BILLING = {"admin", "supervisor"}

EXPECT = {
    "customers/actions.ts": {
        "exportCustomersPDF": ADMIN,
        "exportCustomerDetailPDF": ADMIN,
        "exportCustomerDetailWord": ADMIN,
    },
    "employees/actions.ts": {"exportEmployeesPDF": ADMIN},
    "finance/expense-categories/actions.ts": {"exportCategoryExpensesPDF": ADMIN},
    "finance/expenses/actions.ts": {
        "exportExpensesPDF": ADMIN,
        "exportTruckExpensesPDF": ADMIN,
    },
    "finance/invoices/actions.ts": {
        "exportInvoicesPDF": ADMIN,
        # The document the customer is sent, not a report about the business.
        "downloadSingleInvoicePDF": BILLING,
    },
    "finance/payments/actions.ts": {
        "exportPaymentsPDF": ADMIN,
        "downloadPaymentReceiptPDF": BILLING,
    },
    "fleet/drivers/actions.ts": {
        "exportDriversPDF": ADMIN,
        "exportSingleDriverReport": ADMIN,
    },
    "fleet/trailers/actions.ts": {
        "exportTrailersPDF": ADMIN,
        "exportSingleTrailerReport": ADMIN,
    },
    "fleet/trucks/actions.ts": {
        "exportTrucksPDF": ADMIN,
        "exportSingleTruckReport": ADMIN,
    },
    "operations/expenses/actions.ts": {"exportOperationsExpensesPDF": ADMIN},
    "operations/trips/actions.ts": {
        "exportTripsPDF": ADMIN,
        "exportSingleTripReport": ADMIN,
    },
    "operations/trips/[id]/_components/actions.ts": {
        "exportTripProfitLossPDF": ADMIN,
    },
    "reports/actions.ts": {
        "generateReport": ADMIN,
        "getReportHistory": ADMIN,
        "deleteReport": ADMIN,
        "exportDashboardPDF": ADMIN,
    },
    "suppliers/actions.ts": {"getSupplierOwingReport": BILLING},
}

ROLE = re.compile(r"""['"](\w+)['"]""")

problems = []
checked = 0
seen = set()

for rel, fns in sorted(EXPECT.items()):
    path = os.path.join("src", "app", "(dashboard)", *rel.split("/"))
    if not os.path.exists(path):
        problems.append(f"MISSING FILE   {rel}")
        continue
    source = io.open(path, encoding="utf-8").read()

    for name, want in sorted(fns.items()):
        seen.add(name)
        start = re.search(r"^export async function " + name + r"\b", source, re.M)
        if not start:
            problems.append(f"MISSING        {rel} -> {name}")
            continue
        nxt = re.search(r"^export (async function|const|interface|type)",
                        source[start.end():], re.M)
        body = source[start.start(): start.end() + (nxt.start() if nxt else len(source))]

        guard = re.search(r"await (assertRole|requireRole)\(\s*\[([^\]]*)\]", body)
        checked += 1
        if not guard:
            why = "requireAuth only" if "requireAuth(" in body else "no guard at all"
            problems.append(f"UNGUARDED      {rel} -> {name}  ({why})")
            continue
        got = set(ROLE.findall(guard.group(2)))
        if got != want:
            problems.append(
                f"MISMATCH       {rel} -> {name}\n"
                f"                 code = {sorted(got)}\n"
                f"                 doc  = {sorted(want)}"
            )
        elif guard.group(1) == "requireRole":
            problems.append(
                f"REDIRECTS      {rel} -> {name}  (use assertRole so the user "
                f"gets a message, not a dead button)"
            )

# Anything new that looks like an export must be listed above, or it is not
# being checked at all — which is how these drifted in the first place.
for root, _dirs, files in os.walk(os.path.join("src", "app", "(dashboard)")):
    for filename in files:
        if filename != "actions.ts":
            continue
        source = io.open(os.path.join(root, filename), encoding="utf-8").read()
        for name in re.findall(r"^export async function ((?:export|download)\w+)",
                               source, re.M):
            if name not in seen:
                problems.append(
                    f"UNLISTED       {os.path.join(root, filename)} -> {name}  "
                    f"(add it to EXPECT with the roles ACCESS_CONTROL.md gives it)"
                )

print(f"export actions checked: {checked}")
if problems:
    print(f"\n{len(problems)} problem(s):")
    for item in problems:
        print("  " + item)
else:
    print("PASS - every export action's guard matches ACCESS_CONTROL.md")
