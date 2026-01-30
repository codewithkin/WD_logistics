/**
 * WhatsApp Notification Service
 * 
 * Handles sending WhatsApp messages for key business events.
 * Uses email for companies (customers/suppliers) and WhatsApp for individuals (drivers/admins).
 */

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || process.env.AGENT_URL || 'http://localhost:3001';
const ADMIN_WHATSAPP_NUMBER = process.env.ADMIN_WHATSAPP_NUMBER;

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
 * Send WhatsApp notification to admin
 */
async function notifyAdminWhatsApp(message: string): Promise<void> {
  if (!ADMIN_WHATSAPP_NUMBER) {
    console.log('ADMIN_WHATSAPP_NUMBER not configured, skipping admin WhatsApp notification');
    return;
  }

  try {
    await sendWhatsAppMessage(ADMIN_WHATSAPP_NUMBER, message);
    console.log('✅ Admin WhatsApp notification sent');
  } catch (error) {
    console.error('Failed to send admin WhatsApp notification:', error);
  }
}

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

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
};

// Types
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

/**
 * Trip Assignment Template - for drivers (NO EMOJIS)
 */
function tripAssignmentTemplate(data: TripMessageData): string {
  const lines = [
    `*NEW TRIP ASSIGNMENT*`,
    ``,
    `Hello ${data.driverName}!`,
    ``,
    `You have been assigned a new trip:`,
    ``,
    `*ROUTE:*`,
    `From: ${data.originCity}${data.originAddress ? ` (${data.originAddress})` : ''}`,
    `To: ${data.destinationCity}${data.destinationAddress ? ` (${data.destinationAddress})` : ''}`,
    ``,
    `*SCHEDULED DATE:*`,
    `${formatDate(new Date(data.scheduledDate))}`,
  ];

  if (data.startDate) {
    lines.push(``);
    lines.push(`*START DATE:*`);
    lines.push(`${formatDateTime(new Date(data.startDate))}`);
  }

  if (data.endDate) {
    lines.push(``);
    lines.push(`*EXPECTED END DATE:*`);
    lines.push(`${formatDateTime(new Date(data.endDate))}`);
  }

  if (data.estimatedMileage) {
    lines.push(``);
    lines.push(`*ESTIMATED MILEAGE:*`);
    lines.push(`${data.estimatedMileage.toLocaleString()} km`);
  }

  lines.push(``);
  lines.push(`*TRUCK:* ${data.truckRegistration}`);
  lines.push(`*CUSTOMER:* ${data.customerName}`);

  if (data.loadDescription || data.loadWeight || data.loadUnits) {
    lines.push(``);
    lines.push(`*LOAD DETAILS:*`);
    if (data.loadDescription) lines.push(`${data.loadDescription}`);
    if (data.loadWeight) lines.push(`Weight: ${data.loadWeight} kg`);
    if (data.loadUnits) lines.push(`Units: ${data.loadUnits}`);
  }

  if (data.notes) {
    lines.push(``);
    lines.push(`*NOTES:* ${data.notes}`);
  }

  lines.push(``);
  lines.push(`Please confirm receipt of this assignment.`);
  lines.push(`Safe travels!`);

  return lines.join('\n');
}

/**
 * Admin Templates - NO EMOJIS
 */

function adminDriverCreatedTemplate(data: {
  driverName: string;
  phone: string;
  whatsappNumber?: string | null;
  email?: string | null;
  licenseNumber: string;
  status: string;
  assignedTruck?: string | null;
  performedBy: string;
}): string {
  const lines = [
    `*NEW DRIVER ADDED*`,
    ``,
    `A new driver has been added to the fleet.`,
    ``,
    `*NAME:* ${data.driverName}`,
    `*PHONE:* ${data.phone}`,
  ];

  if (data.whatsappNumber) {
    lines.push(`*WHATSAPP:* ${data.whatsappNumber}`);
  }

  if (data.email) {
    lines.push(`*EMAIL:* ${data.email}`);
  }

  lines.push(`*LICENSE:* ${data.licenseNumber}`);
  lines.push(`*STATUS:* ${data.status.charAt(0).toUpperCase() + data.status.slice(1)}`);

  if (data.assignedTruck) {
    lines.push(`*ASSIGNED TRUCK:* ${data.assignedTruck}`);
  }

  lines.push(``);
  lines.push(`_Added by ${data.performedBy}_`);

  return lines.join('\n');
}

