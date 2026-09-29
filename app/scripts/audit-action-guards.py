"""Checks that every server action asks who is calling it.

Run from app/:  python <this file>

A file marked "use server" turns each of its exported functions into a POST
endpoint. There is no route to protect and nothing in the framework that
requires a session, so an export with no guard is reachable by anyone who
knows its id — signed in or not.

Three had none at all. `exportTripProfitLossPDF` returned a trip's revenue,
invoice and margin; `createNotification` wrote a notification, with an
arbitrary title, message and link, to any user in any organisation;
`generateInvoiceNumber` disclosed the invoice sequence. All three were
invisible in review because two were dead code and the third sat behind an
admin-only card, and a hidden caller is not a permission check.

The listed exceptions are functions that deliberately serve any signed-in
user; each names why. Everything else must call requireAuth, requireRole or
assertRole before it touches the database.
"""
import io
import os
import re

GUARDS = ("requireAuth(", "requireRole(", "assertRole(", "pageAccess(")

# Reached through another guarded action, or safe for any signed-in user.
ALLOWED_WITHOUT_GUARD = {
    # None at present. Add with a one-line reason, or add a guard instead.
}

problems = []
checked = 0

for root, _dirs, files in os.walk(os.path.join("src", "app")):
    for filename in files:
        if not filename.endswith(".ts") and not filename.endswith(".tsx"):
            continue
        path = os.path.join(root, filename)
        source = io.open(path, encoding="utf-8").read()
        if not re.match(r'^\s*(?:"use server"|\'use server\')', source):
            continue

        names = list(re.finditer(r"^export async function (\w+)", source, re.M))
        bounds = [m.start() for m in names] + [len(source)]
        for i, match in enumerate(names):
            name = match.group(1)
            body = source[bounds[i]:bounds[i + 1]]
            checked += 1
            if any(guard in body for guard in GUARDS):
                continue
            if name in ALLOWED_WITHOUT_GUARD:
                continue
            problems.append(f"UNGUARDED  {path} -> {name}")

print(f"server actions checked: {checked}")
if problems:
    print(f"\n{len(problems)} problem(s):")
    for item in problems:
        print("  " + item)
else:
    print("PASS - every server action identifies its caller")
