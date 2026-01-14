"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, requireAuth } from "@/lib/session";
import { PaymentMethod } from "@/lib/types";
import { generatePaymentReportPDF } from "@/lib/reports/pdf-report-generator";
import { notifyPaymentCreated, notifyPaymentUpdated, notifyPaymentDeleted } from "@/lib/notifications";

export async function createPayment(data: {
  invoiceId: string;
  customerId: string;
  amount: number;
  paymentDate: Date;
  method: PaymentMethod;
  customMethod?: string;
  reference?: string;
  notes?: string;
}) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: data.invoiceId, organizationId: session.organizationId },
      include: { customer: { select: { name: true } } },
    });

    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    if (data.amount > invoice.balance) {
      return { success: false, error: `Payment amount exceeds balance of $${invoice.balance}` };
    }

    const payment = await prisma.payment.create({
      data: {
        invoiceId: data.invoiceId,
        customerId: data.customerId,
        amount: data.amount,
        paymentDate: data.paymentDate,
        method: data.method,
        customMethod: data.method === "other" ? data.customMethod : null,
        reference: data.reference,
        notes: data.notes,
      },
    });

    // Update invoice amountPaid and balance
    const newAmountPaid = invoice.amountPaid + data.amount;
    const newBalance = invoice.total - newAmountPaid;
    const newStatus = newBalance <= 0 ? "paid" : newAmountPaid > 0 ? "partial" : invoice.status;

    await prisma.invoice.update({
      where: { id: data.invoiceId },
      data: { 
        amountPaid: newAmountPaid, 
        balance: newBalance,
        status: newStatus,
      },
    });

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
        customerName: invoice.customer.name,
        amount: data.amount,
        method: data.method,
      },
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin notification:", err));

    revalidatePath("/finance/payments");
    revalidatePath(`/finance/invoices/${data.invoiceId}`);
    return { success: true, payment };
  } catch (error) {
    console.error("Failed to create payment:", error);
    return { success: false, error: "Failed to create payment" };
  }
}

export async function updatePayment(
  id: string,
  data: {
    amount?: number;
    paymentDate?: Date;
    method?: PaymentMethod;
    customMethod?: string;
    reference?: string;
    notes?: string;
  }
) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    // Get payment via invoice to verify organization access
    const payment = await prisma.payment.findFirst({
      where: { id },
      include: { 
        invoice: true,
        customer: { select: { name: true } },
      },
    });

    if (!payment || payment.invoice.organizationId !== session.organizationId) {
      return { success: false, error: "Payment not found" };
    }

    const amountDiff = (data.amount ?? payment.amount) - payment.amount;

    const updatedPayment = await prisma.payment.update({
      where: { id },
      data: {
        ...data,
        customMethod: data.method === "other" ? data.customMethod : null,
      },
    });

    // Recalculate invoice if amount changed
    if (amountDiff !== 0) {
      const invoice = payment.invoice;
      const newAmountPaid = invoice.amountPaid + amountDiff;
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

    revalidatePath("/finance/payments");
    revalidatePath(`/finance/invoices/${payment.invoiceId}`);
    return { success: true, payment: updatedPayment };
  } catch (error) {
    console.error("Failed to update payment:", error);
    return { success: false, error: "Failed to update payment" };
  }
}

export async function deletePayment(id: string) {
  const session = await requireRole(["admin"]);

  try {
    // Get payment via invoice to verify organization access
    const payment = await prisma.payment.findFirst({
      where: { id },
      include: { 
        invoice: true,
        customer: { select: { name: true } },
      },
    });

    if (!payment || payment.invoice.organizationId !== session.organizationId) {
      return { success: false, error: "Payment not found" };
    }

    await prisma.payment.delete({ where: { id } });

    // Update invoice amountPaid and balance
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

    // Send admin notification
    notifyPaymentDeleted(
      `PMT-${payment.id.slice(-8).toUpperCase()}`,
      payment.customer.name,
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin notification:", err));

    revalidatePath("/finance/payments");
    revalidatePath(`/finance/invoices/${payment.invoiceId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to delete payment:", error);
    return { success: false, error: "Failed to delete payment" };
  }
}

export async function exportPaymentsPDF(options?: {
  paymentIds?: string[];
  startDate?: Date;
  endDate?: Date;
}) {
  const session = await requireAuth();

  try {
    const startDate = options?.startDate || new Date(new Date().setMonth(new Date().getMonth() - 1));
    const endDate = options?.endDate || new Date();

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
      reference: pmt.reference || "N/A",
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
      success: true,
      pdf: Buffer.from(pdfBytes).toString("base64"),
      filename: `payments-report-${new Date().toISOString().split("T")[0]}.pdf`,
    };
  } catch (error) {
    console.error("Failed to export payments PDF:", error);
    return { success: false, error: "Failed to generate PDF report" };
  }
}