function adminTruckCreatedTemplate(data: {
  registrationNo: string;
  make: string;
  model: string;
  year: number;
  status: string;
  currentMileage?: number;
  fuelType?: string | null;
  performedBy: string;
}): string {
  const lines = [
    `*NEW TRUCK ADDED*`,
    ``,
    `A new truck has been added to the fleet.`,
    ``,
    `*REGISTRATION:* ${data.registrationNo}`,
    `*MAKE:* ${data.make}`,
    `*MODEL:* ${data.model}`,
    `*YEAR:* ${data.year}`,
    `*STATUS:* ${data.status.charAt(0).toUpperCase() + data.status.slice(1)}`,
  ];

  if (data.currentMileage !== undefined) {
    lines.push(`*CURRENT MILEAGE:* ${data.currentMileage.toLocaleString()} km`);
  }

  if (data.fuelType) {
    lines.push(`*FUEL TYPE:* ${data.fuelType}`);
  }

  lines.push(``);
  lines.push(`_Added by ${data.performedBy}_`);

  return lines.join('\n');
}

function adminInvoiceCreatedTemplate(data: {
  invoiceNumber: string;
  customerName: string;
  total: number;
  subtotal: number;
  tax: number;
  status: string;
  isCredit: boolean;
  issueDate: Date;
  dueDate?: Date | null;
  tripRoute?: string | null;
  performedBy: string;
}): string {
  const lines = [
    `*NEW INVOICE CREATED*`,
    ``,
    `A new invoice has been created.`,
    ``,
    `*INVOICE NUMBER:* ${data.invoiceNumber}`,
    `*CUSTOMER:* ${data.customerName}`,
    `*SUBTOTAL:* ${formatCurrency(data.subtotal)}`,
  ];

  if (data.tax > 0) {
    lines.push(`*TAX:* ${formatCurrency(data.tax)}`);
  }

  lines.push(`*TOTAL:* ${formatCurrency(data.total)}`);
  lines.push(`*STATUS:* ${data.status.charAt(0).toUpperCase() + data.status.slice(1)}`);

  if (data.isCredit) {
    lines.push(`*TYPE:* Credit Invoice`);
    if (data.dueDate) {
      lines.push(`*DUE DATE:* ${formatDate(new Date(data.dueDate))}`);
    }
  }

  lines.push(`*ISSUE DATE:* ${formatDate(new Date(data.issueDate))}`);

  if (data.tripRoute) {
    lines.push(`*TRIP:* ${data.tripRoute}`);
  }

  lines.push(``);
  lines.push(`_Created by ${data.performedBy}_`);

  return lines.join('\n');
}

function adminEmployeeCreatedTemplate(data: {
  employeeName: string;
  position: string;
  department?: string | null;
  email?: string | null;
  phone: string;
  status: string;
  performedBy: string;
}): string {
  const lines = [
    `*NEW EMPLOYEE ADDED*`,
    ``,
    `A new employee has been added.`,
    ``,
    `*NAME:* ${data.employeeName}`,
    `*POSITION:* ${data.position}`,
  ];

  if (data.department) {
    lines.push(`*DEPARTMENT:* ${data.department}`);
  }

  if (data.email) {
    lines.push(`*EMAIL:* ${data.email}`);
  }

  lines.push(`*PHONE:* ${data.phone}`);
  lines.push(`*STATUS:* ${data.status.charAt(0).toUpperCase() + data.status.slice(1)}`);

  lines.push(``);
  lines.push(`_Added by ${data.performedBy}_`);

  return lines.join('\n');
}

