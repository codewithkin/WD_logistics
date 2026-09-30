/**
 * Admin Notification Service
 * 
 * Sends email notifications to admin and supervisor users
 * when data is created, updated, or deleted.
 * 
 * For supervisors, financial amounts are hidden.
 */

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import {
  assertTierKeyExists,
  emailsTheOffice,
  getTierConfig,
  tierKeyFor,
  type Role,
} from "@/lib/notification-tiers";

// Types for notification events
export type NotificationEventType = "created" | "updated" | "deleted" | "fixed";

export type NotificationEntityType =
  | "invoice"
  | "payment"
  | "expense"
  | "trip"
  | "truck"
  | "trailer"
  | "maintenance_request"
  | "driver"
  | "customer"
  | "supplier"
  | "employee"
  | "edit_request";

export interface NotificationData {
  entityType: NotificationEntityType;
  eventType: NotificationEventType;
  entityId: string;
  entityName: string; // Display name like "Invoice #INV-00001" or "Trip to Lagos"
  organizationId: string;
  performedBy: {
    name: string;
    email: string;
    role: string;
  };
  details: Record<string, unknown>; // Additional details to show
  /**
   * Keys of `details` that only an admin may see. Stripped from the stored
   * notification for every other recipient.
   *
   * This went unread for a while, on the reasoning that visibility was a
   * role-and-tier question rather than a per-field one. It is both: a trip's
   * creation is a tier-3 event aimed at supervisors, and the trip's *revenue*
   * rode along in the metadata — a figure ACCESS_CONTROL.md keeps at admin
   * "anywhere", written into a supervisor's own notification row, where the
   * bell would happily render it. Whatever is listed here is removed before
   * the row is written, not hidden when it is read.
   *
   * List only what is genuinely admin-only. An expense amount is not: a
   * supervisor records those, and hiding them here would only make the bell
   * less useful than the page it links to.
   */
  sensitiveFields?: string[];
}

/**
 * Get admin and supervisor users for an organization
 */
