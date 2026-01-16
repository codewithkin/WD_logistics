/**
 * Admin Notification Service
 * 
 * Sends email notifications to admin and supervisor users
 * when data is created, updated, or deleted.
 * 
 * For supervisors, financial amounts are hidden.
 */

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

// Types for notification events
export type NotificationEventType = "created" | "updated" | "deleted";

export type NotificationEntityType =
  | "invoice"
  | "payment"
  | "expense"
  | "trip"
  | "truck"
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
  // Fields that contain amounts (will be hidden from supervisors)
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
 * Format details for display in email
 */
function formatDetails(
  details: Record<string, unknown>,
  sensitiveFields: string[] = [],
  hideSensitive: boolean = false
): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(details)) {
    if (value === null || value === undefined) continue;

    // Format the key for display
    const displayKey = key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();

    // Check if this is a sensitive field
    const isSensitive = sensitiveFields.includes(key);

    if (isSensitive && hideSensitive) {
      // Skip sensitive fields for supervisors
      continue;
    }

    // Format the value
    let displayValue: string;
    if (typeof value === "number") {
      // Check if it looks like a currency value
      if (
        key.toLowerCase().includes("amount") ||
        key.toLowerCase().includes("total") ||
        key.toLowerCase().includes("balance") ||
        key.toLowerCase().includes("revenue") ||
        key.toLowerCase().includes("cost") ||
        key.toLowerCase().includes("price") ||
        key.toLowerCase().includes("subtotal") ||
        key.toLowerCase().includes("tax") ||
        key.toLowerCase().includes("salary")
      ) {
        displayValue = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(value);
      } else {
        displayValue = value.toString();
      }
    } else if (value instanceof Date) {
      displayValue = new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(value);
    } else if (typeof value === "boolean") {
      displayValue = value ? "Yes" : "No";
    } else {
      displayValue = String(value);
    }

    lines.push(`${displayKey}: ${displayValue}`);
  }

  return lines.join("\n");
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
 * Get icon for entity type
 */
