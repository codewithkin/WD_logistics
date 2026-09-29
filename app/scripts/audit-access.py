"""Checks every dashboard page's role guard against ACCESS_CONTROL.md.

Run from app/:  python <this file>
"""
import io
import os
import re

EXPECT = {
    # Fleet and trips: staff see them, create them, and send any change to an
    # admin as a request. The edit page is open to staff for that reason.
    "fleet/trucks": {"admin", "supervisor", "staff"},
    "fleet/trucks/new": {"admin", "supervisor", "staff"},
    "fleet/trucks/[id]": {"admin", "supervisor", "staff"},
    "fleet/trucks/[id]/edit": {"admin", "supervisor", "staff"},
    "fleet/trailers": {"admin", "supervisor", "staff"},
    "fleet/trailers/new": {"admin", "supervisor", "staff"},
    "fleet/trailers/[id]": {"admin", "supervisor", "staff"},
    "fleet/trailers/[id]/edit": {"admin", "supervisor", "staff"},
    "fleet/drivers": {"admin", "supervisor", "staff"},
    "fleet/drivers/new": {"admin", "supervisor", "staff"},
    "fleet/drivers/[id]": {"admin", "supervisor", "staff"},
    "fleet/drivers/[id]/edit": {"admin", "supervisor", "staff"},
    "operations/trips": {"admin", "supervisor", "staff"},
    "operations/trips/new": {"admin", "supervisor", "staff"},
    "operations/trips/[id]": {"admin", "supervisor", "staff"},
    "operations/trips/[id]/edit": {"admin", "supervisor", "staff"},
    "dashboard": {"admin", "supervisor", "staff"},
    # Earnings per driver, per truck: admin alone.
    "fleet/drivers/[id]/performance": {"admin"},
    # Relations and people. No staff anywhere here — including the create and
    # edit forms, which is where staff access leaked for a week: the edit page
    # renders the record, amounts and all.
    "customers": {"admin", "supervisor"},
    "customers/new": {"admin", "supervisor"},
    "customers/[id]": {"admin", "supervisor"},
    "customers/[id]/edit": {"admin", "supervisor"},
    "suppliers": {"admin", "supervisor"},
    "suppliers/new": {"admin", "supervisor"},
    "suppliers/[id]": {"admin", "supervisor"},
    "suppliers/[id]/edit": {"admin", "supervisor"},
    "employees": {"admin", "supervisor"},
    "employees/new": {"admin", "supervisor"},
    "employees/[id]": {"admin", "supervisor"},
    "employees/[id]/edit": {"admin", "supervisor"},
    # Money. A supervisor bills, spends and records; staff see none of it.
    "finance/invoices": {"admin", "supervisor"},
    "finance/invoices/new": {"admin", "supervisor"},
    "finance/invoices/[id]": {"admin", "supervisor"},
    "finance/invoices/[id]/edit": {"admin", "supervisor"},
    "finance/payments": {"admin", "supervisor"},
    "finance/payments/new": {"admin", "supervisor"},
    "finance/payments/[id]/edit": {"admin", "supervisor"},
    "finance/supplier-payments": {"admin", "supervisor"},
    "finance/supplier-payments/new": {"admin", "supervisor"},
    "finance/supplier-payments/[id]/edit": {"admin", "supervisor"},
    "finance/expenses": {"admin", "supervisor"},
    "finance/expenses/new": {"admin", "supervisor"},
    "finance/expenses/[id]": {"admin", "supervisor"},
    "finance/expenses/[id]/edit": {"admin", "supervisor"},
    "finance/expenses/analytics": {"admin", "supervisor"},
    "finance/expenses/by-truck": {"admin", "supervisor"},
    "finance/expenses/by-trip": {"admin", "supervisor"},
    "finance/expense-categories": {"admin", "supervisor"},
    "finance/expense-categories/[id]": {"admin", "supervisor"},
    "finance/accounts": {"admin", "supervisor"},
    "operations/expenses": {"admin", "supervisor"},
    "operations/expenses/new": {"admin", "supervisor"},
    "operations/expenses/[id]/edit": {"admin", "supervisor"},
    "inventory": {"admin", "supervisor"},
    "inventory/new": {"admin", "supervisor"},
    "inventory/[id]": {"admin", "supervisor"},
    "inventory/[id]/edit": {"admin", "supervisor"},
    # Workshop's one screen.
    "maintenance": {"admin", "supervisor", "workshop"},
    "maintenance/[id]": {"admin", "supervisor", "workshop"},
    # Admin only.
    "edit-requests": {"admin"},
    "reports": {"admin"},
    "settings": {"admin"},
    "settings/whatsapp": {"admin"},
    "users": {"admin"},
    "users/invite": {"admin"},
    "ai": {"admin"},
}

# Pages any signed-in user may open, so there is no role to check.
NO_ROLE = {
    "account",  # your own name, email and password
}

GUARD = re.compile(r"(?:pageAccess|requireRole)\(\s*\[([^\]]*)\]")
ROLE = re.compile(r"""['"](\w+)['"]""")

problems = []
checked = 0

for page, want in sorted(EXPECT.items()):
    path = os.path.join("src", "app", "(dashboard)", *page.split("/"), "page.tsx")
    if not os.path.exists(path):
        problems.append(f"MISSING FILE   {page}")
        continue

    source = io.open(path, encoding="utf-8").read()
    match = GUARD.search(source)
    if not match:
        why = "requireAuth only" if "requireAuth(" in source else "no guard at all"
        problems.append(f"UNGUARDED      {page}  ({why})")
        continue

    got = set(ROLE.findall(match.group(1)))
    checked += 1
    if got != want:
        problems.append(
            f"MISMATCH       {page}\n"
            f"                 code = {sorted(got)}\n"
            f"                 doc  = {sorted(want)}"
        )

# A page missing from the matrix is a page nobody decided the roles for, which
# is how every `[id]/edit` page came to admit staff without anyone choosing it.
for root, _dirs, files in os.walk(os.path.join("src", "app", "(dashboard)")):
    if "page.tsx" not in files:
        continue
    page = os.path.relpath(root, os.path.join("src", "app", "(dashboard)")).replace(os.sep, "/")
    if page in EXPECT or page in NO_ROLE:
        continue
    problems.append(f"UNLISTED       {page}  (decide its roles and add it here)")

print(f"pages checked: {checked}/{len(EXPECT)}")
if problems:
    print(f"\n{len(problems)} problem(s):")
    for item in problems:
        print("  " + item)
else:
    print("PASS — every page's guard matches ACCESS_CONTROL.md")
