import { api } from "../lib/api-client";
import { logisticsAgent } from "../agents/logistics-agent";
import { tripAssignmentTemplate, invoiceReminderTemplate, type TripMessageData, type InvoiceMessageData } from "../lib/message-templates";

export interface WorkflowResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Trip Notification Workflow
 * Sends notifications to drivers about upcoming trips
 */
export async function notifyDriversAboutUpcomingTrips(
  organizationId: string,
  daysAhead: number = 1
): Promise<WorkflowResult> {
  try {
    // Get trips from API
    const { trips } = await api.workflows.getUpcomingTrips(organizationId, daysAhead);

    if (trips.length === 0) {
      return {
        success: true,
        message: "No pending trip notifications",
        data: { notified: 0 },
      };
    }

    const notifications: Array<{
      tripId: string;
      driverId: string;
      driverName: string;
      phone: string;
      message: string;
    }> = [];

    for (const trip of trips) {
      const scheduledDate = new Date(trip.scheduledDate);
      const message = `Hi ${trip.driver.firstName}, you have a trip scheduled for ${scheduledDate.toLocaleDateString()}.
Route: ${trip.originCity} → ${trip.destinationCity}
Truck: ${trip.truck.registrationNo}
${trip.customer ? `Customer: ${trip.customer.name}` : ""}
${trip.loadDescription ? `Load: ${trip.loadDescription}` : ""}
Please confirm your availability.`;

      notifications.push({
        tripId: trip.id,
        driverId: trip.driver.id,
        driverName: `${trip.driver.firstName} ${trip.driver.lastName}`,
        phone: trip.driver.phone,
        message,
      });

      // Create notification record via API
      await api.workflows.createNotification(organizationId, {
        type: "trip_assignment",
        recipientPhone: trip.driver.phone,
        message,
        status: "pending",
        metadata: {
          tripId: trip.id,
          driverId: trip.driver.id,
          organizationId,
        },
      });

      // Mark trip as notified via API
      await api.workflows.markTripNotified(organizationId, trip.id);
    }

    return {
      success: true,
      message: `Created ${notifications.length} trip notifications`,
      data: {
        notified: notifications.length,
        notifications,
      },
    };
  } catch (error) {
    console.error("Trip notification workflow error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to process trip notifications",
    };
  }
}

/**
 * Invoice Reminder Workflow
 * Sends reminders for overdue invoices
 */
export async function sendInvoiceReminders(
  organizationId: string,
  minDaysOverdue: number = 1
): Promise<WorkflowResult> {
  const now = new Date();

  try {
    // Get overdue invoices from API
    const { invoices } = await api.workflows.getOverdueInvoices(organizationId, minDaysOverdue);

    if (invoices.length === 0) {
      return {
        success: true,
        message: "No invoice reminders needed",
        data: { reminders: 0 },
      };
    }

    const reminders: Array<{
      invoiceId: string;
      invoiceNumber: string;
      customerName: string;
      balance: number;
      daysOverdue: number;
    }> = [];

    for (const invoice of invoices) {
      const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : now;
      const daysOverdue = Math.ceil(
        (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const message = `Dear ${invoice.customer.name},

This is a friendly reminder that Invoice #${invoice.invoiceNumber} is ${daysOverdue} days overdue.

Amount Due: $${invoice.balance.toFixed(2)}
Original Due Date: ${dueDate.toLocaleDateString()}

Please arrange payment at your earliest convenience. If you have already made payment, please disregard this message.

Thank you for your business.`;

      if (invoice.customer.phone) {
        await api.workflows.createNotification(organizationId, {
          type: "invoice_reminder",
          recipientPhone: invoice.customer.phone,
          message,
          status: "pending",
          metadata: {
            invoiceId: invoice.id,
            customerId: invoice.customer.id,
            balance: invoice.balance,
            daysOverdue,
          },
        });
      }

      // Mark invoice reminder sent via API
      await api.workflows.markInvoiceReminderSent(organizationId, invoice.id);

      reminders.push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customer.name,
        balance: invoice.balance,
        daysOverdue,
      });
    }

    return {
      success: true,
      message: `Created ${reminders.length} invoice reminders`,
      data: {
        reminders: reminders.length,
        details: reminders,
      },
    };
  } catch (error) {
    console.error("Invoice reminder workflow error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to process invoice reminders",
    };
  }
}

/**
 * Daily Summary Workflow
 * Generates a daily summary using the AI agent
 */
export async function generateDailySummary(
  organizationId: string
): Promise<WorkflowResult> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get summary data from API
    const { summary } = await api.workflows.getDailySummary(organizationId);

    // Get expiring licenses
    const { drivers: expiringDrivers } = await api.workflows.getDriversExpiringDocs(organizationId, 30);

    // Generate AI summary
    const summaryPrompt = `Generate a brief daily summary for the logistics operations:

Today's Statistics:
- Trips scheduled today: ${summary.tripsToday}
- Trips in progress: ${summary.tripsInProgress}
- Overdue invoices: ${summary.overdueInvoices}
- Payments received today: $${summary.paymentsToday.toFixed(2)}
- Active drivers: ${summary.activeDrivers}
- Drivers with expiring documents (next 30 days): ${expiringDrivers.length}

Please provide:
1. A brief 2-3 sentence summary of the day
2. Any items requiring immediate attention
3. Key action items for tomorrow`;

    const response = await logisticsAgent.generate([
      {
        role: "user",
        content: `[Organization ID: ${organizationId}]\n\n${summaryPrompt}`,
      },
    ]);

    return {
      success: true,
      message: "Daily summary generated",
      data: {
        date: today.toISOString().split("T")[0],
        stats: {
          tripsToday: summary.tripsToday,
          tripsInProgress: summary.tripsInProgress,
          overdueInvoices: summary.overdueInvoices,
          paymentsToday: summary.paymentsToday,
          activeDrivers: summary.activeDrivers,
          expiringDocuments: expiringDrivers.length,
        },
        summary: response.text,
      },
    };
  } catch (error) {
    console.error("Daily summary workflow error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to generate daily summary",
    };
  }
}

