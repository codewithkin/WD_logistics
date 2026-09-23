"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, requireAuth } from "@/lib/session";
import { gateChange } from "@/lib/edit-requests/gate";
import { resolvePeriod } from "@/lib/period-range";
import { PaymentMethod } from "@/lib/types";
import { generatePaymentReportPDF } from "@/lib/reports/pdf-report-generator";
import { notifyPaymentCreated, notifyPaymentUpdated, notifyPaymentDeleted } from "@/lib/notifications";
import { notifyInvoiceFullyPaid, notifyAdminPaymentReceived } from "@/lib/whatsapp-notifications";
import { handleActionError } from "@/lib/error-messages";

export async function createPayment(data: {
  invoiceId?: string;
  customerId: string;
  amount: number;
  paymentDate: Date;
  method: PaymentMethod;
  customMethod?: string;
  notes?: string;
}) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    // Verify customer belongs to organization
    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, organizationId: session.organizationId },
      select: { id: true, name: true },
    });

    if (!customer) {
      return { success: false as const, error: "Customer not found" };
    }

    let invoice = null;

    // If invoice is provided, validate it
    if (data.invoiceId) {
      invoice = await prisma.invoice.findFirst({
        where: { id: data.invoiceId, organizationId: session.organizationId },
        include: { customer: { select: { name: true } } },
      });

      if (!invoice) {
        return { success: false as const, error: "Invoice not found" };
      }

      if (data.amount > invoice.balance) {
        return { success: false as const, error: `Payment amount exceeds balance of $${invoice.balance}` };
      }
    }

    const payment = await prisma.payment.create({
      data: {
        invoiceId: data.invoiceId || null,
        customerId: data.customerId,
        amount: data.amount,
        paymentDate: data.paymentDate,
        method: data.method,
        customMethod: data.method === "other" ? data.customMethod : null,
        notes: data.notes,
      },
    });

    // Update invoice amountPaid and balance if invoice was provided
    let invoiceFullyPaid = false;
    if (invoice) {
      const newAmountPaid = invoice.amountPaid + data.amount;
      const newBalance = invoice.total - newAmountPaid;
      const newStatus = newBalance <= 0 ? "paid" : newAmountPaid > 0 ? "partial" : invoice.status;
      invoiceFullyPaid = newBalance <= 0 && invoice.status !== "paid";

      await prisma.invoice.update({
        where: { id: data.invoiceId },
        data: { 
          amountPaid: newAmountPaid, 
          balance: newBalance,
          status: newStatus,
        },
      });
    }

    // Update customer balance - add the payment amount (reduces debt)
    await prisma.customer.update({
      where: { id: data.customerId },
      data: {
        balance: {
          increment: data.amount,
        },
      },
    });

    // Send admin notification
    notifyPaymentCreated(
      {
        id: payment.id,
        paymentNumber: `PMT-${payment.id.slice(-8).toUpperCase()}`,
        customerName: customer.name,
        amount: data.amount,
        method: data.method,
      },
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin notification:", err));

    // Send WhatsApp notification to admin
    notifyAdminPaymentReceived(
      payment.id,
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin WhatsApp notification:", err));

    // If invoice is fully paid, send special notification to customer (email) and admin
    if (invoiceFullyPaid && data.invoiceId) {
      notifyInvoiceFullyPaid(
        data.invoiceId,
        session.organizationId,
        { name: session.user.name, email: session.user.email, role: session.role }
      ).catch((err) => console.error("Failed to send invoice fully paid notification:", err));
    }

    revalidatePath("/finance/payments");
    if (data.invoiceId) {
      revalidatePath(`/finance/invoices/${data.invoiceId}`);
    }
    return { success: true as const, payment };
  } catch (error) {
    return handleActionError(error, "Failed to create payment");
  }
}

