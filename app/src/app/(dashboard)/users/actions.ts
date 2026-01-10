"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Role } from "@/lib/types";

export async function updateMemberRole(memberId: string, role: Role) {
  const session = await requireRole(["admin"]);

  try {
    const member = await prisma.member.findFirst({
      where: { id: memberId, organizationId: session.organizationId },
    });

    if (!member) {
      return { success: false, error: "Member not found" };
    }

    // Prevent changing own role
    if (member.userId === session.user.id) {
      return { success: false, error: "Cannot change your own role" };
    }

    const updatedMember = await prisma.member.update({
      where: { id: memberId },
      data: { role },
    });

    revalidatePath("/users");
    return { success: true, member: updatedMember };
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

    await prisma.member.delete({ where: { id: memberId } });

    revalidatePath("/users");
    return { success: true };
  } catch (error) {
    console.error("Failed to remove member:", error);
    return { success: false, error: "Failed to remove member" };
  }
}

export async function inviteUser(data: {
  email: string;
  role: Role;
}) {
  const session = await requireRole(["admin"]);

  try {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      // In a real app, you would send an invitation email here
      // For now, we'll return an error
      return {
        success: false,
        error: "User not found. They must create an account first.",
      };
    }

    // Check if already a member
    const existingMember = await prisma.member.findFirst({
      where: {
        userId: user.id,
        organizationId: session.organizationId,
      },
    });

    if (existingMember) {
      return { success: false, error: "User is already a member of this organization" };
    }

    const member = await prisma.member.create({
      data: {
        userId: user.id,
        organizationId: session.organizationId,
        role: data.role,
      },
    });

    revalidatePath("/users");
    return { success: true, member };
  } catch (error) {
    console.error("Failed to invite user:", error);
    return { success: false, error: "Failed to invite user" };
  }
}
