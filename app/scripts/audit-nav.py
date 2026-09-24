"""Every nav link must be openable by every role it is shown to.

A link shown to someone the page then turns away is a defect: they click it,
get told no, and ask whether the system is broken. Run from app/.
"""
import io
import os
import re

NAV = os.path.join("src", "config", "navigation.ts")
source = io.open(NAV, encoding="utf-8").read()

# title, href and roles appear in that order within each entry.
entries = re.findall(
    r'title:\s*"([^"]+)",\s*href:\s*"([^"]+)",[\s\S]{0,300}?roles:\s*\[([^\]]*)\]',
    source,
)

# These three are collapsible section headers, not links: the sidebar renders
# any item with visible children as a toggle, so their href is never followed
# and there is deliberately no page behind it.
PAGELESS_GROUPS = {"/fleet", "/operations", "/finance"}

GUARD = re.compile(r"(?:pageAccess|requireRole)\(\s*\[([^\]]*)\]")
ROLE = re.compile(r"""['"](\w+)['"]""")

problems = []
checked = 0

for title, href, roles_raw in entries:
    nav_roles = set(ROLE.findall(roles_raw))
    page = href.lstrip("/")
    path = os.path.join("src", "app", "(dashboard)", *page.split("/"), "page.tsx") if page else None

    if href in PAGELESS_GROUPS:
        continue
    if not path or not os.path.exists(path):
        problems.append(f"NO PAGE        {title:22} {href}")
        continue

    page_source = io.open(path, encoding="utf-8").read()
    match = GUARD.search(page_source)
    if not match:
        if "requireAuth(" in page_source:
            problems.append(f"PAGE UNGUARDED {title:22} {href}  (requireAuth only)")
            continue
        problems.append(f"PAGE UNGUARDED {title:22} {href}")
        continue

    page_roles = set(ROLE.findall(match.group(1)))
    checked += 1

    shown_but_denied = nav_roles - page_roles
    if shown_but_denied:
        problems.append(
            f"DEAD LINK      {title:22} {href}\n"
            f"                 shown to {sorted(nav_roles)}\n"
            f"                 page allows {sorted(page_roles)}\n"
            f"                 would be turned away: {sorted(shown_but_denied)}"
        )

print(f"nav links checked: {checked}/{len(entries)}")
if problems:
    print(f"\n{len(problems)} problem(s):")
    for item in problems:
        print("  " + item)
else:
    print("PASS — no role is shown a link it cannot open")
