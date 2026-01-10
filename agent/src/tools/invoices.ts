import { z } from "zod";
import prisma from "../lib/prisma";

/**
 * Tool to list invoices with filtering options
 */
export const listInvoices = {
  definition: {
    name: "list_invoices",
    description: "List invoices with optional filtering by status, customer, or date range.",
    inputSchema: z.object({
      organizationId: z.string().describe("The organization ID"),
      status: z
        .enum(["draft", "sent", "paid", "partial", "overdue", "cancelled"])
        .optional()
        .describe("Filter by invoice status"),
      customerId: z.string().optional().describe("Filter by customer ID"),
      startDate: z.string().optional().describe("Filter invoices from this issue date"),
      endDate: z.string().optional().describe("Filter invoices until this issue date"),
      limit: z.number().optional().default(20).describe("Maximum number of invoices to return"),
    }),
  },
  execute: async (params: { organizationId: string; status?: string; customerId?: string; startDate?: string; endDate?: string; limit?: number }) => {
    const { organizationId, status, customerId, startDate, endDate, limit = 20 } = params;

    const where = {
      organizationId,
      ...(status && { status }),
      ...(customerId && { customerId }),
      ...(startDate && { issueDate: { gte: new Date(startDate) } }),
      ...(endDate && { issueDate: { lte: new Date(endDate) } }),
    };

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
      totalAmount: invoices.reduce((sum: number, inv: any) => sum + inv.total, 0),
      totalPaid: invoices.reduce((sum: number, inv: any) => sum + inv.amountPaid, 0),
      totalOutstanding: invoices.reduce((sum: number, inv: any) => sum + inv.balance, 0),
    };

    return {
      invoices: invoices.map((invoice: any) => ({
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
    };
  },
};

/**
 * Tool to get detailed invoice information
 */
export const getInvoiceDetails = {
  definition: {
    name: "get_invoice_details",
    description: "Get detailed information about a specific invoice including line items and payment history.",
    inputSchema: z.object({
      invoiceId: z.string().optional().describe("The invoice ID"),
      invoiceNumber: z.string().optional().describe("The invoice number"),
      organizationId: z.string().describe("The organization ID"),
    }),
  },
  execute: async (params: { invoiceId?: string; invoiceNumber?: string; organizationId: string }) => {
    const { invoiceId, invoiceNumber, organizationId } = params;

    if (!invoiceId && !invoiceNumber) {
      return { invoice: null };
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
      return { invoice: null };
    }

    return {
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
        lineItems: invoice.lineItems.map((item: any) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
        payments: invoice.payments.map((payment: any) => ({
          id: payment.id,
          amount: payment.amount,
          method: payment.method,
          paymentDate: payment.paymentDate.toISOString(),
          reference: payment.reference,
        })),
        notes: invoice.notes,
      },
    };
  },
};

/**
 * Tool to get overdue invoices
 */
export const getOverdueInvoices = {
  definition: {
    name: "get_overdue_invoices",
    description: "Get all overdue invoices that need attention.",
    inputSchema: z.object({
      organizationId: z.string().describe("The organization ID"),
    }),
  },
  execute: async (params: { organizationId: string }) => {
    const { organizationId } = params;
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

    return {
      overdueInvoices: invoices.map((invoice: any) => {
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
      totalOverdue: invoices.reduce((sum: number, inv: any) => sum + inv.balance, 0),
    };
  },
};

/**
 * Tool to get customer balance and statement
 */
export const getCustomerBalance = {
  definition: {
    name: "get_customer_balance",
    description: "Get a customer's outstanding balance and recent invoice/payment activity.",
    inputSchema: z.object({
      customerId: z.string().optional().describe("The customer ID"),
      customerName: z.string().optional().describe("The customer name (partial match)"),
      organizationId: z.string().describe("The organization ID"),
    }),
  },
  execute: async (params: { customerId?: string; customerName?: string; organizationId: string }) => {
    const { customerId, customerName, organizationId } = params;

    if (!customerId && !customerName) {
      return { customer: null };
    }

    const customer = await prisma.customer.findFirst({
      where: {
        organizationId,
        ...(customerId
          ? { id: customerId }
          : { name: { contains: customerName, mode: "insensitive" } }),
      },
      include: {
        invoices: {
          orderBy: { issueDate: "desc" },
          take: 10,
        },
        payments: {
          orderBy: { paymentDate: "desc" },
          take: 10,
        },
      },
    });

    if (!customer) {
      return { customer: null };
    }

    const totalInvoiced = customer.invoices.reduce((sum: number, inv: any) => sum + inv.total, 0);
    const totalPaid = customer.payments.reduce((sum: number, p: any) => sum + p.amount, 0);

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        balance: customer.balance,
        creditLimit: customer.creditLimit,
        paymentTerms: customer.paymentTerms,
        recentInvoices: customer.invoices.map((invoice: any) => ({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          total: invoice.total,
          balance: invoice.balance,
          status: invoice.status,
          issueDate: invoice.issueDate.toISOString(),
          dueDate: invoice.dueDate.toISOString(),
        })),
        recentPayments: customer.payments.map((payment: any) => ({
          id: payment.id,
          amount: payment.amount,
          method: payment.method,
          paymentDate: payment.paymentDate.toISOString(),
        })),
        totalInvoiced,
        totalPaid,
      },
    };
  },
};

/**
 * Tool to get invoice statistics
 */
export const getInvoiceStats = {
  definition: {
    name: "get_invoice_stats",
    description: "Get invoice statistics including totals by status, revenue, and collection metrics.",
    inputSchema: z.object({
      organizationId: z.string().describe("The organization ID"),
      startDate: z.string().optional().describe("Start date for analysis"),
      endDate: z.string().optional().describe("End date for analysis"),
    }),
  },
  execute: async (params: { organizationId: string; startDate?: string; endDate?: string }) => {
    const { organizationId, startDate, endDate } = params;

    const dateFilter: Record<string, unknown> = {
      ...(startDate && { gte: new Date(startDate) }),
      ...(endDate && { lte: new Date(endDate) }),
    };

    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId,
        ...(Object.keys(dateFilter).length > 0 && { issueDate: dateFilter }),
      },
      include: {
        customer: true,
      },
    });

    const now = new Date();
    const stats = {
      totalInvoices: invoices.length,
      draft: invoices.filter((i: any) => i.status === "draft").length,
      sent: invoices.filter((i: any) => i.status === "sent").length,
      paid: invoices.filter((i: any) => i.status === "paid").length,
      partial: invoices.filter((i: any) => i.status === "partial").length,
      overdue: invoices.filter(
        (i: any) => i.dueDate < now && i.balance > 0 && i.status !== "cancelled"
      ).length,
      cancelled: invoices.filter((i: any) => i.status === "cancelled").length,
      totalInvoiced: invoices.reduce((sum: number, i: any) => sum + i.total, 0),
      totalCollected: invoices.reduce((sum: number, i: any) => sum + i.amountPaid, 0),
      totalOutstanding: invoices.reduce((sum: number, i: any) => sum + i.balance, 0),
      collectionRate: 0,
    };
    stats.collectionRate =
      stats.totalInvoiced > 0
        ? Math.round((stats.totalCollected / stats.totalInvoiced) * 100)
        : 0;

    // Calculate top customers
    const customerMap = new Map<
      string,
      {
        name: string;
        count: number;
        invoiced: number;
        paid: number;
        balance: number;
      }
    >();
    invoices.forEach((invoice: any) => {
      const existing = customerMap.get(invoice.customerId) || {
        name: invoice.customer.name,
        count: 0,
        invoiced: 0,
        paid: 0,
        balance: 0,
      };
      customerMap.set(invoice.customerId, {
        name: invoice.customer.name,
        count: existing.count + 1,
        invoiced: existing.invoiced + invoice.total,
        paid: existing.paid + invoice.amountPaid,
        balance: existing.balance + invoice.balance,
      });
    });

    const topCustomers = Array.from(customerMap.entries())
      .map(([customerId, data]) => ({
        customerId,
        customerName: data.name,
        invoiceCount: data.count,
        totalInvoiced: data.invoiced,
        totalPaid: data.paid,
        balance: data.balance,
      }))
      .sort((a, b) => b.totalInvoiced - a.totalInvoiced)
      .slice(0, 5);

    return { stats, topCustomers };
  },
};

// Export all invoice tools
export const invoiceTools = {
  list_invoices: listInvoices,
  get_invoice_details: getInvoiceDetails,
  get_overdue_invoices: getOverdueInvoices,
  get_customer_balance: getCustomerBalance,
  get_invoice_stats: getInvoiceStats,
};
