/**
 * Cron Job: Truck, Trailer & Driver Document Expiry Reminders
 *
 * GET /api/cron/document-expiry-reminders
 *
 * Meant to be called once daily by an external scheduler, same as
 * /api/cron/invoice-reminders.
 *
 * Tracks every expiry field in EXPIRY_FIELDS (@/lib/expiry-reminders).
 * Advance reminders use the days configured for that specific entity and
 * document (the bell popover on the truck/trailer/driver forms), falling back
 * to DEFAULT_REMINDER_DAYS when none are set. The expiry day itself and every
 * 7 days after lapsing always send, until the date on the record is renewed.
 *
 * Sent via WhatsApp through the agent service, to the admin always, and
 * additionally to the driver's own WhatsApp number for driver-owned
 * documents (the driver should know their own permit is expiring too).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import {
  EXPIRY_FIELDS,
  shouldSendExpiryReminder,
  type ExpiryEntityType,
} from "@/lib/expiry-reminders";

const CRON_SECRET = process.env.CRON_SECRET;
const AGENT_URL = process.env.AGENT_URL || "http://localhost:3001";
const ADMIN_WHATSAPP_NUMBER = process.env.ADMIN_WHATSAPP_NUMBER;

const ENTITY_LABELS: Record<ExpiryEntityType, string> = {
  truck: "🚛 Truck",
  trailer: "🚚 Trailer",
  driver: "👤 Driver",
};

interface TrackedDocument {
  organizationId: string;
  entityType: ExpiryEntityType;
  entityId: string;
  entityLabel: string;
  field: string;
  documentLabel: string;
  expiryDate: Date;
  driverPhone: string | null;
}

function daysUntil(date: Date, from: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((date.getTime() - from.getTime()) / msPerDay);
}

function collectDocuments(
  entityType: ExpiryEntityType,
  entity: Record<string, unknown> & { id: string; organizationId: string },
  entityLabel: string,
  driverPhone: string | null
): TrackedDocument[] {
  return EXPIRY_FIELDS[entityType].flatMap(({ field, label }) => {
    const value = entity[field];
    if (!(value instanceof Date)) return [];
    return [{
      organizationId: entity.organizationId,
      entityType,
      entityId: entity.id,
      entityLabel,
      field,
      documentLabel: label,
      expiryDate: value,
      driverPhone,
    }];
  });
}

async function sendWhatsApp(organizationId: string, phoneNumber: string, message: string) {
  const response = await fetch(`${AGENT_URL}/whatsapp/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organizationId, phoneNumber, message }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `WhatsApp send failed (${response.status})`);
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [trucks, trailers, drivers, reminderRows, sentToday] = await Promise.all([
      prisma.truck.findMany({
        where: {
          status: { not: "decommissioned" },
          OR: EXPIRY_FIELDS.truck.map(({ field }) => ({ [field]: { not: null } })),
        },
      }),
      prisma.trailer.findMany({
        where: {
          status: { not: "decommissioned" },
          OR: EXPIRY_FIELDS.trailer.map(({ field }) => ({ [field]: { not: null } })),
        },
      }),
      prisma.driver.findMany({
        where: {
          status: { not: "terminated" },
          OR: EXPIRY_FIELDS.driver.map(({ field }) => ({ [field]: { not: null } })),
        },
      }),
      prisma.expiryReminder.findMany({
        select: { entityType: true, entityId: true, field: true, daysBefore: true },
      }),
      prisma.notification.findMany({
        where: { type: "document_expiry", createdAt: { gte: todayStart } },
        select: { metadata: true },
      }),
    ]);

    const configuredDays = new Map<string, number[]>();
    for (const row of reminderRows) {
      const key = `${row.entityType}:${row.entityId}:${row.field}`;
      configuredDays.set(key, [...(configuredDays.get(key) ?? []), row.daysBefore]);
    }

    const alreadySentToday = new Set(
      sentToday.map((n) => {
        const m = n.metadata as { entityId?: string; documentType?: string; daysUntil?: number } | null;
        return `${m?.entityId}:${m?.documentType}:${m?.daysUntil}`;
      })
    );

    const documents: TrackedDocument[] = [
      ...trucks.flatMap((truck) => collectDocuments("truck", truck, truck.registrationNo, null)),
      ...trailers.flatMap((trailer) => collectDocuments("trailer", trailer, trailer.registrationNo, null)),
      ...drivers.flatMap((driver) =>
        collectDocuments(
          "driver",
          driver,
          `${driver.firstName} ${driver.lastName}`,
          driver.whatsappNumber || driver.phone || null
        )
      ),
    ];

    const results = { checked: documents.length, notified: 0, errors: [] as string[] };

    for (const doc of documents) {
      const days = daysUntil(doc.expiryDate, todayStart);
      const custom = configuredDays.get(`${doc.entityType}:${doc.entityId}:${doc.field}`) ?? [];
      if (!shouldSendExpiryReminder(days, custom)) continue;

      const key = `${doc.entityId}:${doc.field}:${days}`;
      if (alreadySentToday.has(key)) continue;

      const isOverdue = days < 0;
      const headline = isOverdue
        ? `*${doc.documentLabel} EXPIRED* (${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago)`
        : days === 0
          ? `*${doc.documentLabel} expires TODAY*`
          : `*${doc.documentLabel} expires in ${days} day${days === 1 ? "" : "s"}*`;

      const message = `📋 ${headline}

${ENTITY_LABELS[doc.entityType]}: *${doc.entityLabel}*
📅 Expiry date: ${format(doc.expiryDate, "PPP")}

${isOverdue ? "Please renew this as soon as possible." : "Please arrange renewal ahead of the expiry date."}`;

      const recipients = new Set<string>();
      if (ADMIN_WHATSAPP_NUMBER) recipients.add(ADMIN_WHATSAPP_NUMBER);
      if (doc.entityType === "driver" && doc.driverPhone) recipients.add(doc.driverPhone);

      let sentToAny = false;
      for (const phone of recipients) {
        try {
          await sendWhatsApp(doc.organizationId, phone, message);
          sentToAny = true;
        } catch (err) {
          results.errors.push(
            `${doc.entityLabel} / ${doc.documentLabel}: ${err instanceof Error ? err.message : "Unknown error"}`
          );
        }
      }

      // Log once per document/day even if it went to multiple recipients, so
      // alreadySentToday's idempotency key stays correct on a re-run.
      await prisma.notification.create({
        data: {
          type: "document_expiry",
          recipientPhone: [...recipients].join(",") || "none-configured",
          message,
          status: sentToAny ? "sent" : "failed",
          sentAt: sentToAny ? now : null,
          metadata: {
            entityType: doc.entityType,
            entityId: doc.entityId,
            entityLabel: doc.entityLabel,
            documentType: doc.field,
            daysUntil: days,
          },
        },
      });

      if (sentToAny) results.notified++;
    }

    return NextResponse.json({ success: true, results, timestamp: now.toISOString() });
  } catch (error) {
    console.error("Cron document expiry reminders error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to process document expiry reminders" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