async function getNotificationRecipients(organizationId: string) {
  console.log("📧 [NOTIFICATION] Fetching recipients for organization:", organizationId);
  
  const members = await prisma.member.findMany({
    where: {
      organizationId,
      // Every role the tier map can address, not just the office two — a
      // workshop-targeted tier had no way to reach anyone before this.
      role: { in: ["admin", "supervisor", "staff", "workshop"] },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  console.log("📧 [NOTIFICATION] Raw members from database:", {
    count: members.length,
    members: members.map(m => ({
      role: m.role,
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
    })),
  });

  return members.map((m) => ({
    userId: m.user.id,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
  }));
}

/**
 * Get event action verb for display
 */
function getActionVerb(eventType: NotificationEventType): string {
  switch (eventType) {
    case "created":
      return "created";
    case "updated":
      return "updated";
    case "deleted":
      return "deleted";
    case "fixed":
      return "marked as fixed";
  }
}

/**
 * Get entity type display name
 */
function getEntityTypeDisplay(entityType: NotificationEntityType): string {
  switch (entityType) {
    case "invoice":
      return "Invoice";
    case "payment":
      return "Payment";
    case "expense":
      return "Expense";
    case "trip":
      return "Trip";
    case "truck":
      return "Truck";
    case "trailer":
      return "Trailer";
    case "maintenance_request":
      return "Maintenance Request";
    case "driver":
      return "Driver";
    case "customer":
      return "Customer";
    case "supplier":
      return "Supplier";
    case "employee":
      return "Employee";
    case "edit_request":
      return "Edit Request";
  }
}

/**
 * Get link for entity
 */
function getEntityLink(entityType: NotificationEntityType, entityId: string): string {
  switch (entityType) {
    case "invoice":
      return `/finance/invoices/${entityId}`;
    case "payment":
      return `/finance/payments`;
    case "expense":
      return `/finance/expenses/${entityId}`;
    case "trip":
      return `/operations/trips/${entityId}`;
    case "truck":
      return `/fleet/trucks/${entityId}`;
    case "trailer":
      return `/fleet/trailers/${entityId}`;
    case "maintenance_request":
      return `/maintenance/${entityId}`;
    case "driver":
      return `/fleet/drivers/${entityId}`;
    case "customer":
      return `/customers/${entityId}`;
    case "supplier":
      return `/suppliers/${entityId}`;
    case "employee":
      return `/employees/${entityId}`;
    case "edit_request":
      return `/edit-requests`;
    default:
      return `/dashboard`;
  }
}

/**
 * Send notification (in-app + web push) to admins/supervisors, gated by
 * notification-tiers.ts — see that file for why email isn't a channel here.
 */
export async function sendAdminNotification(data: NotificationData): Promise<void> {
  try {
    const tierKey = tierKeyFor(data.entityType, data.eventType);
    // Warns in development when a call site invents a key the tier map has
    // never heard of — which silently downgrades it to supervisor-only.
    assertTierKeyExists(tierKey);
    const tierConfig = getTierConfig(tierKey);

    const recipients = await getNotificationRecipients(data.organizationId);

    // Tier + role gating happens BEFORE the performer filter below — this is
    // the actual volume fix: routine creates/updates (tier 3/4) don't list
    // "admin" in their tier config, so admins stop getting pinged for every
    // driver/truck/invoice/etc. Only tier 1/2 events still reach them.
    const eligibleRecipients = recipients.filter((r) =>
      tierConfig.roles.includes(r.role as Role),
    );

    // Filter out the performer from recipients
    const filteredRecipients = eligibleRecipients.filter(r => r.email !== data.performedBy.email);

    if (filteredRecipients.length === 0) {
      return;
    }

    const entityTypeDisplay = getEntityTypeDisplay(data.entityType);
    const actionVerb = getActionVerb(data.eventType);
    const title = `${entityTypeDisplay} ${actionVerb}`;
    const message = `${data.entityName} was ${actionVerb} by ${data.performedBy.name}`;
    const link = getEntityLink(data.entityType, data.entityId);

    // JSON round-trip so Date objects in `details` (e.g. dueDate) become ISO
    // strings — Prisma's Json type rejects raw Dates.
    const details = JSON.parse(JSON.stringify(data.details)) as Record<string, unknown>;
    const redacted = { ...details };
    for (const field of data.sensitiveFields ?? []) delete redacted[field];

    // In-app notification — always written for the audit trail, regardless
    // of tier (tier 5 events just won't have gotten this far via role
    // gating for admin/supervisor, but whoever IS eligible still gets the
    // in-app record; there is no email channel anymore — see push below).
    await Promise.all(
      filteredRecipients.map((recipient) =>
        prisma.userNotification.create({
          data: {
            userId: recipient.userId,
            organizationId: data.organizationId,
            type: data.entityType,
            title,
            message,
            entityType: data.entityType,
            entityId: data.entityId,
            link,
            metadata: {
              // Per recipient, because the same event reaches an admin and a
              // supervisor and they may not see the same figures.
              ...(recipient.role === "admin" ? details : redacted),
              performedBy: data.performedBy.name,
              eventType: data.eventType,
              tier: tierConfig.tier,
            },
          },
        })
      )
    );

    // Native web push — replaces email for this notification system
    // entirely (see src/lib/notification-tiers.ts). Only fires if this
    // tier's channels actually include it (tier 5 is in-app only).
    if (tierConfig.channels.includes("webPush")) {
      await Promise.all(
        filteredRecipients.map((recipient) =>
          sendPushToUser(recipient.userId, {
            title,
            body: message,
            url: link,
            tag: `${data.entityType}-${data.entityId}`,
            category: tierKey,
            organizationId: data.organizationId,
          })
        )
      );
    }
  } catch (error) {
    console.error("[NOTIFICATION] Error in notification process:", error);
    // Don't throw - notifications shouldn't break the main operation
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS FOR SPECIFIC ENTITIES
// =============================================================================

export interface InvoiceNotificationData {
  id: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  status: string;
  isCredit?: boolean;
  dueDate?: Date | null;
}

export async function notifyInvoiceCreated(
  data: InvoiceNotificationData,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "invoice",
    eventType: "created",
    entityId: data.id,
    entityName: `Invoice ${data.invoiceNumber}`,
    organizationId,
    performedBy,
    details: {
      invoiceNumber: data.invoiceNumber,
      customer: data.customerName,
      amount: data.amount,
      status: data.status,
      isCredit: data.isCredit,
      dueDate: data.dueDate,
    },
    // Deliberately nothing: a supervisor records expenses, raises invoices
    // and takes payments, so these amounts are theirs (ACCESS_CONTROL.md).
    sensitiveFields: [],
  });
}

export async function notifyInvoiceUpdated(
  data: InvoiceNotificationData,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "invoice",
    eventType: "updated",
    entityId: data.id,
    entityName: `Invoice ${data.invoiceNumber}`,
    organizationId,
    performedBy,
    details: {
      invoiceNumber: data.invoiceNumber,
      customer: data.customerName,
      amount: data.amount,
      status: data.status,
    },
    // Deliberately nothing: a supervisor records expenses, raises invoices
    // and takes payments, so these amounts are theirs (ACCESS_CONTROL.md).
    sensitiveFields: [],
  });
}

export async function notifyInvoiceDeleted(
  invoiceNumber: string,
  customerName: string,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "invoice",
    eventType: "deleted",
    entityId: "",
    entityName: `Invoice ${invoiceNumber}`,
    organizationId,
    performedBy,
    details: {
      invoiceNumber,
      customer: customerName,
    },
  });
}

