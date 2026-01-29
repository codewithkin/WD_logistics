/**
 * WhatsApp Notification Templates
 * 
 * Pre-defined message templates for various notification types.
 */

import { sendWhatsAppMessage } from './index';

/**
 * Send trip assignment notification to driver
 */
export async function sendTripAssignmentNotification(params: {
  driverPhone: string;
  driverName: string;
  tripNumber: string;
  origin: string;
  destination: string;
  departureDate: string;
  truckPlate?: string;
}) {
  const message = `🚛 *New Trip Assignment*

Hello ${params.driverName},

You have been assigned a new trip:

📋 *Trip #:* ${params.tripNumber}
📍 *From:* ${params.origin}
📍 *To:* ${params.destination}
📅 *Departure:* ${params.departureDate}
${params.truckPlate ? `🚚 *Truck:* ${params.truckPlate}` : ''}

Please confirm your availability and prepare for departure.

Safe travels! 🛣️`;

  return sendWhatsAppMessage(params.driverPhone, message);
}

/**
 * Send invoice reminder to customer
 */
export async function sendInvoiceReminderNotification(params: {
  customerPhone: string;
  customerName: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  daysOverdue?: number;
}) {
  const isOverdue = params.daysOverdue && params.daysOverdue > 0;
  
  const message = isOverdue
    ? `⚠️ *Payment Overdue Notice*

Dear ${params.customerName},

This is a reminder that the following invoice is *${params.daysOverdue} days overdue*:

📄 *Invoice #:* ${params.invoiceNumber}
💰 *Amount:* ${params.amount}
📅 *Due Date:* ${params.dueDate}

Please arrange payment at your earliest convenience to avoid any service interruptions.

Thank you for your business! 🤝`
    : `📋 *Payment Reminder*

Dear ${params.customerName},

This is a friendly reminder about your upcoming invoice:

📄 *Invoice #:* ${params.invoiceNumber}
💰 *Amount:* ${params.amount}
📅 *Due Date:* ${params.dueDate}

Please ensure timely payment to maintain your account in good standing.

Thank you for your business! 🤝`;

  return sendWhatsAppMessage(params.customerPhone, message);
}

/**
 * Send trip status update to driver
 */
export async function sendTripStatusNotification(params: {
  driverPhone: string;
  driverName: string;
  tripNumber: string;
  status: string;
  message?: string;
}) {
  const statusEmoji: Record<string, string> = {
    scheduled: '📅',
    in_progress: '🚛',
    completed: '✅',
    cancelled: '❌',
    delayed: '⏰',
  };

  const emoji = statusEmoji[params.status] || '📋';

  const notificationMessage = `${emoji} *Trip Status Update*

Hello ${params.driverName},

Your trip status has been updated:

📋 *Trip #:* ${params.tripNumber}
📊 *Status:* ${params.status.replace(/_/g, ' ').toUpperCase()}
${params.message ? `\n💬 *Note:* ${params.message}` : ''}

Please contact dispatch if you have any questions.`;

  return sendWhatsAppMessage(params.driverPhone, notificationMessage);
}

/**
 * Send general notification
 */
export async function sendGeneralNotification(params: {
  phoneNumber: string;
  title: string;
  body: string;
}) {
  const message = `📢 *${params.title}*

${params.body}

- WD Logistics Team`;

  return sendWhatsAppMessage(params.phoneNumber, message);
}

export default {
  sendTripAssignmentNotification,
  sendInvoiceReminderNotification,
  sendTripStatusNotification,
  sendGeneralNotification,
};