export async function updatePayment(
  id: string,
  data: {
    amount?: number;
    paymentDate?: Date;
    method?: PaymentMethod;
    customMethod?: string;
    notes?: string;
  },
  /**
   * Why the change is wanted. Required for anyone but an admin, whose
   * edit becomes a request rather than a write — see lib/edit-requests.
   */
  reason?: string,
) {
  const session = await requireAuth();

  // Admins write directly; everyone else's change becomes a request an
  // admin accepts or refuses. Everything below runs either for an admin,
  // or while an approved request is being replayed.
  const gate = await gateChange({
    entityType: "payment",
    entityId: id,
    data: data as unknown as Record<string, unknown>,
    action: "update",
    reason,
  });
  if (!gate.proceed) return gate.response;

  try {
    // Get payment with optional invoice to verify organization access
    const payment = await prisma.payment.findFirst({
      where: { id },
      include: { 
        invoice: true,
        customer: { 
          select: { 
            name: true,
            organizationId: true,
          } 
        },
      },
    });

    // Verify organization access via invoice or customer
    const orgId = payment?.invoice?.organizationId || payment?.customer?.organizationId;
    if (!payment || orgId !== session.organizationId) {
      return { success: false as const, error: "Payment not found" };
    }

    const amountDiff = (data.amount ?? payment.amount) - payment.amount;

    const updatedPayment = await prisma.payment.update({
      where: { id },
      data: {
        ...data,
        customMethod: data.method === "other" ? data.customMethod : null,
      },
    });

    // Recalculate invoice if amount changed and payment has an invoice
    let invoiceFullyPaid = false;
    if (amountDiff !== 0 && payment.invoice) {
      const invoice = payment.invoice;
      const newAmountPaid = invoice.amountPaid + amountDiff;
      const newBalance = invoice.total - newAmountPaid;
      const newStatus = newBalance <= 0 ? "paid" : newAmountPaid > 0 ? "partial" : "sent";
      invoiceFullyPaid = newBalance <= 0 && invoice.status !== "paid";

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { 
          amountPaid: newAmountPaid, 
          balance: newBalance,
          status: newStatus,
        },
      });
    }

    // Send admin notification
    notifyPaymentUpdated(
      {
        id: updatedPayment.id,
        paymentNumber: `PMT-${updatedPayment.id.slice(-8).toUpperCase()}`,
        customerName: payment.customer.name,
        amount: updatedPayment.amount,
        method: updatedPayment.method,
      },
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin notification:", err));

    // Send WhatsApp notification to admin
    notifyAdminPaymentReceived(
      updatedPayment.id,
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin WhatsApp notification:", err));

    // If invoice is fully paid, send special notification to customer (email) and admin
    if (invoiceFullyPaid && payment.invoice) {
      notifyInvoiceFullyPaid(
        payment.invoice.id,
        session.organizationId,
        { name: session.user.name, email: session.user.email, role: session.role }
      ).catch((err) => console.error("Failed to send invoice fully paid notification:", err));
    }

    revalidatePath("/finance/payments");
    if (payment.invoiceId) {
      revalidatePath(`/finance/invoices/${payment.invoiceId}`);
    }
    return { success: true as const, payment: updatedPayment };
  } catch (error) {
    return handleActionError(error, "Failed to update payment");
  }
}

export async function deletePayment(id: string,
  /**
   * Why the change is wanted. Required for anyone but an admin, whose
   * edit becomes a request rather than a write — see lib/edit-requests.
   */
  reason?: string,
) {
  const session = await requireAuth();

  // Admins write directly; everyone else's change becomes a request an
  // admin accepts or refuses. Everything below runs either for an admin,
  // or while an approved request is being replayed.
  const gate = await gateChange({
    entityType: "payment",
    entityId: id,
    data: {},
    action: "delete",
    reason,
  });
  if (!gate.proceed) return gate.response;

  try {
    // Get payment with optional invoice to verify organization access
    const payment = await prisma.payment.findFirst({
      where: { id },
      include: { 
        invoice: true,
        customer: { 
          select: { 
            name: true,
            organizationId: true,
          } 
        },
      },
    });

    // Verify organization access via invoice or customer
    const orgId = payment?.invoice?.organizationId || payment?.customer?.organizationId;
    if (!payment || orgId !== session.organizationId) {
      return { success: false as const, error: "Payment not found" };
    }

    await prisma.payment.delete({ where: { id } });

    // Update invoice amountPaid and balance if payment had an invoice
    if (payment.invoice) {
      const invoice = payment.invoice;
      const newAmountPaid = invoice.amountPaid - payment.amount;
      const newBalance = invoice.total - newAmountPaid;
      const newStatus = newBalance <= 0 ? "paid" : newAmountPaid > 0 ? "partial" : "sent";

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { 
          amountPaid: newAmountPaid, 
          balance: newBalance,
          status: newStatus,
        },
      });
    }

    // Send admin notification
    notifyPaymentDeleted(
      `PMT-${payment.id.slice(-8).toUpperCase()}`,
      payment.customer.name,
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin notification:", err));

    revalidatePath("/finance/payments");
    if (payment.invoiceId) {
      revalidatePath(`/finance/invoices/${payment.invoiceId}`);
    }
    return { success: true as const };
  } catch (error) {
    return handleActionError(error, "Failed to delete payment");
  }
}