/**
 * License Expiry Alert Workflow
 * Alerts about expiring driver licenses
 */
export async function checkLicenseExpiries(
  organizationId: string,
  daysAhead: number = 30
): Promise<WorkflowResult> {
  try {
    const { drivers } = await api.workflows.getDriversExpiringDocs(organizationId, daysAhead);

    if (drivers.length === 0) {
      return {
        success: true,
        message: "No license expiries in the next " + daysAhead + " days",
        data: { alerts: 0 },
      };
    }

    const alerts = drivers.map((driver) => ({
      driverId: driver.id,
      driverName: `${driver.firstName} ${driver.lastName}`,
      phone: driver.phone,
    }));

    return {
      success: true,
      message: `Found ${alerts.length} drivers with expiring licenses`,
      data: {
        alerts: alerts.length,
        details: alerts,
      },
    };
  } catch (error) {
    console.error("License expiry check error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to check license expiries",
    };
  }
}

/**
 * Immediate Trip Assignment Notification
 * Sends notification to a driver when they are assigned to a specific trip
 */
export async function notifyTripAssignment(
  tripId: string,
  organizationId: string
): Promise<WorkflowResult> {
  try {
    const { trip } = await api.workflows.getTripForMessage(organizationId, tripId);

    if (!trip) {
      return {
        success: false,
        message: "Trip not found",
      };
    }

    const driverPhone = trip.driver.phone;
    if (!driverPhone) {
      return {
        success: false,
        message: "Driver has no phone number configured",
      };
    }

    // Use the pre-defined message template
    const templateData: TripMessageData = {
      driverName: trip.driver.firstName,
      originCity: trip.originCity,
      destinationCity: trip.destinationCity,
      scheduledDate: new Date(trip.scheduledDate),
      loadDescription: trip.loadDescription || undefined,
      truckRegistration: trip.truck.registrationNo,
      customerName: trip.customer?.name || "Not specified",
    };

    const message = tripAssignmentTemplate(templateData);

    // Create notification record
    await api.workflows.createNotification(organizationId, {
      type: "trip_assignment",
      recipientPhone: driverPhone,
      message,
      status: "pending",
      metadata: {
        tripId: trip.id,
        driverId: trip.driver.id,
        organizationId,
      },
    });

    // Mark trip as notified
    await api.workflows.markTripNotified(organizationId, trip.id);

    return {
      success: true,
      message: `Trip assignment notification created for ${trip.driver.firstName} ${trip.driver.lastName}`,
      data: {
        tripId: trip.id,
        driverId: trip.driver.id,
        driverName: `${trip.driver.firstName} ${trip.driver.lastName}`,
        phone: driverPhone,
        notificationMessage: message,
      },
    };
  } catch (error) {
    console.error("Trip assignment notification error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to send trip assignment notification",
    };
  }
}

/**
 * Send Invoice Reminder by Invoice ID
 * Sends a payment reminder for a specific invoice
 */
export async function sendInvoiceReminderById(
  invoiceId: string,
  organizationId: string
): Promise<WorkflowResult> {
  try {
    // Get invoice details from the invoices API
    const invoice = await api.invoices.details(organizationId, invoiceId);

    if (!invoice) {
      return {
        success: false,
        message: "Invoice not found",
      };
    }

    if (invoice.status === "paid" || invoice.status === "cancelled") {
      return {
        success: false,
        message: `Cannot send reminder for ${invoice.status} invoice`,
      };
    }

    if (invoice.balance <= 0) {
      return {
        success: false,
        message: "Invoice has no outstanding balance",
      };
    }

    const customerPhone = invoice.customer.phone;
    if (!customerPhone) {
      return {
        success: false,
        message: "Customer has no phone number configured",
      };
    }

    const now = new Date();
    const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : now;
    const isOverdue = dueDate < now;
    const daysOverdue = isOverdue
      ? Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Use the pre-defined message template
    const templateData: InvoiceMessageData = {
      customerName: invoice.customer.name,
      invoiceNumber: invoice.invoiceNumber,
      total: invoice.total,
      dueDate: dueDate,
      balance: invoice.balance,
      organizationName: "WD Logistics",
    };

    const message = invoiceReminderTemplate(templateData);

    // Create notification record
    await api.workflows.createNotification(organizationId, {
      type: "invoice_reminder",
      recipientPhone: customerPhone,
      message,
      status: "pending",
      metadata: {
        invoiceId: invoice.id,
        customerId: invoice.customer.id,
        balance: invoice.balance,
        daysOverdue: isOverdue ? daysOverdue : 0,
        organizationId,
      },
    });

    // Mark invoice reminder sent
    await api.workflows.markInvoiceReminderSent(organizationId, invoice.id);

    return {
      success: true,
      message: `Invoice reminder sent to ${invoice.customer.name}`,
      data: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerId: invoice.customer.id,
        customerName: invoice.customer.name,
        phone: customerPhone,
        balance: invoice.balance,
        isOverdue,
        daysOverdue,
        notificationMessage: message,
      },
    };
  } catch (error) {
    console.error("Invoice reminder error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to send invoice reminder",
    };
  }
}

// Export all workflows
export const workflows = {
  notifyDriversAboutUpcomingTrips,
  sendInvoiceReminders,
  generateDailySummary,
  checkLicenseExpiries,
  notifyTripAssignment,
  sendInvoiceReminderById,
};
