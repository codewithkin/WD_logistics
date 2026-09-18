import { Role } from "@/lib/types";

/**
 * Where a role should land after signing in, and where role-gated pages should
 * bounce them when they aren't allowed somewhere.
 *
 * Client-safe (no Prisma) so the sign-in page can use it too.
 *
 * `workshop` has no Dashboard access at all — maintenance requests are their
 * entire surface — so sending them to /dashboard would bounce them straight
 * back out again.
 */
export function getLandingPath(role: Role): string {
  return role === "workshop" ? "/maintenance" : "/dashboard";
}
