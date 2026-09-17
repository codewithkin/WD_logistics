import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  EXPIRY_FIELDS,
  normalizeReminderDays,
  type ExpiryEntityType,
  type ReminderDays,
} from "@/lib/expiry-reminders";

/** Replaces every configured reminder for one entity. Fields not tracked for that entity type are ignored. */
export async function replaceExpiryReminders(
  tx: Prisma.TransactionClient,
  params: { organizationId: string; entityType: ExpiryEntityType; entityId: string; reminders: ReminderDays }
) {
  const allowedFields = new Set(EXPIRY_FIELDS[params.entityType].map((f) => f.field));

  await tx.expiryReminder.deleteMany({
    where: { entityType: params.entityType, entityId: params.entityId },
  });

  const rows = Object.entries(params.reminders)
    .filter(([field]) => allowedFields.has(field))
    .flatMap(([field, days]) =>
      normalizeReminderDays(days).map((daysBefore) => ({
        organizationId: params.organizationId,
        entityType: params.entityType,
        entityId: params.entityId,
        field,
        daysBefore,
      }))
    );

  if (rows.length > 0) {
    await tx.expiryReminder.createMany({ data: rows });
  }
}

export async function getExpiryReminders(
  organizationId: string,
  entityType: ExpiryEntityType,
  entityId: string
): Promise<ReminderDays> {
  const rows = await prisma.expiryReminder.findMany({
    where: { organizationId, entityType, entityId },
    select: { field: true, daysBefore: true },
  });

  const reminders: ReminderDays = {};
  for (const row of rows) {
    (reminders[row.field] ??= []).push(row.daysBefore);
  }
  for (const field of Object.keys(reminders)) {
    reminders[field] = normalizeReminderDays(reminders[field]);
  }
  return reminders;
}

export async function deleteExpiryReminders(
  tx: Prisma.TransactionClient,
  entityType: ExpiryEntityType,
  entityId: string
) {
  await tx.expiryReminder.deleteMany({ where: { entityType, entityId } });
}
