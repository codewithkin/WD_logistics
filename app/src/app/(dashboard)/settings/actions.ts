"use server";

import { revalidatePath } from "next/cache";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { sendEmail, generateRandomPassword } from "@/lib/email";

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

export async function inviteMember(data: { email: string; role: string; name?: string }) {
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

      // User exists but not a member - add them to the organization
      await prisma.member.create({
        data: {
          organizationId: session.organizationId,
          userId: existingUser.id,
          role: data.role,
        },
      });

      revalidatePath("/settings");
      return { success: true, message: "Existing user added to organization" };
    }

    // Generate a random password for the new user
    const password = generateRandomPassword(12);
    const hashedPassword = await hashPassword(password);

    // Create new user with account and member record in a transaction
    const newUser = await prisma.user.create({
      data: {
        name: data.name || data.email.split("@")[0],
        email: data.email,
        emailVerified: true, // Skip email verification for invited users
        accounts: {
          create: {
            accountId: data.email,
            providerId: "credential",
            password: hashedPassword,
          },
        },
        members: {
          create: {
            organizationId: session.organizationId,
            role: data.role,
          },
        },
      },
    });

    // Get organization name for the email
    const organization = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { name: true },
    });

    // Send credentials email
    const appUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
    const roleLabel = {
      admin: "Administrator",
      supervisor: "Supervisor",
      staff: "Staff Member",
    }[data.role] || "Team Member";

    await sendEmail({
      to: data.email,
      subject: `Welcome to ${organization?.name || "WD Logistics"} - Your Account Credentials`,
      text: `
Welcome to ${organization?.name || "WD Logistics"}!

You have been invited as a ${roleLabel}. Here are your login credentials:

Email: ${data.email}
Password: ${password}

Please login at: ${appUrl}/sign-in

For security, please change your password after your first login.

Best regards,
${organization?.name || "WD Logistics"} Team
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a1a2e; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1a1a2e; }
    .credentials p { margin: 8px 0; }
    .credentials strong { color: #1a1a2e; }
    .button { display: inline-block; background: #1a1a2e; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
    .warning { color: #666; font-size: 14px; margin-top: 20px; padding: 15px; background: #fff3cd; border-radius: 6px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to ${organization?.name || "WD Logistics"}</h1>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>You have been invited as a <strong>${roleLabel}</strong> to the ${organization?.name || "WD Logistics"} platform.</p>
      
      <div class="credentials">
        <h3>Your Login Credentials</h3>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Password:</strong> ${password}</p>
      </div>
      
      <a href="${appUrl}/sign-in" class="button">Login Now</a>
      
      <div class="warning">
        <strong>Security Notice:</strong> For your security, please change your password after your first login.
      </div>
      
      <p style="margin-top: 30px;">Best regards,<br>${organization?.name || "WD Logistics"} Team</p>
    </div>
  </div>
</body>
</html>
      `.trim(),
    });

    revalidatePath("/settings");
    return { success: true, message: "User created and invitation sent" };
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