// Payment notifications
export interface PaymentNotificationData {
  id: string;
  paymentNumber: string;
  customerName: string;
  amount: number;
  method: string;
}

export async function notifyPaymentCreated(
  data: PaymentNotificationData,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "payment",
    eventType: "created",
    entityId: data.id,
    entityName: `Payment ${data.paymentNumber}`,
    organizationId,
    performedBy,
    details: {
      paymentNumber: data.paymentNumber,
      customer: data.customerName,
      amount: data.amount,
      method: data.method,
    },
    // Deliberately nothing: a supervisor records expenses, raises invoices
    // and takes payments, so these amounts are theirs (ACCESS_CONTROL.md).
    sensitiveFields: [],
  });
}

export async function notifyPaymentUpdated(
  data: PaymentNotificationData,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "payment",
    eventType: "updated",
    entityId: data.id,
    entityName: `Payment ${data.paymentNumber}`,
    organizationId,
    performedBy,
    details: {
      paymentNumber: data.paymentNumber,
      customer: data.customerName,
      amount: data.amount,
      method: data.method,
    },
    // Deliberately nothing: a supervisor records expenses, raises invoices
    // and takes payments, so these amounts are theirs (ACCESS_CONTROL.md).
    sensitiveFields: [],
  });
}

export async function notifyPaymentDeleted(
  paymentNumber: string,
  customerName: string,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "payment",
    eventType: "deleted",
    entityId: "",
    entityName: `Payment ${paymentNumber}`,
    organizationId,
    performedBy,
    details: {
      paymentNumber,
      customer: customerName,
    },
  });
}

// Expense notifications
export interface ExpenseNotificationData {
  id: string;
  description: string;
  category: string;
  amount: number;
  date: Date;
}

export async function notifyExpenseCreated(
  data: ExpenseNotificationData,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "expense",
    eventType: "created",
    entityId: data.id,
    entityName: data.description,
    organizationId,
    performedBy,
    details: {
      description: data.description,
      category: data.category,
      amount: data.amount,
      date: data.date,
    },
    // Deliberately nothing: a supervisor records expenses, raises invoices
    // and takes payments, so these amounts are theirs (ACCESS_CONTROL.md).
    sensitiveFields: [],
  });
}

export async function notifyExpenseUpdated(
  data: ExpenseNotificationData,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "expense",
    eventType: "updated",
    entityId: data.id,
    entityName: data.description,
    organizationId,
    performedBy,
    details: {
      description: data.description,
      category: data.category,
      amount: data.amount,
      date: data.date,
    },
    // Deliberately nothing: a supervisor records expenses, raises invoices
    // and takes payments, so these amounts are theirs (ACCESS_CONTROL.md).
    sensitiveFields: [],
  });
}

export async function notifyExpenseDeleted(
  description: string,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "expense",
    eventType: "deleted",
    entityId: "",
    entityName: description,
    organizationId,
    performedBy,
    details: {
      description,
    },
  });
}

// Trip notifications
export interface TripNotificationData {
  id: string;
  origin: string;
  destination: string;
  scheduledDate: Date;
  truckRegistration: string;
  driverName: string;
  customerName?: string;
  revenue?: number;
  status: string;
}

export async function notifyTripCreated(
  data: TripNotificationData,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "trip",
    eventType: "created",
    entityId: data.id,
    entityName: `Trip: ${data.origin} → ${data.destination}`,
    organizationId,
    performedBy,
    details: {
      route: `${data.origin} → ${data.destination}`,
      scheduledDate: data.scheduledDate,
      truck: data.truckRegistration,
      driver: data.driverName,
      customer: data.customerName,
      revenue: data.revenue,
      status: data.status,
    },
    sensitiveFields: ["revenue"],
  });
}

