"use server";

import { revalidatePath } from "next/cache";
import { toWhatsAppId } from "@/lib/whatsapp/wa-id";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/prisma";
import { requireRole, assertRole } from "@/lib/session";
import { sendEmail, generateRandomPassword } from "@/lib/email";
import { ROOT_ADMIN_EMAIL, isRootAdmin } from "@/lib/root-admin";
import { ensureStandardExpenseCategories } from "@/lib/setup/standard-categories";

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
 * Empty the system and start again.
 *
 * The team spent weeks in here learning the UI, so the database is full of
 * practice trips, invented customers and invoices nobody owes. This is the
 * button that clears it on the morning the business actually starts using it.
 *
 * **What survives, and why each one.**
 *
 * - **The organisation and its settings** — the name, the letterhead, the
 *   bank details, the VAT number. Configuration the client typed in, not
 *   data the team made up, and retyping it is how an invoice goes out with
 *   the wrong account number on it.
 * - **The root administrator** (src/lib/root-admin.ts), and only them. Every
 *   other account goes, because the point is to start again from one person
 *   who then invites the real team.
 * - **The three accounts** — Cash, Bank and Petty Cash exist as
 *   configuration. They come back at zero, with no transactions and no
 *   starting balance, because a balance with nothing behind it is a lie the
 *   ledger tells forever.
 * - **The WhatsApp pairing.** The business's own number, scanned once from a
 *   phone that may not be in the room. The assistant's *memory* and its
 *   *contact list* both go; the line itself stays connected.
 *
 * Everything else is deleted: fleet, trips, money, people, the assistant's
 * memory of every conversation it has had, every contact allowed to talk to
 * it, every push subscription, every notification, every pending invitation
 * and every document parked for collection.
 *
 * Delete order matters — every foreign key points at trucks/drivers/trips
 * and most do not cascade, so children go first and the users who recorded
 * them go last.
 */