function adminPaymentReceivedTemplate(data: {
  paymentNumber: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  paymentMethod: string;
  paymentDate: Date;
  invoiceTotal: number;
  invoiceBalance: number;
  isFullyPaid: boolean;
  performedBy: string;
}): string {
  const lines = [
    `*PAYMENT RECEIVED*`,
    ``,
    `A payment has been recorded.`,
    ``,
    `*PAYMENT NUMBER:* ${data.paymentNumber}`,
    `*INVOICE NUMBER:* ${data.invoiceNumber}`,
    `*CUSTOMER:* ${data.customerName}`,
    `*AMOUNT PAID:* ${formatCurrency(data.amount)}`,
    `*METHOD:* ${data.paymentMethod.replace(/_/g, ' ').toUpperCase()}`,
    `*DATE:* ${formatDate(new Date(data.paymentDate))}`,
    ``,
    `*INVOICE DETAILS:*`,
    `Total: ${formatCurrency(data.invoiceTotal)}`,
    `Balance Remaining: ${formatCurrency(data.invoiceBalance)}`,
  ];

  if (data.isFullyPaid) {
    lines.push(`*STATUS:* _FULLY PAID_`);
  } else {
    const percentPaid = ((data.invoiceTotal - data.invoiceBalance) / data.invoiceTotal * 100).toFixed(0);
    lines.push(`*STATUS:* Partial (${percentPaid}% paid)`);
  }

  lines.push(``);
  lines.push(`_Recorded by ${data.performedBy}_`);

  return lines.join('\n');
}

/**
 * Determine if a customer/supplier is a company
 */
function isCompany(entity: { contactPerson?: string | null; taxId?: string | null; email?: string | null }): boolean {
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

    const whatsappMessage = tripAssignmentTemplate(tripData);

    if (trip.driver.whatsappNumber) {
      await sendWhatsAppMessage(trip.driver.whatsappNumber, whatsappMessage);
      console.log(`✅ Trip assignment WhatsApp sent to driver ${driverName}`);
    }

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

    const welcomeMessage = `*WELCOME TO ${orgName.toUpperCase()}*

Hello ${driverName},

We're excited to have you join our team!

*YOUR DETAILS:*
Name: ${driverName}
License: ${driver.licenseNumber}
Status: ${driver.status.charAt(0).toUpperCase() + driver.status.slice(1)}
${driver.assignedTruck ? `Assigned Truck: ${driver.assignedTruck.registrationNo}` : ''}

You'll receive trip assignments via WhatsApp. Please keep your phone number and WhatsApp number updated.

If you have any questions, don't hesitate to reach out.

Welcome aboard!`;

    if (driver.whatsappNumber) {
      await sendWhatsAppMessage(driver.whatsappNumber, welcomeMessage);
      console.log(`✅ Welcome WhatsApp sent to driver ${driverName}`);
    }

    if (driver.email) {
      await sendEmail({
        to: driver.email,
        subject: `Welcome to ${orgName}!`,
        text: welcomeMessage.replace(/\*/g, ''),
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
 * Notify admin about new driver creation
 */
export async function notifyAdminDriverCreated(
  driverId: string,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
): Promise<void> {
  try {
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      include: {
        assignedTruck: { select: { registrationNo: true } },
      },
    });

    if (!driver) return;

    const message = adminDriverCreatedTemplate({
      driverName: `${driver.firstName} ${driver.lastName}`,
      phone: driver.phone,
      whatsappNumber: driver.whatsappNumber,
      email: driver.email,
      licenseNumber: driver.licenseNumber,
      status: driver.status,
      assignedTruck: driver.assignedTruck?.registrationNo || null,
      performedBy: performedBy.name,
    });

    await notifyAdminWhatsApp(message);
  } catch (error) {
    console.error("Failed to notify admin about driver creation:", error);
  }
}

/**
 * Notify admin about new truck creation
 */
export async function notifyAdminTruckCreated(
  truckId: string,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
): Promise<void> {
  try {
    const truck = await prisma.truck.findUnique({
      where: { id: truckId },
    });

    if (!truck) return;

    const message = adminTruckCreatedTemplate({
      registrationNo: truck.registrationNo,
      make: truck.make,
      model: truck.model,
      year: truck.year,
      status: truck.status,
      currentMileage: truck.currentMileage,
      fuelType: truck.fuelType,
      performedBy: performedBy.name,
    });

    await notifyAdminWhatsApp(message);
  } catch (error) {
    console.error("Failed to notify admin about truck creation:", error);
  }
}

/**
 * Notify admin about new invoice creation
 */
export async function notifyAdminInvoiceCreated(
  invoiceId: string,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
): Promise<void> {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: { select: { name: true } },
        trip: {
          select: {
            originCity: true,
            destinationCity: true,
          },
        },
      },
    });

    if (!invoice) return;

    const tripRoute = invoice.trip 
      ? `${invoice.trip.originCity} to ${invoice.trip.destinationCity}`
      : null;

    const message = adminInvoiceCreatedTemplate({
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customer.name,
      total: invoice.total,
      subtotal: invoice.subtotal,
      tax: invoice.tax,
      status: invoice.status,
      isCredit: invoice.isCredit,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      tripRoute,
      performedBy: performedBy.name,
    });

    await notifyAdminWhatsApp(message);
  } catch (error) {
    console.error("Failed to notify admin about invoice creation:", error);
  }
}

