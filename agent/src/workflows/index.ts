import prisma from "../lib/prisma";
import { logisticsAgent } from "../agents/logistics-agent";

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
  const now = new Date();
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysAhead);

  // Set to start of day for targetDate and end of day
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  try {
    // Find trips scheduled for the target date that haven't been notified
    const trips = await prisma.trip.findMany({
      where: {
        organizationId,
        scheduledDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        driverNotified: false,
        status: "scheduled",
      },
      include: {
        driver: true,
        truck: true,
        customer: true,
      },
    });

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
      const message = `Hi ${trip.driver.firstName}, you have a trip scheduled for ${trip.scheduledDate.toLocaleDateString()}.
Route: ${trip.originCity} → ${trip.destinationCity}
Truck: ${trip.truck.registrationNo}
${trip.customer ? `Customer: ${trip.customer.name}` : ""}
${trip.loadDescription ? `Load: ${trip.loadDescription}` : ""}
Please confirm your availability.`;

      notifications.push({
        tripId: trip.id,
        driverId: trip.driver.id,
        driverName: `${trip.driver.firstName} ${trip.driver.lastName}`,
        phone: trip.driver.whatsappNumber || trip.driver.phone,
        message,
      });

      // Create notification record
      await prisma.notification.create({
        data: {
          type: "trip_assignment",
          recipientPhone: trip.driver.whatsappNumber || trip.driver.phone,
          message,
          status: "pending",
          metadata: {
            tripId: trip.id,
            driverId: trip.driver.id,
            organizationId,
          },
        },
      });

      // Mark trip as notified
      await prisma.trip.update({
        where: { id: trip.id },
        data: {
          driverNotified: true,
          notifiedAt: now,
        },
      });
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
  const overdueDate = new Date();
  overdueDate.setDate(overdueDate.getDate() - minDaysOverdue);

  try {
    // Find overdue invoices that haven't had a recent reminder
    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId,
        dueDate: { lt: overdueDate },
        balance: { gt: 0 },
        status: { notIn: ["paid", "cancelled"] },
        OR: [
          { reminderSent: false },
          {
            reminderSentAt: {
              lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // Last reminder > 7 days ago
            },
          },
        ],
        // Don't send if past max reminder date
        OR: [{ maxReminderDate: null }, { maxReminderDate: { gt: now } }],
      },
      include: {
        customer: true,
      },
    });

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
      const daysOverdue = Math.ceil(
        (now.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const message = `Dear ${invoice.customer.name},

This is a friendly reminder that Invoice #${invoice.invoiceNumber} is ${daysOverdue} days overdue.

Amount Due: $${invoice.balance.toFixed(2)}
Original Due Date: ${invoice.dueDate.toLocaleDateString()}

Please arrange payment at your earliest convenience. If you have already made payment, please disregard this message.

Thank you for your business.`;

      if (invoice.customer.phone) {
        await prisma.notification.create({
          data: {
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
          },
        });
      }

      // Update invoice reminder status
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          reminderSent: true,
          reminderSentAt: now,
          status: invoice.status === "sent" ? "overdue" : invoice.status,
        },
      });

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
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's data
    const [
      todaysTrips,
      completedTrips,
      overdueInvoices,
      newPayments,
      expiringLicenses,
    ] = await Promise.all([
      prisma.trip.count({
        where: {
          organizationId,
          scheduledDate: { gte: today, lt: tomorrow },
        },
      }),
      prisma.trip.count({
        where: {
          organizationId,
          status: "completed",
          endDate: { gte: today, lt: tomorrow },
        },
      }),
      prisma.invoice.count({
        where: {
          organizationId,
          dueDate: { lt: today },
          balance: { gt: 0 },
          status: { notIn: ["paid", "cancelled"] },
        },
      }),
      prisma.payment.aggregate({
        where: {
          paymentDate: { gte: today, lt: tomorrow },
          invoice: { organizationId },
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.driver.count({
        where: {
          organizationId,
          status: "active",
          licenseExpiry: {
            lte: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // Generate AI summary
    const summaryPrompt = `Generate a brief daily summary for the logistics operations:

Today's Statistics:
- Trips scheduled today: ${todaysTrips}
- Trips completed today: ${completedTrips}
- Overdue invoices: ${overdueInvoices}
- Payments received today: ${newPayments._count} (Total: $${(newPayments._sum.amount || 0).toFixed(2)})
- Drivers with expiring licenses (next 30 days): ${expiringLicenses}

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
          tripsScheduled: todaysTrips,
          tripsCompleted: completedTrips,
          overdueInvoices,
          paymentsReceived: newPayments._count,
          paymentsTotal: newPayments._sum.amount || 0,
          expiringLicenses,
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
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  try {
    const drivers = await prisma.driver.findMany({
      where: {
        organizationId,
        status: "active",
        licenseExpiry: {
          lte: futureDate,
          gte: now, // Not already expired
        },
      },
      orderBy: { licenseExpiry: "asc" },
    });

    if (drivers.length === 0) {
      return {
        success: true,
        message: "No license expiries in the next " + daysAhead + " days",
        data: { alerts: 0 },
      };
    }

    const alerts = drivers.map((driver) => {
      const daysUntilExpiry = Math.ceil(
        (driver.licenseExpiry!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        driverId: driver.id,
        driverName: `${driver.firstName} ${driver.lastName}`,
        phone: driver.phone,
        licenseNumber: driver.licenseNumber,
        expiryDate: driver.licenseExpiry!.toISOString(),
        daysUntilExpiry,
        urgency:
          daysUntilExpiry <= 7 ? "critical" : daysUntilExpiry <= 14 ? "high" : "medium",
      };
    });

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

// Export all workflows
export const workflows = {
  notifyDriversAboutUpcomingTrips,
  sendInvoiceReminders,
  generateDailySummary,
  checkLicenseExpiries,
};
