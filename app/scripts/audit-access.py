"""Checks every dashboard page's role guard against ACCESS_CONTROL.md.

Run from app/:  python <this file>
"""
import io
import os
import re

EXPECT = {
    # Fleet and trips — staff included (view + create)
    "fleet/trucks": {"admin", "supervisor", "staff"},
    "fleet/trucks/[id]": {"admin", "supervisor", "staff"},
    "fleet/trailers": {"admin", "supervisor", "staff"},
    "fleet/trailers/[id]": {"admin", "supervisor", "staff"},
    "fleet/drivers": {"admin", "supervisor", "staff"},
    "fleet/drivers/[id]": {"admin", "supervisor", "staff"},
    "operations/trips": {"admin", "supervisor", "staff"},
    "operations/trips/[id]": {"admin", "supervisor", "staff"},
    # Relations, people, money — admin + supervisor
    "customers": {"admin", "supervisor"},
    "customers/[id]": {"admin", "supervisor"},
    "suppliers": {"admin", "supervisor"},
    "suppliers/[id]": {"admin", "supervisor"},
    "employees": {"admin", "supervisor"},
    "employees/[id]": {"admin", "supervisor"},
    "finance/invoices": {"admin", "supervisor"},
    "finance/invoices/[id]": {"admin", "supervisor"},
    "finance/payments": {"admin", "supervisor"},
    "finance/supplier-payments": {"admin", "supervisor"},
    "finance/expenses": {"admin", "supervisor"},
    "finance/accounts": {"admin", "supervisor"},
    "operations/expenses": {"admin", "supervisor"},
    "inventory": {"admin", "supervisor"},
    # Workshop's one screen
    "maintenance": {"admin", "supervisor", "workshop"},
    # Admin only
    "edit-requests": {"admin"},
    "reports": {"admin"},
    "settings": {"admin"},
    "settings/whatsapp": {"admin"},
    "users": {"admin"},
    "ai": {"admin"},
    "fleet/drivers/[id]/performance": {"admin"},
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

print(f"pages checked: {checked}/{len(EXPECT)}")
if problems:
    print(f"\n{len(problems)} problem(s):")
    for item in problems:
        print("  " + item)
else:
    print("PASS — every page's guard matches ACCESS_CONTROL.md")
