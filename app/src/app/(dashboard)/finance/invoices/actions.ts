"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, requireAuth } from "@/lib/session";
import { InvoiceStatus } from "@/lib/types";
import { sendInvoiceEmail } from "@/lib/email";
import { generateInvoiceReportPDF } from "@/lib/reports/pdf-report-generator";

export async function createInvoice(data: {
  invoiceNumber: string;
  customerId: string;
  issueDate: Date;
  dueDate: Date;
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  balance: number;
  status: InvoiceStatus;
  notes?: string;
}) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        invoiceNumber: data.invoiceNumber,
        organizationId: session.organizationId,
      },
    });

    if (existingInvoice) {
      return { success: false, error: "An invoice with this number already exists" };
    }

    // Fetch customer details for email
    const customer = await prisma.customer.findUnique({
      where: { id: data.customerId },
      select: { name: true, email: true },
    });

    // Fetch organization name
    const organization = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { name: true },
    });

    const invoice = await prisma.invoice.create({
      data: {
        organizationId: session.organizationId,
        invoiceNumber: data.invoiceNumber,
        customerId: data.customerId,
        issueDate: data.issueDate,
        dueDate: data.dueDate,
        subtotal: data.subtotal,
        tax: data.tax,
        total: data.total,
        amountPaid: data.amountPaid,
        balance: data.balance,
        status: data.status,
        notes: data.notes,
      },
    });

    // Update customer balance - subtract the invoice total from their balance
    // Negative balance = customer owes us, Positive balance = customer has credit
    await prisma.customer.update({
      where: { id: data.customerId },
      data: {
        balance: {
          decrement: data.total,
        },
      },
    });

    // Send invoice email to customer (async, don't block)
    if (customer?.email) {
      sendInvoiceEmail({
        customerName: customer.name,
        customerEmail: customer.email,
        invoiceNumber: data.invoiceNumber,
        issueDate: data.issueDate,
        dueDate: data.dueDate,
        subtotal: data.subtotal,
        tax: data.tax,
        total: data.total,
        organizationName: organization?.name,
        notes: data.notes,
      }).catch((err) => {
        console.error("Failed to send invoice email:", err);
      });
    }

    revalidatePath("/finance/invoices");
    return { success: true, invoice };
  } catch (error) {
    console.error("Failed to create invoice:", error);
    return { success: false, error: "Failed to create invoice" };
  }
}

export async function updateInvoice(
  id: string,
  data: {
    invoiceNumber?: string;
    customerId?: string;
    issueDate?: Date;
    dueDate?: Date;
    subtotal?: number;
    tax?: number;
    total?: number;
    balance?: number;
    status?: InvoiceStatus;
    notes?: string;
  }
) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: session.organizationId },
    });

    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    if (data.invoiceNumber && data.invoiceNumber !== invoice.invoiceNumber) {
      const existingInvoice = await prisma.invoice.findFirst({
        where: {
          invoiceNumber: data.invoiceNumber,
          organizationId: session.organizationId,
          NOT: { id },
        },
      });

      if (existingInvoice) {
        return { success: false, error: "An invoice with this number already exists" };
      }
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data,
    });

    revalidatePath("/finance/invoices");
    revalidatePath(`/finance/invoices/${id}`);
    return { success: true, invoice: updatedInvoice };
  } catch (error) {
    console.error("Failed to update invoice:", error);
    return { success: false, error: "Failed to update invoice" };
  }
}

export async function deleteInvoice(id: string) {
  const session = await requireRole(["admin"]);

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: session.organizationId },
      include: {
        _count: {
          select: { payments: true },
        },
      },
    });

    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    if (invoice._count.payments > 0) {
      return { success: false, error: "Cannot delete invoice with associated payments" };
    }

    await prisma.invoice.delete({ where: { id } });

    revalidatePath("/finance/invoices");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete invoice:", error);
    return { success: false, error: "Failed to delete invoice" };
  }
}

export async function generateInvoiceNumber(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  const lastInvoice = await prisma.invoice.findFirst({
    where: {
      organizationId,
      invoiceNumber: { startsWith: prefix },
    },
    orderBy: { invoiceNumber: "desc" },
  });

  if (lastInvoice) {
    const lastNumber = parseInt(lastInvoice.invoiceNumber.replace(prefix, ""), 10);
    return `${prefix}${String(lastNumber + 1).padStart(4, "0")}`;
  }

  return `${prefix}0001`;
}

export async function exportInvoicesPDF(options?: {
  invoiceIds?: string[];
  startDate?: Date;
  endDate?: Date;
}) {
  const session = await requireAuth();

  try {
    const startDate = options?.startDate || new Date(new Date().setMonth(new Date().getMonth() - 1));
    const endDate = options?.endDate || new Date();

    const whereClause: Record<string, unknown> = {
      organizationId: session.organizationId,
      issueDate: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (options?.invoiceIds && options.invoiceIds.length > 0) {
      whereClause.id = { in: options.invoiceIds };
    }

    const invoices = await prisma.invoice.findMany({
      where: whereClause,
      include: {
        customer: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { invoiceNumber: "asc" },
    });

    const invoiceData = invoices.map((inv) => ({
      invoiceNumber: inv.invoiceNumber,
      customer: inv.customer.name,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      total: inv.total,
      amountPaid: inv.amountPaid,
      balance: inv.balance,
      status: inv.status,
    }));

    const analytics = {
      totalInvoices: invoices.length,
      totalValue: invoices.reduce((sum, inv) => sum + inv.total, 0),
      totalPaid: invoices.reduce((sum, inv) => sum + inv.amountPaid, 0),
      totalBalance: invoices.reduce((sum, inv) => sum + inv.balance, 0),
      paidCount: invoices.filter((inv) => inv.status === "paid").length,
      overdueCount: invoices.filter((inv) => inv.status === "overdue").length,
    };

    const pdfBytes = generateInvoiceReportPDF({
      invoices: invoiceData,
      analytics,
      period: { startDate, endDate },
    });

    return {
      success: true,
      pdf: Buffer.from(pdfBytes).toString("base64"),
      filename: `invoices-report-${new Date().toISOString().split("T")[0]}.pdf`,
    };
  } catch (error) {
    console.error("Failed to export invoices PDF:", error);
    return { success: false, error: "Failed to generate PDF report" };
  }
}
