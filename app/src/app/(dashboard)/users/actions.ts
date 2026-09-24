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

    // Send admin notification
    notifySupervisorCreated(
      { email: data.email, name: data.name },
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin notification:", err));

    // Send credentials via email. The user account already exists at this
    // point, so a failed send shouldn't be reported as a failed operation —
    // fall back to handing the password back for manual sharing instead.
    try {
      await sendSupervisorCredentials(data.email, password);
    } catch (emailError) {
      console.warn("User created but email failed to send:", emailError);
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

    // An admin resetting their own password is allowed. It used to be
    // refused and pointed at Account Settings, which is no help to an admin
    // who has forgotten the current password — the only way out was editing
    // the database. The new password is emailed to them like anyone else's.

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

    // Send email with new password. The password is already changed in the
    // DB by this point, so a failed send shouldn't be reported as a failed
    // reset — fall back to handing it back for the admin to share manually.
    const appUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
    let emailFailed = false;
    try {
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
    } catch (emailError) {
      console.warn("Password reset but email failed to send:", emailError);
      emailFailed = true;
    }

    return {
      success: true,
      message: emailFailed
        ? "Password reset, but the notification email failed to send. Share the new password manually."
        : "Password reset successfully",
      newPassword, // Return for admin to share manually if needed
      userEmail: member.user.email,
      userName: member.user.name,
    };
  } catch (error) {
    console.error("Failed to reset user password:", error);
    return { success: false, error: "Failed to reset password" };
  }
}

/**
 * The minimum a password must be to be accepted anywhere in this app.
 *
 * better-auth enforces its own minimum on sign-up but not on a direct write
 * to the account row, which is what setting a password this way does — so
 * without this an admin could set a one-character password and lock nothing
 * out at all.
 */
export const MIN_PASSWORD_LENGTH = 8;

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `A password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (/^\s|\s$/.test(password)) {
    return "A password can't start or end with a space — it is too easy to mistype.";
  }
  return null;
}

/**
 * Sets a chosen password on any account in the organisation, the admin's own
 * included.
 *
 * Distinct from `resetUserPassword`, which invents a random one and emails it.
 * This is the "I am standing next to them, set it to this" case, and it is
 * the only path that lets an admin change their *own* password without
 * knowing the current one — deliberately, because the alternative when an
 * admin is locked out is a database edit.
 *
 * The password is never written to any log or notification; only the fact of
 * the change is.
 */
export async function setUserPassword(memberId: string, newPassword: string) {
  const session = await requireRole(["admin"]);

  const problem = passwordProblem(newPassword);
  if (problem) {
    return { success: false as const, error: problem };
  }

  try {
    const member = await prisma.member.findFirst({
      where: { id: memberId, organizationId: session.organizationId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    if (!member) {
      return { success: false as const, error: "Member not found" };
    }

    const ctx = await auth.$context;
    const hashed = await ctx.password.hash(newPassword);

    const updated = await prisma.account.updateMany({
      where: { userId: member.userId, providerId: "credential" },
      data: { password: hashed },
    });

    if (updated.count === 0) {
      return {
        success: false as const,
        error:
          "That account has no password sign-in to change — it was created through a different provider.",
      };
    }

    // Tell them it happened, without putting the password in an email.
    if (member.userId !== session.user.id) {
      try {
        const organization = await prisma.organization.findUnique({
          where: { id: session.organizationId },
          select: { name: true },
        });
        await sendEmail({
          to: member.user.email,
          subject: `Your password was changed - ${organization?.name || "WD Logistics"}`,
          text: `Hello ${member.user.name},

An administrator set a new password on your account just now. You should have
been given it directly.

If you were not expecting this, tell an administrator immediately.

${organization?.name || "WD Logistics"}`,
        });
      } catch (emailError) {
        // The password is already changed; a failed notice is not a failed
        // reset, and saying otherwise would have the admin try again.
        console.warn("Password set, notification email failed:", emailError);
      }
    }

    revalidatePath("/users");
    return {
      success: true as const,
      message:
        member.userId === session.user.id
          ? "Your password has been changed."
          : `Password set for ${member.user.name}.`,
      userName: member.user.name,
      userEmail: member.user.email,
      self: member.userId === session.user.id,
    };
  } catch (error) {
    console.error("Failed to set password:", error);
    return { success: false as const, error: "Failed to set the password" };
  }
}
