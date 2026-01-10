import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@/lib/types";
import { redirect } from "next/navigation";

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

export async function requireRole(allowedRoles: Role[]): Promise<ServerSession> {
  const session = await requireAuth();
  
  if (!allowedRoles.includes(session.role)) {
    redirect("/dashboard");
  }
  
  return session;
}