export async function notifyTripUpdated(
  data: TripNotificationData,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "trip",
    eventType: "updated",
    entityId: data.id,
    entityName: `Trip: ${data.origin} → ${data.destination}`,
    organizationId,
    performedBy,
    details: {
      route: `${data.origin} → ${data.destination}`,
      scheduledDate: data.scheduledDate,
      truck: data.truckRegistration,
      driver: data.driverName,
      customer: data.customerName,
      revenue: data.revenue,
      status: data.status,
    },
    sensitiveFields: ["revenue"],
  });
}

export async function notifyTripDeleted(
  origin: string,
  destination: string,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "trip",
    eventType: "deleted",
    entityId: "",
    entityName: `Trip: ${origin} → ${destination}`,
    organizationId,
    performedBy,
    details: {
      route: `${origin} → ${destination}`,
    },
  });
}

// Truck notifications
export interface TruckNotificationData {
  id: string;
  registrationNo: string;
  make: string;
  model: string;
  year: number;
  status: string;
}

export async function notifyTruckCreated(
  data: TruckNotificationData,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "truck",
    eventType: "created",
    entityId: data.id,
    entityName: `Truck ${data.registrationNo}`,
    organizationId,
    performedBy,
    details: {
      registrationNo: data.registrationNo,
      make: data.make,
      model: data.model,
      year: data.year,
      status: data.status,
    },
  });
}

export async function notifyTruckUpdated(
  data: TruckNotificationData,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "truck",
    eventType: "updated",
    entityId: data.id,
    entityName: `Truck ${data.registrationNo}`,
    organizationId,
    performedBy,
    details: {
      registrationNo: data.registrationNo,
      make: data.make,
      model: data.model,
      year: data.year,
      status: data.status,
    },
  });
}

export async function notifyTruckDeleted(
  registrationNo: string,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "truck",
    eventType: "deleted",
    entityId: "",
    entityName: `Truck ${registrationNo}`,
    organizationId,
    performedBy,
    details: {
      registrationNo,
    },
  });
}

// Trailer notifications
export interface TrailerNotificationData {
  id: string;
  registrationNo: string;
  make: string;
  model: string;
  year: number;
  status: string;
}

export async function notifyTrailerCreated(
  data: TrailerNotificationData,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "trailer",
    eventType: "created",
    entityId: data.id,
    entityName: `Trailer ${data.registrationNo}`,
    organizationId,
    performedBy,
    details: {
      registrationNo: data.registrationNo,
      make: data.make,
      model: data.model,
      year: data.year,
      status: data.status,
    },
  });
}

export async function notifyTrailerUpdated(
  data: TrailerNotificationData,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "trailer",
    eventType: "updated",
    entityId: data.id,
    entityName: `Trailer ${data.registrationNo}`,
    organizationId,
    performedBy,
    details: {
      registrationNo: data.registrationNo,
      make: data.make,
      model: data.model,
      year: data.year,
      status: data.status,
    },
  });
}

export async function notifyTrailerDeleted(
  registrationNo: string,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "trailer",
    eventType: "deleted",
    entityId: "",
    entityName: `Trailer ${registrationNo}`,
    organizationId,
    performedBy,
    details: {
      registrationNo,
    },
  });
}

// Maintenance request notifications
export async function notifyMaintenanceRequestFixed(
  data: {
    id: string;
    vehicleLabel: string;
    fixedNotes?: string | null;
    reportedById?: string | null;
  },
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  // Whoever logged the issue wants to know it's done, whatever their role —
  // the tier broadcast below only reaches admins and supervisors.
  if (data.reportedById) {
    await notifyUsers({
      userIds: [data.reportedById],
      organizationId,
      entityType: "maintenance_request",
      entityId: data.id,
      title: "Maintenance job completed",
      category: "maintenance_request_fixed",
      message: `${data.vehicleLabel} — fixed by ${performedBy.name}${
        data.fixedNotes ? `: ${data.fixedNotes}` : ""
      }`,
      excludeUserEmails: [performedBy.email],
    });
  }

  return sendAdminNotification({
    entityType: "maintenance_request",
    eventType: "fixed",
    entityId: data.id,
    entityName: `Maintenance request for ${data.vehicleLabel}`,
    organizationId,
    performedBy,
    details: {
      vehicle: data.vehicleLabel,
      // The fix note is the whole point of marking a job done — carry it into
      // the notification instead of making the reader open the record.
      fixedNotes: data.fixedNotes ?? null,
    },
  });
}

