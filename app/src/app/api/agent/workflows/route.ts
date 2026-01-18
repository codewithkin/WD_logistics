import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateAgentRequest } from "@/lib/agent-auth";

// Trip Notification Actions
async function getUpcomingTripsForNotification(
  organizationId: string,
  daysAhead: number = 1
) {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysAhead);

  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const trips = await prisma.trip.findMany({
    where: {
      organizationId,
      scheduledDate: { gte: startOfDay, lte: endOfDay },
      driverNotified: false,
      status: "scheduled",
    },
    include: {
      driver: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
      truck: { select: { registrationNo: true } },
      customer: { select: { name: true } },
    },
  });

  return trips.map((trip) => ({
    id: trip.id,
    scheduledDate: trip.scheduledDate.toISOString(),
    originCity: trip.originCity,
    destinationCity: trip.destinationCity,
    loadDescription: trip.loadDescription,
    driver: {
      id: trip.driver.id,
      firstName: trip.driver.firstName,
      lastName: trip.driver.lastName,
      phone: trip.driver.phone,
      email: trip.driver.email,
    },
    truck: { registrationNo: trip.truck.registrationNo },
    customer: trip.customer ? { name: trip.customer.name } : null,
  }));
}

async function markTripNotified(tripId: string) {
  await prisma.trip.update({
    where: { id: tripId },
    data: { driverNotified: true, notifiedAt: new Date() },
  });
}

// Invoice Reminder Actions
async function getOverdueInvoicesForReminder(
  organizationId: string,
  minDaysOverdue: number = 1
) {
  const now = new Date();
  const overdueDate = new Date();
  overdueDate.setDate(overdueDate.getDate() - minDaysOverdue);

  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId,
      dueDate: { lt: overdueDate },
      balance: { gt: 0 },
      status: { notIn: ["paid", "cancelled"] },
      AND: [
        {
          OR: [
            { reminderSent: false },
            { reminderSentAt: { lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } },
          ],
        },
        { OR: [{ maxReminderDate: null }, { maxReminderDate: { gt: now } }] },
      ],
    },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
    },
  });

  return invoices.map((invoice) => ({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    dueDate: invoice.dueDate?.toISOString() || null,
    balance: invoice.balance,
    total: invoice.total,
    customer: {
      id: invoice.customer.id,
      name: invoice.customer.name,
      phone: invoice.customer.phone,
    },
  }));
}

async function markInvoiceReminderSent(invoiceId: string) {
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { reminderSent: true, reminderSentAt: new Date() },
  });
}

// Notification Management
async function createNotification(data: {
  type: string;
  recipientPhone: string;
  message: string;
  status: string;
  metadata: Record<string, unknown>;
}) {
  await prisma.notification.create({ data });
}

async function updateNotificationStatus(
  recipientPhone: string,
  tripId: string,
  status: string,
  responseData?: string
) {
  await prisma.notification.updateMany({
    where: {
      recipientPhone,
      metadata: { path: ["tripId"], equals: tripId },
      status: "pending",
    },
    data: {
      status,
      responseAt: new Date(),
      ...(responseData && { responseData }),
    },
  });
}

// Daily Summary Data
async function getDailySummaryData(organizationId: string) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const [
    tripsToday,
    tripsInProgress,
    overdueInvoices,
    paymentsToday,
    activeDrivers,
  ] = await Promise.all([
    prisma.trip.count({
      where: { organizationId, scheduledDate: { gte: startOfToday, lte: endOfToday } },
    }),
    prisma.trip.count({
      where: { organizationId, status: "in_progress" },
    }),
    prisma.invoice.count({
      where: { organizationId, dueDate: { lt: startOfToday }, balance: { gt: 0 }, status: { notIn: ["paid", "cancelled"] } },
    }),
    prisma.payment.aggregate({
      where: { paymentDate: { gte: startOfToday, lte: endOfToday } },
      _sum: { amount: true },
    }),
    prisma.driver.count({
      where: { organizationId, status: "active" },
    }),
  ]);

  return {
    tripsToday,
    tripsInProgress,
    overdueInvoices,
    paymentsToday: paymentsToday._sum.amount || 0,
    activeDrivers,
  };
}

