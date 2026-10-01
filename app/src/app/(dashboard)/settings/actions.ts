"use server";

import { revalidatePath } from "next/cache";
import { toWhatsAppId } from "@/lib/whatsapp/wa-id";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/prisma";
import { requireRole, assertRole } from "@/lib/session";
import { sendEmail, generateRandomPassword } from "@/lib/email";
import { executeOrganizationReset } from "@/lib/reset-organization";

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
  const session = await requireRole(["admin"]);

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

    // Send credentials email. The user account already exists at this
    // point, so a failed send shouldn't be reported as a failed invite —
    // the password is returned in the response either way, for the admin
    // to share manually if the email didn't go out.
    const appUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
    const roleLabel = {
      admin: "Administrator",
      supervisor: "Supervisor",
      staff: "Staff Member",
      workshop: "Workshop",
    }[data.role] || "Team Member";

    let emailFailed = false;
    try {
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
    } catch (emailError) {
      console.warn("Member created but email failed to send:", emailError);
      emailFailed = true;
    }

    revalidatePath("/settings");
    return {
      success: true,
      message: emailFailed
        ? "User created, but the invitation email failed to send. Share the password manually."
        : "User created and invitation sent",
      password,
    };
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

/**
 * Reset the current organisation. Any admin may initiate it, but the typed
 * confirmation is still checked server-side before the destructive workflow.
 */
export async function wipeAllData(confirmation?: string) {
  try {
    const result = await executeOrganizationReset(confirmation);
    if (!result.success) return result;

    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/settings");
    revalidatePath("/users");
    return result;
  } catch (error) {
    console.error("Failed to reset organization data:", error);
    return { success: false as const, error: "Failed to reset data" };
  }
}

// ============================================================================
// WHATSAPP ASSISTANT CONTACTS
// ============================================================================

/**
 * Who may talk to the assistant.
 *
 * The allowlist was three environment variables, so adding a yard manager
 * meant a redeploy and everyone on the list had identical access. These
 * actions manage it from Settings, with a role per person that means exactly
 * what it means in the app — nobody gains anything by messaging rather than
 * logging in.
 */

export interface WhatsAppContactRow {
  id: string;
  name: string;
  phone: string;
  role: string;
  isActive: boolean;
  notes: string | null;
  lastSeenAt: Date | null;
  messageCount: number;
  userId: string | null;
  /** The linked account's name, for the list. */
  userName: string | null;
  /**
   * The id WhatsApp actually addresses this person by. Shown so a wrong
   * number is visible rather than silently never matching an inbound
   * message.
   */
  waId: string | null;
}

const ASSISTANT_ROLES = ["readonly", "staff", "supervisor", "admin"];

export async function listWhatsAppContacts(): Promise<WhatsAppContactRow[]> {
  const session = await assertRole(["admin"]);

  const rows = await prisma.whatsAppContact.findMany({
    where: { organizationId: session.organizationId },
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
      isActive: true,
      notes: true,
      lastSeenAt: true,
      messageCount: true,
      userId: true,
      user: { select: { name: true } },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return rows.map(({ user, ...row }) => ({
    ...row,
    userName: user?.name ?? null,
    waId: toWhatsAppId(row.phone),
  }));
}

/**
 * The accounts a contact can be linked to.
 *
 * Recording anything by message runs the app's own server actions as that
 * account, so this is the list of people whose name a change can be filed
 * under.
 */
export async function listLinkableUsers(): Promise<
  Array<{ id: string; name: string; email: string; role: string }>
> {
  const session = await assertRole(["admin"]);

  const members = await prisma.member.findMany({
    where: { organizationId: session.organizationId },
    select: {
      role: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { user: { name: "asc" } },
  });

  return members
    .filter((member) => member.user)
    .map((member) => ({
      id: member.user.id,
      name: member.user.name,
      email: member.user.email,
      role: member.role,
    }));
}

export async function saveWhatsAppContact(input: {
  id?: string;
  name: string;
  phone: string;
  isActive: boolean;
  notes?: string;
  /** The dashboard account this number belongs to. Required. */
  userId?: string | null;
}): Promise<{ success: true } | { success: false; error: string }> {
  const session = await assertRole(["admin"]);

  const name = input.name.trim();
  if (name.length < 2) {
    return { success: false, error: "Give them a name." };
  }

  // Normalised on write, so 0772958986 and +263 77 295 8986 are one person
  // rather than two rows with different access.
  const { toE164 } = await import("@/lib/whatsapp/trip-messages");
  const phone = toE164(input.phone);
  if (!phone) {
    return { success: false, error: "That doesn't look like a phone number." };
  }

  const clash = await prisma.whatsAppContact.findFirst({
    where: { phone, ...(input.id ? { NOT: { id: input.id } } : {}) },
    select: { name: true },
  });
  if (clash) {
    return {
      success: false,
      error: `${phone} is already on the list as ${clash.name}.`,
    };
  }

  // A contact must be somebody who already has a login, and their assistant
  // level is that account's role — not a second access list maintained by
  // hand beside the first.
  //
  // It used to be free choice: an admin could type any level against any
  // number, including one linked to nobody, and an unlinked contact was
  // taken at face value for reads. That made the WhatsApp list a way to
  // grant access that the person's own login did not carry.
  //
  // Contacts saved before this rule keep working — see the carve-out below —
  // but any edit has to pick an account.
  const existingContact = input.id
    ? await prisma.whatsAppContact.findFirst({
        where: { id: input.id, organizationId: session.organizationId },
        select: { id: true, userId: true, role: true },
      })
    : null;

  if (input.id && !existingContact) {
    return { success: false, error: "Contact not found." };
  }

  if (!input.userId) {
    return {
      success: false,
      error:
        "Pick the user account this number belongs to. The assistant answers at " +
        "that account's access level, so a contact without one cannot be added.",
    };
  }

  const member = await prisma.member.findFirst({
    where: { userId: input.userId, organizationId: session.organizationId },
    select: { userId: true, role: true },
  });
  if (!member) {
    return { success: false, error: "That account isn't in this organisation." };
  }

  // Workshop has no assistant level — a mechanic's whole world is the jobs
  // assigned to them, which the assistant has nothing to offer.
  if (!ASSISTANT_ROLES.includes(member.role)) {
    return {
      success: false,
      error: `A ${member.role} account cannot use the WhatsApp assistant.`,
    };
  }

  const data = {
    name,
    phone,
    // Inherited, never chosen. Requests are still capped by the weaker of the
    // two at answer time, but the two can no longer disagree in the first
    // place.
    role: member.role,
    isActive: input.isActive,
    notes: input.notes?.trim() || null,
    userId: member.userId,
  };

  if (input.id) {
    await prisma.whatsAppContact.update({ where: { id: input.id }, data });
  } else {
    await prisma.whatsAppContact.create({
      data: { ...data, organizationId: session.organizationId },
    });
  }

  revalidatePath("/settings");
  return { success: true };
}

export async function deleteWhatsAppContact(
  id: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await assertRole(["admin"]);

  const existing = await prisma.whatsAppContact.findFirst({
    where: { id, organizationId: session.organizationId },
    select: { id: true },
  });
  if (!existing) return { success: false, error: "Contact not found." };

  // The transcript survives: WhatsAppMessage.contactId is SetNull, so the
  // audit trail of what they changed is not deleted along with their access.
  await prisma.whatsAppContact.delete({ where: { id } });

  revalidatePath("/settings");
  return { success: true };
}
