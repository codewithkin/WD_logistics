"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { PaymentMethod } from "@/lib/types";

export async function createPayment(data: {
  invoiceId: string;
  customerId: string;
  amount: number;
  paymentDate: Date;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
}) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: data.invoiceId, organizationId: session.organizationId },
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
    reference?: string;
    notes?: string;
  }
) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    // Get payment via invoice to verify organization access
    const payment = await prisma.payment.findFirst({
      where: { id },
      include: { invoice: true },
    });

    if (!payment || payment.invoice.organizationId !== session.organizationId) {
      return { success: false, error: "Payment not found" };
    }

    const amountDiff = (data.amount ?? payment.amount) - payment.amount;

    const updatedPayment = await prisma.payment.update({
      where: { id },
      data,
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
      include: { invoice: true },
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

    revalidatePath("/finance/payments");
    revalidatePath(`/finance/invoices/${payment.invoiceId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to delete payment:", error);
    return { success: false, error: "Failed to delete payment" };
  }
}
