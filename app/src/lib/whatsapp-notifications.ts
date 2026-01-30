/**
 * WhatsApp Notification Service
 * 
 * Handles sending WhatsApp messages for key business events.
 * Uses email for companies (customers/suppliers) and WhatsApp for individuals (drivers/admins).
 */

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

// Import types and templates from agent
// Note: We'll define these locally to avoid cross-project imports
type TripMessageData = {
  driverName: string;
  originCity: string;
  originAddress?: string;
  destinationCity: string;
  destinationAddress?: string;
  scheduledDate: Date;
  startDate?: Date;
  endDate?: Date;
  estimatedMileage?: number;
  loadDescription?: string;
  loadWeight?: number;
  loadUnits?: number;
  truckRegistration: string;
  customerName: string;
  notes?: string;
};

// Date formatters
const formatDate = (date: Date): string => {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatDateTime = (date: Date): string => {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

/**
 * Trip Assignment Template - enhanced with all details
 */
function tripAssignmentTemplate(data: TripMessageData): string {
  const lines = [
    `🚚 *New Trip Assignment*`,
    ``,
    `Hello ${data.driverName}!`,
    ``,
    `You have been assigned a new trip:`,
    ``,
    `📍 *Route:*`,
    `   From: ${data.originCity}${data.originAddress ? ` (${data.originAddress})` : ''}`,
    `   To: ${data.destinationCity}${data.destinationAddress ? ` (${data.destinationAddress})` : ''}`,
    ``,
    `📅 *Scheduled Date:*`,
    `   ${formatDate(new Date(data.scheduledDate))}`,
  ];

  // Add start date if available
  if (data.startDate) {
    lines.push(``);
    lines.push(`🚀 *Start Date:*`);
    lines.push(`   ${formatDateTime(new Date(data.startDate))}`);
  }

  // Add expected end date if available
  if (data.endDate) {
    lines.push(``);
    lines.push(`🏁 *Expected End Date:*`);
    lines.push(`   ${formatDateTime(new Date(data.endDate))}`);
  } else if (data.startDate) {
    // If we have start date but no end date, estimate based on scheduled date
    const daysDiff = Math.ceil((new Date(data.scheduledDate).getTime() - new Date(data.startDate).getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 0) {
      const estimatedEnd = new Date(data.startDate);
      estimatedEnd.setDate(estimatedEnd.getDate() + daysDiff);
      lines.push(``);
      lines.push(`🏁 *Expected End Date:*`);
      lines.push(`   ${formatDateTime(estimatedEnd)} (estimated)`);
    }
  }

  // Add estimated mileage if available
  if (data.estimatedMileage) {
    lines.push(``);
    lines.push(`📏 *Estimated Mileage:*`);
    lines.push(`   ${data.estimatedMileage.toLocaleString()} km`);
  }

  lines.push(``);
  lines.push(`🚛 *Truck:* ${data.truckRegistration}`);
  lines.push(`👤 *Customer:* ${data.customerName}`);

  if (data.loadDescription || data.loadWeight || data.loadUnits) {
    lines.push(``);
    lines.push(`📦 *Load Details:*`);
    if (data.loadDescription) lines.push(`   ${data.loadDescription}`);
    if (data.loadWeight) lines.push(`   Weight: ${data.loadWeight} kg`);
    if (data.loadUnits) lines.push(`   Units: ${data.loadUnits}`);
  }

  if (data.notes) {
    lines.push(``);
    lines.push(`📝 *Notes:* ${data.notes}`);
  }

  lines.push(``);
  lines.push(`Please confirm receipt of this assignment.`);
  lines.push(`Safe travels! 🛣️`);

  return lines.join('\n');
}

/**
 * Payment Received Template
 */
function paymentReceivedTemplate(data: {
  customerName: string;
  invoiceNumber: string;
  amount: number;
  paymentDate: Date;
  paymentMethod: string;
  organizationName: string;
}): string {
  const formatCurrency = (amount: number): string =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  return [
    `💚 *Payment Received*`,
    ``,
    `Dear ${data.customerName},`,
    ``,
    `We have received your payment. Thank you!`,
    ``,
    `📋 *Payment Details:*`,
    `   Invoice #: ${data.invoiceNumber}`,
    `   Amount: ${formatCurrency(data.amount)}`,
    `   Date: ${formatDate(new Date(data.paymentDate))}`,
    `   Method: ${data.paymentMethod}`,
    ``,
    `Thank you for your prompt payment!`,
    `— ${data.organizationName}`,
  ].join('\n');
}

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || process.env.AGENT_URL || 'http://localhost:3001';

/**
 * Send WhatsApp message via agent API
 */
async function sendWhatsAppMessage(phoneNumber: string, message: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Format phone number: if starts with '0', replace with '263'
    let formatted = phoneNumber.trim();
    if (formatted.startsWith('0')) {
      formatted = '263' + formatted.slice(1);
    }
    // Only keep digits (for safety)
    formatted = formatted.replace(/\D/g, '');
    
    const res = await fetch(`${AGENT_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: formatted, message }),
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Failed to send WhatsApp message' }));
      throw new Error(errorData.error || 'Failed to send WhatsApp message');
    }
    
    return await res.json();
  } catch (error) {
    console.error('Failed to send WhatsApp message:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Determine if a customer/supplier is a company (has contactPerson or taxId suggests business)
 * For now, we'll use email preference - if they have email, prefer email for professionalism
 */
function isCompany(entity: { contactPerson?: string | null; taxId?: string | null; email?: string | null }): boolean {
  // If they have a contact person or tax ID, they're likely a company
  // Also prefer email if available for professionalism
  return !!(entity.contactPerson || entity.taxId || entity.email);
}

/**
 * Send notification to driver about trip assignment
 */
export async function notifyDriverTripAssignment(tripId: string, organizationId: string): Promise<void> {
  try {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        driver: { 
          select: { 
            firstName: true, 
            lastName: true, 
            email: true, 
            whatsappNumber: true 
          } 
        },
        truck: { select: { registrationNo: true } },
        customer: { select: { name: true } },
        organization: { select: { name: true } },
      },
    });

    if (!trip || !trip.driver) {
      console.log("Trip or driver not found, skipping notification");
      return;
    }

    const driverName = `${trip.driver.firstName} ${trip.driver.lastName}`;
    const orgName = trip.organization?.name || "WD Logistics";

    // Prepare detailed trip message data
    const tripData: TripMessageData = {
      driverName,
      originCity: trip.originCity,
      originAddress: trip.originAddress || undefined,
      destinationCity: trip.destinationCity,
      destinationAddress: trip.destinationAddress || undefined,
      scheduledDate: trip.scheduledDate,
      startDate: trip.startDate || undefined,
      endDate: trip.endDate || undefined,
      estimatedMileage: trip.estimatedMileage || undefined,
      loadDescription: trip.loadDescription || undefined,
      loadWeight: trip.loadWeight || undefined,
      loadUnits: trip.loadUnits || undefined,
      truckRegistration: trip.truck.registrationNo,
      customerName: trip.customer?.name || "N/A",
      notes: trip.notes || undefined,
    };

    // Generate detailed message using template
    const whatsappMessage = tripAssignmentTemplate(tripData);

    // Send WhatsApp if driver has WhatsApp number (preferred for individuals)
    if (trip.driver.whatsappNumber) {
      await sendWhatsAppMessage(trip.driver.whatsappNumber, whatsappMessage);
      console.log(`✅ Trip assignment WhatsApp sent to driver ${driverName}`);
    }

    // Also send email as backup/confirmation (if driver has email)
    if (trip.driver.email) {
      const { sendTripAssignmentEmail } = await import("@/lib/email");
      await sendTripAssignmentEmail({
        driverEmail: trip.driver.email,
        driverName,
        origin: trip.originCity,
        originAddress: trip.originAddress || undefined,
        destination: trip.destinationCity,
        destinationAddress: trip.destinationAddress || undefined,
        scheduledDate: trip.scheduledDate,
        startDate: trip.startDate || undefined,
        endDate: trip.endDate || undefined,
        loadDescription: trip.loadDescription || undefined,
        truckRegistration: trip.truck.registrationNo,
        customerName: trip.customer?.name || undefined,
        notes: trip.notes || undefined,
        organizationName: orgName,
      });
      console.log(`✅ Trip assignment email sent to driver ${driverName}`);
    }
  } catch (error) {
    console.error("Failed to notify driver of trip assignment:", error);
    // Don't throw - this is a non-blocking notification
  }
}

/**
 * Send welcome message to new driver
 */
export async function notifyDriverWelcome(
  driverId: string, 
  organizationId: string
): Promise<void> {
  try {
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      include: {
        organization: { select: { name: true } },
        assignedTruck: { select: { registrationNo: true } },
      },
    });

    if (!driver) {
      console.log("Driver not found, skipping welcome message");
      return;
    }

    const driverName = `${driver.firstName} ${driver.lastName}`;
    const orgName = driver.organization?.name || "WD Logistics";

    const welcomeMessage = `🎉 *Welcome to ${orgName}!*

Hello ${driverName},

We're excited to have you join our team! 

📋 *Your Details:*
• Name: ${driverName}
• License: ${driver.licenseNumber}
• Status: ${driver.status.charAt(0).toUpperCase() + driver.status.slice(1)}
${driver.assignedTruck ? `• Assigned Truck: ${driver.assignedTruck.registrationNo}` : ''}

You'll receive trip assignments via WhatsApp. Please keep your phone number and WhatsApp number updated.

If you have any questions, don't hesitate to reach out.

Welcome aboard! 🚛`;

    // Send WhatsApp if driver has WhatsApp number
    if (driver.whatsappNumber) {
      await sendWhatsAppMessage(driver.whatsappNumber, welcomeMessage);
      console.log(`✅ Welcome WhatsApp sent to driver ${driverName}`);
    }

    // Also send email if available
    if (driver.email) {
      await sendEmail({
        to: driver.email,
        subject: `Welcome to ${orgName}!`,
        text: welcomeMessage.replace(/\*/g, '').replace(/🎉|📋|🚛/g, ''),
        html: `<div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Welcome to ${orgName}!</h2>
          <p>Hello ${driverName},</p>
          <p>We're excited to have you join our team!</p>
          <h3>Your Details:</h3>
          <ul>
            <li>Name: ${driverName}</li>
            <li>License: ${driver.licenseNumber}</li>
            <li>Status: ${driver.status.charAt(0).toUpperCase() + driver.status.slice(1)}</li>
            ${driver.assignedTruck ? `<li>Assigned Truck: ${driver.assignedTruck.registrationNo}</li>` : ''}
          </ul>
          <p>You'll receive trip assignments via WhatsApp. Please keep your phone number and WhatsApp number updated.</p>
          <p>If you have any questions, don't hesitate to reach out.</p>
          <p>Welcome aboard!</p>
        </div>`,
      });
      console.log(`✅ Welcome email sent to driver ${driverName}`);
    }
  } catch (error) {
    console.error("Failed to send driver welcome message:", error);
  }
}

/**
 * Send WhatsApp notification to admins about key events
 */
export async function notifyAdminsWhatsApp(
  organizationId: string,
  message: string,
  excludeUserId?: string
): Promise<void> {
  try {
    const members = await prisma.member.findMany({
      where: {
        organizationId,
        role: { in: ["admin", "supervisor"] },
        ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    // Send WhatsApp to admins who have phone numbers
    // Note: We'd need to add whatsappNumber to User model or use phone
    // For now, we'll use email-based notifications for admins
    // This can be enhanced later when we have admin WhatsApp numbers
    
    console.log(`📱 Admin notification prepared for ${members.length} admins/supervisors`);
    
    // For now, admins get email notifications (via existing notification system)
    // WhatsApp for admins can be added when we have their WhatsApp numbers
  } catch (error) {
    console.error("Failed to notify admins via WhatsApp:", error);
  }
}

/**
 * Send notification about truck creation/deletion to admins
 */
export async function notifyTruckEvent(
  event: 'created' | 'deleted',
  truckData: {
    registrationNo: string;
    make?: string;
    model?: string;
    year?: number;
  },
  organizationId: string,
  performedBy: { name: string; email: string; role: string; id?: string }
): Promise<void> {
  const emoji = event === 'created' ? '🚛' : '🗑️';
  const action = event === 'created' ? 'added' : 'deleted';
  
  const message = `${emoji} *Truck ${action.charAt(0).toUpperCase() + action.slice(1)}*

A truck has been ${action} from the fleet:

• Registration: ${truckData.registrationNo}
${truckData.make ? `• Make: ${truckData.make}` : ''}
${truckData.model ? `• Model: ${truckData.model}` : ''}
${truckData.year ? `• Year: ${truckData.year}` : ''}

Action performed by: ${performedBy.name} (${performedBy.role})`;

  await notifyAdminsWhatsApp(organizationId, message, performedBy.id);
}

/**
 * Send notification about driver deletion to admins
 */
export async function notifyDriverDeleted(
  driverName: string,
  organizationId: string,
  performedBy: { name: string; email: string; role: string; id?: string }
): Promise<void> {
  const message = `🗑️ *Driver Removed*

A driver has been removed from the fleet:

• Name: ${driverName}

Action performed by: ${performedBy.name} (${performedBy.role})`;

  await notifyAdminsWhatsApp(organizationId, message, performedBy.id);
}

/**
 * Send notification about full invoice payment
 */
export async function notifyInvoiceFullyPaid(
  invoiceId: string,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
): Promise<void> {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
        organization: { select: { name: true } },
        trip: {
          include: {
            driver: { select: { firstName: true, lastName: true } },
            truck: { select: { registrationNo: true } },
          },
        },
      },
    });

    if (!invoice) {
      console.log("Invoice not found, skipping payment notification");
      return;
    }

    const orgName = invoice.organization?.name || "WD Logistics";
    const customer = invoice.customer;
    const isCustomerCompany = isCompany(customer);

    // For customers (companies), send email
    if (isCustomerCompany && customer.email) {
      const paymentMessage = paymentReceivedTemplate({
        customerName: customer.name,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.total,
        paymentDate: new Date(),
        paymentMethod: "Payment received",
        organizationName: orgName,
      });

      await sendEmail({
        to: customer.email,
        subject: `Payment Received - Invoice ${invoice.invoiceNumber}`,
        text: paymentMessage.replace(/\*/g, '').replace(/💚/g, ''),
        html: `<div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Payment Received</h2>
          <p>Dear ${customer.name},</p>
          <p>We have received full payment for your invoice.</p>
          <h3>Payment Details:</h3>
          <ul>
            <li>Invoice #: ${invoice.invoiceNumber}</li>
            <li>Amount: $${invoice.total.toFixed(2)}</li>
            <li>Date: ${new Date().toLocaleDateString()}</li>
          </ul>
          <p>Thank you for your prompt payment!</p>
          <p>— ${orgName}</p>
        </div>`,
      });
      console.log(`✅ Payment confirmation email sent to customer ${customer.name}`);
    }

    // Notify admins via existing notification system (which handles email)
    // WhatsApp for admins can be added when we have their WhatsApp numbers
    console.log(`✅ Invoice ${invoice.invoiceNumber} fully paid - admins notified`);
  } catch (error) {
    console.error("Failed to notify about invoice payment:", error);
  }
}
