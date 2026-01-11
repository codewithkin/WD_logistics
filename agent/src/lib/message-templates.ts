/**
 * Message Templates for WhatsApp
 * 
 * Pre-defined templates for various notifications.
 * These bypass the AI and send directly via WWEBJS.
 */

import { format } from "date-fns";

export interface TripMessageData {
  driverName: string;
  originCity: string;
  originAddress?: string;
  destinationCity: string;
  destinationAddress?: string;
  scheduledDate: Date;
  loadDescription?: string;
  loadWeight?: number;
  loadUnits?: number;
  truckRegistration: string;
  customerName: string;
  notes?: string;
}

export interface InvoiceMessageData {
  customerName: string;
  invoiceNumber: string;
  total: number;
  dueDate: Date;
  balance: number;
  organizationName: string;
}

export interface TripStatusMessageData {
  customerName: string;
  tripOrigin: string;
  tripDestination: string;
  status: "in_progress" | "completed" | "delayed" | "cancelled";
  estimatedArrival?: Date;
  notes?: string;
}

export interface DeliveryConfirmationData {
  customerName: string;
  tripOrigin: string;
  tripDestination: string;
  deliveryDate: Date;
  driverName: string;
}

// Currency formatter
const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

// Date formatter
const formatDate = (date: Date): string =>
  format(date, "EEEE, MMMM d, yyyy");

const formatDateTime = (date: Date): string =>
  format(date, "EEEE, MMMM d, yyyy 'at' h:mm a");

/**
 * Trip Assignment Template - for drivers
 */
export function tripAssignmentTemplate(data: TripMessageData): string {
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
    ``,
    `🚛 *Truck:* ${data.truckRegistration}`,
    `👤 *Customer:* ${data.customerName}`,
  ];

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
 * Invoice Reminder Template - for customers
 */
export function invoiceReminderTemplate(data: InvoiceMessageData): string {
  const isOverdue = new Date(data.dueDate) < new Date();
  
  const lines = [
    `${isOverdue ? '⚠️' : '📄'} *Invoice Reminder*`,
    ``,
    `Dear ${data.customerName},`,
    ``,
    isOverdue 
      ? `This is a reminder that your invoice is now overdue.`
      : `This is a friendly reminder about your upcoming invoice.`,
    ``,
    `📋 *Invoice Details:*`,
    `   Invoice #: ${data.invoiceNumber}`,
    `   Amount: ${formatCurrency(data.total)}`,
    `   ${isOverdue ? 'Was Due' : 'Due Date'}: ${formatDate(new Date(data.dueDate))}`,
  ];

  if (data.balance !== data.total) {
    lines.push(`   Balance Due: ${formatCurrency(data.balance)}`);
  }

  lines.push(``);
  lines.push(`Please arrange for payment at your earliest convenience.`);
  lines.push(``);
  lines.push(`Thank you for your business!`);
  lines.push(`— ${data.organizationName}`);

  return lines.join('\n');
}

/**
 * Trip Status Update Template - for customers
 */
export function tripStatusTemplate(data: TripStatusMessageData): string {
  const statusEmoji = {
    in_progress: '🚚',
    completed: '✅',
    delayed: '⏰',
    cancelled: '❌',
  };

  const statusText = {
    in_progress: 'In Progress',
    completed: 'Completed',
    delayed: 'Delayed',
    cancelled: 'Cancelled',
  };

  const lines = [
    `${statusEmoji[data.status]} *Trip Status Update*`,
    ``,
    `Dear ${data.customerName},`,
    ``,
    `Your shipment status has been updated:`,
    ``,
    `📍 *Route:*`,
    `   From: ${data.tripOrigin}`,
    `   To: ${data.tripDestination}`,
    ``,
    `📊 *Status:* ${statusText[data.status]}`,
  ];

  if (data.estimatedArrival && data.status === 'in_progress') {
    lines.push(`⏰ *Estimated Arrival:* ${formatDateTime(new Date(data.estimatedArrival))}`);
  }

  if (data.notes) {
    lines.push(``);
    lines.push(`📝 *Notes:* ${data.notes}`);
  }

  lines.push(``);
  lines.push(`Thank you for choosing our services!`);

  return lines.join('\n');
}

/**
 * Delivery Confirmation Template - for customers
 */
export function deliveryConfirmationTemplate(data: DeliveryConfirmationData): string {
  return [
    `✅ *Delivery Confirmed*`,
    ``,
    `Dear ${data.customerName},`,
    ``,
    `Your delivery has been completed successfully!`,
    ``,
    `📍 *Route:*`,
    `   From: ${data.tripOrigin}`,
    `   To: ${data.tripDestination}`,
    ``,
    `📅 *Delivered On:* ${formatDateTime(new Date(data.deliveryDate))}`,
    `👤 *Driver:* ${data.driverName}`,
    ``,
    `Thank you for your business!`,
    `We appreciate you choosing our services. 🙏`,
  ].join('\n');
}

/**
 * Payment Received Template - for customers
 */
export function paymentReceivedTemplate(data: {
  customerName: string;
  invoiceNumber: string;
  amount: number;
  paymentDate: Date;
  paymentMethod: string;
  organizationName: string;
}): string {
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

/**
 * Daily Schedule Template - for drivers
 */
export function dailyScheduleTemplate(data: {
  driverName: string;
  date: Date;
  trips: Array<{
    origin: string;
    destination: string;
    scheduledTime: string;
    customer: string;
    truck: string;
  }>;
}): string {
  const lines = [
    `📅 *Daily Schedule*`,
    ``,
    `Good morning, ${data.driverName}!`,
    ``,
    `Here are your trips for ${formatDate(new Date(data.date))}:`,
    ``,
  ];

  if (data.trips.length === 0) {
    lines.push(`No trips scheduled for today. Enjoy your day off! 🎉`);
  } else {
    data.trips.forEach((trip, idx) => {
      lines.push(`*Trip ${idx + 1}:*`);
      lines.push(`   📍 ${trip.origin} → ${trip.destination}`);
      lines.push(`   ⏰ ${trip.scheduledTime}`);
      lines.push(`   👤 ${trip.customer}`);
      lines.push(`   🚛 ${trip.truck}`);
      lines.push(``);
    });
  }

  lines.push(`Safe travels! 🛣️`);

  return lines.join('\n');
}

export type MessageTemplateType = 
  | "trip_assignment"
  | "invoice_reminder"
  | "trip_status"
  | "delivery_confirmation"
  | "payment_received"
  | "daily_schedule";

export const templateFunctions = {
  trip_assignment: tripAssignmentTemplate,
  invoice_reminder: invoiceReminderTemplate,
  trip_status: tripStatusTemplate,
  delivery_confirmation: deliveryConfirmationTemplate,
  payment_received: paymentReceivedTemplate,
  daily_schedule: dailyScheduleTemplate,
};