export async function exportPaymentsPDF(options?: {
  paymentIds?: string[];
  startDate?: Date;
  endDate?: Date;
}) {
  // Prints revenue and balances, which canViewFinancialData reserves
  // for admin. This used to need only a session.
  const session = await requireRole(["admin"]);

  try {
    // The client now always sends the period on screen; the fallback is only
    // for a caller that omits it, and it is validated rather than trusted.
    const range = resolvePeriod({ from: options?.startDate, to: options?.endDate }, "1m");
    const startDate = range.from;
    const endDate = range.to;

    const whereClause: Record<string, unknown> = {
      invoice: { organizationId: session.organizationId },
      paymentDate: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (options?.paymentIds && options.paymentIds.length > 0) {
      whereClause.id = { in: options.paymentIds };
    }

    const payments = await prisma.payment.findMany({
      where: whereClause,
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            customer: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { paymentDate: "desc" },
    });

    const paymentData = payments.map((pmt) => ({
      invoiceNumber: pmt.invoice.invoiceNumber,
      customer: pmt.invoice.customer.name,
      amount: pmt.amount,
      paymentDate: pmt.paymentDate,
      method: pmt.method,
    }));

    // Count by payment method
    const methodCounts: { [key: string]: number } = {};
    payments.forEach((pmt) => {
      methodCounts[pmt.method] = (methodCounts[pmt.method] || 0) + 1;
    });

    const analytics = {
      totalPayments: payments.length,
      totalAmount: payments.reduce((sum, pmt) => sum + pmt.amount, 0),
      averageAmount: payments.length > 0 ? payments.reduce((sum, pmt) => sum + pmt.amount, 0) / payments.length : 0,
      paymentMethods: methodCounts,
    };

    const pdfBytes = generatePaymentReportPDF({
      payments: paymentData,
      analytics,
      period: { startDate, endDate },
    });

    return {
      success: true as const,
      pdf: Buffer.from(pdfBytes).toString("base64"),
      filename: `payments-report-${new Date().toISOString().split("T")[0]}.pdf`,
    };
  } catch (error) {
    return handleActionError(error, "Failed to generate PDF report", "Failed to export payments PDF");
  }
}

export async function downloadPaymentReceiptPDF(paymentId: string) {
  const session = await requireRole(["admin", "supervisor"]);
  const { generatePaymentReceiptPDF } = await import("@/lib/reports/receipt-generator");

  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      invoice: {
        organizationId: session.organizationId,
      },
    },
    include: {
      invoice: {
        include: {
          customer: true,
        },
      },
    },
  });

  if (!payment) {
    return { success: false as const, error: "Payment not found" };
  }

  const organization = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { name: true },
  });

  const pdfBytes = generatePaymentReceiptPDF({
    payment: {
      id: payment.id,
      amount: payment.amount,
      paymentDate: payment.paymentDate,
      method: payment.method,
      customMethod: payment.customMethod,
      reference: payment.reference,
      notes: payment.notes,
    },
    invoice: {
      invoiceNumber: payment.invoice.invoiceNumber,
      total: payment.invoice.total,
      amountPaid: payment.invoice.amountPaid,
      balance: payment.invoice.balance,
    },
    customer: {
      name: payment.invoice.customer.name,
      email: payment.invoice.customer.email,
      phone: payment.invoice.customer.phone,
      address: payment.invoice.customer.address,
    },
    organization: {
      name: organization?.name || "Unknown",
    },
  });

  // Convert to base64 for transfer
  const base64 = Buffer.from(pdfBytes).toString("base64");
  const receiptNumber = `RCP-${payment.id.slice(-8).toUpperCase()}`;
  return {
    success: true as const,
    data: base64,
    filename: `${receiptNumber}.pdf`,
  };
}
