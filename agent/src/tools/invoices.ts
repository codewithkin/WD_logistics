import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import prisma from "../lib/prisma";

/**
 * Tool to list invoices with filtering options
 */
export const listInvoices = createTool({
  id: "list-invoices",
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
  outputSchema: z.object({
    invoices: z.array(
      z.object({
        id: z.string(),
        invoiceNumber: z.string(),
        customerName: z.string(),
        total: z.number(),
        amountPaid: z.number(),
        balance: z.number(),
        status: z.string(),
        issueDate: z.string(),
        dueDate: z.string(),
        isOverdue: z.boolean(),
      })
    ),
    total: z.number(),
    summary: z.object({
      totalAmount: z.number(),
      totalPaid: z.number(),
      totalOutstanding: z.number(),
    }),
  }),
  execute: async ({ context }) => {
    const { organizationId, status, customerId, startDate, endDate, limit } = context;

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
      totalAmount: invoices.reduce((sum, inv) => sum + inv.total, 0),
      totalPaid: invoices.reduce((sum, inv) => sum + inv.amountPaid, 0),
      totalOutstanding: invoices.reduce((sum, inv) => sum + inv.balance, 0),
    };

    return {
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
    };
  },
});

/**
 * Tool to get detailed invoice information
 */
export const getInvoiceDetails = createTool({
  id: "get-invoice-details",
  description: "Get detailed information about a specific invoice including line items and payment history.",
  inputSchema: z.object({
    invoiceId: z.string().optional().describe("The invoice ID"),
    invoiceNumber: z.string().optional().describe("The invoice number"),
    organizationId: z.string().describe("The organization ID"),
  }),
  outputSchema: z.object({
    invoice: z
      .object({
        id: z.string(),
        invoiceNumber: z.string(),
        customer: z.object({
          id: z.string(),
          name: z.string(),
          email: z.string().nullable(),
          phone: z.string().nullable(),
        }),
        subtotal: z.number(),
        tax: z.number(),
        total: z.number(),
        amountPaid: z.number(),
        balance: z.number(),
        status: z.string(),
        issueDate: z.string(),
        dueDate: z.string(),
        lineItems: z.array(
          z.object({
            description: z.string(),
            quantity: z.number(),
            unitPrice: z.number(),
            total: z.number(),
          })
        ),
        payments: z.array(
          z.object({
            id: z.string(),
            amount: z.number(),
            method: z.string(),
            paymentDate: z.string(),
            reference: z.string().nullable(),
          })
        ),
        notes: z.string().nullable(),
      })
      .nullable(),
  }),
  execute: async ({ context }) => {
    const { invoiceId, invoiceNumber, organizationId } = context;

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
    };
  },
});

/**
 * Tool to get overdue invoices
 */
export const getOverdueInvoices = createTool({
  id: "get-overdue-invoices",
  description: "Get all overdue invoices that need attention.",
  inputSchema: z.object({
    organizationId: z.string().describe("The organization ID"),
  }),
  outputSchema: z.object({
    overdueInvoices: z.array(
      z.object({
        id: z.string(),
        invoiceNumber: z.string(),
        customerName: z.string(),
        customerPhone: z.string().nullable(),
        total: z.number(),
        balance: z.number(),
        dueDate: z.string(),
        daysOverdue: z.number(),
        reminderSent: z.boolean(),
      })
    ),
    totalOverdue: z.number(),
  }),
  execute: async ({ context }) => {
    const { organizationId } = context;
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
    };
  },
});

/**
 * Tool to get customer balance and statement
 */
export const getCustomerBalance = createTool({
  id: "get-customer-balance",
  description: "Get a customer's outstanding balance and recent invoice/payment activity.",
  inputSchema: z.object({
    customerId: z.string().optional().describe("The customer ID"),
    customerName: z.string().optional().describe("The customer name (partial match)"),
    organizationId: z.string().describe("The organization ID"),
  }),
  outputSchema: z.object({
    customer: z
      .object({
        id: z.string(),
        name: z.string(),
        email: z.string().nullable(),
        phone: z.string().nullable(),
        balance: z.number(),
        creditLimit: z.number().nullable(),
        paymentTerms: z.number(),
        recentInvoices: z.array(
          z.object({
            id: z.string(),
            invoiceNumber: z.string(),
            total: z.number(),
            balance: z.number(),
            status: z.string(),
            issueDate: z.string(),
            dueDate: z.string(),
          })
        ),
        recentPayments: z.array(
          z.object({
            id: z.string(),
            amount: z.number(),
            method: z.string(),
            paymentDate: z.string(),
          })
        ),
        totalInvoiced: z.number(),
        totalPaid: z.number(),
      })
      .nullable(),
  }),
  execute: async ({ context }) => {
    const { customerId, customerName, organizationId } = context;

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

    const totalInvoiced = customer.invoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalPaid = customer.payments.reduce((sum, p) => sum + p.amount, 0);

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        balance: customer.balance,
        creditLimit: customer.creditLimit,
        paymentTerms: customer.paymentTerms,
        recentInvoices: customer.invoices.map((invoice) => ({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          total: invoice.total,
          balance: invoice.balance,
          status: invoice.status,
          issueDate: invoice.issueDate.toISOString(),
          dueDate: invoice.dueDate.toISOString(),
        })),
        recentPayments: customer.payments.map((payment) => ({
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
});

/**
 * Tool to get invoice statistics
 */
export const getInvoiceStats = createTool({
  id: "get-invoice-stats",
  description: "Get invoice statistics including totals by status, revenue, and collection metrics.",
  inputSchema: z.object({
    organizationId: z.string().describe("The organization ID"),
    startDate: z.string().optional().describe("Start date for analysis"),
    endDate: z.string().optional().describe("End date for analysis"),
  }),
  outputSchema: z.object({
    stats: z.object({
      totalInvoices: z.number(),
      draft: z.number(),
      sent: z.number(),
      paid: z.number(),
      partial: z.number(),
      overdue: z.number(),
      cancelled: z.number(),
      totalInvoiced: z.number(),
      totalCollected: z.number(),
      totalOutstanding: z.number(),
      collectionRate: z.number(),
    }),
    topCustomers: z.array(
      z.object({
        customerId: z.string(),
        customerName: z.string(),
        invoiceCount: z.number(),
        totalInvoiced: z.number(),
        totalPaid: z.number(),
        balance: z.number(),
      })
    ),
  }),
  execute: async ({ context }) => {
    const { organizationId, startDate, endDate } = context;

    const dateFilter = {
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
      draft: invoices.filter((i) => i.status === "draft").length,
      sent: invoices.filter((i) => i.status === "sent").length,
      paid: invoices.filter((i) => i.status === "paid").length,
      partial: invoices.filter((i) => i.status === "partial").length,
      overdue: invoices.filter(
        (i) => i.dueDate < now && i.balance > 0 && i.status !== "cancelled"
      ).length,
      cancelled: invoices.filter((i) => i.status === "cancelled").length,
      totalInvoiced: invoices.reduce((sum, i) => sum + i.total, 0),
      totalCollected: invoices.reduce((sum, i) => sum + i.amountPaid, 0),
      totalOutstanding: invoices.reduce((sum, i) => sum + i.balance, 0),
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
    invoices.forEach((invoice) => {
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
});

// Export all invoice tools
export const invoiceTools = {
  listInvoices,
  getInvoiceDetails,
  getOverdueInvoices,
  getCustomerBalance,
  getInvoiceStats,
};
