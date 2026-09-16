/**
 * Cron Job: Truck & Driver Document Expiry Reminders
 *
 * GET /api/cron/document-expiry-reminders
 *
 * Meant to be called once daily by an external scheduler, same as
 * /api/cron/invoice-reminders.
 *
 * Tracks these document expiry dates:
 *   Truck:  cross-border insurance, cross-border permit, vehicle license,
 *           certificate of fitness
 *   Driver: defense certificate, international driving permit (AA)
 *
 * "Advance notification": fires at 30/14/7/3/1/0 days before expiry.
 * "Repeated notification": once a document is overdue, fires again every
 * 7 days until the expiry date on the record is updated (which naturally
 * stops it matching any checkpoint).
 *
 * Sent via WhatsApp through the agent service, to the admin always, and
 * additionally to the driver's own WhatsApp number for driver-owned
 * documents (the driver should know their own permit is expiring too).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";

const CRON_SECRET = process.env.CRON_SECRET;
const AGENT_URL = process.env.AGENT_URL || "http://localhost:3001";
const ADMIN_WHATSAPP_NUMBER = process.env.ADMIN_WHATSAPP_NUMBER;

// Days-before-expiry checkpoints for the advance warning.
const ADVANCE_CHECKPOINTS = new Set([30, 14, 7, 3, 1, 0]);

interface TrackedDocument {
  organizationId: string;
  entityType: "truck" | "driver";
  entityId: string;
  entityLabel: string;
  documentType: string;
  documentLabel: string;
  expiryDate: Date;
  driverPhone: string | null;
}

function daysUntil(date: Date, from: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((date.getTime() - from.getTime()) / msPerDay);
}

function shouldNotify(days: number): boolean {
  if (ADVANCE_CHECKPOINTS.has(days)) return true;
  return days < 0 && Math.abs(days) % 7 === 0;
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

    const [trucks, drivers, sentToday] = await Promise.all([
      prisma.truck.findMany({
        where: {
          status: { not: "decommissioned" },
          OR: [
            { crossBorderInsuranceExpiration: { not: null } },
            { crossBorderPermitExpiration: { not: null } },
            { vehicleLicenseExpiration: { not: null } },
            { certificateOfFitnessExpiration: { not: null } },
          ],
        },
        select: {
          id: true,
          organizationId: true,
          registrationNo: true,
          crossBorderInsuranceExpiration: true,
          crossBorderPermitExpiration: true,
          vehicleLicenseExpiration: true,
          certificateOfFitnessExpiration: true,
        },
      }),
      prisma.driver.findMany({
        where: {
          status: { not: "terminated" },
          OR: [
            { defenseCertificateExpiration: { not: null } },
            { internationalDrivingPermitExpiration: { not: null } },
          ],
        },
        select: {
          id: true,
          organizationId: true,
          firstName: true,
          lastName: true,
          whatsappNumber: true,
          phone: true,
          defenseCertificateExpiration: true,
          internationalDrivingPermitExpiration: true,
        },
      }),
      prisma.notification.findMany({
        where: { type: "document_expiry", createdAt: { gte: todayStart } },
        select: { metadata: true },
      }),
    ]);

    const alreadySentToday = new Set(
      sentToday.map((n) => {
        const m = n.metadata as { entityId?: string; documentType?: string; daysUntil?: number } | null;
        return `${m?.entityId}:${m?.documentType}:${m?.daysUntil}`;
      })
    );

    const documents: TrackedDocument[] = [];

    for (const truck of trucks) {
      const fields: Array<[string, string, Date | null]> = [
        ["cross_border_insurance", "Cross-Border Insurance", truck.crossBorderInsuranceExpiration],
        ["cross_border_permit", "Cross-Border Permit", truck.crossBorderPermitExpiration],
        ["vehicle_license", "Vehicle License", truck.vehicleLicenseExpiration],
        ["certificate_of_fitness", "Certificate of Fitness", truck.certificateOfFitnessExpiration],
      ];
      for (const [documentType, documentLabel, expiryDate] of fields) {
        if (!expiryDate) continue;
        documents.push({
          organizationId: truck.organizationId,
          entityType: "truck",
          entityId: truck.id,
          entityLabel: truck.registrationNo,
          documentType,
          documentLabel,
          expiryDate,
          driverPhone: null,
        });
      }
    }

    for (const driver of drivers) {
      const driverName = `${driver.firstName} ${driver.lastName}`;
      const driverPhone = driver.whatsappNumber || driver.phone || null;
      const fields: Array<[string, string, Date | null]> = [
        ["defense_certificate", "Defense Certificate", driver.defenseCertificateExpiration],
        ["international_driving_permit", "International Driving Permit (AA)", driver.internationalDrivingPermitExpiration],
      ];
      for (const [documentType, documentLabel, expiryDate] of fields) {
        if (!expiryDate) continue;
        documents.push({
          organizationId: driver.organizationId,
          entityType: "driver",
          entityId: driver.id,
          entityLabel: driverName,
          documentType,
          documentLabel,
          expiryDate,
          driverPhone,
        });
      }
    }

    const results = { checked: documents.length, notified: 0, errors: [] as string[] };

    for (const doc of documents) {
      const days = daysUntil(doc.expiryDate, todayStart);
      if (!shouldNotify(days)) continue;

      const key = `${doc.entityId}:${doc.documentType}:${days}`;
      if (alreadySentToday.has(key)) continue;

      const isOverdue = days < 0;
      const headline = isOverdue
        ? `*${doc.documentLabel} EXPIRED* (${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago)`
        : days === 0
          ? `*${doc.documentLabel} expires TODAY*`
          : `*${doc.documentLabel} expires in ${days} day${days === 1 ? "" : "s"}*`;

      const message = `📋 ${headline}

${doc.entityType === "truck" ? "🚛 Truck" : "👤 Driver"}: *${doc.entityLabel}*
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

      // Log once per document/checkpoint even if it went to multiple
      // recipients, so alreadySentToday's idempotency key stays correct.
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
            documentType: doc.documentType,
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
