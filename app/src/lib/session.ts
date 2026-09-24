import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@/lib/types";
import { getLandingPath } from "@/lib/landing";
import { UserFacingError } from "@/lib/error-messages";
import { redirect } from "next/navigation";
import { getActingSession } from "@/lib/acting-session";

export interface ServerSession {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
  role: Role;
  organizationId: string;
}

export async function getServerSession(): Promise<ServerSession | null> {
  // A non-browser caller (the WhatsApp assistant) may be running as a real
  // user for the length of one operation. That takes precedence over the
  // cookie, because in that call chain there is no cookie to read.
  const acting = getActingSession();
  if (acting) {
    return acting;
  }

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return null;
    }

    // Get the user's membership to find their role
    const member = await prisma.member.findFirst({
      where: {
        userId: session.user.id,
      },
      include: {
        organization: true,
      },
    });

    if (!member) {
      return null;
    }

    return {
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image || null,
      },
      role: member.role as Role,
      organizationId: member.organizationId,
    };
  } catch (error) {
    console.error("Error getting session:", error);
    return null;
  }
}

export async function requireAuth(): Promise<ServerSession> {
  const session = await getServerSession();
  
  if (!session) {
    redirect("/sign-in");
  }
  
  return session;
}

/**
 * Role check for server actions that a client component calls directly.
 *
 * `requireRole` redirects, which is right for a page render but wrong inside an
 * action invoked from a dialog or form: the caller sees a failed request with
 * no message, so a blocked action looks like a crash. This throws instead, and
 * the message is already written for the user (`toUserMessage` passes
 * UserFacingError straight through).
 */
export async function assertRole(allowedRoles: Role[]): Promise<ServerSession> {
  const session = await requireAuth();

  if (!allowedRoles.includes(session.role)) {
    throw new UserFacingError(
      "You don't have permission to do that. Ask an admin to make this change.",
    );
  }

  return session;
}

export async function requireRole(allowedRoles: Role[]): Promise<ServerSession> {
  const session = await requireAuth();
  
  if (!allowedRoles.includes(session.role)) {
    // Bounce to the role's own landing page, not a hardcoded /dashboard —
    // workshop users can't see the dashboard, so that would strand them.
    redirect(getLandingPath(session.role));
  }
  
  return session;
}
/**
 * The guard every dashboard page should use.
 *
 * Unlike `requireRole`, which silently redirects, this hands the page back a
 * decision so it can render the no-access page instead — a bounce looks like
 * a broken link (ACCESS_CONTROL.md, "Denied access"). Signed-out users still
 * go to /sign-in, because there is nothing to explain to someone who has not
 * logged in.
 *
 *   const access = await pageAccess(["admin"]);
 *   if (!access.allowed) return <NoAccess role={access.role} what="reports" />;
 *   const { session } = access;
 */
export async function pageAccess(
  allowedRoles: Role[],
): Promise<
  | { allowed: true; session: ServerSession; role: Role }
  | { allowed: false; role: Role }
> {
  const session = await requireAuth();

  if (!allowedRoles.includes(session.role)) {
    return { allowed: false, role: session.role };
  }

  return { allowed: true, session, role: session.role };
}