export async function wipeAllData(confirmation?: string) {
  const session = await requireRole(["admin"]);
  const { organizationId } = session;

  // The root admin's button, not every admin's — and not only as a matter of
  // authority. This deletes every account but the root's, so an ordinary
  // admin pressing it would delete themselves halfway through their own
  // request and be signed out into an organisation they can no longer
  // administer.
  if (!isRootAdmin(session.user.email)) {
    return {
      success: false,
      error:
        "Only the root administrator can reset the system. Ask them to do it from their own account.",
    };
  }

  // The typed confirmation is deliberate friction: this is the one action in
  // the app with no undo and no paper trail afterwards.
  if (confirmation !== "DELETE ALL DATA") {
    return {
      success: false,
      error: 'Type "DELETE ALL DATA" exactly to confirm.',
    };
  }

  try {
    const orgFilter = { organizationId };

    // Every deleteMany below is scoped to this organisation, directly or
    // through the parent that owns the row. They used to run unqualified, so
    // "wipe all data" emptied every organisation in the database.
    const counts = await prisma.$transaction([
      // ---- Money: the join rows and documents hang off records below ----
      prisma.invoiceLineItem.deleteMany({ where: { invoice: orgFilter } }),
      prisma.payment.deleteMany({ where: { customer: orgFilter } }),
      prisma.invoice.deleteMany({ where: orgFilter }),
      prisma.tripExpense.deleteMany({ where: { expense: orgFilter } }),
      prisma.truckExpense.deleteMany({ where: { expense: orgFilter } }),
      prisma.trailerExpense.deleteMany({ where: { expense: orgFilter } }),
      prisma.driverExpense.deleteMany({ where: { expense: orgFilter } }),
      prisma.expense.deleteMany({ where: orgFilter }),
      prisma.accountTransaction.deleteMany({ where: { account: orgFilter } }),
      prisma.supplierPayment.deleteMany({ where: orgFilter }),
      prisma.supplier.deleteMany({ where: orgFilter }),
      prisma.customer.deleteMany({ where: orgFilter }),
      prisma.expenseCategory.deleteMany({ where: orgFilter }),

      // ---- Fleet and the work it did ----
      prisma.partAllocation.deleteMany({ where: { inventoryItem: orgFilter } }),
      prisma.stockMovement.deleteMany({ where: orgFilter }),
      prisma.inventoryItem.deleteMany({ where: orgFilter }),
      prisma.maintenanceRequest.deleteMany({ where: orgFilter }),
      prisma.trip.deleteMany({ where: orgFilter }),
      // The history of who drove what. Left behind, it describes trucks and
      // drivers that no longer exist and blocks deleting the users who
      // recorded the switches.
      prisma.driverTruckAssignment.deleteMany({ where: orgFilter }),
      prisma.trailer.deleteMany({ where: orgFilter }),
      prisma.driver.deleteMany({ where: orgFilter }),
      prisma.truck.deleteMany({ where: orgFilter }),
      prisma.expiryReminder.deleteMany({ where: orgFilter }),
      prisma.employee.deleteMany({ where: orgFilter }),

      // ---- The paper trail ----
      prisma.report.deleteMany({ where: orgFilter }),
      prisma.documentHandoff.deleteMany({ where: orgFilter }),
      prisma.editRequest.deleteMany({ where: orgFilter }),
      prisma.userNotification.deleteMany({ where: orgFilter }),
      // Notification is the outbound WhatsApp send log and has no
      // organisation column; it is cleared wholesale for this deployment.
      prisma.notification.deleteMany(),

      // ---- The assistant ----
      // Who was allowed to talk to it, and everything they said. The pairing
      // itself (whatsapp_session) is left alone: it is the company's own
      // number, scanned from a phone that may not be in the room.
      prisma.whatsAppMessage.deleteMany({ where: orgFilter }),
      prisma.whatsAppContact.deleteMany({ where: orgFilter }),

      // ---- Invitations nobody accepted ----
      prisma.invitation.deleteMany({ where: orgFilter }),
    ]);

    // ---- People ----
    //
    // Last, because everything above records who did it and most of those
    // foreign keys do not cascade. Sessions, credentials, memberships, push
    // subscriptions and notification preferences all hang off the user row
    // and go with it.
    const doomed = await prisma.member.findMany({
      where: { organizationId, user: { email: { not: ROOT_ADMIN_EMAIL } } },
      select: { userId: true },
    });
    const removedUsers = doomed.length
      ? await prisma.user.deleteMany({
          where: { id: { in: doomed.map((member) => member.userId) } },
        })
      : { count: 0 };

    // Anything the root admin still has pinned to the old world.
    await prisma.pushDelivery.deleteMany({ where: { organizationId } });

    // ---- The accounts come back empty ----
    //
    // Both figures, not just the balance: a starting balance left behind is a
    // number the new books open with and nobody can explain.
    await prisma.financialAccount.updateMany({
      where: orgFilter,
      data: { balance: 0, startingBalance: 0 },
    });

    // ---- Somewhere to start from ----
    //
    // Every expense form needs a category, and the wipe above took them with
    // the expenses. Without this the first thing the client meets after
    // starting afresh is an Expenses page they cannot use and a chart of
    // accounts they have to invent before recording a tank of diesel.
    const categoriesAdded = await ensureStandardExpenseCategories(organizationId);

    // ---- The assistant's memory ----
    //
    // Mastra's tables, in their own `mastra` schema (see
    // agent/src/lib/agent-memory.ts). Prisma does not know about them, so
    // this is raw SQL, and it is guarded: on a deployment where the agent has
    // never started they do not exist yet, and a reset must not fail because
    // of that.
    const memoryCleared = await clearAssistantMemory();

    const deleted =
      counts.reduce((sum, result) => sum + result.count, 0) + removedUsers.count;

    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/settings");
    revalidatePath("/users");

    return {
      success: true,
      deleted,
      usersRemoved: removedUsers.count,
      assistantMemoryCleared: memoryCleared,
      categoriesAdded,
    };
  } catch (error) {
    console.error("Failed to wipe data:", error);
    return { success: false, error: "Failed to wipe data" };
  }
}

/**
 * Forget every conversation the assistant has had.
 *
 * Its memory lives in Mastra's own tables in the `mastra` schema, which
 * Prisma neither created nor models — so this is raw SQL against table names
 * that may not exist yet. `to_regclass` returns null rather than throwing for
 * a missing table, which is what makes this safe to run on a deployment where
 * the agent has never booted.
 *
 * Returns false rather than throwing: a reset that emptied the business but
 * could not reach the chat history should say so, not roll back.
 */
async function clearAssistantMemory(): Promise<boolean> {
  const tables = [
    "mastra.mastra_messages",
    "mastra.mastra_threads",
    "mastra.mastra_resources",
  ];

  try {
    for (const table of tables) {
      await prisma.$executeRawUnsafe(
        `DO $$ BEGIN IF to_regclass('${table}') IS NOT NULL THEN EXECUTE 'DELETE FROM ${table}'; END IF; END $$;`,
      );
    }
    return true;
  } catch (error) {
    console.error("Could not clear the assistant's memory:", error);
    return false;
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