/**
 * Notify named users directly (in-app record + web push), bypassing the
 * role/tier broadcast in `sendAdminNotification`.
 *
 * Tier config answers "which roles care about this kind of event"; it can't
 * answer "this one person is responsible for this one job". Assignments,
 * reassignments and request outcomes are addressed to an individual — often a
 * workshop user, whom no tier can target at all — so they come through here.
 */
export async function notifyUsers(params: {
  userIds: string[];
  organizationId: string;
  entityType: NotificationEntityType;
  entityId: string;
  title: string;
  message: string;
  /** Don't notify people about their own action. */
  excludeUserEmails?: string[];
  link?: string;
  metadata?: Record<string, unknown>;
  /**
   * notification-tiers key for this event, e.g. "maintenance_request_assigned".
   * It drives the per-user mute switches; without it a user who has turned a
   * category off still receives the push.
   */
  category?: string;
}): Promise<void> {
  try {
    if (params.category) assertTierKeyExists(params.category);
    const userIds = [...new Set(params.userIds.filter(Boolean))];
    if (userIds.length === 0) return;

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true },
    });

    const excluded = new Set(params.excludeUserEmails ?? []);
    const targets = users.filter((u) => !excluded.has(u.email));
    if (targets.length === 0) return;

    const link = params.link ?? getEntityLink(params.entityType, params.entityId);

    await Promise.all(
      targets.map((user) =>
        prisma.userNotification.create({
          data: {
            userId: user.id,
            organizationId: params.organizationId,
            type: params.entityType,
            title: params.title,
            message: params.message,
            entityType: params.entityType,
            entityId: params.entityId,
            link,
            // JSON round-trip so Dates in `metadata` become ISO strings —
            // Prisma's Json type rejects raw Dates (same as above).
            metadata: params.metadata
              ? (JSON.parse(JSON.stringify(params.metadata)) as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          },
        }),
      ),
    );

    await Promise.all(
      targets.map((user) =>
        sendPushToUser(user.id, {
          title: params.title,
          body: params.message,
          url: link,
          tag: `${params.entityType}-${params.entityId}`,
          category: params.category,
          organizationId: params.organizationId,
        }),
      ),
    );
  } catch (error) {
    console.error("[NOTIFICATION] Error notifying users:", error);
    // Same contract as sendAdminNotification: never break the caller.
  }
}

export async function notifyMaintenanceRequestAssigned(
  data: {
    id: string;
    vehicleLabel: string;
    notes: string;
    date: Date;
    assignedToId: string;
    previousAssigneeId?: string | null;
  },
  organizationId: string,
  performedBy: { name: string; email: string; role: string },
) {
  await notifyUsers({
    userIds: [data.assignedToId],
    organizationId,
    entityType: "maintenance_request",
    entityId: data.id,
    title: "New maintenance job assigned to you",
    category: "maintenance_request_assigned",
    message: `${data.vehicleLabel} — ${data.notes.slice(0, 120)}`,
    excludeUserEmails: [performedBy.email],
    metadata: { date: data.date, assignedBy: performedBy.name },
  });

  if (data.previousAssigneeId && data.previousAssigneeId !== data.assignedToId) {
    await notifyUsers({
      userIds: [data.previousAssigneeId],
      organizationId,
      entityType: "maintenance_request",
      entityId: data.id,
      title: "Maintenance job reassigned",
      category: "maintenance_request_reassigned",
      message: `${data.vehicleLabel} is no longer assigned to you.`,
      excludeUserEmails: [performedBy.email],
    });
  }
}

export async function notifyMaintenanceRequestUpdated(
  data: { id: string; vehicleLabel: string; assignedToId: string; summary: string },
  organizationId: string,
  performedBy: { name: string; email: string; role: string },
) {
  await notifyUsers({
    userIds: [data.assignedToId],
    organizationId,
    entityType: "maintenance_request",
    entityId: data.id,
    title: "Maintenance job updated",
    category: "maintenance_request_updated",
    message: `${data.vehicleLabel} — ${data.summary}`,
    excludeUserEmails: [performedBy.email],
  });
}

// Driver notifications
export interface DriverNotificationData {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  licenseNumber: string;
  status: string;
}

