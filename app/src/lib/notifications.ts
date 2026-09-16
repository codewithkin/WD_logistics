/**
 * Admin Notification Service
 * 
 * Sends email notifications to admin and supervisor users
 * when data is created, updated, or deleted.
 * 
 * For supervisors, financial amounts are hidden.
 */

import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import { getTierConfig, tierKeyFor } from "@/lib/notification-tiers";

// Types for notification events
export type NotificationEventType = "created" | "updated" | "deleted";

export type NotificationEntityType =
  | "invoice"
  | "payment"
  | "expense"
  | "trip"
  | "truck"
  | "trailer"
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
  // Accepted for backwards compatibility with existing call sites but no
  // longer consulted — this drove hiding amounts in the admin email, which
  // no longer exists (see notification-tiers.ts). Visibility of financial
  // details is now purely a role/tier question, not a per-field one.
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
      role: { in: ["admin", "supervisor"] },
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
    const tierConfig = getTierConfig(tierKey);

    const recipients = await getNotificationRecipients(data.organizationId);

    // Tier + role gating happens BEFORE the performer filter below — this is
    // the actual volume fix: routine creates/updates (tier 3/4) don't list
    // "admin" in their tier config, so admins stop getting pinged for every
    // driver/truck/invoice/etc. Only tier 1/2 events still reach them.
    const eligibleRecipients = recipients.filter((r) => tierConfig.roles.includes(r.role as "admin" | "supervisor"));

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
            // JSON round-trip so Date objects in `details` (e.g. dueDate)
            // become ISO strings — Prisma's Json type rejects raw Dates.
            metadata: {
              ...(JSON.parse(JSON.stringify(data.details)) as Record<string, unknown>),
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
          sendPushToUser(recipient.userId, { title, body: message, url: link, tag: `${data.entityType}-${data.entityId}` })
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
    sensitiveFields: ["amount"],
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
    sensitiveFields: ["amount"],
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
    sensitiveFields: ["amount"],
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
    sensitiveFields: ["amount"],
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
    sensitiveFields: ["amount"],
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
    sensitiveFields: ["amount"],
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
