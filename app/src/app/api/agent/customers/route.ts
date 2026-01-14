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
      case "list":
        return await listCustomers(organizationId, params);
      case "details":
        return await getCustomerDetails(organizationId, params);
      case "balance":
        return await getCustomerBalance(organizationId, params);
      case "summary":
        return await getCustomerSummary(organizationId);
      default:
        return agentErrorResponse("Invalid action", 400);
    }
  } catch (error) {
    console.error("Agent customers API error:", error);
    return agentErrorResponse("Internal server error", 500);
  }
}

async function listCustomers(organizationId: string, params: { status?: string; search?: string }) {
  const { status, search } = params;

  const customers = await prisma.customer.findMany({
    where: {
      organizationId,
      ...(status && { status }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ],
      }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      _count: {
        select: {
          trips: true,
          invoices: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return agentJsonResponse({
    customers: customers.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      status: c.status,
      tripCount: c._count.trips,
      invoiceCount: c._count.invoices,
      createdAt: c.createdAt.toISOString(),
    })),
    total: customers.length,
  });
}

async function getCustomerDetails(organizationId: string, params: { customerId: string }) {
  const { customerId } = params;

  if (!customerId) {
    return agentErrorResponse("Customer ID required", 400);
  }

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId },
    include: {
      trips: {
        take: 10,
        orderBy: { scheduledDate: "desc" },
        select: {
          id: true,
          originCity: true,
          destinationCity: true,
          status: true,
          revenue: true,
          scheduledDate: true,
        },
      },
      invoices: {
        take: 10,
        orderBy: { issueDate: "desc" },
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          balance: true,
          status: true,
          dueDate: true,
        },
      },
    },
  });

  if (!customer) {
    return agentErrorResponse("Customer not found", 404);
  }

  // Calculate totals
  const invoiceAggregates = await prisma.invoice.aggregate({
    where: { customerId },
    _sum: {
      total: true,
      balance: true,
    },
  });

  const tripCount = await prisma.trip.count({
    where: { customerId },
  });

  return agentJsonResponse({
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      status: customer.status,
      createdAt: customer.createdAt.toISOString(),
    },
    stats: {
      totalTrips: tripCount,
      totalInvoiced: invoiceAggregates._sum.total || 0,
      outstandingBalance: invoiceAggregates._sum.balance || 0,
    },
    recentTrips: customer.trips.map((t) => ({
      id: t.id,
      route: `${t.originCity} → ${t.destinationCity}`,
      status: t.status,
      revenue: t.revenue,
      date: t.scheduledDate.toISOString(),
    })),
    recentInvoices: customer.invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      total: inv.total,
      balance: inv.balance,
      status: inv.status,
      dueDate: inv.dueDate?.toISOString() ?? null,
    })),
  });
}

async function getCustomerBalance(organizationId: string, params: { customerId: string }) {
  const { customerId } = params;

  if (!customerId) {
    return agentErrorResponse("Customer ID required", 400);
  }

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId },
    select: { id: true, name: true },
  });

  if (!customer) {
    return agentErrorResponse("Customer not found", 404);
  }

  const invoices = await prisma.invoice.findMany({
    where: { customerId },
    select: {
      id: true,
      invoiceNumber: true,
      total: true,
      amountPaid: true,
      balance: true,
      status: true,
      dueDate: true,
    },
    orderBy: { dueDate: "asc" },
  });

  const now = new Date();
  const overdueInvoices = invoices.filter(
    (inv) => inv.balance > 0 && inv.dueDate !== null && new Date(inv.dueDate) < now && inv.status !== "cancelled"
  );

  const totals = invoices.reduce(
    (acc, inv) => ({
      total: acc.total + inv.total,
      paid: acc.paid + inv.amountPaid,
      balance: acc.balance + inv.balance,
    }),
    { total: 0, paid: 0, balance: 0 }
  );

  return agentJsonResponse({
    customer: {
      id: customer.id,
      name: customer.name,
    },
    balance: {
      totalInvoiced: totals.total,
      totalPaid: totals.paid,
      outstanding: totals.balance,
      overdueAmount: overdueInvoices.reduce((sum, inv) => sum + inv.balance, 0),
      overdueCount: overdueInvoices.length,
    },
    invoices: invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      total: inv.total,
      balance: inv.balance,
      status: inv.status,
      dueDate: inv.dueDate?.toISOString() ?? null,
      isOverdue: inv.balance > 0 && inv.dueDate !== null && new Date(inv.dueDate) < now && inv.status !== "cancelled",
    })),
  });
}

async function getCustomerSummary(organizationId: string) {
  const [total, active, inactive] = await Promise.all([
    prisma.customer.count({ where: { organizationId } }),
    prisma.customer.count({ where: { organizationId, status: "active" } }),
    prisma.customer.count({ where: { organizationId, status: "inactive" } }),
  ]);

  // Get top customers by revenue
  const topCustomers = await prisma.customer.findMany({
    where: { organizationId },
    select: {
      id: true,
      name: true,
      _count: { select: { trips: true } },
      invoices: {
        select: { total: true },
      },
    },
    take: 5,
  });

  const topCustomersWithRevenue = topCustomers
    .map((c) => ({
      id: c.id,
      name: c.name,
      tripCount: c._count.trips,
      totalRevenue: c.invoices.reduce((sum, inv) => sum + inv.total, 0),
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 5);

  return agentJsonResponse({
    summary: {
      total,
      active,
      inactive,
    },
    topCustomers: topCustomersWithRevenue,
  });
}
