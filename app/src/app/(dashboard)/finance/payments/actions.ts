"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { PaymentMethod } from "@/lib/types";

export async function createPayment(data: {
  invoiceId: string;
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
      include: {
        payments: true,
      },
    });

    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
    const balance = invoice.totalAmount - totalPaid;

    if (data.amount > balance) {
      return { success: false, error: `Payment amount exceeds balance of $${balance}` };
    }

    const payment = await prisma.payment.create({
      data: {
        ...data,
        organizationId: session.organizationId,
      },
    });

    // Update invoice status if fully paid
    const newTotalPaid = totalPaid + data.amount;
    if (newTotalPaid >= invoice.totalAmount) {
      await prisma.invoice.update({
        where: { id: data.invoiceId },
        data: { status: "paid" },
      });
    }

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
    const payment = await prisma.payment.findFirst({
      where: { id, organizationId: session.organizationId },
    });

    if (!payment) {
      return { success: false, error: "Payment not found" };
    }

    const updatedPayment = await prisma.payment.update({
      where: { id },
      data,
    });

    // Recalculate invoice status
    const invoice = await prisma.invoice.findFirst({
      where: { id: payment.invoiceId },
      include: { payments: true },
    });

    if (invoice) {
      const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
      const newStatus =
        totalPaid >= invoice.totalAmount
          ? "paid"
          : totalPaid > 0
          ? "sent"
          : invoice.status;

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: newStatus },
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
    const payment = await prisma.payment.findFirst({
      where: { id, organizationId: session.organizationId },
    });

    if (!payment) {
      return { success: false, error: "Payment not found" };
    }

    await prisma.payment.delete({ where: { id } });

    // Update invoice status
    const invoice = await prisma.invoice.findFirst({
      where: { id: payment.invoiceId },
      include: { payments: true },
    });

    if (invoice) {
      const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
      if (totalPaid < invoice.totalAmount && invoice.status === "paid") {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: "sent" },
        });
      }
    }

    revalidatePath("/finance/payments");
    revalidatePath(`/finance/invoices/${payment.invoiceId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to delete payment:", error);
    return { success: false, error: "Failed to delete payment" };
  }
}
