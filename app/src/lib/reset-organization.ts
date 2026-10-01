import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ROOT_ADMIN_EMAIL } from "@/lib/root-admin";
import { requireRole } from "@/lib/session";
import { deleteFromR2, getKeyFromUrl } from "@/lib/r2";
import {
  AGENT_WHATSAPP_SESSION_NAME,
  revokeAgentWhatsAppPairing,
} from "@/lib/whatsapp/agent-control";

type ResetFailure = { success: false; error: string };
type ResetSuccess = {
  success: true;
  deleted: number;
  usersRemoved: number;
  assistantMemoryCleared: boolean;
  whatsappTold: boolean;
  fileDeletionFailures: number;
};

type ResetDependencies = {
  revokePairing?: typeof revokeAgentWhatsAppPairing;
  deleteFile?: typeof deleteFromR2;
  clearPairingStore?: (
    tx: Prisma.TransactionClient,
  ) => Promise<{ count: number }>;
};

/** Server-side entry point shared by the settings action and safe tests. */
export async function executeOrganizationReset(
  confirmation?: string,
  dependencies: ResetDependencies = {},
): Promise<ResetSuccess | ResetFailure> {
  const session = await requireRole(["admin"]);

  if (confirmation !== "DELETE ALL DATA") {
    return {
      success: false,
      error: 'Type "DELETE ALL DATA" exactly to confirm.',
    };
  }

  return resetOrganizationData(session.organizationId, dependencies);
}

/**
 * Erase one organisation's operational data and company profile, leaving its
 * seeded administrator as the only member/account. The organisation row and
 * slug remain as the necessary shell for that account's membership.
 *
 * This function assumes the caller has authenticated and checked the typed
 * confirmation. It still verifies that the configured seeded administrator
 * exists in this organisation before doing anything destructive.
 */
