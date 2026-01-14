import { z } from "zod";
import { invoicesApi, customersApi } from "../lib/api-client";

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
    const { organizationId, status, customerId, startDate, endDate } = params;

    try {
      const result = await invoicesApi.list(organizationId, { status, customerId, startDate, endDate });
      
      return {
        invoices: result.invoices.map((invoice) => ({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          customerName: invoice.customerName,
          total: invoice.total,
          balance: invoice.balance,
          status: invoice.status,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
        })),
        total: result.total,
      };
    } catch (error) {
      console.error("Error listing invoices:", error);
      return { invoices: [], total: 0, error: "Failed to fetch invoices" };
    }
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
    const { invoiceId, organizationId } = params;

    if (!invoiceId) {
      return { invoice: null };
    }

    try {
      const invoice = await invoicesApi.details(organizationId, invoiceId);
      return {
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          customer: invoice.customer,
          total: invoice.total,
          amountPaid: invoice.amountPaid,
          balance: invoice.balance,
          status: invoice.status,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          lineItems: invoice.lineItems,
          payments: invoice.payments,
          notes: invoice.notes,
        },
      };
    } catch (error) {
      console.error("Error getting invoice details:", error);
      return { invoice: null, error: "Failed to fetch invoice details" };
    }
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

    try {
      const result = await invoicesApi.overdue(organizationId);
      return {
        overdueInvoices: result.invoices.map((invoice) => ({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          customerName: invoice.customerName,
          balance: invoice.balance,
          dueDate: invoice.dueDate,
          daysOverdue: invoice.daysOverdue,
        })),
        totalOverdue: result.invoices.reduce((sum, inv) => sum + inv.balance, 0),
      };
    } catch (error) {
      console.error("Error getting overdue invoices:", error);
      return { overdueInvoices: [], totalOverdue: 0, error: "Failed to fetch overdue invoices" };
    }
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
    const { customerId, organizationId } = params;

    if (!customerId) {
      return { customer: null };
    }

    try {
      const result = await customersApi.balance(organizationId, customerId);
      return {
        customer: {
          id: result.customer.id,
          name: result.customer.name,
          balance: result.outstanding,
          recentInvoices: result.invoices,
        },
      };
    } catch (error) {
      console.error("Error getting customer balance:", error);
      return { customer: null, error: "Failed to fetch customer balance" };
    }
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
    const { organizationId } = params;

    try {
      const result = await invoicesApi.summary(organizationId);
      return {
        stats: {
          totalInvoices: result.total,
          byStatus: result.byStatus,
          totalInvoiced: result.totalAmount,
          totalCollected: result.totalPaid,
          totalOutstanding: result.totalOutstanding,
          collectionRate: result.totalAmount > 0 
            ? Math.round((result.totalPaid / result.totalAmount) * 100) 
            : 0,
        },
        topCustomers: [],
      };
    } catch (error) {
      console.error("Error getting invoice stats:", error);
      return { stats: null, topCustomers: [], error: "Failed to fetch invoice stats" };
    }
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