export async function notifyDriverCreated(
  data: DriverNotificationData,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "driver",
    eventType: "created",
    entityId: data.id,
    entityName: `${data.firstName} ${data.lastName}`,
    organizationId,
    performedBy,
    details: {
      name: `${data.firstName} ${data.lastName}`,
      phone: data.phone,
      licenseNumber: data.licenseNumber,
      status: data.status,
    },
  });
}

export async function notifyDriverUpdated(
  data: DriverNotificationData,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "driver",
    eventType: "updated",
    entityId: data.id,
    entityName: `${data.firstName} ${data.lastName}`,
    organizationId,
    performedBy,
    details: {
      name: `${data.firstName} ${data.lastName}`,
      phone: data.phone,
      licenseNumber: data.licenseNumber,
      status: data.status,
    },
  });
}

export async function notifyDriverDeleted(
  firstName: string,
  lastName: string,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "driver",
    eventType: "deleted",
    entityId: "",
    entityName: `${firstName} ${lastName}`,
    organizationId,
    performedBy,
    details: {
      name: `${firstName} ${lastName}`,
    },
  });
}

// Customer notifications
export interface CustomerNotificationData {
  id: string;
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  status: string;
}

export async function notifyCustomerCreated(
  data: CustomerNotificationData,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "customer",
    eventType: "created",
    entityId: data.id,
    entityName: data.name,
    organizationId,
    performedBy,
    details: {
      name: data.name,
      contactPerson: data.contactPerson,
      email: data.email,
      phone: data.phone,
      status: data.status,
    },
  });
}

export async function notifyCustomerUpdated(
  data: CustomerNotificationData,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "customer",
    eventType: "updated",
    entityId: data.id,
    entityName: data.name,
    organizationId,
    performedBy,
    details: {
      name: data.name,
      contactPerson: data.contactPerson,
      email: data.email,
      phone: data.phone,
      status: data.status,
    },
  });
}

export async function notifyCustomerDeleted(
  name: string,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "customer",
    eventType: "deleted",
    entityId: "",
    entityName: name,
    organizationId,
    performedBy,
    details: {
      name,
    },
  });
}

// Employee notifications
export interface EmployeeNotificationData {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  department?: string | null;
  status: string;
  salary?: number | null;
}

export async function notifyEmployeeCreated(
  data: EmployeeNotificationData,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "employee",
    eventType: "created",
    entityId: data.id,
    entityName: `${data.firstName} ${data.lastName}`,
    organizationId,
    performedBy,
    details: {
      name: `${data.firstName} ${data.lastName}`,
      position: data.position,
      department: data.department,
      status: data.status,
      salary: data.salary,
    },
    sensitiveFields: ["salary"],
  });
}

export async function notifyEmployeeUpdated(
  data: EmployeeNotificationData,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "employee",
    eventType: "updated",
    entityId: data.id,
    entityName: `${data.firstName} ${data.lastName}`,
    organizationId,
    performedBy,
    details: {
      name: `${data.firstName} ${data.lastName}`,
      position: data.position,
      department: data.department,
      status: data.status,
      salary: data.salary,
    },
    sensitiveFields: ["salary"],
  });
}

export async function notifyEmployeeDeleted(
  firstName: string,
  lastName: string,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "employee",
    eventType: "deleted",
    entityId: "",
    entityName: `${firstName} ${lastName}`,
    organizationId,
    performedBy,
    details: {
      name: `${firstName} ${lastName}`,
    },
  });
}

// Edit Request notifications
export interface EditRequestCreateNotificationData {
  id: string;
  entityType: string;
  entityId: string;
  reason: string;
}

export interface EditRequestReviewNotificationData {
  id: string;
  entityType: string;
  entityId: string;
  requestedBy: string;
  rejectionReason?: string;
}

export async function notifyEditRequestCreated(
  data: EditRequestCreateNotificationData,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "edit_request",
    eventType: "created",
    entityId: data.id,
    entityName: `Edit Request for ${data.entityType} (ID: ${data.entityId})`,
    organizationId,
    performedBy,
    details: {
      entityType: data.entityType,
      entityId: data.entityId,
      reason: data.reason,
      status: "Pending",
    },
  });
}

export async function notifyEditRequestApproved(
  data: EditRequestReviewNotificationData,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "edit_request",
    eventType: "updated",
    entityId: data.id,
    entityName: `Edit Request APPROVED for ${data.entityType}`,
    organizationId,
    performedBy,
    details: {
      entityType: data.entityType,
      entityId: data.entityId,
      status: "Approved",
      requestedBy: data.requestedBy,
    },
  });
}