export async function resetOrganizationData(
  organizationId: string,
  dependencies: ResetDependencies = {},
): Promise<ResetSuccess | ResetFailure> {
  const seededAdmin = await prisma.member.findFirst({
    where: {
      organizationId,
      role: "admin",
      user: { email: { equals: ROOT_ADMIN_EMAIL, mode: "insensitive" } },
    },
    select: { userId: true },
  });

  if (!seededAdmin) {
    return {
      success: false,
      error:
        "The seeded administrator account is not an admin in this organisation. No data was reset.",
    };
  }

  const [members, contacts, messages, organization, trucks, trailers, drivers, employees, expenses, reports] = await Promise.all([
    prisma.member.findMany({
      where: { organizationId },
      select: { userId: true },
    }),
    prisma.whatsAppContact.findMany({
      where: { organizationId },
      select: { phone: true },
    }),
    prisma.whatsAppMessage.findMany({
      where: { organizationId },
      select: { phone: true },
      distinct: ["phone"],
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { logo: true },
    }),
    prisma.truck.findMany({
      where: { organizationId },
      select: { image: true },
    }),
    prisma.trailer.findMany({
      where: { organizationId },
      select: { image: true },
    }),
    prisma.driver.findMany({
      where: { organizationId },
      select: { image: true },
    }),
    prisma.employee.findMany({
      where: { organizationId },
      select: { image: true },
    }),
    prisma.expense.findMany({
      where: { organizationId },
      select: { receiptUrl: true },
    }),
    prisma.report.findMany({
      where: { organizationId },
      select: { fileUrl: true },
    }),
  ]);
  const fileUrls = [
    organization?.logo,
    ...trucks.map((row) => row.image),
    ...trailers.map((row) => row.image),
    ...drivers.map((row) => row.image),
    ...employees.map((row) => row.image),
    ...expenses.map((row) => row.receiptUrl),
    ...reports.map((row) => row.fileUrl),
  ].filter((url): url is string => Boolean(url));

  const memberUserIds = [...new Set(members.map((member) => member.userId))];
  const nonSeededUserIds = memberUserIds.filter(
    (userId) => userId !== seededAdmin.userId,
  );
  const conversationPhones = [
    ...new Set([...contacts, ...messages].map(({ phone }) => phone)),
  ];
  const memoryResourceIds = new Set<string>();

  for (const phone of conversationPhones) {
    const normalized = phone.replace(/@.*$/, "").replace(/\D/g, "");
    if (!normalized) continue;

    // New memories are organisation-namespaced. The unprefixed form is the
    // legacy key used before tenant scoping was added.
    memoryResourceIds.add(`wa:${organizationId}:${normalized}`);
    memoryResourceIds.add(`wa:${normalized}`);
  }

  // The live agent owns the Chromium session and backs it up periodically.
  // Ask it to log out before deleting the database row, otherwise it could
  // recreate the pairing after this request. Fail closed: no data is removed
  // unless logout is confirmed.
  const pairing = await (dependencies.revokePairing ?? revokeAgentWhatsAppPairing)(organizationId);
  if (!pairing.success) return pairing;

  try {
    const result = await prisma.$transaction(async (tx) => {
      let deleted = 0;
      const count = (result: { count: number }) => {
        deleted += result.count;
      };

      // Children before parents; most foreign keys deliberately do not
      // cascade because the application needs to preserve ordinary records.
      count(await tx.invoiceLineItem.deleteMany({ where: { invoice: { organizationId } } }));
      count(await tx.payment.deleteMany({ where: { customer: { organizationId } } }));
      count(await tx.invoice.deleteMany({ where: { organizationId } }));
      count(await tx.tripExpense.deleteMany({ where: { expense: { organizationId } } }));
      count(await tx.truckExpense.deleteMany({ where: { expense: { organizationId } } }));
      count(await tx.trailerExpense.deleteMany({ where: { expense: { organizationId } } }));
      count(await tx.driverExpense.deleteMany({ where: { expense: { organizationId } } }));
      count(await tx.expense.deleteMany({ where: { organizationId } }));
      count(await tx.accountTransaction.deleteMany({ where: { account: { organizationId } } }));
      count(await tx.supplierPayment.deleteMany({ where: { organizationId } }));
      count(await tx.supplier.deleteMany({ where: { organizationId } }));
      count(await tx.customer.deleteMany({ where: { organizationId } }));
      count(await tx.expenseCategory.deleteMany({ where: { organizationId } }));

      count(await tx.partAllocation.deleteMany({ where: { inventoryItem: { organizationId } } }));
      count(await tx.stockMovement.deleteMany({ where: { organizationId } }));
      count(await tx.inventoryItem.deleteMany({ where: { organizationId } }));
      count(await tx.maintenanceRequest.deleteMany({ where: { organizationId } }));
      count(await tx.trip.deleteMany({ where: { organizationId } }));
      count(await tx.driverTruckAssignment.deleteMany({ where: { organizationId } }));
      count(await tx.trailer.deleteMany({ where: { organizationId } }));
      count(await tx.driver.deleteMany({ where: { organizationId } }));
      count(await tx.truck.deleteMany({ where: { organizationId } }));
      count(await tx.expiryReminder.deleteMany({ where: { organizationId } }));
      count(await tx.employee.deleteMany({ where: { organizationId } }));

      count(await tx.report.deleteMany({ where: { organizationId } }));
      count(await tx.documentHandoff.deleteMany({ where: { organizationId } }));
      count(await tx.editRequest.deleteMany({ where: { organizationId } }));
      count(await tx.userNotification.deleteMany({ where: { organizationId } }));
      count(await tx.notificationPreference.deleteMany({ where: { organizationId } }));
      count(await tx.pushDelivery.deleteMany({ where: { organizationId } }));
      count(await tx.notification.deleteMany({ where: { organizationId } }));

      count(await tx.whatsAppMessage.deleteMany({ where: { organizationId } }));
      count(await tx.whatsAppContact.deleteMany({ where: { organizationId } }));
      count(await tx.invitation.deleteMany({ where: { organizationId } }));
      count(await tx.financialAccount.deleteMany({ where: { organizationId } }));
      count(await tx.session.deleteMany({ where: { userId: { in: memberUserIds } } }));
      const pairingRows = await (dependencies.clearPairingStore ??
        ((transaction: Prisma.TransactionClient) =>
          transaction.whatsAppSession.deleteMany({
            where: { session: AGENT_WHATSAPP_SESSION_NAME },
          })))(tx);
      count(pairingRows);

      // Expire all sessions belonging to this organisation's members,
      // including the seeded admin. The account remains and can sign in again.
      const assistantMemory = await clearAssistantMemory(
        tx,
        organizationId,
        [...memoryResourceIds],
      );
      if (!assistantMemory.success) {
        throw new Error("Could not clear the assistant's stored conversation memory.");
      }
      deleted += assistantMemory.deleted;

      // Remove this organisation's memberships, but never delete a person who
      // remains a member of another organisation in a shared database.
      count(
        await tx.member.deleteMany({
          where: { organizationId, userId: { not: seededAdmin.userId } },
        }),
      );

      const usersWithOtherMemberships = await tx.member.findMany({
        where: { userId: { in: memberUserIds } },
        select: { userId: true },
        distinct: ["userId"],
      });
      const remainingUserIds = new Set(
        usersWithOtherMemberships.map((member) => member.userId),
      );
      const resetOnlyUserIds = memberUserIds.filter(
        (userId) => !remainingUserIds.has(userId),
      );
      if (resetOnlyUserIds.length > 0) {
        count(
          await tx.pushSubscription.deleteMany({
            where: { userId: { in: resetOnlyUserIds } },
          }),
        );
      }

      const removedUsers = nonSeededUserIds.length
        ? await tx.user.deleteMany({
            where: {
              id: { in: nonSeededUserIds },
              members: { none: {} },
            },
          })
        : { count: 0 };
      count(removedUsers);

      // A name and slug are required for the organization that contains the
      // seeded account. Clear the actual profile/settings, keeping only that
      // structural shell.
      await tx.organization.update({
        where: { id: organizationId },
        data: {
          name: "",
          logo: null,
          metadata: null,
          addressLine1: null,
          addressLine2: null,
          city: null,
          country: null,
          phone: null,
          altPhone: null,
          email: null,
          website: null,
          vatNumber: null,
          bpNumber: null,
          bankDetails: null,
          invoiceTerms: null,
        },
      });

      return {
        deleted,
        usersRemoved: removedUsers.count,
        assistantMemoryCleared: assistantMemory.success,
      };
    }, { timeout: 60_000 });

    const fileKeys = new Set(
      (await Promise.all(fileUrls.map((url) => getKeyFromUrl(url)))).filter(
        (key): key is string => Boolean(key),
      ),
    );
    const fileResults = await Promise.all(
      [...fileKeys].map((key) => (dependencies.deleteFile ?? deleteFromR2)(key)),
    );

    return {
      success: true,
      ...result,
      whatsappTold: pairing.toldWhatsApp,
      fileDeletionFailures: fileResults.filter((item) => !item.success).length,
    };
  } catch (error) {
    console.error("Failed to reset organization data:", error);
    return {
      success: false,
      error:
        "WhatsApp pairing was revoked, but the data reset did not complete. Do not retry blindly; check the database, then reconnect WhatsApp after resolving the issue.",
    };
  }
}

