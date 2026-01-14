import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAgentAuth, getOrganizationId, agentJsonResponse, agentErrorResponse, handleCorsPreflightRequest } from "@/lib/agent-auth";

export async function OPTIONS() {
  return handleCorsPreflightRequest();
}

export async function POST(request: NextRequest) {
  const authError = withAgentAuth(request);
  if (authError) return authError;

  const organizationId = getOrganizationId(request);
  if (!organizationId) {
    return agentErrorResponse("Organization ID required", 400);
  }

  try {
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case "summary":
        return await getDashboardSummary(organizationId);
      case "alerts":
        return await getAlerts(organizationId);
      case "recent-activity":
        return await getRecentActivity(organizationId, params);
      default:
        return agentErrorResponse("Invalid action", 400);
    }
  } catch (error) {
    console.error("Agent dashboard API error:", error);
    return agentErrorResponse("Internal server error", 500);
  }
}

async function getDashboardSummary(organizationId: string) {
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get fleet summary
  const [totalTrucks, activeTrucks, trucksInRepair] = await Promise.all([
    prisma.truck.count({ where: { organizationId } }),
    prisma.truck.count({ where: { organizationId, status: "active" } }),
    prisma.truck.count({ where: { organizationId, status: "in_repair" } }),
  ]);

  // Get driver summary
  const [totalDrivers, activeDrivers, driversOnLeave] = await Promise.all([
    prisma.driver.count({ where: { organizationId } }),
    prisma.driver.count({ where: { organizationId, status: "active" } }),
    prisma.driver.count({ where: { organizationId, status: "on_leave" } }),
  ]);

  // Get trip summary for this month
  const trips = await prisma.trip.findMany({
    where: {
      organizationId,
      scheduledDate: { gte: thirtyDaysAgo },
    },
  });

  const tripStats = {
    total: trips.length,
    completed: trips.filter((t) => t.status === "completed").length,
    inProgress: trips.filter((t) => t.status === "in_progress").length,
    scheduled: trips.filter((t) => t.status === "scheduled").length,
    totalRevenue: trips.reduce((sum, t) => sum + t.revenue, 0),
  };

  // Get invoice summary
  const invoices = await prisma.invoice.aggregate({
    where: { organizationId },
    _sum: {
      total: true,
      amountPaid: true,
      balance: true,
    },
  });

  const overdueCount = await prisma.invoice.count({
    where: {
      organizationId,
      dueDate: { lt: now },
      balance: { gt: 0 },
      status: { notIn: ["paid", "cancelled"] },
    },
  });

  // Get expenses for this month
  const expenses = await prisma.expense.aggregate({
    where: {
      organizationId,
      date: { gte: thirtyDaysAgo },
    },
    _sum: { amount: true },
  });

  return agentJsonResponse({
    fleet: {
      total: totalTrucks,
      active: activeTrucks,
      inRepair: trucksInRepair,
    },
    drivers: {
      total: totalDrivers,
      active: activeDrivers,
      onLeave: driversOnLeave,
    },
    trips: tripStats,
    invoices: {
      totalAmount: invoices._sum.total || 0,
      totalPaid: invoices._sum.amountPaid || 0,
      totalOutstanding: invoices._sum.balance || 0,
      overdueCount,
    },
    expenses: {
      thisMonth: expenses._sum.amount || 0,
    },
    period: {
      start: thirtyDaysAgo.toISOString(),
      end: now.toISOString(),
    },
  });
}

async function getAlerts(organizationId: string) {
  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  // Overdue invoices
  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      organizationId,
      dueDate: { lt: now },
      balance: { gt: 0 },
      status: { notIn: ["paid", "cancelled"] },
    },
    include: { customer: { select: { name: true } } },
    take: 5,
    orderBy: { dueDate: "asc" },
  });

  // Drivers with contracts ending soon
  const expiringContracts = await prisma.driver.findMany({
    where: {
      organizationId,
      status: { in: ["active", "on_leave"] },
      endDate: { 
        lte: thirtyDaysFromNow,
        not: null,
      },
    },
    take: 5,
    orderBy: { endDate: "asc" },
  });

  // Trucks needing attention (in repair)
  const trucksInRepair = await prisma.truck.findMany({
    where: {
      organizationId,
      status: "in_repair",
    },
    take: 5,
  });

  // Trips scheduled for today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todaysTrips = await prisma.trip.count({
    where: {
      organizationId,
      scheduledDate: { gte: today, lt: tomorrow },
      status: "scheduled",
    },
  });

  return agentJsonResponse({
    alerts: {
      overdueInvoices: overdueInvoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customer.name,
        balance: inv.balance,
        daysOverdue: Math.ceil((now.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
      })),
      expiringContracts: expiringContracts.map((driver) => ({
        id: driver.id,
        name: `${driver.firstName} ${driver.lastName}`,
        endDate: driver.endDate?.toISOString(),
        daysUntilExpiry: driver.endDate
          ? Math.ceil((driver.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null,
      })),
      trucksInRepair: trucksInRepair.map((truck) => ({
        id: truck.id,
        registrationNo: truck.registrationNo,
      })),
      todaysTripsCount: todaysTrips,
    },
    summary: {
      overdueInvoicesCount: overdueInvoices.length,
      expiringContractsCount: expiringContracts.length,
      trucksInRepairCount: trucksInRepair.length,
      todaysTripsCount: todaysTrips,
    },
  });
}

async function getRecentActivity(organizationId: string, params: { limit?: number }) {
  const { limit = 10 } = params;

  // Get recent trips
  const recentTrips = await prisma.trip.findMany({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      truck: { select: { registrationNo: true } },
      driver: { select: { firstName: true, lastName: true } },
    },
  });

  // Get recent payments
  const recentPayments = await prisma.payment.findMany({
    where: {
      invoice: { organizationId },
    },
    orderBy: { paymentDate: "desc" },
    take: limit,
    include: {
      invoice: {
        select: { invoiceNumber: true, customer: { select: { name: true } } },
      },
    },
  });

  // Get recent expenses
  const recentExpenses = await prisma.expense.findMany({
    where: { organizationId },
    orderBy: { date: "desc" },
    take: limit,
    include: {
      category: { select: { name: true } },
    },
  });

  return agentJsonResponse({
    recentTrips: recentTrips.map((trip) => ({
      id: trip.id,
      type: "trip",
      description: `${trip.originCity} → ${trip.destinationCity}`,
      truck: trip.truck.registrationNo,
      driver: `${trip.driver.firstName} ${trip.driver.lastName}`,
      status: trip.status,
      date: trip.updatedAt.toISOString(),
    })),
    recentPayments: recentPayments.map((payment) => ({
      id: payment.id,
      type: "payment",
      invoiceNumber: payment.invoice.invoiceNumber,
      customerName: payment.invoice.customer.name,
      amount: payment.amount,
      method: payment.method,
      date: payment.paymentDate.toISOString(),
    })),
    recentExpenses: recentExpenses.map((expense) => ({
      id: expense.id,
      type: "expense",
      category: expense.category?.name || "Uncategorized",
      amount: expense.amount,
      description: expense.description,
      date: expense.date.toISOString(),
    })),
  });
}
