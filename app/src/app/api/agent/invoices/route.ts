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
        return await listInvoices(organizationId, params);
      case "details":
        return await getInvoiceDetails(organizationId, params);
      case "overdue":
        return await getOverdueInvoices(organizationId);
      case "customer-balance":
        return await getCustomerBalance(organizationId, params);
      case "summary":
        return await getInvoiceSummary(organizationId);
      default:
        return agentErrorResponse("Invalid action", 400);
    }
  } catch (error) {
    console.error("Agent invoices API error:", error);
    return agentErrorResponse("Internal server error", 500);
  }
}

async function listInvoices(organizationId: string, params: { 
  status?: string; 
  customerId?: string; 
  startDate?: string; 
  endDate?: string; 
  limit?: number 
}) {
  const { status, customerId, startDate, endDate, limit = 20 } = params;

  const where: Record<string, unknown> = { organizationId };
  if (status) where.status = status;
  if (customerId) where.customerId = customerId;
  if (startDate) where.issueDate = { ...(where.issueDate as object || {}), gte: new Date(startDate) };
  if (endDate) where.issueDate = { ...(where.issueDate as object || {}), lte: new Date(endDate) };

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      take: limit,
      include: {
        customer: { select: { name: true } },
      },
      orderBy: { issueDate: "desc" },
    }),
    prisma.invoice.count({ where }),
  ]);

  const now = new Date();
  const summary = {
    totalAmount: invoices.reduce((sum, inv) => sum + inv.total, 0),
    totalPaid: invoices.reduce((sum, inv) => sum + inv.amountPaid, 0),
    totalOutstanding: invoices.reduce((sum, inv) => sum + inv.balance, 0),
  };

  return agentJsonResponse({
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customer.name,
      total: invoice.total,
      amountPaid: invoice.amountPaid,
      balance: invoice.balance,
      status: invoice.status,
      issueDate: invoice.issueDate.toISOString(),
      dueDate: invoice.dueDate.toISOString(),
      isOverdue: invoice.dueDate < now && invoice.balance > 0,
    })),
    total,
    summary,
  });
}

async function getInvoiceDetails(organizationId: string, params: { invoiceId?: string; invoiceNumber?: string }) {
  const { invoiceId, invoiceNumber } = params;

  if (!invoiceId && !invoiceNumber) {
    return agentJsonResponse({ invoice: null });
  }

  const invoice = await prisma.invoice.findFirst({
    where: {
      organizationId,
      ...(invoiceId ? { id: invoiceId } : { invoiceNumber }),
    },
    include: {
      customer: true,
      lineItems: true,
      payments: {
        orderBy: { paymentDate: "desc" },
      },
    },
  });

  if (!invoice) {
    return agentJsonResponse({ invoice: null });
  }

  return agentJsonResponse({
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customer: {
        id: invoice.customer.id,
        name: invoice.customer.name,
        email: invoice.customer.email,
        phone: invoice.customer.phone,
      },
      subtotal: invoice.subtotal,
      tax: invoice.tax,
      total: invoice.total,
      amountPaid: invoice.amountPaid,
      balance: invoice.balance,
      status: invoice.status,
      issueDate: invoice.issueDate.toISOString(),
      dueDate: invoice.dueDate.toISOString(),
      lineItems: invoice.lineItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
      payments: invoice.payments.map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        method: payment.method,
        paymentDate: payment.paymentDate.toISOString(),
        reference: payment.reference,
      })),
      notes: invoice.notes,
    },
  });
}

async function getOverdueInvoices(organizationId: string) {
  const now = new Date();

  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId,
      dueDate: { lt: now },
      balance: { gt: 0 },
      status: { notIn: ["paid", "cancelled"] },
    },
    include: {
      customer: true,
    },
    orderBy: { dueDate: "asc" },
  });

  return agentJsonResponse({
    overdueInvoices: invoices.map((invoice) => {
      const daysOverdue = Math.ceil(
        (now.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customer.name,
        customerPhone: invoice.customer.phone,
        total: invoice.total,
        balance: invoice.balance,
        dueDate: invoice.dueDate.toISOString(),
        daysOverdue,
        reminderSent: invoice.reminderSent,
      };
    }),
    totalOverdue: invoices.reduce((sum, inv) => sum + inv.balance, 0),
    count: invoices.length,
  });
}

async function getCustomerBalance(organizationId: string, params: { customerId?: string; customerName?: string }) {
  const { customerId, customerName } = params;

  if (!customerId && !customerName) {
    return agentJsonResponse({ customer: null });
  }

  const customer = await prisma.customer.findFirst({
    where: {
      organizationId,
      ...(customerId ? { id: customerId } : { name: { contains: customerName, mode: "insensitive" } }),
    },
    include: {
      invoices: {
        orderBy: { issueDate: "desc" },
      },
    },
  });

  if (!customer) {
    return agentJsonResponse({ customer: null });
  }

  const totalInvoiced = customer.invoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalPaid = customer.invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
  const totalBalance = customer.invoices.reduce((sum, inv) => sum + inv.balance, 0);
  const overdueInvoices = customer.invoices.filter(
    (inv) => inv.dueDate < new Date() && inv.balance > 0
  );

  return agentJsonResponse({
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      balance: customer.balance,
      totalInvoiced,
      totalPaid,
      totalBalance,
      invoiceCount: customer.invoices.length,
      overdueCount: overdueInvoices.length,
      overdueAmount: overdueInvoices.reduce((sum, inv) => sum + inv.balance, 0),
      recentInvoices: customer.invoices.slice(0, 5).map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        total: inv.total,
        balance: inv.balance,
        status: inv.status,
        dueDate: inv.dueDate.toISOString(),
      })),
    },
  });
}

async function getInvoiceSummary(organizationId: string) {
  const now = new Date();
  
  const [total, draft, sent, paid, partial, overdue] = await Promise.all([
    prisma.invoice.count({ where: { organizationId } }),
    prisma.invoice.count({ where: { organizationId, status: "draft" } }),
    prisma.invoice.count({ where: { organizationId, status: "sent" } }),
    prisma.invoice.count({ where: { organizationId, status: "paid" } }),
    prisma.invoice.count({ where: { organizationId, status: "partial" } }),
    prisma.invoice.count({ 
      where: { 
        organizationId, 
        dueDate: { lt: now },
        balance: { gt: 0 },
        status: { notIn: ["paid", "cancelled"] }
      } 
    }),
  ]);

  const amounts = await prisma.invoice.aggregate({
    where: { organizationId },
    _sum: {
      total: true,
      amountPaid: true,
      balance: true,
    },
  });

  return agentJsonResponse({
    summary: {
      total,
      draft,
      sent,
      paid,
      partial,
      overdue,
      totalAmount: amounts._sum.total || 0,
      totalPaid: amounts._sum.amountPaid || 0,
      totalOutstanding: amounts._sum.balance || 0,
    },
  });
}