/**
 * Delete only the stored assistant conversations belonging to the phone
 * numbers recorded for this organisation. Missing Mastra tables are a valid
 * state on a fresh deployment.
 */
async function clearAssistantMemory(
  tx: Prisma.TransactionClient,
  organizationId: string,
  resourceIds: string[],
): Promise<{ success: boolean; deleted: number }> {
  let deleted = 0;

  try {
    const tables = await tx.$queryRaw<
      Array<{
        messages: string | null;
        threads: string | null;
        resources: string | null;
      }>
    >`
      SELECT
        to_regclass('mastra.mastra_messages')::text AS messages,
        to_regclass('mastra.mastra_threads')::text AS threads,
        to_regclass('mastra.mastra_resources')::text AS resources
    `;
    const existing = tables[0];
    if (!existing) return { success: true, deleted: 0 };

    const prefix = `wa:${organizationId}:`;

    if (existing.messages) {
      deleted += await tx.$executeRaw`
        DELETE FROM "mastra"."mastra_messages"
        WHERE left("resourceId", length(${prefix})) = ${prefix}
      `;
    }
    if (existing.threads) {
      deleted += await tx.$executeRaw`
        DELETE FROM "mastra"."mastra_threads"
        WHERE left("resourceId", length(${prefix})) = ${prefix}
      `;
    }
    if (existing.resources) {
      deleted += await tx.$executeRaw`
        DELETE FROM "mastra"."mastra_resources"
        WHERE left(id, length(${prefix})) = ${prefix}
      `;
    }

    for (const resourceId of resourceIds.filter((id) => !id.startsWith(prefix))) {
      if (existing.messages) {
        deleted += await tx.$executeRaw`
          DELETE FROM "mastra"."mastra_messages" WHERE "resourceId" = ${resourceId}
        `;
      }
      if (existing.threads) {
        deleted += await tx.$executeRaw`
          DELETE FROM "mastra"."mastra_threads" WHERE "resourceId" = ${resourceId}
        `;
      }
      if (existing.resources) {
        deleted += await tx.$executeRaw`
          DELETE FROM "mastra"."mastra_resources" WHERE id = ${resourceId}
        `;
      }
    }

    return { success: true, deleted };
  } catch (error) {
    console.error("Could not clear the assistant's stored conversation memory:", error);
    return { success: false, deleted };
  }
}
