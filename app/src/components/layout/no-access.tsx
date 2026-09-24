import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLandingPath } from "@/lib/landing";
import type { Role } from "@/lib/types";

const ROLE_LABEL: Record<Role, string> = {
  admin: "an administrator",
  supervisor: "a supervisor",
  staff: "staff",
  workshop: "workshop",
};

/**
 * Shown when somebody reaches a page their role does not allow.
 *
 * Deliberately a page rather than a silent redirect. A bounce back to the
 * dashboard is indistinguishable from a broken link, and the person ends up
 * asking whether the system is down instead of who can give them access.
 * See ACCESS_CONTROL.md, "Denied access".
 */
export function NoAccess({
  role,
  what,
  who = "an administrator",
}: {
  role: Role;
  /** What they tried to reach, e.g. "the edit request queue". */
  what: string;
  /** Who can grant it or do it for them. */
  who?: string;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <ShieldOff className="h-6 w-6 text-muted-foreground" aria-hidden />
        </div>

        <h1 className="text-xl font-semibold">You don&apos;t have access to this</h1>

        <p className="mt-2 text-sm text-muted-foreground">
          {what.charAt(0).toUpperCase() + what.slice(1)} is not available to{" "}
          {ROLE_LABEL[role] ?? "your role"}. Ask {who} if you need it.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href={getLandingPath(role)}>Back to where you work</Link>
          </Button>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Nothing was changed, and this attempt is not held against you — a link
          or bookmark may simply be out of date.
        </p>
      </div>
    </div>
  );
}
