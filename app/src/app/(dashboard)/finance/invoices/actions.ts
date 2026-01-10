"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { InvoiceStatus } from "@/lib/types";

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