function getEntityIcon(entityType: NotificationEntityType): string {
  switch (entityType) {
    case "invoice":
      return "📄";
    case "payment":
      return "💳";
    case "expense":
      return "💰";
    case "trip":
      return "🚚";
    case "truck":
      return "🚛";
    case "driver":
      return "👤";
    case "customer":
      return "🏢";
    case "supplier":
      return "📦";
    case "employee":
      return "👥";
    case "edit_request":
      return "📝";
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
 * Get color for event type
 */
function getEventColor(eventType: NotificationEventType): string {
  switch (eventType) {
    case "created":
      return "#16a34a"; // green
    case "updated":
      return "#2563eb"; // blue
    case "deleted":
      return "#dc2626"; // red
  }
}

/**
 * Send notification emails to all admins and supervisors
 */
export async function sendAdminNotification(data: NotificationData): Promise<void> {
  try {
    console.log("📧 [NOTIFICATION] Starting notification process for:", {
      entityType: data.entityType,
      eventType: data.eventType,
      entityName: data.entityName,
      performedBy: data.performedBy.email,
    });

    const recipients = await getNotificationRecipients(data.organizationId);

    console.log("📧 [NOTIFICATION] Found recipients:", {
      count: recipients.length,
      recipients: recipients.map(r => ({ email: r.email, role: r.role })),
    });

    if (recipients.length === 0) {
      console.log("📧 [NOTIFICATION] No admin/supervisor recipients found for notification");
      return;
    }

    // Get organization name
    const organization = await prisma.organization.findUnique({
      where: { id: data.organizationId },
      select: { name: true },
    });

    const orgName = organization?.name || "WD Logistics";
    const entityTypeDisplay = getEntityTypeDisplay(data.entityType);
    const actionVerb = getActionVerb(data.eventType);
    const icon = getEntityIcon(data.entityType);
    const eventColor = getEventColor(data.eventType);

    // Filter out the performer from recipients
    const filteredRecipients = recipients.filter(r => r.email !== data.performedBy.email);
    console.log("📧 [NOTIFICATION] Recipients after filtering out performer:", {
      count: filteredRecipients.length,
      recipients: filteredRecipients.map(r => ({ email: r.email, role: r.role })),
    });

    if (filteredRecipients.length === 0) {
      console.log("📧 [NOTIFICATION] No recipients left after filtering out the performer");
      return;
    }

    // Create in-app notifications for all recipients
    const inAppNotificationPromises = filteredRecipients.map(async (recipient) => {
      const title = `${entityTypeDisplay} ${actionVerb}`;
      const message = `${data.entityName} was ${actionVerb} by ${data.performedBy.name}`;
      const link = getEntityLink(data.entityType, data.entityId);

      console.log("📧 [NOTIFICATION] Creating in-app notification for:", recipient.email);

      await prisma.userNotification.create({
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
            performedBy: data.performedBy.name,
            eventType: data.eventType,
          },
        },
      });
    });

    await Promise.all(inAppNotificationPromises);
    console.log("📧 [NOTIFICATION] In-app notifications created successfully");

    // Send emails to each recipient
    const emailPromises = filteredRecipients.map(async (recipient) => {
      const isSupervisor = recipient.role === "supervisor";
      const hideSensitive = isSupervisor;

      // Format details based on role
      const formattedDetails = formatDetails(
        data.details,
        data.sensitiveFields,
        hideSensitive
      );

      const subject = `${icon} ${entityTypeDisplay} ${actionVerb}: ${data.entityName}`;

      console.log("📧 [NOTIFICATION] Sending email to:", {
        email: recipient.email,
        subject,
        isSupervisor,
      });

      const textContent = `
${entityTypeDisplay} ${actionVerb.toUpperCase()}

${data.entityName} was ${actionVerb} by ${data.performedBy.name} (${data.performedBy.role}).

Details:
${formattedDetails}

---
This is an automated notification from ${orgName}.
      `.trim();

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${eventColor}; color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 20px; }
    .header .icon { font-size: 32px; margin-bottom: 10px; }
    .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .entity-name { font-size: 18px; font-weight: bold; color: #1a1a2e; margin-bottom: 20px; padding: 15px; background: #f9fafb; border-radius: 8px; border-left: 4px solid ${eventColor}; }
    .performed-by { background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    .performed-by-label { font-size: 12px; color: #666; text-transform: uppercase; margin-bottom: 5px; }
    .performed-by-value { font-weight: 600; color: #333; }
    .details { background: #f9fafb; padding: 20px; border-radius: 8px; }
    .details h3 { margin: 0 0 15px 0; font-size: 14px; color: #666; text-transform: uppercase; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #666; }
    .detail-value { font-weight: 600; color: #333; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; color: white; background: ${eventColor}; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="icon">${icon}</div>
      <h1>${entityTypeDisplay} <span class="badge">${actionVerb.toUpperCase()}</span></h1>
    </div>
    <div class="content">
      <div class="entity-name">
        ${data.entityName}
      </div>
      
      <div class="performed-by">
        <div class="performed-by-label">Action performed by</div>
        <div class="performed-by-value">${data.performedBy.name} (${data.performedBy.role})</div>
      </div>
      
      ${formattedDetails ? `
      <div class="details">
        <h3>Details</h3>
        ${Object.entries(data.details)
          .filter(([key, value]) => {
            if (value === null || value === undefined) return false;
            if (hideSensitive && data.sensitiveFields?.includes(key)) return false;
            return true;
          })
          .map(([key, value]) => {
            const displayKey = key
              .replace(/([A-Z])/g, " $1")
              .replace(/^./, (str) => str.toUpperCase())
              .trim();
            
            let displayValue: string;
            if (typeof value === "number") {
              if (
                key.toLowerCase().includes("amount") ||
                key.toLowerCase().includes("total") ||
                key.toLowerCase().includes("balance") ||
                key.toLowerCase().includes("revenue") ||
                key.toLowerCase().includes("cost") ||
                key.toLowerCase().includes("price") ||
                key.toLowerCase().includes("subtotal") ||
                key.toLowerCase().includes("tax") ||
                key.toLowerCase().includes("salary")
              ) {
                displayValue = new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                }).format(value);
              } else {
                displayValue = value.toString();
              }
            } else if (value instanceof Date) {
              displayValue = new Intl.DateTimeFormat("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              }).format(value);
            } else if (typeof value === "boolean") {
              displayValue = value ? "Yes" : "No";
            } else {
              displayValue = String(value);
            }
            
            return `<div class="detail-row">
              <span class="detail-label">${displayKey}</span>
              <span class="detail-value">${displayValue}</span>
            </div>`;
          })
          .join("")}
      </div>
      ` : ""}
    </div>
    <div class="footer">
      <p>This is an automated notification from ${orgName}.</p>
    </div>
  </div>
</body>
</html>
      `.trim();

      return sendEmail({
        to: recipient.email,
        subject,
        text: textContent,
        html: htmlContent,
      });
    });

    // Wait for all emails to be sent
    console.log("📧 [NOTIFICATION] Waiting for all emails to be sent...");
    try {
      const results = await Promise.allSettled(emailPromises);
      const successful = results.filter(r => r.status === "fulfilled").length;
      const failed = results.filter(r => r.status === "rejected");
      
      console.log("📧 [NOTIFICATION] Email sending complete:", {
        total: results.length,
        successful,
        failed: failed.length,
      });

      if (failed.length > 0) {
        console.error("📧 [NOTIFICATION] Failed emails:", failed.map(f => 
          f.status === "rejected" ? f.reason : "unknown"
        ));
      }
    } catch (err) {
      console.error("📧 [NOTIFICATION] Failed to send some admin notifications:", err);
    }
  } catch (error) {
    console.error("📧 [NOTIFICATION] Error in notification process:", error);
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
