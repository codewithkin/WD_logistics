"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Role } from "@/lib/types";
import { generateRandomPassword, sendSupervisorCredentials } from "@/lib/email";
import { auth } from "@/lib/auth";

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

export async function createSupervisor(data: { email: string; name: string }) {
  const session = await requireRole(["admin"]);

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return { success: false, error: "A user with this email already exists" };
    }

    // Generate a random password
    const password = generateRandomPassword(12);

    // Create user using better-auth's internal method
    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash(password);

    // Create the user in the database
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        emailVerified: true, // Pre-verified since admin is creating
      },
    });

    // Create the account (password credential)
    await prisma.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: hashedPassword,
      },
    });

    // Add as member of the organization with supervisor role
    await prisma.member.create({
      data: {
        userId: user.id,
        organizationId: session.organizationId,
        role: "supervisor",
      },
    });

    // Send credentials via email
    const emailResult = await sendSupervisorCredentials(data.email, password);
    
    if (!emailResult.success) {
      console.warn("User created but email failed to send");
      // Still return success since user was created
      return { 
        success: true, 
        member: { userId: user.id },
        warning: "User created but email failed to send. Please share credentials manually.",
        credentials: { email: data.email, password } // Return for manual sharing
      };
    }

    revalidatePath("/users");
    return { success: true, member: { userId: user.id } };
  } catch (error) {
    console.error("Failed to create supervisor:", error);
    return { success: false, error: "Failed to create supervisor" };
  }
}