export async function notifyEditRequestRejected(
  data: EditRequestReviewNotificationData,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "edit_request",
    eventType: "updated",
    entityId: data.id,
    entityName: `Edit Request REJECTED for ${data.entityType}`,
    organizationId,
    performedBy,
    details: {
      entityType: data.entityType,
      entityId: data.entityId,
      status: "Rejected",
      requestedBy: data.requestedBy,
      rejectionReason: data.rejectionReason,
    },
  });
}

// User Management notifications
export async function notifyUserInvited(
  data: { email: string; role: string },
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "employee",
    eventType: "created",
    entityId: "",
    entityName: `User Invited: ${data.email}`,
    organizationId,
    performedBy,
    details: {
      email: data.email,
      role: data.role,
      action: "Invited to organization",
    },
  });
}

export async function notifySupervisorCreated(
  data: { email: string; name: string },
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "employee",
    eventType: "created",
    entityId: "",
    entityName: `Supervisor Created: ${data.name}`,
    organizationId,
    performedBy,
    details: {
      name: data.name,
      email: data.email,
      role: "Supervisor",
      action: "Account created",
    },
  });
}

export async function notifyUserRoleChanged(
  data: { userName: string; userEmail: string; oldRole: string; newRole: string },
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "employee",
    eventType: "updated",
    entityId: "",
    entityName: `User Role Changed: ${data.userName}`,
    organizationId,
    performedBy,
    details: {
      name: data.userName,
      email: data.userEmail,
      previousRole: data.oldRole,
      newRole: data.newRole,
    },
  });
}

export async function notifyUserRemoved(
  data: { userName: string; userEmail: string; role: string },
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "employee",
    eventType: "deleted",
    entityId: "",
    entityName: `User Removed: ${data.userName}`,
    organizationId,
    performedBy,
    details: {
      name: data.userName,
      email: data.userEmail,
      role: data.role,
      action: "Removed from organization",
    },
  });
}

// Supplier notifications
export interface SupplierNotificationData {
  id: string;
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  status: string;
}

export async function notifySupplierCreated(
  data: SupplierNotificationData,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "supplier",
    eventType: "created",
    entityId: data.id,
    entityName: data.name,
    organizationId,
    performedBy,
    details: {
      name: data.name,
      contactPerson: data.contactPerson,
      email: data.email,
      phone: data.phone,
      status: data.status,
    },
  });
}

export async function notifySupplierUpdated(
  data: SupplierNotificationData,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "supplier",
    eventType: "updated",
    entityId: data.id,
    entityName: data.name,
    organizationId,
    performedBy,
    details: {
      name: data.name,
      contactPerson: data.contactPerson,
      email: data.email,
      phone: data.phone,
      status: data.status,
    },
  });
}

export async function notifySupplierDeleted(
  name: string,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
) {
  return sendAdminNotification({
    entityType: "supplier",
    eventType: "deleted",
    entityId: "",
    entityName: name,
    organizationId,
    performedBy,
    details: {
      name,
    },
  });
}

/**
 * Broadcast under an explicit tier key, to whatever roles that tier names.
 *
 * `sendAdminNotification` derives its key from `${entityType}_${eventType}`,
 * which works for the CRUD events but cannot express "money went into an
 * account" or "a trip message failed" — there is no entity/event pair for
 * those. This takes the key directly, so the tier map stays the single place
 * that decides who hears about what.
 */
/**
 * Emails the business mailbox about one system event.
 *
 * Never throws: a mail outage must not undo the thing that just happened. A
 * failure is logged with the event key, and the notification is in the app
 * either way.
 */
async function emailTheOffice(params: {
  key: string;
  title: string;
  message: string;
  link?: string;
}): Promise<void> {
  try {
    const { sendEmail, BUSINESS_MAILBOX } = await import("@/lib/email");
    const appUrl = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";
    const href = params.link ? `${appUrl}${params.link}` : null;

    await sendEmail({
      to: BUSINESS_MAILBOX,
      subject: params.title,
      text: [
        params.message,
        "",
        href ? `Open it: ${href}` : null,
        `- WD Logistics system (${params.key})`,
      ]
        .filter((line): line is string => line !== null)
        .join("\n"),
      html: `<div style="font:14px/1.7 Arial,sans-serif;color:#1E2320;max-width:560px">
  <p style="margin:0 0 4px;color:#3D8A14;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">WD Logistics</p>
  <h1 style="margin:0 0 12px;font-size:18px;font-weight:600">${escapeForEmail(params.title)}</h1>
  <p style="margin:0 0 16px;white-space:pre-wrap">${escapeForEmail(params.message)}</p>
  ${
    href
      ? `<p style="margin:0 0 16px"><a href="${escapeForEmail(href)}" style="color:#3D8A14;font-weight:600">Open it in the system</a></p>`
      : ""
  }
  <p style="margin:0;padding-top:12px;border-top:1px solid #ECEEE9;color:#787F79;font-size:12px">
    Sent automatically because this happened in the system. Event: ${escapeForEmail(params.key)}.
  </p>
</div>`,
    });
  } catch (error) {
    console.error(`[NOTIFICATION] Could not email the office about ${params.key}:`, error);
  }
}