// Driver Expiration Check
async function getDriversWithExpiringDocuments(organizationId: string, daysAhead: number = 30) {
  const checkDate = new Date();
  checkDate.setDate(checkDate.getDate() + daysAhead);

  const drivers = await prisma.driver.findMany({
    where: {
      organizationId,
      status: "active",
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
    },
  });

  return drivers.map((driver) => ({
    id: driver.id,
    firstName: driver.firstName,
    lastName: driver.lastName,
    phone: driver.phone,
    email: driver.email,
  }));
}

// Trip Details for Message
async function getTripDetailsForMessage(tripId: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      driver: { select: { firstName: true, lastName: true, phone: true, email: true } },
      truck: { select: { registrationNo: true } },
      customer: { select: { name: true } },
    },
  });

  if (!trip) return null;

  return {
    id: trip.id,
    originCity: trip.originCity,
    destinationCity: trip.destinationCity,
    scheduledDate: trip.scheduledDate.toISOString(),
    loadDescription: trip.loadDescription,
    driver: {
      firstName: trip.driver.firstName,
      lastName: trip.driver.lastName,
      phone: trip.driver.phone,
      email: trip.driver.email,
    },
    truck: { registrationNo: trip.truck.registrationNo },
    customer: trip.customer ? { name: trip.customer.name } : null,
  };
}

// Update Trip Status
async function updateTripStatus(tripId: string, status: string, additionalData?: Record<string, unknown>) {
  await prisma.trip.update({
    where: { id: tripId },
    data: {
      status,
      ...(additionalData || {}),
    },
  });
}

export async function POST(request: NextRequest) {
  const validation = validateAgentRequest(request);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 401 });
  }

  const { organizationId } = validation;
  if (!organizationId) {
    return NextResponse.json({ error: "Missing organization ID" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "get_upcoming_trips": {
        const trips = await getUpcomingTripsForNotification(organizationId, body.daysAhead || 1);
        return NextResponse.json({ trips });
      }

      case "mark_trip_notified": {
        await markTripNotified(body.tripId);
        return NextResponse.json({ success: true });
      }

      case "get_overdue_invoices": {
        const invoices = await getOverdueInvoicesForReminder(organizationId, body.minDaysOverdue || 1);
        return NextResponse.json({ invoices });
      }

      case "mark_invoice_reminder_sent": {
        await markInvoiceReminderSent(body.invoiceId);
        return NextResponse.json({ success: true });
      }

      case "create_notification": {
        await createNotification(body.notification);
        return NextResponse.json({ success: true });
      }

      case "update_notification_status": {
        await updateNotificationStatus(
          body.recipientPhone,
          body.tripId,
          body.status,
          body.responseData
        );
        return NextResponse.json({ success: true });
      }

      case "get_daily_summary": {
        const summary = await getDailySummaryData(organizationId);
        return NextResponse.json({ summary });
      }

      case "get_drivers_expiring_docs": {
        const drivers = await getDriversWithExpiringDocuments(organizationId, body.daysAhead || 30);
        return NextResponse.json({ drivers });
      }

      case "get_trip_for_message": {
        const trip = await getTripDetailsForMessage(body.tripId);
        return NextResponse.json({ trip });
      }

      case "update_trip_status": {
        await updateTripStatus(body.tripId, body.status, body.additionalData);
        return NextResponse.json({ success: true });
      }

      case "validate_member_access": {
        const member = await prisma.member.findFirst({
          where: {
            userId: body.userId,
            organizationId: body.checkOrganizationId,
          },
        });
        return NextResponse.json({ success: true, hasAccess: !!member });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Workflows API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
