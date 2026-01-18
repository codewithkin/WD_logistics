"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { sendInvoiceReminderEmail } from "@/lib/email";

/**
 * Send invoice payment reminder via Email
 */
export async function sendInvoiceReminderByEmail(invoiceId: string) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    // Fetch invoice with customer details
    const invoice = await prisma.invoice.findFirst({
      where: { 
        id: invoiceId,
        organizationId: session.organizationId 
      },
      include: {
        customer: true,
        organization: true,
      },
    });

    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    if (!invoice.customer.email) {
      return { success: false, error: "Customer has no email address configured" };
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const isOverdue = invoice.dueDate !== null && invoice.dueDate < today;
    const daysOverdue = isOverdue && invoice.dueDate
      ? Math.ceil((now.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    await sendInvoiceReminderEmail({
      customerName: invoice.customer.name,
      customerEmail: invoice.customer.email,
      invoiceNumber: invoice.invoiceNumber,
      dueDate: invoice.dueDate ?? new Date(),
      total: invoice.total,
      balance: invoice.balance,
      isOverdue,
      daysOverdue,
      organizationName: invoice.organization?.name,
    });

    // Mark reminder as sent
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { 
        reminderSent: true, 
        reminderSentAt: now 
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send invoice reminder:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to send email reminder" 
    };
  }
}