function escapeForEmail(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Tell the owner an account has gone into the red.
 *
 * Money out is never refused for lack of funds (see `allowOverdraw` in
 * lib/accounts-server.ts): a supervisor cannot see balances, so a refusal
 * would either hand them the figure in the error or stop a yard paying for a
 * tyre at six in the evening. The client chose to let it through — which is
 * only safe if somebody is told, which is this.
 *
 * Called after the write, reading the balance that resulted. Never throws:
 * the money has already moved and a failed notification must not undo it.
 */
export async function notifyIfAccountOverdrawn(params: {
  organizationId: string;
  accountId: string;
  actorName: string;
  actorEmail: string;
  /** What caused it, in the words the person recording it used. */
  what: string;
}): Promise<void> {
  try {
    const account = await prisma.financialAccount.findFirst({
      where: { id: params.accountId, organizationId: params.organizationId },
      select: { name: true, balance: true },
    });
    if (!account || account.balance >= 0) return;

    await notifyByTierKey({
      key: "account_overdrawn",
      organizationId: params.organizationId,
      title: `${account.name} is overdrawn`,
      message: `${account.name} is at ${account.balance < 0 ? "−" : ""}$${Math.abs(account.balance).toFixed(2)} after ${params.actorName} recorded ${params.what}.`,
      link: "/finance/accounts",
      excludeUserEmails: [params.actorEmail],
      metadata: { accountId: params.accountId, balance: account.balance },
    });
  } catch (error) {
    console.error("[NOTIFICATION] Could not report an overdrawn account:", error);
  }
}

export async function notifyByTierKey(params: {
  key: string;
  organizationId: string;
  title: string;
  message: string;
  link?: string;
  entityType?: NotificationEntityType;
  entityId?: string;
  /** Don't notify whoever caused this. */
  excludeUserEmails?: string[];
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    assertTierKeyExists(params.key);
    const tierConfig = getTierConfig(params.key);

    const recipients = await getNotificationRecipients(params.organizationId);
    const excluded = new Set(params.excludeUserEmails ?? []);
    const targets = recipients.filter(
      (r) => tierConfig.roles.includes(r.role as Role) && !excluded.has(r.email),
    );

    if (targets.length === 0) {
      // Nobody is subscribed to this one, but the office still wants to know
      // it happened.
      if (emailsTheOffice(params.key)) await emailTheOffice(params);
      return;
    }

    await Promise.all(
      targets.map((recipient) =>
        prisma.userNotification.create({
          data: {
            userId: recipient.userId,
            organizationId: params.organizationId,
            type: params.entityType ?? "general",
            title: params.title,
            message: params.message,
            entityType: params.entityType,
            entityId: params.entityId,
            link: params.link,
            metadata: params.metadata
              ? (JSON.parse(
                  JSON.stringify(params.metadata),
                ) as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          },
        }),
      ),
    );

    if (tierConfig.channels.includes("webPush")) {
      await Promise.all(
        targets.map((recipient) =>
          sendPushToUser(recipient.userId, {
            title: params.title,
            body: params.message,
            url: params.link,
            tag: params.entityId ? `${params.key}-${params.entityId}` : params.key,
            category: params.key,
            organizationId: params.organizationId,
          }),
        ),
      );
    }

    // And one line to the office. This is the owner's record of what the
    // system did — a record created, a job closed, money moved — sent to a
    // hardcoded mailbox rather than to whoever happens to be an admin today,
    // so it survives an account being removed.
    if (emailsTheOffice(params.key)) {
      await emailTheOffice(params);
    }
  } catch (error) {
    console.error("[NOTIFICATION] Error in notifyByTierKey:", error);
    // Same contract as the rest of this module: never break the caller.
  }
}
