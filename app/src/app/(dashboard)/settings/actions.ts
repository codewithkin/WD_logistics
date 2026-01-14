"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export async function updateOrganizationSettings(data: {
  name: string;
  logo?: string;
  address?: string;
  phone?: string;
  email?: string;
  currency?: string;
  timezone?: string;
}) {
  const session = await requireRole(["admin"]);

  try {
    const metadata = JSON.stringify({
      address: data.address || "",
      phone: data.phone || "",
      email: data.email || "",
      currency: data.currency || "USD",
      timezone: data.timezone || "UTC",
    });

    await prisma.organization.update({
      where: { id: session.organizationId },
      data: {
        name: data.name,
        logo: data.logo,
        metadata,
      },
    });

    revalidatePath("/settings");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Failed to update settings:", error);
    return { success: false, error: "Failed to update settings" };
  }
}

export async function createExpenseCategory(data: {
  name: string;
  description?: string;
  isTrip?: boolean;
  isTruck?: boolean;
  color?: string;
}) {
  const session = await requireRole(["admin"]);

  try {
    const category = await prisma.expenseCategory.create({
      data: {
        ...data,
        organizationId: session.organizationId,
      },
    });

    revalidatePath("/settings");
    return { success: true, category };
  } catch (error) {
    console.error("Failed to create category:", error);
    return { success: false, error: "Failed to create expense category" };
  }
}

export async function deleteExpenseCategory(id: string) {
  const session = await requireRole(["admin"]);

  try {
    // Check if category has expenses
    const category = await prisma.expenseCategory.findFirst({
      where: { id, organizationId: session.organizationId },
      include: { _count: { select: { expenses: true } } },
    });

    if (!category) {
      return { success: false, error: "Category not found" };
    }

    if (category._count.expenses > 0) {
      return { success: false, error: "Cannot delete category with associated expenses" };
    }

    await prisma.expenseCategory.delete({ where: { id } });

    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete category:", error);
    return { success: false, error: "Failed to delete expense category" };
  }
}

export async function getOrganizationMembers() {
  const session = await requireRole(["admin", "supervisor", "staff"]);

  try {
    const members = await prisma.member.findMany({
      where: { organizationId: session.organizationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, members };
  } catch (error) {
    console.error("Failed to get members:", error);
    return { success: false, error: "Failed to get members", members: [] };
  }
}

export async function inviteMember(data: { email: string; role: string }) {
  const session = await requireRole(["admin"]);

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    // Check if already a member
    if (existingUser) {
      const existingMember = await prisma.member.findUnique({
        where: {
          organizationId_userId: {
            organizationId: session.organizationId,
            userId: existingUser.id,
          },
        },
      });

      if (existingMember) {
        return { success: false, error: "User is already a member" };
      }
    }

    // Check if there's already a pending invitation
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        organizationId: session.organizationId,
        email: data.email,
        status: "pending",
      },
    });

    if (existingInvitation) {
      return { success: false, error: "An invitation is already pending for this email" };
    }

    // Create invitation
    const invitation = await prisma.invitation.create({
      data: {
        organizationId: session.organizationId,
        email: data.email,
        role: data.role,
        inviterId: session.user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // TODO: Send invitation email using sendEmail

    revalidatePath("/settings");
    return { success: true, invitation };
  } catch (error) {
    console.error("Failed to invite member:", error);
    return { success: false, error: "Failed to invite member" };
  }
}

export async function updateMemberRole(memberId: string, role: string) {
  const session = await requireRole(["admin"]);

  try {
    const member = await prisma.member.findFirst({
      where: { id: memberId, organizationId: session.organizationId },
    });

    if (!member) {
      return { success: false, error: "Member not found" };
    }

    // Prevent removing the last admin
    if (member.role === "admin" && role !== "admin") {
      const adminCount = await prisma.member.count({
        where: { organizationId: session.organizationId, role: "admin" },
      });
      if (adminCount <= 1) {
        return { success: false, error: "Cannot remove the last admin" };
      }
    }

    await prisma.member.update({
      where: { id: memberId },
      data: { role },
    });

    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("Failed to update member role:", error);
    return { success: false, error: "Failed to update member role" };
  }
}

export async function removeMember(memberId: string) {
  const session = await requireRole(["admin"]);

  try {
    const member = await prisma.member.findFirst({
      where: { id: memberId, organizationId: session.organizationId },
    });

    if (!member) {
      return { success: false, error: "Member not found" };
    }

    // Prevent removing self
    if (member.userId === session.user.id) {
      return { success: false, error: "Cannot remove yourself" };
    }

    // Prevent removing the last admin
    if (member.role === "admin") {
      const adminCount = await prisma.member.count({
        where: { organizationId: session.organizationId, role: "admin" },
      });
      if (adminCount <= 1) {
        return { success: false, error: "Cannot remove the last admin" };
      }
    }

    await prisma.member.delete({ where: { id: memberId } });

    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("Failed to remove member:", error);
    return { success: false, error: "Failed to remove member" };
  }
}

export async function getPendingInvitations() {
  const session = await requireRole(["admin"]);

  try {
    const invitations = await prisma.invitation.findMany({
      where: {
        organizationId: session.organizationId,
        status: "pending",
      },
      orderBy: { expiresAt: "asc" },
    });

    return { success: true, invitations };
  } catch (error) {
    console.error("Failed to get invitations:", error);
    return { success: false, error: "Failed to get invitations", invitations: [] };
  }
}

export async function cancelInvitation(invitationId: string) {
  const session = await requireRole(["admin"]);

  try {
    const invitation = await prisma.invitation.findFirst({
      where: { id: invitationId, organizationId: session.organizationId },
    });

    if (!invitation) {
      return { success: false, error: "Invitation not found" };
    }

    await prisma.invitation.update({
      where: { id: invitationId },
      data: { status: "canceled" },
    });

    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("Failed to cancel invitation:", error);
    return { success: false, error: "Failed to cancel invitation" };
  }
}
