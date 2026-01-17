"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Role } from "@/lib/types";
import { generateRandomPassword, sendSupervisorCredentials, sendEmail } from "@/lib/email";
import { auth } from "@/lib/auth";
import { notifyUserInvited, notifySupervisorCreated, notifyUserRoleChanged, notifyUserRemoved } from "@/lib/notifications";

export async function updateMemberRole(memberId: string, role: Role) {
  const session = await requireRole(["admin"]);

  try {
    const member = await prisma.member.findFirst({
      where: { id: memberId, organizationId: session.organizationId },
      include: { user: true },
    });

    if (!member) {
      return { success: false, error: "Member not found" };
    }

    // Prevent changing own role
    if (member.userId === session.user.id) {
      return { success: false, error: "Cannot change your own role" };
    }

    const oldRole = member.role;

    const updatedMember = await prisma.member.update({
      where: { id: memberId },
      data: { role },
    });

    // Send admin notification
    notifyUserRoleChanged(
      {
        userName: member.user.name || "Unknown",
        userEmail: member.user.email,
        oldRole,
        newRole: role,
      },
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin notification:", err));

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
      include: { user: true },
    });

    if (!member) {
      return { success: false, error: "Member not found" };
    }

    // Prevent removing self
    if (member.userId === session.user.id) {
      return { success: false, error: "Cannot remove yourself" };
    }

    // Delete the user entirely from the database
    // This will cascade delete the member record and all related data
    await prisma.user.delete({ where: { id: member.userId } });

    // Send admin notification
    notifyUserRemoved(
      {
        userName: member.user.name || "Unknown",
        userEmail: member.user.email,
        role: member.role,
      },
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin notification:", err));

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

    // Send admin notification
    notifyUserInvited(
      { email: data.email, role: data.role },
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin notification:", err));

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
    
    // Send admin notification
    notifySupervisorCreated(
      { email: data.email, name: data.name },
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin notification:", err));
    
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

export async function resetUserPassword(memberId: string) {
  const session = await requireRole(["admin"]);

  try {
    const member = await prisma.member.findFirst({
      where: { id: memberId, organizationId: session.organizationId },
      include: { user: true },
    });

    if (!member) {
      return { success: false, error: "Member not found" };
    }

    // Prevent resetting own password through this method
    if (member.userId === session.user.id) {
      return { success: false, error: "Use Account Settings to change your own password" };
    }

    // Generate a new random password
    const newPassword = generateRandomPassword(12);

    // Hash the password
    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash(newPassword);

    // Update the user's account password
    await prisma.account.updateMany({
      where: {
        userId: member.userId,
        providerId: "credential",
      },
      data: { password: hashedPassword },
    });

    // Get organization name for email
    const organization = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { name: true },
    });

    // Send email with new password
    const appUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
    await sendEmail({
      to: member.user.email,
      subject: `Your Password Has Been Reset - ${organization?.name || "WD Logistics"}`,
      text: `
Hello ${member.user.name},

Your password has been reset by an administrator.

Here are your new login credentials:

Email: ${member.user.email}
New Password: ${newPassword}

Please login at: ${appUrl}/sign-in

For security, please change your password after logging in by going to Account Settings.

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
      <h1>Password Reset</h1>
    </div>
    <div class="content">
      <p>Hello ${member.user.name},</p>
      <p>Your password has been reset by an administrator.</p>
      
      <div class="credentials">
        <h3>Your New Login Credentials</h3>
        <p><strong>Email:</strong> ${member.user.email}</p>
        <p><strong>New Password:</strong> ${newPassword}</p>
      </div>
      
      <a href="${appUrl}/sign-in" class="button">Login Now</a>
      
      <div class="warning">
        <strong>Security Notice:</strong> For your security, please change your password after logging in by going to Account Settings.
      </div>
      
      <p style="margin-top: 30px;">Best regards,<br>${organization?.name || "WD Logistics"} Team</p>
    </div>
  </div>
</body>
</html>
      `.trim(),
    });

    return { 
      success: true, 
      message: "Password reset successfully",
      newPassword, // Return for admin to share manually if needed
      userEmail: member.user.email,
      userName: member.user.name,
    };
  } catch (error) {
    console.error("Failed to reset user password:", error);
    return { success: false, error: "Failed to reset password" };
  }
}