/**
 * Notify admin about new employee creation
 */
export async function notifyAdminEmployeeCreated(
  employeeId: string,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
): Promise<void> {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) return;

    const message = adminEmployeeCreatedTemplate({
      employeeName: `${employee.firstName} ${employee.lastName}`,
      position: employee.position,
      department: employee.department,
      email: employee.email,
      phone: employee.phone,
      status: employee.status,
      performedBy: performedBy.name,
    });

    await notifyAdminWhatsApp(message);
  } catch (error) {
    console.error("Failed to notify admin about employee creation:", error);
  }
}

/**
 * Notify admin about invoice payment
 */
export async function notifyAdminPaymentReceived(
  paymentId: string,
  organizationId: string,
  performedBy: { name: string; email: string; role: string }
): Promise<void> {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            total: true,
            amountPaid: true,
            balance: true,
          },
        },
        customer: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!payment) return;

    const invoice = payment.invoice;
    const isFullyPaid = invoice ? invoice.balance <= 0 : false;

    const message = adminPaymentReceivedTemplate({
      paymentNumber: `PMT-${payment.id.slice(-8).toUpperCase()}`,
      invoiceNumber: invoice?.invoiceNumber || 'N/A',
      customerName: payment.customer.name,
      amount: payment.amount,
      paymentMethod: payment.method,
      paymentDate: payment.paymentDate,
      invoiceTotal: invoice?.total || 0,
      invoiceBalance: invoice?.balance || 0,
      isFullyPaid,
      performedBy: performedBy.name,
    });

    await notifyAdminWhatsApp(message);
  } catch (error) {
    console.error("Failed to notify admin about payment:", error);
  }
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
      },
    });

    if (!invoice) {
      console.log("Invoice not found, skipping payment notification");
      return;
    }

    const orgName = invoice.organization?.name || "WD Logistics";
    const customer = invoice.customer;
    const isCustomerCompany = isCompany(customer);

    if (isCustomerCompany && customer.email) {
      await sendEmail({
        to: customer.email,
        subject: `Payment Received - Invoice ${invoice.invoiceNumber}`,
        text: `Dear ${customer.name},

We have received full payment for your invoice.

Payment Details:
- Invoice #: ${invoice.invoiceNumber}
- Amount: ${formatCurrency(invoice.total)}
- Date: ${formatDate(new Date())}

Thank you for your prompt payment!

— ${orgName}`,
        html: `<div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Payment Received</h2>
          <p>Dear ${customer.name},</p>
          <p>We have received full payment for your invoice.</p>
          <h3>Payment Details:</h3>
          <ul>
            <li>Invoice #: ${invoice.invoiceNumber}</li>
            <li>Amount: ${formatCurrency(invoice.total)}</li>
            <li>Date: ${formatDate(new Date())}</li>
          </ul>
          <p>Thank you for your prompt payment!</p>
          <p>— ${orgName}</p>
        </div>`,
      });
      console.log(`✅ Payment confirmation email sent to customer ${customer.name}`);
    }

    console.log(`✅ Invoice ${invoice.invoiceNumber} fully paid - admins notified`);
  } catch (error) {
    console.error("Failed to notify about invoice payment:", error);
  }
}
